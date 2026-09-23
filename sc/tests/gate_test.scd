// Stage 0 gate test: does the release tail survive SuperDirt's dirt_gate?
// Requires sc/startup.scd to be running. Evaluate each line with Cmd+Enter.
//
// Listen for: a short note (0.25 s) followed by a smooth fade.
//   PASS: the fade lasts about 3 s and dies away smoothly.
//   FAIL: the sound stops abruptly right after the note (the tail is cut).

// 1. Short note, 3 s release (sent through SuperDirt exactly as Tidal would):
~dirt.orbits[0].value((s: \sctest, n: 0, delta: 0.25, tstrel: 3));

// 2. Same note, short release, for comparison (should stop quickly and cleanly, no click):
~dirt.orbits[0].value((s: \sctest, n: 0, delta: 0.25, tstrel: 0.05));

// 3. Custom param check: dark vs. bright (should clearly differ):
~dirt.orbits[0].value((s: \sctest, n: -12, delta: 1, tstbright: 0.05));
~dirt.orbits[0].value((s: \sctest, n: -12, delta: 1, tstbright: 1));

// 4. Explicit sustain overrides our default (total length 0.5 s incl. release):
~dirt.orbits[0].value((s: \sctest, n: 0, sustain: 0.5, tstrel: 3));
