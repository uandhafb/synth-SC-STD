# Listening notes

Dated feedback from listening tests. Newest first.
Format: date, stage, what was played (exact Tidal/Strudel line), what was heard, action.

## 2026-09-23 — Stage 2, offline measurements (before listening)
Rendered with `sc/tests/stage2_render.scd`, measured with `analysis/stage2_check.py`.
- Hard sync: SyncSaw is not band-limited (non-harmonic energy C3/C5/C7: -29.5/-18.5/-12.4 dB).
  Replaced by polyBLEP-corrected synced waves; slave phase = frac(masterPhase * ratio), because
  Phasor reads its resetPos only once per block (found by tracing samples). In the voice (open
  filter, no drive): saw -81/-64/-56 dB, pulse -65, tri -64, sine -70 dB at C5.
- oXoct made continuous (coarse tune), needed for sync/FM ratios; whole numbers unchanged.
- No NaN; worst case (everything on, res 1.1, drive 1) peaks at -8.8 dBFS.
- Key tracking: C6 with cutoff 500 Hz: -42 dBFS (vcfkey 0) vs -22 dBFS (vcfkey 1).
- FM bell decays smoothly (-23 -> -54 dB over 2 s). Sync with VCO 1 in LF mode is stable
  but float precision makes it noisy; sync is meant for audio-rate VCO 1 (documented).
- Pending: user listening (tidal/examples.tidal 19-29, three presets).

## 2026-09-23 — Stage 1 done
- Filter A/B (#17A/B, #18A/B): user hears a clear difference and likes both.
- Decision: keep both as a permanent param `vcfmodel` (0 = MoogLadder default, 1 = MoogFF).
- Stage 1 approved; test synth sctest removed; gate test now uses scstd.

## 2026-09-23 — Stage 1, first listening
- tidal/examples.tidal 1-16 played from VS Code.
- Heard: everything works (user). #9 resonant sweep smooth: yes. #10 self-oscillation: yes.
- Two GHC parse errors in the Tidal log were not from the examples (all 18 lines type-check);
  likely a comment/partial line evaluated. Red /score/play lines = global score bridge (known).
- Filter A/B (#17-18): alternating version was confusing; split into A/B lines. Choice pending.

## 2026-09-23 — Stage 1, offline measurements (before listening)
Rendered with `sc/tests/stage1_render.scd`, measured with `analysis/stage1_check.py`.
- No NaN, no clicks at note edges, chord with 3 full VCOs + full drive peaks at -3 dBFS.
- Drive: plain tanh added 10-15 dB aliasing vs. the raw saw. Switched to ADAA tanh:
  non-harmonic energy at C8 (open filter) -35 dB -> -47 dB (saw), -52 dB (square).
- Self-oscillation: MoogLadder needs res > ~1.1 (1.5 = strong); remapped vcfres 1..1.1 -> 1..1.5.
  Now sings at ~1044 Hz for vcfcut 1000 (slightly sharp; check tracking in Stage 6).
  MoogFF caps gain at 4 and does not self-oscillate at all (-90 dBFS).
- Release tail 2 s decays smoothly (-26 -> -75 dB over 1.9 s).
- Pending: user listening + filter A/B choice (examples 17-18 in tidal/examples.tidal).

## 2026-09-23 — Stage 0, Strudel
- strudel.cc + `npx @strudel/osc` (v1.3.2): `n("0 3 7 10").s("sctest").tstbright(sine.slow(4)).osc()`
- Heard: works (user confirmed). createParams path works; no fallback needed.
- Stage 0 done: Tidal and Strudel reach SuperDirt with custom params; gate strategy confirmed.

## 2026-09-23 — Stage 0, Tidal
- `d1 $ n "0 3 7 10" # s "sctest"` (+ `# tstbright (slow 4 sine)`) from VS Code.
- Heard: works (user confirmed).
- Note: red "Unhandled OSC /score/play" lines come from the global ~/.tidal score-bridge
  target on port 6010 (= Tidal's own control port); unrelated to this project, harmless.

## 2026-09-23 — Stage 0, SuperCollider side
- `sc/tests/gate_test.scd`, all lines, sent through SuperDirt from sclang.
- Heard: works (user confirmed), long release fades out without being cut.
- Action: gate strategy (sustain = note length + release) confirmed. Next: Tidal and Strudel tests.

<!-- Example:
## 2026-09-24 — Stage 0
- `d1 $ n "0 ~ 7 ~" # s "sctest" # tstrel 2 # legato 0.2`
- Heard: tail fades smoothly, no cut.
- Action: gate strategy confirmed.
-->
