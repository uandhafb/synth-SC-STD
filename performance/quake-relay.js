#!/usr/bin/env node
// Arrival Times: the quake relay. Reads real earthquakes (USGS) and turns each one into
//   1. a "rupture" note on the scstd synth (OSC /dirt/play to SuperDirt, port 57120),
//   2. control values for TidalCycles (OSC /ctrl to Tidal's control port 6010), read in patterns
//      with  cF 0 "mag" | "depth" | "energy" | "rate" | "lat" | "lon"   (all 0..1),
//   3. an event for listeners (projection and phones are added on top of this, see onQuake).
//
// Run:  node performance/quake-relay.js      then press a key:
//   r  replay the last 24 h (M 2.5+), compressed into REPLAY_MINUTES (default 4), looping
//   l  live: only earthquakes that are reported from now on
//   p  pause / continue        t  a test quake        1 2 3  a big prepared quake
//   + / -  rupture louder / quieter        m  rupture notes on / off        q  quit
// New real earthquakes are checked every 60 s in every mode and play as soon as they appear.
// Without internet it uses the day saved last time (data/last_day.json), or the sample.

import dgram from "node:dgram";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeOSC, encodeBundle, int } from "./osc.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FEED_DAY = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const FEED_HOUR = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ---- data ---------------------------------------------------------------------------------------

// One USGS GeoJSON feature -> the few numbers the piece uses, plus 0..1 versions for mapping.
export function fromFeature(f) {
  const [lon, lat, depth] = f.geometry.coordinates;
  return describe({ id: f.id, mag: f.properties.mag, place: f.properties.place ?? "somewhere on Earth",
    time: f.properties.time, lon, lat, depth });
}

export function describe(q) {
  const mag = Number(q.mag) || 0, depth = Math.max(0, Number(q.depth) || 0);
  return { ...q, mag, depth,
    // Magnitude 2 -> 0, 7 -> 1 (the replay holds M 2.5..6; live quakes can be smaller).
    mag01: clamp01((mag - 2) / 5),
    // Depth on a log scale: most quakes are shallower than 100 km, a few reach 700 km.
    // 10 km -> 0.37, 35 km -> 0.55, 100 km -> 0.70, 600 km -> 0.98.
    depth01: clamp01(Math.log1p(depth) / Math.log1p(700)),
    lat01: clamp01((q.lat + 90) / 180),
    lon01: clamp01((q.lon + 180) / 360) };
}

// The rupture: one scstd note per earthquake. Every sound setting is written out, so the panel
// and the performer's presets cannot change it by accident. Tune these by ear.
//   bigger  -> lower, longer, louder, more ring-mod grit, more spring
//   deeper  -> darker (lower filter), and the filter opens less on the hit
export function ruptureNote(q, level = 1) {
  const m = q.mag01, d = q.depth01;
  const len = 0.6 + 5 * m;                       // seconds the note is held
  return [
    "s", "scstd", "orbit", int(7), "cps", 1, "delta", len, "legato", 1,
    "n", Math.round(2 - 28 * m),                 // M 2.5: about -1 (a knock) ... M 7: -26 (a deep rumble)
    "gain", (0.77 + 0.27 * m) * level, "pan", q.lon01,   // SuperDirt's gain is steep (4th power)
    "o1lvl", 0.6, "o1wave", 0.3, "o2lvl", 0.4, "o2wave", 2, "o3lvl", 0.8, "o3oct", -1,
    "nzlvl", 0.1 + 0.75 * m, "nzcol", 0.85, "rmlvl", 0.5 * m, "drift", 0.4,   // small = clean knock, big = rumble
    "vcfcut", 180 + 1800 * (1 - d), "vcfres", 0.45, "vcfenv", 0.75 - 0.4 * d, "vcfdrive", 0.8, "vcfkey", 0,
    "adsr_pitch", 10 + 14 * m,                   // the pitch falls into the note: the "thud"
    "eatk", 0.001, "edec", 0.25 + 1.5 * m, "esus", 0, "erel", 0.5 + 4 * m, "ecurve", -5,
    "aratk", 0.002, "arrel", 0.5 + 4 * m, "vcalvl", 0.9,
    "spmix", 0.25 + 0.4 * m, "spdecay", 0.5 + 0.5 * m, "sptone", 0.3,
  ];
}

