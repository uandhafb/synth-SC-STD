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
	o1lf: [0, 1, 0], o1lfrate: [0.01, 30, 2],
	// VCO 2 (6.2)
	o2wave: [0, 3, 0], o2lvl: [0, 1, 0.7], o2oct: [-3, 3, 0], o2fine: [-1, 1, 0.05],
	o2pw: [0.05, 0.95, 0.5], o2pwm: [0, 1, 0], o2sync: [0, 1, 0], o2fm: [0, 1, 0],
	// VCO 3 (6.3)
	o3wave: [0, 1, 0], o3lvl: [0, 1, 0], o3oct: [-3, 3, -1], o3fine: [-1, 1, -0.05],
	o3pw: [0.05, 0.95, 0.5], o3pwm: [0, 1, 0], o3fm: [0, 1, 0],
	// Analog character (6.4)
	drift: [0, 1, 0.15], vspread: [0, 1, 0.1],
	// Noise (6.5), ring mod (6.6)
	nzcol: [0, 1, 0], nzlvl: [0, 1, 0], rmlvl: [0, 1, 0],
	// Sample & hold (6.11), lag processor (6.12)
	shrate: [0.1, 50, 6], shsrc: [0, 3, 0], shlag: [0, 1, 0], lagtime: [0, 5, 0],
	// Patch cables (6.14), <source>_<dest>: pitch in semitones, vcf in octaves
	sh_pitch: [-48, 48, 0], sh_vcf: [-6, 6, 0],
	// VCF (6.7)
	vcfcut: [20, 18000, 2000], vcfres: [0, 1.1, 0.2], vcfenv: [-1, 1, 0.4],
	vcfkey: [0, 1, 0.5], vcfdrive: [0, 1, 0.3],
	vcfmodel: [0, 1, 0],   // filter character: 0 = MoogLadder (default, self-oscillates), 1 = MoogFF
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
		// A name whose 2nd character is "_" (e.g. "m_x", "t_x") is read by SuperCollider as a
		// rate prefix: SynthDesc strips those 2 characters, so SuperDirt would never pass the
		// value (found 2026-09-23 with "m_sh_pitch"). Refuse such names.
		(name.asString[1] == $_).if {
			Error("scstd: param name '%' has '_' as 2nd character; SuperDirt would drop it"
				.format(name)).throw
		};
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
	// oct is continuous, like the original's coarse tuning knob: whole numbers = octaves,
	// fractions tune in between (e.g. 1.5 = an octave and a tritone up). Needed for hard sync
	// and FM, where the interesting sounds come from non-octave ratios.
	freq * (2 ** oct) * (fine + driftSemi + spreadSemi + pitchMod).midiratio
};

// ---------------------------------------------------------------------------------------------
// Saw and pulse that work at every frequency, including LFO rates.
// SuperCollider's band-limited Saw and Pulse are built from band-limited impulses and break down
// below ~20 Hz: measured 2026-09-23, Saw at 0.5 Hz outputs spikes up to +30 with almost nothing in
// between (2 Hz: +8, 5 Hz: +3; clean -1..1 only above ~20 Hz). As an LFO that sent huge spikes into
// FM/PWM. Below 20 Hz we therefore use the simple LFSaw/LFPulse (exact -1..1; aliasing is no issue
// at these rates). Above 20 Hz the band-limited versions are used, so audio stays alias-free.
~scstdMods[\saw] = { |f|
	Select.ar(f < 20, [Saw.ar(f), LFSaw.ar(f)])
};
~scstdMods[\pulse] = { |f, width|
	Select.ar(f < 20, [Pulse.ar(f, width), (LFPulse.ar(f, 0, width) * 2) - 1])
};

// ---------------------------------------------------------------------------------------------
// VCO 1: saw -> square crossfade.
// Saw and Pulse are band-limited in SuperCollider, so high notes do not alias.
// Returns [audio, mod]: `audio` goes to the mixer (square scaled by 0.6 so its loudness roughly
// matches the saw; square RMS is ~1.7x saw RMS), `mod` is the same wave at full +-1 scale, used as
// the modulation source for PWM, FM and sync (on the original, VCO 1 is the classic mod source).
~scstdMods[\vco1] = { |f, wave|
	var saw = ~scstdMods[\saw].(f);
	var sqr = ~scstdMods[\pulse].(f, 0.5);
	[(saw * (1 - wave)) + (sqr * 0.6 * wave), (saw * (1 - wave)) + (sqr * wave)]
};

