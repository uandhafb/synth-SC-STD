// Stage 8 parity check: do the Strudel examples make the same events as the Tidal examples?
//   cd analysis && npm install   (once: pinned @strudel/core, mini, transpiler)
//   node analysis/parity_check.mjs [id ...]      (e.g. node analysis/parity_check.mjs 8 40D)
// No sound and no SuperCollider needed. Each example is queried for cycles 0..8:
//   Tidal:   ghci (without ~/.ghci, so nothing is sent anywhere) runs `queryArc` on the pattern
//            from tidal/examples.tidal, using tidal/params.hs.
//   Strudel: the real Strudel packages (same versions as strudel.cc used in Stage 0) evaluate the
//            pattern from strudel/examples.js after strudel/params.js, like the REPL does.
// Then every event is compared: onset, length, and every parameter sent to SuperDirt.
// Example ids: "-- 17A ..." in the Tidal file = "// #17A" in the Strudel file; a second line under
// the same label gets ".2" (e.g. 31.2).
// Two known, harmless differences are allowed:
//   - Strudel sends .legato(x) under the name "clip"; sc/synthdefs/scstd.scd reads both
//     (checked on the real SuperDirt path by sc/tests/strudel_probe.scd + strudel_check.py).
//   - Tidal's and Strudel's random generators drift apart after the first values, so examples
//     using rand/irand/degradeBy are compared by kind: event count within 15%, the same rhythm grid
//     and note lengths, fixed params equal, random params inside Tidal's range ("ALIKE").

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

// @strudel/core imports @kabelsalat/web (a browser-only audio add-on) whose bundle Node cannot
// load. Nothing here needs it, so the checker answers that import with an empty stand-in.
const hook = `export async function resolve(s, c, next) {
  if (s === "@kabelsalat/web") return { url: "data:text/javascript,export class SalatRepl {}", shortCircuit: true };
  return next(s, c);
}`;
register("data:text/javascript," + encodeURIComponent(hook));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CYCLES = 8;
const only = process.argv.slice(2);

// ---- read the examples ------------------------------------------------------------------------