// ---- the relay ----------------------------------------------------------------------------------

export class Relay {
  constructor(opts = {}) {
    this.o = { scHost: "127.0.0.1", scPort: 57120, tidalHost: "127.0.0.1", tidalPort: 6010,
      replaySeconds: 240, pollSeconds: 60, energyFade: 8, rateWindow: 30, rateFull: 12,
      dataDir: path.join(DIR, "data"), log: console.log, fetchJson: defaultFetchJson, ...opts };
    this.udp = dgram.createSocket("udp4");
    this.mode = "idle";            // idle | replay | live
    this.paused = false;
    this.level = 1; this.ruptureOn = true;
    this.day = []; this.big = [];
    this.seen = new Set();         // ids already played or known, so "new" means really new
    this.energy = 0; this.recent = [];
    this.listeners = [];           // (quake, info) => {}  for the projection and the phones
    this.timer = null; this.index = 0; this.replayStart = 0; this.pausedAt = 0;
  }

  onQuake(fn) { this.listeners.push(fn); }
  send(port, host, address, args) { this.udp.send(encodeOSC(address, args), port, host); }
  ctrl(name, value) { this.send(this.o.tidalPort, this.o.tidalHost, "/ctrl", [name, value]); }

  // Load the last 24 h: from USGS (and save it), else the saved copy, else the sample.
  async load() {
    const saved = path.join(this.o.dataDir, "last_day.json"), sample = path.join(this.o.dataDir, "sample_day.json");
    let geo, source = "USGS (live)";
    try {
      geo = await this.o.fetchJson(FEED_DAY);
      fs.writeFileSync(saved, JSON.stringify(geo));
    } catch {
      const file = fs.existsSync(saved) ? saved : sample;
      geo = JSON.parse(fs.readFileSync(file, "utf8"));
      source = `no internet: ${path.basename(file)}`;
    }
    this.day = geo.features.map(fromFeature).filter((q) => Number.isFinite(q.lat)).sort((a, b) => a.time - b.time);
    for (const q of this.day) this.seen.add(q.id);
    this.big = JSON.parse(fs.readFileSync(path.join(this.o.dataDir, "big.json"), "utf8")).map(describe);
    try { for (const f of (await this.o.fetchJson(FEED_HOUR)).features) this.seen.add(f.id); } catch { /* offline */ }
    this.o.log(`${this.day.length} earthquakes (M 2.5+, last 24 h) from ${source}`);
    return source;
  }

  // Start the clocks: control values 10 times per second, new-quake check every pollSeconds.
  start() {
    for (const k of ["mag", "depth", "lat", "lon", "energy", "rate"]) this.ctrl(k, 0);
    this.tick = setInterval(() => this.sendActivity(), 100);
    this.poll = setInterval(() => this.checkNew(), this.o.pollSeconds * 1000);
  }

  stop() {
    clearInterval(this.tick); clearInterval(this.poll); clearTimeout(this.timer);
    this.udp.close();
  }

  // energy: every quake adds to it by magnitude, and it fades (time constant energyFade seconds),
  //   like aftershock activity calming down.  rate: quakes in the last rateWindow seconds.
  sendActivity(now = Date.now()) {
    const dt = (now - (this.lastTick ?? now)) / 1000; this.lastTick = now;
    this.energy *= Math.exp(-dt / this.o.energyFade);
    this.recent = this.recent.filter((t) => now - t < this.o.rateWindow * 1000);
    this.ctrl("energy", this.energy);
    this.ctrl("rate", clamp01(this.recent.length / this.o.rateFull));
  }

  fire(q, info = {}) {
    this.energy = clamp01(this.energy + 0.2 + 0.8 * q.mag01);
    this.recent.push(Date.now());
    this.ctrl("mag", q.mag01); this.ctrl("depth", q.depth01); this.ctrl("lat", q.lat01); this.ctrl("lon", q.lon01);
    if (this.ruptureOn) this.udp.send(encodeBundle("/dirt/play", ruptureNote(q, this.level)), this.o.scPort, this.o.scHost);
    for (const fn of this.listeners) fn(q, info);
    this.o.log(`${info.live ? "LIVE " : info.big ? "BIG  " : info.test ? "test " : "     "}M ${q.mag.toFixed(1)}  ${String(Math.round(q.depth)).padStart(3)} km  ${q.place}`);
  }

