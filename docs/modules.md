# The modules, explained for beginners

This synth is **modular**: it is built from small units ("modules") that each do one job, connected
by (virtual) cables. This page explains every module in plain words: what it is, what it sounds
like, what each knob does, and where to hear it.

- **Knob names** are what you type in Tidal (`# vcfcut 800`) or Strudel (`.vcfcut(800)`).
  In the web panel, hover a label to see its knob name.
- **"Hear it: #9"** means example 9 in `tidal/examples.tidal`. The same number exists in
  `strudel/examples.js`.
- The full list with exact ranges is in [`params.md`](params.md).
- The easiest way to learn: play a plain pattern and change **one** knob at a time.
  ```haskell
  d1 $ n "0 3 7 10" # s "scstd"
  ```
  Then add `# vcfcut 500`, then change the number, and so on. Or leave the pattern as it is and move
  sliders in the web panel.

---

## 1. The big idea: source → shaper → volume

Almost every synthesizer sound is made in three steps:

```
  SOURCE              SHAPER               VOLUME
  (makes a tone)  →   (changes its colour) →  (makes it start and stop)
  oscillators         filter               amplifier
  VCO 1, 2, 3, noise  VCF                  VCA
```

In this synth, without any cables, it is already wired like this (this pre-wiring is called
**normalling**):

```
 VCO 1 ─┐
 VCO 2 ─┤
 VCO 3 ─┼─► MIXER ─► FILTER (VCF) ─► AMPLIFIER (VCA) ─► spring reverb ─► speakers
 noise ─┤              ▲                  ▲
 ring  ─┘              │                  │
                   ADSR envelope      AR envelope
                   (moves the         (opens and closes
                    brightness)        the volume)
```

The keyboard (your notes, `n` or `note`) sets the pitch of all three VCOs.

**What "VC" means.** VCO = voltage-controlled oscillator, VCF = voltage-controlled filter,
VCA = voltage-controlled amplifier. On the 1970s hardware every knob and cable carried an
electrical **voltage**, so any module could control any other: an oscillator could move the
filter, an envelope could move the pitch. Here the voltages are numbers, and the cables are
parameters like `sh_vcf` (section 12). The idea is the same.

**Two kinds of signal:**
- **Audio signals** are fast vibrations you can hear (hundreds or thousands per second).
- **Control signals** are slow movements that turn knobs for you: an envelope, a slow wobble
  (LFO), a random step. You don't hear them directly; you hear what they move.

---

## 2. VCO: the oscillators (VCO 1, VCO 2, VCO 3)

**What it is.** An oscillator makes a tone by repeating a wave shape many times per second.
The speed of repetition is the **pitch**: 262 times per second (Hz) is middle C, and twice as fast
is one octave higher. The **shape** of the wave is the **timbre**, the colour of the sound.

**The wave shapes, from bright to soft:**

| Wave | Sounds like | Why |
|---|---|---|
| Saw (sawtooth) | bright, buzzy: strings, brass | contains every harmonic (overtone) |
| Square | hollow, woody: clarinet | only every other harmonic |
| Narrow pulse | thin, nasal, reedy | a square squeezed to one side |
| Triangle | soft, round: flute-like | few, weak harmonics |
| Sine | pure, smooth: a whistle | no harmonics at all |

**Why three?** Several oscillators slightly out of tune with each other make a thicker, moving
sound, like several violins playing the same note. By default VCO 1 and VCO 2 both play saws and
VCO 2 is a tiny bit higher (`o2fine 0.05`): that is the warm "buzzy" default sound.
VCO 3 is off (`o3lvl 0`) and tuned one octave down, ready to add weight.

**Knobs (x = 1, 2 or 3):**