// VCO 2: morph saw -> pulse -> triangle -> sine (o2wave 0..3).
// SelectX crossfades between neighbouring waves with equal power, so the morph has no level dips.
// LFTri is not band-limited, but triangle harmonics fall off at 1/n^2, so aliasing stays low.
//
// Hard sync (sync = 1): VCO 2 restarts its cycle whenever VCO 1 (at syncFreq) starts a new one.
// See ~scstdMods[\syncWaves] below for how the synced waves are made alias-reduced.
// Only the selected path is heard; the other is computed but silent.
~scstdMods[\vco2] = { |f, wave, pw, pwMod = 0, sync = 0, syncFreq = 100|
	var width = (pw + pwMod).clip(0.05, 0.95);   // PWM summing point
	var free = SelectX.ar(wave, [
		~scstdMods[\saw].(f),
		~scstdMods[\pulse].(f, width) * 0.6,
		LFTri.ar(f) * 0.9,
		SinOsc.ar(f) * 0.9
	]);
	var sw = ~scstdMods[\syncWaves].(f, syncFreq, width);
	var synced = SelectX.ar(wave, [sw[0], sw[1] * 0.6, sw[2] * 0.9, sw[3] * 0.9]);
	Select.ar(sync.round, [free, synced])
};

// polyBLEP correction for one value discontinuity per sample.
// x: naive signal; jump: size of the downward jump (before - after, may be negative);
// d: time since the jump as a fraction of a sample (0..1). The sample before the jump is
// corrected too, so the output is delayed by one sample. This removes most of the aliasing a
// hard jump causes (polyBLEP: Valimaki & Huovilainen, 2007).
~scstdMods[\blep] = { |x, jump, d|
	Delay1.ar(x + (jump * 0.5 * (1 - d).squared)) - (jump * 0.5 * d.squared)
};

// Hard-synced saw, pulse, triangle and sine with polyBLEP-corrected jumps.
// Why not SyncSaw: it is not band-limited; measured non-harmonic energy at C3/C5/C7 was
// -29.5/-18.5/-12.4 dB. This version measured -66/-34/-27 dB (docs/listening-notes.md).
// How: the slave resets exactly when the master wraps, so the slave phase is simply
// frac(masterPhase * f / syncFreq). That is exact per sample (Phasor's own resetPos input is only
// read once per block, which loses the sub-sample timing). At each reset the slave jumps from
// phase frac(ratio) back to 0; the size of that jump is known, so it can be corrected.
// Note: with VCO 1 in LF mode the ratio gets huge and float precision adds noise to the synced
// wave; sync is meant for audio-rate VCO 1.
// Returns [saw, pulse, tri, sine], each -1..1.
~scstdMods[\syncWaves] = { |f, syncFreq, width|
	var blep = ~scstdMods[\blep];
	var sr = SampleRate.ir;
	var dtm = syncFreq / sr, dts = f / sr, ratio = f / syncFreq;
	var pm = Phasor.ar(0, dtm, 0, 1);              // master (VCO 1) phase 0..1
	var wm = pm < Delay1.ar(pm);                   // 1 on the sample where the master wrapped
	var dm = (pm / dtm).clip(0, 1);                // time since that wrap, in samples
	var h = ratio.frac;                            // slave phase at the reset instant
	var ps = (pm * ratio).frac;                    // slave phase 0..1
	var ws = (ps < Delay1.ar(ps)) * (1 - wm);      // natural slave wrap (not a reset)
	var ds = (ps / dts).clip(0, 1);
	// Saw: jump 2 at natural wraps, 2h at resets.
	var saw = blep.((ps * 2) - 1, (wm * 2 * h) + (ws * 2), (wm * dm) + (ws * ds));
	// Pulse = difference of two saws offset by (1 - width); the second saw restarts at `off`.
	var off = 1 - width;
	var pb = (ps + off).frac;
	var wb = (pb < Delay1.ar(pb)) * (1 - wm);
	var dbb = (pb / dts).clip(0, 1);
	var sawB = blep.((pb * 2) - 1, (wm * 2 * ((h + off).frac - off)) + (wb * 2), (wm * dm) + (wb * dbb));
	var pulse = (sawB - saw) - (1 - (2 * width));
	// Triangle and sine are continuous except at the reset.
	var triOf = { |ph| 1 - (4 * (ph - 0.5).abs) };
	var tri = blep.(triOf.(ps), wm * (triOf.(h) + 1), wm * dm);
	var sine = blep.((ps * 2pi).sin, wm * (h * 2pi).sin, wm * dm);
	[saw, pulse, tri, sine]
};

