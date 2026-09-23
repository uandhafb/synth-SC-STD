-- Custom params for the synth. Loaded by the project's BootTidal.hs:
--   :script "/Users/uandha/ARP 2600/tidal/params.hs"
-- Keep in sync with docs/params.md, strudel/params.js, ~scstdSpecs in
-- sc/synthdefs/00_modules.scd, and the UI (CLAUDE.md, decision 8).

:{
-- VCO 1
let o1wave   = pF "o1wave"
    o1lvl    = pF "o1lvl"
    o1oct    = pF "o1oct"
    o1fine   = pF "o1fine"
    o1lf     = pF "o1lf"
    o1lfrate = pF "o1lfrate"
-- VCO 2
    o2wave   = pF "o2wave"
    o2lvl    = pF "o2lvl"
    o2oct    = pF "o2oct"
    o2fine   = pF "o2fine"
    o2pw     = pF "o2pw"
    o2pwm    = pF "o2pwm"
    o2sync   = pF "o2sync"
    o2fm     = pF "o2fm"
-- VCO 3
    o3wave   = pF "o3wave"
    o3lvl    = pF "o3lvl"
    o3oct    = pF "o3oct"
    o3fine   = pF "o3fine"
    o3pw     = pF "o3pw"
    o3pwm    = pF "o3pwm"
    o3fm     = pF "o3fm"
-- Analog character
    drift    = pF "drift"
    vspread  = pF "vspread"
-- Noise, ring mod
    nzcol    = pF "nzcol"
    nzlvl    = pF "nzlvl"
    rmlvl    = pF "rmlvl"
-- Sample & hold, lag
    shrate   = pF "shrate"
    shsrc    = pF "shsrc"
    shlag    = pF "shlag"
    lagtime  = pF "lagtime"
-- Patch cables (m_<source>_<dest>)
    m_sh_pitch = pF "m_sh_pitch"
    m_sh_vcf   = pF "m_sh_vcf"
-- VCF
    vcfcut   = pF "vcfcut"
    vcfres   = pF "vcfres"
    vcfenv   = pF "vcfenv"
    vcfkey   = pF "vcfkey"
    vcfdrive = pF "vcfdrive"
    vcfmodel = pF "vcfmodel"  -- 0 = MoogLadder, 1 = MoogFF
-- VCA
    vcalvl   = pF "vcalvl"
    vcaenv   = pF "vcaenv"
-- ADSR
    eatk     = pF "eatk"
    edec     = pF "edec"
    esus     = pF "esus"
    erel     = pF "erel"
    ecurve   = pF "ecurve"
-- AR
    aratk    = pF "aratk"
    arrel    = pF "arrel"
:}
