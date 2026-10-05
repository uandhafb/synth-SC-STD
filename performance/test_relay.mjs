// Tests for quake-relay.js. No sound, no internet, no SuperCollider:  node performance/test_relay.mjs
// Fake SuperDirt and Tidal listeners receive the OSC; the USGS feed is replaced by the sample file.
import dgram from "node:dgram";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Relay, describe, ruptureNote } from "./quake-relay.js";
import { decodeOSC } from "./osc.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, total = 0;
const check = (name, ok, info = "") => { total++; if (ok) pass++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info !== "" ? "  (" + info + ")" : ""}`); };

function listener(port) {
  const got = [];
  const sock = dgram.createSocket("udp4");
  sock.on("message", (buf) => got.push({ t: Date.now(), ...decodeOSC(buf) }));
  return new Promise((r) => sock.bind(port, "127.0.0.1", () => r({ got, sock })));
}
const sc = await listener(57951), tidal = await listener(57952);
const sample = JSON.parse(fs.readFileSync(path.join(DIR, "data/sample_day.json"), "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "quake-"));
for (const f of ["sample_day.json", "big.json"]) fs.copyFileSync(path.join(DIR, "data", f), path.join(tmp, f));

let hour = { features: [] }, online = true;
const make = (extra = {}) => new Relay({ scPort: 57951, tidalPort: 57952, dataDir: tmp, log: () => {}, replaySeconds: 3,
  energyFade: 0.4, pollSeconds: 3600,
  fetchJson: async (url) => { if (!online) throw new Error("offline"); return url.includes("all_hour") ? hour : sample; },
  fetchText: async (url) => { if (!online) throw new Error("offline");
    return url.includes("load.php") ? "body{color:#111}" : '<!DOCTYPE html><html><head><link rel="stylesheet" href="/w/load.php?a=1&amp;b=2"><script>alert(1)</script></head><body><div id="mw-content-text"><p>Indonesia and Alaska</p></div></body></html>'; },
  ...extra });
const plays = () => sc.got.filter((m) => m.address === "/dirt/play");
const ctrl = (name) => tidal.got.filter((m) => m.address === "/ctrl" && m.args[0] === name);
const field = (m, k) => m.args[m.args.indexOf(k) + 1];

// ---- replay ----
let r = make();
check("loads the day from the feed", (await r.load()).includes("USGS") && r.day.length === sample.features.length, `${r.day.length} quakes`);
check("saves the day for offline use", fs.existsSync(path.join(tmp, "last_day.json")));
r.start(); r.replay();
await sleep(3400);
const n = plays().length;
check("replay plays every quake once in the set time", n === r.day.length, `${n} notes in 3.4 s`);
const gaps = plays().map((m, i, a) => (i ? m.t - a[i - 1].t : 0));
const realGaps = r.day.map((q, i, a) => (i ? q.time - a[i - 1].time : 0));
const corr = (() => { const mx = gaps.reduce((s, x) => s + x, 0) / n, my = realGaps.reduce((s, x) => s + x, 0) / n;
  let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (gaps[i] - mx) * (realGaps[i] - my); b += (gaps[i] - mx) ** 2; c += (realGaps[i] - my) ** 2; }
  return a / Math.sqrt(b * c); })();
check("the rhythm is the real rhythm of the day, compressed", corr > 0.95, `correlation ${corr.toFixed(3)}`);
check("each note is for scstd on its own orbit", plays().every((m) => field(m, "s") === "scstd" && field(m, "orbit") === 7));
for (const k of ["mag", "depth", "lat", "lon", "energy", "rate"]) {
  const v = ctrl(k).map((m) => m.args[1]);
  check(`Tidal control "${k}" stays within 0..1`, v.length > 0 && v.every((x) => typeof x === "number" && x >= 0 && x <= 1),
    `${v.length} messages, max ${Math.max(...v).toFixed(2)}`);
}
const eMax = Math.max(...ctrl("energy").map((m) => m.args[1]));
await sleep(600);       // the replay rests 4 s before looping; energy must fade meanwhile
const eNow = ctrl("energy").at(-1).args[1];
check("energy rises with quakes and fades afterwards", eMax > 0.3 && eNow < eMax * 0.5, `peak ${eMax.toFixed(2)} -> ${eNow.toFixed(2)}`);

// ---- pause ----
r.replay(); await sleep(300); r.pause();
const atPause = plays().length; await sleep(700);
check("pause stops the quakes", plays().length === atPause);
r.pause(); await sleep(500);
check("continue resumes them", plays().length > atPause);
r.live(); const atLive = plays().length; await sleep(500);
check("live mode plays nothing by itself", plays().length === atLive);

// ---- new earthquakes ----
hour = { features: [{ id: "new1", properties: { mag: 4.2, place: "10 km N of Somewhere", time: Date.now() }, geometry: { coordinates: [10, 20, 30] } }] };
await r.checkNew(); await r.checkNew(); await sleep(100);
check("a newly reported quake plays once", plays().length === atLive + 1, `${plays().length - atLive}`);
r.fireBig(0); r.test(); await sleep(100);
check("big-quake key and test key play", plays().length === atLive + 3);
r.ruptureOn = false; r.test(); await sleep(100);
check("rupture off: data still flows, no note", plays().length === atLive + 3 && ctrl("mag").length > n + 3);
r.stop();

// ---- the projection server ----
r = make();
await r.load(); await r.serve(8096);
const get = (p) => fetch(`http://127.0.0.1:8096${p}`);
const stage = await (await get("/")).text(), wiki = await (await get("/wiki")).text();
check("serves the stage page", stage.includes("ARRIVAL TIMES"));
check("serves the fetched page with the choreography added", wiki.includes("Indonesia and Alaska") && wiki.includes("http://127.0.0.1:8096/choreo.js"));
check("the page's own scripts are removed and its styles copied in", !wiki.includes("alert(1)") && wiki.includes("body{color:#111}") && !wiki.includes("load.php"));
check("credit for the page's text is shown", wiki.includes("Wikipedia contributors") && wiki.includes("CC BY-SA"));
check("files outside web/ are refused", (await get("/..%2fquake-relay.js")).status === 404 && (await get("/%2e%2e/data/big.json")).status === 404);
const got = [];
const es = await get("/events"); const reader = es.body.getReader();
(async () => { for (;;) { const { value, done } = await reader.read(); if (done) break; got.push(new TextDecoder().decode(value)); } })().catch(() => {});
await sleep(100); r.test(); await sleep(200);
check("pages receive each earthquake", got.join("").includes('"type":"quake"') && got.join("").includes("a test quake"));
await reader.cancel().catch(() => {}); r.stop();

