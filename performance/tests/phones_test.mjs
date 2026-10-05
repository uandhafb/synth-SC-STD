// End-to-end test of the phones (needs internet: the public broker and the live stations):
//   node performance/tests/phones_test.mjs
// Real relay on silent test ports, three phone pages in headless Chrome joined to a test room.
// Checks: stations are dealt (all different), a big earthquake arrives at each phone as the physics
// says (P and S, shadow zone, or a faint late P), the live ground of each station is received,
// "phones off" silences them, and the stage shows the QR code. Saves screenshots (analysis/output/phone_*.png).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Relay } from "../quake-relay.js";
import { STATIONS, distanceDeg, arrivals, SECONDS_PER_MINUTE } from "../../docs/quakes/lib/geo.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "analysis/output");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8097, DEVTOOLS = 9225, N = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, total = 0;
const check = (name, ok, info = "") => { total++; if (ok) pass++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info !== "" ? "  (" + info + ")" : ""}`); };
const waitFor = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(200); } return false; };

const room = "T" + Math.random().toString(36).slice(2, 7).toUpperCase();
const relay = new Relay({ scPort: 57951, tidalPort: 57952, log: () => {} });
await relay.load(); relay.start(); await relay.serve(PORT);
relay.phones({ room, url: `http://127.0.0.1:${PORT}/quakes/` });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "phones-chrome-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${DEVTOOLS}`, `--user-data-dir=${profile}`,
  "--autoplay-policy=no-user-gesture-required", "--window-size=1600,760", `http://127.0.0.1:${PORT}/`], { stdio: "ignore" });
await waitFor(async () => { try { return (await fetch(`http://127.0.0.1:${DEVTOOLS}/json`)).ok; } catch { return false; } });

async function attach(target, w, h) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map(), errors = [];
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: w < 600 });
  return { errors, send, close: () => ws.close(),
    js: async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true })).result?.value,
    shot: async (name) => fs.writeFileSync(path.join(OUT, name), Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64")) };
}
const stage = await attach((await (await fetch(`http://127.0.0.1:${DEVTOOLS}/json`)).json()).find((t) => t.type === "page"), 1600, 760);
const phones = [];
for (let i = 0; i < N; i++) {
  const target = await (await fetch(`http://127.0.0.1:${DEVTOOLS}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/quakes/?room=${room}`)}`, { method: "PUT" })).json();
  phones.push(await attach(target, 390, 800));
}
await sleep(1500);
check("the phone page loads", (await phones[0].js(`document.querySelector('#join h1').textContent`))?.includes("seismic station"));
await phones[0].shot("phone_0_join.png");
for (const p of phones) { await p.js(`document.getElementById('joinBtn').click()`); await sleep(700); }      // one after the other, like people do

check("every phone becomes a station", await waitFor(async () => (await Promise.all(phones.map((p) => p.js(`window.arrivalTimes.station?.name ?? null`)))).every(Boolean)));
await waitFor(() => relay.roster.size === N, 20000); await sleep(1500);          // the dealing is done (the broker can be slow)
const names = await Promise.all(phones.map((p) => p.js(`window.arrivalTimes.station.name`)));
check("the laptop dealt them different stations, starting with the list's first", new Set(names).size === N && names.includes(STATIONS[0].name), names.join(", "));
check("the relay knows who is in the room", await waitFor(() => relay.roster.size === N), `${relay.roster.size} phones`);
check("the phones are connected to the broker", (await Promise.all(phones.map((p) => p.js(`document.getElementById('status').classList.contains('ok')`)))).every(Boolean));
check("the audio is running", (await phones[0].js(`!!document.querySelector('#station') && !document.querySelector('#station').hidden`)) === true);

// A big deep earthquake in Indonesia: what should each station get?
const q = relay.big[2];
relay.fireBig(2);
const t0 = Date.now();
const expect = names.map((n) => { const st = STATIONS.find((s) => s.name === n), deg = distanceDeg(q, st); return { n, deg, ...arrivals(deg) }; });
console.log("   expected: " + expect.map((e) => `${e.n} ${Math.round(e.deg)}° ${e.zone}${e.s ? ` (S after ${(e.s * SECONDS_PER_MINUTE).toFixed(1)} s)` : ""}`).join(" | "));
await sleep(13500);
const texts = await Promise.all(phones.map((p) => p.js(`document.getElementById('arrival').textContent`)));
expect.forEach((e, i) => {
  const want = e.zone === "shadow" ? "shadow zone" : e.zone === "core" ? "crossed the core" : "S wave";
  check(`${e.n}: ${e.zone === "direct" ? "P then S wave arrive" : e.zone === "shadow" ? "nothing, it is in the shadow zone" : "only a faint late P"}`, texts[i].includes(want) && texts[i].includes("Teluknaga"), texts[i].replace(/\s+/g, " ").slice(0, 80));
});
await phones[1].shot("phone_1_arrival.png");

// (asked from the page's own state: tabs in the background do not redraw in a headless browser)
check("each phone receives the live ground of its own station", await waitFor(async () => (await Promise.all(phones.map((p) => p.js(`window.arrivalTimes.groundLive`)))).every(Boolean), 110000),
  (await Promise.all(phones.map((p) => p.js(`window.arrivalTimes.groundLive`)))).join(", "));
await phones[0].send("Page.bringToFront"); await sleep(1500);
await phones[0].shot("phone_2_ground.png");

relay.setPhones({ on: false }); await sleep(1500);
const before = await phones[1].js(`document.getElementById('arrival').textContent`);
relay.test(); await sleep(6000);
check("phones off: they rest and receive nothing", before.includes("resting") && (await phones[1].js(`document.getElementById('arrival').textContent`)).includes("resting"));
relay.setPhones({ on: true });

check("the stage shows how many phones are stations", (await stage.js(`document.getElementById('room').textContent`)).includes(`${N} phones`), await stage.js(`document.getElementById('room').textContent`));
await stage.js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }))`); await sleep(400);
check("the QR code opens on the stage", (await stage.js(`!document.getElementById('qr').hidden && document.querySelectorAll('#qrCode svg').length`)) === 1, await stage.js(`document.getElementById('qrUrl').textContent`));
await stage.shot("stage_5_qr.png");
const errs = [...stage.errors, ...phones.flatMap((p) => p.errors)];
check("no errors on any page", errs.length === 0, [...new Set(errs)].slice(0, 3).join(" | "));

for (const p of [stage, ...phones]) p.close();
chrome.kill(); relay.mq.publish(`arrivaltimes/v1/${room}/state`, "", { retain: true }); await sleep(400); relay.stop();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome still closing */ }
console.log(`\n${pass}/${total} checks passed`);
process.exit(pass === total ? 0 : 1);
