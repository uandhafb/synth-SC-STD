// Arrival Times: records the "rupture" notes through a private, silent SuperDirt.
//   node performance/tests/rupture_send.mjs is started by this script's caller; simpler: this
//   script only listens. Use:  sh performance/tests/rupture_test.sh
// Own server on port 57131, SuperDirt on 57139 (8 orbits, the rupture uses orbit 7), all to an
// internal bus. Writes analysis/output/rupture_probe.wav; analysed by rupture_check.py.
(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var s2 = Server(\probe, NetAddr("127.0.0.1", 57131));
s2.options.numOutputBusChannels = 2; s2.options.numInputBusChannels = 2;
s2.options.memSize = 8192 * 32; s2.options.numWireBufs = 2048; s2.options.numBuffers = 1024;
s2.waitForBoot {
	var bus = Bus.audio(s2, 2), buf, rec;
	Server.default = s2;
	~dirt = SuperDirt(2, s2); s2.sync;
	~dirt.start(57139, 0 ! 8); ~dirt.orbits.do { |o| o.outBus = bus };
	(root +/+ "sc/synthdefs/00_modules.scd").load;
	(root +/+ "sc/buses.scd").load; s2.sync;
	(root +/+ "sc/synthdefs/*.scd").pathMatch.reject { |p| p.basename == "00_modules.scd" }.do(_.load); s2.sync;
	2.wait;
	buf = Buffer.alloc(s2, 65536, 2); s2.sync;
	buf.write(root +/+ "analysis/output/rupture_probe.wav", "wav", "float", 0, 0, true); s2.sync;
	rec = { DiskOut.ar(buf, In.ar(bus, 2)) }.play(s2, addAction: \addToTail);
	File.use(root +/+ "analysis/output/rupture_ready.txt", "w", { |f| f.write("ready") });
	("PROBE_SECONDS".getenv ? "50").asInteger.wait;
	rec.free; buf.close; buf.free; s2.sync;
	"PROBE DONE".postln; 0.exit;
};
)
