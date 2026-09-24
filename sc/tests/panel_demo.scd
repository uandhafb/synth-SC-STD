// Panel memory demo (Stage 4). Needs sc/startup.scd running.
// In VS Code play example 53:   d1 $ n "0 3 7 10" # s "scstd" # legato 1
// Then click on each line below and press Shift+Enter, and listen to the pattern change.

~scstdSet.(\vcfcut, 300);          // darker (even the note that is already sounding)
~scstdSet.(\vcfcut, 4000);         // brighter
~scstdSet.(\vcfres, 0.9);          // resonant
~scstdSet.(\sh_vcf, 2);            // patch S&H -> filter: bubbling
~scstdSet.(\sh_vcf, 0);            // unpatch
~scstdGet.(\vcfcut).postln;        // read a value (shown in the Post window)

~scstdLoadPreset.("wind");         // the whole panel becomes the wind preset
~scstdLoadPreset.("laser_zap");
~scstdLoadPreset.("ringmod_bell");
~scstdLoadPreset.("fm_drone");

~scstdSet.(\monomode, 1);         // Stage 5: the same pattern becomes one gliding mono voice
~scstdSet.(\glide, 0.2);           // slower glide
~scstdSet.(\monomode, 0);         // back to normal (polyphonic) mode

~scstdSet.(\ingain, 0.25);        // Stage 5: less mic sensitivity (examples 59-61)
~scstdSet.(\ingain, 0.6);         // more mic sensitivity

// SAVE settings for next time (files go into presets/):
~scstdSavePreset.("venue_example", [\ingain, \efatk, \efrel]);  // only the mic settings (partial)
~scstdLoadPreset.("venue_example");                               // next performance: load them back
~scstdSavePreset.("my_sound");     // the whole current sound (everything that differs from default)

~scstdSet.(\spmix, 0.4);          // Stage 6: spring reverb on (0 = off)
~scstdSet.(\spmix, 0);

~scstdReset.();                    // back to the default sound

// Note: a value written in the Tidal pattern always wins over the panel.
// Try: d1 $ n "0 3 7 10" # s "scstd" # legato 1 # vcfcut 2000   -> ~scstdSet.(\vcfcut, 300) does nothing.
