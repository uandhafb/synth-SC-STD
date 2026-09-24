// Real-browser test of the web panel (Stage 7): headless Chrome driven over the DevTools
// protocol interacts with the page like a user; an observer panel (WebSocket) checks that
// SuperCollider received each action, and that outside changes show up in the page.
//   node analysis/ui_browser_check.mjs
// Uses the private, silent SuperCollider probe (sc/tests/ui_probe.scd) and the real relay.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "relay/package.json"));
const WebSocket = require("ws");
const OUT = path.join(ROOT, "analysis/output");
const PORT_FILE = path.join(OUT, "ui_probe_port.txt");
const HTTP_PORT = 8092, DEVTOOLS = 9223;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info !== "" ? "  (" + info + ")" : ""}`); };
async function waitFor(fn, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(100); }
  return false;
}

fs.rmSync(PORT_FILE, { force: true });
const sc = spawn("/Applications/SuperCollider.app/Contents/MacOS/sclang", [path.join(ROOT, "sc/tests/ui_probe.scd")], { stdio: "ignore" });
let relay, chrome;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "scstd-chrome-"));
try {
  if (!(await waitFor(() => fs.existsSync(PORT_FILE), 60000))) throw new Error("probe did not start");
  await sleep(300);
  relay = spawn("node", [path.join(ROOT, "relay/index.js")], {
    env: { ...process.env, HTTP_PORT: String(HTTP_PORT), SC_PORT: fs.readFileSync(PORT_FILE, "utf8").trim(), OSC_PORT: "57152" }, stdio: "ignore" });
  await sleep(1500);

  // Observer panel
  const obs = { params: new Map() };
  const ows = new WebSocket(`ws://127.0.0.1:${HTTP_PORT}/ws`);
  ows.on("message", (d) => { const m = JSON.parse(d); if (m.type === "specs") for (const x of m.params) obs.params.set(x.name, x.value); if (m.type === "changed") obs.params.set(m.name, m.value); });
  await new Promise((r) => ows.on("open", r));

  // Browser
  chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${DEVTOOLS}`, `--user-data-dir=${profile}`,
    "--window-size=1400,2000", `http://127.0.0.1:${HTTP_PORT}/?theme=light`], { stdio: "ignore" });
  let target;
  await waitFor(async () => {
    try { target = (await (await fetch(`http://127.0.0.1:${DEVTOOLS}/json`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ }
    return !!target;
  }, 15000);
  const cdp = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => cdp.on("open", r));
  let id = 0;
  const pending = new Map();
  cdp.on("message", (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const js = (expr) => new Promise((r) => { const i = ++id; pending.set(i, (m) => r(m.result?.result?.value)); cdp.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true } })); });

  check("page connects (status ok)", await waitFor(async () => await js(`document.querySelector('#status').classList.contains('ok')`), 10000),
    await js(`document.querySelector('.status-text').textContent`));
  check("controls built from SuperCollider", (await js(`document.querySelectorAll('.ctl').length`)) >= 60, await js(`document.querySelectorAll('.ctl').length`));

  // Slider: cutoff to position 0.25 of its log range (20..18000 Hz -> ~110 Hz)
  await js(`(() => { const i = document.querySelector('#ctl-vcfcut'); i.value = 250; i.dispatchEvent(new Event('input', {bubbles: true})); })()`);
  check("slider moves SuperCollider's value", await waitFor(() => Math.abs(obs.params.get("vcfcut") - 20 * Math.pow(900, 0.25)) < 1), obs.params.get("vcfcut"));
  // Toggle
  await js(`document.querySelector('#ctl-monomode').click()`);
  check("switch click", await waitFor(() => obs.params.get("monomode") === 1), obs.params.get("monomode"));
  await js(`document.querySelector('#ctl-monomode').click()`);
  await waitFor(() => obs.params.get("monomode") === 0);
  // Choice buttons: S&H input -> "mixer" (index 4)
  await js(`[...document.querySelectorAll('#ctl-shsrc button')].find(b => b.textContent === 'mixer').click()`);
  check("choice buttons", await waitFor(() => obs.params.get("shsrc") === 4), obs.params.get("shsrc"));
  // Matrix cable slider: S&H -> filter at position 0.75 of -6..6 = +3 octaves
  await js(`(() => { const i = document.querySelector('input[aria-label="S&H → filter"]'); i.value = 750; i.dispatchEvent(new Event('input', {bubbles: true})); })()`);
  check("patch matrix cable", await waitFor(() => Math.abs(obs.params.get("sh_vcf") - 3) < 0.01), obs.params.get("sh_vcf"));
  check("cable drawn in the cable view", await waitFor(async () => (await js(`document.querySelectorAll('#cables path.cable').length`)) >= 3),
    await js(`document.querySelectorAll('#cables path.cable').length`));
  // Double-click the label: back to default
  await js(`document.querySelector('label[for="ctl-vcfcut"]').dispatchEvent(new MouseEvent('dblclick', {bubbles: true}))`);
  check("double-click resets to default", await waitFor(() => obs.params.get("vcfcut") === 2000), obs.params.get("vcfcut"));
  // Outside change (another panel / SuperCollider) shows up in the page
  ows.send(JSON.stringify({ type: "set", name: "vcfres", value: 0.9 }));
  check("outside change shown in the page", await waitFor(async () => (await js(`document.querySelector('#ctl-vcfres').parentElement.querySelector('.val').textContent`)) === "0.90"),
    await js(`document.querySelector('#ctl-vcfres').parentElement.querySelector('.val').textContent`));
  // Preset: choose "wind" and Load
  await js(`(() => { const s = document.querySelector('#preset-select'); s.value = 'wind'; document.querySelector('#preset-load').click(); })()`);
  check("preset load from the page", await waitFor(() => obs.params.get("nzlvl") === 1 && Math.abs(obs.params.get("spdecay") - 0.5) < 0.01), `nzlvl ${obs.params.get("nzlvl")}`);
  await js(`document.querySelector('#reset') && (window.confirm = () => true, document.querySelector('#reset').click())`);
  check("reset button", await waitFor(() => obs.params.get("nzlvl") === 0 && obs.params.get("sh_vcf") === 0), `nzlvl ${obs.params.get("nzlvl")}`);
  // Computer keyboard: "a" = C3 (held 1 s), recorded by the probe (checked in the audio below)
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', {key: 'a'}))`);
  const keyDownMark = await js(`document.querySelector('.key[data-midi="48"]').classList.contains('down')`);
  await sleep(1000);
  await js(`window.dispatchEvent(new KeyboardEvent('keyup', {key: 'a'}))`);
  check("computer key lights the on-screen key", keyDownMark === true);
  check("key released (no stuck key shown)", (await js(`document.querySelectorAll('.key.down').length`)) === 0);
  // Theme button cycles
  await js(`document.querySelector('#theme').click()`);
  check("theme button", (await js(`document.documentElement.dataset.theme`)) === "dark");
  cdp.close();
  ows.close();
} catch (e) {
  check("test run", false, e.message);
} finally {
  chrome?.kill();
  relay?.kill();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed. Waiting for the probe to finish…`);
  await new Promise((r) => sc.on("exit", r));
  fs.rmSync(profile, { recursive: true, force: true });
  console.log("probe finished");
}
