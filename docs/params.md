# Parameters (single source of truth)

Every parameter added or renamed here must also change in `tidal/params.hs`,
`strudel/params.js` and the UI in the same commit (CLAUDE.md, decision 8).
Before adding a name, check it against SuperDirt params, Tidal functions and
Strudel controls (CLAUDE.md, Section 5).

Planned parameters for Stages 1–6 are listed in CLAUDE.md, Section 6; they move
here as each one is implemented.

## Stage 0 — test synth `sctest` (temporary)

| Param | Range | Default | Description |
|---|---|---|---|
| `tstbright` | 0–1 | 0.5 | Low-pass brightness, mapped exponentially to 200 Hz–12 kHz |
| `tstrel` | 0.01–8 s | 0.3 | Release time; added to the event's `sustain` so the tail is not cut |

## Standard SuperDirt params we rely on

| Param | Notes |
|---|---|
| `n` / `note` | Pitch in semitones (0 = C5 / 261.6 Hz with the default `octave 5`) |
| `legato` | Gate length as a fraction of the event; release is added after it |
| `sustain` | If set by the pattern: total length **including** release |
| `pan`, `orbit` | Standard SuperDirt behaviour |
