// synth-SC-STD Strudel examples: the same numbers and the same sounds as tidal/examples.tidal.
//
// Setup (each session):
//   1. SuperCollider: run sc/startup.scd.
//   2. Terminal: npx @strudel/osc   (the bridge from the browser to SuperDirt; leave it running)
//   3. strudel.cc: paste strudel/params.js, then this whole file below it.
// Play: every example is muted ("_d1:"). Delete the "_" in front of ONE example, press Ctrl+Enter.
//   "d1:" works like Tidal's d1: only one d1 plays (if several are un-muted, the last one wins).
//   Put the "_" back and remove another one to switch. Ctrl+. stops everything (like hush).
// Every line ends with .osc(): that sends it to SuperCollider. Without it, Strudel plays its own sounds.
//
// Translation from Tidal:  d1 $ n "0 3" # s "scstd" # vcfcut 800   ->   d1: n("0 3").s("scstd").vcfcut(800)
//   (range 100 6000 $ slow 4 sine) -> sine.range(100, 6000).slow(4);  0.37 <~ rand -> rand.early(0.37)
// Checked against Tidal event by event with analysis/parity_check.mjs.

// Same tempo as Tidal's default (Tidal 1.10: 0.575 cycles per second; Strudel's default is 0.5).
setcps(0.575)

// =============================================================================================
// Stage 1 — single voice (sound "scstd"). Each block tests one module.
// =============================================================================================

// #1. Default sound: two slightly detuned saws through the filter. Warm, a bit buzzy.
_d1: n("0 3 7 10").s("scstd").osc()

// #2. Chords: should be clean, no distortion or crackle.
_d1: n("[0,4,7] [2,5,9] [-1,2,7] [0,4,7,11]").s("scstd").legato(1).osc()

// #3. VCO waves. Listen for: saw (bright) -> square (hollow) as o1wave goes 0 -> 1.
_d1: n("0 ~ 0 ~").s("scstd").o2lvl(0).vcfcut(8000).vcfenv(0).o1wave("<0 0.5 1>").osc()

// #4. VCO 2 morph: saw -> pulse -> triangle -> sine, one per cycle (gets softer and rounder).
_d1: n("0*4").s("scstd").o1lvl(0).vcfcut(8000).vcfenv(0).o2wave("<0 1 2 3>").osc()

// #5. Pulse width: thin, nasal pulse (0.1) vs. full square (0.5).
_d1: n("0*4").s("scstd").o1lvl(0).o2wave(1).vcfcut(8000).vcfenv(0).o2pw("<0.5 0.1>").osc()

// #6. VCO 3 one octave down adds weight. Listen for: fuller, deeper sound on the second cycle.
_d1: n("0 3 7 10").s("scstd").o3lvl("<0 0.7>").osc()

// #7. Detune: o2fine 0 = static; 0.15 = slow beating "chorus".
_d1: n("0").s("scstd").legato(1).vcfenv(0).o2fine("<0 0.15>").osc()

// #8. Filter cutoff (dark -> bright), no resonance.
_d1: n("-12*8").s("scstd").vcfenv(0).vcfres(0).vcfcut(sine.range(100, 6000).slow(4)).osc()

// #9. Resonance: same sweep, strong resonance. Listen for: a smooth whistling peak, no clicks
//    or "zipper" steps.
_d1: n("-12*8").s("scstd").vcfenv(0).vcfres(0.9).vcfcut(sine.range(100, 6000).slow(4)).osc()

// #10. Self-oscillation: no oscillators, filter alone sings a sine at the cutoff frequency.
_d1: n("0").s("scstd").o1lvl(0).o2lvl(0).vcfres(1.1).vcfenv(0).vcfcut("<440 660 880>").legato(1).osc()

// #11. Filter envelope: classic "pew" / "wow" bass. vcfenv 0.8 = strong sweep down on each note.
_d1: n("-24 -24 -12 -24").s("scstd").vcfcut(150).vcfres(0.6).vcfenv(0.8).edec(0.25).esus(0).osc()