// VCO 3: saw -> pulse crossfade.
~scstdMods[\vco3] = { |f, wave, pw, pwMod = 0|
	var width = (pw + pwMod).clip(0.05, 0.95);
	(~scstdMods[\saw].(f) * (1 - wave)) + (~scstdMods[\pulse].(f, width) * 0.6 * wave)
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
	// Cutoff calibration for MoogLadder (measured offline 2026-09-23, docs/listening-notes.md).
	// Its real corner frequency is 0.88x (at 60 Hz) to 0.59x (at 20 kHz) of the value it is given,
	// so it was much darker than vcfcut said and "fully open" was only ~4 kHz (-3 dB). MoogFF is
	// accurate (textbook 4-pole: -3 dB at 0.44x the corner). kPass makes MoogLadder's corner match
	// vcfcut: k = 1.2 + 0.03 per kHz (fits the measurements within ~4%). Its ceiling is a corner of
	// ~12.8 kHz, so it stays a little darker than MoogFF when fully open.
	// When self-oscillating, the sung pitch follows a different curve (1.10x at 110 Hz .. 0.83x at
	// 7 kHz), so kOsc makes the pitch match vcfcut instead: k = 0.9 + 0.043 per kHz.
	// Between vcfres 0.9 and 1.1 the correction crossfades from kPass to kOsc.
	var kPass = 1.2 + (freq * 0.00003);
	var kOsc = 0.9 + (freq * 0.000043);
	var wOsc = ((res - 0.9) / 0.2).clip(0, 1);
	var ladderFreq = (freq * ((kPass * (1 - wOsc)) + (kOsc * wOsc))).clip(20, SampleRate.ir * 0.45);
	var ladder = MoogLadder.ar(driven, ladderFreq, res + ((res - 1).max(0) * 4));
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
// Noise generator (6.5). col 0 = white (flat, bright hiss), 0.5 = pink (-3 dB/octave, "rain"),
// 1 = brown/red (-6 dB/octave, dark rumble). SelectX crossfades neighbours with equal power.
// Gains measured offline so all three have the same RMS (~0.58): PinkNoise is ~3.7x quieter.
~scstdMods[\noise] = { |col|
	SelectX.ar(col * 2, [WhiteNoise.ar, PinkNoise.ar * 3.7, BrownNoise.ar])
};

// Ring modulator (6.6): four-quadrant multiply of A and B (normalled: VCO 1 x VCO 2).
// The output contains only the sum and difference frequencies of the inputs, not the inputs
// themselves, which gives the metallic, bell-like, "robot" tones.
~scstdMods[\ringmod] = { |a, b| a * b };

// Sample & hold (6.11) with its internal clock and lag.
// On every clock tick the input is sampled and held until the next tick: random steps from noise,
// stepped patterns from a slow VCO. The clock starts with the note, so the first value is taken
// at note-on. `lag` 0..1 smooths each step over that fraction of the clock period (1 = the next
// value is reached just as the following tick arrives: a smooth random wander).
// Output is clipped to -1..1 so every source gives the same modulation range.
~scstdMods[\sh] = { |in, rate, lag|
	var held = Latch.ar(in, Impulse.ar(rate));
	Lag.ar(held, lag / rate).clip(-1, 1)
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

	var drift = p.(\drift), spread = p.(\vspread);

	// Noise first: it feeds the mixer and is the normalled S&H input.
	var nz = m[\noise].(p.(\nzcol));

	// Sample & hold. Its input can be a VCO (shsrc 1-3), but the VCOs' pitch can in turn be
	// modulated by the S&H (sh_pitch): a loop, as on the original when you patch it that way.
	// A UGen graph cannot contain a direct loop, so the VCO signals come back through
	// LocalIn/LocalOut with one block of delay (64 samples = 1.3 ms at 48 kHz). The S&H samples
	// at most 50 times per second, so that delay is inaudible.
	var fb = LocalIn.ar(3);                      // [VCO 1 mod, VCO 2, VCO 3] from the last block
	var shIn = Select.ar(p.(\shsrc).round, [nz, fb[0], fb[1], fb[2]]);
	var sh = m[\sh].(shIn, p.(\shrate), p.(\shlag));

	// Modulation summing points (Architecture decision 6). Patch-cable naming: <source>_<dest>.
	// Units per destination: pitch in semitones, vcf in octaves. Stage 4 adds the other sources.
	var pitchMod = sh * p.(\sh_pitch);
	var cutMod = sh * p.(\sh_vcf);
	var pwMod = 0, ampMod = 0;

	// VCO 1 first: it is the modulation source for the others.
	// LF mode: VCO 1 stops following the keyboard and runs at o1lfrate (0.01-30 Hz), like the
	// original's low-frequency switch. It still feeds the mixer (as on the original), so set
	// o1lvl 0 to use it purely as an LFO.
	var lf = p.(\o1lf).round;
	var f1kb = m[\pitch].(freq, p.(\o1oct), p.(\o1fine), drift, spread, pitchMod);
	var f1 = (f1kb * (1 - lf)) + (p.(\o1lfrate) * lf);
	var vco1 = m[\vco1].(f1, p.(\o1wave));
	var v1 = vco1[0], mod1 = vco1[1];
	// Lag processor (6.12) on VCO 1's modulation output: smooths the saw's jump into a rounded
	// "shark fin", so PWM/FM from VCO 1 in LF mode become smooth (the original's way to get a
	// soft LFO from a saw). Exponential lag, like an RC circuit. lagtime 0 = no smoothing.
	// Not applied to ring mod or S&H, which use the raw VCO 1.
	var mod1s = Lag.ar(mod1, p.(\lagtime));

	// FM is exponential (the mod signal moves pitch in semitones, like a CV into the original's
	// FM inputs): depth 1 = +-36 semitones (+-3 octaves). Audio-rate exponential FM gives the
	// clangy, inharmonic bell/metal tones typical of analog FM, not DX7-style linear FM.
	var f2 = m[\pitch].(freq, p.(\o2oct), p.(\o2fine), drift, spread,
		pitchMod + (mod1s * p.(\o2fm) * 36));
	// PWM: VCO 1 swings the pulse width by up to +-0.45 around o2pw (clipped to 0.05..0.95).
	var v2 = m[\vco2].(f2, p.(\o2wave), p.(\o2pw), pwMod + (mod1s * p.(\o2pwm) * 0.45),
		p.(\o2sync), f1);

	var f3 = m[\pitch].(freq, p.(\o3oct), p.(\o3fine), drift, spread,
		pitchMod + (v2 * p.(\o3fm) * 36));
	var v3 = m[\vco3].(f3, p.(\o3wave), p.(\o3pw), pwMod + (mod1s * p.(\o3pwm) * 0.45));

	var fbOut = LocalOut.ar([mod1, v2, v3]);

	var rm = m[\ringmod].(mod1, v2);

	var mix = m[\mixer].([v1, v2, v3, nz, rm],
		[p.(\o1lvl), p.(\o2lvl), p.(\o3lvl), p.(\nzlvl), p.(\rmlvl)]);

	// Keyboard tracking: the cutoff follows the played note, in octaves relative to middle C.
	// vcfkey 1 = the cutoff moves 1:1 with pitch (same brightness everywhere); 0 = fixed cutoff.
	var keyTrack = p.(\vcfkey) * (freq / 261.6256).log2;
	var filt = m[\vcf].(mix, p.(\vcfcut), p.(\vcfres), p.(\vcfenv), adsr, p.(\vcfdrive),
		p.(\vcfmodel), cutMod + keyTrack);
	var sig = m[\vca].(filt, p.(\vcalvl), p.(\vcaenv), ar, ampMod);

	// Declick + lifetime: 2 ms fade in, 10 ms fade out at the very end of the event,
	// then free the synth (SuperDirt convention: every event synth frees itself).
	var life = EnvGen.ar(Env([0, 1, 1, 0], [0.002, (sustain - 0.012).max(0), 0.01]),
		doneAction: 2);

	LeakDC.ar(sig) * life * 0.5
};

"[synth] modules loaded".postln;
)
