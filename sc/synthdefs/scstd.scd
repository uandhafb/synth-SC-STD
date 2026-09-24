// synth-SC-STD — the main voice `scstd`.
// Needs 00_modules.scd (and sc/buses.scd for panel values) loaded first; see sc/startup.scd.
//
// Play from Tidal:    d1 $ n "0 3 7" # s "scstd" # vcfcut 800
// Play from Strudel:  n("0 3 7").s("scstd").vcfcut(800).osc()
//
// Two voice modes (Architecture decision 4), chosen per event by `monomode` (pattern or panel):
//   monomode 0 (event mode): one synth per event, polyphonic (SuperDirt's normal path).
//   monomode 1 (mono mode):  one persistent synth per orbit (d1, d2, ...). Notes set its pitch
//     and retrigger its envelopes; overlapping notes (legato >= 1) glide without retriggering;
//     S&H, LFOs and drift keep running across notes. `glide` sets the portamento time.

(
// Captured now: the functions below run inside SuperDirt's event environment,
// where project variables like ~scstdDefault are not visible.
var defErel = ~scstdDefault.(\erel), defArrel = ~scstdDefault.(\arrel);
// The panel state (sc/buses.scd), so panel values also apply here.
var state = ~scstdState ?? { () };
var unset = ~scstdUnset;
// Params sent to the mono synth on every note (all except the sclang-only ones).
var synthParams = ~scstdSpecs.keys.asArray.sort.reject { |k| ~scstdLangOnly.includes(k) };
// One mono voice per orbit: orbit -> (node, noteId, offTime).
var voices = IdentityDictionary.new;

// Event-mode synth: frees itself at the end of the event.
SynthDef(\scstd, { |out, pan = 0, freq = 220, sustain = 1|
	var p = ~scstdParams.();
	var sig = ~scstdMods[\voice].(p, freq, sustain);
	OffsetOut.ar(out, DirtPan.ar(sig, ~dirt.numChannels, pan));
}).add;

// Mono-mode synth: persistent, one per orbit. Writes straight to the orbit's dry bus (where
// SuperDirt's own event synths end up), so orbit effects like room/delay still apply.
//   freq: glides in pitch (semitones), so a glide takes the same time for any interval size.
//   gate: held by the note; retrig (a trigger) drops it for 3 ms so the envelopes restart on a
//   new, non-overlapping note.
SynthDef(\scstd_mono, { |out = 0, pan = 0.5, amp = 0.4|
	var p = ~scstdParams.();
	var freq = Lag.kr(\freq.kr(261.6256).cpsmidi, p.(\glide)).midicps;
	var gate = \gate.kr(0) * (1 - Trig1.kr(\retrig.tr(0), 0.003));
	var sig = ~scstdMods[\voice].(p, freq, 1, gate);
	Out.ar(out, DirtPan.ar(sig, ~dirt.numChannels, pan) * amp);
}).add;

// Cmd+. frees every node on the server, so forget the mono voices then.
~scstdMonoCmdPeriod !? { CmdPeriod.remove(~scstdMonoCmdPeriod) };
~scstdMonoCmdPeriod = { voices.clear };
CmdPeriod.add(~scstdMonoCmdPeriod);
~scstdMonoVoices = voices;   // for inspection from the IDE

// Register with SuperDirt.
~dirt.soundLibrary.addSynth(\scstd, (
	instrument: \scstd,
	// Event mode: `sustain` = note length + the longer release, so SuperDirt's dirt_gate does not
	// cut the tail (CLAUDE.md, Section 5). A pattern `sustain` overrides this.
	sustain: {
		var len = (~delta.value ? 0.25) * (~legato.value ? 1);
		var rel = max((~erel.value ? state[\erel] ? defErel).clip(0.001, 15),
			(~arrel.value ? state[\arrel] ? defArrel).clip(0.001, 15));
		len + rel
	},
	// SuperDirt calls `play` for every event; returning nil continues with its normal
	// (event-mode) path, returning anything else means "handled" (mono mode).
	play: { |dirtEvent|
		var orbit = dirtEvent.orbit, server = orbit.server;
		var mono = (~monomode.value ? state[\monomode] ? 0) >= 0.5;
		var v = voices[orbit];
		var lat = ~latency.value ? 0;
		var rel = max((~erel.value ? state[\erel] ? defErel).clip(0.001, 15),
			(~arrel.value ? state[\arrel] ? defArrel).clip(0.001, 15));

		if(mono.not) {
			// Event mode. If this orbit had a mono voice, let it release, then free it.
			if(v.notNil) {
				server.sendBundle(lat, [\n_set, v[\node], \gate, 0]);
				server.sendBundle(lat + rel + 0.2, [\n_free, v[\node]]);
				voices.removeAt(orbit);
			};
			nil
		} {
			var now = thisThread.seconds;
			var onTime = now + lat;
			var len = ((~delta.value ? 0.25) * (~legato.value ? 1)).max(0.005);
			// Legato: the previous note is still held when this one starts -> glide, no retrigger.
			var legato = v.notNil and: { v[\offTime] > (onTime + 0.002) };
			var amp = (~amp.value ? 0.4) * ((((~gain.value ? 1).min(2)) + (~overgain.value ? 0)) ** 4);
			var args = synthParams.collect { |k| [k, currentEnvironment[k] ? unset] }.flatten;
			var common = [\freq, ~freq.value, \gate, 1, \pan, ~pan.value ? 0.5, \amp, amp] ++ args;
			var myId;

			if(v.isNil) {
				v = (node: server.nextNodeID, noteId: 0, offTime: 0);
				voices[orbit] = v;
				server.makeBundle(lat, {
					server.sendMsg(*([\s_new, \scstd_mono, v[\node], 0, orbit.group,
						\out, orbit.dryBus.index] ++ common));
					orbit.globalEffects.do { |x| x.set(currentEnvironment) };
				});
			} {
				server.makeBundle(lat, {
					server.sendMsg(*([\n_set, v[\node]] ++ common ++ if(legato) { [] } { [\retrig, 1] }));
					orbit.globalEffects.do { |x| x.set(currentEnvironment) };
				});
			};

			// Gate off at the end of the note, unless a newer note arrived in the meantime.
			v[\noteId] = v[\noteId] + 1;
			myId = v[\noteId];
			v[\offTime] = onTime + len;
			SystemClock.sched(len, {
				if(voices[orbit] === v and: { v[\noteId] == myId }) {
					server.sendBundle(lat, [\n_set, v[\node], \gate, 0]);
				};
				nil
			});
			true
		}
	}
));

"[synth] scstd loaded (event + mono mode)".postln;
)