// #12. Negative envelope: the filter closes on the attack and opens as the note ends.
_d1: n("-12 -5").s("scstd").vcfcut(3000).vcfenv(-0.6).eatk(0.3).edec(0.5).esus(0.2).legato(1).osc()

// #13. Drive: clean (0) -> saturated (1). Listen for: grittier, more harmonics, not much louder.
_d1: n("-12 -12 -5 -12").s("scstd").vcfres(0.5).vcfdrive("<0 1>").osc()

// #14. AR envelope (volume): slow swell pad vs. plucky.
_d1: n("[0,4,7]").s("scstd").aratk("<1 0.005>").arrel("<1.5 0.2>").legato(1).osc()

// #15. Long release: short notes that ring out and overlap.
_d1: n("0 ~ ~ 7 ~ ~ 12 ~").s("scstd").legato(0.2).arrel(2).erel(2).osc()

// #16. Analog character: drift 0 + vspread 0 = perfectly static; 1 + 1 = wobbly, unstable.
_d1: n("0*4").s("scstd").legato(1).drift("<0 1>").vspread("<0 1>").osc()

// #17. Two filter characters — bass. vcfmodel 0 = MoogLadder (default, can self-oscillate),
//     vcfmodel 1 = MoogFF (different colour). Play A, then B, and switch back and forth.
// #17A (MoogLadder):
_d1: n("-24 -12 -24 -17").s("scstd").vcfcut(300).vcfres(0.85).vcfenv(0.6).edec(0.3).vcfmodel(0).osc()
// #17B (MoogFF):
_d1: n("-24 -12 -24 -17").s("scstd").vcfcut(300).vcfres(0.85).vcfenv(0.6).edec(0.3).vcfmodel(1).osc()

// #18. Two filter characters — chords, filter more open.
// #18A (MoogLadder):
_d1: n("[0,3,7,10]").s("scstd").vcfcut(1200).vcfres(0.5).legato(1).vcfmodel(0).osc()
// #18B (MoogFF):
_d1: n("[0,3,7,10]").s("scstd").vcfcut(1200).vcfres(0.5).legato(1).vcfmodel(1).osc()


// =============================================================================================
// Stage 2 — oscillator modulation. VCO 1 is the modulation source.
// =============================================================================================

// #19. VCO 1 as LFO -> vibrato on VCO 2. o1lvl 0 mutes VCO 1 itself. Listen for: a gentle,
//     even pitch wobble (5 times per second).
_d1: n("0 7").s("scstd").legato(1).o1lf(1).o1lfrate(5).o1lvl(0).o2fm(0.01).osc()

// #20. LF mode NOT muted: you hear VCO 1 itself as a slow ticking/buzz under the sound
//     (faithful to the original). Compare with 19.
_d1: n("0").s("scstd").legato(1).o1lf(1).o1lfrate(3).vcfcut(4000).osc()

// #21. PWM: slow pulse-width sweep on one pulse wave. Listen for: a hollow sound that "breathes".
_d1: n("-12").s("scstd").legato(1).o1lf(1).o1lfrate(0.5).o1lvl(0).o2wave(1).o2pwm(0.9).vcfcut(3000).vcfenv(0).osc()

// #22. PRESET: PWM pad (presets/pwm_pad.json). Wide, moving chords.
//     (Fixed in Stage 3: VCO 1's LFO used to send spikes instead of a ramp, which caused clicks.)
_d1: n("<[0,4,7] [-3,0,4] [-7,-3,0] [-5,-1,2]>").s("scstd").o1lf(1).o1lfrate(0.8).o1lvl(0).o2wave(1).o2pwm(0.8).o3lvl(0.6).o3wave(1).o3pwm(0.6).o3oct(0).o3fine(-0.08).vcfcut(1800).vcfres(0.2).vcfenv(0.1).aratk(0.4).arrel(1.2).erel(1.2).legato(1).osc()

// #23. Hard sync, step by step: o2oct moves VCO 2's tuning while it stays locked to VCO 1.
//     The pitch you hear stays the same; the tone changes (tearing, vocal). 0 = no change.
_d1: n("0*4").s("scstd").o1lvl(0).o2sync(1).o2oct("<0 0.5 1 1.5>").vcfcut(5000).vcfenv(0).osc()

