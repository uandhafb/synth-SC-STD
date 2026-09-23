// synth-SC-STD Strudel examples.
// 1. Run sc/startup.scd in SuperCollider.
// 2. In a terminal: npx @strudel/osc   (bridge from the browser to SuperDirt on port 57120)
// 3. Open strudel.cc, paste strudel/params.js, then ONE pattern below, press Ctrl+Enter.
//    Ctrl+. stops.

// Stage 1 — same as tidal/examples.tidal #1: default sound.
n("0 3 7 10").s("scstd").osc()

// #9 — resonant filter sweep. Listen for: smooth whistling peak, no clicks.
// n("-12*8").s("scstd").vcfenv(0).vcfres(0.9).vcfcut(sine.range(100, 6000).slow(4)).osc()

// #11 — filter envelope bass.
// n("-24 -24 -12 -24").s("scstd").vcfcut(150).vcfres(0.6).vcfenv(0.8).edec(0.25).esus(0).osc()

// #17 — two filter characters, alternating every cycle: MoogLadder (0) and MoogFF (1).
// n("-24 -12 -24 -17").s("scstd").vcfcut(300).vcfres(0.85).vcfenv(0.6).edec(0.3).vcfmodel("<0 1>").osc()


// ---- Stage 2 — oscillator modulation ----

// #22 — PWM pad (presets/pwm_pad.json)
// n("<[0,4,7] [-3,0,4] [-7,-3,0] [-5,-1,2]>").s("scstd").o1lf(1).o1lfrate(0.8).o1lvl(0).o2wave(1).o2pwm(0.8).o3lvl(0.6).o3wave(1).o3pwm(0.6).o3oct(0).o3fine(-0.08).vcfcut(1800).vcfres(0.2).vcfenv(0.1).aratk(0.4).arrel(1.2).erel(1.2).legato(1).osc()

// #25 — Sync lead (presets/sync_lead.json)
// n("0 3 7 10 12 10 7 3").s("scstd").o1lvl(0.2).o2sync(1).vcfcut(2500).vcfres(0.3).vcfenv(0.3).vcfkey(0.7).edec(0.4).esus(0.5).o2oct(sine.range(0.6, 2).slow(2)).osc()

// #27 — FM bell (presets/fm_bell.json)
// n("0 ~ 7 ~ 12 ~ 4 ~").s("scstd").o1oct(0.485).o1lvl(0).o2wave(3).o2fm(0.12).vcfcut(12000).vcfenv(0).aratk(0.001).arrel(2.5).erel(2.5).legato(0.1).osc()

// ---- Stage 3 — noise, ring mod, sample & hold, lag ----

// #32 — Wind (presets/wind.json)
// n("0").s("scstd").o1lvl(0).o2lvl(0).nzlvl(1).nzcol(0.3).m_sh_vcf(2.5).shrate(1.5).shlag(1).vcfcut(900).vcfres(0.85).vcfenv(0).vcfkey(0).aratk(0.8).arrel(1.5).erel(1.5).legato(1).osc()

// #39 — Computer sequence (presets/computer_sequence.json)
// n("0").s("scstd").o1lvl(0).o2wave(1).o2pw(0.3).m_sh_pitch(12).shrate(8).vcfcut(2500).vcfres(0.5).vcfenv(0).arrel(0.1).erel(0.1).legato(1).osc()

// #40 — R2-D2-style bleeps (presets/r2d2_bleeps.json)
// n("<0 7 3 12>").s("scstd").o1oct(0.5).o1lvl(0).o2wave(3).o2lvl(0.5).rmlvl(0.6).m_sh_pitch(24).shrate(11).shlag(0.35).o2fm(0.03).vcfcut(9000).vcfenv(0).legato(0.9).osc()
