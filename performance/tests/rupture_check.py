"""Arrival Times: checks analysis/output/rupture_probe.wav (see rupture_test.sh)."""
from pathlib import Path
import numpy as np
import soundfile as sf

x, sr = sf.read(Path(__file__).resolve().parents[2] / "analysis/output/rupture_probe.wav")
mono = x.mean(axis=1)
ok = True
def check(name, cond, info=""):
    global ok; ok &= bool(cond); print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f"  ({info})" if info else ""))

# Find the first note (the probe starts recording a little before the sender starts).
env = np.sqrt(np.convolve(mono ** 2, np.ones(480) / 480, mode="same"))
t0 = np.argmax(env > env.max() * 0.02) / sr
names = ["small shallow (M3, 10 km)", "small deep (M3, 400 km)", "big shallow (M6.5, 10 km)", "big deep (M6.5, 400 km)"]
res = []
for i, name in enumerate(names):
    seg = mono[int((t0 + 10 * i) * sr): int((t0 + 10 * i + 9.5) * sr)]
    e = env[int((t0 + 10 * i) * sr): int((t0 + 10 * i + 9.5) * sr)]
    loud = np.nonzero(e > e.max() * 10 ** (-30 / 20))[0]
    length = (loud[-1] - loud[0]) / sr
    body = seg[int(0.3 * sr): int(max(0.6, min(length, 3)) * sr)]         # after the pitch drop
    spec = np.abs(np.fft.rfft(body * np.hanning(len(body)))); f = np.fft.rfftfreq(len(body), 1 / sr)
    centroid = (spec * f).sum() / spec.sum()
    # "Lower" = the frequency below which half of the sound's low/mid energy (25-1000 Hz) lies.
    lo = (f > 25) & (f < 1000); cum = np.cumsum(spec[lo] ** 2)
    pitch = f[lo][np.searchsorted(cum, cum[-1] / 2)]
    peak = 20 * np.log10(np.abs(seg).max() + 1e-12); rms = 20 * np.log10(np.sqrt(np.mean(seg[: int(length * sr) or 1] ** 2)) + 1e-12)
    res.append(dict(length=length, centroid=centroid, pitch=pitch, peak=peak, rms=rms))
    print(f"{name:28} length {length:4.1f} s  half the energy below {pitch:4.0f} Hz  brightness {centroid:5.0f} Hz  peak {peak:5.1f} dBFS  rms {rms:5.1f}")
check("no NaN/inf", np.isfinite(x).all())
check("big quakes last longer than small ones", res[2]["length"] > res[0]["length"] * 1.8, f"{res[0]['length']:.1f} s -> {res[2]['length']:.1f} s")
check("big quakes are lower", res[2]["pitch"] < res[0]["pitch"] * 0.9 and res[3]["pitch"] < res[1]["pitch"] * 0.9,
      f"half the energy below {res[0]['pitch']:.0f} -> {res[2]['pitch']:.0f} Hz (shallow), {res[1]['pitch']:.0f} -> {res[3]['pitch']:.0f} Hz (deep)")
check("big quakes are louder", res[2]["rms"] > res[0]["rms"], f"{res[0]['rms']:.1f} -> {res[2]['rms']:.1f} dB")
check("deep quakes are darker", res[1]["centroid"] < res[0]["centroid"] and res[3]["centroid"] < res[2]["centroid"],
      f"{res[0]['centroid']:.0f} -> {res[1]['centroid']:.0f} Hz; {res[2]['centroid']:.0f} -> {res[3]['centroid']:.0f} Hz")
burst = x[int((t0 + 40) * sr): int((t0 + 46) * sr)]
bp = 20 * np.log10(np.abs(burst).max() + 1e-12)
print(f"burst of 12 quakes in 2 s: peak {bp:.1f} dBFS")
check("a swarm of quakes does not clip", np.abs(x).max() < 1.0, f"overall peak {20 * np.log10(np.abs(x).max()):.1f} dBFS")
print("ALL PASS" if ok else "SOME CHECKS FAILED")
