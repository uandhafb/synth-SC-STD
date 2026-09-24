# Parameters (single source of truth)

Every parameter added or renamed here must also change in `tidal/params.hs`,
`strudel/params.js`, `sc/synthdefs/00_modules.scd` (`~scstdSpecs`) and the UI in the
same commit (CLAUDE.md, decision 8). Before adding a name, check it against SuperDirt
params, Tidal functions and Strudel controls (CLAUDE.md, Section 5).

Values outside the range are clipped inside the synth.

**Panel values (Stage 4):** every parameter also has a stored panel value (sc/buses.scd). If a pattern
sends a parameter, the pattern wins; if not, the panel value is used, and changing it affects notes
that are already sounding. From SuperCollider: `~scstdSet.(\vcfcut, 500)`, `~scstdReset.()`,
`~scstdLoadPreset.("wind")`.
Parameters for later stages are listed in CLAUDE.md, Section 6; they move here when built.

## Sound `scstd` — Stages 1–6

### VCO 1
| Param | Range | Default | Description |
|---|---|---|---|
| `o1wave` | 0–1 | 0 | Crossfade saw → square |
| `o1lvl` | 0–1 | 0.7 | Level into the mixer |
| `o1oct` | -3–3 | 0 | Coarse tune in octaves (continuous: 1 = octave up, 0.5 = tritone up) |
| `o1fine` | -1–1 | 0 | Fine tune (semitones) |
| `o1lf` | 0/1 | 0 | Low-frequency mode: VCO 1 ignores the notes and runs at `o1lfrate` (an LFO). Still feeds the mixer: use `o1lvl 0` for a pure LFO |
| `o1lfrate` | 0.01–30 Hz | 2 | Rate in LF mode |
| `o1kbd` | 0/1 | 1 | Keyboard on/off: 0 = VCO 1 stays at a fixed pitch around middle C (drones, fixed modulator) |

### VCO 2
| Param | Range | Default | Description |
|---|---|---|---|
| `o2wave` | 0–3 | 0 | Morph saw (0) → pulse (1) → triangle (2) → sine (3) |
| `o2lvl` | 0–1 | 0.7 | Level into the mixer |
| `o2oct` | -3–3 | 0 | Coarse tune in octaves (continuous) |
| `o2fine` | -1–1 | 0.05 | Fine tune (semitones) |
| `o2pw` | 0.05–0.95 | 0.5 | Pulse width (heard when `o2wave` is near 1) |
| `o2pwm` | 0–1 | 0 | Pulse-width modulation from VCO 1 (1 = ±0.45 around `o2pw`) |
| `o2sync` | 0/1 | 0 | Hard sync to VCO 1 (alias-reduced; tune VCO 2 higher with `o2oct` for the classic sweep) |
| `o2fm` | 0–1 | 0 | Exponential FM from VCO 1 (1 = ±36 semitones) |
| `o2kbd` | 0/1 | 1 | Keyboard on/off (see `o1kbd`) |

### VCO 3
| Param | Range | Default | Description |
|---|---|---|---|
| `o3wave` | 0–1 | 0 | Crossfade saw → pulse |
| `o3lvl` | 0–1 | 0 | Level into the mixer (off by default) |
| `o3oct` | -3–3 | -1 | Coarse tune in octaves (continuous) |
| `o3fine` | -1–1 | -0.05 | Fine tune (semitones) |
| `o3pw` | 0.05–0.95 | 0.5 | Pulse width |
| `o3pwm` | 0–1 | 0 | Pulse-width modulation from VCO 1 |
| `o3fm` | 0–1 | 0 | Exponential FM from VCO 2 (1 = ±36 semitones) |
| `o3kbd` | 0/1 | 1 | Keyboard on/off (see `o1kbd`) |

### Analog character
| Param | Range | Default | Description |
|---|---|---|---|
| `drift` | 0–1 | 0.15 | Slow random pitch wander per VCO (1 = ±25 cents) |
| `vspread` | 0–1 | 0.1 | Random detune per event (1 = ±10 cents) |

