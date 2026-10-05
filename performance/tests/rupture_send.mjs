// Sends rupture notes to the probe (SuperDirt on 57139): four single quakes 10 s apart
// (small/shallow, small/deep, big/shallow, big/deep), then a burst of 12 quakes in 2 s.
import dgram from "node:dgram";
import { describe, ruptureNote } from "../quake-relay.js";
import { encodeBundle } from "../osc.js";
const sock = dgram.createSocket("udp4");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const play = (mag, depth, lon = 0) => sock.send(encodeBundle("/dirt/play", ruptureNote(describe({ mag, depth, lat: 0, lon }))), 57139, "127.0.0.1");
for (const [mag, depth] of [[3, 10], [3, 400], [6.5, 10], [6.5, 400]]) { play(mag, depth); await sleep(10000); }
for (let i = 0; i < 12; i++) { play(2.5 + (i % 5) * 0.8, 5 + i * 40, -180 + i * 30); await sleep(170); }
await sleep(500); sock.close();
