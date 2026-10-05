#!/usr/bin/env node
// Arrival Times: the quake relay. Reads real earthquakes (USGS) and turns each one into
//   1. a "rupture" note on the scstd synth (OSC /dirt/play to SuperDirt, port 57120),
//   2. control values for TidalCycles (OSC /ctrl to Tidal's control port 6010), read in patterns
//      with  cF 0 "mag" | "depth" | "energy" | "rate" | "lat" | "lon" | "ground"   (all 0..1),
//      where "ground" is the live movement of the ground under Montréal (ground.js),
//   3. an event for the projection page it serves at http://localhost:8095 (web/stage.html),
//      and for other listeners (the phones are added on top of this, see onQuake).
//
// Run:  node performance/quake-relay.js      then press a key:
//   r  replay the last 24 h (M 2.5+), compressed into REPLAY_MINUTES (default 4), looping
//   l  live: only earthquakes that are reported from now on
//   p  pause / continue        t  a test quake        1 2 3  a big prepared quake
//   + / -  rupture louder / quieter        m  rupture notes on / off        q  quit
//   o  phones on / off        [ ]  phones quieter / louder        c  show / hide the QR code on the projection
// New real earthquakes are checked every 60 s in every mode and play as soon as they appear.
// Without internet it uses the day saved last time (data/last_day.json), or the sample.

