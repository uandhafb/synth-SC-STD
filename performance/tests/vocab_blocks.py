"""Builds ghci input from performance/arrival_times.tidal (vocabulary / partitura / arranjo).
   python3 vocab_blocks.py check          -> type-check everything, count events
   python3 vocab_blocks.py names          -> list the vocabulary names
   python3 vocab_blocks.py solo <seconds> -> play each name alone (4 cycles + 1 of silence), private ports
   python3 vocab_blocks.py arranjo <seconds> -> play the arrangement from its start, private ports"""
import re, sys
from pathlib import Path
root = Path(__file__).resolve().parents[2]
text = (root / "performance/arrival_times.tidal").read_text()
paras = [p.strip("\n") for p in re.split(r"\n\s*\n", text)]
find = lambda start: next(p for p in paras if any(l.startswith(start) for l in p.split("\n")))
code = lambda p: "\n".join(l for l in p.split("\n") if not (l.startswith("--")))
vocab, arranjo, qdefs = find("let -- NUCLEO"), code(find("let arranjo")), code(find("let qmag"))
names = re.findall(r"^    (\w+) = ", vocab, re.M)
# the score with every line opened: "  -- , x" -> "  , x"; section-title lines dropped
part = code(find("d1 $ stack"))
part = "\n".join(re.sub(r"^(\s*)-- ,", r"\1,", l) for l in part.split("\n") if not re.match(r"^\s*-- ----", l))
head = [":set -XOverloadedStrings", "import Sound.Tidal.Context", f':script "{root}/tidal/params.hs"']
stream = ["tidal <- startStream (defaultConfig {cCtrlPort = 6021}) [(superdirtTarget {oPort = 57139, oLatency = 0.1}, [superdirtShape])]",
          "let setcps = streamOnce tidal . cps", "let hush = streamHush tidal", "let resetCycles = streamResetCycles tidal",
          "let d1 = streamReplace tidal 1 . (|< orbit 0)"]
blk = lambda s: [":{", s, ":}"]
mode = sys.argv[1]
if mode == "names":
    print(" ".join(names))
elif mode == "check":
    out = head + blk(qdefs) + blk(vocab) + blk(arranjo) + blk(part.replace("d1 $ stack", "partitura <- return $ stack", 1))
    out += [f'putStrLn ("{n}: " ++ show (length (queryArc {n} (Arc 0 8))) ++ " events in 8 cycles")' for n in names]
    out += ['putStrLn ("partitura (all lines open): " ++ show (length (queryArc partitura (Arc 0 8))) ++ " events in 8 cycles")',
            'putStrLn ("arranjo: " ++ show (length (queryArc arranjo (Arc 0 152))) ++ " events in 152 cycles")']
    print("\n".join(out + [":q"]))
elif mode == "solo":
    out = head + stream + blk("setcps 0.55") + blk(qdefs) + blk(vocab) + [":! sleep 2", "resetCycles"]
    for i, n in enumerate(names):
        out += [f"d1 $ seqP [(0, 4, {n})]" if False else f"d1 $ {n}", f":! sleep {4 / 0.55:.2f}", "d1 silence", f":! sleep {3 / 0.55:.2f}"]
    print("\n".join(out + [":q"]))
elif mode == "arranjo":
    out = head + stream + blk("setcps 0.55") + blk(qdefs) + blk(vocab) + blk(arranjo) + [":! sleep 2"] + blk("do resetCycles\n   d1 $ arranjo") + [f":! sleep {sys.argv[2]}", ":q"]
    print("\n".join(out))
