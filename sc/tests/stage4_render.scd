// Stage 4 offline render: patch cables, keyboard switches, ring mod inputs and panel buses.
// Writes analysis/output/stage4.wav + stage4_cases.json. Analyse with:
//   .venv/bin/python analysis/stage4_check.py
// Run:
//   /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/stage4_render.scd
// Note: sclang in script mode hangs silently on a syntax error in a loaded file. If nothing
// happens, open the file in the SuperCollider IDE to see the error.

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var outDir = root +/+ "analysis/output";
var sr = 48000, slot = 5.0;
var cases, score, def, json;
var clean = [drift: 0, vspread: 0, o2fine: 0, vcfenv: 0];

(root +/+ "sc/synthdefs/00_modules.scd").load;
(root +/+ "sc/buses.scd").load;          // panel buses: the SynthDef reads them

def = SynthDef(\scstd_nrt, { |freq = 220, sustain = 1|
	var p = ~scstdParams.();
	Out.ar(0, ~scstdMods[\voice].(p, freq, sustain));
});

// [name, [notes], note length (s), params, extra timed messages [[time offset, msg], ...]]
cases = [
	["default_via_buses", [60], 1.0, [], []],
	// Cables. Each changes one destination from one source.
	["adsr_pitch", [60], 1.5, clean ++ [o2lvl: 0, adsr_pitch: 12, eatk: 0.001, edec: 0.6, esus: 0, vcfcut: 4000], []],
	["ar_pitch", [60], 1.5, clean ++ [o2lvl: 0, ar_pitch: -12, aratk: 0.8, vcfcut: 4000], []],
	["vco1_vca_tremolo", [60], 2.0, clean ++ [o1lf: 1, o1lfrate: 5, o1wave: 1, o1lvl: 0, vco1_vca: -0.5, vcfcut: 4000], []],
	["noise_vcf", [48], 1.5, clean ++ [noise_vcf: 1.5, vcfcut: 600, vcfres: 0.6], []],
	["sh_pw", [48], 2.0, clean ++ [o1lvl: 0, o2wave: 1, sh_pw: 0.9, shrate: 6, vcfcut: 4000], []],
	["vco3_pitch_fm", [60], 1.5, clean ++ [o1lvl: 0, o2wave: 3, o3oct: 0.5, vco3_pitch: 3, vcfcut: 6000], []],
	["vco2_pitch_self", [60], 1.5, clean ++ [o1lvl: 0, vco2_pitch: 2, vcfcut: 6000], []],
	["rm_vcf", [48], 1.5, clean ++ [rm_vcf: 1, vcfcut: 800, vcfres: 0.5], []],
	// Keyboard off: VCO 2 stays at middle C (261.6 Hz) whatever note is played.
	["o2kbd_off", [72], 1.0, clean ++ [o1lvl: 0, o2kbd: 0, o2wave: 3, vcfcut: 6000], []],
	// Ring mod inputs: VCO 2 (sine) x VCO 3 (pulse), filter taming the pulse.
	["rm_2x3", [60], 1.5, clean ++ [o1lvl: 0, o2lvl: 0, rmlvl: 1, rma: 1, rmb: 2, o2wave: 3, o3wave: 1, o3oct: 0.485, vcfcut: 2500], []],
	// Panel: change vcfcut on the bus half-way through a note -> the sound gets darker.
	["panel_change", [48], 3.0, clean ++ [], [[1.5, \vcfcut, 250]]],
	// Pattern wins: same bus change, but this note sends vcfcut itself -> no change.
	["pattern_wins", [48], 3.0, clean ++ [vcfcut: 2000], [[1.5, \vcfcut, 250]]],
	// Worst case: many cables at full.
	["everything", [36, 60], 2.0, [adsr_pitch: 48, ar_pitch: -48, noise_pitch: 12, sh_pitch: 48, vco3_pitch: 48,
		rm_pitch: 24, noise_vcf: 6, sh_vcf: 6, vco1_vcf: 6, rm_vca: 1, vco2_vca: 1, sh_pw: 1, adsr_pw: 1,
		nzlvl: 1, rmlvl: 1, vcfres: 1.1, vcfdrive: 1, o2sync: 1, o2fm: 1], []]
];

score = Score([[0.0, [\d_recv, def.asBytes]], [0.0, ~scstdBusInitMsg.()]]);
json = List[];
cases.do { |c, i|
	var name = c[0], notes = c[1], len = c[2], params = c[3], extra = c[4];
	var t = 0.1 + (i * slot);
	var ev = ().putPairs(params);
	var rel = max(ev[\erel] ? ~scstdDefault.(\erel), ev[\arrel] ? ~scstdDefault.(\arrel));
	var sustain = len + rel;
	notes.do { |midi|
		score.add([t, [\s_new, \scstd_nrt, -1, 0, 0, \freq, midi.midicps, \sustain, sustain] ++ params]);
	};
	// Timed panel changes, then restore the default right after the note.
	extra.do { |e|
		score.add([t + e[0], [\c_set, ~scstdBuses[e[1]].index, e[2]]]);
		score.add([t + sustain + 0.1, [\c_set, ~scstdBuses[e[1]].index, ~scstdDefault.(e[1])]]);
	};
	json.add("{\"name\": \"%\", \"start\": %, \"len\": %, \"sustain\": %, \"notes\": %}"
		.format(name, t, len, sustain, notes));
};
score.add([cases.size * slot + 0.5, [\c_set, 0, 0]]);
score.sort;

File.mkdir(outDir);
File.use(outDir +/+ "stage4_cases.json", "w", { |f| f.write("[\n" ++ json.join(",\n") ++ "\n]\n") });

score.recordNRT(
	outputFilePath: outDir +/+ "stage4.wav",
	sampleRate: sr, headerFormat: "WAV", sampleFormat: "float",
	options: ServerOptions.new.numOutputBusChannels_(1).numInputBusChannels_(0),
	duration: cases.size * slot + 0.5,
	action: { "RENDER DONE".postln; 0.exit }
);
)