| Knob | What it does |
|---|---|
| `o1wave` | VCO 1 shape: 0 saw → 1 square |
| `o2wave` | VCO 2 shape: 0 saw → 1 pulse → 2 triangle → 3 sine (in-between values blend) |
| `o3wave` | VCO 3 shape: 0 saw → 1 pulse |
| `oxlvl` | How loud this VCO is in the mix (0 = off) |
| `oxoct` | Tuning in octaves: 1 = one octave up, -1 = one down, 0.5 = half an octave |
| `oxfine` | Fine tuning in semitones: small values (0.05–0.2) make the slow "beating" |
| `o2pw`, `o3pw` | Pulse width: 0.5 = square, 0.1 = thin pulse (heard when the wave is a pulse) |
| `oxkbd` | 1 = follows your notes; 0 = stays on one fixed pitch (a drone) |

Hear it: **#3** (saw → square), **#4** (VCO 2 through all shapes), **#5** (pulse width),
**#6** (VCO 3 adds weight), **#7** (detune "chorus"), **#51** (VCO 1 as a drone).

### Oscillators that play with each other

These are the classic tricks where one oscillator changes another.

- **LFO mode (`o1lf 1`, `o1lfrate`)**. VCO 1 slows down below hearing (0.01–30 times per second)
  and becomes an **LFO** (low-frequency oscillator). You don't hear it as a tone. You use it to
  make things move: vibrato, wobbles, tremolo. Put `o1lvl 0` so you don't hear the slow wave itself.
  Hear it: **#19** (vibrato), **#20** (what it sounds like if you don't mute it).
- **PWM, pulse-width modulation (`o2pwm`, `o3pwm`)**. VCO 1 keeps changing the pulse width of
  VCO 2 or 3. The sound "breathes" and shimmers: the classic string-pad sound.
  Hear it: **#21**, **#22** (PWM pad).
- **Hard sync (`o2sync 1`)**. VCO 2 is forced to restart its wave every time VCO 1 starts a new
  one. You hear VCO 1's pitch, but moving VCO 2's tuning (`o2oct`) changes the *tone* in a tearing,
  vocal way: the classic "sync lead". Hear it: **#23**, **#24**, **#25**.
- **FM, frequency modulation (`o2fm`, `o3fm`)**. One oscillator wobbles the pitch of another.
  Slowly, that's vibrato. At audio speed it creates new tones: growls, metallic sounds, bells.
  `o2fm`: VCO 1 moves VCO 2. `o3fm`: VCO 2 moves VCO 3. Small numbers go a long way.
  Hear it: **#26** (0 → 0.6: pure → growl → metal → noise), **#27** (FM bell), **#28**.

---

## 3. Analog character (drift, spread)

Old analog oscillators are never perfectly in tune: they drift with temperature, and every note is
a little different. That imperfection is part of their warmth.

| Knob | What it does |
|---|---|
| `drift` | Each VCO slowly wanders in pitch (0 = perfect, 1 = unstable, like a cold old synth) |
| `vspread` | Every new note gets a small random detune (0 = all identical) |

Hear it: **#16** (perfect, then wobbly).

---

## 4. Mixer

**What it is.** The mixer adds all the sources together before the filter. Each source has its
own level knob: `o1lvl`, `o2lvl`, `o3lvl`, `nzlvl` (noise), `rmlvl` (ring mod), `swlvl`
(electronic switch), `inlvl` (microphone). A level of 0 removes that source from the sound.

A common trick: set a VCO's level to 0 but keep using it to *control* something (LFO, sync, FM).

---

## 5. Noise generator

**What it is.** Noise is a random signal with no pitch: the "shhhh" of wind, rain, the sea,
or a hi-hat. It is the raw material for percussion and weather sounds, and for randomness
(the sample & hold picks its random values from it).

| Knob | What it does |
|---|---|
| `nzlvl` | Noise level in the mix (0 = off) |
| `nzcol` | Colour: 0 white (bright hiss) → 0.5 pink (rain) → 1 brown (dark rumble) |

Hear it: **#30** (the three colours), **#31** (hi-hat and snare), **#32A** (wind).

---

## 6. Ring modulator

**What it is.** It multiplies two signals. Instead of the two original notes you hear their **sum
and difference** (e.g. 440 Hz × 100 Hz gives 540 Hz and 340 Hz). These new tones are usually
not in tune with each other, so the result sounds **metallic**: bells, robots, sci-fi.

