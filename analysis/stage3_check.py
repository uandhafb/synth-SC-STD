"""Measure the Stage 3 offline render (sc/tests/stage3_render.scd).

Usage:
    /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/stage3_render.scd
    .venv/bin/python analysis/stage3_check.py
"""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

from stage1_check import db, max_jump_db, segment

OUT = Path(__file__).parent / "output"


def midi_hz(m: float) -> float:
    return 440 * 2 ** ((m - 69) / 12)


def band_db(x, sr, lo, hi):
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    f = np.fft.rfftfreq(len(x), 1 / sr)
    return 10 * np.log10(spec[(f >= lo) & (f < hi)].mean() + 1e-20)


def ringmod_unexpected_db(x, sr, f1, f2, tol=6.0):
    """Energy not at |m*f1 +- n*f2| (the only lines an ideal ring mod of two saws produces)."""
    w = np.blackman(len(x))
    spec = np.abs(np.fft.rfft(x * w)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / sr)
    mask = np.zeros_like(f, dtype=bool)
    nyq = sr / 2
    for m in range(1, int(nyq / f1) + 2):
        for n in range(1, int(nyq / f2) + 2):
            for line in (m * f1 + n * f2, abs(m * f1 - n * f2)):
                if line < nyq:
                    mask |= np.abs(f - line) < tol
    total = spec[f > 20].sum()
    return 10 * np.log10(spec[(f > 20) & ~mask].sum() / total)


def pitch_steps(x, sr, rate, f_expected):
    """Median pitch (semitones vs f_expected) in each S&H step, via zero-crossing-free FFT peak."""
    step = int(sr / rate)
    out = []
    for i in range(0, len(x) - step, step):
        s = x[i + step // 4: i + step]  # skip the transition at the step start
        spec = np.abs(np.fft.rfft(s * np.hanning(len(s)), 8 * len(s)))
        f = np.fft.rfftfreq(8 * len(s), 1 / sr)
        band = (f > f_expected / 4) & (f < f_expected * 4)
        peak = f[band][np.argmax(spec[band])]
        out.append(12 * np.log2(peak / f_expected))
    return out


def flux_peak_ratio(x, sr):
    hop, n = 256, 1024
    frames = np.array([np.abs(np.fft.rfft(x[i:i + n] * np.hanning(n))) for i in range(0, len(x) - n, hop)])
    flux = np.maximum(np.diff(np.log(frames + 1e-6), axis=0), 0).mean(axis=1)[20:]
    return flux.max() / np.median(flux)


def main() -> None:
    sig, sr = sf.read(OUT / "stage3.wav")
    cases = json.loads((OUT / "stage3_cases.json").read_text())
    print(f"file: {len(sig) / sr:.1f} s, NaN: {np.isnan(sig).any()}, "
          f"overall peak {db(np.abs(sig).max()):.1f} dBFS\n")
    print(f"{'case':14s} {'peak':>7s} {'rms':>7s}  notes")
    for c in cases:
        x = segment(sig, sr, c, pad=0.05)
        name, note = c["name"], c["notes"][0]
        body = x[int(0.1 * sr):int(max(0.4, min(c["len"], 2.9)) * sr)]
        notes = []
        if name.startswith("noise_") and name != "noise_hat":
            notes.append(f"band level 100-1k: {band_db(body, sr, 100, 1000):.0f} dB, "
                         f"5k-15k: {band_db(body, sr, 5000, 15000):.0f} dB")
        if name.startswith("ringmod"):
            f1 = midi_hz(note) * 2 ** 0.485
            f2 = midi_hz(note) * 2 ** (0.05 / 12)   # o2fine default +0.05 semitones
            notes.append(f"energy off the ideal ring-mod lines {ringmod_unexpected_db(body, sr, f1, f2):.1f} dB")
        if name.startswith("sh_pitch"):
            st = pitch_steps(x[: int(3.0 * sr)], sr, 8, midi_hz(note))
            notes.append("step pitches (semitones): " + " ".join(f"{v:+.0f}" for v in st[:12]))
        if name.startswith(("pwm_lag", "wind", "sh_pitch")):
            notes.append(f"max/median spectral flux {flux_peak_ratio(body, sr):.1f} (lower = smoother)")
        head = db(np.abs(x[: int(0.002 * sr)]).max())
        tail = db(np.abs(segment(sig, sr, c)[-int(0.002 * sr):]).max())
        notes.append(f"edges {head:.0f}/{tail:.0f} dBFS, step {max_jump_db(x):.0f} dB")
        print(f"{name:14s} {db(np.abs(x).max()):7.1f} {db(np.sqrt(np.mean(x ** 2))):7.1f}  " + "; ".join(notes))


if __name__ == "__main__":
    main()
