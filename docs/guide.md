# Playing guide: Tidal, Strudel and the panel

For the setup (installing, starting SuperCollider) see the [README](../README.md).
For what each module does, see [modules.md](modules.md).

## 1. One synth, three remote controls

```
Tidal (VS Code) ──┐
Strudel (browser) ┼──►  SuperCollider + SuperDirt (the synth)  ◄── web panel (sliders, cables, keyboard)
```

- **Tidal** and **Strudel** play notes and rhythms (patterns).
- **The panel** holds the settings, the knob positions.
- **SuperCollider must always be running** (`sc/startup.scd`).

## 2. Tidal and Strudel: the same music in two languages

| What | Tidal | Strudel |
|---|---|---|
| Play notes | `d1 $ n "0 3 7 10" # s "scstd"` | `d1: n("0 3 7 10").s("scstd").osc()` |
| Add a setting | `# vcfcut 800` | `.vcfcut(800)` |
| Negative number | `# vcfenv (-0.6)` | `.vcfenv(-0.6)` |
| A slow sweep | `# vcfcut (range 200 3000 $ slow 4 sine)` | `.vcfcut(sine.range(200, 3000).slow(4))` |
| One value per cycle | `# spmix "<0 0.5>"` | `.spmix("<0 0.5>")` |
| Shift in time | `0.37 <~ rand` | `rand.early(0.37)` |
| Slower | `slow 4 $ n "0"` | `n("0").slow(4)` |
| Second layer | `d2 $ …` | `d2: ….orbit(1).osc()` |
| Stop | `hush` | Ctrl + . |

The rule: Tidal's `# name value` becomes Strudel's `.name(value)`. Text inside quotes (mini-notation:
`"0 3 7"`, `"<0 1>"`, `"[0,4,7]"`, `"~"` for a rest) is the same in both.

**Connecting each one:**
- **Tidal:** open this folder in VS Code; the Tidal extension loads the project's `BootTidal.hs`,
  which starts Tidal and teaches it the synth's names. Evaluate a line with Shift+Enter.
- **Strudel:** start the bridge `npx @strudel/osc` in a terminal (leave it open), open strudel.cc,
  paste `strudel/params.js` first (it teaches Strudel the names), then your patterns. Always end a
  pattern with **`.osc()`**, which sends it to SuperCollider. Without it, Strudel plays its own
  browser sounds.

**Differences worth knowing:**
- **Tempo:** Tidal starts at 0.575 cycles per second, Strudel at 0.5. Put `setcps(0.575)` at the top
  in Strudel to match (the examples file does).
- **Labels:** in Strudel, `d1:` is a label, a name for a slot. Different labels play together, the
  same label replaces, `_d1:` is muted, and `$:` is an unnamed slot. Without any label, Strudel plays
  only the **last** pattern in the editor. In Tidal `d1` is a function (`d1 $ …`).
- **Orbits:** Tidal's `d1`, `d2`… use orbits 0, 1…, so each has its own reverb and mono voice.
  Strudel labels all use orbit 0; add `.orbit(1)`, `.orbit(2)`… to separate layers.
- **legato:** Strudel sends `.legato()` under the name `clip`; the synth understands both.
- **Randomness** (`rand`, `irand`, `degradeBy`) picks different values in Tidal and Strudel: the
  same style, different notes.

**Storing pieces with `let`:**
```js
let bass  = n("-24 -24 -12 -24").s("scstd").vcfcut(300)     // Strudel
d1: bass.osc()
```
```haskell
let bass = n "-24 -24 -12 -24" # s "scstd" # vcfcut 300    -- Tidal
d1 $ bass
```
`let` stores; `d1:` / `d1 $` plays.

## 3. Panel or pattern: who controls the sound?

> **If the pattern sets a value, the pattern wins. If it doesn't, the panel's value is used**,
> live, even for notes that are already sounding.

- `d1 $ n "0 3 7" # s "scstd"`: every slider in the panel changes the sound.
- `d1 $ n "0 3 7" # s "scstd" # vcfcut 800`: the cutoff slider does nothing for this pattern; all
  other sliders still work.

**If a slider seems to do nothing, check whether your pattern sets that knob.**

Ways to change the panel (they all stay in sync):
1. The web panel (`cd relay && npm start`, then http://localhost:8090): sliders, cables, presets,
   keyboard.
2. SuperCollider (type a line, Shift+Enter): `~scstdSet.(\vcfcut, 800);`,
   `~scstdLoadPreset.("wind");`, `~scstdReset.();`
3. Presets: files in `presets/`. Save your own from the panel ("save as…"), or only the microphone
   settings ("mic settings only") to adapt to a new room.

**A workflow for performing:** design a sound with the sliders → save it as a preset → play simple
patterns (`# s "scstd"` plus notes) → put in the pattern only what you want to *animate*
(e.g. a filter sweep), and leave the rest to the panel.

## 4. Patch cables from code

Every cable is a knob named **`source_destination`**; its value is how much signal flows
(0 = unplugged).

- Sources: `vco1` `vco2` `vco3` `noise` `sh` `adsr` `ar` `rm` `envf` `mix`
- Destinations: `pitch` (semitones), `vcf` (octaves), `pw` (-1…1), `vca` (-1…1)

```haskell
d1 $ n "0" # s "scstd" # legato 1 # sh_vcf 2                  -- S&H -> filter: bubbling
d1 $ n "0" # s "scstd" # legato 1 # sh_pitch 12 # shrate 8    -- S&H -> pitch: "computer"
d1 $ n "0" # s "scstd" # legato 1 # sh_vcf "<0 1 3>"          -- the cable amount changes per cycle
```
Strudel: `.sh_vcf(2)`. Cables drawn in the panel are the same knobs.
The two pre-wired cables are `vcfenv` (ADSR → filter) and `vcaenv` (AR → volume).

## 5. Changing things live

- Change a number and re-evaluate (Shift+Enter in Tidal, Ctrl+Enter in Strudel): the change
  arrives on the next cycle, without stopping.
- Values can move: `"<200 800 3000>"` (one per cycle), `"200 3000"` (two per cycle), `sine`,
  `saw`, `rand` (continuous).
- Exercise: start from `d1 $ n "0 3 7 10" # s "scstd"` and add, one at a time: `# vcfres 0.8`,
  `# vcfcut "<400 2000>"`, `# sh_vcf 1`, `# spmix 0.3`. Listen to what each one changes.

## 6. Levels

The synth is about as loud as SuperDirt's own sounds. Many dense layers at once can add up to more
than full scale (short crackles at the speakers): lower the level with `# gain 0.9` (Tidal) /
`.gain(0.9)` (Strudel) on busy layers, or `# vcalvl` for this synth only.
