"""Audio check for the web panel test (analysis/ui_check.mjs -> analysis/output/ui_probe.wav).

1st note: C4 from the on-screen keyboard, filter at 300 Hz, opened to 3000 Hz after ~1.2 s,
released after ~2.4 s. 2nd phrase: hold C4, press G4, release G4 (back to C4), release C4.
"""

from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(__file__).parent / "output"
x, sr = sf.read(OUT / "ui_probe.wav")
x = x if x.ndim == 1 else x[:, 0]
print(f"NaN: {not np.isfinite(x).all()}, length {len(x) / sr:.1f} s")
on = np.where(np.abs(x) > 1e-3)[0]
t0 = on[0] / sr
print(f"first note starts at {t0:.2f} s")


def seg(a, b):
    return x[int((t0 + a) * sr):int((t0 + b) * sr)]


def pitch(s, ref=261.6256):
    spec = np.abs(np.fft.rfft(s * np.hanning(len(s)), 8 * len(s)))
    f = np.fft.rfftfreq(8 * len(s), 1 / sr)
    band = (f > ref / 1.5) & (f < ref * 1.8)
    return f[band][np.argmax(spec[band])]


def centroid(s):
    spec = np.abs(np.fft.rfft(s * np.hanning(len(s)))) ** 2
    f = np.fft.rfftfreq(len(s), 1 / sr)
    return (spec * f).sum() / spec.sum()


def rms(s):
    return 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-12)


print(f"note 1 pitch {pitch(seg(0.2, 1.0)):.1f} Hz (C4 = 261.6)")
print(f"note 1 brightness: filter 300 Hz -> {centroid(seg(0.2, 1.0)):.0f} Hz, after panel change to 3000 Hz -> {centroid(seg(1.5, 2.2)):.0f} Hz")
print(f"level after release (+1.0 s): {rms(seg(3.4, 3.8)):.0f} dB (should be silent)")
t1 = 2.4 + 1.5   # second phrase
g4 = 392.0
print(f"phrase 2: C4 {pitch(seg(t1 + 0.2, t1 + 0.55)):.0f} Hz -> G4 {pitch(seg(t1 + 0.8, t1 + 1.15), g4):.0f} Hz -> back {pitch(seg(t1 + 1.4, t1 + 1.75)):.0f} Hz")
print(f"level after last release (+1.2 s): {rms(seg(t1 + 3.0, t1 + 3.4)):.0f} dB (should be silent: no stuck note)")
