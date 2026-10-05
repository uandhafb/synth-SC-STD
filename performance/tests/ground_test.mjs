// Tests for ground.js (the live seismometer signal) without the network:  node performance/tests/ground_test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeRecord, Ground } from "../ground.js";
let pass = 0, total = 0;
const check = (name, ok, info = "") => { total++; if (ok) pass++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info !== "" ? "  (" + info + ")" : ""}`); };
const DIR = path.dirname(fileURLToPath(import.meta.url));

// A real record captured from CN.MNTQ HHZ (Montréal) on 2026-10-05.
const rec = decodeRecord(new Uint8Array(Buffer.from(fs.readFileSync(path.join(DIR, "ground_packet.b64"), "utf8"), "base64")));
check("decodes a real record", rec && rec.samples.length === 250 && rec.rate === 100, rec && `${rec.samples.length} samples at ${rec.rate} Hz`);
check("its first samples are the recorded ones", rec.samples.slice(0, 5).join(",") === "255,330,444,431,275", rec.samples.slice(0, 5).join(","));
check("its time is the capture time", new Date(rec.start).toISOString().startsWith("2026-10-05T22:"), new Date(rec.start).toISOString());
const jumps = rec.samples.slice(1).map((x, i) => Math.abs(x - rec.samples[i]));
check("the waveform is continuous (no decoding glitches)", Math.max(...jumps) < 2000, `largest step ${Math.max(...jumps)}`);
check("rejects data that is not a record", decodeRecord(new Uint8Array(100)) === null);

// The signal: quiet ground, then a burst, played through the delay line.
const values = [], points = [];
const g = new Ground({ delay: 1, log: () => {}, onValue: (v) => values.push(v), onTrace: (t) => points.push(...t) });
let now = 1_000_000_000_000;
const feed = (seconds, amp) => { const n = seconds * 100, samples = [];
  for (let i = 0; i < n; i++) samples.push(Math.round(300 + amp * Math.sin(i * 0.7) * (0.5 + Math.random())));
  g.push({ start: now, rate: 100, samples }); for (let i = 0; i < seconds * 20; i++) { now += 50; g.lastData = now; g.tick(now); } };
feed(1, 100);                                    // the first second only fills the delay line
feed(40, 100);
const calm = values.slice(-100).reduce((a, b) => a + b, 0) / 100;
feed(2, 1200); feed(1, 100);
const burst = Math.max(...values.slice(-60));
check("values stay within 0..1", values.every((v) => v >= 0 && v <= 1) && points.every((p) => p >= -1 && p <= 1));
check("steady ground gives a middle value", calm > 0.15 && calm < 0.6, calm.toFixed(2));
check("a stronger movement raises it", burst > calm * 1.8, `${calm.toFixed(2)} -> ${burst.toFixed(2)}`);
check("the waveform is delivered for drawing (about 50 points per second)", points.length > 40 * 40, `${points.length} points`);
g.push({ start: now - 3000, rate: 100, samples: [1, 2, 3] });
check("duplicate records are ignored", g.queue.every((s) => s.t >= now - 1000 - 50));
for (let i = 0; i < 400; i++) { now += 50; g.tick(now); }
check("without new data the value goes to 0 (no signal)", values.at(-1) === 0);
console.log(`\n${pass}/${total} checks passed`);
process.exit(pass === total ? 0 : 1);
