// Stage 6 technical calibration render (no reference instrument needed): VCO tuning across the
// range, filter slope, envelope timing, keyboard tracking. Writes analysis/output/calib_*.wav;
// analyse with .venv/bin/python analysis/calib_check.py
// Run: /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/calib_render.scd

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var outDir = root +/+ "analysis/output";
var clean = [drift: 0, vspread: 0, o2fine: 0, o3fine: 0];
var def, jobs;
(root +/+ "sc/synthdefs/00_modules.scd").load;
def = SynthDef(\scstd_nrt, { |freq = 220, sustain = 1| Out.ar(0, ~scstdMods[\voice].(~scstdParams.(), freq, sustain)) });
// [file, [[time, midi, sustain, params], ...], duration]
jobs = [
	// Tuning: VCO 2 alone as a sine, filter open, C1..C7.
	["calib_tuning", (0..6).collect { |i| [0.1 + (i * 1.2), 24 + (12 * i), 1.0,
		clean ++ [o1lvl: 0, o2wave: 3, vcfcut: 18000, vcfmodel: 1, vcfenv: 0, vcfkey: 0, vcfdrive: 0]] }, 8.6],
	// Filter slope: white noise through each model, cutoff 1 kHz, no resonance.
	["calib_slope", [[0.1, 60, 3.0, clean ++ [o1lvl: 0, o2lvl: 0, nzlvl: 1, vcfcut: 1000, vcfres: 0, vcfenv: 0, vcfkey: 0, vcfdrive: 0]],
		[3.6, 60, 3.0, clean ++ [o1lvl: 0, o2lvl: 0, nzlvl: 1, vcfcut: 1000, vcfres: 0, vcfenv: 0, vcfkey: 0, vcfdrive: 0, vcfmodel: 1]]], 7.0],
	// Envelopes: AR attack 1 s / release 1 s on a steady tone (sustain = 2 s gate + 1 s release).
	["calib_env", [[0.1, 60, 3.0, clean ++ [o1lvl: 0, o2wave: 3, vcfcut: 8000, vcfenv: 0, aratk: 1, arrel: 1, erel: 0.01]]], 3.5],
	// Keyboard tracking: noise with the cutoff at 500 Hz for C4, at C4 and C6, vcfkey 1.
	["calib_key", [[0.1, 60, 1.5, clean ++ [o1lvl: 0, o2lvl: 0, nzlvl: 1, vcfcut: 500, vcfres: 0, vcfenv: 0, vcfkey: 1, vcfdrive: 0, vcfmodel: 1]],
		[2.1, 84, 1.5, clean ++ [o1lvl: 0, o2lvl: 0, nzlvl: 1, vcfcut: 500, vcfres: 0, vcfenv: 0, vcfkey: 1, vcfdrive: 0, vcfmodel: 1]]], 4.0]
];
{
	var cond = Condition.new;
	jobs.do { |job|
		var score = Score([[0.0, [\d_recv, def.asBytes]]]);
		job[1].do { |n| score.add([n[0], [\s_new, \scstd_nrt, -1, 0, 0, \freq, n[1].midicps, \sustain, n[2]] ++ n[3]]) };
		score.add([job[2], [\c_set, 0, 0]]);
		cond.test = false;
		score.recordNRT(outputFilePath: outDir +/+ job[0] ++ ".wav", sampleRate: 48000, headerFormat: "WAV",
			sampleFormat: "float", options: ServerOptions.new.numOutputBusChannels_(1).numInputBusChannels_(0),
			duration: job[2], action: { cond.test = true; cond.signal });
		cond.wait;
	};
	"RENDER DONE".postln; 0.exit;
}.fork;
)
