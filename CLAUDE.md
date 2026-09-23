# Project: synth-SC-STD


## 1. Overview

A software recreation of a 1970s semi-modular analog synthesizer, based on the
architecture of the ARP 2600, built for live coding performance and research.

The synth is played and controlled from:
- **TidalCycles** (via SuperDirt)
- **Strudel** (via OSC to SuperDirt)
- **A graphical interface** (sliders, switches, patch matrix, cable view, playable
  keyboard) in a web page, optionally wrapped as a VS Code extension later

Research context: live coding, embodied human-computer interaction, and
real-time performance with acoustic instruments (e.g. cello driving the synth
through the envelope follower).

## 2. Architecture

```
 TidalCycles ──┐
               ├──► SuperDirt ──► per-event SynthDefs ──┬──► FX bus ──► spring reverb ──► out
 Strudel ──OSC─┘        │  (custom play fn in mono mode)│
                        └──► persistent mono voice ─────┘
 Web UI(s) ⇄ Node relay ⇄ OSC ⇄ sclang
                                  │  ▲ state snapshot on connect
                                  ▼  │
                           control buses (panel state)

 Audio in (cello, mic) ──► persistent utility synths (env follower, preamp)
                                  └──► control/audio buses read by voices
```

### Key architectural decisions

1. **Behavioral modeling, not circuit simulation.** Recreate what each module
   does and tune by ear and measurement. Circuit-level modeling may be used
   selectively later (e.g. the filter only), never as a default.

2. **Panel state lives in SuperCollider control buses.** The UI writes slider
   values to control buses. Each SynthDef parameter falls back to its bus value
   when the pattern does not set it. Convention: a pattern value overrides the
   panel; no pattern value means "use the panel."
   Implementation hint: SynthDef args default to a sentinel (e.g. -1) and the
   synth uses `Select.kr(arg < 0, [arg, In.kr(bus)])`.

3. **Two-way UI state sync.** sclang is the single owner of panel state. The
   relay broadcasts every change to all connected panels, and on (re)connect
   sclang sends a full state snapshot so a reloaded page shows real values.

4. **Two voice modes.**
   - **Event mode (default):** one synth per Tidal/Strudel event via SuperDirt.
     Polyphonic, pattern-friendly.
   - **Mono mode:** one persistent voice that receives note/gate messages.
     Needed for true portamento, continuous sample & hold, drones, and
     modulation that must survive across notes.
     Implementation: register a custom `play` function in `~dirt.soundLibrary`
     that sends `set` messages to the persistent node instead of spawning a
     synth, so Tidal/Strudel code is identical in both modes.
   Build event mode first. Mono mode arrives in Stage 5.

5. **Normalled routing with overrides.** Every module has a default connection
   (see Section 7). Patch parameters override defaults. The synth must make
   sound with zero patch settings.

6. **Matrix-ready voice from day one.** Every modulation input in the SynthDef
   (pitch, PWM, VCF mod, VCA mod) is built as a summing point from Stage 1,
   even if only the normalled source is connected. Stage 4 then adds sources
   rather than rewriting the SynthDef.

7. **Shared effects, not per-voice.** Voices write to a dedicated FX bus; the
   spring reverb is one persistent synth reading it (or a SuperDirt global
   effect per orbit — decide in Stage 6). Voices never contain the reverb.

8. **One source of truth for parameters:** `docs/params.md`. Any new or renamed
   parameter must be updated there, in `tidal/params.hs`, in
   `strudel/params.js`, and in the UI in the same change.

## 3. Tech stack

- SuperCollider + SuperDirt (sound engine); sc3-plugins allowed if needed
- TidalCycles (Haskell) for pattern control
- Strudel (browser) for pattern control via OSC
- Node.js relay (UI ⇄ OSC), using a standard OSC library + `ws`
- Plain HTML / CSS / JavaScript for the UI (no framework unless agreed)
- VS Code extension (TypeScript) with a webview reusing the UI code (stretch goal)
- Git for version control; commit after each working step

## 4. Folder structure

