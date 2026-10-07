#!/bin/sh
# Arrival Times: start everything. Double-click this file in Finder (it opens in Terminal).
#   1. opens SuperCollider with the synth's startup file  -> YOU press Cmd+Enter there (once)
#   2. waits until the synth is ready
#   3. opens Pulsar with the piece, and the projection in the browser
#   4. runs the earthquake relay in THIS window (its keys work here: r l p t 1 2 3 o [ ] c q)
cd "$(dirname "$0")/.." || exit 1
clear
echo "ARRIVAL TIMES"
echo "============="
echo

if lsof -nP -iTCP:8095 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "The relay is already running in another window."
  echo "Use that window, or press q there and double-click this file again."
  echo; echo "(you can close this window)"; exit 0
fi

if lsof -nP -iUDP:57120 >/dev/null 2>&1; then
  echo "1. The synth is already running."
else
  open -a SuperCollider "sc/startup.scd"
  echo "1. SuperCollider is opening."
  echo "   >>> Click inside the code there and press Cmd+Enter. <<<"
  echo "   Waiting for the synth (READY TO CODESHAKE)..."
  n=0
  until lsof -nP -iUDP:57120 >/dev/null 2>&1; do
    sleep 1; n=$((n + 1))
    if [ $((n % 20)) -eq 0 ]; then echo "   ...still waiting. In SuperCollider: click in the code, Cmd+Enter."; fi
  done
  sleep 6      # the synth files load a few seconds after the port opens
  echo "   The synth is ready."
fi
echo

echo "2. Opening Pulsar with the piece."
open -a Pulsar "performance/arrival_times.tidal"
echo "3. Opening the projection (http://localhost:8095)."
(sleep 5; open "http://localhost:8095") &
echo
echo "4. Starting the earthquakes. Keys work in THIS window:"
echo "      r replay    l live    p pause    1 2 3 big quake    t test"
echo "      c QR code   o phones on/off   [ ] phones level   + - quake level   q quit"
echo
exec node performance/quake-relay.js
