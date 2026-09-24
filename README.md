# synth-SC-STD

A software semi-modular synthesizer modelled on the architecture of a classic 1970s analog synth,
built in **SuperCollider** and played live from **TidalCycles** and **Strudel**, with a web control
panel.

It was built for live coding performance and for research on live coding, embodied interaction and
performance with acoustic instruments: a cello (or any microphone) can play the synth through its
envelope follower.

> **Status: Stage 10 (documentation, performance test).** Stages 1–8 are done: full voice,
> 38 patch cables, panel memory, mono mode with glide, mic/instrument input, spring reverb, web
> panel, Strudel parity with Tidal. The VS Code extension (Stage 9) is future work.
> Design and stage plan: [`CLAUDE.md`](CLAUDE.md).

## What's inside

- **3 oscillators** (saw/square/pulse/triangle/sine, detune, LFO mode, PWM, hard sync, FM),
  **noise** (white → pink → brown), **ring modulator**
- **Resonant low-pass filter** that can self-oscillate (two characters), with drive, key tracking
  and an ADSR envelope; **amplifier** with an AR envelope
- **Sample & hold**, **lag processor**, **mixer/inverter**, **electronic switch**,
  **audio input + envelope follower** (microphone, cello)
- **38 patch cables** from code (`sh_vcf 2`) or dragged in the panel, with normalled defaults
- **Polyphonic** by default, **mono mode** with true glide
- **Spring reverb**, analog **drift**
- **Panel memory**: anything a pattern doesn't set comes from the panel, live
- **Web panel**: sliders, patch cables, playable keyboard, presets, several panels in sync
- **Tidal and Strudel play the same examples identically** (checked automatically)

New to synthesizers? Read [`docs/modules.md`](docs/modules.md): every module explained in plain words.

## Install

Tested on macOS (Apple Silicon) with the versions below. Linux and Windows should work (all the
tools exist there), but are untested.

