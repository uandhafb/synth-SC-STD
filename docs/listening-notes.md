# Listening notes

Dated feedback from listening tests. Newest first.
Format: date, stage, what was played (exact Tidal/Strudel line), what was heard, action.

## 2026-09-23 — Stage 6, measurements (before listening)
- Spring reverb as SuperDirt global effect, off by default (user chose B). First dispersion design
  (plain one-sample allpasses) spread only ~1 ms: inaudible chirp. Stretched allpasses (11-12
  samples): ~15 ms per echo (30 ms on a single chain). T60 0.7/1.3/5.1 s for spdecay 0/0.5/1.
  Through a private real SuperDirt: tail continues after the note (pattern and panel), panel back
  to 0 switches it off.
- Calibration (no reference instrument, see docs/references/calibration.md): tuning +-0.3 cents;
  MoogFF 4-pole slope OK; MoogLadder gentler (-16..-18 dB/oct) kept as character; key tracking 3.7
  of 4; AR timing OK.
- Level: scstd was 8-18 dB quieter than SuperDirt's own sounds -> output +8 dB (rms -28.8 vs
  superpiano -30.5, bd -28.9). Fuzz then found one random patch at +4.3 dBFS -> output softclip
  (linear below 0.5): loudest random patch now -8.5 dBFS.
- Pending: user listening (examples 65-70; everything is 8 dB louder than before).

## 2026-09-23 — Stage 5 done
- 54 mono glide and 55 same code in both modes: fine (user).
- Mic reaction "could be a little strong": default ingain 0.5 -> 0.4 (~ -4 dB); added 59B lines
  (ingain per cycle, smaller cable amount, slow follower) and live ~scstdSet.(\ingain, ...) lines.
- Stage 5 approved.

## 2026-09-23 — Stage 5, first listening
- Mic (Mac built-in) reaches SuperCollider and the audio-input examples react (user: "it worked").
  Added sc/tests/mic_check.scd (s.meter + mic level readout) for checking the input.

## 2026-09-23 — Stage 5, offline and real-SuperDirt measurements (before listening)
- New: mono mode (monomode, glide), audio input (ingain, inlvl, efatk, efrel, source envf),
  electronic switch, mixer/inverter (source mix, shsrc 4, lagsrc 1), vcainit. 104 params in sync;
  event synth and mono synth checks OK (check_msgfunc.scd).
- Offline with a synthetic "cello" as NRT input (quiet/loud/silent): envf_vcf brightness
  155/342/131 Hz; envf_vca (vcainit 0) level -39/-25/-240 dB; input through the filter
  -34/-24/-117 dB; switch alternates +6/0 st every 1/8 s; inverted ADSR -> pitch -9 ... 0 st;
  S&H from mixer = staircase with jitter.