| Knob | What it does |
|---|---|
| `rmlvl` | Ring modulator level in the mix |
| `rma`, `rmb` | Its two inputs: 0 VCO 1, 1 VCO 2, 2 VCO 3, 3 noise (default VCO 1 × VCO 2) |

Tip: change the tuning of one input (`o1oct`) to change the "bell" completely.
Hear it: **#33**, **#34A** (church bell), **#34B** (glass), **#50** (radio noise).

---

## 7. VCF: the filter

**What it is.** The filter shapes the colour of the sound. This one is a **low-pass** filter: it
lets low frequencies through and removes the high ones. Turning it down makes the sound darker,
warmer, muffled; turning it up makes it brighter. The famous "wow" and "pew" sounds are the filter
moving.

| Knob | What it does |
|---|---|
| `vcfcut` | **Cutoff**: where the filter starts cutting, in Hz. 200 = dark, 2000 = normal, 10000 = bright |
| `vcfres` | **Resonance**: boosts the frequencies right at the cutoff, giving a whistling, "squelchy" peak. Above 1 the filter **sings** on its own (self-oscillation), like a sine wave |
| `vcfenv` | How much the ADSR envelope moves the cutoff on each note (negative = moves it down) |
| `vcfkey` | **Key tracking**: 1 = the cutoff follows your notes, so high notes are as bright as low ones |
| `vcfdrive` | Pushes the sound into the filter harder: grittier, warmer, more "analog" |
| `vcfmodel` | Filter character: 0 = ladder (default, can sing), 1 = a different colour that cannot sing |

Hear it: **#8** (dark → bright sweep), **#9** (the same with resonance), **#10** (the filter
alone singing), **#11** (filter "pew" bass), **#12** (negative envelope), **#13** (drive),
**#17/18** (the two characters), **#29** (key tracking).

---

## 8. VCA: the amplifier

**What it is.** The amplifier controls **volume**. On its own an oscillator never stops. The VCA
is the door that opens when a note starts and closes when it ends. The AR envelope opens and
closes it (normalled).

| Knob | What it does |
|---|---|
| `vcalvl` | Overall output level |
| `vcaenv` | How much the AR envelope controls the volume. 0 = unplugged: the note is a flat drone |
| `vcainit` | The resting volume when the envelope is unplugged: 1 = open, 0 = closed (then only cables such as the microphone can open it) |

Hear it: **#52** (envelopes unplugged: organ-like), **#60** (your voice opens the VCA).

---

## 9. Envelopes: ADSR and AR

**What an envelope is.** An envelope is a shape that happens **once per note**: it rises when the
note starts and falls when it ends. It is a control signal that turns a knob for you on every
note. How a sound starts and ends matters as much as its tone: a piano is sharp and fading, a
violin swells, an organ is flat.

### ADSR (normalled to the filter)
Four stages:

```
level
  │   /\
  │  /  \_______        A = Attack:  how fast it rises when the note starts
  │ /           \       D = Decay:   how fast it falls to the sustain level
  │/             \      S = Sustain: the level it holds while the note is held
  └──A──D───S────R──    R = Release: how fast it fades after the note ends
```

| Knob | What it does |
|---|---|
| `eatk`, `edec`, `erel` | Attack, decay, release times in seconds |
| `esus` | Sustain level (0–1) |
| `ecurve` | Shape of the curves: negative = fast then slow, like real analog circuits |

By default the ADSR moves the **filter**. `vcfenv` sets how much. So a short decay with sustain 0
gives a "pluck" or "pew".

### AR (normalled to the VCA)
A simpler envelope: only **Attack** (`aratk`) and **Release** (`arrel`). It opens and closes the
volume. A long attack gives a slow swell (pads). A short attack and release give short, plucky
notes. A long release makes the note ring after you let go.

Hear it: **#11** (ADSR pluck), **#14** (AR slow swell vs pluck), **#15** (long release).

**Note length.** In Tidal/Strudel, `legato` sets how long the note is held (1 = until the next
note, 0.5 = half), and the release is added after that.

---

## 10. Sample & hold (S&H)

