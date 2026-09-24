// Stage 10: CPU cost per voice, measured offline (no ears, no audio device).
// Live CPU % on Apple Silicon is misleading for small loads (light audio work runs on the slow
// efficiency cores, so 1 voice looks expensive); rendering as fast as possible is repeatable.
// Renders 10 s of 0, 16 and 64 simultaneous voices (default sound, then "everything on") and
// times each render. Cost per voice = extra render time / voices / 10 s, as % of one CPU core
// in real time (100% = one core fully busy). Writes analysis/output/perf_nrt.csv.
// Run: /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/perf_nrt.scd

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var outDir = root +/+ "analysis/output";
var dur = 10, def, render, results = List[];
var full = (o3lvl: 0.6, nzlvl: 0.3, rmlvl: 0.4, o2sync: 1, o2fm: 0.1, o3fm: 0.2, vcfdrive: 1,
	sh_pitch: 2, sh_vcf: 1, lagtime: 0.1, swlvl: 0.5, mix_pitch: 0.5, vcfres: 0.9);
(root +/+ "sc/synthdefs/00_modules.scd").load;
def = SynthDef(\scstd_nrt, { |freq = 220, sustain = 1|
	Out.ar(0, ~scstdMods[\voice].(~scstdParams.(), freq, sustain) * 0.05);
});
File.mkdir(outDir);
render = { |voices, extra|
	var cond = Condition.new, t0, params, score = Score([[0.0, [\d_recv, def.asBytes]]]);
	// Every param set explicitly (the default, or the "everything on" value): NRT has no panel buses.
	params = ~scstdSpecs.keys.asArray.sort.collect { |k| [k, extra[k] ? ~scstdSpecs[k][2]] }.flatten;
	voices.do { |i|
		score.add([0.01, [\s_new, \scstd_nrt, -1, 0, 0, \freq, (36 + (i % 36)).midicps, \sustain, dur + 1] ++ params]);
	};
	t0 = Main.elapsedTime;
	score.recordNRT(outputFilePath: outDir +/+ "perf_nrt.wav", sampleRate: 48000, headerFormat: "WAV",
		sampleFormat: "float", options: ServerOptions.new.numOutputBusChannels_(1).numInputBusChannels_(2)
			.numWireBufs_(2048).memSize_(8192 * 32),
		duration: dur, action: { cond.unhang });
	cond.hang;
	Main.elapsedTime - t0
};
Routine {
	var base, t;
	base = render.(0, ());
	"PERF NRT empty render: % s".format(base.round(0.01)).postln;
	[[\default, ()], [\full, full]].do { |kind|
		[16, 64].do { |n|
			t = render.(n, kind[1]);
			results.add([kind[0], n, t, (t - base) / n / dur * 100]);
			"PERF NRT % x %: % s for % s of audio -> % percent of one core per voice".format(kind[0], n, t.round(0.01), dur,
				((t - base) / n / dur * 100).round(0.01)).postln;
		};
	};
	File.use(outDir +/+ "perf_nrt.csv", "w", { |f|
		f.write("sound,voices,render_s,percent_core_per_voice\n");
		results.do { |r| f.write(r.join(",") ++ "\n") };
	});
	"PROBE DONE".postln; 0.exit;
}.play(AppClock);
)