```
/sc
  startup.scd          # loads SuperDirt, buses, synthdefs, utilities
  buses.scd            # control buses for panel state + OSCdefs + state snapshot
  synthdefs/           # one file per voice/module group
  utilities/           # persistent synths: env follower, preamp, reverb, mono voice
  tests/               # standalone test scripts per module
/tidal
  params.hs            # custom param definitions for BootTidal
  examples.tidal       # demo and test patterns
/strudel
  params.js            # custom controls for Strudel
  examples.js
/relay
  index.js
  package.json
/ui
  index.html
  ui.js
  style.css
/presets               # JSON panel states (also used as sound checks)
/analysis              # Python helpers: osc_ping.py, recording comparison (Stage 6)
requirements.txt       # Python deps for /analysis (venv in .venv/, git-ignored)
/vscode-ext            # Stage 9 (stretch)
/docs
  params.md            # single source of truth for all parameters
  normalling.md        # default routing table
  references/          # manual notes, schematic notes, reference recordings
  listening-notes.md   # user's listening feedback, dated
CLAUDE.md
```

## 5. SuperDirt conventions (important)

- SynthDef args must include `out`, `pan`, `freq`, `sustain`.
- Output with `OffsetOut.ar(out, DirtPan.ar(sig, ~dirt.numChannels, pan))`.
- Every event synth must free itself (`doneAction: 2`).
- **Gate vs. `sustain` (verified in SuperDirt source, confirm by ear in Stage 0).**
  SuperDirt adds a `dirt_gate` synth to every event (`synths/core-synths.scd`)
  that frees the whole event group at `sustain + fadeTime` (`doneAction: 14`),
  so any release running past `sustain` is cut. `~sustain` is read with
  `.value` in `DirtEvent.calcTimeSpan`, and the sound-library event is the
  event's `proto`, so a function there acts as a default the pattern can override.
  **Strategy:** each synth is registered with `~dirt.soundLibrary.addSynth`
  and a `sustain` function = note length (`delta * legato`) + release time.
  Inside the SynthDef the gate is open for `sustain - release`, so the whole
  envelope fits inside `sustain`. If a pattern sets `sustain` explicitly, it
  is treated as the total length including the release.
