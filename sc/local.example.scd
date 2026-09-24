// Template for sc/local.scd: your personal extras, loaded at the end of sc/startup.scd, after the
// synth is ready. Copy this file to sc/local.scd and edit it. sc/local.scd is not in git, so it can
// hold machine-specific paths and other people's code that you may use but not publish.
// It runs inside startup's boot routine: `s` is the running server and `s.sync` works.
// Write plain statements (no outer parentheses around blocks).

// Another SuperDirt synth, next to "scstd" (play it with: d2 $ n "0 7" # s "mysynth"):
// SynthDef(\mysynth, { |out, freq = 440, sustain = 1, pan = 0, amp = 0.5|
//     var env = EnvGen.ar(Env.perc(0.01, sustain), doneAction: 2);
//     Out.ar(out, DirtPan.ar(SinOsc.ar(freq) * env * amp, ~dirt.numChannels, pan));
// }).add;
// ~dirt.soundLibrary.addSynth(\mysynth);

// A file that can be loaded in one go (one block, or plain statements):
// "/path/to/other-synth.scd".load;

// Extra sample folders for SuperDirt:
// ~dirt.loadSoundFiles("/path/to/samples/*");

// A panel value at startup (the web panel shows it too):
// ~scstdSet.(\spmix, 0.2);
