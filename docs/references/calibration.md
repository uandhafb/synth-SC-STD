# Calibration (Stage 6)

No reference instrument was available (no ARP 2600, Behringer/Korg reissue, Arturia V or TTSH), so
calibration is **technical**: measured against the intended behaviour of each module, as described
in CLAUDE.md and general knowledge of the original's design. Values marked *unverified* should be
checked against the original owner's manual if a copy becomes available.

## Measured (sc/tests/calib_render.scd + analysis/calib_check.py, 2026-09-23)

| What | Result | Target | Status |
|---|---|---|---|
| VCO 2 tuning, C1–C7 | within ±0.3 cents | ±1 cent | OK |
| MoogFF slope above cutoff (1 kHz) | −21 dB/oct (2–4 kHz), −27 (4–8 kHz) | ideal 4-pole: −21, −23.5 | OK (steeper near Nyquist: digital warping) |
| MoogLadder slope above cutoff (1 kHz) | −16 dB/oct (2–4 kHz), −18 (4–8 kHz) | ideal 4-pole: −21, −23.5 | **gentler than a 4-pole**; kept as this filter's character (user likes both models). `vcfmodel 1` is the accurate 4-pole |
| Cutoff accuracy (MoogLadder, after Stage 3 calibration) | 0.97–1.01× up to 2 kHz, 0.81× at 12 kHz | 1.0× | OK below ~8 kHz; ceiling ~12.8 kHz |
| Self-oscillation pitch | within ±0.6 semitones | in tune | OK |
| Keyboard tracking (vcfkey 1, two octaves) | cutoff ratio 3.7 (−12 dB points) | 4.0 | close (−0.2 octaves at the top) |
| AR attack 1 s | reaches 90 % at 0.91 s | linear, ~0.9 s | OK |
| AR release 1 s, curve −4 | falls to 10 % after 0.53 s, silent at 1 s | capacitor-like | OK (release time = time to silence) |
| Output level vs SuperDirt sounds | scstd rms −28.8 dBFS; superpiano −30.5, bd −28.9 | similar | OK after +8 dB (was 8–18 dB too quiet) |
| Loudest random patch (fuzz, 107 params) | −8.5 dBFS after SuperDirt's amp | < 0 dBFS | OK (output softclip) |
| Spring reverb T60 (spdecay 0 / 0.5 / 1) | 0.7 / 1.3 / 5.1 s | ~0.5–4 s | OK |
| Spring dispersion ("chirp") | lows arrive ~15 ms after highs per echo | audible chirp | OK |

## Unverified against the original (to check with the manual or a real instrument)

- Exact envelope time ranges (ADSR, AR) and curve shapes.
- VCO ranges in audio and LF mode; exact waveforms per VCO (VCO 3's waveforms in particular).
- Lag processor and S&H default normalling; S&H clock range.
- Preamp gain range and envelope follower time constants.
- Spring reverb character (tank length, number of springs) — ours is a generic model tuned by ear.
- Filter: the original used different ladder designs over the years; both our models are 4-pole
  low-pass approximations.
