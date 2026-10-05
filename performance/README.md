# Arrival Times

A piece for earthquakes, the `scstd` synth, TidalCycles and (soon) a room of phones.
Real earthquakes (USGS) play "rupture" notes on the synth and feed six numbers to Tidal, so the
live-coded patterns follow the Earth. This branch (`arrival-times`) only adds this folder; the
synth project itself is unchanged.

## Run it
1. **SuperCollider**: run `sc/startup.scd` (wait for "project ready").
2. **The relay**, in a terminal:
   ```sh
   cd "/path/to/synth-SC-STD"
   node performance/quake-relay.js
   ```
   Keys (click the terminal first): `t` test quake · `1 2 3` a big real quake · `r` replay the last
   24 h in 4 minutes · `l` live only · `p` pause · `+ -` rupture level · `m` rupture on/off · `q` quit.
3. **The projection**: open **http://localhost:8095** in a browser (press `f` for full screen).
   Left: today's Wikipedia "List of earthquakes in 2026", fetched when the relay starts; its words
   are moved by the earthquakes. Right: the globe, the P and S wave fronts, the station cities.
   Below: the score as code, each earthquake and the movements it calls.
4. **Tidal** (Pulsar or VS Code, started from the `scstd` or `lc` setup; only one Tidal running):
   open `performance/arrival_times.tidal`, run block 0, then the sections in order.

## The choreography
A small movement vocabulary for the words of a real page (`web/choreo.js`), after Joana Chicau's
choreographic coding: the page is a stage, its elements are the bodies, code is the score. The
verbs come from the performer's own MIDI web-choreography sketches:
`shake`, `wobble`, `float`, `stretch`, `tilt`, `bounce`, plus `breathing` (after Chicau) and `still`.
The earthquakes call them (magnitude → shake, wobble, stretch; longitude → tilt; depth → the page
sinks; M ≥ 5.5 → the table rows are thrown), and they can be typed in the browser console of the
page: `shake("Indonesia", 0.8)`, `bounce("rows", 0.6)`, `still()`.

## The phones
Each phone in the room is a real seismic station (`docs/quakes/`, published with GitHub Pages;
34 stations that stream live, listed in `docs/quakes/lib/geo.js`). People scan the QR code on the
projection (`c`), tap Join, and are dealt a station by the relay (the first phones are spread
around the globe). Then:
- every earthquake arrives as it would at that station: the **P wave** (a short knock), later the
  **S wave** (a longer rumble; Android phones vibrate), after the real travel time compressed into
  seconds (1 minute = 0.4 s); **nothing in the shadow zone** (104–140° away, hidden by the Earth's
  liquid core); only a faint late P on the far side;
- between earthquakes, very quietly, the **live ground of its own station**.
The sound is made in the phone's browser (noise and a tone). Messages travel through a public MQTT
broker (HiveMQ by default; `BROKER=wss://… node performance/quake-relay.js` for another), as in
Gabriel Vigliensoni's phase-study ensemble. Keys: `o` phones on/off, `[` `]` level, `c` QR code.
`PHONES=off` runs without them.

## The ground, live
`ground.js` receives the continuous signal of a real seismometer from EarthScope's real-time
server: station **CN.MNTQ in Montréal** (Canadian National Seismograph Network), vertical channel,
100 samples per second, about 2 s behind the ground (played 7 s late so it is smooth). A city never
rests, so this is the one source that is always alive. It reaches Tidal as `qground` (0..1: how much
the ground moves now, compared with the last minute) and the projection as the seismograph line.
`GROUND=off node performance/quake-relay.js` runs without it; without internet it is simply absent.

## The data
| In Tidal | Meaning | 0 … 1 |
|---|---|---|
| `qmag` | magnitude of the last quake | M 2 … M 7 |
| `qdepth` | its depth | surface … 700 km |
| `qenergy` | activity now: jumps with each quake, fades in ~20 s | calm … very active |
| `qrate` | quakes in the last 30 s | none … 12 or more |
| `qlat`, `qlon` | where | south/west … north/east |
| `qground` | the ground under Montréal, live | still … moving a lot |

The rupture note: bigger = lower, longer, louder, more rumble; deeper = darker
(`ruptureNote` in `quake-relay.js`). Without internet the relay uses the last saved day
(`data/last_day.json`) or the sample (`data/sample_day.json`).

## Tests (no ears needed, they do not touch a running session)
```sh
node performance/test_relay.mjs          # the relay: timing, values, pause, new quakes, offline
sh performance/tests/rupture_test.sh     # the rupture sound through a private SuperDirt
sh performance/tests/piece_test.sh       # the real Tidal lines + relay + synth, recorded and checked
node performance/tests/ground_test.mjs   # the live-seismometer decoder and signal (no network)
node performance/tests/mqtt_test.mjs     # the small MQTT client, against the public broker
node performance/tests/phones_test.mjs   # three phones in headless Chrome: dealing, arrivals, shadow zone, live ground
node performance/tests/stage_shots.mjs   # screenshots of the projection (analysis/output/stage_*.png)
```

Credits: earthquake data from the U.S. Geological Survey feeds (public domain); live ground motion
from the Canadian National Seismograph Network (station CN.MNTQ) through EarthScope; coastlines from
Natural Earth (public domain); the page that dances is Wikipedia's "List of earthquakes in 2026"
(CC BY-SA 4.0), fetched at start and not stored in this repository; the choreographic approach
follows Joana Chicau's work (e.g. "A WebPage in Three Acts"); the phones-as-ensemble design
(static page + MQTT broker + QR code) follows Gabriel Vigliensoni's phase-study (MIT); the QR code
is drawn with qrcode-generator by Kazuhiko Arase (MIT, `web/vendor/qrcode.js`); stations of the
Global Seismographic Network (IU, II) and the Canadian National Seismograph Network (CN).