// #24. Sync on/off: same notes, sync off (first cycle) vs on (second).
_d1: n("0 3 7 12").s("scstd").o1lvl(0).o2oct(1.3).o2sync("<0 1>").vcfcut(4000).vcfenv(0).osc()

// #25. PRESET: Sync lead (presets/sync_lead.json). The sweep is the classic sync sound.
_d1: n("0 3 7 10 12 10 7 3").s("scstd").o1lvl(0.2).o2oct(1.3).o2sync(1).vcfcut(2500).vcfres(0.3).vcfenv(0.3).vcfkey(0.7).edec(0.4).esus(0.5).o2oct(sine.range(0.6, 2).slow(2)).osc()

// #26. FM depth: 0 -> 0.05 -> 0.2 -> 0.6. Listen for: pure -> growl -> metallic -> noisy/clangy.
_d1: n("-12*2").s("scstd").o1lvl(0).o2wave(3).vcfcut(8000).vcfenv(0).o2fm("<0 0.05 0.2 0.6>").osc()

// #27. PRESET: FM bell (presets/fm_bell.json). Clangy bell with a long ring.
_d1: n("0 ~ 7 ~ 12 ~ 4 ~").s("scstd").o1oct(0.485).o1lvl(0).o2wave(3).o2fm(0.12).vcfcut(12000).vcfenv(0).aratk(0.001).arrel(2.5).erel(2.5).legato(0.1).osc()

// #28. VCO 2 -> VCO 3 FM: VCO 3 gets rough and metallic as o3fm rises.
_d1: n("-12*2").s("scstd").o1lvl(0).o2lvl(0.2).o3lvl(0.8).o3oct(0.7).vcfcut(6000).vcfenv(0).o3fm("<0 0.1 0.3>").osc()

// #29. Keyboard tracking: a rising scale with a low cutoff. vcfkey 0 (first cycle): high notes get
//     duller and quieter. vcfkey 1 (second): every note equally bright.
_d1: n("0 5 12 17 24 29 36").s("scstd").vcfcut(400).vcfenv(0).vcfkey("<0 1>").osc()


// =============================================================================================
// Stage 3 — noise, ring mod, sample & hold (S&H), lag processor.
// Note: the filter was calibrated in Stage 3, so vcfcut now really means that frequency.
// The default sound is a little brighter than before.
// =============================================================================================

// #30. Noise colours, one per cycle: white (bright hiss) -> pink (rain) -> brown (dark rumble).
//     They should sound about equally loud.
_d1: n("0").s("scstd").o1lvl(0).o2lvl(0).nzlvl(1).vcfmodel(1).vcfcut(18000).vcfenv(0).legato(1).nzcol("<0 0.5 1>").osc()

// #31. Noise as percussion: hi-hat (short, bright) and snare-ish (noise + low VCO).
_d1: n("0*8").s("scstd").o1lvl(0).o2lvl(0).nzlvl(1).aratk(0.001).arrel(0.05).erel(0.05).legato(0.05).vcfcut(9000).vcfenv(0).osc()
_d1: n("~ -24 ~ -24").s("scstd").o1lvl(0).o2lvl(0.4).o2wave(2).nzlvl(1).aratk(0.001).arrel(0.15).erel(0.15).legato(0.1).vcfcut(4000).vcfenv(0).osc()

// #32. WIND. Each note lasts 4 cycles (slow 4) and overlaps the next (legato 1.2) with long fades,
//     so the wind blows continuously instead of restarting every cycle.
// #32A calm, slow (PRESET presets/wind.json):
_d1: n("0").slow(4).s("scstd").o1lvl(0).o2lvl(0).nzlvl(1).vcfenv(0).vcfkey(0).nzcol(0.3).sh_vcf(2.5).shrate(0.6).shlag(1).vcfcut(900).vcfres(0.85).aratk(2).arrel(3).erel(3).legato(1.2).osc()
// #32B gusty: faster, wider swings, a bit more whistle.
_d1: n("0").slow(2).s("scstd").o1lvl(0).o2lvl(0).nzlvl(1).vcfenv(0).vcfkey(0).nzcol(0.5).sh_vcf(3).shrate(1.2).shlag(1).vcfcut(1000).vcfres(0.9).aratk(1).arrel(2).erel(2).legato(1.2).osc()
// #32C the first version (restarts every cycle), for comparison.
_d1: n("0").s("scstd").o1lvl(0).o2lvl(0).nzlvl(1).vcfenv(0).vcfkey(0).nzcol(0.3).sh_vcf(2.5).shrate(1.5).shlag(1).vcfcut(900).vcfres(0.85).aratk(0.8).arrel(1.5).erel(1.5).legato(1).osc()

