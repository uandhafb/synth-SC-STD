// synth-SC-STD — shared parameter specs and module functions.
// Loaded first (00_ prefix) by sc/startup.scd; used by scstd.scd and by the offline tests.
//
// Every module is a plain function that builds UGens from a param lookup `p`
// (p.(\name) returns the clipped control for that param). The voice (scstd.scd) wires the
// modules together in the default (normalled) routing. Keeping modules separate lets each one
// be tested alone (CLAUDE.md, rule 7) and lets Stage 4 add patch sources without a rewrite.

(
// ---------------------------------------------------------------------------------------------
// Parameter specs: name -> [min, max, default]. Mirrors docs/params.md (the source of truth).
// Values from patterns are clipped to these ranges inside the synth.
~scstdSpecs = (
	// VCO 1 (6.1)
	o1wave: [0, 1, 0], o1lvl: [0, 1, 0.7], o1oct: [-3, 3, 0], o1fine: [-1, 1, 0],
	// VCO 2 (6.2)
	o2wave: [0, 3, 0], o2lvl: [0, 1, 0.7], o2oct: [-3, 3, 0], o2fine: [-1, 1, 0.05],
	o2pw: [0.05, 0.95, 0.5],
	// VCO 3 (6.3)
	o3wave: [0, 1, 0], o3lvl: [0, 1, 0], o3oct: [-3, 3, -1], o3fine: [-1, 1, -0.05],
	o3pw: [0.05, 0.95, 0.5],
	// Analog character (6.4)
	drift: [0, 1, 0.15], vspread: [0, 1, 0.1],
	// VCF (6.7)
	vcfcut: [20, 18000, 2000], vcfres: [0, 1.1, 0.2], vcfenv: [-1, 1, 0.4],
	vcfdrive: [0, 1, 0.3],
	vcfmodel: [0, 1, 0],   // TEMPORARY (Stage 1 A/B): 0 = MoogLadder, 1 = MoogFF
	// VCA (6.8)
	vcalvl: [0, 1, 0.8], vcaenv: [0, 1, 1],
	// ADSR (6.9) and AR (6.10)
	eatk: [0.001, 10, 0.01], edec: [0.001, 10, 0.3], esus: [0, 1, 0.6],
	erel: [0.001, 15, 0.4], ecurve: [-8, 8, -4],
	aratk: [0.001, 10, 0.005], arrel: [0.001, 15, 0.3]
);

// Default of a param (used by the SuperDirt sustain function in sclang).
~scstdDefault = { |name| ~scstdSpecs[name][2] };

// Builds the lookup used inside SynthDefs: a NamedControl with the spec default, clipped.
~scstdParams = {
	var specs = ~scstdSpecs;
	{ |name|
		var s = specs[name];
		s.isNil.if { Error("scstd: unknown param %".format(name)).throw };
		name.kr(s[2]).clip(s[0], s[1])
	}
};

~scstdMods = ();

// ---------------------------------------------------------------------------------------------
// Pitch helper: base freq -> VCO freq with octave, fine tune, drift, per-event spread and a
// modulation input in semitones (the pitch summing point, Architecture decision 6).
~scstdMods[\pitch] = { |freq, oct, fine, drift, spread, pitchMod = 0|
	// Drift: slow (0.05-0.3 Hz) smooth random wander. Real VCOs wander by a few cents as they
	// warm up; drift=1 gives at most +-25 cents, the default 0.15 about +-4 cents.
	var driftSemi = LFNoise1.kr(Rand(0.05, 0.3)) * drift * 0.25;
	// Spread: fixed random detune per event (Rand is chosen once when the synth starts),
	// so repeated notes are never exactly identical. spread=1 gives at most +-10 cents.
	var spreadSemi = Rand(-1.0, 1.0) * spread * 0.1;
	freq * (2 ** oct.round) * (fine + driftSemi + spreadSemi + pitchMod).midiratio
};

// ---------------------------------------------------------------------------------------------
// VCO 1: saw -> square crossfade.
// Saw and Pulse are band-limited in SuperCollider, so high notes do not alias.
~scstdMods[\vco1] = { |f, wave|
	var saw = Saw.ar(f);
	// Square scaled by 0.6 so its loudness roughly matches the saw (square RMS is ~1.7x saw RMS).
	var sqr = Pulse.ar(f, 0.5) * 0.6;
	(saw * (1 - wave)) + (sqr * wave)
};

// VCO 2: morph saw -> pulse -> triangle -> sine (o2wave 0..3).
// SelectX crossfades between neighbouring waves with equal power, so the morph has no level dips.
// LFTri is not band-limited, but triangle harmonics fall off at 1/n^2, so aliasing stays low.
~scstdMods[\vco2] = { |f, wave, pw, pwMod = 0|
	var width = (pw + pwMod).clip(0.05, 0.95);   // PWM summing point (Stage 2 connects sources)
	SelectX.ar(wave, [
		Saw.ar(f),
		Pulse.ar(f, width) * 0.6,
		LFTri.ar(f) * 0.9,
		SinOsc.ar(f) * 0.9
	])
};

// VCO 3: saw -> pulse crossfade.
~scstdMods[\vco3] = { |f, wave, pw, pwMod = 0|
	var width = (pw + pwMod).clip(0.05, 0.95);
	(Saw.ar(f) * (1 - wave)) + (Pulse.ar(f, width) * 0.6 * wave)
};

// ---------------------------------------------------------------------------------------------
// Mixer: weighted sum of the sources feeding the filter (normalled: VCO 1-3; noise and ring mod
// join in Stage 3). Scaled by 0.5 so three full-level VCOs do not slam the filter input.
~scstdMods[\mixer] = { |sources, levels|
	(sources * levels).sum * 0.5
};

// ---------------------------------------------------------------------------------------------
// Anti-aliased tanh (first-order antiderivative anti-aliasing, ADAA).
// A plain tanh creates harmonics above Nyquist that fold back as inharmonic "aliasing". ADAA
// outputs the average of tanh between two samples: (F(x) - F(x1)) / (x - x1), F = log(cosh x).
// Measured: 7-11 dB less aliasing than plain tanh on saws at C6-C8, no added noise when quiet.
// log(cosh v) is computed as |v| + log(1 + e^(-2|v|)) - log 2, which cannot overflow.
// When two samples are nearly equal the division is unstable, so fall back to tanh(midpoint).
~scstdMods[\tanhAA] = { |x|
	var x1 = Delay1.ar(x), dx = x - x1;
	var logcosh = { |v| v.abs + (1 + (-2 * v.abs).exp).log - 2.log };
	var small = dx.abs < 1e-3;
	Select.ar(small, [
		(logcosh.(x) - logcosh.(x1)) / (dx + (small * 1e-9)),
		((x + x1) * 0.5).tanh
	])
};

// ---------------------------------------------------------------------------------------------
// VCF: 4-pole low-pass ladder with input drive.
//   cutoff: base freq, moved by the ADSR (+-5 octaves at vcfenv = +-1) and a mod input (octaves).
//   Drive: tanh soft clipping before the ladder, 1x..8x gain. tanh keeps the peak at +-1, so more
//   drive means more harmonics rather than more level (like pushing an analog input stage).
//   Models:
//     0 MoogLadder (sc3-plugins): nonlinear ladder model; its help does not name the algorithm
//       (believed to be Huovilainen-style, unverified). res 0..1.
//     1 MoogFF (core): Fontana's digital model of the Moog ladder. gain 0..4 (capped); rings but
//       does not self-oscillate (measured).
//   vcfres 0..1.1: see the resonance mapping below (only MoogLadder truly self-oscillates).
~scstdMods[\vcf] = { |in, cut, res, envAmt, env, drive, model = 0, cutMod = 0|
	var octaves = (envAmt * env * 5) + cutMod;
	// Keep the cutoff below 0.45 x sample rate so the digital ladder stays stable.
	var freq = (cut * (2 ** octaves)).clip(20, min(18000, SampleRate.ir * 0.45));
	var g = drive.linexp(0, 1, 1, 8);
	// A tiny noise floor (-80 dB), like the hiss in an analog circuit. Inaudible, but it lets the
	// filter start self-oscillating at high resonance even when all mixer levels are at zero.
	var driven = ~scstdMods[\tanhAA].((in * g) + PinkNoise.ar(1e-4));
	// Resonance mapping (measured offline, see docs/listening-notes.md 2026-09-23):
	//   MoogLadder only self-oscillates for res > ~1.1; at 1.5 it sings strongly. So vcfres 0..1
	//   maps to 0..1 (resonant, stable) and 1..1.1 maps to 1..1.5 (self-oscillation).
	//   MoogFF caps its gain at 4 and never truly self-oscillates; it rings at most.
	var ladder = MoogLadder.ar(driven, freq, res + ((res - 1).max(0) * 4));
	var ff = MoogFF.ar(driven, freq, res.linlin(0, 1.1, 0, 4));
	// Ladder filters lose passband level as resonance rises; add back up to +6 dB.
	var comp = 1 + res.clip(0, 1);
	Select.ar(model.round, [ladder, ff]) * comp
};

// ---------------------------------------------------------------------------------------------
// Envelopes. gateTime = how long the key is "held"; release runs after it.
// A gate that is 1 for gateTime, then 0 (deterministic, sample-accurate at control rate).
~scstdMods[\gate] = { |gateTime|
	EnvGen.kr(Env([1, 1, 0], [gateTime, 0]))
};

// ADSR (normalled to the VCF). Negative curve = fast start, slow finish, like an RC capacitor
// charging/discharging, which is how analog envelope generators behave.
// Audio rate on purpose: a control-rate envelope moves the cutoff in 64-sample steps, which
// is audible as "zipper" noise on fast sweeps at high resonance.
~scstdMods[\adsr] = { |gate, atk, dec, sus, rel, curve|
	EnvGen.ar(Env.adsr(atk, dec, sus, rel, 1, curve), gate)
};

// AR (normalled to the VCA). Attack is linear (fast, click-free), release is capacitor-like.
~scstdMods[\ar] = { |gate, atk, rel|
	EnvGen.kr(Env.asr(atk, 1, rel, [0, -4]), gate)
};

// ---------------------------------------------------------------------------------------------
// VCA: level x envelope. vcaenv crossfades between "always open" (0) and "fully enveloped" (1).
// ampMod is the VCA modulation summing point (Stage 4).
~scstdMods[\vca] = { |in, lvl, envAmt, env, ampMod = 0|
	var amp = lvl * (((1 - envAmt) + (envAmt * env)) + ampMod).clip(0, 1);
	in * amp
};

// ---------------------------------------------------------------------------------------------
// The complete normalled voice. Returns a mono signal. `p` is a param lookup (~scstdParams.()),
// freq the note frequency, sustain the total event length including release.
~scstdMods[\voice] = { |p, freq, sustain|
	var m = ~scstdMods;
	var relMax = max(p.(\erel), p.(\arrel));
	var gateTime = (sustain - relMax).max(0.005);
	var gate = m[\gate].(gateTime);
	var adsr = m[\adsr].(gate, p.(\eatk), p.(\edec), p.(\esus), p.(\erel), p.(\ecurve));
	var ar = m[\ar].(gate, p.(\aratk), p.(\arrel));

	// Modulation summing points (Architecture decision 6). Only the normalled sources exist in
	// Stage 1, so these are zero; Stage 2-4 add sources here.
	var pitchMod = 0, pwMod = 0, cutMod = 0, ampMod = 0;

	var drift = p.(\drift), spread = p.(\vspread);
	var f1 = m[\pitch].(freq, p.(\o1oct), p.(\o1fine), drift, spread, pitchMod);
	var f2 = m[\pitch].(freq, p.(\o2oct), p.(\o2fine), drift, spread, pitchMod);
	var f3 = m[\pitch].(freq, p.(\o3oct), p.(\o3fine), drift, spread, pitchMod);

	var v1 = m[\vco1].(f1, p.(\o1wave));
	var v2 = m[\vco2].(f2, p.(\o2wave), p.(\o2pw), pwMod);
	var v3 = m[\vco3].(f3, p.(\o3wave), p.(\o3pw), pwMod);

	var mix = m[\mixer].([v1, v2, v3], [p.(\o1lvl), p.(\o2lvl), p.(\o3lvl)]);
	var filt = m[\vcf].(mix, p.(\vcfcut), p.(\vcfres), p.(\vcfenv), adsr, p.(\vcfdrive),
		p.(\vcfmodel), cutMod);
	var sig = m[\vca].(filt, p.(\vcalvl), p.(\vcaenv), ar, ampMod);

	// Declick + lifetime: 2 ms fade in, 10 ms fade out at the very end of the event,
	// then free the synth (SuperDirt convention: every event synth frees itself).
	var life = EnvGen.ar(Env([0, 1, 1, 0], [0.002, (sustain - 0.012).max(0), 0.01]),
		doneAction: 2);

	LeakDC.ar(sig) * life * 0.5
};

"[synth] modules loaded".postln;
)
