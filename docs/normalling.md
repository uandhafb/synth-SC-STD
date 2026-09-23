# Normalling (default routing)

Default connections and how to override each one from a pattern (Stage 4).
Verify each row against the original owner's manual notes in `docs/references/` and mark it
confirmed.

| From | To | Default | Override from Tidal | Confirmed |
|---|---|---|---|---|
| Keyboard pitch | VCO 1, 2, 3 pitch | on | `o1kbd 0`, `o2kbd 0`, `o3kbd 0` (fixed pitch around middle C) | |
| VCO 1, 2, 3, noise, ring mod | VCF input (via mixer levels) | VCO 1+2 on | `o1lvl`, `o2lvl`, `o3lvl`, `nzlvl`, `rmlvl` | |
| VCF output | VCA input | on (fixed) | — | |
| ADSR | VCF cutoff | on (`vcfenv` 0.4) | `vcfenv 0` unplugs it; it *is* the ADSR → VCF cable | |
| AR | VCA gain | on (`vcaenv` 1) | `vcaenv 0` unplugs it (drone for the note's length) | |
| VCO 1 / VCO 2 | Ring mod A / B | on | `rma`, `rmb` (0 VCO 1, 1 VCO 2, 2 VCO 3, 3 noise) | |
| Noise | Sample & hold input | on | `shsrc` (1–3 = VCO 1–3) | |
| VCO 1 | Lag processor input | on | — (`lagtime 0` = no effect) | |
| Sample & hold | mod source | off until routed | `sh_pitch`, `sh_vcf`, `sh_pw`, `sh_vca` | |
| any source | pitch / vcf / pw / vca | off | patch cables `<source>_<dest>` (docs/params.md) | |
| VCA output | Spring reverb (FX bus) | Stage 6 | | |
