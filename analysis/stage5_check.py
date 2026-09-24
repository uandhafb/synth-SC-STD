"""Stage 5 offline checks (sc/tests/stage5_render.scd).

Usage:
    .venv/bin/python analysis/stage5_check.py --make-input     # writes analysis/output/cello_sim.wav
    /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/stage5_render.scd
    .venv/bin/python analysis/stage5_check.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

from stage1_check import db

OUT = Path(__file__).parent / "output"
SR = 48000


def make_input() -> None:
    """Synthetic bowed tone: every 4 s = quiet 1 s, loud 1 s, silent 2 s (12 s total)."""
    t = np.arange(int(SR * 12)) / SR
    f = 220 * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t))
    ph = np.cumsum(f) / SR
    tone = sum((1 / k) * np.sin(2 * np.pi * k * ph) for k in range(1, 12)) * 0.3
    cyc = t % 4
    amp = np.where(cyc < 1, 0.05, np.where(cyc < 2, 0.5, 0.0))
    k = int(0.04 * SR)
    amp = np.convolve(amp, np.ones(k) / k, mode="same")
    OUT.mkdir(exist_ok=True)
    sf.write(OUT / "cello_sim.wav", (tone * amp).astype(np.float32), SR, subtype="FLOAT")
    print("wrote", OUT / "cello_sim.wav")


def rms_db(x, a, b):
    s = x[int(a * SR):int(b * SR)]
    return db(np.sqrt(np.mean(s ** 2)))


def centroid(x, a, b):
    s = x[int(a * SR):int(b * SR)]
    spec = np.abs(np.fft.rfft(s * np.hanning(len(s)))) ** 2
    f = np.fft.rfftfreq(len(s), 1 / SR)
    return float((spec * f).sum() / (spec.sum() + 1e-20))


def pitch_steps(x, a, step, n, f_ref):
    out = []
    for i in range(n):
        s = x[int((a + i * step + step / 4) * SR):int((a + (i + 1) * step) * SR)]
        spec = np.abs(np.fft.rfft(s * np.hanning(len(s)), 8 * len(s)))
        f = np.fft.rfftfreq(8 * len(s), 1 / SR)
        band = (f > f_ref / 4) & (f < f_ref * 4)
        out.append(12 * np.log2(f[band][np.argmax(spec[band])] / f_ref))
    return out


def main() -> None:
    names = json.loads((OUT / "stage5_cases.json").read_text())
    # Input phases (render starts the note at 0.1 s; the input file starts at 0 s):
    # quiet 0-1, loud 1-2, silent 2-4, quiet 4-5, loud 5-6, silent 6-8 ...
    for name in names:
        x, _ = sf.read(OUT / f"stage5_{name}.wav")
        nan = not np.isfinite(x).all()
        line = f"{name:13s} NaN: {nan}, peak {db(np.abs(x).max()):.1f} dBFS; "
        if name == "envf_vcf":
            line += ("brightness quiet/loud/silent: "
                     f"{centroid(x, 4.3, 4.9):.0f} / {centroid(x, 5.3, 5.9):.0f} / {centroid(x, 6.8, 7.8):.0f} Hz")
        elif name in ("envf_vca", "input_thru"):
            line += ("level quiet/loud/silent: "
                     f"{rms_db(x, 4.3, 4.9):.0f} / {rms_db(x, 5.3, 5.9):.0f} / {rms_db(x, 6.8, 7.8):.0f} dB")
        elif name == "switch":
            st = pitch_steps(x, 0.1, 0.125, 12, 261.6256)
            line += "pitch every 1/8 s (st): " + " ".join(f"{v:+.0f}" for v in st)
        elif name == "mix_inverted":
            st = pitch_steps(x, 0.1, 0.1, 10, 261.6256)
            line += "pitch every 0.1 s (st): " + " ".join(f"{v:+.0f}" for v in st)
        elif name == "sh_from_mix":
            st = pitch_steps(x, 0.1, 1 / 6, 14, 261.6256)
            line += "S&H steps (st): " + " ".join(f"{v:+.0f}" for v in st)
        print(line)


if __name__ == "__main__":
    if "--make-input" in sys.argv or not (OUT / "cello_sim.wav").exists():
        make_input()
    if "--make-input" not in sys.argv:
        main()
