# Normalling (default routing)

Working table, copied from CLAUDE.md Section 7. Verify each row against the
original owner's manual notes in `docs/references/` and mark it confirmed.

| From | To | Default | Confirmed |
|---|---|---|---|
| Keyboard pitch | VCO 1, 2, 3 pitch | on | |
| VCO 1, 2, 3, noise, ring mod | VCF input (via mixer levels) | on | |
| VCF output | VCA input | on | |
| ADSR | VCF cutoff | on (`vcfenv`) | |
| AR | VCA gain | on (`vcaenv`) | |
| VCO 1 / VCO 2 | Ring mod A / B | on | |
| Noise | Sample & hold input | on | |
| Sample & hold | available as mod source | off until routed | |
| VCA output | Spring reverb (FX bus) | on (low `spmix`) | |
