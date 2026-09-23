// Stage 3 offline render: noise, ring mod, sample & hold, lag processor.
// Writes analysis/output/stage3.wav + stage3_cases.json. Analyse with:
//   .venv/bin/python analysis/stage3_check.py
// Run:
//   /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/stage3_render.scd
// Note: sclang in script mode hangs silently on a syntax error in a loaded file. If nothing
// happens, open the file in the SuperCollider IDE to see the error.

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var outDir = root +/+ "analysis/output";
var sr = 48000, slot = 5.0;
var cases, score, def, json;
var open = [vcfcut: 18000, vcfenv: 0, vcfres: 0, vcfkey: 0, drift: 0, vspread: 0, vcfdrive: 0];
var novco = [o1lvl: 0, o2lvl: 0, o3lvl: 0];

(root +/+ "sc/synthdefs/00_modules.scd").load;

def = SynthDef(\scstd_nrt, { |freq = 220, sustain = 1|
	var p = ~scstdParams.();
	Out.ar(0, ~scstdMods[\voice].(p, freq, sustain));
});

// [name, [notes (midi)], note length (s), params]
cases = [
	["default_c4", [60], 1.0, []],
	// Noise colours alone, open filter: equal level, different spectral tilt.
	["noise_white", [60], 1.0, open ++ novco ++ [nzlvl: 1, nzcol: 0]],
	["noise_pink", [60], 1.0, open ++ novco ++ [nzlvl: 1, nzcol: 0.5]],
	["noise_brown", [60], 1.0, open ++ novco ++ [nzlvl: 1, nzcol: 1]],
	// Ring mod alone (VCO 1 x VCO 2 at a non-octave ratio), open filter.
	["ringmod_c4", [60], 1.0, open ++ novco ++ [rmlvl: 1, o1oct: 0.485]],
	["ringmod_c6", [84], 1.0, open ++ novco ++ [rmlvl: 1, o1oct: 0.485]],
	["ringmod_sines", [72], 1.0, open ++ novco ++ [rmlvl: 1, o1oct: 0.485, o2wave: 3]],
	// S&H from noise -> pitch: one long note, 8 steps per second, +-12 semitones.
	["sh_pitch", [60], 3.0, [m_sh_pitch: 12, shrate: 8, vcfcut: 5000, vcfenv: 0, drift: 0, vspread: 0, o2lvl: 0]],
	["sh_pitch_lag", [60], 3.0, [m_sh_pitch: 12, shrate: 8, shlag: 1, vcfcut: 5000, vcfenv: 0, drift: 0, vspread: 0, o2lvl: 0]],
	// S&H -> filter: stepped filter (classic), and smooth random wander on noise (wind).
	["sh_vcf", [48], 3.0, [m_sh_vcf: 2, shrate: 6, vcfcut: 800, vcfres: 0.7, vcfenv: 0]],
	["wind", [60], 3.0, novco ++ [nzlvl: 1, nzcol: 0.3, m_sh_vcf: 2.5, shrate: 1.5, shlag: 1, vcfcut: 900,
		vcfres: 0.85, vcfenv: 0, vcfkey: 0, aratk: 0.8, arrel: 1.5]],
	// S&H sampling VCO 2 (feedback loop through LocalIn), modulating pitch: must stay stable.
	["sh_feedback", [60], 3.0, [shsrc: 2, m_sh_pitch: 12, shrate: 10, o2oct: 0.3, vcfcut: 4000, vcfenv: 0]],
	// Noise percussion: very short.
	["noise_hat", [60], 0.03, open ++ novco ++ [nzlvl: 1, aratk: 0.001, arrel: 0.06, erel: 0.06, vcfcut: 9000]],
	// Lag processor smoothing VCO 1's saw LFO for PWM (compare with Stage 2 pwm_pad clicks).
	["pwm_lag0", [48], 3.0, [o1lf: 1, o1lfrate: 0.8, o1lvl: 0, o2wave: 1, o2pwm: 0.8, vcfcut: 1800, vcfenv: 0, lagtime: 0]],
	["pwm_lag03", [48], 3.0, [o1lf: 1, o1lfrate: 0.8, o1lvl: 0, o2wave: 1, o2pwm: 0.8, vcfcut: 1800, vcfenv: 0, lagtime: 0.3]],
	// R2-D2-style bleeps (first draft): sines, ring mod, fast S&H on pitch with a little lag.
	["r2d2", [72], 3.0, [o1oct: 0.5, o1lvl: 0, o2wave: 3, o2lvl: 0.5, rmlvl: 0.6, m_sh_pitch: 24, shrate: 11,
		shlag: 0.35, vcfcut: 9000, vcfenv: 0, o2fm: 0.03]],
	// Worst case.
	["everything", [36, 60], 2.0, [o1lvl: 1, o2lvl: 1, o3lvl: 1, nzlvl: 1, rmlvl: 1, m_sh_pitch: 48, m_sh_vcf: 6,
		shrate: 50, o2sync: 1, o2fm: 1, vcfres: 1.1, vcfdrive: 1]]
];

score = Score([[0.0, [\d_recv, def.asBytes]]]);
json = List[];
cases.do { |c, i|
	var name = c[0], notes = c[1], len = c[2], params = c[3];
	var t = 0.1 + (i * slot);
	var ev = ().putPairs(params);
	var rel = max(ev[\erel] ? ~scstdDefault.(\erel), ev[\arrel] ? ~scstdDefault.(\arrel));
	var sustain = len + rel;
	notes.do { |midi|
		score.add([t, [\s_new, \scstd_nrt, -1, 0, 0, \freq, midi.midicps, \sustain, sustain] ++ params]);
	};
	json.add("{\"name\": \"%\", \"start\": %, \"len\": %, \"sustain\": %, \"notes\": %}"
		.format(name, t, len, sustain, notes));
};
score.add([cases.size * slot + 0.5, [\c_set, 0, 0]]);

File.mkdir(outDir);
File.use(outDir +/+ "stage3_cases.json", "w", { |f| f.write("[\n" ++ json.join(",\n") ++ "\n]\n") });

score.recordNRT(
	outputFilePath: outDir +/+ "stage3.wav",
	sampleRate: sr, headerFormat: "WAV", sampleFormat: "float",
	options: ServerOptions.new.numOutputBusChannels_(1).numInputBusChannels_(0),
	duration: cases.size * slot + 0.5,
	action: { "RENDER DONE".postln; 0.exit }
);
)