// #33. Ring mod alone: metallic, bell-like, not quite in tune. Changes as o1oct changes.
_d1: n("0 5 7 12").s("scstd").o1lvl(0).o2lvl(0).rmlvl(1).vcfcut(6000).vcfenv(0).o1oct("<0.485 0.25 1.1>").osc()

// #34. Ring mod mixed with the normal sound: adds a clangy edge.
_d1: n("0 3 7 10").s("scstd").rmlvl("<0 0.6>").osc()

// #34A. Ring-mod BELL, "church": each note is struck (instant attack, long ring). The ring mod
//      at an odd ratio makes inharmonic partials (measured 1, 2.4, 0.4, 3.8 x the note) and the
//      filter opens on the strike, then mellows. (PRESET presets/ringmod_bell.json)
_d1: n("0 ~ ~ 5 ~ ~ 7 ~").s("scstd").o1oct(0.485).o1lvl(0).o2wave(3).o2lvl(0.25).rmlvl(1).vcalvl(1).aratk(0.001).eatk(0.001).esus(0).vcfkey(1).vcfdrive(0).drift(0.05).vspread(0).legato(0.05).arrel(3.5).erel(3.5).edec(1.8).vcfcut(900).vcfenv(0.45).osc()
// #34B. Ring-mod BELL, "glass": higher, brighter, shorter (partials 1, 3.43, 1.43, 3.85 x).
_d1: n("12 19 24 ~ 17 ~ 24 31").s("scstd").o1oct(1.28).o1lvl(0).o2wave(3).o2lvl(0.25).rmlvl(1).vcalvl(1).aratk(0.001).eatk(0.001).esus(0).vcfkey(1).vcfdrive(0).drift(0.05).vspread(0).legato(0.05).arrel(2.5).erel(2.5).edec(0.9).vcfcut(1500).vcfenv(0.35).osc()

// #35. S&H -> pitch: ONE long note that jumps to a new random pitch 8 times per second.
//     This is the classic "computer" sound. (Each new note restarts the S&H.)
_d1: n("0").s("scstd").legato(1).o2lvl(0).sh_pitch(12).shrate(8).vcfcut(3000).vcfenv(0).osc()

// #36. Same as 35, but shlag makes the jumps into GLIDES (slides). One cycle each:
//     shlag 0 = hard jumps (like 35), 0.5 = quick slides, 1 = slow continuous slides.
_d1: n("0").s("scstd").legato(1).o2lvl(0).sh_pitch(12).shrate(8).shlag("<0 0.5 1>").vcfcut(3000).vcfenv(0).osc()

// #37. S&H moves the FILTER instead of the pitch: the note stays the same, but its tone
//     jumps between dark and bright ("bubbling", "blip-blop"). Compare with 35: 35 = pitch jumps.
_d1: n("-12").s("scstd").legato(1).sh_vcf(2).shrate(6).vcfcut(800).vcfres(0.7).vcfenv(0).osc()

// #38. STAIRCASE: the S&H reads VCO 1's slow rising sawtooth (VCO 1 as an LFO) instead of noise.
//     Each tick grabs a higher value, so the pitch climbs in steps (+3, +6, +9, +12 semitones) and
//     starts over: an automatic arpeggio. Change o1lfrate to change how fast it climbs.
_d1: n("0").s("scstd").legato(1).shsrc(1).o1lf(1).o1lfrate(0.75).o1lvl(0).sh_pitch(12).shrate(6).vcfcut(3000).vcfenv(0).osc()

