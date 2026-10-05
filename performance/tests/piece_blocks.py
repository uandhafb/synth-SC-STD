"""Turns performance/arrival_times.tidal into a ghci script for piece_test.sh: a private Tidal
(SuperDirt on 57139, controls on 6021), the setup block, then the first version of d1..d5."""
import re, sys
from pathlib import Path
root = Path(__file__).resolve().parents[2]
blocks = [b.strip("\n") for b in re.split(r"\n\s*\n", (root / "performance/arrival_times.tidal").read_text())]
code = [b for b in blocks if not all(l.startswith("--") or not l.strip() for l in b.split("\n"))]
code = ["\n".join(l for l in b.split("\n") if not l.startswith("--")) for b in code]
out = [":set -XOverloadedStrings", "import Sound.Tidal.Context", f':script "{root}/tidal/params.hs"',
       "tidal <- startStream (defaultConfig {cCtrlPort = 6021}) [(superdirtTarget {oPort = 57139, oLatency = 0.1}, [superdirtShape])]",
       "let setcps = streamOnce tidal . cps",
       "let hush = streamHush tidal"]
out += [f"let d{i} = streamReplace tidal {i} . (|< orbit {i - 1})" for i in range(1, 9)]
seen = set()
for b in code:
    first = b.strip().split()[0]
    if first == "hush" or b.strip().endswith("silence"): continue
    if re.fullmatch(r"d\d", first):
        if first in seen: continue
        seen.add(first)
    out += [":{", b, ":}"]
out += [f":! sleep {sys.argv[1]}", ":q"]
print("\n".join(out))
