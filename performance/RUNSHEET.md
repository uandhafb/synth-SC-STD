# Arrival Times · run sheet

One page for the day. Print it or keep it open on your phone.

## Before leaving home

- [ ] Laptop charged, charger in the bag
- [ ] Adapter for the projector (HDMI), cable for the speakers
- [ ] Your phone charged: it is the backup internet (hotspot) and your test phone
- [ ] On the Mac: **Do Not Disturb** on, notifications off

## In the room (10 minutes before)

1. Plug in the **speakers** and the **projector** first. (SuperCollider uses the sound output that is
   selected when it starts.) Mac sound output = the room's speakers. Volume at half.
2. Connect to the **Wi-Fi**. If it is slow or blocked: turn on your phone's hotspot and join it.
3. Double-click **`Start Arrival Times`** (folder `ARP 2600/performance`).
4. In SuperCollider, which opens by itself: **click inside the code, Cmd+Enter.**
   Wait for `READY TO CODESHAKE`. Everything else opens by itself.

## Check four things

| Where | You should see |
|---|---|
| Terminal | `… earthquakes (M 2.5+, last 24 h) from USGS` · `the ground, live: Montréal` · `phones: connected to the broker, room XXXX` |
| Browser (projection) | the Wikipedia page on the left, the globe on the right, a line moving under the globe |
| Pulsar | run `setcps 0.55`, then `let qmag = …`, then the **VOCABULÁRIO** block. Bottom panel: `custom path configured`, `Connected to SuperDirt`, no red text |
| Sound | in the Terminal press **`t`**: one low thud from the speakers |

Screen: browser on top (press **`f`** in the page for full screen), Pulsar below or beside it.

## The piece (about 4½ minutes)

Keys are pressed in the **Terminal** window (click on it first). Code is run in **Pulsar**.

| Time | Section | You do | What happens |
|---|---|---|---|
| before | the invitation | Terminal: **`c`** | the QR code fills the screen. Say: *"Scan it, tap Join, volume up, silent switch off, put the phone on the table."* |
| 0:00 | o chão respira | Terminal: **`c`** (hide QR). Pulsar: run `let arranjo = …`, then `do resetCycles` / `d1 $ arranjo` | the hum, the wind, Montréal's ground (`chao`) |
| 0:29 | a falha | Terminal: **`r`** | the last 24 hours begin: quakes hit the synth, the page dances, the phones answer. The beat enters by itself |
| 1:27 | o enxame | (talk, or open lines in the partitura) | more layers, denser |
| 2:25 | a ruptura | Terminal: **`1`** … wait … **`2`** … wait … **`3`** | the three big real earthquakes. The beat stops, bells and pads |
| 3:02 | as réplicas | | the beat returns, heavier |
| 3:53 | agora | Terminal: **`l`** | live: only Montréal's ground and whatever the Earth does now |
| 4:36 | end | Pulsar: run `hush`. Terminal: **`p`** | silence (if you do nothing, the piece loops) |

To play by hand instead: in the **PARTITURA** block, remove the `--` from a line, Cmd+Enter. Running
`d1 $ stack […]` takes over from the arrangement; running `d1 $ arranjo` gives it back.

Other keys: **`o`** phones on/off · **`[`** **`]`** phones quieter/louder · **`+`** **`-`** earthquake hits
louder/quieter · **`m`** hits on/off · **`t`** test quake.

## If something goes wrong

| You see | Do this |
|---|---|
| No sound at all | Mac volume and output device. Then in SuperCollider: Cmd+Enter on `startup.scd` again |
| Earthquakes sound, Tidal does not | In Pulsar run the three first lines and the VOCABULÁRIO again |
| Red text `Variable not in scope: vcfcut…` | Tidal started without the synth's names: quit Pulsar (Cmd+Q), open it again |
| `That port isn't available` in Pulsar | two Tidals are running: quit Pulsar (Cmd+Q), open it again |
| Red text quoting a poetic line | that line lost its `--`: put it back |
| Tidal plays but the data does not move it | only one Tidal may run (see above); the relay must be running |
| The projection is empty | reload the page; check the relay is running in the Terminal |
| Phones do not join | they need internet (mobile data is fine). Laptop: check `phones: connected` in the Terminal. Otherwise: perform without phones |
| No internet at all | everything on the laptop still works from the saved copies (earthquakes, Wikipedia page). Only the phones and the live Montréal line are missing |
| It is too loud / crackles | Terminal: **`-`** a few times; Mac volume down |
| Total chaos | Pulsar: run `hush`. Terminal: **`p`**. Breathe. Start again from "o chão respira" |

## After

Terminal: **`q`**. Pulsar: `hush`. SuperCollider: Cmd+. then quit.

## What to say (one line each)

- **The data**: real earthquakes from the U.S. Geological Survey; the last 24 hours compressed into four
  minutes; the last section is the ground under Montréal, live, seven seconds ago (EarthScope).
- **The synth**: every sound from the speakers is the synthesizer built for this project, played from
  TidalCycles; each name in the code is one sound of it.
- **The mapping**: bigger earthquake = lower, longer, louder; deeper = darker; more activity = the music
  opens and gets denser.
- **The phones**: each one is a real seismic station; the earthquake reaches each station at its real
  time, first the P wave, then the S wave; some stations are in the shadow of the Earth's core.
- **The page**: a real Wikipedia page, choreographed by the earthquakes, with the movements written as
  code (after Joana Chicau's choreographic coding; the phones follow Gabriel Vigliensoni's ensemble).