import dgram from "node:dgram";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeOSC, encodeBundle, int } from "./osc.js";
import { Ground } from "./ground.js";
import { connectMqtt, BROKER, topicsFor } from "../docs/quakes/lib/mqtt-lite.js";
import { STATIONS } from "../docs/quakes/lib/geo.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FEED_DAY = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const FEED_HOUR = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
// The real page whose words the earthquakes choreograph (web/choreo.js), fetched fresh at start.
const PAGE = "https://en.wikipedia.org/wiki/List_of_earthquakes_in_2026";
// Where the audience's phones open their page (docs/quakes, published with GitHub Pages).
const PHONE_URL = "https://uandhafb.github.io/synth-SC-STD/quakes/";
const PAGE_CREDIT = "Text: Wikipedia contributors, “List of earthquakes in 2026”, CC BY-SA 4.0";
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
      dataDir: path.join(DIR, "data"), log: console.log, fetchJson: defaultFetchJson, fetchText: defaultFetchText, ...opts };
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

  // The projection: a small web server for web/ (this computer only) that pushes every
  // earthquake to the open pages (Server-Sent Events, so no extra library is needed).
  serve(port = 8095) {
    const web = path.join(DIR, "web"), phones = path.join(DIR, "..", "docs", "quakes");
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
    this.clients = new Set();
    this.http = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        res.write(`data: ${JSON.stringify({ type: "mode", mode: this.paused ? "paused" : this.mode })}\n\n`);
        this.clients.add(res);
        this.sendRoom();
        req.on("close", () => this.clients.delete(res));
        return;
      }
      if (url.pathname === "/wiki") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(this.pageHtml(`http://${req.headers.host}`));
        return;
      }
      // /quakes/... is the phone page and the code it shares with the stage (docs/quakes, the folder
      // GitHub Pages publishes); everything else is web/.
      const pathname = decodeURIComponent(url.pathname);
      const [base, rel] = pathname.startsWith("/quakes/") ? [phones, pathname.slice(8) || "index.html"] : [web, pathname === "/" ? "stage.html" : pathname];
      const file = path.normalize(path.join(base, rel));
      if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
    });
    return new Promise((resolve, reject) => { this.http.once("error", reject); this.http.listen(port, "127.0.0.1", resolve); });
  }

  broadcast(obj) {
    if (!this.clients) return;
    const data = `data: ${JSON.stringify(obj)}\n\n`;
    for (const res of this.clients) res.write(data);
  }

  // The live seismometer (ground.js): its value goes to Tidal 20 times per second as "ground",
  // its waveform to the projection's seismograph line.
  listen(opts = {}) {
    let points = [];
    this.ground = new Ground({ log: this.o.log, ...opts,
      onValue: (v) => { this.ctrl("ground", v); this.groundValue = v; },
      onTrace: (t) => { points.push(...t); if (points.length >= 5) { this.broadcast({ type: "ground", points, value: this.groundValue ?? 0, name: this.ground.o.name, delay: Math.round(this.ground.delay ?? this.ground.o.delay) }); points = []; } } });
    this.ground.start();
  }

  // The phones: every earthquake is published to a public MQTT broker; each phone (docs/quakes)
  // is one seismic station and works out by itself when the waves reach it. The relay deals the
  // stations (the least used one first, so the first phones are spread around the globe), keeps a
  // list of who is there, and tells the phones whether to sound and how loud.
  phones(opts = {}) {
    const room = opts.room ?? this.roomCode(), broker = opts.broker ?? BROKER, t = topicsFor(room);
    this.room = room; this.roster = new Map();          // phone id -> { station, seen }
    this.phoneState = { on: true, level: 1 };
    this.phoneUrl = `${opts.url ?? PHONE_URL}?room=${room}${broker === BROKER ? "" : `&broker=${encodeURIComponent(broker)}`}`;
    const sendState = () => this.mq.publish(t.state, this.phoneState, { retain: true });
    this.setPhones = (change) => { Object.assign(this.phoneState, change); sendState(); this.sendRoom(); };
    this.mq = connectMqtt(broker, { clientId: `at-relay-${room}-${Math.random().toString(36).slice(2, 7)}`,
      onState: (ok) => { this.broker = ok; this.sendRoom(); this.o.log(ok ? `phones: connected to the broker, room ${room}` : "phones: broker connection lost, retrying"); },
      onConnect: sendState,
      onMessage: (topic, payload) => {
        let m; try { m = JSON.parse(payload); } catch { return; }
        if (typeof m.id !== "string" || m.id.length > 24) return;
        let r = this.roster.get(m.id);
        if (!r) {
          const want = Number.isInteger(m.want ?? m.station) ? ((m.want ?? m.station) % STATIONS.length + STATIONS.length) % STATIONS.length : null;
          r = { station: want ?? this.freeStation() }; this.roster.set(m.id, r);
          this.o.log(`phones: ${this.roster.size} (new: ${STATIONS[r.station].name}, ${STATIONS[r.station].region})`);
        }
        r.seen = Date.now();
        if (topic === t.join) this.mq.publish(t.assign(m.id), { station: r.station });
        this.sendRoom();
      } });
    this.mq.subscribe(t.join); this.mq.subscribe(t.here);
    this.onQuake((q, info) => { if (this.phoneState.on) this.mq.publish(t.quake, { id: q.id, mag: q.mag, depth: q.depth, lat: q.lat, lon: q.lon, place: q.place, mag01: q.mag01, depth01: q.depth01, live: !!info.live, big: !!info.big }); });
    this.rosterTimer = setInterval(() => { let gone = 0; for (const [id, r] of this.roster) if (Date.now() - r.seen > 35000) { this.roster.delete(id); gone++; } if (gone) this.sendRoom(); }, 5000);
    return this.phoneUrl;
  }

  freeStation() {
    const used = new Array(STATIONS.length).fill(0);
    for (const r of this.roster.values()) used[r.station]++;
    return used.indexOf(Math.min(...used));
  }

  // The room code stays the same between runs (so a QR code shown once keeps working).
  roomCode() {
    const file = path.join(this.o.dataDir, "room.txt");
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
    const code = Array.from({ length: 4 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ"[Math.floor(Math.random() * 23)]).join("");
    fs.writeFileSync(file, code);
    return code;
  }

  sendRoom() {
    if (!this.phoneUrl) return;
    this.broadcast({ type: "room", url: this.phoneUrl, room: this.room, broker: !!this.broker, on: this.phoneState.on, level: this.phoneState.level,
      phones: this.roster.size, stations: [...new Set([...this.roster.values()].map((r) => r.station))] });
  }

  setMode(mode) { this.mode = mode; this.broadcast({ type: "mode", mode: this.paused ? "paused" : mode }); }
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
    await this.loadPage();
    return source;
  }

  // The page that dances: today's Wikipedia list of earthquakes, as it is right now. Its own
  // scripts are removed and its style sheets are copied in, so the saved copy also works without
  // internet. Without any copy, a plain page is made from the day's earthquakes.
  async loadPage() {
    const saved = path.join(this.o.dataDir, "page.html");
    try {
      let html = (await this.o.fetchText(PAGE)).replace(/<script\b[\s\S]*?<\/script>/gi, "");
      for (const link of html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/gi) ?? []) {
        const href = /href="([^"]+)"/.exec(link)?.[1];
        if (!href) continue;
        try { const cssText = await this.o.fetchText(new URL(href.replace(/&amp;/g, "&"), PAGE).href); html = html.replace(link, () => `<style>${cssText}</style>`); } catch { /* keep the link */ }
      }
      html = html.replace(/<head>/i, () => `<head><base href="https://en.wikipedia.org/"><!-- fetched ${new Date().toISOString()} -->`);
      fs.writeFileSync(saved, html);
      this.page = html; this.pageSource = "Wikipedia, fetched now";
    } catch {
      if (fs.existsSync(saved)) { this.page = fs.readFileSync(saved, "utf8"); this.pageSource = "Wikipedia, saved copy (no internet)"; }
      else {
        const rows = this.day.map((q) => `<tr><td>${new Date(q.time).toISOString().slice(11, 16)}</td><td>${q.mag.toFixed(1)}</td><td>${Math.round(q.depth)} km</td><td>${q.place.replace(/[<&]/g, "")}</td></tr>`).join("");
        this.page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Earthquakes of the last 24 hours</title><style>body{font:17px/1.5 Georgia,serif;margin:2em;color:#202122}td,th{padding:.25em .9em;border-bottom:1px solid #ccc;text-align:left}</style></head><body><div id="mw-content-text"><h1>Earthquakes of the last 24 hours</h1><p>Magnitude 2.5 and above, from the U.S. Geological Survey.</p><table><tr><th>UTC</th><th>M</th><th>Depth</th><th>Place</th></tr>${rows}</table></div></body></html>`;
        this.pageSource = "a plain page from the USGS list (no internet, no saved Wikipedia copy)";
      }
    }
    this.o.log(`the page that dances: ${this.pageSource}`);
  }

  // The fetched page with our additions: reading-friendly layout, the credit, and the choreography.
  pageHtml(origin) {
    const wiki = this.pageSource?.startsWith("Wikipedia");
    const add = `<style>.vector-header-container,.vector-column-start,.vector-column-end,.vector-page-toolbar,.vector-sticky-header-container,
      .vector-body-before-content,#siteNotice,.mw-footer-container,.mw-editsection,.mw-jump-link,.vector-settings{display:none!important}
      .mw-page-container{max-width:none!important;padding:0 1.4em!important} .mw-content-container{max-width:none!important} html{font-size:108%}</style>
      <div style="font:12px/1.4 sans-serif;color:#54595d;padding:1.2em;border-top:1px solid #c8ccd1">${wiki ? `${PAGE_CREDIT}. ${this.pageSource}; the movements are added by Arrival Times.` : "Data: U.S. Geological Survey."}</div>
      <script type="module" src="${origin}/choreo.js"></script>`;
    return /<\/body>/i.test(this.page) ? this.page.replace(/<\/body>/i, () => `${add}</body>`) : this.page + add;
  }

  // Start the clocks: control values 10 times per second, new-quake check every pollSeconds.
  start() {
    for (const k of ["mag", "depth", "lat", "lon", "energy", "rate", "ground"]) this.ctrl(k, 0);
    this.tick = setInterval(() => this.sendActivity(), 100);
    this.poll = setInterval(() => this.checkNew(), this.o.pollSeconds * 1000);
  }

  stop() {
    clearInterval(this.tick); clearInterval(this.poll); clearTimeout(this.timer);
    this.ground?.stop(); clearInterval(this.rosterTimer); this.mq?.close();
    if (this.http) { for (const res of this.clients) res.end(); this.http.close(); }
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
    if ((this.ticks = (this.ticks ?? 0) + 1) % 2 === 0) this.broadcast({ type: "activity", energy: this.energy });
  }

  fire(q, info = {}) {
    this.energy = clamp01(this.energy + 0.2 + 0.8 * q.mag01);
    this.recent.push(Date.now());
    this.ctrl("mag", q.mag01); this.ctrl("depth", q.depth01); this.ctrl("lat", q.lat01); this.ctrl("lon", q.lon01);
    if (this.ruptureOn) this.udp.send(encodeBundle("/dirt/play", ruptureNote(q, this.level)), this.o.scPort, this.o.scHost);
    this.broadcast({ type: "quake", q, info });
    for (const fn of this.listeners) fn(q, info);
    this.o.log(`${info.live ? "LIVE " : info.big ? "BIG  " : info.test ? "test " : "     "}M ${q.mag.toFixed(1)}  ${String(Math.round(q.depth)).padStart(3)} km  ${q.place}`);
  }

  // ---- replay: the day's quakes in order, 24 h squeezed into replaySeconds, looping ----
  replay() {
    if (!this.day.length) return this.o.log("no earthquakes loaded");
    this.paused = false; this.index = 0; this.replayStart = Date.now(); this.setMode("replay");
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

  live() { clearTimeout(this.timer); this.paused = false; this.setMode("live"); this.o.log("LIVE: waiting for the Earth"); }

  pause() {
    if (this.mode !== "replay") return;
    this.paused = !this.paused; this.setMode(this.mode);
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

async function defaultFetchText(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "ArrivalTimes/0.1 (student performance; synth-SC-STD)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function defaultFetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---- command line -------------------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const relay = new Relay({ replaySeconds: Number(process.env.REPLAY_MINUTES ?? 4) * 60,
    scPort: Number(process.env.SC_PORT ?? 57120), tidalPort: Number(process.env.TIDAL_PORT ?? 6010) });
  const port = Number(process.env.STAGE_PORT ?? 8095);
  try { await relay.serve(port); } catch (e) {
    console.log(e.code === "EADDRINUSE" ? `The relay is already running in another window (port ${port} is taken).\nUse that one, or stop it there with q and start again.` : `Could not start: ${e.message}`);
    process.exit(1);
  }
  await relay.load();
  relay.start();
  if (process.env.GROUND !== "off") relay.listen();
  if (process.env.PHONES !== "off") console.log(`phones: ${relay.phones({ room: process.env.ROOM, url: process.env.PHONE_URL, broker: process.env.BROKER })}`);
  console.log(`projection: http://localhost:${port}   (press f in the page for full screen)`);
  console.log("keys:  r replay   l live   p pause   t test quake   1 2 3 big quake   + - level   m rupture on/off\n       o phones on/off   [ ] phones level   c QR code on the projection   q quit");
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
      else if (k === "o" && relay.setPhones) { relay.setPhones({ on: !relay.phoneState.on }); console.log(`phones ${relay.phoneState.on ? "on" : "off"}`); }
      else if ((k === "[" || k === "]") && relay.setPhones) { relay.setPhones({ level: Math.round(Math.min(1, Math.max(0.1, relay.phoneState.level + (k === "]" ? 0.1 : -0.1))) * 10) / 10 }); console.log(`phones level ${relay.phoneState.level}`); }
      else if (k === "c") relay.broadcast({ type: "qr" });
      else if (k === "m") { relay.ruptureOn = !relay.ruptureOn; console.log(`rupture notes ${relay.ruptureOn ? "on" : "off"}`); }
    });
  }
}
