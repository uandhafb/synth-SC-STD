// Stage 5 offline render: audio input (preamp + envelope follower), electronic switch,
// mixer/inverter, S&H reading the mixer. The audio input is a synthetic "cello"
// (analysis/output/cello_sim.wav: every 4 s = quiet 1 s, loud 1 s, silent 2 s) given to NRT as
// its input file, so SoundIn reads it. Mono mode needs SuperDirt: see sc/tests/mono_probe.scd.
// Writes analysis/output/stage5_<case>.wav + stage5_cases.json. Analyse with:
//   .venv/bin/python analysis/stage5_check.py   (it also creates cello_sim.wav if missing)
// Run:
//   /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/stage5_render.scd

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var outDir = root +/+ "analysis/output";
var clean = [drift: 0, vspread: 0, o2fine: 0, vcfenv: 0];
var cases, def;

(root +/+ "sc/synthdefs/00_modules.scd").load;

def = SynthDef(\scstd_nrt, { |freq = 220, sustain = 1|
	Out.ar(0, ~scstdMods[\voice].(~scstdParams.(), freq, sustain));
});

// [name, midi note, note length (s), params]. Each case is its own 12 s render with the
// "cello" input starting at 0.
cases = [
	// Envelope follower -> filter: the filter opens when the cello is loud, a little when quiet,
	// and closes in the silence.
	["envf_vcf", 48, 11.0, clean ++ [envf_vcf: 4, vcfcut: 200, vcfres: 0.5]],
	// Envelope follower -> VCA with the VCA closed at rest (vcainit 0): the synth only sounds while
	// the cello plays.
	["envf_vca", 48, 11.0, clean ++ [vcaenv: 0, vcainit: 0, vcalvl: 0.8, envf_vca: 1]],
	// The cello itself through the synth's filter (inlvl), VCOs off.
	["input_thru", 48, 11.0, clean ++ [o1lvl: 0, o2lvl: 0, inlvl: 1, vcfcut: 800, vcfres: 0.8, vcaenv: 0]],
	// Electronic switch: alternates VCO 2 and VCO 3 (a tritone up) 4 times per second.
	["switch", 60, 3.0, clean ++ [o1lvl: 0, o2lvl: 0, swlvl: 1, swrate: 4, swa: 1, swb: 2, o3oct: 0.5,
		o3lvl: 0, vcfcut: 4000]],
	// Mixer/inverter: ADSR inverted (mixalvl -1) -> pitch: each note starts 12 st LOW and rises.
	["mix_inverted", 60, 3.0, clean ++ [o2lvl: 0, mixa: 5, mixalvl: -1, mixblvl: 0, mix_pitch: 12,
		eatk: 0.001, edec: 0.8, esus: 0, vcfcut: 4000]],
	// S&H reading the mixer (VCO 1 slow saw + a little noise) -> staircase with jitter.
	["sh_from_mix", 60, 3.0, clean ++ [o1lf: 1, o1lfrate: 0.75, o1lvl: 0, shsrc: 4, mixa: 0,
		mixalvl: 1, mixb: 3, mixblvl: 0.15, sh_pitch: 12, shrate: 6, vcfcut: 3000]]
];

{
	var cond = Condition.new, names = List[];
	cases.do { |c|
		var name = c[0], midi = c[1], len = c[2], params = c[3];
		var ev = ().putPairs(params);
		var rel = max(ev[\erel] ? ~scstdDefault.(\erel), ev[\arrel] ? ~scstdDefault.(\arrel));
		var score = Score([
			[0.0, [\d_recv, def.asBytes]],
			[0.1, [\s_new, \scstd_nrt, -1, 0, 0, \freq, midi.midicps, \sustain, len + rel] ++ params],
			[12.0, [\c_set, 0, 0]]
		]);
		cond.test = false;
		score.recordNRT(
			outputFilePath: outDir +/+ "stage5_%.wav".format(name),
			inputFilePath: outDir +/+ "cello_sim.wav",
			sampleRate: 48000, headerFormat: "WAV", sampleFormat: "float",
			options: ServerOptions.new.numOutputBusChannels_(1).numInputBusChannels_(1),
			duration: 12.0,
			action: { cond.test = true; cond.signal }
		);
		cond.wait;
		names.add("\"%\"".format(name));
	};
	File.use(outDir +/+ "stage5_cases.json", "w", { |f| f.write("[" ++ names.join(",") ++ "]") });
	"RENDER DONE".postln;
	0.exit;
}.fork;
)
