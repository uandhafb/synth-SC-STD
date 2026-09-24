// Web panel end-to-end probe, SuperCollider side: a private sclang + server + SuperDirt with the
// project loaded, output routed to an internal bus (silent) and recorded to
// analysis/output/ui_probe.wav. Writes its OSC port to analysis/output/ui_probe_port.txt so the
// Node test (analysis/ui_check.mjs) can start a relay against it. Runs for 60 s, then exits.
// Run: /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/ui_probe.scd
//      (analysis/ui_check.mjs starts it for you)

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var out = root +/+ "analysis/output";
var s2 = Server(\probe, NetAddr("127.0.0.1", 57131));
s2.options.numOutputBusChannels = 2; s2.options.numInputBusChannels = 2;
s2.options.memSize = 8192 * 32; s2.options.numWireBufs = 2048; s2.options.numBuffers = 1024;
s2.waitForBoot {
	var bus = Bus.audio(s2, 2), buf, rec;
	Server.default = s2;
	~dirt = SuperDirt(2, s2); s2.sync;
	~dirt.start(57139, [0]);
	~dirt.orbits[0].outBus = bus;
	~scstdState = nil;
	(root +/+ "sc/synthdefs/00_modules.scd").load;
	(root +/+ "sc/buses.scd").load; s2.sync;
	(root +/+ "sc/synthdefs/scstd.scd").load;
	(root +/+ "sc/synthdefs/spring.scd").load; 1.wait; s2.sync;
	buf = Buffer.alloc(s2, 65536, 1); s2.sync;
	buf.write(out +/+ "ui_probe.wav", "wav", "float", 0, 0, true); s2.sync;
	rec = { DiskOut.ar(buf, In.ar(bus, 1)) }.play(s2, addAction: \addToTail);
	File.use(out +/+ "ui_probe_port.txt", "w", { |f| f.write(NetAddr.langPort.asString) });
	"UI PROBE READY on port %".format(NetAddr.langPort).postln;
	60.wait;
	rec.free; buf.close; buf.free; s2.sync;
	File.delete(out +/+ "ui_probe_port.txt");
	"UI PROBE DONE".postln; 0.exit;
};
)