// #39. PRESET: Computer sequence (presets/computer_sequence.json).
_d1: n("0").s("scstd").o1lvl(0).o2wave(1).o2pw(0.3).sh_pitch(12).shrate(8).vcfcut(2500).vcfres(0.5).vcfenv(0).arrel(0.1).erel(0.1).legato(1).osc()

// #40. R2-D2-style, second draft: pure sine tones (no harsh ring mod) that jump and glide
//     randomly, with a fast trill from VCO 1 as an LFO. Two versions, compare them:
// #40A "whistle": smoother, more like whistling.
_d1: n("<12 19 15 24>").s("scstd").o1lf(1).o1lfrate(16).o1lvl(0).o2wave(3).o2lvl(1).vcalvl(1).o2fm(0.035).sh_pitch(14).shrate(8).shlag(0.55).vcfcut(5000).vcfenv(0).vcfdrive(0).drift(0).legato(0.9).osc()
// #40B "chirp": faster, jumpier, a bit brighter.
_d1: n("<12 19 15 24>").s("scstd").o1lf(1).o1lfrate(22).o1lvl(0).o2wave(2.6).o2lvl(1).vcalvl(1).o2fm(0.05).sh_pitch(20).shrate(14).shlag(0.25).vcfcut(4000).vcfres(0.3).vcfenv(0).vcfdrive(0).drift(0).legato(0.9).osc()
// #40C first draft (for comparison; ring mod of VCO 1's saw = harsh).
_d1: n("<0 7 3 12>").s("scstd").o1oct(0.5).o1lvl(0).o2wave(3).o2lvl(0.5).rmlvl(0.6).sh_pitch(24).shrate(11).shlag(0.35).o2fm(0.03).vcfcut(9000).vcfenv(0).legato(0.9).osc()
// #40D "talking" (third draft): many short beeps at random pitches with random gaps
//     (like syllables). Each beep bends upward by a random amount (VCO 1 as a fast LFO ramps
//     VCO 2's pitch), so every beep sounds a bit different: "bwip", "bweeoo", "tt-tt".
//     (PRESET presets/r2d2_bleeps.json.) The .early(0.37) shifts keep the random values independent:
//     rand, irand and degradeBy share one random stream, so unshifted they would be correlated.
//     (Tidal and Strudel pick different random values, so the two versions talk differently.)
_d1: n(irand(24).early(0.37).add(12).segment(16)).s("scstd").o1lf(1).o1lvl(0).o2wave(3).o2lvl(1).vcalvl(1).aratk(0.003).arrel(0.03).erel(0.03).vcfcut(6000).vcfenv(0).vcfdrive(0).drift(0).o1lfrate(rand.early(0.13).range(4, 30)).o2fm(rand.early(0.71).range(0, 0.2)).legato(rand.early(0.53).range(0.4, 0.9)).degradeBy(0.35).osc()
// #40E "beeps": short, clean beeps with no bends, in fast bursts, like a computer answering.
_d1: n(irand(24).early(0.37).add(12).segment(12)).s("scstd").o1lvl(0).o2wave(2.5).o2lvl(1).vcalvl(1).aratk(0.002).arrel(0.02).erel(0.02).vcfcut(5000).vcfenv(0).vcfdrive(0).drift(0).legato(0.5).degradeBy(0.4).osc()
// #40F both mixed: every cycle, randomly either talking (bends) or plain beeps.
_d1: n(irand(24).early(0.37).add(12).segment(16)).s("scstd").o1lf(1).o1lvl(0).o2wave(3).o2lvl(1).vcalvl(1).aratk(0.003).arrel(0.03).erel(0.03).vcfcut(6000).vcfenv(0).vcfdrive(0).drift(0).o1lfrate(rand.early(0.13).range(4, 30)).o2fm(chooseWith(rand.early(0.71), [0, 0.15]).segment(1)).legato(rand.early(0.53).range(0.4, 0.9)).degradeBy(0.35).osc()

