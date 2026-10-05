#!/bin/sh
# End-to-end test of the piece without ears: a private Tidal plays the real lines of
# arrival_times.tidal (first version of d1..d5), the real relay feeds a 40 s replay + a big quake,
# and a private, silent SuperDirt records it. Does not touch a running SuperCollider or Tidal.
cd "$(dirname "$0")/../.." || exit 1
OUT=analysis/output
rm -f $OUT/rupture_ready.txt
PROBE_SECONDS=66 /Applications/SuperCollider.app/Contents/MacOS/sclang performance/tests/rupture_probe.scd > $OUT/piece_sclang.log 2>&1 &
while [ ! -f $OUT/rupture_ready.txt ]; do sleep 0.5; done
python3 performance/tests/piece_blocks.py 60 | ghci -ignore-dot-ghci -v0 > $OUT/piece_tidal.log 2>&1 &
sleep 4
node performance/tests/piece_relay.mjs > $OUT/piece_relay.log 2>&1
wait
cp $OUT/rupture_probe.wav $OUT/piece_probe.wav
echo "--- Tidal errors:"; grep -i -B2 -A6 "error" $OUT/piece_tidal.log | head -30
echo "--- SuperCollider errors / late messages:"; grep -i "error\|late \|exceeded" $OUT/piece_sclang.log | sort | uniq -c | head -8
echo "--- relay:"; grep -c "M " $OUT/piece_relay.log
.venv/bin/python performance/tests/piece_check.py
