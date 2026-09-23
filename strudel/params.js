// Custom controls for Strudel. Paste at the top of a Strudel REPL session
// (strudel.cc or a local REPL). Keep in sync with docs/params.md, tidal/params.hs
// and the UI (CLAUDE.md, decision 8).
//
// createParams (from @strudel/core, checked in v1.2.6) returns an object of control
// functions and also adds each name as a pattern method, so `.tstbright(0.8)` works.

const { tstbright, tstrel } = createParams('tstbright', 'tstrel');