- Found: envf_vca could not gate the synth (vcaenv 0 meant "fully open" + envf). Added vcainit
  (original's initial-gain knob), default 1 = unchanged behaviour.
- Mono via a private real SuperDirt (sc/tests/mono_probe.scd + analysis/mono_check.py):
  legato phrase glides (7 -> 9 -> 11 -> 12 st in 50 ms steps) with no level dips; separated
  notes retrigger (dips to ~-65 dB); an event-mode note frees the mono voice (1 -> 0, node tree clean).
- Regressions: Stages 1-4 renders unchanged (default -16.4 dBFS, panel/pattern-wins OK);
  fuzz with all 104 params random: all finite, peaks -50..-0.9 dBFS.
- Pending: user listening (tidal/examples.tidal 54-64, with headphones for 59-61).

## 2026-09-23 — Stage 4 done
- 43-off/on and 48-off/on: cables audible as intended; panel_demo.scd with example 53: works (user).
- Examples 44-47 and 49-52 not individually commented; treated as OK, user to report issues.
- Stage 4 approved.

## 2026-09-23 — Stage 4, first listening
- #43 "cool but not sure it does what it should", #48 same. Both verified offline: adsr_pitch
  +9 -> 0 st; sh_pw gives random duty per step (0.90 0.59 0.43 0.31 0.16 0.84 ...).
  They were just too fast/subtle to recognise: added 43-off/on (0.6 s swoop) and 48-off/on
  (open filter, 3 steps/s) comparison lines.

## 2026-09-23 — Stage 4, offline and real-SuperDirt measurements (before listening)
- 28 new cables (<source>_<dest>) + rma/rmb + o1kbd..o3kbd = 80 params; all reach the synth via
  SuperDirt (check_msgfunc.scd). Rendered with sc/tests/stage4_render.scd / analysis/stage4_check.py.
- adsr_pitch 12: +9 -> 0 st over the decay; ar_pitch -12: 0 -> -12 st over the attack; vco1_vca -0.5
  (square LFO 5 Hz): AM depth 0.43; o2kbd 0: VCO 2 at 261.2 Hz while playing 523 Hz.
- Panel buses: default sound via buses identical (-16.4 dBFS). Changing vcfcut on the bus mid-note:
  brightness 236 -> 132 Hz; same change with vcfcut sent by the pattern: 236 -> 236 Hz (pattern wins).
  Same result through a private real SuperDirt (385 -> 134 Hz vs 217 -> 212 Hz); preset loaded into
  the panel then a plain note sounds like the preset.
- Worst case (many pitch cables at full) produced NaN: summed modulation up to +-180 st drove VCO
  frequencies to ~0 / MHz. Fix: VCO frequency clamped to 0.01 Hz..20 kHz. New fuzz test
  (sc/tests/fuzz_render.scd: 40 notes, all 80 params random): all finite, peaks -45..-1.6 dBFS.
- Correction: "two sines" ring mod is not possible (only VCO 2 has a sine); comment fixed.
- Pending: user listening (tidal/examples.tidal 43-53, sc/tests/panel_demo.scd).

## 2026-09-23 — Stage 3 done
- After the LFO and cable fixes: 32A/32B wind, 38 staircase, 22 PWM pad (no clicks), 19 vibrato: OK.
- Earlier: R2-D2 variants 40A-F "all pretty cool"; bells 34A/B added after "could be more bell".
- 31 percussion, 34A/B bells and 35 computer sequence not individually re-confirmed after the fixes;
  treated as OK, user to report issues.
- Stage 3 approved.

## 2026-09-23 — Stage 3: LFO bug, new staircase (38), continuous wind (32)
- User: 38 "don't like much"; wind "maybe slower?".
- While building a better 38 (S&H reading VCO 1's LFO saw), found: SuperCollider's band-limited Saw
  and Pulse break down below ~20 Hz (Saw at 0.5 Hz: spikes up to +30, 2 Hz: +8, 5 Hz: +3; clean
  only above ~20 Hz). So since Stage 2, VCO 1 in LF mode sent spikes into FM/PWM/S&H.
  The "PWM clicks" in #22 (Stage 2 notes: "saw LFO resetting") were these spikes.
- Fix: ~scstdMods[\saw]/[\pulse] use LFSaw/LFPulse below 20 Hz (all VCOs). Verified: vibrato
  #19 now +-0.36 st as designed; PWM flux 5.1 -> 1.4 (smooth sweep, no clicks); staircase works.
- 38 now: S&H reads VCO 1's slow saw -> rising staircase 0 +3 +6 +9 +12, repeating.
- 32 wind: the old version restarted every cycle (one note per cycle with fade-in = pulsing).
  32A: slow 4 + legato 1.2 + long fades + shrate 0.6 -> continuous, level varies only 4.4 dB,
  no dips at note joins (measured over 3 overlapping notes). 32B gusty, 32C old for comparison.
- Regression renders of Stages 1-3 unchanged (no NaN, default level, sync -60 dB); msgFunc OK.

## 2026-09-23 — Stage 3, bug: patch cables never reached the synth via SuperDirt
- User: #35 has no pitch jumps. Offline renders jumped, so reproduced with a private SuperDirt
  instance (output to a silent bus, recorded): pitch stayed at +0.
- Cause: SynthDesc treats a control name whose 2nd character is "_" as a rate prefix and strips it,
  so SuperDirt's msgFunc expected "sh_pitch" while Tidal sent "m_sh_pitch": value silently dropped.
- Fix: cable names are now <source>_<dest> (sh_pitch, sh_vcf); ~scstdParams refuses 2nd-char "_";
  new test sc/tests/check_msgfunc.scd (all 47 params pass). Real SuperDirt probe now jumps:
  -12 -5 -7 +10 +6 -2 ... semitones.
- #34 "could be more bell": added ring-mod bells 34A church (partials 1, 2.4, 0.4, 3.8 x note,
  -33 -> -54 dB over 2 s, brightness 525 -> 411 Hz) and 34B glass; preset ringmod_bell.
  Note: 34 itself was also affected only by the level, not the bug (rmlvl has no "_").

## 2026-09-23 — Stage 3, R2-D2 third draft
- User likes 40A/B/C but "neither similar: more talking and beeps".
- New approach: many short sine beeps (Tidal: segment 16 + degradeBy 0.35, random pitch C5-C7),
  each bent upward by a random amount (VCO 1 LFO saw -> VCO 2 FM, random rate/depth per beep).
  40D talking (now the preset), 40E plain beeps, 40F mixed.
- Found: Tidal's rand, irand and degradeBy share one random stream, so surviving beeps were all
  high with big bends. Shifted sources in time (0.37 <~ irand etc.): pitch range 12-34, mean 21.9,
  cross-correlations ~0 (checked with queryArc over 8 cycles).

## 2026-09-23 — Stage 3, first listening
- #36-38 unclear to the user: comments rewritten (36 = glides, 37 = S&H on filter, 38 = S&H on VCO 3).
- #40 R2-D2 first draft: "cool but too harsh, not R2-D2". Cause: ring mod uses VCO 1's saw.
  Second draft without ring mod: sine + fast VCO 1 trill + S&H with lag, pitched higher.
  Energy above 4 kHz: -19 dB (draft 1) -> -41 dB (40A whistle) / -30 dB (40B chirp).
  Preset updated to 40A; waiting for user's choice.

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
