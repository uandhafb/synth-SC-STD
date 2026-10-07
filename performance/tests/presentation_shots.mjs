// Looks at the presentation without a projector or a real camera:
//   node performance/tests/presentation_shots.mjs
// Real relay on silent test ports, the page in headless Chrome with Chrome's fake camera (a moving
// test pattern, no hands in it). Checks that everything loads (Hydra, the hand tracker, the camera),
// that the keys move through all blocks and the questions open, measures the frame rate, and saves
// screenshots to analysis/output/presentation_*.png. The gesture logic has its own test:
//   node performance/web/presentation/gesture_test.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Relay } from "../quake-relay.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "analysis/output");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8099, DEVTOOLS = 9227, W = 1600, H = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, total = 0;
const check = (name, ok, info = "") => { total++; if (ok) pass++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info !== "" ? "  (" + info + ")" : ""}`); };

const relay = new Relay({ scPort: 57951, tidalPort: 57952, log: () => {} });
await relay.load(); relay.start(); await relay.serve(PORT);
if (process.env.GROUND !== "off") relay.listen();
if (process.env.PHONES !== "off") relay.phones({ room: "PRESTEST", url: "https://uandhafb.github.io/synth-SC-STD/quakes/" });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "presentation-chrome-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${DEVTOOLS}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, "--hide-scrollbars",
  "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
  `http://127.0.0.1:${PORT}/presentation/index.html`], { stdio: "ignore" });
let target;
for (let i = 0; i < 100 && !target; i++) { await sleep(150); try { target = (await (await fetch(`http://127.0.0.1:${DEVTOOLS}/json`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ } }
const cdp = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => cdp.addEventListener("open", r));
let id = 0; const pending = new Map(); const logs = [];
cdp.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("console.error " + m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); cdp.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true })).result?.value;
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, `presentation_${name}.png`), Buffer.from(r.data, "base64")); };
const key = async (k) => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k.length === 1 ? `Key${k.toUpperCase()}` : k, windowsVirtualKeyCode: { ArrowRight: 39, ArrowLeft: 37, Escape: 27 }[k] ?? k.toUpperCase().charCodeAt(0) }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k }); };
const waitFor = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expr)) return true; await sleep(250); } return false; };

await waitFor("!!window.presentation");
const blocks = await js("document.querySelectorAll('#deck .block').length");
check("the page builds its blocks from content.js", blocks >= 8, `${blocks} blocks`);
await shot("0_start");
await js("document.getElementById('startBtn').click()");
check("the camera starts and the hand tracker loads (from the laptop, no internet)", await waitFor("!!window.presentation.hands", 30000), await js("document.getElementById('camTxt').textContent"));
check("the camera is inside the visuals", await js("window.presentation.L.cam === true"));
await sleep(2500);
check("the first block is on screen", await js("document.querySelector('#deck .block.on')?.dataset.id") === "title");
const ids = [];
for (let i = 0; i < blocks; i++) { await sleep(1300); ids.push(await js("document.querySelector('#deck .block.on')?.dataset.id")); await shot(`${i + 1}_${ids[i]}`); await key("ArrowRight"); if (i === 0) { await sleep(180); await shot("transition"); } }
check("the right arrow goes through every block, in order", new Set(ids).size === blocks, ids.join(" → "));
check("no block is taller than the screen", await js("[...document.querySelectorAll('#deck .block')].every((b) => b.scrollHeight <= innerHeight * 0.96)"), await js("[...document.querySelectorAll('#deck .block')].map((b) => Math.round(100 * b.scrollHeight / innerHeight) + '%').join(' ')"));
await key("ArrowLeft"); await sleep(400);
check("the left arrow goes back", await js("window.presentation.at") === blocks - 2);
await key("q"); await sleep(300); await key("1"); await sleep(400); await shot("qa");
check("Q opens the questions and a number shows an answer", await js("!document.getElementById('qa').hidden && !document.getElementById('qaAnswer').hidden && document.querySelectorAll('#qaList li').length") >= 8);
await key("ArrowRight"); await sleep(200);
check("while the questions are open the arrows do not turn the blocks", await js("window.presentation.at") === blocks - 2);
await key("Escape"); await sleep(200);
check("Esc closes the questions", await js("document.getElementById('qa').hidden"));
check("the page hears the live ground through the relay", process.env.GROUND === "off" || await waitFor("window.presentation.L.ground > 0", 25000), await js("window.presentation.L.ground.toFixed(3)"));
check("the QR code of the room is drawn", process.env.PHONES === "off" || await waitFor("document.querySelectorAll('#qrCode svg').length === 1", 15000), await js("document.getElementById('qrUrl').textContent"));
const fps = await js("new Promise((done) => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else done(Math.round(n / 3)); })(); })");
console.log(`frames per second in this test browser (software rendering, so lower than on the real screen): ${fps}`);
// The relay serves .wasm files without their special type, so the hand tracker says so and loads
// them the slower way (once, at start). That is expected and harmless.
const real = logs.filter((l) => !/wasm streaming compile failed|falling back to ArrayBuffer instantiation/.test(l));
check("no errors on the page", real.length === 0, [...new Set(real)].slice(0, 4).join(" | "));
console.log(`\n${pass}/${total} checks passed`);
cdp.close(); chrome.kill(); relay.stop(); await sleep(500); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome still closing */ }
process.exit(pass === total ? 0 : 1);
