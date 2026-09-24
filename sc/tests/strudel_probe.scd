// Stage 8 probe: do Strudel-shaped and Tidal-shaped messages give the same notes?
// Strudel sends `.legato(x)` as `clip` (and every number as a float); Tidal sends `legato`.
// This sends both kinds of real /dirt/play OSC messages to a private, silent SuperDirt and records
// the result to analysis/output/strudel_probe.wav; analyse with
//   .venv/bin/python analysis/strudel_check.py
// Does not touch your running SuperCollider (own server on port 57131, SuperDirt on 57139,
// output to an internal bus).
// Run: /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/strudel_probe.scd

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var s2 = Server(\probe, NetAddr("127.0.0.1", 57131));
s2.options.numOutputBusChannels = 2; s2.options.numInputBusChannels = 2;
s2.options.memSize = 8192 * 32; s2.options.numWireBufs = 2048; s2.options.numBuffers = 1024;
s2.waitForBoot {
	var bus = Bus.audio(s2, 2), buf, rec, dirt = NetAddr("127.0.0.1", 57139);
	// One note at 0.575 cps, half a cycle long (delta 0.8696 s), short releases so lengths are clear.
	var base = [\cps, 0.575, \cycle, 0.0, \delta, 0.8696, \s, "scstd", \n, 0.0,
		\vcfenv, 0.0, \drift, 0.0, \vspread, 0.0, \aratk, 0.005, \arrel, 0.05, \erel, 0.05];
	var tidal = { |legato ... more| dirt.sendMsg(*(['/dirt/play', \_id_, "1"] ++ base ++ [\legato, legato] ++ more)) };
	var strudel = { |clip ... more| dirt.sendMsg(*(['/dirt/play'] ++ base ++ [\clip, clip] ++ more)) };
	Server.default = s2;
	~dirt = SuperDirt(2, s2); s2.sync;
	~dirt.start(57139, [0]); ~dirt.orbits[0].outBus = bus;
	(root +/+ "sc/synthdefs/00_modules.scd").load;
	(root +/+ "sc/buses.scd").load; s2.sync;
	(root +/+ "sc/synthdefs/scstd.scd").load; s2.sync;
	buf = Buffer.alloc(s2, 65536, 1); s2.sync;
	buf.write(root +/+ "analysis/output/strudel_probe.wav", "wav", "float", 0, 0, true); s2.sync;
	rec = { DiskOut.ar(buf, In.ar(bus, 1)) }.play(s2, addAction: \addToTail);
	0.5.wait;
	// Notes start every 2 s (t = 0.5, 2.5, ...). Expected lengths: 0.3 x 0.87 = 0.26 s,
	// 1.5 x 0.87 = 1.30 s (+ 0.05 s release), in event mode and in mono mode.
	tidal.(0.3); 2.wait;
	strudel.(0.3); 2.wait;
	tidal.(1.5); 2.wait;
	strudel.(1.5); 2.wait;
	tidal.(0.3, \monomode, 1.0); 2.wait;
	strudel.(0.3, \monomode, 1.0); 2.wait;
	tidal.(1.5, \monomode, 1.0); 2.wait;
	strudel.(1.5, \monomode, 1.0); 2.wait;
	rec.free; buf.close; buf.free; s2.sync;
	"PROBE DONE".postln; 0.exit;
};
)