// #41. Lag processor: the PWM pad from 22, lagtime 0 then 0.3 (the saw LFO's jump gets rounded).
_d1: n("<[0,4,7] [-3,0,4]>").s("scstd").legato(1).o1lf(1).o1lfrate(0.8).o1lvl(0).o2wave(1).o2pwm(0.8).vcfcut(1800).vcfenv(0.1).aratk(0.4).arrel(1.2).lagtime("<0 0.3>").osc()

// #42. Filter calibration check: the filter alone sings the note A (440 Hz), then A an octave up.
//     Compare with any tuner or piano: it should be in tune.
_d1: n("0").s("scstd").o1lvl(0).o2lvl(0).vcfres(1.1).vcfenv(0).vcfkey(0).legato(1).vcfcut("<440 880>").osc()


// =============================================================================================
// Stage 4 — patch cables (<source>_<destination>) and panel memory.
// Sources: vco1 vco2 vco3 noise sh adsr ar rm.  Destinations: pitch (semitones), vcf (octaves),
// pw (-1..1 pulse width), vca (-1..1 volume). Several cables into one destination add up.
// =============================================================================================

// #43. ADSR -> pitch: every note starts 2 octaves up and swoops down fast. "Laser" / "zap".
//     (PRESET presets/laser_zap.json)
_d1: n("-12*4").s("scstd").adsr_pitch(24).eatk(0.001).edec(0.15).esus(0).vcfenv(0.3).arrel(0.1).osc()

// #43 CHECK (to hear what the cable does): the same slow notes, cable OFF then ON.
//     OFF: a plain note. ON: each note starts 2 octaves higher and slides down over ~0.6 s.
// #43-off:
_d1: n("-12 ~ -12 ~").s("scstd").legato(1).vcfenv(0).adsr_pitch(0).osc()
// #43-on:
_d1: n("-12 ~ -12 ~").s("scstd").legato(1).vcfenv(0).adsr_pitch(24).eatk(0.001).edec(0.6).esus(0).osc()

// #44. AR -> pitch: each note slides UP into place as the volume swells ("whoop").
_d1: n("0 5").s("scstd").ar_pitch(-7).aratk(0.4).legato(1).osc()

// #45. Tremolo: VCO 1 as a square LFO pumping the volume (vco1 -> vca), 6 times per second.
_d1: n("[0,4,7]").s("scstd").legato(1).o1lf(1).o1lfrate(6).o1wave(1).o1lvl(0).vco1_vca(-0.6).osc()

// #46. Vibrato on ALL oscillators (vco1 -> pitch), compare with 19 (o2fm moves only VCO 2).
_d1: n("0 7").s("scstd").legato(1).o1lf(1).o1lfrate(5).o1lvl(0).vco1_pitch(0.3).o3lvl(0.6).osc()

// #47. Noise -> filter: the tone gets a gritty, breathy, unstable edge.
_d1: n("-12 -5").s("scstd").legato(1).vcfcut(600).vcfres(0.6).noise_vcf("<0 1.5>").osc()

// #48. S&H -> pulse width: the pulse jumps to a random width 6 times per second (random timbre).
_d1: n("-12").s("scstd").legato(1).o1lvl(0).o2wave(1).sh_pw(0.9).shrate(6).vcfcut(3000).vcfenv(0).osc()

// #48 CHECK: filter wide open, low note, slower S&H (3 per second) so each change is clear.
//     OFF: one steady buzzy tone. ON: the tone changes colour 3 times per second (thin/nasal,
//     hollow, full), while the pitch stays the same.
// #48-off:
_d1: n("-24").s("scstd").legato(1).o1lvl(0).o2wave(1).vcfcut(12000).vcfenv(0).sh_pw(0).osc()
// #48-on:
_d1: n("-24").s("scstd").legato(1).o1lvl(0).o2wave(1).vcfcut(12000).vcfenv(0).sh_pw(1).shrate(3).osc()

// #49. FM drone: VCO 3 is unplugged from the keyboard (o3kbd 0) and modulates the pitch of all
//     VCOs at audio rate (vco3 -> pitch). Metallic, and it changes character with each note.
//     (PRESET presets/fm_drone.json)
_d1: n("<0 3 7 5>").s("scstd").legato(1).o1lvl(0).o2wave(3).o3kbd(0).o3oct(-1).vco3_pitch(4).vcfcut(4000).vcfenv(0).arrel(1.5).aratk(0.3).osc()

