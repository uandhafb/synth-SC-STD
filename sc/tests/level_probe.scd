// Loudness of scstd next to SuperDirt's built-in synths and samples, through a real (private,
// silent) SuperDirt. Records analysis/output/level_probe.wav.
// Run: /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/level_probe.scd

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var s2 = Server(\probe, NetAddr("127.0.0.1", 57131));
s2.options.numOutputBusChannels = 2; s2.options.numInputBusChannels = 2;
s2.options.memSize = 8192 * 32; s2.options.numWireBufs = 2048; s2.options.numBuffers = 1024 * 64;
s2.waitForBoot {
	var buf, rec, lat = 0.2;
	Server.default = s2;
	~dirt = SuperDirt(2, s2);
	~dirt.loadSoundFiles((Platform.userAppSupportDir +/+ "downloaded-quarks/Dirt-Samples/{bd,superpiano}*").pathMatch.first ?? { "" });
	~dirt.loadSoundFiles(Platform.userAppSupportDir +/+ "downloaded-quarks/Dirt-Samples/bd");
	s2.sync;
	~dirt.start(57139, [0]);
	(root +/+ "sc/synthdefs/00_modules.scd").load;
	(root +/+ "sc/buses.scd").load; s2.sync;
	(root +/+ "sc/synthdefs/scstd.scd").load; 1.wait; s2.sync;
	buf = Buffer.alloc(s2, 65536, 2); s2.sync;
	buf.write(root +/+ "analysis/output/level_probe.wav", "wav", "float", 0, 0, true); s2.sync;
	rec = { DiskOut.ar(buf, In.ar(0, 2)) }.play(s2, addAction: \addToTail);
	0.5.wait;
	[\scstd, \superpiano, \supersaw, \supermandolin, \bd].do { |snd, i|
		~dirt.orbits[0].value((s: snd, n: 0, latency: lat, cps: 0.5625, delta: 1.0, legato: 1));
		"% at t=%".format(snd, i * 2).postln;
		2.wait;
	};
	rec.free; buf.close; buf.free; s2.sync;
	"PROBE DONE".postln; 0.exit;
};
)