### VCF
| Param | Range | Default | Description |
|---|---|---|---|
| `vcfcut` | 20–18000 Hz | 2000 | Cutoff (corner) frequency. Calibrated: both filter models now match it (MoogLadder within ~3% up to 2 kHz; its ceiling is a ~12.8 kHz corner, so use `vcfmodel 1` for fully open, very bright sounds). With `vcfres` > 1 the filter sings at this pitch (±0.6 semitones) |
| `vcfres` | 0–1.1 | 0.2 | Resonance; above 1 the filter self-oscillates (sings) |
| `vcfenv` | -1–1 | 0.4 | ADSR amount to cutoff (±1 = ±5 octaves) |
| `vcfkey` | 0–1 | 0.5 | Keyboard tracking: cutoff follows the note (1 = fully, relative to middle C) |
| `vcfdrive` | 0–1 | 0.3 | Input saturation (anti-aliased tanh, 1×–8× gain) |
| `vcfmodel` | 0/1 | 0 | Filter character: 0 = MoogLadder (default; self-oscillates), 1 = MoogFF (different colour; rings but does not self-oscillate) |

### Noise
| Param | Range | Default | Description |
|---|---|---|---|
| `nzcol` | 0–1 | 0 | Colour: 0 white (bright hiss), 0.5 pink, 1 brown/red (dark rumble); equal loudness |
| `nzlvl` | 0–1 | 0 | Level into the mixer |

### Ring modulator
| Param | Range | Default | Description |
|---|---|---|---|
| `rmlvl` | 0–1 | 0 | Ring mod level into the mixer (metallic, bell, robot tones) |
| `rma` | 0–3 | 0 | Input A: 0 VCO 1, 1 VCO 2, 2 VCO 3, 3 noise |
| `rmb` | 0–3 | 1 | Input B: same choices (default VCO 2) |

### Sample & hold
| Param | Range | Default | Description |
|---|---|---|---|
| `shrate` | 0.1–50 Hz | 6 | Internal clock: new random value this many times per second |
| `shsrc` | 0–4 | 0 | Input: 0 noise (random steps), 1 VCO 1, 2 VCO 2, 3 VCO 3 (stepped patterns), 4 mixer/inverter |
| `shlag` | 0–1 | 0 | Smooths the steps (1 = glides all the way to the next value) |

In event mode each note restarts the S&H: play one long note to hear a sequence.

### Lag processor
| Param | Range | Default | Description |
|---|---|---|---|
| `lagtime` | 0–5 s | 0 | Smooths VCO 1's modulation output (PWM/FM). Turns the saw LFO's jump into a soft curve: smooth PWM pads |
| `lagsrc` | 0/1 | 0 | Lag processor input: 0 VCO 1 (normalled), 1 the mixer/inverter. The output drives the VCO 1 → PWM/FM paths (`o2pwm`, `o3pwm`, `o2fm`) |

### Mono mode
| Param | Range | Default | Description |
|---|---|---|---|
| `monomode` | 0/1 | 0 | 0 = one synth per note (polyphonic). 1 = one persistent voice per orbit (`d1`, `d2`…): notes glide, overlapping notes don't retrigger, S&H/LFOs keep running. Pattern or panel (`~scstdSet.(\monomode, 1)` switches existing patterns) |
| `glide` | 0–5 s | 0 | Portamento time in mono mode (constant time for any interval) |

