"""Stage 8: checks analysis/output/strudel_probe.wav (from sc/tests/strudel_probe.scd).

Eight notes, one every 2 s: Tidal-shaped (legato) and Strudel-shaped (clip) messages alternate,
legato/clip 0.3 and 1.5, in event mode and then in mono mode. Each Strudel note must last as long
as the Tidal note before it, and the lengths must follow the value (0.26 s vs 1.30 s).
Run: .venv/bin/python analysis/strudel_check.py
"""
from pathlib import Path

import numpy as np
import soundfile as sf

WAV = Path(__file__).parent / "output" / "strudel_probe.wav"
x, sr = sf.read(WAV)
win = int(0.005 * sr)
env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same"))

rows = [("event", "Tidal legato", 0.3), ("event", "Strudel clip", 0.3),
        ("event", "Tidal legato", 1.5), ("event", "Strudel clip", 1.5),
        ("mono", "Tidal legato", 0.3), ("mono", "Strudel clip", 0.3),
        ("mono", "Tidal legato", 1.5), ("mono", "Strudel clip", 1.5)]
lengths = []
for i, (mode, who, val) in enumerate(rows):
    seg = env[int((0.5 + 2 * i - 0.1) * sr): int((0.5 + 2 * i + 1.9) * sr)]
    loud = np.nonzero(seg > seg.max() * 10 ** (-30 / 20))[0]   # above -30 dB from the note's peak
    length = (loud[-1] - loud[0]) / sr if len(loud) else 0.0
    lengths.append(length)
    print(f"{mode:5} {who:13} {val}: {length:.3f} s (expected ~{val * 0.8696:.2f} s + release)")

ok = True
for i in range(0, 8, 2):
    diff = abs(lengths[i] - lengths[i + 1])
    same = diff < 0.02
    ok &= same
    print(f"{'PASS' if same else 'FAIL'}  {rows[i][0]} {rows[i][2]}: Strudel vs Tidal differ by {diff * 1000:.0f} ms")
for i in (0, 4):
    follows = lengths[i + 2] > lengths[i] + 0.8
    ok &= follows
    print(f"{'PASS' if follows else 'FAIL'}  {rows[i][0]}: 1.5 is longer than 0.3 ({lengths[i]:.2f} -> {lengths[i + 2]:.2f} s)")
print("ALL PASS" if ok else "SOME CHECKS FAILED")
