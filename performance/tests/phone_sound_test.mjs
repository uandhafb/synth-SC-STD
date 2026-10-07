// The sound of the phones, measured without a phone (no internet needed):
//   node performance/tests/phone_sound_test.mjs
// Loads the real phone page in headless Chrome and renders its sounds offline (OfflineAudioContext,
// the same code path as on a phone). Checks the ceiling in the worst case, the tuning of the P bell
// and the S tone, and that far stations are duller. Saves analysis/output/phone_room.wav: what
// eight phones would play for the big Indonesian earthquake (listen with: afplay <file>).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Relay } from "../quake-relay.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "analysis/output");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8098, DEVTOOLS = 9226;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, total = 0;
const check = (name, ok, info = "") => { total++; if (ok) pass++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info !== "" ? "  (" + info + ")" : ""}`); };

const relay = new Relay({ scPort: 57951, tidalPort: 57952, log: () => {} });
await relay.load(); await relay.serve(PORT);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "phone-sound-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${DEVTOOLS}`, `--user-data-dir=${profile}`, `http://127.0.0.1:${PORT}/quakes/?room=SOUNDTEST&broker=ws://127.0.0.1:1`], { stdio: "ignore" });
let target; for (let i = 0; i < 100 && !target; i++) { await sleep(150); try { target = (await (await fetch(`http://127.0.0.1:${DEVTOOLS}/json`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ } }
const cdp = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => cdp.addEventListener("open", r));
let id = 0; const pending = new Map();
cdp.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
const js = async (expr) => { const r = await new Promise((res) => { const i = ++id; pending.set(i, res); cdp.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true, awaitPromise: true } })); });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value; };
for (let i = 0; i < 50 && !(await js("!!window.arrivalTimes?.makeAudio")); i++) await sleep(200);

// helpers that run inside the page
await js(`window.T = {
  SR: 44100,
  async render(seconds, fn) { const ctx = new OfflineAudioContext(1, Math.ceil(seconds * 44100), 44100); fn(ctx); return (await ctx.startRendering()).getChannelData(0); },
  peak(d) { let p = 0; for (const x of d) p = Math.max(p, Math.abs(x)); return p; },
  rms(d, a = 0, b = d.length) { let s = 0; for (let i = a; i < b; i++) s += d[i] * d[i]; return Math.sqrt(s / (b - a)); },
  // the strongest frequency between lo and hi (plain Fourier sums, 1 Hz steps) in seconds t0..t1
  pitch(d, lo, hi, t0, t1) { const a = Math.floor(t0 * 44100), b = Math.floor(t1 * 44100); let best = 0, at = 0;
    for (let f = lo; f <= hi; f += 1) { let re = 0, im = 0; const w = 2 * Math.PI * f / 44100; for (let i = a; i < b; i += 2) { re += d[i] * Math.cos(w * i); im += d[i] * Math.sin(w * i); } const m = re * re + im * im; if (m > best) { best = m; at = f; } } return at; },
  // how much of the energy is above 2 kHz (0..1)
  highShare(d) { let lpf = 0, hi = 0, all = 0; const k = 1 - Math.exp(-2 * Math.PI * 2000 / 44100); for (const x of d) { lpf += k * (x - lpf); hi += (x - lpf) ** 2; all += x * x; } return hi / all; },
}; true`);
const A = "window.arrivalTimes";

const ceiling = await js(`${A}.CEILING`);
// 1. the worst case: 40 big shallow waves at the same instant, everything at full level
const worst = await js(`T.render(5, (ctx) => { const a = ${A}.makeAudio(ctx); a.master.gain.value = 1; for (let i = 0; i < 40; i++) { a.pWave(0.5, 1, 0, ${A}.noteOf(i).freq, 1, 1); a.sWave(0.5, 1, 0, 1, ${A}.noteOf(i).freq, 1); } }).then((d) => T.peak(d))`);
check("worst case (40 waves at once, full level) stays under the ceiling", worst <= ceiling + 0.001, `peak ${worst.toFixed(3)}, ceiling ${ceiling}`);
const raw = await js(`T.render(3, (ctx) => { const o = ctx.createOscillator(), g = ctx.createGain(); g.gain.value = 50; const a = ${A}.makeAudio(ctx); o.connect(g).connect(a.master); o.start(); }).then((d) => T.peak(d))`);
check("even a signal 50 times too loud stays under the ceiling", raw <= ceiling + 0.001, `peak ${raw.toFixed(3)}`);

