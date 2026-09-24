# synth-SC-STD

A software semi-modular synthesizer modelled on the architecture of a classic
1970s analog synth, built in **SuperCollider** and played live from
**TidalCycles** and **Strudel**, with a web control panel.

It is being built for live coding performance and research on embodied
interaction, including acoustic instruments (e.g. cello) driving the synth
through an envelope follower.

> **Status: Stage 6 (spring reverb) waiting for listening; Stage 7 (web panel) built ahead.** Stages 1–5
> are done: full voice, 38 patch cables, panel memory, mono mode with glide, mic/instrument input.
> See [`CLAUDE.md`](CLAUDE.md) for the full design and the stage plan.

## Requirements

| Tool | Used for | Tested with |
|---|---|---|
| [SuperCollider](https://supercollider.github.io/) + sc3-plugins | Sound engine | 3.14.1 |
| [SuperDirt](https://github.com/musikinformatik/SuperDirt) quark | Receives Tidal/Strudel events | — |
| [TidalCycles](https://tidalcycles.org/) | Pattern control (Haskell) | 1.10.1 |
| [Strudel](https://strudel.cc/) + Node.js | Pattern control in the browser | — |
| Python 3 (optional) | OSC test script, analysis tools | 3.14 |

Install SuperDirt once from the SuperCollider IDE: `Quarks.install("SuperDirt")`, then recompile the class library.

## Setup

```sh
git clone https://github.com/uandhafb/synth-SC-STD.git
cd synth-SC-STD

# Optional Python tools (OSC test script, Stage 6 analysis)
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Quick start

### 1. Start the engine (SuperCollider)
Open `sc/startup.scd` in the SuperCollider IDE, click inside the outer parentheses and press
**Cmd+Enter**. Wait for `[synth] project ready on port 57120` in the post window.

Quick check without Tidal:
```sh
.venv/bin/python analysis/osc_ping.py
```

### 2. Play from TidalCycles
Open this folder in VS Code: the Tidal extension picks up the project's `BootTidal.hs`.
If you boot Tidal another way, add this line to your own `BootTidal.hs` (after the default setup):
```haskell
:script "/absolute/path/to/synth-SC-STD/tidal/params.hs"
```
Then evaluate:
```haskell
d1 $ n "0 3 7 10" # s "scstd" # vcfcut (range 200 3000 $ slow 4 sine) # vcfres 0.6
```
More in [`tidal/examples.tidal`](tidal/examples.tidal).

### 3. Play from Strudel
```sh
npx @strudel/osc     # bridge from the browser to SuperDirt
```
Open [strudel.cc](https://strudel.cc), paste [`strudel/params.js`](strudel/params.js), then:
```js
n("0 3 7 10").s("scstd").vcfcut(sine.range(200, 3000).slow(4)).vcfres(0.6).osc()
```

### 4. Web panel (optional)
A control panel in the browser: sliders for every setting, patch cables, a playable keyboard,
presets. It needs [Node.js](https://nodejs.org/) (tested with 24).

```sh
cd relay
npm install          # once
npm start            # = node index.js
```
Then open **http://localhost:8090** (keep SuperCollider running `sc/startup.scd`).

- Moving a slider changes the sound live, also for notes that are already playing.
- A value written in your Tidal/Strudel pattern always wins over the panel.
- Keyboard: click the keys, or use the computer keys A W S E D F T G Y H U J K (Z/X = octave).
- Several panels (tabs, devices on this computer) stay in sync; reloading shows the current state.
- The panel only listens on this computer (127.0.0.1).

## Project layout

```
sc/          SuperCollider: startup, synthdefs, utilities, per-module tests
tidal/       Tidal param definitions and example patterns
strudel/     Strudel controls and example patterns
relay/       Node relay between the web panel and SuperCollider
ui/          Web control panel (built from SuperCollider's parameter list)
presets/     Saved panel states (JSON)
analysis/    Python helpers: OSC test, recording comparison
docs/        Parameter reference, default routing, listening notes, references
CLAUDE.md    Design document and stage plan
```

## Parameters

All parameters are documented in [`docs/params.md`](docs/params.md).

## Legal

This is an independent project. It is not affiliated with or endorsed by any
synthesizer manufacturer, and it does not use their names, logos or panel designs.
Product names mentioned in the documentation are used only for historical reference.
