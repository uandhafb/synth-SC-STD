// Fuzz test: many notes, each with EVERY parameter set to a random value within its range.
// Live coding throws random values at the synth; this checks it never produces NaN/inf or
// extreme levels. Writes analysis/output/fuzz.wav + fuzz_cases.json; analyse with
//   .venv/bin/python analysis/fuzz_check.py
// Run: /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/fuzz_render.scd

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var outDir = root +/+ "analysis/output";
var n = 40, slot = 1.5, score, def, json = List[];
thisThread.randSeed = 2600;
(root +/+ "sc/synthdefs/00_modules.scd").load;
def = SynthDef(\scstd_nrt, { |freq = 220, sustain = 1|
	Out.ar(0, ~scstdMods[\voice].(~scstdParams.(), freq, sustain));
});
score = Score([[0.0, [\d_recv, def.asBytes]]]);
n.do { |i|
	var params = ~scstdSpecs.keys.asArray.sort.collect { |k|
		var s = ~scstdSpecs[k];
		// Releases kept short so each note fits its slot.
		var v = if(#[erel, arrel].includes(k)) { rrand(0.01, 0.3) } { rrand(s[0].asFloat, s[1].asFloat) };
		[k, v]
	}.flatten;
	var midi = rrand(24, 96);
	score.add([0.1 + (i * slot), [\s_new, \scstd_nrt, -1, 0, 0, \freq, midi.midicps, \sustain, 1.0] ++ params]);
	json.add("{\"i\": %, \"start\": %, \"midi\": %}".format(i, 0.1 + (i * slot), midi));
};
File.mkdir(outDir);
File.use(outDir +/+ "fuzz_cases.json", "w", { |f| f.write("[" ++ json.join(",") ++ "]") });
score.recordNRT(outputFilePath: outDir +/+ "fuzz.wav", sampleRate: 48000, headerFormat: "WAV",
	sampleFormat: "float", options: ServerOptions.new.numOutputBusChannels_(1).numInputBusChannels_(0),
	duration: n * slot + 0.5, action: { "RENDER DONE".postln; 0.exit });
)
