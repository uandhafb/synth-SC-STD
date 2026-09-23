// Release ("gate") test: does the release tail survive SuperDirt's dirt_gate?
// Requires sc/startup.scd to be running. Click on a line and press Shift+Enter.
// (Stage 0 ran this with the test synth sctest; it now uses the real voice scstd.)
//
// Listen for: a short note (0.25 s) followed by a smooth fade.
//   PASS: the fade lasts about 3 s and dies away smoothly.
//   FAIL: the sound stops abruptly right after the note (the tail is cut).

// 1. Short note, 3 s release on both envelopes (sent through SuperDirt exactly as Tidal would):
~dirt.orbits[0].value((s: \scstd, n: 0, delta: 0.25, arrel: 3, erel: 3));

// 2. Same note, short release, for comparison (should stop quickly and cleanly, no click):
~dirt.orbits[0].value((s: \scstd, n: 0, delta: 0.25, arrel: 0.05, erel: 0.05));

// 3. Param check: dark vs. bright filter (should clearly differ):
~dirt.orbits[0].value((s: \scstd, n: -12, delta: 1, vcfcut: 150, vcfenv: 0));
~dirt.orbits[0].value((s: \scstd, n: -12, delta: 1, vcfcut: 8000, vcfenv: 0));

// 4. Explicit sustain overrides our default (total length 0.5 s incl. release):
~dirt.orbits[0].value((s: \scstd, n: 0, sustain: 0.5, arrel: 3));
