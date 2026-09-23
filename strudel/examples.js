// synth-SC-STD Strudel examples.
// 1. Run sc/startup.scd in SuperCollider.
// 2. In a terminal: npx @strudel/osc   (bridge from the browser to SuperDirt on port 57120)
// 3. Open strudel.cc, paste strudel/params.js, then ONE pattern below, press Ctrl+Enter.
//    Ctrl+. stops.

// Stage 1 — same as tidal/examples.tidal #1: default sound.
n("0 3 7 10").s("scstd").osc()

// #9 — resonant filter sweep. Listen for: smooth whistling peak, no clicks.
// n("-12*8").s("scstd").vcfenv(0).vcfres(0.9).vcfcut(sine.range(100, 6000).slow(4)).osc()

// #11 — filter envelope bass.
// n("-24 -24 -12 -24").s("scstd").vcfcut(150).vcfres(0.6).vcfenv(0.8).edec(0.25).esus(0).osc()

// #17 — filter A/B: MoogLadder (0) vs MoogFF (1), alternating every cycle.
// n("-24 -12 -24 -17").s("scstd").vcfcut(300).vcfres(0.85).vcfenv(0.6).edec(0.3).vcfmodel("<0 1>").osc()

// Stage 0 test synth (sctest)
// n("0 3 7 10").s("sctest").tstbright(sine.slow(4)).osc()
