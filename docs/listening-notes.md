# Listening notes

Dated feedback from listening tests. Newest first.
Format: date, stage, what was played (exact Tidal/Strudel line), what was heard, action.

## 2026-09-23 — Stage 3, offline measurements (before listening)
Rendered with `sc/tests/stage3_render.scd`, measured with `analysis/stage3_check.py`.
- Noise: PinkNoise measured ~3.7x quieter than white/brown (RMS 0.155 vs 0.58); gain added.
- S&H -> pitch works: one note, 8 steps/s, e.g. -4 -9 +1 -11 ... semitones; shlag 1 halves the
  spectral-flux peaks (16.7 -> 7.0). S&H sampling VCO 2 while moving its pitch (feedback via
  LocalIn, 1 block delay) is stable. Wind very smooth (flux ratio 1.5). No NaN; worst case -6.9 dBFS.
- Lag processor on VCO 1 mod: PWM flux peak 5.1 -> 3.7 at lagtime 0.3.
- Ring mod of two saws aliases a little at high notes (-27.5 dB off-line energy at C6); the filter
  normally removes most of it. Left as is.
- FILTER CALIBRATION (affects all stages): MoogLadder's real corner was 0.88x (60 Hz) .. 0.59x
  (20 kHz) of vcfcut; "open" was only ~4 kHz at -3 dB. Its self-oscillation pitch was +1.7 st
  (110 Hz) .. -3 st (7 kHz) off. Added a resonance-dependent correction: corner now 0.97-1.01x up
  to 2 kHz (0.87x at 8 kHz, 0.81x at 12 kHz: MoogLadder's ceiling is a ~12.8 kHz corner); sung
  pitch within +-0.6 st (110 Hz: +0.03, 440 Hz: -0.07). Default sound is now brighter than the
  Stage 1 approval. MoogFF was already accurate (textbook 0.44x at -3 dB).
  Possible later (Stage 6): compare BMoog / StkMoog as an alternative core.
- Pending: user listening (tidal/examples.tidal 30-42, presets wind / computer_sequence / r2d2_bleeps).

## 2026-09-23 — Stage 2 done
- #20 (VCO 1 in LF mode, not muted): "annoying but maybe interesting" -> keep faithful (no auto-mute).
- #22 PWM pad: user hears clicks and likes them. Measured: they occur exactly one LFO period
  (1.25 s at 0.8 Hz) after each chord start = VCO 1's saw LFO resetting, so the pulse width snaps.
  Absent with PWM off. Faithful (VCO 1 has only saw/square). Decision A: keep; smooth PWM will
  come from the Stage 3 lag processor on VCO 1 (the original's way), no extra LFO shape.
- #25 sync lead and #27 FM bell: OK (user).
- Stage 2 approved.

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
