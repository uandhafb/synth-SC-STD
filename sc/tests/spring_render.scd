// Spring reverb offline test: renders the scstd_spring effect alone (no SuperDirt needed) with a
// click and a short note into its input bus, for spdecay 0 / 0.5 / 1 and a loud stress case.
// Writes analysis/output/spring.wav + spring_cases.json; analyse with
//   .venv/bin/python analysis/spring_check.py
// Run: /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/spring_render.scd

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var outDir = root +/+ "analysis/output";
var slot = 6.0, score, src, cases, json = List[];
~scstdNumChannels = 2;               // spring.scd needs the channel count at build time
~dirt = ();
thisProcess.interpreter.executeFile(root +/+ "sc/synthdefs/spring.scd");
src = SynthDef(\springsrc, { |kind = 0, amp = 0.5|
	// kind 0: one click; kind 1: a 150 ms saw note (C4)
	var click = Impulse.ar(0) * amp;
	var note = Saw.ar(261.6) * EnvGen.ar(Env.linen(0.005, 0.14, 0.005)) * amp * 0.5;
	Out.ar(10, Select.ar(kind, [click, note]) ! 2);
	Line.kr(0, 0, 0.3, doneAction: 2);
});
cases = [
	["click_decay0", 0, [spdecay: 0]], ["click_decay05", 0, [spdecay: 0.5]], ["click_decay1", 0, [spdecay: 1]],
	["note_decay05", 1, [spdecay: 0.5]], ["note_tone0", 1, [spdecay: 0.5, sptone: 0]], ["note_tone1", 1, [spdecay: 0.5, sptone: 1]],
	["stress_loud", 1, [spdecay: 1, sptone: 1], 8]
];
score = Score([[0.0, [\d_recv, src.asBytes]], [0.0, [\d_recv, ~scstdSpringDef.asBytes]]]);
cases.do { |c, i|
	var t = 0.1 + (i * slot);
	score.add([t, [\s_new, \scstd_spring2, 1000 + i, 1, 0, \dryBus, 10, \effectBus, 0, \spmix, 1] ++ c[2]]);
	score.add([t + 0.01, [\s_new, \springsrc, -1, 0, 0, \kind, c[1], \amp, (c[3] ? 1) * 0.5]]);
	score.add([t + slot - 0.2, [\n_free, 1000 + i]]);
	json.add("[\"%\", %]".format(c[0], t + 0.01));
};
score.add([cases.size * slot + 0.3, [\c_set, 0, 0]]);
File.use(outDir +/+ "spring_cases.json", "w", { |f| f.write("[" ++ json.join(",") ++ "]") });
score.recordNRT(outputFilePath: outDir +/+ "spring.wav", sampleRate: 48000, headerFormat: "WAV",
	sampleFormat: "float", options: ServerOptions.new.numOutputBusChannels_(2).numInputBusChannels_(0),
	duration: cases.size * slot + 0.3, action: { "RENDER DONE".postln; 0.exit });
)
