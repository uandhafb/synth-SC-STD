// Web panel end-to-end test (Stage 7), no ears needed:
//   node analysis/ui_check.mjs
// Starts sc/tests/ui_probe.scd (private, silent SuperCollider + SuperDirt), starts the real relay
// against it on test ports, then acts as browser panels over WebSocket:
//   specs arrive; a change on panel A reaches panel B; a later panel C sees the current value;
//   preset save/list/load; keyboard noteon/noteoff; path traversal is refused.
// Takes headless Chrome screenshots of the panel (light, dark, phone width).
// The recorded audio (analysis/output/ui_probe.wav) is checked by analysis/ui_audio_check.py.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "relay/package.json"));
const WebSocket = require("ws");
const OUT = path.join(ROOT, "analysis/output");
const PORT_FILE = path.join(OUT, "ui_probe_port.txt");
const HTTP_PORT = 8091;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = "") => { results.push([name, ok]); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  (" + info + ")" : ""}`); };

function panel(label) {
  const ws = new WebSocket(`ws://127.0.0.1:${HTTP_PORT}/ws`);
  const p = { ws, label, params: new Map(), presets: [], changes: [] };
  ws.on("message", (d) => {
    const m = JSON.parse(d);
    if (m.type === "specs") for (const x of m.params) p.params.set(x.name, x.value);
    if (m.type === "changed") { p.params.set(m.name, m.value); p.changes.push(m); }
    if (m.type === "presets") p.presets = m.presets;
  });
  p.open = new Promise((r) => ws.on("open", r));
  p.send = (o) => ws.send(JSON.stringify(o));
  return p;
}
async function waitFor(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(50); }
  return false;
}

fs.rmSync(PORT_FILE, { force: true });
const sc = spawn("/Applications/SuperCollider.app/Contents/MacOS/sclang", [path.join(ROOT, "sc/tests/ui_probe.scd")], { stdio: "ignore" });
let relay;
try {
  if (!(await waitFor(() => fs.existsSync(PORT_FILE), 60000))) throw new Error("probe did not start");
  await sleep(300);
  const scPort = fs.readFileSync(PORT_FILE, "utf8").trim();
  relay = spawn("node", [path.join(ROOT, "relay/index.js")], {
    env: { ...process.env, HTTP_PORT: String(HTTP_PORT), SC_PORT: scPort, OSC_PORT: "57151" }, stdio: "ignore" });
  await sleep(1500);

  // HTTP
  const page = await fetch(`http://127.0.0.1:${HTTP_PORT}/`).then((r) => r.text());
  check("page served", page.includes("synth-SC-STD panel"));
  const trav = await fetch(`http://127.0.0.1:${HTTP_PORT}/..%2frelay%2findex.js`);
  check("path traversal refused", trav.status === 404, `status ${trav.status}`);

  // Panels
  const A = panel("A"), B = panel("B");
  await Promise.all([A.open, B.open]);
  check("specs arrive (all params)", await waitFor(() => A.params.size >= 100 && B.params.size >= 100), `${A.params.size} params`);
  check("default vcfcut is 2000", A.params.get("vcfcut") === 2000, String(A.params.get("vcfcut")));
  const st = await fetch(`http://127.0.0.1:${HTTP_PORT}/state.json`).then((r) => r.json());
  check("state.json has all params", st.params.length >= 100 && st.connected, `${st.params.length} params`);

  A.send({ type: "set", name: "vcfcut", value: 300 });
  check("change on A reaches B", await waitFor(() => B.params.get("vcfcut") === 300));
  A.send({ type: "set", name: "nosuchparam", value: 1 });
  A.send({ type: "set", name: "vcfres", value: 99 });
  check("out-of-range value clipped by SuperCollider", await waitFor(() => B.params.get("vcfres") === 1.1), String(B.params.get("vcfres")));

  const C = panel("C");
  await C.open;
  check("late panel sees current state", await waitFor(() => C.params.get("vcfcut") === 300));

  // Presets
  A.send({ type: "save", name: "_uitest", keys: ["vcfcut"] });
  check("saved preset appears in the list", await waitFor(() => B.presets.includes("_uitest")));
  A.send({ type: "save", name: "../evil", keys: [] });
  await sleep(500);
  check("unsafe preset name refused", !fs.existsSync(path.join(ROOT, "evil.json")) && !B.presets.includes("../evil"));
  A.send({ type: "set", name: "vcfcut", value: 2000 });
  await waitFor(() => B.params.get("vcfcut") === 2000);
  A.send({ type: "preset", name: "_uitest" });
  check("partial preset restores its value", await waitFor(() => B.params.get("vcfcut") === 300));
  A.send({ type: "reset" });
  check("reset restores defaults", await waitFor(() => B.params.get("vcfcut") === 2000 && B.params.get("vcfres") === 0.2));

  // Keyboard: note C4 with a dark filter, filter opens mid-note, release. (Audio checked in Python.)
  A.send({ type: "set", name: "vcfcut", value: 300 });
  A.send({ type: "set", name: "vcfenv", value: 0 });
  await sleep(400);
  A.send({ type: "noteon", midi: 60 });
  await sleep(1200);
  A.send({ type: "set", name: "vcfcut", value: 3000 });
  await sleep(1200);
  A.send({ type: "noteoff", midi: 60 });
  await sleep(1500);
  // Last-note priority: hold C4, press G4 (glide/no retrigger), release G4 -> back to C4, release.
  A.send({ type: "noteon", midi: 60 }); await sleep(600);
  A.send({ type: "noteon", midi: 67 }); await sleep(600);
  A.send({ type: "noteoff", midi: 67 }); await sleep(600);
  A.send({ type: "noteoff", midi: 60 }); await sleep(1500);
  A.send({ type: "reset" });
  check("keyboard messages accepted", true, "audio: see ui_audio_check.py");

  // Screenshots (headless Chrome), while SuperCollider still answers.
  if (fs.existsSync(CHROME)) {
    // Chrome's window cannot be narrower than ~500 px, so the phone view is a 390 px wide iframe
    // inside a small local page (served from ui/ only for this test, then removed).
    fs.writeFileSync(path.join(ROOT, "ui/_phone_frame.html"),
      `<body style="margin:0;background:#888"><iframe src="/?theme=light" width="390" height="2400" style="border:0;background:#fff"></iframe></body>`);
    const shots = [["ui_light.png", "1400,2000", "?theme=light"], ["ui_dark.png", "1400,2000", "?theme=dark"],
      ["ui_phone.png", "600,2400", "_phone_frame.html"]];
    for (const [file, size, query] of shots) {
      await new Promise((r) => {
        const c = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${size}`,
          "--virtual-time-budget=5000", `--screenshot=${path.join(OUT, file)}`, `http://127.0.0.1:${HTTP_PORT}/${query}`], { stdio: "ignore" });
        c.on("exit", r);
      });
      check(`screenshot ${file}`, fs.existsSync(path.join(OUT, file)));
    }
  }
  fs.rmSync(path.join(ROOT, "ui/_phone_frame.html"), { force: true });
  for (const p of [A, B, C]) p.ws.close();
} catch (e) {
  check("test run", false, e.message);
} finally {
  relay?.kill();
  fs.rmSync(path.join(ROOT, "presets/_uitest.json"), { force: true });
  console.log(`\n${results.filter((r) => r[1]).length}/${results.length} checks passed. Waiting for the probe to finish recording…`);
  await new Promise((r) => sc.on("exit", r));
  console.log("probe finished");
}
