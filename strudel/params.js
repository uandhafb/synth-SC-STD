// Custom controls for Strudel. Paste at the top of a Strudel REPL session
// (strudel.cc or a local REPL). Keep in sync with docs/params.md, tidal/params.hs,
// ~scstdSpecs in sc/synthdefs/00_modules.scd, and the UI (CLAUDE.md, decision 8).
//
// createParams (from @strudel/core, checked in v1.2.6) returns an object of control
// functions and also adds each name as a pattern method, so `.vcfcut(800)` works.

createParams(
  // VCO 1
  'o1wave', 'o1lvl', 'o1oct', 'o1fine', 'o1lf', 'o1lfrate', 'o1kbd',
  // VCO 2
  'o2wave', 'o2lvl', 'o2oct', 'o2fine', 'o2pw', 'o2pwm', 'o2sync', 'o2fm', 'o2kbd',
  // VCO 3
  'o3wave', 'o3lvl', 'o3oct', 'o3fine', 'o3pw', 'o3pwm', 'o3fm', 'o3kbd',
  // Analog character
  'drift', 'vspread',
  // Noise, ring mod
  'nzcol', 'nzlvl', 'rmlvl', 'rma', 'rmb',
  // Sample & hold, lag
  'shrate', 'shsrc', 'shlag', 'lagtime', 'lagsrc',
  // Mono mode
  'monomode', 'glide',
  // Audio input, electronic switch, mixer/inverter
  'inlvl', 'ingain', 'efatk', 'efrel',
  'swrate', 'swa', 'swb', 'swlvl',
  'mixa', 'mixb', 'mixalvl', 'mixblvl',
  // Patch cables (<source>_<dest>)
  'vco1_pitch', 'vco1_vcf', 'vco1_pw', 'vco1_vca',
  'vco2_pitch', 'vco2_vcf', 'vco2_pw', 'vco2_vca',
  'vco3_pitch', 'vco3_vcf', 'vco3_pw', 'vco3_vca',
  'noise_pitch', 'noise_vcf', 'noise_pw', 'noise_vca',
  'sh_pitch', 'sh_vcf', 'sh_pw', 'sh_vca',
  'adsr_pitch', 'adsr_pw', 'adsr_vca',
  'ar_pitch', 'ar_vcf', 'ar_pw',
  'rm_pitch', 'rm_vcf', 'rm_pw', 'rm_vca',
  'envf_pitch', 'envf_vcf', 'envf_pw', 'envf_vca',
  'mix_pitch', 'mix_vcf', 'mix_pw', 'mix_vca',
  // VCF
  'vcfcut', 'vcfres', 'vcfenv', 'vcfkey', 'vcfdrive', 'vcfmodel', // vcfmodel: 0 = MoogLadder, 1 = MoogFF
  // VCA
  'vcalvl', 'vcaenv', 'vcainit',
  // ADSR
  'eatk', 'edec', 'esus', 'erel', 'ecurve',
  // AR
  'aratk', 'arrel',
  // Spring reverb
  'spmix', 'spdecay', 'sptone',
);