- `n` works as pitch for our synths (`~midinote = ~note ? ~n + (~octave * 12)`
  in the orbit's parent event), same as `note`.
- **Avoid reserved names.** Names like `cutoff`, `resonance`, `attack`,
  `release`, `hold`, `gain`, `speed`, `room`, `octave`, `legato` trigger
  SuperDirt's built-in effects or behaviours. Also avoid names that shadow
  **Tidal functions** (e.g. `spread`, `range`, `every`) or **Strudel built-in
  controls**. All synth params use module prefixes (see Section 6). Check every
  new name against all three before using it.
- Custom params must be declared for Tidal (e.g. `let vcfcut = pF "vcfcut"`)
  in `tidal/params.hs`, and for Strudel in `strudel/params.js` (confirm the
  current Strudel API for custom controls before writing it).

## 6. Module reference

Ranges and defaults are **starting points**, to be calibrated against reference
recordings in Stage 6. Keep parameter names short and Tidal-friendly.

### 6.1 VCO 1
| Param | Range | Default | Description |
|---|---|---|---|
| `o1wave` | 0–1 | 0 | Crossfade saw → square |
| `o1lvl` | 0–1 | 0.7 | Level into the mixer |
| `o1oct` | -3–3 | 0 | Coarse tune in octaves (continuous, like the original's coarse knob) |
| `o1fine` | -1–1 | 0 | Fine tune (semitones) |
| `o1lf` | 0/1 | 0 | Low-frequency mode (acts as LFO) |
| `o1lfrate` | 0.01–30 Hz | 2 | Rate when in LF mode |

### 6.2 VCO 2
| Param | Range | Default | Description |
|---|---|---|---|
| `o2wave` | 0–3 | 0 | Morph saw → pulse → triangle → sine |
| `o2lvl` | 0–1 | 0.7 | Level into the mixer |
| `o2oct` | -3–3 | 0 | Coarse tune in octaves (continuous) |
| `o2fine` | -1–1 | 0.05 | Fine tune (semitones) |
| `o2pw` | 0.05–0.95 | 0.5 | Pulse width |
| `o2pwm` | 0–1 | 0 | PWM depth (source normalled, see 6.14) |
| `o2sync` | 0/1 | 0 | Hard sync to VCO 1 |
| `o2fm` | 0–1 | 0 | FM depth from VCO 1 |

### 6.3 VCO 3
| Param | Range | Default | Description |
|---|---|---|---|
| `o3wave` | 0–1 | 0 | Crossfade saw → pulse |
| `o3lvl` | 0–1 | 0 | Level into the mixer |
| `o3oct` | -3–3 | -1 | Coarse tune in octaves (continuous) |
| `o3fine` | -1–1 | -0.05 | Fine tune (semitones) |
| `o3pw` | 0.05–0.95 | 0.5 | Pulse width |
| `o3pwm` | 0–1 | 0 | PWM depth (source: VCO 1) |
| `o3fm` | 0–1 | 0 | FM depth from VCO 2 |

### 6.4 Oscillator analog character (shared)
| Param | Range | Default | Description |
|---|---|---|---|
| `drift` | 0–1 | 0.15 | Slow random pitch drift per VCO |
| `vspread` | 0–1 | 0.1 | Per-voice random detune on each event (not `spread`: Tidal function) |

Implementation: band-limited oscillators only (`Saw`, `Pulse`, `VarSaw`,
`SinOsc`, or PolyBLEP if needed). Drift via very slow `LFNoise1`, independent
per VCO.

### 6.5 Noise generator
| Param | Range | Default | Description |
|---|---|---|---|
| `nzcol` | 0–1 | 0 | Colour: white → pink → dark (red) |
| `nzlvl` | 0–1 | 0 | Level into the mixer |

### 6.6 Ring modulator
| Param | Range | Default | Description |
|---|---|---|---|
| `rmlvl` | 0–1 | 0 | Level into the mixer |
| `rma` | enum | vco1 | Input A (normalled: VCO 1) — deferred to Stage 4 (patching) |
| `rmb` | enum | vco2 | Input B (normalled: VCO 2) |

### 6.7 VCF (filter)
| Param | Range | Default | Description |
|---|---|---|---|
| `vcfcut` | 20–18000 Hz | 2000 | Cutoff (exponential mapping in UI) |
| `vcfres` | 0–1.1 | 0.2 | Resonance; >1 allows self-oscillation |
| `vcfenv` | -1–1 | 0.4 | ADSR amount to cutoff |
| `vcfkey` | 0–1 | 0.5 | Keyboard tracking |
| `vcfmod` | 0–1 | 0 | Mod amount from routed source (6.14) |
| `vcfdrive` | 0–1 | 0.3 | Input drive / saturation |

Implementation: nonlinear saturation (`tanh`) inside the feedback path.
Start with a ladder model (e.g. `MoogFF` or sc3-plugins ladder filters);
compare alternatives in Stage 6.

### 6.8 VCA
| Param | Range | Default | Description |
|---|---|---|---|
| `vcalvl` | 0–1 | 0.8 | Output level |
| `vcaenv` | 0–1 | 1 | Envelope amount (normalled: AR) |
| `vcamod` | 0–1 | 0 | Mod amount from routed source |

### 6.9 ADSR envelope (normalled to the VCF)
| Param | Range | Default | Description |
|---|---|---|---|
| `eatk` | 0.001–10 s | 0.01 | Attack |
| `edec` | 0.001–10 s | 0.3 | Decay |
| `esus` | 0–1 | 0.6 | Sustain level |
| `erel` | 0.001–15 s | 0.4 | Release |
| `ecurve` | -8–8 | -4 | Curve (negative = capacitor-like) |

### 6.10 AR envelope (normalled to the VCA)
| Param | Range | Default | Description |
|---|---|---|---|
| `aratk` | 0.001–10 s | 0.005 | Attack |
| `arrel` | 0.001–15 s | 0.3 | Release |

### 6.11 Sample & hold
| Param | Range | Default | Description |
|---|---|---|---|
| `shrate` | 0.1–50 Hz | 6 | Internal clock rate |
| `shsrc` | 0–3 | 0 | Input: 0 noise (normalled), 1–3 VCO 1–3 |
| `shlag` | 0–1 | 0 | Smoothing via the lag processor |
Output available as a mod source (6.14).

### 6.12 Lag processor
| Param | Range | Default | Description |
|---|---|---|---|
| `lagtime` | 0–5 s | 0 | Smoothing time (input normalled to VCO 1's mod output; original's normalling unverified) |
| `glide` | 0–5 s | 0 | Portamento — deferred to Stage 5 (needs mono mode) |

### 6.13 Utilities (Stage 5)
- **Audio input preamp:** `inlvl`, `ingain`. External audio (cello, mic) via
  `SoundIn`, runs as a persistent synth writing to a bus.
- **Envelope follower:** `efatk`, `efrel`. Converts input amplitude to a
  control signal (mod source `envf`).
- **Electronic switch:** `swrate`, alternates between two sources.
- **Mixer / inverter:** combine and invert control signals.

### 6.14 Modulation routing (the "patch cords")
Sources: `vco1`, `vco2`, `vco3`, `noise`, `sh`, `adsr`, `ar`, `envf`, `rm`.
Destinations: pitch (all VCOs), `o2pwm`, `vcfmod`, `vcamod`.

Design: a fixed source × destination matrix with a depth parameter per
connection (e.g. `m_sh_pitch`, `m_vco3_vcf`). Several sources may feed one
destination (like the original's per-input attenuators). Normalled connections
have non-zero defaults; setting any depth overrides the default.
In the UI, each non-zero depth is also drawn as a cable (original visual style);
dragging a cable creates/removes the connection, its knob sets the depth.
Naming agreed 2026-09-23: `m_<source>_<dest>`; units per destination: pitch in
semitones, vcf in octaves (pw, vca to be defined in Stage 4). First cables
(`m_sh_pitch`, `m_sh_vcf`) added in Stage 3.

### 6.15 Spring reverb (Stage 6)
| Param | Range | Default | Description |
|---|---|---|---|
| `spmix` | 0–1 | 0.15 | Wet/dry |
| `spdecay` | 0–1 | 0.5 | Decay length |
| `sptone` | 0–1 | 0.5 | Brightness |
Implementation: convolution (`PartConv`) with a freely licensed or
self-recorded spring impulse response, or a dispersive allpass model.
Runs on the shared FX bus (Architecture decision 7), never per event.

## 7. Normalling (default routing)

Approximate; verify against the original owner's manual notes in
`docs/references/` and record the final table in `docs/normalling.md`.

| From | To | Default |
|---|---|---|
| Keyboard pitch | VCO 1, 2, 3 pitch | on |
| VCO 1, 2, 3, noise, ring mod | VCF input (via mixer levels) | on |
| VCF output | VCA input | on |
| ADSR | VCF cutoff | on (`vcfenv`) |
| AR | VCA gain | on (`vcaenv`) |
| VCO 1 / VCO 2 | Ring mod A / B | on |
| Noise | Sample & hold input | on |
| Sample & hold | available as mod source | off until routed |
| VCA output | Spring reverb (FX bus) | on (low `spmix`) |

## 8. Stages

Work on **one stage at a time**. A stage is done only when its "done when"
criteria pass and the user confirms the sound. Update the "Current stage"
line at the bottom of this file when moving on.

### Stage 0 — Project setup and risk checks
- Create the folder structure (Section 4), save this file as `CLAUDE.md`, init Git.
- `sc/startup.scd` loads SuperDirt and a simple test SynthDef.
- `tidal/params.hs` with a test param; one Tidal line plays the test synth.
- **Strudel smoke test:** `note("c3").s("test").<testparam>(…).osc()` via the
  Strudel OSC bridge reaches SuperDirt with the custom param intact.
- **Gate test:** a test synth with a long release — confirm whether SuperDirt
  cuts the tail at `sustain` (Section 5) and record the chosen gate strategy.
- **Done when:** Tidal and Strudel both play the test synth, a custom param
  changes it from each, and the gate behaviour is documented.

### Stage 1 — Single voice
- VCO 1–3 (6.1–6.4), mixer, VCF (6.7), VCA (6.8), ADSR (6.9), AR (6.10).
- Band-limited oscillators, tanh in the filter, drift, curved envelopes.
- Modulation inputs built as summing points (Architecture decision 6).
- Params declared in `params.md`, `params.hs`, `params.js`.
- Test patterns in `tidal/examples.tidal` covering each module.
- **Done when:** plays chords and melodies from Tidal; filter sweeps with high
  resonance sound smooth, no clicks or aliasing; user approves the tone.

### Stage 2 — Oscillator modulation
- VCO 1 LF mode, PWM on VCO 2/3, FM (VCO1→2, VCO2→3), hard sync.
- Filter keyboard tracking and envelope amount.
- **Done when:** classic sounds work (PWM pad, sync lead, FM bell) with test
  patterns for each, saved as presets in `/presets`.

### Stage 3 — Noise, ring mod, sample & hold, lag
- Noise with colour (6.5), ring mod (6.6), S&H with internal clock (6.11),
  lag processor (6.12).
- **Done when:** a stepped random "computer" sequence works from S&H; ring mod
  produces bell/robotic tones (incl. an R2-D2-style bleep preset); noise works
  as percussion and wind.

### Stage 4 — Patching system
- Agree on the matrix naming scheme with the user first.
- Implement the modulation matrix (6.14) with normalled defaults (Section 7).
- Control buses for panel state (Architecture decision 2).
- **Done when:** every normalled connection can be overridden from Tidal, and
  a zero-patch event still sounds correct.

### Stage 5 — Mono mode and utilities
- Persistent mono voice via custom SuperDirt `play` function, true glide.
- Audio input preamp, envelope follower, electronic switch, mixer/inverter
  (6.13) as persistent synths writing to buses.
- **Done when:** a live instrument (e.g. cello) through the envelope follower
  opens the filter in real time; glide works in mono mode; the same Tidal code
  plays in both modes.

### Stage 6 — Spring reverb and calibration
- Decide FX bus vs. SuperDirt global effect; implement spring reverb (6.15).
- Compare against reference recordings in `docs/references/`: raw waveforms,
  filter sweeps, resonance behaviour, envelope timings. Adjust ranges and
  curves; record findings in `docs/listening-notes.md`.
- **Done when:** the user judges each reference comparison close enough, and
  reverb tails survive note ends.

### Stage 7 — Web interface and relay
- Node relay: UI ⇄ OSC to sclang, broadcast to all panels, state snapshot on
  connect (Architecture decision 3).
- UI with sliders, switches, patch matrix + cable view for every param in
  `params.md`. Exponential mapping for frequency and time controls.
- Playable keyboard (mouse + computer keys) for testing without code.
- Original layout and visual design; must not copy the original panel.
- Presets: save/load panel state as JSON.
- **Done when:** moving any slider changes the sound live; patterns override
  panel values; presets round-trip; two open panels stay in sync; a reloaded
  panel shows current state.

### Stage 8 — Strudel integration
- Full custom controls in `strudel/params.js`; OSC to SuperDirt.
- Example patterns matching the Tidal examples.
- **Done when:** the same demo patterns play identically from Tidal and Strudel.

### Stage 9 — VS Code extension (stretch goal)
- Webview panel reusing `/ui` code; OSC sent from the extension host
  (removing the need for the separate relay inside VS Code).
- Commands: open panel, load preset, reset to default.
- **Done when:** Tidal code and the synth panel run side by side in one window.

### Stage 10 — Documentation and performance testing
- README with install, setup and quick-start for Tidal and Strudel.
- Parameter reference generated from `params.md`.
- A performance test: a full live session with no crashes, stuck notes or
  CPU overload; note CPU usage per voice.
- **Done when:** someone else can install and play it from the README alone.

## 9. Design constraints

- Do not use the ARP name, logo, or trademarks in code, UI, or docs
  (except factual historical references in documentation).
- Do not reproduce the original panel's layout or visual design. Functions
  and controls may match; the look must be original.
- Only use freely licensed or self-made audio (impulse responses, samples).

## 10. How to work with me (rules for Claude)

1. **Plan first.** For any task touching more than one file, explain the plan
   and wait for approval before writing code.
2. **One stage at a time.** Don't start work from a later stage without asking.
3. **I am the ears.** You can't hear the output. After each change, give me a
   specific test (a Tidal line or `.scd` snippet) and tell me what I should
   listen for. Ask for my listening notes before tuning further.
4. **Explain DSP choices** in code comments: why this UGen, this curve, this range.
5. **Keep parameters in sync** across `params.md`, `params.hs`, `params.js`,
   and the UI in the same change (Architecture decision 8).
6. **Check name clashes** (SuperDirt params, Tidal functions, Strudel controls)
   before adding any parameter (Section 5).
7. **Small, testable steps.** Build and test each module alone in `sc/tests/`
   before integrating.
8. **Say when something is uncertain** (e.g. exact original behaviour, a
   library's API) instead of guessing; suggest how to verify.
9. **Commit** with a clear message after each working step.
10. I may write in Portuguese or English; answer in the language I use.

## Verification (overall)
- Stage 0: Tidal and Strudel both reach SuperDirt with custom params; gate behaviour known.
- Each later stage: its "done when" list, plus the user's listening approval.
- End to end: boot `sc/startup.scd`, run `node relay/index.js`, open `ui/index.html`,
  play `d1 $ n "c e g" # s "scstd" # vcfcut 800` from Tidal and the same from
  Strudel; move panel sliders live; load a preset; route S&H → VCF and hear the
  stepped filter pattern; remove it and hear the normalled sound return.

## Current stage

**Stage 3 — Noise, ring mod, sample & hold, lag** (Stages 0–2 done 2026-09-23)
