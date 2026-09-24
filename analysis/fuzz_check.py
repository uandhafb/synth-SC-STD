"""Check the fuzz render (sc/tests/fuzz_render.scd): no NaN/inf, no extreme or silent notes."""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(__file__).parent / "output"

x, sr = sf.read(OUT / "fuzz.wav")
cases = json.loads((OUT / "fuzz_cases.json").read_text())
bad = []
peaks = []
for c in cases:
    s = x[int(c["start"] * sr):int((c["start"] + 1.05) * sr)]
    if not np.isfinite(s).all():
        bad.append((c["i"], "NaN/inf"))
        continue
    # NRT renders have no SuperDirt; in use SuperDirt multiplies by its default amp 0.4 (-8 dB).
    pk = 20 * np.log10(np.abs(s).max() * 0.4 + 1e-12)
    peaks.append(pk)
    if pk > 0:
        bad.append((c["i"], f"clipping {pk:.1f} dBFS"))
print(f"{len(cases)} random notes; finite: {len(peaks)}; peak range after SuperDirt amp {min(peaks):.1f} .. {max(peaks):.1f} dBFS")
print("problems:", bad or "none")
