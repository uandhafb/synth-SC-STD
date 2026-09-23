// Stage 2 offline render: oscillator modulation (LF mode, PWM, FM, hard sync, key tracking).
// Writes analysis/output/stage2.wav + stage2_cases.json. Analyse with:
//   .venv/bin/python analysis/stage2_check.py
// Run:
//   /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/stage2_render.scd
// Note: sclang in script mode hangs silently on a syntax error in a loaded file. If nothing
// happens, open the file in the SuperCollider IDE to see the error.

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var outDir = root +/+ "analysis/output";
var sr = 48000, slot = 5.0;
var cases, score, def, json;
var open = [vcfcut: 18000, vcfenv: 0, vcfres: 0, vcfkey: 0, drift: 0, vspread: 0, o2fine: 0, vcfdrive: 0];

(root +/+ "sc/synthdefs/00_modules.scd").load;

def = SynthDef(\scstd_nrt, { |freq = 220, sustain = 1|
	var p = ~scstdParams.();
	Out.ar(0, ~scstdMods[\voice].(p, freq, sustain));
});

// [name, [notes (midi)], note length (s), params]
cases = [
	["default_c4", [60], 1.0, []],
	// Aliasing: VCO 2 alone (saw), free vs. synced to VCO 1, open filter, at three pitches.
	["free_c5", [72], 1.0, open ++ [o1lvl: 0, o2oct: 0.4]],
	["sync_c3", [48], 1.0, open ++ [o1lvl: 0, o2oct: 0.4, o2sync: 1]],
	["sync_c5", [72], 1.0, open ++ [o1lvl: 0, o2oct: 0.4, o2sync: 1]],
	["sync_c7", [96], 1.0, open ++ [o1lvl: 0, o2oct: 0.4, o2sync: 1]],
	["sync_c5_pulse", [72], 1.0, open ++ [o1lvl: 0, o2oct: 0.4, o2sync: 1, o2wave: 1]],
	["sync_c5_pulse30", [72], 1.0, open ++ [o1lvl: 0, o2oct: 0.4, o2sync: 1, o2wave: 1, o2pw: 0.3]],
	["sync_c5_tri", [72], 1.0, open ++ [o1lvl: 0, o2oct: 0.4, o2sync: 1, o2wave: 2]],
	["sync_c5_sine", [72], 1.0, open ++ [o1lvl: 0, o2oct: 0.4, o2sync: 1, o2wave: 3]],
	["sync_lf_mode", [60], 1.0, open ++ [o1lvl: 0, o1lf: 1, o1lfrate: 3, o2sync: 1]],
	// Sync lead as it will be played (filter normal, higher VCO 2).
	["sync_lead", [60], 1.5, [o1lvl: 0.3, o2oct: 1.3, o2sync: 1, vcfcut: 2500, vcfres: 0.3]],
	// PWM pad: VCO 1 as slow LFO (muted), VCO 2 + 3 pulses with PWM.
	["pwm_pad", [48, 55, 60, 64], 2.5, [o1lf: 1, o1lfrate: 0.8, o1lvl: 0, o2wave: 1, o2pwm: 0.8,
		o3lvl: 0.6, o3wave: 1, o3pwm: 0.6, o3oct: 0, vcfcut: 1800, vcfenv: 0.1, aratk: 0.4, arrel: 1]],
	// LF vibrato: VCO 1 LFO -> VCO 2 FM, small depth.
	["lf_vibrato", [67], 2.0, [o1lf: 1, o1lfrate: 5, o1lvl: 0, o2fm: 0.01, o2wave: 3, vcfcut: 4000]],
	// FM bell: VCO 1 (audio, non-octave ratio) -> VCO 2 sine, fast attack, long release.
	["fm_bell", [72], 0.1, [o1oct: 0.485, o1lvl: 0, o2wave: 3, o2fm: 0.12, vcfcut: 12000, vcfenv: 0,
		aratk: 0.001, arrel: 2.5, erel: 2.5]],
	["fm_heavy", [48], 1.0, [o1lvl: 0, o2wave: 3, o2fm: 1, vcfcut: 8000, vcfenv: 0]],
	// VCO 2 -> VCO 3 FM.
	["fm_2to3", [48], 1.0, [o1lvl: 0, o2lvl: 0.3, o3lvl: 0.8, o3oct: 0.7, o3fm: 0.3, vcfcut: 6000, vcfenv: 0]],
	// Keyboard tracking: same high note, fixed cutoff vs. full tracking.
	["key0_c6", [84], 1.0, [vcfcut: 500, vcfenv: 0, vcfkey: 0]],
	["key1_c6", [84], 1.0, [vcfcut: 500, vcfenv: 0, vcfkey: 1]],
	// Worst case: everything on, max resonance.
	["everything", [36, 60], 1.5, [o1lvl: 1, o2lvl: 1, o3lvl: 1, o2sync: 1, o2fm: 1, o3fm: 1,
		o2pwm: 1, o3pwm: 1, o2wave: 1, o3wave: 1, vcfres: 1.1, vcfdrive: 1, vcfkey: 1]]
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
	json.add("{\"name\": \"%\", \"start\": %, \"len\": %, \"sustain\": %, \"notes\": %, \"o2oct\": %}"
		.format(name, t, len, sustain, notes, ev[\o2oct] ? 0));
};
score.add([cases.size * slot + 0.5, [\c_set, 0, 0]]);

File.mkdir(outDir);
File.use(outDir +/+ "stage2_cases.json", "w", { |f| f.write("[\n" ++ json.join(",\n") ++ "\n]\n") });

score.recordNRT(
	outputFilePath: outDir +/+ "stage2.wav",
	sampleRate: sr, headerFormat: "WAV", sampleFormat: "float",
	options: ServerOptions.new.numOutputBusChannels_(1).numInputBusChannels_(0),
	duration: cases.size * slot + 0.5,
	action: { "RENDER DONE".postln; 0.exit }
);
)
