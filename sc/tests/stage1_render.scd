// Stage 1 offline render: plays test cases of the scstd voice through scsynth in non-real-time
// mode and writes one WAV + a JSON index to analysis/output/. No SuperDirt or audio device needed.
// Analyse with:  .venv/bin/python analysis/stage1_check.py
//
// Run from a terminal (it exits by itself when done):
//   /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/stage1_render.scd
// Note: sclang in script mode hangs silently on a syntax error in a loaded file. If nothing
// happens, open the file in the SuperCollider IDE to see the error.

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var outDir = root +/+ "analysis/output";
var sr = 48000, slot = 5.0;   // each case gets a 5 s slot
var cases, score, def, json;

(root +/+ "sc/synthdefs/00_modules.scd").load;

// Same voice as scstd.scd, but written straight to bus 0 (mono) instead of through DirtPan.
def = SynthDef(\scstd_nrt, { |freq = 220, sustain = 1|
	var p = ~scstdParams.();
	Out.ar(0, ~scstdMods[\voice].(p, freq, sustain));
});

// [name, [notes (midi)], note length (s), params]
cases = [
	["default_c4", [60], 1.0, []],
	["default_ladder_vs_ff_ff", [60], 1.0, [vcfmodel: 1]],
	["chord_full_levels", [48, 55, 60, 64], 1.5, [o1lvl: 1, o2lvl: 1, o3lvl: 1, vcfres: 0.8, vcfdrive: 1]],
	["high_note_c8_open", [108], 1.0, [vcfcut: 18000, vcfenv: 0, vcfres: 0, drift: 0, vspread: 0, o2lvl: 0]],
	["high_note_c8_sq", [108], 1.0, [vcfcut: 18000, vcfenv: 0, vcfres: 0, drift: 0, vspread: 0, o1wave: 1, o2lvl: 0]],
	["sweep_res09_ladder", [36], 3.0, [vcfcut: 60, vcfenv: 1, vcfres: 0.9, eatk: 1.5, edec: 1.5, esus: 0, erel: 0.1, arrel: 0.1]],
	["sweep_res09_ff", [36], 3.0, [vcfcut: 60, vcfenv: 1, vcfres: 0.9, eatk: 1.5, edec: 1.5, esus: 0, erel: 0.1, arrel: 0.1, vcfmodel: 1]],
	["selfosc_ladder_1k", [60], 1.5, [o1lvl: 0, o2lvl: 0, o3lvl: 0, vcfres: 1.1, vcfcut: 1000, vcfenv: 0]],
	["selfosc_ff_1k", [60], 1.5, [o1lvl: 0, o2lvl: 0, o3lvl: 0, vcfres: 1.1, vcfcut: 1000, vcfenv: 0, vcfmodel: 1]],
	["selfosc_ladder_with_input", [36], 1.5, [o1lvl: 1, o2lvl: 1, o3lvl: 1, vcfres: 1.1, vcfcut: 400, vcfenv: 0.5, vcfdrive: 1]],
	["release_tail_2s", [60], 0.25, [erel: 2, arrel: 2]],
	["drone_vcaenv0", [48], 1.0, [vcaenv: 0, arrel: 0.3]]
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
score.add([cases.size * slot + 0.5, [\c_set, 0, 0]]);   // end marker

File.mkdir(outDir);
File.use(outDir +/+ "stage1_cases.json", "w", { |f| f.write("[\n" ++ json.join(",\n") ++ "\n]\n") });

score.recordNRT(
	outputFilePath: outDir +/+ "stage1.wav",
	sampleRate: sr, headerFormat: "WAV", sampleFormat: "float",
	options: ServerOptions.new.numOutputBusChannels_(1).numInputBusChannels_(0),
	duration: cases.size * slot + 0.5,
	action: { "RENDER DONE".postln; 0.exit }
);
)
