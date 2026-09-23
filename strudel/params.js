// Custom controls for Strudel. Paste at the top of a Strudel REPL session
// (strudel.cc or a local REPL). Keep in sync with docs/params.md, tidal/params.hs,
// ~scstdSpecs in sc/synthdefs/00_modules.scd, and the UI (CLAUDE.md, decision 8).
//
// createParams (from @strudel/core, checked in v1.2.6) returns an object of control
// functions and also adds each name as a pattern method, so `.vcfcut(800)` works.

createParams(
  // VCO 1
  'o1wave', 'o1lvl', 'o1oct', 'o1fine', 'o1lf', 'o1lfrate',
  // VCO 2
  'o2wave', 'o2lvl', 'o2oct', 'o2fine', 'o2pw', 'o2pwm', 'o2sync', 'o2fm',
  // VCO 3
  'o3wave', 'o3lvl', 'o3oct', 'o3fine', 'o3pw', 'o3pwm', 'o3fm',
  // Analog character
  'drift', 'vspread',
  // Noise, ring mod
  'nzcol', 'nzlvl', 'rmlvl',
  // Sample & hold, lag
  'shrate', 'shsrc', 'shlag', 'lagtime',
  // Patch cables (m_<source>_<dest>)
  'm_sh_pitch', 'm_sh_vcf',
  // VCF
  'vcfcut', 'vcfres', 'vcfenv', 'vcfkey', 'vcfdrive', 'vcfmodel', // vcfmodel: 0 = MoogLadder, 1 = MoogFF
  // VCA
  'vcalvl', 'vcaenv',
  // ADSR
  'eatk', 'edec', 'esus', 'erel', 'ecurve',
  // AR
  'aratk', 'arrel',
);
