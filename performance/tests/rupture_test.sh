#!/bin/sh
# Records and checks the rupture sound (no ears, does not touch a running SuperCollider).
cd "$(dirname "$0")/../.." || exit 1
rm -f analysis/output/rupture_ready.txt
PROBE_SECONDS=50 /Applications/SuperCollider.app/Contents/MacOS/sclang performance/tests/rupture_probe.scd > analysis/output/rupture_sclang.log 2>&1 &
while [ ! -f analysis/output/rupture_ready.txt ]; do sleep 0.5; done
node performance/tests/rupture_send.mjs
wait
grep -i "error\|late " analysis/output/rupture_sclang.log | head -5
.venv/bin/python performance/tests/rupture_check.py