| Tool | Needed for | Tested with |
|---|---|---|
| [SuperCollider](https://supercollider.github.io/downloads) | the sound engine | 3.14.1 |
| [sc3-plugins](https://github.com/supercollider/sc3-plugins/releases) | the default filter (`MoogLadder`) | — |
| [SuperDirt](https://github.com/musikinformatik/SuperDirt) | receives Tidal/Strudel events | 1.7.3 |
| [TidalCycles](https://tidalcycles.org/docs/) + an editor: [Pulsar](https://pulsar-edit.dev/) with the "tidalcycles" package, or [VS Code](https://code.visualstudio.com/) with the "TidalCycles" extension | playing from Tidal | Tidal 1.10.1, Pulsar package 4.1.3, VS Code extension 2.0.2 |
| [Node.js](https://nodejs.org/) | the web panel and the Strudel bridge | 24 |
| Python 3 (optional) | test and analysis scripts | 3.14 |

1. **SuperCollider**: install it from the link above.
2. **sc3-plugins**: download the release for your system, unzip it, and move the `SC3plugins`
   folder into SuperCollider's Extensions folder. To find that folder, run
   `Platform.userExtensionDir.postln` in SuperCollider (Shift+Enter) and read the post window.
3. **SuperDirt**: in SuperCollider run `Quarks.install("SuperDirt")`, then
   *Language → Recompile Class Library*.
4. **TidalCycles**: follow the official installation guide for your system
   ([tidalcycles.org](https://tidalcycles.org/docs/)); it installs Haskell and Tidal
   (`cabal install tidal --lib`). Then install an editor: Pulsar and its "tidalcycles" package
   (*Settings → Install*), or VS Code and its "TidalCycles" extension.
5. **Node.js**: install the LTS version from nodejs.org (for the panel and Strudel).
6. **This project**:
   ```sh
   git clone https://github.com/uandhafb/synth-SC-STD.git
   cd synth-SC-STD
   ```
   Optional, for the test scripts:
   ```sh
   python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
   cd analysis && npm install && cd ..
   ```

## Quick start

### 1. Start the synth (SuperCollider)
Open `sc/startup.scd` in SuperCollider, click inside the outer parentheses and press **Cmd+Enter**
(Ctrl+Enter on Linux/Windows). Wait for `[synth] project ready on port 57120` in the post window.

### 2. Play from TidalCycles (Pulsar or VS Code)
Open **this folder** in Pulsar or VS Code (*File → Open Folder*; in Pulsar it must be the first
project folder). Both editors then use the project's `BootTidal.hs`, which starts Tidal and adds the
synth's names, as long as no other boot file is set in the editor's settings (Pulsar: *Settings →
Packages → tidalcycles → Boot Tidal Path* empty; VS Code: `tidalcycles.bootTidalPath` empty).
Open `tidal/examples.tidal`, click on a line and press **Shift+Enter** (a block: Cmd+Enter in
Pulsar):
```haskell
d1 $ n "0 3 7 10" # s "scstd" # vcfcut (range 200 3000 $ slow 4 sine) # vcfres 0.6
```
`hush` stops. The file has 89 examples, each with a note on what to listen for.

*Already have your own Tidal setup* (your own `BootTidal.hs`, another editor, several setups)?
Keep it and add one line after it, in the boot file or even typed during a session:
`:script "/absolute/path/to/synth-SC-STD/tidal/params.hs"`. It only adds the synth's names, so it
combines with any setup (Link, editor highlighting, other synths).

*Tidal starts twice?* If your `~/.ghci` starts Tidal by itself, every editor starts it a second
time. Remove that line from `~/.ghci` and let the editor's boot file do it.

### 3. Play from Strudel
1. Keep SuperCollider running (step 1).
2. In a terminal, start the bridge from the browser to SuperDirt and leave it open:
   ```sh
   npx @strudel/osc
   ```
3. Open [strudel.cc](https://strudel.cc). Paste [`strudel/params.js`](strudel/params.js), then
   [`strudel/examples.js`](strudel/examples.js) below it.
4. Every example is muted (`_d1:`). Delete the `_` in front of one and press **Ctrl+Enter**.
   **Ctrl+.** stops. Or write your own:
   ```js
   d1: n("0 3 7 10").s("scstd").vcfcut(sine.range(200, 3000).slow(4)).vcfres(0.6).osc()
   ```
   Always end with `.osc()`, which sends the pattern to SuperCollider.

The Strudel examples have the same numbers as the Tidal ones and make the same notes. Good to know:
`examples.js` sets `setcps(0.575)` (Tidal's default tempo; Strudel's own is 0.5); Strudel sends
`.legato()` as `clip` (the synth reads both); Strudel labels all use orbit 0 (add `.orbit(1)` for a
separate layer); random patterns pick different values in Tidal and Strudel.

### 4. Web panel (optional)
```sh
cd relay
npm install          # once
npm start
```
Open **http://localhost:8090** (keep SuperCollider running).

- Moving a slider changes the sound live, also for notes that are already playing.
- A value written in your pattern always wins over the panel.
- Keyboard: click the keys, or use the computer keys A W S E D F T G Y H U J K (Z/X = octave).
- Presets: choose one and click **Load**; **Save** stores the current sound (or only the
  microphone settings, to adapt to a new room); **Reset** goes back to the defaults.
- Several panels (tabs) stay in sync; reloading shows the current state.
- The panel only listens on this computer (127.0.0.1).

### 5. Microphone or instrument
Examples 59–61 and 70: the input's loudness can open the filter or the volume, and the input can be
played through the filter. **Use headphones** when the input's own sound is up (`inlvl`), or the
speakers feed back into the microphone. The input is the computer's first audio input.

### 6. Your own extras (other synths, samples)
To load more things every time the synth starts (another SuperDirt synth, sample folders, MIDI
mappings), copy `sc/local.example.scd` to `sc/local.scd` and edit it. `startup.scd` loads it at the
end. It is not in git, so it can hold personal paths or code you may use but not publish.

## Documentation

| File | What it is |
|---|---|
| [`docs/guide.md`](docs/guide.md) | Playing guide: Tidal vs Strudel, panel vs pattern, cables, live changes |
| [`docs/modules.md`](docs/modules.md) | Every module explained for beginners, with examples to hear |
| [`docs/params.md`](docs/params.md) | All parameters: ranges, defaults, units (single source of truth) |
| [`docs/normalling.md`](docs/normalling.md) | The default connections |
| [`docs/references/calibration.md`](docs/references/calibration.md) | How the filter, envelopes and reverb were calibrated |
| [`docs/listening-notes.md`](docs/listening-notes.md) | Dated log of every listening test and decision |
| [`CLAUDE.md`](CLAUDE.md) | Design decisions and the stage plan |

## Performance

Measured on a MacBook (Apple Silicon); see `sc/tests/perf_*.scd` and `analysis/perf_check.py`.
- About **1–1.2% of one CPU core per voice** (default sound and "everything on" alike).
- A dense 3-minute session (4 layers, 44 notes per second, random settings on every note, panel
  changes 10 times per second): live CPU around 34% (peaks 50%), no late messages, no stuck notes.
- Many dense layers can add up above full scale; lower busy layers with `# gain 0.9`.

## Tests (for developers)

No ears needed; each prints PASS/FAIL. SuperCollider tests use their own private, silent server,
so they don't disturb a running session.

| Command | Checks |
|---|---|
| `.venv/bin/python analysis/check_params.py` | parameter names in sync everywhere; `BootTidal.hs` up to date |
| `sclang sc/tests/check_msgfunc.scd` | every parameter reaches the synth through SuperDirt |
| `node analysis/parity_check.mjs` | Tidal and Strudel examples make the same events |
| `sclang sc/tests/strudel_probe.scd`, then `analysis/strudel_check.py` | Strudel messages play like Tidal's |
| `sclang sc/tests/fuzz_render.scd`, then `analysis/fuzz_check.py` | random settings never give NaN or extreme levels |
| `sclang sc/tests/mono_probe.scd`, then `analysis/mono_check.py` | mono mode, glide, legato |
| `node analysis/ui_check.mjs`, `node analysis/ui_browser_check.mjs` | web panel and relay |
| `sclang sc/tests/perf_nrt.scd`, `sclang sc/tests/perf_probe.scd > analysis/output/perf_sclang.log`, then `analysis/perf_check.py` | CPU per voice, stress test |

(`sclang` = `/Applications/SuperCollider.app/Contents/MacOS/sclang` on macOS; Python scripts run
with `.venv/bin/python`.) After changing `tidal/params.hs`, run
`.venv/bin/python analysis/build_boot.py`.

## Project layout

```
sc/          SuperCollider: startup, synthdefs, panel buses, tests
tidal/       Tidal parameter definitions and examples
strudel/     Strudel parameter definitions and examples
relay/       Node relay between the web panel and SuperCollider
ui/          Web control panel (built from SuperCollider's parameter list)
presets/     Saved panel states (JSON)
analysis/    Test and analysis scripts (Python, Node)
docs/        Guides, parameter reference, calibration, listening notes
BootTidal.hs Tidal boot file for this project (generated by analysis/build_boot.py)
```

## License

Licensed under the **GNU General Public License v3.0 or later**; see [`LICENSE`](LICENSE).
You may use, study, change and share it; if you share a changed version, it must stay under the
same license.

This is an independent project. It is not affiliated with or endorsed by any synthesizer
manufacturer, and it does not use their names, logos or panel designs. Product names in the
documentation are used only for historical reference.