// ---- offline ----
online = false; fs.rmSync(path.join(tmp, "last_day.json")); fs.rmSync(path.join(tmp, "page.html"));
r = make();
const src = await r.load();
check("without internet it uses the sample", src.includes("sample_day.json") && r.day.length > 0, src);
check("without internet or a saved copy, a plain page is made from the data", r.pageHtml("http://x").includes("<table>") && r.pageHtml("http://x").includes("choreo.js"), r.pageSource);
r.stop();

// ---- the rupture note ----
const specs = {};
const scText = fs.readFileSync(path.join(DIR, "../sc/synthdefs/00_modules.scd"), "utf8").replace(/\/\/.*/g, "");
for (const m of scText.split("~scstdSpecs = (")[1].split(");")[0].matchAll(/([a-z0-9_]+):\s*\[\s*(-?[\d.]+),\s*(-?[\d.]+)/g)) specs[m[1]] = [Number(m[2]), Number(m[3])];
const standard = new Set(["s", "orbit", "cps", "delta", "legato", "n", "gain", "pan"]);
const pairs = (q) => { const a = ruptureNote(q), o = {}; for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; return o; };
const bad = [];
for (const mag of [1, 2.5, 4, 5.5, 7, 9]) for (const depth of [0, 10, 100, 700]) {
  for (const [k, v] of Object.entries(pairs(describe({ mag, depth, lat: 0, lon: 0 })))) {
    if (standard.has(k)) continue;
    if (!specs[k]) bad.push(`${k}: not a scstd parameter`);
    else if (v < specs[k][0] - 1e-9 || v > specs[k][1] + 1e-9) bad.push(`${k}=${v} outside ${specs[k]}`);
  }
}
check("every rupture setting is a real scstd parameter inside its range", bad.length === 0, [...new Set(bad)].slice(0, 4).join("; "));
const small = pairs(describe({ mag: 3, depth: 10, lat: 0, lon: 0 })), bigQ = pairs(describe({ mag: 6.5, depth: 10, lat: 0, lon: 0 }));
const deep = pairs(describe({ mag: 3, depth: 400, lat: 0, lon: 0 }));
check("bigger quake = lower, longer, louder", bigQ.n < small.n && bigQ.delta > small.delta && bigQ.gain > small.gain, `n ${small.n} -> ${bigQ.n}, ${small.delta.toFixed(1)} s -> ${bigQ.delta.toFixed(1)} s`);
check("deeper quake = darker", deep.vcfcut < small.vcfcut, `${Math.round(small.vcfcut)} Hz -> ${Math.round(deep.vcfcut)} Hz`);

sc.sock.close(); tidal.sock.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass}/${total} checks passed`);
process.exit(pass === total ? 0 : 1);