### Audio input (preamp + envelope follower)
Input 1 of the computer (the Mac's built-in mic by default). **Use headphones when `inlvl` is up**, or the speakers feed back into the mic.

| Param | Range | Default | Description |
|---|---|---|---|
| `ingain` | 0–1 | 0.4 | Mic sensitivity (preamp gain 1×–100×, 0 to +40 dB); 0.4 ≈ 6× (default lowered from 0.5 after listening: "a little strong") |
| `inlvl` | 0–1 | 0 | The input's own sound into the mixer (e.g. the cello through the synth's filter) |
| `efatk` | 0.001–1 s | 0.01 | Envelope follower attack: how fast it follows louder playing |
| `efrel` | 0.01–5 s | 0.3 | Envelope follower release: how fast it lets go when you play softer / stop |

The envelope follower's output is the cable source `envf` (0 = silence … 1 = very loud).

### Electronic switch
| Param | Range | Default | Description |
|---|---|---|---|
| `swrate` | 0.1–50 Hz | 4 | Switching speed |
| `swa` | 0–4 | 1 | Input A: 0 VCO 1, 1 VCO 2, 2 VCO 3, 3 noise, 4 audio input |
| `swb` | 0–4 | 2 | Input B (same choices) |
| `swlvl` | 0–1 | 0 | Switch output into the mixer |

### Mixer / inverter
Combines two sources into the cable source `mix` (also usable as S&H input `shsrc 4` and lag input `lagsrc 1`).

| Param | Range | Default | Description |
|---|---|---|---|
| `mixa` | 0–8 | 0 | Source A: 0 vco1, 1 vco2, 2 vco3, 3 noise, 4 sh, 5 adsr, 6 ar, 7 envf, 8 rm |
| `mixb` | 0–8 | 4 | Source B (same choices) |
| `mixalvl` | -1–1 | 1 | Level of A (negative = inverted) |
| `mixblvl` | -1–1 | 1 | Level of B (negative = inverted) |

### Patch cables (`<source>_<destination>`)
Any source into any destination; several cables into one destination add up.
Units: **pitch** in semitones (all 3 VCOs), **vcf** in octaves (cutoff), **pw** −1…1 (= ±0.45 pulse
width, VCO 2 and 3), **vca** −1…1 (added to the volume). The normalled ADSR → filter and AR → VCA
cables are `vcfenv` and `vcaenv` (so there is no `adsr_vcf` / `ar_vca`).

| Param | Range | Default | Description |
|---|---|---|---|
| `vco1_pitch` | -48–48 | 0 | VCO 1 (full-scale wave; in LF mode an LFO) → pitch |
| `vco1_vcf` | -6–6 | 0 | VCO 1 (full-scale wave; in LF mode an LFO) → vcf |
| `vco1_pw` | -1–1 | 0 | VCO 1 (full-scale wave; in LF mode an LFO) → pw |
| `vco1_vca` | -1–1 | 0 | VCO 1 (full-scale wave; in LF mode an LFO) → vca |
| `vco2_pitch` | -48–48 | 0 | VCO 2 → pitch |
| `vco2_vcf` | -6–6 | 0 | VCO 2 → vcf |
| `vco2_pw` | -1–1 | 0 | VCO 2 → pw |
| `vco2_vca` | -1–1 | 0 | VCO 2 → vca |
| `vco3_pitch` | -48–48 | 0 | VCO 3 → pitch |
| `vco3_vcf` | -6–6 | 0 | VCO 3 → vcf |
| `vco3_pw` | -1–1 | 0 | VCO 3 → pw |
| `vco3_vca` | -1–1 | 0 | VCO 3 → vca |
| `noise_pitch` | -48–48 | 0 | noise → pitch |
| `noise_vcf` | -6–6 | 0 | noise → vcf |
| `noise_pw` | -1–1 | 0 | noise → pw |
| `noise_vca` | -1–1 | 0 | noise → vca |
| `sh_pitch` | -48–48 | 0 | sample & hold → pitch |
| `sh_vcf` | -6–6 | 0 | sample & hold → vcf |
| `sh_pw` | -1–1 | 0 | sample & hold → pw |
| `sh_vca` | -1–1 | 0 | sample & hold → vca |
| `adsr_pitch` | -48–48 | 0 | ADSR envelope (0..1) → pitch |
| `adsr_pw` | -1–1 | 0 | ADSR envelope (0..1) → pw |
| `adsr_vca` | -1–1 | 0 | ADSR envelope (0..1) → vca |
| `ar_pitch` | -48–48 | 0 | AR envelope (0..1) → pitch |
| `ar_vcf` | -6–6 | 0 | AR envelope (0..1) → vcf |
| `ar_pw` | -1–1 | 0 | AR envelope (0..1) → pw |
| `rm_pitch` | -48–48 | 0 | ring modulator → pitch |
| `rm_vcf` | -6–6 | 0 | ring modulator → vcf |
| `rm_pw` | -1–1 | 0 | ring modulator → pw |
| `rm_vca` | -1–1 | 0 | ring modulator → vca |
| `envf_pitch` | -48–48 | 0 | envelope follower (audio input loudness, 0..1) → pitch |
| `envf_vcf` | -6–6 | 0 | envelope follower → vcf |
| `envf_pw` | -1–1 | 0 | envelope follower → pw |
| `envf_vca` | -1–1 | 0 | envelope follower → vca |
| `mix_pitch` | -48–48 | 0 | mixer/inverter → pitch |
| `mix_vcf` | -6–6 | 0 | mixer/inverter → vcf |
| `mix_pw` | -1–1 | 0 | mixer/inverter → pw |
| `mix_vca` | -1–1 | 0 | mixer/inverter → vca |

