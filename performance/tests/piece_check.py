"""Checks analysis/output/piece_probe.wav (from piece_test.sh): levels of the whole piece."""
from pathlib import Path
import numpy as np
import soundfile as sf

x, sr = sf.read(Path(__file__).resolve().parents[2] / "analysis/output/piece_probe.wav")
ok = True
def check(name, cond, info=""):
    global ok; ok &= bool(cond); print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f"  ({info})" if info else ""))
mono = x.mean(axis=1)
check("no NaN/inf", np.isfinite(x).all())
check("there is sound", np.sqrt(np.mean(mono ** 2)) > 1e-3)
print("level every 5 s (rms dBFS / peak dBFS):")
for i in range(0, int(len(mono) / sr), 5):
    seg = x[i * sr: (i + 5) * sr]
    if len(seg): print(f"  {i:3d} s  {20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12):6.1f}  {20 * np.log10(np.abs(seg).max() + 1e-12):6.1f}")
over = np.mean(np.abs(x) > 1.0) * 100
peak = 20 * np.log10(np.abs(x).max() + 1e-12)
check("all layers + ruptures together stay below full scale", over == 0, f"peak {peak:+.1f} dBFS, {over:.4f}% of samples over")
print("ALL PASS" if ok else "SOME CHECKS FAILED")
