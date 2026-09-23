// Project startup: boots the server, starts SuperDirt, then loads every file in synthdefs/.
// Open this file in the SuperCollider IDE, click inside the outer parentheses, and press Cmd+Enter.
// If SuperDirt is already running from your global startup.scd, stop it first (Cmd+.) and
// run `Server.killAll`, or just evaluate the "load synthdefs" block at the bottom.

(
var projectDir = thisProcess.nowExecutingPath.dirname;

s.reboot {
	s.options.numBuffers = 1024 * 256;   // room for Dirt-Samples
	s.options.memSize = 8192 * 32;       // real-time memory for delays/reverbs
	s.options.numWireBufs = 2048;        // many UGens per voice later (mod matrix)
	s.options.maxNodes = 1024 * 32;
	s.options.numOutputBusChannels = 2;
	s.options.numInputBusChannels = 2;   // audio in for the envelope follower (Stage 5)

	s.waitForBoot {
		~dirt !? { ~dirt.free };
		~dirt = SuperDirt(2, s);
		~dirt.loadSoundFiles;
		s.sync;
		~dirt.start(57120, 0 ! 12);      // Tidal/Strudel send to port 57120

		// Handy orbit shortcuts, as in the standard SuperDirt setup.
		~d1 = ~dirt.orbits[0]; ~d2 = ~dirt.orbits[1]; ~d3 = ~dirt.orbits[2];

		// Load order matters: module specs, then the panel buses (the SynthDefs read them), then
		// the voices (each file registers itself with ~dirt.soundLibrary).
		(projectDir +/+ "synthdefs/00_modules.scd").load;
		(projectDir +/+ "buses.scd").load;
		s.sync;
		(projectDir +/+ "synthdefs/*.scd").pathMatch.reject { |path| path.basename == "00_modules.scd" }.do { |path|
			path.load;
		};
		s.sync;
		"[synth] project ready on port 57120".postln;
	};
	s.latency = 0.3;
};
)

// Reload the synth code without restarting SuperDirt (after editing a file). Panel values are kept.
// (var d = thisProcess.nowExecutingPath.dirname; (d +/+ "synthdefs/00_modules.scd").load; (d +/+ "buses.scd").load;
//  (d +/+ "synthdefs/*.scd").pathMatch.reject { |p| p.basename == "00_modules.scd" }.do(_.load))
