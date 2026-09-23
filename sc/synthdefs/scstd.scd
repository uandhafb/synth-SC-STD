// synth-SC-STD — the main voice `scstd` (event mode: one synth per Tidal/Strudel event).
// Needs 00_modules.scd loaded first (sc/startup.scd loads synthdefs/ in alphabetical order).
//
// Play from Tidal:    d1 $ n "0 3 7" # s "scstd" # vcfcut 800
// Play from Strudel:  n("0 3 7").s("scstd").vcfcut(800).osc()

(
// Captured now: the sustain function below runs inside SuperDirt's event environment,
// where project variables like ~scstdDefault are not visible.
var defErel = ~scstdDefault.(\erel), defArrel = ~scstdDefault.(\arrel);

SynthDef(\scstd, { |out, pan = 0, freq = 220, sustain = 1|
	var p = ~scstdParams.();
	var sig = ~scstdMods[\voice].(p, freq, sustain);
	OffsetOut.ar(out, DirtPan.ar(sig, ~dirt.numChannels, pan));
}).add;

// Register with SuperDirt. `sustain` = note length + the longer release, so SuperDirt's
// dirt_gate does not cut the tail (CLAUDE.md, Section 5). A pattern `sustain` overrides this.
~dirt.soundLibrary.addSynth(\scstd, (
	instrument: \scstd,
	sustain: {
		var len = (~delta.value ? 0.25) * (~legato.value ? 1);
		var rel = max((~erel.value ? defErel).clip(0.001, 15), (~arrel.value ? defArrel).clip(0.001, 15));
		len + rel
	}
));

"[synth] scstd loaded".postln;
)
