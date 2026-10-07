#!/bin/sh
# Plays every name of the vocabulary alone through a private, silent SuperDirt and measures it.
cd "$(dirname "$0")/../.." || exit 1
OUT=analysis/output
N=$(python3 performance/tests/vocab_blocks.py names | wc -w)
rm -f $OUT/rupture_ready.txt
PROBE_SECONDS=$((N * 13 + 14)) /Applications/SuperCollider.app/Contents/MacOS/sclang performance/tests/rupture_probe.scd > $OUT/vocab_sclang.log 2>&1 &
while [ ! -f $OUT/rupture_ready.txt ]; do sleep 0.5; done
python3 performance/tests/vocab_blocks.py solo | ghci -ignore-dot-ghci -v0 > $OUT/vocab_tidal.log 2>&1
wait
cp $OUT/rupture_probe.wav $OUT/vocab_probe.wav
grep -i -A4 "error" $OUT/vocab_tidal.log | head -20
grep -i "error\|exceeded\|late " $OUT/vocab_sclang.log | sort | uniq -c | head -5
.venv/bin/python performance/tests/vocab_check.py
