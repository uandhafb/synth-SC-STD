"""Analyse the spring reverb render (sc/tests/spring_render.scd): decay time, stability, tone,
dispersion (a click should come out smeared into a chirp, not as clean repeats)."""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(__file__).parent / "output"
x, sr = sf.read(OUT / "spring.wav")
cases = json.loads((OUT / "spring_cases.json").read_text())
print(f"NaN: {not np.isfinite(x).all()}, overall peak {20*np.log10(np.abs(x).max()):.1f} dBFS")
for name, t in cases:
    s = x[int(t * sr):int((t + 5.6) * sr)]
    mono = s.mean(axis=1)
    w = int(0.02 * sr)
    env = np.array([np.sqrt(np.mean(mono[i:i + w] ** 2)) for i in range(0, len(mono) - w, w)])
    envdb = 20 * np.log10(env + 1e-12)
    peak = envdb.max()
    below = np.where(envdb < peak - 60)[0]
    t60 = below[below > envdb.argmax()][0] * 0.02 if len(below[below > envdb.argmax()]) else float("nan")
    spec = np.abs(np.fft.rfft(mono * np.hanning(len(mono)))) ** 2
    f = np.fft.rfftfreq(len(mono), 1 / sr)
    cent = (spec * f).sum() / spec.sum()
    corr = np.corrcoef(s[:, 0], s[:, 1])[0, 1]
    extra = ""
    if name.startswith("click"):
        # dispersion: time between first arrival of high (4-8 kHz) and low (200-800 Hz) energy
        from scipy.signal import butter, sosfilt
        hi = np.abs(sosfilt(butter(4, [4000, 8000], "bp", fs=sr, output="sos"), mono))
        lo = np.abs(sosfilt(butter(4, [200, 800], "bp", fs=sr, output="sos"), mono))
        n = int(0.12 * sr)
        extra = f", first echo arrival: 200-800 Hz at {lo[:n].argmax()/sr*1000:.1f} ms, 4-8 kHz at {hi[:n].argmax()/sr*1000:.1f} ms"
    print(f"{name:14s} peak {20*np.log10(np.abs(s).max()+1e-12):6.1f} dBFS, T60 ~{t60:4.2f} s, "
          f"brightness {cent:5.0f} Hz, L/R correlation {corr:.2f}{extra}")
