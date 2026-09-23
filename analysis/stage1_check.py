"""Measure the Stage 1 offline render (sc/tests/stage1_render.scd).

Usage:
    /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/stage1_render.scd
    .venv/bin/python analysis/stage1_check.py

Numbers are a sanity check before listening, not a replacement for it.
"""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(__file__).parent / "output"


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-12))


def segment(sig, sr, case, pad=0.0):
    a = int(case["start"] * sr)
    b = int((case["start"] + case["sustain"] + pad) * sr)
    return sig[a:b]


def dominant_freq(x, sr):
    w = np.hanning(len(x))
    spec = np.abs(np.fft.rfft(x * w))
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    k = np.argmax(spec[1:]) + 1
    return freqs[k]


def alias_ratio_db(x, sr, f0, tol=0.01):
    """Energy NOT at harmonics of f0 (i.e. aliasing + noise), relative to total, in dB."""
    w = np.blackman(len(x))
    spec = np.abs(np.fft.rfft(x * w)) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    k = freqs / f0
    near_harm = np.abs(k - np.round(k)) * f0 < max(tol * f0, 15)
    near_harm &= np.round(k) >= 1
    total = spec[freqs > 20].sum()
    other = spec[(freqs > 20) & ~near_harm].sum()
    return 10 * np.log10(max(other, 1e-20) / total)


def max_jump_db(x):
    """Largest sample-to-sample step relative to peak; big values at edges = clicks."""
    d = np.abs(np.diff(x))
    return db(d.max() / max(np.abs(x).max(), 1e-12))


def main() -> None:
    sig, sr = sf.read(OUT / "stage1.wav")
    cases = json.loads((OUT / "stage1_cases.json").read_text())
    print(f"file: {len(sig) / sr:.1f} s at {sr} Hz, NaN: {np.isnan(sig).any()}, "
          f"overall peak {db(np.abs(sig).max()):.1f} dBFS\n")
    print(f"{'case':28s} {'peak':>7s} {'rms':>7s}  notes")
    for c in cases:
        x = segment(sig, sr, c, pad=0.05)
        peak, rms = np.abs(x).max(), np.sqrt(np.mean(x ** 2))
        notes = []
        name = c["name"]
        if name.startswith("high_note"):
            f0 = 440 * 2 ** ((c["notes"][0] - 69) / 12)
            mid = x[int(0.2 * sr):int(0.8 * sr)]
            notes.append(f"non-harmonic energy {alias_ratio_db(mid, sr, f0):.1f} dB (lower = less aliasing)")
        if name.startswith("selfosc"):
            steady = x[int(0.7 * sr):int(1.4 * sr)]
            notes.append(f"steady rms {db(np.sqrt(np.mean(steady ** 2))):.1f} dBFS, "
                         f"freq {dominant_freq(steady, sr):.0f} Hz")
        if name.startswith("release_tail"):
            env = np.abs(x)
            n_end = int(c["len"] * sr)
            after = [db(np.sqrt(np.mean(env[n_end + int(t * sr):n_end + int((t + 0.05) * sr)] ** 2)))
                     for t in (0.0, 0.5, 1.0, 1.5, 1.9)]
            notes.append("rms after note end at 0/0.5/1/1.5/1.9 s: " + " ".join(f"{v:.0f}" for v in after))
        # Edge click check: level in the first and last 2 ms of the event.
        head = db(np.abs(x[: int(0.002 * sr)]).max())
        tail_ = segment(sig, sr, c)
        tail = db(np.abs(tail_[-int(0.002 * sr):]).max())
        notes.append(f"edges: start {head:.0f} / end {tail:.0f} dBFS, max step {max_jump_db(x):.0f} dB")
        print(f"{name:28s} {db(peak):7.1f} {db(rms):7.1f}  " + "; ".join(notes))


if __name__ == "__main__":
    main()
