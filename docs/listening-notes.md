# Listening notes

Dated feedback from listening tests. Newest first.
Format: date, stage, what was played (exact Tidal/Strudel line), what was heard, action.

## 2026-09-23 — Stage 0, SuperCollider side
- `sc/tests/gate_test.scd`, all lines, sent through SuperDirt from sclang.
- Heard: works (user confirmed), long release fades out without being cut.
- Action: gate strategy (sustain = note length + release) confirmed. Next: Tidal and Strudel tests.

<!-- Example:
## 2026-09-24 — Stage 0
- `d1 $ n "0 ~ 7 ~" # s "sctest" # tstrel 2 # legato 0.2`
- Heard: tail fades smoothly, no cut.
- Action: gate strategy confirmed.
-->