### VCA
| Param | Range | Default | Description |
|---|---|---|---|
| `vcalvl` | 0–1 | 0.8 | Output level |
| `vcaenv` | 0–1 | 1 | AR envelope amount (0 = always open, a drone for the note's length) |
| `vcainit` | 0–1 | 1 | Resting gain when the envelope is unplugged (`vcaenv 0`): 1 = open (drone), 0 = closed, so only cables open the VCA (e.g. `envf_vca`: the synth sounds only while you play the instrument) |

### ADSR envelope (→ VCF)
| Param | Range | Default | Description |
|---|---|---|---|
| `eatk` | 0.001–10 s | 0.01 | Attack |
| `edec` | 0.001–10 s | 0.3 | Decay |
| `esus` | 0–1 | 0.6 | Sustain level |
| `erel` | 0.001–15 s | 0.4 | Release |
| `ecurve` | -8–8 | -4 | Curve (negative = capacitor-like) |

### AR envelope (→ VCA)
| Param | Range | Default | Description |
|---|---|---|---|
| `aratk` | 0.001–10 s | 0.005 | Attack |
| `arrel` | 0.001–15 s | 0.3 | Release |

### Spring reverb (Stage 6)
A SuperDirt global effect, one per orbit (`d1`, `d2`…), like Tidal's `room`. **Off by default.**
`scstd` notes carry the pattern's value, or else the panel's (`~scstdSet.(\spmix, 0.3)`).

| Param | Range | Default | Description |
|---|---|---|---|
| `spmix` | 0–1 | 0 | Amount of spring reverb (0 = off) |
| `spdecay` | 0–1 | 0.5 | Tail length: about 0.7 s (0) … 1.3 s (0.5) … 5 s (1) |
| `sptone` | 0–1 | 0.5 | Brightness of the reverb (lowpass inside the spring, 1–9 kHz) |

## Standard SuperDirt params we rely on

| Param | Notes |
|---|---|
| `n` / `note` | Pitch in semitones (0 = middle C, 261.6 Hz, with the default `octave 5`) |
| `legato` | Gate length as a fraction of the event; the release is added after it. Strudel sends it as `clip` (read the same way) |
| `sustain` | If set by the pattern: total length **including** release |
| `pan`, `orbit` | Standard SuperDirt behaviour. Tidal's `d1`, `d2`… use orbits 0, 1…; Strudel labels (`d1:`) all use orbit 0 unless `.orbit(n)` is set |
