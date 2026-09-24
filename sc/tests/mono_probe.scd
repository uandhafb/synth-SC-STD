// Mono-mode probe through a real (private, silent) SuperDirt instance. Records to
// analysis/output/mono_probe.wav; analyse with .venv/bin/python analysis/mono_check.py
// Does not touch your running SuperCollider: it boots its own server on port 57131 and sends
// the output to an internal bus (nothing reaches the speakers).
// Run: /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/mono_probe.scd

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var s2 = Server(\probe, NetAddr("127.0.0.1", 57131));
s2.options.numOutputBusChannels = 2; s2.options.numInputBusChannels = 2;
s2.options.memSize = 8192 * 32; s2.options.numWireBufs = 2048; s2.options.numBuffers = 1024;
s2.waitForBoot {
	var bus = Bus.audio(s2, 2), buf, rec, play, lat = 0.2;
	Server.default = s2;
	~dirt = SuperDirt(2, s2); s2.sync;
	~dirt.start(57139, [0]); ~dirt.orbits[0].outBus = bus;
	(root +/+ "sc/synthdefs/00_modules.scd").load;
	(root +/+ "sc/buses.scd").load; s2.sync;
	(root +/+ "sc/synthdefs/scstd.scd").load; s2.sync;
	buf = Buffer.alloc(s2, 65536, 1); s2.sync;
	buf.write(root +/+ "analysis/output/mono_probe.wav", "wav", "float", 0, 0, true); s2.sync;
	rec = { DiskOut.ar(buf, In.ar(bus, 1)) }.play(s2, addAction: \addToTail);
	0.5.wait;
	// Like Tidal: each event carries delta (seconds) and legato; latency schedules it ahead.
	play = { |ev| ~dirt.orbits[0].value((s: \scstd, latency: lat, cps: 0.5625, vcfenv: 0, drift: 0, vspread: 0) ++ ev) };
	// A (t = 0.5 s): legato phrase with glide: 0 -> 7 -> 12, overlapping notes (legato 1.1).
	[0, 7, 12].do { |n| play.((n: n, delta: 0.5, legato: 1.1, monomode: 1, glide: 0.25)); 0.5.wait };
	1.0.wait;
	// B (t = 3.0 s): separated notes (legato 0.5) -> envelopes retrigger on every note.
	[0, 0, 0, 0].do { |n| play.((n: n, delta: 0.5, legato: 0.5, monomode: 1)); 0.5.wait };
	1.0.wait;
	"mono voices before event-mode note: %".format(~scstdMonoVoices.size).postln;
	// C (t = 6.0 s): an event-mode note on the same orbit releases and frees the mono voice.
	play.((n: 0, delta: 0.5, legato: 1));
	1.5.wait;
	"mono voices after event-mode note: %".format(~scstdMonoVoices.size).postln;
	s2.queryAllNodes;
	0.5.wait;
	rec.free; buf.close; buf.free; s2.sync;
	"PROBE DONE".postln; 0.exit;
};
)
