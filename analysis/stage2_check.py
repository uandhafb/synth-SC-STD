"""Measure the Stage 2 offline render (sc/tests/stage2_render.scd).

Usage:
    /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/stage2_render.scd
    .venv/bin/python analysis/stage2_check.py
"""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

from stage1_check import alias_ratio_db, db, dominant_freq, max_jump_db, segment

OUT = Path(__file__).parent / "output"


def midi_hz(m: float) -> float:
    return 440 * 2 ** ((m - 69) / 12)


def centroid(x, sr):
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    return float((spec * freqs).sum() / spec.sum())


def main() -> None:
    sig, sr = sf.read(OUT / "stage2.wav")
    cases = json.loads((OUT / "stage2_cases.json").read_text())
    print(f"file: {len(sig) / sr:.1f} s, NaN: {np.isnan(sig).any()}, "
          f"overall peak {db(np.abs(sig).max()):.1f} dBFS\n")
    print(f"{'case':16s} {'peak':>7s} {'rms':>7s}  notes")
    for c in cases:
        x = segment(sig, sr, c, pad=0.05)
        name, note = c["name"], c["notes"][0]
        mid = x[int(0.05 * sr):int(max(0.4, min(0.9, c["len"])) * sr)]
        notes = []
        if name.startswith(("sync_c", "free_")):
            # Synced output repeats at VCO 1's frequency; free VCO 2 at its own.
            f0 = midi_hz(note) if name.startswith("sync") else midi_hz(note) * 2 ** c["o2oct"]
            notes.append(f"non-harmonic {alias_ratio_db(mid, sr, f0):.1f} dB (f0 {f0:.0f} Hz)")
        if name.startswith("key"):
            notes.append(f"spectral centroid {centroid(mid, sr):.0f} Hz")
        if name in ("lf_vibrato", "fm_bell", "fm_heavy", "fm_2to3", "sync_lead"):
            notes.append(f"dominant {dominant_freq(mid, sr):.0f} Hz")
        if name == "fm_bell":
            env = [db(np.sqrt(np.mean(x[int(t * sr):int((t + 0.05) * sr)] ** 2))) for t in (0.05, 0.5, 1.0, 2.0)]
            notes.append("rms at 0.05/0.5/1/2 s: " + " ".join(f"{v:.0f}" for v in env))
        head = db(np.abs(x[: int(0.002 * sr)]).max())
        tail = db(np.abs(segment(sig, sr, c)[-int(0.002 * sr):]).max())
        notes.append(f"edges {head:.0f}/{tail:.0f} dBFS, step {max_jump_db(x):.0f} dB")
        print(f"{name:16s} {db(np.abs(x).max()):7.1f} {db(np.sqrt(np.mean(x ** 2))):7.1f}  " + "; ".join(notes))


if __name__ == "__main__":
    main()
