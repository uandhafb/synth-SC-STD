// Spring reverb through a real (private, silent) SuperDirt instance: does the tail survive the
// note's end, does the panel switch it on/off? Records analysis/output/reverb_probe.wav.
// Run: /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/reverb_probe.scd

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var s2 = Server(\probe, NetAddr("127.0.0.1", 57131));
s2.options.numOutputBusChannels = 2; s2.options.numInputBusChannels = 2;
s2.options.memSize = 8192 * 32; s2.options.numWireBufs = 2048; s2.options.numBuffers = 1024;
s2.waitForBoot {
	var buf, rec, play, lat = 0.2, capture;
	Server.default = s2;
	~dirt = SuperDirt(2, s2); s2.sync;
	~dirt.start(57139, [0]);
	(root +/+ "sc/synthdefs/00_modules.scd").load;
	(root +/+ "sc/buses.scd").load; s2.sync;
	(root +/+ "sc/synthdefs/scstd.scd").load;
	(root +/+ "sc/synthdefs/spring.scd").load; 1.wait; s2.sync;
	// Capture the orbit's final output (dry + effects), which SuperDirt sends to hardware bus 0.
	buf = Buffer.alloc(s2, 65536, 2); s2.sync;
	buf.write(root +/+ "analysis/output/reverb_probe.wav", "wav", "float", 0, 0, true); s2.sync;
	rec = { DiskOut.ar(buf, In.ar(0, 2)) }.play(s2, addAction: \addToTail);
	0.5.wait;
	play = { |ev| ~dirt.orbits[0].value((s: \scstd, latency: lat, cps: 0.5625, n: 0, delta: 0.3, legato: 1) ++ ev) };
	play.((spmix: 0));            "A t=0.0 dry".postln; 3.wait;
	play.((spmix: 0.5));          "B t=3.0 pattern spmix 0.5".postln; 3.wait;
	~scstdSet.(\spmix, 0.5);
	play.(());                    "C t=6.0 panel spmix 0.5".postln; 3.wait;
	~scstdSet.(\spmix, 0);
	play.(());                    "D t=9.0 panel back to 0".postln; 3.wait;
	rec.free; buf.close; buf.free; s2.sync;
	"PROBE DONE".postln; 0.exit;
};
)
