# Parameters (single source of truth)

Every parameter added or renamed here must also change in `tidal/params.hs`,
`strudel/params.js`, `sc/synthdefs/00_modules.scd` (`~scstdSpecs`) and the UI in the
same commit (CLAUDE.md, decision 8). Before adding a name, check it against SuperDirt
params, Tidal functions and Strudel controls (CLAUDE.md, Section 5).

Values outside the range are clipped inside the synth.
Parameters for later stages are listed in CLAUDE.md, Section 6; they move here when built.

## Sound `scstd` — Stages 1–2 (single voice + oscillator modulation)

### VCO 1
| Param | Range | Default | Description |
|---|---|---|---|
| `o1wave` | 0–1 | 0 | Crossfade saw → square |
| `o1lvl` | 0–1 | 0.7 | Level into the mixer |
| `o1oct` | -3–3 | 0 | Coarse tune in octaves (continuous: 1 = octave up, 0.5 = tritone up) |
| `o1fine` | -1–1 | 0 | Fine tune (semitones) |
| `o1lf` | 0/1 | 0 | Low-frequency mode: VCO 1 ignores the notes and runs at `o1lfrate` (an LFO). Still feeds the mixer: use `o1lvl 0` for a pure LFO |
| `o1lfrate` | 0.01–30 Hz | 2 | Rate in LF mode |

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

### Analog character
| Param | Range | Default | Description |
|---|---|---|---|
| `drift` | 0–1 | 0.15 | Slow random pitch wander per VCO (1 = ±25 cents) |
| `vspread` | 0–1 | 0.1 | Random detune per event (1 = ±10 cents) |

### VCF
| Param | Range | Default | Description |
|---|---|---|---|
| `vcfcut` | 20–18000 Hz | 2000 | Cutoff frequency |
| `vcfres` | 0–1.1 | 0.2 | Resonance; above 1 the filter self-oscillates (sings) |
| `vcfenv` | -1–1 | 0.4 | ADSR amount to cutoff (±1 = ±5 octaves) |
| `vcfkey` | 0–1 | 0.5 | Keyboard tracking: cutoff follows the note (1 = fully, relative to middle C) |
| `vcfdrive` | 0–1 | 0.3 | Input saturation (anti-aliased tanh, 1×–8× gain) |
| `vcfmodel` | 0/1 | 0 | Filter character: 0 = MoogLadder (default; self-oscillates), 1 = MoogFF (different colour; rings but does not self-oscillate) |

### VCA
| Param | Range | Default | Description |
|---|---|---|---|
| `vcalvl` | 0–1 | 0.8 | Output level |
| `vcaenv` | 0–1 | 1 | AR envelope amount (0 = always open, a drone for the note's length) |

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

## Standard SuperDirt params we rely on

| Param | Notes |
|---|---|
| `n` / `note` | Pitch in semitones (0 = middle C, 261.6 Hz, with the default `octave 5`) |
| `legato` | Gate length as a fraction of the event; the release is added after it |
| `sustain` | If set by the pattern: total length **including** release |
| `pan`, `orbit` | Standard SuperDirt behaviour |
