// Stage 0 test synth: a plain saw through a low-pass filter with an AR envelope.
// Purpose: prove the Tidal/Strudel -> SuperDirt path, custom params, and the gate strategy
// (CLAUDE.md Section 5). Not part of the final instrument.
//
// Custom params (prefixed to avoid SuperDirt/Tidal/Strudel name clashes):
//   tstbright  0-1      filter brightness (0 = dark, 1 = bright)
//   tstrel     0.01-8 s release time (also added to the event's sustain, see below)

(
SynthDef(\sctest, { |out, pan = 0, freq = 220, sustain = 1, tstbright = 0.5, tstrel = 0.3|
	var rel, gateTime, env, sig;

	// SuperDirt frees the event at `sustain`, so `sustain` already includes the release
	// (see the addSynth sustain function below). Keep the gate open for the rest.
	rel = tstrel.clip(0.01, 8);
	gateTime = (sustain - rel).max(0.005);

	// Env.linen-style AR: short attack, hold until gate time, curved (capacitor-like) release.
	env = EnvGen.ar(
		Env([0, 1, 1, 0], [0.005, gateTime, rel], [0, 0, -4]),
		doneAction: 2
	);

	// Saw is band-limited, so no aliasing on high notes.
	sig = Saw.ar(freq);
	// Exponential brightness mapping: 200 Hz .. 12 kHz.
	sig = RLPF.ar(sig, tstbright.clip(0, 1).linexp(0, 1, 200, 12000), 0.5);
	sig = sig * env * 0.3;

	OffsetOut.ar(out, DirtPan.ar(sig, ~dirt.numChannels, pan));
}).add;

// Register with SuperDirt so the event's sustain = note length + release time.
// A `sustain` sent by the pattern still overrides this (pattern values beat proto values).
~dirt.soundLibrary.addSynth(\sctest, (
	instrument: \sctest,
	sustain: {
		// Tidal always sends `delta`; the fallback covers senders that don't.
		var len = (~delta.value ? 0.25) * (~legato.value ? 1);
		len + (~tstrel.value ? 0.3)
	}
));

"[synth] sctest loaded".postln;
)
