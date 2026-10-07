"""Levels of each vocabulary sound played alone (analysis/output/vocab_probe.wav, from vocab_test.sh)."""
import subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf
root = Path(__file__).resolve().parents[2]
names = subprocess.run([sys.executable, str(root / "performance/tests/vocab_blocks.py"), "names"], capture_output=True, text=True).stdout.split()
x, sr = sf.read(root / "analysis/output/vocab_probe.wav")
mono = x.mean(axis=1)
env = np.sqrt(np.convolve(mono ** 2, np.ones(480) / 480, mode="same"))
t0 = np.argmax(env > 1e-3) / sr
slot, play = 7 / 0.55, 4 / 0.55
ok = np.isfinite(x).all()
print(f"{'name':12} {'rms dB':>7} {'peak dB':>8}   (each played alone for 4 cycles)")
for i, n in enumerate(names):
    seg = x[int((t0 + i * slot) * sr): int((t0 + i * slot + play + 1.5) * sr)]
    if not len(seg): print(f"{n:12} (not recorded)"); ok = False; continue
    rms = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12); peak = 20 * np.log10(np.abs(seg).max() + 1e-12)
    flag = "  <-- SILENT" if rms < -60 else "  <-- very quiet" if rms < -45 else "  <-- too hot" if peak > -2 else ""
    if "SILENT" in flag or "hot" in flag: ok = False
    print(f"{n:12} {rms:7.1f} {peak:8.1f}{flag}")
print("ALL PASS" if ok else "SOME SOUNDS NEED ATTENTION")
