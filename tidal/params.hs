-- Custom params for the synth. Load from BootTidal.hs with:
--   :script "/Users/uandha/ARP 2600/tidal/params.hs"
-- The path contains a space, so keep the quotes. If GHCi still rejects it, make a
-- space-free link once:  ln -s "/Users/uandha/ARP 2600" ~/synth-sc-std
-- and use  :script ~/synth-sc-std/tidal/params.hs
-- Keep in sync with docs/params.md, strudel/params.js and the UI (CLAUDE.md, decision 8).

:{
-- Stage 0 test synth (sctest)
let tstbright = pF "tstbright"
    tstrel    = pF "tstrel"
:}
