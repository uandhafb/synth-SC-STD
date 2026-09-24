// synth-SC-STD — panel state (Architecture decisions 2 and 3).
// One control bus per parameter. sclang owns the state (~scstdState); the buses mirror it on the
// server. The synth reads a bus whenever the pattern does not send that parameter, so changing
// the panel also changes notes that are already sounding.
// Loaded by sc/startup.scd after 00_modules.scd (needs ~scstdSpecs) and before scstd.scd.
//
// From SuperCollider:
//   ~scstdSet.(\vcfcut, 500);        // change one value (clipped to its range)
//   ~scstdGet.(\vcfcut);             // read it
//   ~scstdReset.();                  // all values back to defaults
//   ~scstdLoadPreset.("wind");       // load presets/wind.json into the panel
//   ~scstdSavePreset.("venue", [\ingain]);   // save (all changed params, or only the listed ones)
// Over OSC (for the web panel, Stage 7), to sclang's port (57120):
//   /scstd/set <name> <value>    /scstd/reset    /scstd/preset <name>

(
var srv = Server.default;
var root = thisProcess.nowExecutingPath.dirname.dirname;

// Buses are (re)allocated on every load of this file from startup (the server may have rebooted,
// which resets its allocators). The state survives, so panel values are kept across reloads.
~scstdBuses = ();
~scstdState = ~scstdState ?? { () };
~scstdSpecs.keysValuesDo { |name, spec|
	~scstdBuses[name] = Bus.control(srv, 1);
	if(~scstdState[name].isNil) { ~scstdState[name] = spec[2] };
};
// Drop state for params that no longer exist (renamed in a later version).
~scstdState.keys.copy.do { |k| if(~scstdSpecs[k].isNil) { ~scstdState.removeAt(k) } };

// Called after every change; the relay (Stage 7) will hook in here to update all panels.
~scstdChanged = ~scstdChanged ?? { { |name, value| } };

~scstdSet = { |name, value|
	var spec;
	name = name.asSymbol;
	spec = ~scstdSpecs[name];
	if(spec.isNil) {
		"scstd: unknown param %".format(name).warn;
	} {
		value = value.asFloat.clip(spec[0], spec[1]);
		~scstdState[name] = value;
		if(Server.default.serverRunning) { ~scstdBuses[name].set(value) };
		~scstdChanged.(name, value);
	};
	value
};

~scstdGet = { |name| ~scstdState[name.asSymbol] };

~scstdReset = { ~scstdSpecs.keysValuesDo { |k, spec| ~scstdSet.(k, spec[2]) }; "scstd: panel reset".postln };

// Load a preset JSON (presets/<name>.json) into the panel: reset, then apply its params.
// Afterwards a plain pattern like  d1 $ n "0 3 7" # s "scstd"  plays the preset sound.
// A preset saved with only some params ("partial": true, e.g. a venue's mic sensitivity) is
// applied without the reset, so the rest of the sound stays as it is.
~scstdLoadPreset = { |name|
	var path = root +/+ "presets" +/+ name.asString ++ ".json";
	var json;
	if(File.exists(path).not) {
		"scstd: no preset %".format(path).warn;
	} {
		json = File.readAllString(path).parseJSON;
		if(json["partial"] != "true") { ~scstdReset.() };
		// parseJSON returns numbers as strings.
		json["params"].keysValuesDo { |k, v| ~scstdSet.(k, v.asFloat) };
		"scstd: loaded preset %".format(name).postln;
	}
};

// Save the current panel as presets/<name>.json.
//   ~scstdSavePreset.("my_sound");                          // everything that differs from default
//   ~scstdSavePreset.("venue_hall", [\ingain, \efatk, \efrel]); // only these (a "partial" preset)
// Partial presets are loaded without resetting the rest (see ~scstdLoadPreset).
~scstdSavePreset = { |name, keys|
	var path = root +/+ "presets" +/+ name.asString ++ ".json";
	var partial = keys.notNil;
	var names = (keys ?? {
		~scstdSpecs.keys.asArray.select { |k| ~scstdState[k] != ~scstdSpecs[k][2] }
	}).asArray.collect(_.asSymbol).sort;
	var params = names.collect { |k| "    \"%\": %".format(k, ~scstdState[k].round(0.0001)) }.join(",\n");
	var tidal = names.collect { |k| var v = ~scstdState[k].round(0.0001); "# % %".format(k, if(v < 0) { "(" ++ v ++ ")" } { v }) }.join(" ");
	File.use(path, "w", { |f|
		f.write("{\n  \"name\": \"%\",\n  \"sound\": \"scstd\",\n  \"partial\": %,\n".format(name, partial));
		f.write("  \"description\": \"Saved from the panel with ~scstdSavePreset.\",\n");
		f.write("  \"params\": {\n" ++ params ++ "\n  },\n");
		f.write("  \"tidal\": \"d1 $ n \\\"0 3 7\\\" # s \\\"scstd\\\" %\"\n}\n".format(tidal));
	});
	"scstd: saved % (% params%)".format(path, names.size, if(partial) { ", partial" } { "" }).postln;
	path
};

// Offline tests (NRT) have no running server: this message sets every bus to its state value
// at time 0 of a Score.
~scstdBusInitMsg = {
	[\c_set] ++ ~scstdSpecs.keys.asArray.collect { |k| [~scstdBuses[k].index, ~scstdState[k]] }.flatten
};

// Push the state to the server now (if it is running).
if(srv.serverRunning) { ~scstdState.keysValuesDo { |k, v| ~scstdBuses[k].set(v) } };

// OSC: the functions run from the OSC thread, so look them up in the top environment.
OSCdef(\scstdSet, { |msg| topEnvironment[\scstdSet].(msg[1], msg[2]) }, '/scstd/set');
OSCdef(\scstdReset, { topEnvironment[\scstdReset].() }, '/scstd/reset');
OSCdef(\scstdPreset, { |msg| topEnvironment[\scstdLoadPreset].(msg[1]) }, '/scstd/preset');

"[synth] panel buses ready (% params)".format(~scstdSpecs.size).postln;
)