**What it is.** A clock ticks at a steady rate. On every tick the S&H "takes a picture" of its
input and **holds** that value until the next tick. With noise as the input (the default), it
produces a new **random value on every tick**: a staircase of random steps. Patched to the pitch,
this is the famous "computer thinking" sound of 1970s sci-fi; patched to the filter, it's
"bubbling".

| Knob | What it does |
|---|---|
| `shrate` | Clock speed: new values per second |
| `shsrc` | What it samples: 0 noise (random), 1–3 VCO 1–3 (repeating patterns), 4 the mixer/inverter |
| `shlag` | Smooths the steps into slides (0 = hard steps, 1 = continuous glides) |

The S&H does nothing on its own: you connect it with a **cable** (section 12), for example
`# sh_pitch 12` (random pitch, up to an octave) or `# sh_vcf 2` (random brightness).
Hear it: **#35** (random pitch), **#36** (with slides), **#37** (on the filter), **#38**
(staircase from a slow saw), **#39** (computer sequence).

---

## 11. Lag processor

**What it is.** A smoother. It makes sudden jumps in a control signal happen gradually, like a
heavy door that can't slam. Here it smooths VCO 1's modulation output, e.g. the sharp jump of a
saw-shaped LFO, so PWM and FM move in soft curves.

| Knob | What it does |
|---|---|
| `lagtime` | How long it takes to catch up (0 = no smoothing, in seconds) |
| `lagsrc` | Its input: 0 VCO 1, 1 the mixer/inverter |

Hear it: **#41**.

---

## 12. Patch cables: connecting anything to anything

**What it is.** On a semi-modular synth, cables let you break the normal wiring and send any
control signal to any destination. Here every cable is a knob named **`source_destination`**.
Its value is **how much** signal flows (0 = no cable, negative = upside down).

**Sources (where the movement comes from):**
`vco1` `vco2` `vco3` (oscillators, or VCO 1 as an LFO), `noise`, `sh` (sample & hold), `adsr`,
`ar` (envelopes), `rm` (ring mod), `envf` (the microphone's loudness), `mix` (mixer/inverter)

**Destinations (what it moves):**

| Destination | Moves | Unit of the amount |
|---|---|---|
| `pitch` | the pitch of all three VCOs | semitones (12 = one octave) |
| `vcf` | the filter cutoff | octaves |
| `pw` | the pulse width of VCO 2 and 3 | -1 … 1 |
| `vca` | the volume | -1 … 1 |

Examples: `# adsr_pitch 24` (each note swoops down two octaves: laser), `# vco1_vca (-0.6)`
(tremolo), `# noise_vcf 1.5` (gritty, breathy edge), `# sh_pw 0.9` (random tone colour).
Several cables into one destination add up. In the web panel you can drag cables or use the
matrix: it's the same knobs.

Hear it: **#43–#51**. The two pre-wired cables (ADSR → filter, AR → volume) are the knobs
`vcfenv` and `vcaenv`.

---

## 13. Mixer / inverter

**What it is.** A small mixer for **control signals** (not for sound): it blends two sources into
one new source called `mix`, and it can **invert** a source (turn it upside down) with a negative
level. Use it when one cable isn't enough: to combine two movements, or to reverse one.

| Knob | What it does |
|---|---|
| `mixa`, `mixb` | The two sources: 0 vco1, 1 vco2, 2 vco3, 3 noise, 4 sh, 5 adsr, 6 ar, 7 envf, 8 rm |
| `mixalvl`, `mixblvl` | Their levels: -1 … 1 (negative = inverted) |

Then patch `mix` with a cable (`mix_pitch`, `mix_vcf`…), or feed it to the S&H (`shsrc 4`) or the
lag (`lagsrc 1`). Hear it: **#63** (an upside-down envelope: notes rise instead of fall),
**#64** (a staircase with a bit of randomness).

---

## 14. Electronic switch

**What it is.** A switch that flips between two sound sources, back and forth, at a set speed.
Fast, between two pitches, that's a trill. Slow, it alternates two timbres.

| Knob | What it does |
|---|---|
| `swrate` | Flips per second |
| `swa`, `swb` | The two sources: 0 VCO 1, 1 VCO 2, 2 VCO 3, 3 noise, 4 microphone |
| `swlvl` | Switch output level in the mix |

Hear it: **#62** (trill).

---

## 15. Audio input and envelope follower (microphone, cello)

**What it is.** The synth can listen to the outside world through the computer's input
(the Mac's microphone by default). Two things happen:
- The **preamp** makes the input louder, so you can play it *through* the synth's filter
  (`inlvl`).
- The **envelope follower** measures how loud you are playing, moment by moment, and turns that
  into a control signal called `envf`. Patch it with a cable: louder playing can open the filter
  (`envf_vcf`), open the volume (`envf_vca`), bend the pitch… This is how a cello can play the synth.

| Knob | What it does |
|---|---|
| `ingain` | Microphone sensitivity (turn it down in loud rooms) |
| `inlvl` | The microphone's own sound in the mix (use **headphones**, or it howls) |
| `efatk` | How fast the follower reacts when you get louder |
| `efrel` | How fast it lets go when you get softer |

Hear it: **#59** (your sound opens the filter), **#59B** (sensitivity), **#60** (your sound gates
the synth), **#61** (your voice through the filter), **#70** (with the spring).
Different room each time? Save your microphone settings as a preset (panel: "mic settings only").

---

## 16. Mono mode and glide

**What it is.** Normally every note is its own little synth (**polyphonic**: chords work, each
note is independent). **Mono mode** (`monomode 1`) uses **one** voice that is always there, like
the original instrument's keyboard. That allows:
- **Glide / portamento** (`glide`, in seconds): the pitch slides from one note to the next.
- **Legato playing**: overlapping notes (`legato` above 1) don't restart the envelopes.
- Modulation that keeps running across notes (S&H, LFOs).

Each orbit has its own mono voice. In Tidal, `d1`, `d2`… are orbits 0, 1…, so each has its own.
In Strudel, labels don't choose an orbit: give each layer its own, e.g. `d2: ….orbit(1)`.
Hear it: **#54** (glide lead), **#55** (the same code
in both modes), **#56**, **#57**.

