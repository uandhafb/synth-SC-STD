// Custom controls for Strudel. Paste at the top of a Strudel REPL session
// (strudel.cc or a local REPL). Keep in sync with docs/params.md, tidal/params.hs
// and the UI (CLAUDE.md, decision 8).
//
// UNVERIFIED (Stage 0 smoke test): `createParams` is Strudel's helper for defining
// new controls. If it is not available in your Strudel version, use the fallback in
// strudel/examples.js (`.set({...})`), which needs no declaration.

const [tstbright, tstrel] = createParams('tstbright', 'tstrel');
