"""Analyse sc/tests/mono_probe.scd: glide (A), retrigger (B), event-mode note after mono (C)."""

from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(__file__).parent / "output"
x, sr = sf.read(OUT / "mono_probe.wav")
x = x if x.ndim == 1 else x[:, 0]
start = np.where(np.abs(x) > 1e-4)[0][0] / sr   # first sound (probe start + latency)


def pitch(a, b, ref=261.6256):
    s = x[int(a * sr):int(b * sr)]
    spec = np.abs(np.fft.rfft(s * np.hanning(len(s)), 8 * len(s)))
    f = np.fft.rfftfreq(8 * len(s), 1 / sr)
    band = (f > ref / 3) & (f < ref * 5)
    return 12 * np.log2(f[band][np.argmax(spec[band])] / ref)


def rms(a, b):
    s = x[int(a * sr):int(b * sr)]
    return 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-12)


print(f"first sound at {start:.2f} s; NaN: {not np.isfinite(x).all()}")
t0 = start
print("A glide, pitch every 50 ms over 1.5 s (st):",
      " ".join(f"{pitch(t0 + i * 0.05, t0 + i * 0.05 + 0.05):+.0f}" for i in range(30)))
print("A level every 100 ms (dB, no dips expected):",
      " ".join(f"{rms(t0 + i * 0.1, t0 + i * 0.1 + 0.1):.0f}" for i in range(15)))
t1 = start + 2.5
print("B level every 50 ms over 2 s (dB, a dip before each new note expected):",
      " ".join(f"{rms(t1 + i * 0.05, t1 + i * 0.05 + 0.05):.0f}" for i in range(40)))
t2 = start + 5.5
print("C event-mode note level every 100 ms (dB):",
      " ".join(f"{rms(t2 + i * 0.1, t2 + i * 0.1 + 0.1):.0f}" for i in range(15)))