  // ---- replay: the day's quakes in order, 24 h squeezed into replaySeconds, looping ----
  replay() {
    if (!this.day.length) return this.o.log("no earthquakes loaded");
    this.mode = "replay"; this.paused = false; this.index = 0; this.replayStart = Date.now();
    this.o.log(`REPLAY: ${this.day.length} earthquakes in ${Math.round(this.o.replaySeconds)} s`);
    this.scheduleNext();
  }

  offset(i) {                     // when quake i plays, in ms from the start of the replay
    const t0 = this.day[0].time, span = Math.max(1, this.day[this.day.length - 1].time - t0);
    return ((this.day[i].time - t0) / span) * this.o.replaySeconds * 1000;
  }

  scheduleNext() {
    clearTimeout(this.timer);
    if (this.mode !== "replay" || this.paused) return;
    if (this.index >= this.day.length) {           // end of the day: breathe, then loop
      this.timer = setTimeout(() => this.replay(), 4000);
      return;
    }
    const wait = Math.max(0, this.replayStart + this.offset(this.index) - Date.now());
    this.timer = setTimeout(() => { this.fire(this.day[this.index++]); this.scheduleNext(); }, wait);
  }

  live() { clearTimeout(this.timer); this.mode = "live"; this.paused = false; this.o.log("LIVE: waiting for the Earth"); }

  pause() {
    if (this.mode !== "replay") return;
    this.paused = !this.paused;
    if (this.paused) { this.pausedAt = Date.now(); clearTimeout(this.timer); this.o.log("paused"); }
    else { this.replayStart += Date.now() - this.pausedAt; this.o.log("continue"); this.scheduleNext(); }
  }

  async checkNew() {
    let feats;
    try { feats = (await this.o.fetchJson(FEED_HOUR)).features; } catch { return; }
    for (const f of feats.sort((a, b) => a.properties.time - b.properties.time)) {
      if (this.seen.has(f.id) || f.properties.mag == null) continue;
      this.seen.add(f.id);
      if (!this.paused) this.fire(fromFeature(f), { live: true });
    }
  }

  test() {
    this.fire(describe({ id: `test-${Date.now()}`, mag: 3.5 + Math.random() * 2, depth: 5 + Math.random() ** 3 * 500,
      lat: Math.random() * 120 - 60, lon: Math.random() * 360 - 180, place: "a test quake", time: Date.now() }), { test: true });
  }

  fireBig(i) { if (this.big[i]) this.fire({ ...this.big[i], id: `${this.big[i].id}-${Date.now()}` }, { big: true }); }
}

async function defaultFetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---- command line -------------------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const relay = new Relay({ replaySeconds: Number(process.env.REPLAY_MINUTES ?? 4) * 60 });
  await relay.load();
  relay.start();
  console.log("keys:  r replay   l live   p pause   t test quake   1 2 3 big quake   + - level   m rupture on/off   q quit");
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8");
    process.stdin.on("data", (k) => {
      if (k === "q" || k === "\u0003") { relay.stop(); process.exit(0); }
      else if (k === "r") relay.replay();
      else if (k === "l") relay.live();
      else if (k === "p") relay.pause();
      else if (k === "t") relay.test();
      else if ("123".includes(k)) relay.fireBig(Number(k) - 1);
      else if (k === "+" || k === "=") { relay.level = Math.min(1.5, relay.level + 0.1); console.log(`rupture level ${relay.level.toFixed(1)}`); }
      else if (k === "-") { relay.level = Math.max(0, relay.level - 0.1); console.log(`rupture level ${relay.level.toFixed(1)}`); }
      else if (k === "m") { relay.ruptureOn = !relay.ruptureOn; console.log(`rupture notes ${relay.ruptureOn ? "on" : "off"}`); }
    });
  }
}