function tidalExamples() {
  const out = [];
  let label = null, count = 0;
  for (const line of fs.readFileSync(path.join(ROOT, "tidal/examples.tidal"), "utf8").split("\n")) {
    const m = line.match(/^--\s+(\d+[A-Z]?(?:-(?:off|on))?)[.\s:(]/);
    if (m) { label = m[1]; count = 0; continue; }
    const d = line.match(/^d1 \$ (.*)$/);
    if (d && label) { count++; out.push({ id: count === 1 ? label : `${label}.${count}`, code: d[1] }); }
  }
  return out;
}

function strudelExamples() {
  const out = [];
  let label = null, count = 0;
  for (const line of fs.readFileSync(path.join(ROOT, "strudel/examples.js"), "utf8").split("\n")) {
    const m = line.match(/^\/\/\s+#(\d+[A-Z]?(?:-(?:off|on))?)[.\s:(]/);
    if (m) { label = m[1]; count = 0; continue; }
    const d = line.match(/^_?d1: (.*)$/);
    if (d && label) { count++; out.push({ id: count === 1 ? label : `${label}.${count}`, code: d[1] }); }
  }
  return out;
}

// ---- Tidal: one ghci run for all examples -----------------------------------------------------

function tidalEvents(examples) {
  const script = [
    ":set -XOverloadedStrings",
    "import Sound.Tidal.Context",
    "import qualified Data.Map.Strict as Map",
    "import Data.List (intercalate)",
    `:script "${path.join(ROOT, "tidal/params.hs")}"`,
    ":{",
    "let fmtV v = case v of { VF x -> show x; VN x -> show (unNote x); VI x -> show x; VR x -> show (fromRational x :: Double); VS x -> x; _ -> show v }",
    "    dump :: String -> ControlPattern -> IO ()",
    `    dump nm p = mapM_ (\\e -> putStrLn $ intercalate "\\t" [nm, show (fromRational (start (wholeOrPart e)) :: Double), show (fromRational (stop (wholeOrPart e)) :: Double), intercalate ";" [k ++ "=" ++ fmtV x | (k, x) <- Map.toList (value e)]]) $ filter eventHasOnset $ queryArc p (Arc 0 ${CYCLES})`,
    ":}",
    ...examples.map((e) => `dump ${JSON.stringify(e.id)} $ ${e.code}`),
  ].join("\n");
  const r = spawnSync("ghci", ["-ignore-dot-ghci", "-v0"], { input: script, encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.stderr.trim()) console.error("ghci says:\n" + r.stderr.trim().split("\n").slice(0, 30).join("\n"));
  return parseDump(r.stdout);
}

function parseDump(text) {
  const ev = new Map();
  for (const line of text.split("\n")) {
    const [id, b, e, kv] = line.split("\t");
    if (kv === undefined) continue;
    const value = {};
    for (const pair of kv.split(";")) { const i = pair.indexOf("="); value[pair.slice(0, i)] = pair.slice(i + 1); }
    if (!ev.has(id)) ev.set(id, []);
    ev.get(id).push({ begin: +b, end: +e, value });
  }
  return ev;
}

// ---- Strudel: evaluate like the REPL ----------------------------------------------------------

async function strudelEvents(examples) {
  const core = await import("@strudel/core");
  const mini = await import("@strudel/mini");
  const { evaluate } = await import("@strudel/transpiler");
  await core.evalScope(core, mini);
  // .osc() only sends; here it must return the pattern unchanged.
  core.Pattern.prototype.osc = function () { return this; };
  await evaluate(fs.readFileSync(path.join(ROOT, "strudel/params.js"), "utf8"));
  const ev = new Map();
  for (const { id, code } of examples) {
    try {
      const { pattern } = await evaluate(code);
      ev.set(id, pattern.queryArc(0, CYCLES).filter((h) => h.hasOnset()).map((h) => {
        // What @strudel/osc 1.3.2 sends (parseControlsFromHap): the hap's values, with n as a number.
        const value = {};
        for (const [k, v] of Object.entries(h.value)) value[k === "clip" ? "legato" : k] = String(k === "n" ? Number(v) : v);
        return { begin: h.whole.begin.valueOf(), end: h.whole.end.valueOf(), value };
      }));
    } catch (err) {
      ev.set(id, { error: String(err.message ?? err) });
    }
  }
  return ev;
}

// ---- compare -----------------------------------------------------------------------------------

const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
const key = (e) => `${e.begin.toFixed(6)} ${e.value.n ?? ""}`;

function compare(t, s) {
  if (!t) return { ok: false, why: ["no Tidal events (Tidal error?)"] };
  if (!s) return { ok: false, why: ["missing from strudel/examples.js"] };
  if (s.error) return { ok: false, why: [`Strudel error: ${s.error}`] };
  const why = [];
  if (t.length !== s.length) why.push(`event count: Tidal ${t.length}, Strudel ${s.length}`);
  const ts = [...t].sort((a, b) => key(a).localeCompare(key(b)));
  const ss = [...s].sort((a, b) => key(a).localeCompare(key(b)));
  const valueDiffs = new Map();   // param -> [count, max difference]
  for (let i = 0; i < Math.min(ts.length, ss.length); i++) {
    const a = ts[i], b = ss[i];
    if (!near(a.begin, b.begin) || !near(a.end, b.end)) {
      why.push(`event ${i}: time Tidal ${a.begin}-${a.end}, Strudel ${b.begin}-${b.end}`);
      break;
    }
    for (const k of new Set([...Object.keys(a.value), ...Object.keys(b.value)])) {
      const x = a.value[k], y = b.value[k];
      if (x === undefined || y === undefined) { why.push(`event ${i}: "${k}" only in ${x === undefined ? "Strudel" : "Tidal"}`); continue; }
      const same = isNaN(+x) || isNaN(+y) ? x === y : near(+x, +y);
      if (!same) {
        const d = valueDiffs.get(k) ?? [0, 0];
        valueDiffs.set(k, [d[0] + 1, Math.max(d[1], isNaN(+x) ? Infinity : Math.abs(+x - +y))]);
      }
    }
  }
  for (const [k, [n, max]] of valueDiffs) why.push(`"${k}" differs in ${n} events (max difference ${+max.toPrecision(3)})`);
  return { ok: why.length === 0, why };
}

// Random examples: the same kind of events, not the same random choices.
function compareRandom(t, s) {
  if (!t || !s || s.error) return compare(t, s);
  const why = [];
  if (Math.abs(s.length - t.length) > 0.15 * t.length) why.push(`event count: Tidal ${t.length}, Strudel ${s.length}`);
  const grid = (evs) => new Set(evs.map((e) => (e.end - e.begin).toFixed(6)));
  const tg = grid(t);
  if ([...grid(s)].some((d) => !tg.has(d))) why.push("note lengths differ");
  const onGrid = (e) => Math.abs(e.begin * 48 - Math.round(e.begin * 48)) < 1e-6;
  if (s.some((e) => !onGrid(e)) !== t.some((e) => !onGrid(e))) why.push("rhythm grid differs");
  const keys = new Set(t.flatMap((e) => Object.keys(e.value)));
  for (const k of keys) {
    const tv = t.map((e) => e.value[k]), sv = s.map((e) => e.value[k]);
    if (sv.some((v) => v === undefined)) { why.push(`"${k}" missing in Strudel`); continue; }
    if (isNaN(+tv[0])) { if (new Set([...tv, ...sv]).size > 1) why.push(`"${k}" differs`); continue; }
    const lo = Math.min(...tv.map(Number)), hi = Math.max(...tv.map(Number)), slack = 0.1 * (hi - lo);
    if (sv.some((v) => +v < lo - slack - 1e-9 || +v > hi + slack + 1e-9)) why.push(`"${k}" outside Tidal's range ${lo}..${hi}`);
  }
  for (const k of new Set(s.flatMap((e) => Object.keys(e.value)))) if (!keys.has(k)) why.push(`"${k}" only in Strudel`);
  return { ok: why.length === 0, why, alike: true };
}

const tEx = tidalExamples().filter((e) => !only.length || only.includes(e.id));
const sEx = strudelExamples().filter((e) => !only.length || only.includes(e.id));
const tEv = tidalEvents(tEx);
const sEv = await strudelEvents(sEx);
let pass = 0, alike = 0;
for (const { id, code } of tEx) {
  const random = /\b(rand|irand|degradeBy)\b/.test(code);
  const r = (random ? compareRandom : compare)(tEv.get(id), sEv.get(id));
  if (r.ok) { pass++; if (random) alike++; }
  const tag = r.ok ? (random ? "ALIKE" : "SAME ") : "DIFF ";
  console.log(`${tag} #${id.padEnd(7)} ${tEv.get(id)?.length ?? 0} events${r.ok ? "" : "\n        " + r.why.slice(0, 6).join("\n        ")}`);
}
const extra = sEx.filter((e) => !tEx.some((t) => t.id === e.id)).map((e) => e.id);
if (extra.length) console.log(`Only in Strudel: ${extra.join(", ")}`);
console.log(`\n${pass}/${tEx.length} examples match: ${pass - alike} identical, ${alike} random ones alike (same kind, different random choices).`);
process.exitCode = pass === tEx.length && !extra.length ? 0 : 1;
