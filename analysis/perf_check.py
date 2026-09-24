"""Stage 10: checks the performance test (sc/tests/perf_probe.scd, sc/tests/perf_nrt.scd).

Reads analysis/output/perf_log.csv, perf_voices.csv, perf_nrt.csv, perf_probe.wav and
perf_sclang.log (the probe's printout, if saved with: sclang ... > analysis/output/perf_sclang.log).
Run: .venv/bin/python analysis/perf_check.py
"""
import csv
import re
from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(__file__).parent / "output"
ok = True


def check(name, cond, info=""):
    global ok
    ok &= bool(cond)
    print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f"  ({info})" if info else ""))


rows = list(csv.DictReader(open(OUT / "perf_log.csv")))
avg = np.array([float(r["avg_cpu"]) for r in rows])
peak = np.array([float(r["peak_cpu"]) for r in rows])
synths = np.array([int(r["synths"]) for r in rows])
events = int(rows[-1]["events"])
print(f"Stress: {len(rows)} s, {events} events ({events / len(rows):.0f} per second), "
      f"synths {synths.min()}..{synths.max()}")
print(f"  live CPU avg: mean {avg.mean():.1f}%, max {avg.max():.1f}%;  peak: max {peak.max():.1f}%")
check("live CPU stays below 70% (headroom)", peak.max() < 70, f"max peak {peak.max():.1f}%")

if (OUT / "perf_nrt.csv").exists():
    for r in csv.DictReader(open(OUT / "perf_nrt.csv")):
        print(f"  offline: {r['sound']:8} x {r['voices']:>2} voices: "
              f"{float(r['percent_core_per_voice']):.2f}% of one core per voice")

log = (OUT / "perf_sclang.log").read_text() if (OUT / "perf_sclang.log").exists() else ""
late = len(re.findall(r"^late ", log, re.M))
check("no late messages from the server", late == 0, f"{late} late")
m = re.search(r"PERF after: synths (\d+) \(idle was (\d+)\), mono voices (\d+)", log)
if m:
    check("all notes ended (synth count back to idle)", m.group(1) == m.group(2), f"{m.group(1)} vs idle {m.group(2)}")
    check("mono voice released", m.group(3) == "0")
errors = [l for l in log.splitlines() if re.search(r"ERROR|FAILURE|exception", l)]
check("no errors in the SuperCollider printout", not errors, "; ".join(errors[:3]))

x, sr = sf.read(OUT / "perf_probe.wav")
check("audio has no NaN/inf", np.isfinite(x).all())
x = np.nan_to_num(x)
# Each voice is soft-limited (checked by fuzz_check.py), but this recording is the SUM of four dense
# layers (up to ~25 notes at once). Short overs there are mix level, not a synth fault: reported,
# and only a failure if clipping would be audible for long (> 0.01% of samples).
over = np.mean(np.abs(x) > 1.0) * 100
print(f"NOTE  mix of 4 dense layers: peak {20 * np.log10(np.abs(x).max()):+.1f} dBFS, "
      f"{over:.4f}% of samples above full scale (lower gain when stacking many layers)")
check("no sustained clipping in the mix", over < 0.01, f"{over:.4f}% of samples")
tail = x[-int(1.0 * sr):]
check("silence at the end (no stuck notes)", np.abs(tail).max() < 1e-4, f"last second peak {np.abs(tail).max():.2e}")
print("ALL PASS" if ok else "SOME CHECKS FAILED")
