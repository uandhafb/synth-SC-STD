// Stage 10 performance test through a real (private, silent) SuperDirt. No ears needed.
//   /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/perf_probe.scd
//   then: .venv/bin/python analysis/perf_check.py
// Does not touch your running SuperCollider: own server on port 57131, SuperDirt on 57139, all
// orbits write to an internal bus (nothing reaches the speakers). Same server options as startup.scd.
// 1. CPU per voice: 0/1/8/16/32 held notes, default sound and "everything on" sound.
// 2. Stress: a dense 4-orbit session (fast chords, noise hats, mono lead with glide, pads with the
//    spring reverb), random params on every note, and a random panel change every 100 ms
//    (like moving sliders). Length: PERF_SECONDS (default 180).
// 3. After the stress: every note must end (synth count back to the idle count), output clean.
// Results: analysis/output/perf_log.csv (1 row per second), perf_voices.csv, perf_probe.wav,
// and "late" lines from the server (messages that arrived too late to play on time).

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var seconds = ("PERF_SECONDS".getenv ? "180").asInteger;
var s2 = Server(\probe, NetAddr("127.0.0.1", 57131));
// Same options as sc/startup.scd (fewer buffers: no sample library is loaded here).
s2.options.numOutputBusChannels = 2; s2.options.numInputBusChannels = 2;
s2.options.memSize = 8192 * 32; s2.options.numWireBufs = 2048; s2.options.numBuffers = 1024 * 16;
s2.options.maxNodes = 1024 * 32;
s2.waitForBoot {
	var bus = Bus.audio(s2, 2), buf, rec, dirt = NetAddr("127.0.0.1", 57139);
	var lat = 0.2, cps = 0.575, step = 1 / cps / 16;
	var play, full, measure, voicesLog, log, idle, rout, t0, maxPeak = 0, maxSynths = 0, events = 0;
	Server.default = s2;
	~dirt = SuperDirt(2, s2); s2.sync;
	~dirt.start(57139, [0, 0, 0, 0]);
	~dirt.orbits.do { |o| o.outBus = bus };
	(root +/+ "sc/synthdefs/00_modules.scd").load;
	(root +/+ "sc/buses.scd").load; s2.sync;
	(root +/+ "sc/synthdefs/scstd.scd").load; s2.sync;
	(root +/+ "sc/synthdefs/spring.scd").load; 2.wait;
	buf = Buffer.alloc(s2, 65536, 1); s2.sync;
	buf.write(root +/+ "analysis/output/perf_probe.wav", "wav", "float", 0, 0, true); s2.sync;
	rec = { DiskOut.ar(buf, In.ar(bus, 1)) }.play(s2, addAction: \addToTail);
	// Like Tidal: an OSC bundle stamped `lat` seconds ahead, to SuperDirt's port.
	play = { |orbit, pairs|
		var msg = ['/dirt/play', \cps, cps, \cycle, 0, \s, "scstd", \orbit, orbit] ++ pairs;
		dirt.sendBundle(lat, msg); events = events + 1;
	};
	// "Everything on": all three VCOs, noise, ring mod, sync + FM, drive, S&H on pitch and filter,
	// lag, electronic switch, mixer cable, spring.
	full = [\o3lvl, 0.6, \nzlvl, 0.3, \rmlvl, 0.4, \o2sync, 1, \o2fm, 0.1, \o3fm, 0.2, \vcfdrive, 1,
		\sh_pitch, 2, \sh_vcf, 1, \lagtime, 0.1, \swlvl, 0.5, \mix_pitch, 0.5, \vcfres, 0.9, \spmix, 0.3];
	3.wait;
	idle = s2.numSynths;
	"PERF idle synths: %, idle CPU avg % peak %".format(idle, s2.avgCPU.round(0.01), s2.peakCPU.round(0.01)).postln;

	// ---- 1. CPU per voice --------------------------------------------------------------------
	voicesLog = File(root +/+ "analysis/output/perf_voices.csv", "w");
	voicesLog.write("sound,voices,avg_cpu,peak_cpu,synths\n");
	[[\default, []], [\full, full]].do { |kind|
		[0, 1, 8, 16, 32].do { |n|
			n.do { |i| play.(0, [\n, i % 24, \delta, 3, \legato, 1] ++ kind[1]) };
			(lat + 1.5).wait;
			voicesLog.write("%,%,%,%,%\n".format(kind[0], n, s2.avgCPU, s2.peakCPU, s2.numSynths));
			"PERF % voices % : avg CPU % peak % synths %".format(kind[0], n, s2.avgCPU.round(0.01), s2.peakCPU.round(0.01), s2.numSynths).postln;
			3.5.wait;
		};
	};
	voicesLog.close;

	// ---- 2. Stress -----------------------------------------------------------------------------
	log = File(root +/+ "analysis/output/perf_log.csv", "w");
	log.write("t,avg_cpu,peak_cpu,synths,events\n");
	t0 = thisThread.seconds;
	"PERF stress start (% s)".format(seconds).postln;
	rout = Routine {
		var k = 0;
		loop {
			var r = { |a, b| rrand(a.asFloat, b.asFloat) };
			// orbit 0: 3-note chords on every step, random filter, sometimes S&H and ring mod
			[0, 4, 7].do { |x| play.(0, [\n, x + [0, 3, 5, 7].choose, \delta, step, \legato, r.(0.5, 1.5),
				\vcfcut, r.(300, 5000), \vcfres, r.(0, 1), \sh_vcf, [0, 0, 2].choose, \rmlvl, [0, 0.4].choose,
				\spmix, [0, 0.3].choose]) };
			// orbit 1: noise hi-hat on every step
			play.(1, [\n, 0, \delta, step, \legato, 0.1, \o1lvl, 0, \o2lvl, 0, \nzlvl, 1, \aratk, 0.001,
				\arrel, 0.05, \erel, 0.05, \vcfcut, 9000, \vcfenv, 0]);
			// orbit 2: mono lead with glide, every 2nd step, overlapping
			if(k.even) { play.(2, [\n, [12, 15, 19, 22, 24].choose, \delta, step * 2, \legato, 1.1,
				\monomode, 1, \glide, 0.08, \vcfcut, r.(800, 3000)]) };
			// orbit 3: pad chord once per cycle, long, with the spring
			if(k % 16 == 0) { [-12, -5, 0, 4].do { |x| play.(3, [\n, x, \delta, step * 16, \legato, 1,
				\aratk, 0.4, \arrel, 1.2, \erel, 1.2, \o2pwm, 0.5, \o1lf, 1, \o1lfrate, 0.7, \o1lvl, 0,
				\o2wave, 1, \spmix, 0.5, \spdecay, 0.7] ++ full) } };
			k = k + 1;
			step.wait;
		}
	}.play(SystemClock);
	// Panel changes, like someone moving sliders.
	Routine {
		var names = [\vcfres, \vcfdrive, \o2pwm, \o3lvl, \nzcol, \drift, \shrate, \spdecay, \sptone, \vcfenv];
		while { thisThread.seconds - t0 < seconds } {
			var k = names.choose, spec = ~scstdSpecs[k];
			~scstdSet.(k, rrand(spec[0].asFloat, spec[1].asFloat));
			0.1.wait;
		}
	}.play(SystemClock);
	while { thisThread.seconds - t0 < seconds } {
		1.wait;
		maxPeak = max(maxPeak, s2.peakCPU); maxSynths = max(maxSynths, s2.numSynths);
		log.write("%,%,%,%,%\n".format((thisThread.seconds - t0).round(0.1), s2.avgCPU, s2.peakCPU, s2.numSynths, events));
	};
	rout.stop;
	log.close;
	"PERF stress done: % events, max peak CPU %, max synths %".format(events, maxPeak.round(0.01), maxSynths).postln;

	// ---- 3. After: everything must end ---------------------------------------------------------
	// A normal (event-mode) note on orbit 2 releases the persistent mono voice, like switching
	// monomode off; then wait for all releases and the reverb tails.
	play.(2, [\n, 0, \delta, 0.1, \legato, 0.5]);
	~scstdReset.();
	8.wait;
	"PERF after: synths % (idle was %), mono voices %".format(s2.numSynths, idle, ~scstdMonoVoices.size).postln;
	rec.free; buf.close; buf.free; s2.sync;
	"PROBE DONE".postln; 0.exit;
};
)
