"""Measure the Stage 4 offline render (sc/tests/stage4_render.scd).

Usage:
    /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/stage4_render.scd
    .venv/bin/python analysis/stage4_check.py
"""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

from stage1_check import db, dominant_freq, max_jump_db, segment

OUT = Path(__file__).parent / "output"


def midi_hz(m: float) -> float:
    return 440 * 2 ** ((m - 69) / 12)


def pitch_track(x, sr, f_ref, win=0.08):
    """Dominant pitch (semitones vs f_ref) in consecutive windows."""
    n = int(win * sr)
    out = []
    for i in range(0, len(x) - n, n):
        s = x[i:i + n]
        spec = np.abs(np.fft.rfft(s * np.hanning(n), 8 * n))
        f = np.fft.rfftfreq(8 * n, 1 / sr)
        band = (f > f_ref / 5) & (f < f_ref * 5)
        out.append(12 * np.log2(f[band][np.argmax(spec[band])] / f_ref))
    return out


def centroid(x, sr):
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    f = np.fft.rfftfreq(len(x), 1 / sr)
    return float((spec * f).sum() / spec.sum())


def am_depth(x, sr, rate):
    """Amplitude-modulation depth at `rate` Hz from the RMS envelope (0 = none, 1 = full)."""
    n = int(0.005 * sr)
    env = np.array([np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, len(x) - n, n)])
    t = np.arange(len(env)) * n / sr
    c, s_ = np.cos(2 * np.pi * rate * t), np.sin(2 * np.pi * rate * t)
    amp = 2 * np.hypot((env * c).mean(), (env * s_).mean())
    return amp / env.mean()


def main() -> None:
    sig, sr = sf.read(OUT / "stage4.wav")
    cases = json.loads((OUT / "stage4_cases.json").read_text())
    print(f"file: {len(sig) / sr:.1f} s, NaN: {np.isnan(sig).any()}, "
          f"overall peak {db(np.abs(sig).max()):.1f} dBFS\n")
    print(f"{'case':18s} {'peak':>7s} {'rms':>7s}  notes")
    for c in cases:
        x = segment(sig, sr, c, pad=0.05)
        name, note = c["name"], c["notes"][0]
        f0 = midi_hz(note)
        notes = []
        if name in ("adsr_pitch", "ar_pitch"):
            tr = pitch_track(x[: int(1.4 * sr)], sr, f0)
            notes.append("pitch over time (st): " + " ".join(f"{v:+.0f}" for v in tr[::2]))
        if name == "vco1_vca_tremolo":
            notes.append(f"AM depth at 5 Hz: {am_depth(x[int(0.2 * sr):int(1.8 * sr)], sr, 5):.2f}")
        if name == "o2kbd_off":
            notes.append(f"dominant {dominant_freq(x[int(0.1 * sr):int(0.9 * sr)], sr):.1f} Hz "
                         f"(note played {f0:.0f} Hz, expected 261.6)")
        if name in ("panel_change", "pattern_wins"):
            a = centroid(x[int(0.4 * sr):int(1.4 * sr)], sr)
            b = centroid(x[int(1.7 * sr):int(2.7 * sr)], sr)
            notes.append(f"brightness before {a:.0f} Hz -> after bus change {b:.0f} Hz")
        if name in ("rm_2x3", "noise_vcf", "sh_pw", "rm_vcf", "vco3_pitch_fm", "vco2_pitch_self"):
            body = x[int(0.1 * sr):int(1.4 * sr)]
            notes.append(f"brightness {centroid(body, sr):.0f} Hz")
        head = db(np.abs(x[: int(0.002 * sr)]).max())
        tail = db(np.abs(segment(sig, sr, c)[-int(0.002 * sr):]).max())
        notes.append(f"edges {head:.0f}/{tail:.0f} dBFS, step {max_jump_db(x):.0f} dB")
        print(f"{name:18s} {db(np.abs(x).max()):7.1f} {db(np.sqrt(np.mean(x ** 2))):7.1f}  " + "; ".join(notes))


if __name__ == "__main__":
    main()
