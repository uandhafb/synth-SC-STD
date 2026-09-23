// Stage 0: Strudel -> SuperDirt smoke test.
// 1. Run sc/startup.scd in SuperCollider.
// 2. In a terminal: npx @strudel/osc   (bridge from the browser to SuperDirt on port 57120)
// 3. Open strudel.cc, paste strudel/params.js, then one of the patterns below, press Ctrl+Enter.
//
// Listen for: the same melody as tidal/examples.tidal #2, filter opening and closing.

n("0 3 7 10").s("sctest").tstbright(sine.slow(4)).osc()

// Fallback if createParams is not available:
// n("0 3 7 10").s("sctest").set({ tstbright: 0.9 }).osc()
