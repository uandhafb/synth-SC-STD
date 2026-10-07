// Looks at the projection without a projector: starts the real relay on silent test ports
// (nothing is sent to a running SuperCollider or Tidal), opens the stage in headless Chrome,
// fires earthquakes and saves screenshots to analysis/output/stage_*.png.
//   node performance/tests/stage_shots.mjs [width height]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Relay, describe } from "../quake-relay.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "analysis/output");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [W, H] = [Number(process.argv[2] ?? 1920), Number(process.argv[3] ?? 760)];
const PORT = 8097, DEVTOOLS = 9224;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const relay = new Relay({ scPort: 57951, tidalPort: 57952, log: (m) => console.log("relay:", m) });
await relay.load(); relay.start(); await relay.serve(PORT);
relay.listen();                                      // the live seismometer (needs internet)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "stage-chrome-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${DEVTOOLS}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, "--hide-scrollbars", `http://127.0.0.1:${PORT}/`], { stdio: "ignore" });
let target;
for (let i = 0; i < 100 && !target; i++) {
  await sleep(150);
  try { target = (await (await fetch(`http://127.0.0.1:${DEVTOOLS}/json`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ }
}
const cdp = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => cdp.addEventListener("open", r));
let id = 0; const pending = new Map(); const logs = [];
cdp.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("console.error " + m.params.args.map((a) => a.value ?? a.description).join(" ")); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); cdp.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, `stage_${name}.png`), Buffer.from(r.data, "base64")); console.log("saved", `stage_${name}.png`); };
const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

await sleep(13000);                                  // page + Wikipedia copy + land outlines + the first live seconds
await shot("0_quiet");
relay.fire(describe({ id: "a", mag: 4.4, depth: 35, lat: -6.2, lon: 130.1, place: "142 km NE of Tual, Indonesia", time: Date.now() - 3600e3 }));
await sleep(2000); await shot("1_small");
console.log("after a small quake: breathing still running:", await js(`document.getElementById('page').contentDocument.getAnimations().some(a => a.effect.getComputedTiming().iterations === Infinity && a.playState === 'running')`),
  "| headings moving:", await js(`[...document.getElementById('page').contentDocument.querySelectorAll('h1,h2,h3,h4,caption,th,figcaption')].filter(el => el.getAnimations().length).length`));
await sleep(3500); await shot("2_small_later");
relay.fireBig(2);                                    // Indonesia, M 6.5, 372 km deep
await sleep(2300); await shot("3_big");
console.log("after a big quake: breathing paused:", await js(`!document.getElementById('page').contentDocument.getAnimations().some(a => a.effect.getComputedTiming().iterations === Infinity)`));
await sleep(2500); await shot("4_big_later");
console.log("strip:", await js(`[...document.querySelectorAll('#strip .line')].map(l => l.textContent).join(' || ')`));
console.log("words on the page that can move:", await js(`document.getElementById('page').contentDocument.querySelectorAll('.choreo-w').length`));
console.log("page title:", await js(`document.getElementById('page').contentDocument.title`));
if (logs.length) console.log("PAGE ERRORS:\n  " + [...new Set(logs)].slice(0, 8).join("\n  ")); else console.log("no page errors");
cdp.close(); chrome.kill(); relay.stop();
await sleep(500); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome still closing */ }
process.exit(0);
