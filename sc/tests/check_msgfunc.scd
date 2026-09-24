// Checks that every scstd parameter reaches the synth when played through SuperDirt.
// SuperDirt builds synth arguments with SynthDesc.msgFunc, which renames or drops some control
// names (e.g. a 2nd character "_" is read as a rate prefix: "m_sh_pitch" became "sh_pitch").
// Offline renders pass names directly and cannot catch this, so this test is needed.
// Run (no audio needed, exits by itself):
//   /Applications/SuperCollider.app/Contents/MacOS/sclang sc/tests/check_msgfunc.scd

(
var root = thisProcess.nowExecutingPath.dirname.dirname.dirname;
var desc, argNames, missing;
~dirt = ~dirt ?? { (numChannels: 2, soundLibrary: (addSynth: { })) };
(root +/+ "sc/synthdefs/00_modules.scd").load;
(root +/+ "sc/synthdefs/scstd.scd").load;
// Event synth: every param except the sclang-only and mono-only ones must be a msgFunc argument.
desc = SynthDescLib.global[\scstd];
argNames = desc.msgFunc.def.argNames.asArray;
missing = ~scstdSpecs.keys.asArray.sort.reject { |k|
	argNames.includes(k) or: { ~scstdLangOnly.includes(k) or: { ~scstdMonoOnly.includes(k) } }
};
if(missing.isEmpty) {
	"MSGFUNC OK: all % event-synth params reach the synth through SuperDirt".format(~scstdSpecs.size).postln;
} {
	"MSGFUNC FAIL: these params would be dropped by SuperDirt: %".format(missing).postln;
};
// Mono synth: set directly with n_set, so every param except sclang-only ones must be a control.
argNames = SynthDescLib.global[\scstd_mono].controlNames.asArray;
missing = ~scstdSpecs.keys.asArray.sort.reject { |k| argNames.includes(k) or: { ~scstdLangOnly.includes(k) } };
if(missing.isEmpty) {
	"MONO OK: the mono synth has a control for every param".postln;
} {
	"MONO FAIL: missing controls in scstd_mono: %".format(missing).postln;
};
0.exit;
)
