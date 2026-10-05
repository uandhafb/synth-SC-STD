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
3. **Tidal** (Pulsar or VS Code, started from the `scstd` or `lc` setup; only one Tidal running):
   open `performance/arrival_times.tidal`, run block 0, then the sections in order.

## The data
| In Tidal | Meaning | 0 … 1 |
|---|---|---|
| `qmag` | magnitude of the last quake | M 2 … M 7 |
| `qdepth` | its depth | surface … 700 km |
| `qenergy` | activity now: jumps with each quake, fades in ~20 s | calm … very active |
| `qrate` | quakes in the last 30 s | none … 12 or more |
| `qlat`, `qlon` | where | south/west … north/east |

The rupture note: bigger = lower, longer, louder, more rumble; deeper = darker
(`ruptureNote` in `quake-relay.js`). Without internet the relay uses the last saved day
(`data/last_day.json`) or the sample (`data/sample_day.json`).

## Tests (no ears needed, they do not touch a running session)
```sh
node performance/test_relay.mjs          # the relay: timing, values, pause, new quakes, offline
sh performance/tests/rupture_test.sh     # the rupture sound through a private SuperDirt
sh performance/tests/piece_test.sh       # the real Tidal lines + relay + synth, recorded and checked
```

Data: U.S. Geological Survey earthquake feeds (public domain).