// 2. one big and one small earthquake, as the page plays them (amplitudes from onQuake)
const db = (x) => (20 * Math.log10(x)).toFixed(1) + " dB";
const one = (mag01, strength) => { const loud = Math.min(1, strength * (0.3 + 0.7 * mag01)); return `T.render(10, (ctx) => { const a = ${A}.makeAudio(ctx), f = ${A}.noteOf(1).freq, b = ${Math.max(0, Math.min(1, (strength - 0.2) / 0.8))}; a.pWave(0.2, ${0.5 * loud + 0.05}, 0.3, f, b, ${mag01}); a.sWave(1.5, ${0.6 * loud + 0.05}, 0.3, ${mag01}, f, b); })`; };
const big = await js(`${one(0.9, 0.9)}.then((d) => ({ peak: T.peak(d), p: T.pitch(d, 60, 200, 0.42, 0.72), s: T.pitch(d, 60, 200, 2.2, 4.0), bell: T.rms(d, 8820, 22050), tone: T.rms(d, 70560, 132300), high: T.highShare(d.subarray(8820, 22050)) }))`);
// the dry S hit of this earthquake ends 6.2 s into the render; what is heard after that is the reverb
const tail = await js(`${one(0.9, 0.9).replace("T.render(10", "T.render(13")}.then((d) => ({ dry: T.rms(d, 44100 * 3, 44100 * 4), after1: T.rms(d, 44100 * 7, 44100 * 8), after5: T.rms(d, 44100 * 11, 44100 * 12) }))`);
check("the reverb sustains a big hit after it ends, then dies away", tail.after1 > 0.003 && tail.after5 < tail.after1 / 5, `during ${db(tail.dry)}, 1 s after ${db(tail.after1)}, 5 s after ${db(tail.after5)}`);
const small = await js(`${one(0.2, 0.9)}.then((d) => ({ peak: T.peak(d) }))`);
const far = await js(`${one(0.9, 0.42)}.then((d) => ({ peak: T.peak(d), high: T.highShare(d.subarray(8820, 22050)) }))`);
check("P hit lands on the station's note, low (station 2 = A, 110 Hz)", Math.abs(big.p - 110) <= 4, `${big.p} Hz`);
check("S hit lands on the same note (110 Hz)", Math.abs(big.s - 110) <= 2, `${big.s} Hz`);
check("a big earthquake is clearly heard but not at the ceiling", big.peak > 0.12 && big.peak < ceiling * 0.95, `peak ${db(big.peak)}; knock ${db(big.bell)} rms, wash ${db(big.tone)} rms`);
check("a small earthquake is quieter than a big one", small.peak < big.peak * 0.75, `small ${db(small.peak)}, big ${db(big.peak)}`);
check("a far station is quieter than a near one", far.peak < big.peak, `far ${db(far.peak)}, near ${db(big.peak)}`);
const hi = await js(`T.render(6, (ctx) => { const a = ${A}.makeAudio(ctx); a.sWave(0.5, 0.5, 0.3, 0.9, ${A}.noteOf(2).freq, 0.9); }).then((d) => T.pitch(d, 100, 400, 1.2, 3.0))`);
check("every third phone plays an octave higher (station 3 = F: 175 Hz or its octave, not 87)", (Math.abs(hi - 174.6) <= 3 || Math.abs(hi - 349.2) <= 4) && (await js(`${A}.noteOf(2).high && !${A}.noteOf(0).high && !${A}.noteOf(1).high`)), `${hi} Hz`);
const start = (kind) => js(`T.render(4, (ctx) => { const a = ${A}.makeAudio(ctx); a.setKind(${kind}); a.sWave(0.5, 0.5, 0.3, 0.9, ${A}.noteOf(1).freq, 0.9); }).then((d) => T.rms(d, 22050, 22050 + 6615))`);
const heavy = await start(0), softer = await start(1);
check("three kinds take turns: heavy, soft, high; the soft one has no thump (a gentler start)", softer < heavy * 0.7 && (await js(`[0,1,2,3,4,5].map((i) => ${A}.noteOf(i).kind).join('')`)) === "012012", `first 150 ms: heavy ${db(heavy)}, soft ${db(softer)}`);
const hiss = (v) => js(`T.render(4, (ctx) => { const a = ${A}.makeAudio(ctx); a.groundLevel(${v}); }).then((d) => T.rms(d, 44100 * 2, 44100 * 4))`);
const calm = await hiss(0.15), moving = await hiss(0.6);
check("the live ground is heard, grows when the ground moves, and stays under a big hit", calm > 0.004 && moving > calm * 1.5 && moving < big.tone, `calm ${db(calm)}, moving ${db(moving)}, big hit ${db(big.tone)} rms`);
const notes = await js(`Array.from({ length: 34 }, (_, i) => ${A}.noteOf(i)).map((n) => n.name + Math.round(n.freq))`);
check("every station's note is in D minor pentatonic (played three octaves below these)", notes.every((n) => /^[DFGAC]\d/.test(n)), [...new Set(notes)].join(" "));

// 3. the room: eight phones (stations 0..7) for the Indonesian M 6.5, mixed, saved as a wav
const b64 = await js(`(async () => { const geo = await import('./lib/geo.js'); const q = { lat: -5, lon: 106.9, mag01: 0.9, depth01: 0.52 };
  const d = await T.render(26, (ctx) => { for (let i = 0; i < 8; i++) { const st = geo.STATIONS[i], a = ${A}.makeAudio(ctx), arr = geo.arrivals(geo.distanceDeg(q, st)); a.setKind(${A}.noteOf(i).kind); if (arr.zone === 'shadow') continue;
    const loud = Math.min(1, arr.strength * (0.3 + 0.7 * q.mag01)), n = ${A}.noteOf(i), b = Math.max(0, Math.min(1, (arr.strength - 0.2) / 0.8));
    a.pWave(1 + arr.p * geo.SECONDS_PER_MINUTE, 0.5 * loud + 0.05, q.depth01, n.freq, b, q.mag01);
    if (arr.s !== null) a.sWave(1 + arr.s * geo.SECONDS_PER_MINUTE, 0.6 * loud + 0.05, q.depth01, q.mag01, n.freq, b); } });
  const pcm = new Int16Array(d.length); for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-1, Math.min(1, d[i] / 2)) * 32767;
  let s = ''; const u = new Uint8Array(pcm.buffer); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); })()`);
const pcm = Buffer.from(b64, "base64"), head = Buffer.alloc(44);
head.write("RIFF", 0); head.writeUInt32LE(36 + pcm.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
head.writeUInt32LE(44100, 24); head.writeUInt32LE(88200, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(path.join(OUT, "phone_room.wav"), Buffer.concat([head, pcm]));
console.log("saved analysis/output/phone_room.wav (eight phones, one big earthquake)");

console.log(`\n${pass}/${total} checks passed`);
cdp.close(); chrome.kill(); relay.stop(); await sleep(400); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome still closing */ }
process.exit(pass === total ? 0 : 1);