// #50. Ring mod inputs: VCO 2 (sine) x NOISE (rmb 3) = a band of noise around the note, like a
//     radio between stations. Then VCO 2 x VCO 3 (rmb 2).
_d1: n("0 7").s("scstd").legato(1).o1lvl(0).o2lvl(0).o2wave(3).rmlvl(1).rma(1).rmb("<3 2>").vcfcut(5000).vcfenv(0).osc()

// #51. Keyboard off on VCO 1: VCO 1 holds a drone at middle C while VCO 2 plays the melody.
_d1: n("0 3 5 7 10 7 5 3").s("scstd").o1kbd(0).o1lvl(0.5).legato(1).osc()

// #52. Overriding the normalled (default) connections from the pattern:
//     vcfenv 0 = unplug ADSR -> filter; vcaenv 0 = unplug AR -> VCA (organ-like, no envelope).
_d1: n("0 3 7").s("scstd").legato(1).vcfenv("<0.4 0>").vcaenv("<1 0>").osc()

// #53. PANEL MEMORY. In SuperCollider, open sc/tests/panel_demo.scd and follow it: you load a preset
//     or move a value there, and this plain pattern changes with it (even notes already playing).
_d1: n("0 3 7 10").s("scstd").legato(1).osc()


// =============================================================================================
// Stage 5 — mono mode, audio input (mic / cello), electronic switch, mixer/inverter.
// =============================================================================================

// #54. MONO GLIDE: one continuous voice; overlapping notes (legato 1.1) slide into each other.
//     (PRESET presets/mono_lead.json)
_d1: n("0 7 12 7 3 5 3 -2").s("scstd").monomode(1).glide(0.12).legato(1.1).vcfcut(1800).vcfres(0.4).osc()

// #55. SAME CODE, two modes: first cycle normal (separate notes), second cycle mono (gliding).
_d1: n("0 7 12 7 3 5 3 -2").s("scstd").glide(0.12).legato(1.1).monomode("<0 1>").osc()

// #56. Mono with separated notes (legato 0.5): the envelopes restart on every note, but the pitch
//     still glides from the previous note.
_d1: n("0 12 0 7").s("scstd").monomode(1).glide(0.08).legato(0.5).vcfenv(0.6).vcfcut(400).osc()

// #57. Continuous modulation: the S&H bubbling on the filter keeps its own rhythm across notes in
//     mono (second cycle); in normal mode (first cycle) it restarts with every note.
_d1: n("0 3 5 7").s("scstd").legato(1.1).sh_vcf(2).shrate(3).vcfcut(700).vcfres(0.6).monomode("<0 1>").osc()

// #58. Mono from the PANEL: play example 1 again, then in SuperCollider run
//     ~scstdSet.(\monomode, 1);  (and later ~scstdSet.(\monomode, 0);)
//     The pattern itself does not change; it just becomes mono.
_d1: n("0 3 7 10").s("scstd").glide(0.1).legato(1.05).osc()

// 59-61: AUDIO INPUT. Use HEADPHONES (the Mac mic would pick up the speakers and howl).
//        Speak, sing, clap or play near the Mac's microphone.

// #59. Your sound opens the FILTER: louder = brighter. (PRESET presets/mic_filter.json)
_d1: n("-12").s("scstd").monomode(1).legato(1).envf_vcf(4).vcfcut(200).vcfres(0.5).vcfenv(0).osc()

