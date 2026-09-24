"""Stage 6 technical calibration checks (sc/tests/calib_render.scd)."""

from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import welch

OUT = Path(__file__).parent / "output"
SR = 48000


def load(name):
    x, _ = sf.read(OUT / f"{name}.wav")
    return x


# 1. Tuning
x = load("calib_tuning")
errs = []
for i in range(7):
    midi = 24 + 12 * i
    s = x[int((0.3 + i * 1.2) * SR):int((0.9 + i * 1.2) * SR)]
    spec = np.abs(np.fft.rfft(s * np.hanning(len(s)), 16 * len(s)))
    f = np.fft.rfftfreq(16 * len(s), 1 / SR)
    f0 = 440 * 2 ** ((midi - 69) / 12)
    band = (f > f0 * 0.8) & (f < f0 * 1.25)
    errs.append(1200 * np.log2(f[band][np.argmax(spec[band])] / f0))
print("1. VCO 2 tuning error C1..C7 (cents):", " ".join(f"{e:+.1f}" for e in errs))

# 2. Filter slope (dB per octave between 2 and 8 kHz, cutoff 1 kHz)
x = load("calib_slope")
for name, a in (("MoogLadder", 0.5), ("MoogFF", 4.0)):
    s = x[int(a * SR):int((a + 2.5) * SR)]
    f, p = welch(s, fs=SR, nperseg=8192)
    db = 10 * np.log10(p + 1e-30)
    l2, l8 = db[np.argmin(abs(f - 2000))], db[np.argmin(abs(f - 8000))]
    print(f"2. {name} slope above cutoff: {(l8 - l2) / 2:.1f} dB/octave (4-pole target: -24)")

# 3. AR envelope timing (attack 1 s, gate 2 s, release 1 s)
x = load("calib_env")
w = int(0.01 * SR)
env = np.array([np.sqrt(np.mean(x[i:i + w] ** 2)) for i in range(0, len(x) - w, w)])
t = np.arange(len(env)) * 0.01
peak = env.max()
t_on = t[np.argmax(env > 0.001 * peak)]
t90 = t[np.argmax(env > 0.9 * peak)]
after = t > 2.2
t_rel = t[after][np.argmax(env[after] < 0.1 * peak)]
print(f"3. AR: start {t_on:.2f} s, reaches 90% at {t90 - t_on:.2f} s after start (attack 1 s), "
      f"falls to 10% {t_rel - (t_on + 2.0):.2f} s after gate off (release 1 s, curve -4)")

# 4. Keyboard tracking: -3 dB point for C4 vs C6 (expected ratio 4 = two octaves)
x = load("calib_key")
corners = []
for a in (0.3, 2.3):
    s = x[int(a * SR):int((a + 1.2) * SR)]
    f, p = welch(s, fs=SR, nperseg=8192)
    db = 10 * np.log10(p + 1e-30)
    ref = db[(f > 30) & (f < 60)].mean()
    corners.append(f[np.argmax((db < ref - 3) & (f > 60))])
print(f"4. key tracking (vcfkey 1): -3 dB at {corners[0]:.0f} Hz (C4) and {corners[1]:.0f} Hz (C6), "
      f"ratio {corners[1] / corners[0]:.2f} (expected 4.00)")