---

## 17. Spring reverb

**What it is.** A reverb makes a sound seem to be in a room: it adds echoes that fade out. A
**spring** reverb was the cheap way to do it in the 1970s: the sound is sent through metal
springs and picked up at the other end. Springs add their own character: a metallic "boing",
a "drip" on short sounds. It's the sound of guitar amps, dub and old synths. It is off by default.
There is one spring per orbit (Tidal: `d1` = orbit 0, `d2` = orbit 1…; Strudel: `.orbit(n)`).

| Knob | What it does |
|---|---|
| `spmix` | How much reverb (0 = off) |
| `spdecay` | How long the tail rings (0 short … 1 long, ~5 s) |
| `sptone` | Dark (0) or bright (1) reverb |

Hear it: **#65–#70**.

---

## 18. Small glossary

| Word | Meaning |
|---|---|
| Hz (hertz) | Times per second. 440 Hz = the note A above middle C |
| Octave | Double (or half) the frequency: the "same" note higher or lower |
| Semitone | One piano key; 12 semitones = one octave |
| Harmonics / overtones | Quieter higher tones inside every musical sound; their mix is the timbre |
| Timbre | The colour of a sound: what makes a flute and a violin different on the same note |
| Modulation | One signal changing a knob of another module |
| LFO | Low-frequency oscillator: a slow, repeating wobble used for modulation |
| Envelope | A shape that runs once per note (attack, decay, sustain, release) |
| Normalled | Pre-wired: the connection that exists when no cable is plugged in |
| Patch | A set of connections and knob settings; also "a sound" |
| Polyphonic / mono | Many notes at once / one note at a time |
| Self-oscillation | A resonant filter singing its own sine tone |
| Orbit | In SuperDirt: a separate channel with its own effects (Tidal: `d1` → 0, `d2` → 1…; Strudel: `.orbit(n)`) |
