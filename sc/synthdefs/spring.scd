// synth-SC-STD — spring reverb (6.15), as a SuperDirt global effect (one per orbit, like `room`).
// Decision (Stage 6, Architecture decision 7): a SuperDirt global effect instead of a separate
// FX bus, because it then works the same for event mode and mono mode (both write to the orbit's
// dry bus), can be set per orbit (d1, d2, ...), and sleeps when unused (DirtPause).
// Default spmix 0 = off (user's choice, 2026-09-23): existing sounds stay dry.
//
// Params (also on the panel): spmix 0-1 wet level, spdecay 0-1 tail length, sptone 0-1 brightness.
// scstd events always carry these params (pattern value, else panel value; see scstd.scd), so
// removing spmix from a pattern falls back to the panel. Other sounds on the orbit (samples) only
// change the reverb if their pattern sends spmix, like SuperDirt's own `room`.
//
// Model: no impulse response (no licensing issues), a small digital model of two springs:
//   - input high-passed at 120 Hz (springs do not carry deep bass);
//   - each spring = a feedback loop: a chain of stretched allpass filters (dispersion: different
//     frequencies travel at different speeds, which makes the typical "chirp"/"boing"; every round
//     trip disperses the sound further, like a real spring), a lowpass (tone) and a delay (the
//     spring's round-trip time, 43 and 52 ms; slightly different so left and right decorrelate);
//   - feedback gain from spdecay: 0.55..0.93, i.e. a tail of roughly 0.5 s .. 4 s.
// Reference: Välimäki, Parker & Abel (2010), "Parametric spring reverberation effect" (the idea of
// allpass-chain dispersion inside a delay loop; this is a simplified version, tuned by ear).

(
// ~scstdNumChannels lets offline tests set it without a real SuperDirt (an Event's own
// numChannels method returns 1, so a mock ~dirt Event cannot provide it).
var numChannels = ~scstdNumChannels ?? { ~dirt.numChannels };

~scstdSpringDef = SynthDef("scstd_spring" ++ numChannels, { |dryBus, effectBus, gate = 1, spmix = 0, spdecay = 0.5, sptone = 0.5|
	var in = HPF.ar(In.ar(dryBus, numChannels).asArray.sum, 120) * spmix.lag(0.05);
	var g = spdecay.lag(0.1).linlin(0, 1, 0.55, 0.93);
	var lp = sptone.lag(0.1).linexp(0, 1, 1000, 9000);   // tone: lowpass in the loop, 1-9 kHz
	var fb = LocalIn.ar(2);
	var springs = [[0.0433, 12], [0.0517, 11]].collect { |spec, i|
		var t = spec[0], d = spec[1] / SampleRate.ir;
		var x = in + (fb[i] * g);
		// Dispersion: 40 "stretched" allpasses (each an allpass over d = 11-12 samples, coefficient
		// 0.6; AllpassN's decay time d * 13.52 gives exactly 0.6). Unity gain at every frequency, so
		// the loop stays stable, but low frequencies come out later than high ones: measured ~30 ms
		// spread (100-300 Hz vs 5-10 kHz) per pass, the spring "chirp". Plain one-sample allpasses
		// (tried first) only spread ~1 ms, which is inaudible.
		40.do { x = AllpassN.ar(x, 0.0005, d, d * 13.52) };
		x = LPF.ar(x, lp);
		// LocalIn adds one block of delay, so subtract it to keep the intended round-trip time.
		DelayC.ar(x, 0.1, t - ControlDur.ir)
	};
	var snd;
	LocalOut.ar(springs);
	snd = LeakDC.ar(springs) * 0.6;
	snd = if(numChannels == 2) { snd } { snd.sum.dup(numChannels) * 0.5 };
	DirtPause.ar(snd, graceTime: 4);
	snd = snd * EnvGen.kr(Env.asr, gate, doneAction: 2);
	Out.ar(effectBus, snd);
}, [\ir, \ir]);
~scstdSpringDef.add;

// Install into every orbit, before SuperDirt's rms/monitor effects (those must stay last).
// Re-loading this file replaces the previous instance instead of adding a second one.
if(~dirt.respondsTo(\orbits) or: { ~dirt.isKindOf(SuperDirt) }) { fork {
	Server.default.sync;
	~dirt.orbits.do { |orbit|
		var fx = orbit.globalEffects.reject { |e| e.name == \scstd_spring };
		var i = fx.detectIndex { |e| e.name == \dirt_rms } ? fx.size;
		orbit.globalEffects.select { |e| e.name == \scstd_spring }.do(_.release);
		orbit.globalEffects = fx.insert(i, GlobalDirtEffect(\scstd_spring, [\spmix, \spdecay, \sptone]));
		orbit.initNodeTree;
	};
	"[synth] spring reverb installed on % orbits".format(~dirt.orbits.size).postln;
} };
)