// #59B. HOW STRONG the mic reacts. Two controls:
//      ingain = mic sensitivity (0-1), affects everything that listens to the mic;
//      the cable amount (envf_vcf here) = how much the mic moves this one thing.
//      One cycle each: ingain 0.2 (subtle), 0.4 (default), 0.7 (very sensitive).
_d1: n("-12").s("scstd").monomode(1).legato(1).envf_vcf(4).vcfcut(200).vcfres(0.5).vcfenv(0).ingain("<0.2 0.4 0.7>").osc()
//      Same sensitivity, smaller cable amount: the filter opens half as much.
_d1: n("-12").s("scstd").monomode(1).legato(1).envf_vcf(2).vcfcut(200).vcfres(0.5).vcfenv(0).osc()
//      Slow follower: reacts smoothly and lets go slowly (efatk/efrel in seconds).
_d1: n("-12").s("scstd").monomode(1).legato(1).envf_vcf(4).vcfcut(200).vcfres(0.5).vcfenv(0).efatk(0.2).efrel(1.5).osc()
//      LIVE: while 59 plays, set the sensitivity from SuperCollider (no pattern change):
//      ~scstdSet.(\ingain, 0.25);   ~scstdSet.(\ingain, 0.5);

// #60. Your sound GATES the synth: it only sounds while you make sound (VCA closed at rest).
_d1: n("<0 5 7 3>").s("scstd").monomode(1).legato(1).vcaenv(0).vcainit(0).envf_vca(1).vcfcut(2500).osc()

// #61. Your sound THROUGH the synth: the mic goes into the filter (VCOs off), with S&H bubbling.
_d1: n("0").s("scstd").monomode(1).legato(1).o1lvl(0).o2lvl(0).inlvl(1).vcaenv(0).vcfcut(900).vcfres(0.8).sh_vcf(2).shrate(5).osc()

// #62. ELECTRONIC SWITCH: flips between VCO 2 and VCO 3 (2 semitones up) 8 times per second: a trill.
_d1: n("0 ~ 5 ~").s("scstd").legato(1).o1lvl(0).o2lvl(0).swlvl(1).swrate(8).o3oct(0.1667).vcfcut(3000).osc()

// #63. MIXER/INVERTER: the ADSR inverted (mixalvl -1) into pitch: each note starts LOW and rises
//     (the opposite of example 43).
_d1: n("-12 ~ -5 ~").s("scstd").legato(1).mixa(5).mixalvl(-1).mixblvl(0).mix_pitch(12).eatk(0.001).edec(0.5).esus(0).osc()

// #64. S&H reading the MIXER: a slow saw (the staircase from 38) plus a little noise, so the
//     staircase gets small random wobbles.
_d1: n("0").s("scstd").legato(1).o1lf(1).o1lfrate(0.75).o1lvl(0).shsrc(4).mixa(0).mixb(3).mixblvl(0.15).sh_pitch(12).shrate(6).vcfcut(3000).vcfenv(0).osc()


// =============================================================================================
// Stage 6 — spring reverb (off by default) and calibration.
// Note: the synth is now 8 dB louder than before (matched to SuperDirt's own sounds).
// =============================================================================================

// #65. Spring reverb on/off: first cycle dry, second cycle with the spring. Listen for the metallic
//     "boing" tail that keeps ringing after each note stops.
_d1: n("0 ~ 7 ~").s("scstd").legato(0.3).spmix("<0 0.5>").osc()

// #66. The classic spring "splash": short, bright plucks with a lot of spring.
_d1: n("0 ~ ~ 12 ~ ~ 7 ~").s("scstd").legato(0.1).vcfenv(0.7).vcfcut(600).edec(0.15).esus(0).spmix(0.8).sptone(0.8).osc()

// #67. Tail length: short (0), medium (0.5), long (1).
_d1: n("0 ~ ~ ~").s("scstd").legato(0.2).spmix(0.6).spdecay("<0 0.5 1>").osc()

// #68. Tone: dark (0) vs bright (1).
_d1: n("0 ~ 7 ~").s("scstd").legato(0.2).spmix(0.6).sptone("<0 1>").osc()

// #69. Reverb from the PANEL: play example 1, then in SuperCollider:
//     ~scstdSet.(\spmix, 0.4);   and later   ~scstdSet.(\spmix, 0);
_d1: n("0 3 7 10").s("scstd").osc()

// #70. Spring on the mic (headphones!): your voice through the filter, then the spring.
_d1: n("0").s("scstd").monomode(1).legato(1).o1lvl(0).o2lvl(0).inlvl(1).vcaenv(0).vcfcut(2500).spmix(0.6).osc()


