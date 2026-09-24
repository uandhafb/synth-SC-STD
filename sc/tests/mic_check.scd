// Mic check: is SuperCollider hearing the Mac's microphone?
// Needs sc/startup.scd running. Click on a line or block and press Shift+Enter (or Cmd+Enter for a
// block in parentheses).

// 1. Level meter window: the INPUT bars (left side) should move when you talk, clap or play.
s.meter;

// 2. Numbers in the Post window, 5 times per second: "mic level" = what the synth's envelope
//    follower sees (0 = silence ... 1 = very loud). Talk/clap and watch it rise.
//    Quiet room: about 0.00-0.02. Talking near the Mac: about 0.1-0.5.
~micCheck = { Amplitude.kr((SoundIn.ar(0) * 10).tanh, 0.01, 0.3).poll(5, "mic level"); Silent.ar }.play;

// 3. Stop the numbers:
~micCheck.free;

// If the numbers stay at 0.00 whatever you do:
//  - macOS: System Settings > Privacy & Security > Microphone > turn SuperCollider ON,
//    then quit and reopen SuperCollider and run sc/startup.scd again.
//  - macOS: System Settings > Sound > Input > choose the built-in microphone (and check its
//    input level slider is not at the bottom).
//  - SuperCollider uses the Mac's default input device when the server boots, so change the
//    device first, then run sc/startup.scd again.
