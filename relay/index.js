// synth-SC-STD relay: web panel (WebSocket, JSON) <-> SuperCollider (OSC over UDP).
//
//   node relay/index.js            then open http://localhost:8090
//
// - Serves the panel (ui/) and a WebSocket on the same port, on this computer only (127.0.0.1).
// - Forwards panel actions to sclang as OSC (see "Web panel protocol" in sc/buses.scd) and
//   broadcasts sclang's replies (all params, every change, preset list) to every open panel,
//   so several panels stay in sync and a reloaded panel shows the current state.
// - Pings sclang every second; if SuperCollider is restarted, the relay re-registers by itself.
//
// Environment variables (defaults in brackets): HTTP_PORT [8090], SC_HOST [127.0.0.1],
// SC_PORT [57120 = sclang], OSC_PORT [57150 = this relay's UDP port].
// Port 8080 is avoided on purpose: Strudel's OSC bridge uses it.

import http from "node:http";
import dgram from "node:dgram";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UI_DIR = path.join(ROOT, "ui");
const HTTP_PORT = Number(process.env.HTTP_PORT ?? 8090);
const SC_HOST = process.env.SC_HOST ?? "127.0.0.1";
const SC_PORT = Number(process.env.SC_PORT ?? 57120);
const OSC_PORT = Number(process.env.OSC_PORT ?? 57150);

// ---------------------------------------------------------------------------------------------
// Minimal OSC 1.0 codec (messages only; sclang's sendMsg never sends bundles here).
// Supported argument types: i (int32), f (float32), s (string), d (float64), h (int64), T/F.

function oscString(str) {
  const b = Buffer.from(str + "\0", "utf8");
  const pad = (4 - (b.length % 4)) % 4;
  return Buffer.concat([b, Buffer.alloc(pad)]);
}

export function encodeOSC(address, args = []) {
  let tags = ",";
  const parts = [];
  for (const a of args) {
    if (typeof a === "number") {
      const b = Buffer.alloc(4);
      if (Number.isInteger(a) && Math.abs(a) < 2 ** 31) { tags += "i"; b.writeInt32BE(a); }
      else { tags += "f"; b.writeFloatBE(a); }
      parts.push(b);
    } else {
      tags += "s";
      parts.push(oscString(String(a)));
    }
  }
  return Buffer.concat([oscString(address), oscString(tags), ...parts]);
}

export function decodeOSC(buf) {
  let pos = 0;
  const readString = () => {
    const end = buf.indexOf(0, pos);
    const s = buf.toString("utf8", pos, end);
    pos = end + 1;
    pos += (4 - (pos % 4)) % 4;
    return s;
  };
  const address = readString();
  if (address === "#bundle") return null; // not used by sclang's sendMsg
  const tags = pos < buf.length ? readString() : ",";
  const args = [];
  for (const t of tags.slice(1)) {
    if (t === "i") { args.push(buf.readInt32BE(pos)); pos += 4; }
    // float32 carries ~7 significant digits; rounding avoids values like 1.100000023841858
    else if (t === "f") { args.push(Number(buf.readFloatBE(pos).toPrecision(7))); pos += 4; }
    else if (t === "d") { args.push(buf.readDoubleBE(pos)); pos += 8; }
    else if (t === "h") { args.push(Number(buf.readBigInt64BE(pos))); pos += 8; }
    else if (t === "s" || t === "S") { args.push(readString()); }
    else if (t === "T") { args.push(true); }
    else if (t === "F") { args.push(false); }
    else { break; } // unknown type: stop parsing this message
  }
  return { address, args };
}

// ---------------------------------------------------------------------------------------------
// Parameter descriptions from docs/params.md (the single source of truth), shown as tooltips.

function readDescriptions() {
  const out = {};
  try {
    const text = fs.readFileSync(path.join(ROOT, "docs/params.md"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\| `([a-z0-9_]+)` \|[^|]*\|[^|]*\| (.*) \|\s*$/);
      if (m) out[m[1]] = m[2].replace(/`/g, "");
    }
  } catch { /* the panel works without descriptions */ }
  return out;
}

// ---------------------------------------------------------------------------------------------
// State cache: what every newly connected panel receives.

const state = {
  connected: false,      // is sclang answering?
  params: [],            // [{name, min, max, def, value, desc}] in sclang's (sorted) order
  presets: [],
};
let lastPong = 0;
const descriptions = readDescriptions();

// ---------------------------------------------------------------------------------------------
// OSC to/from sclang.

const udp = dgram.createSocket("udp4");
const sendSC = (address, ...args) => udp.send(encodeOSC(address, args), SC_PORT, SC_HOST);

udp.on("message", (buf) => {
  let msg;
  try { msg = decodeOSC(buf); } catch { return; }
  if (!msg) return;
  const a = msg.args;
  switch (msg.address) {
    case "/scstd/pong":
      lastPong = Date.now();
      if (!state.connected) { state.connected = true; broadcast({ type: "status", connected: true }); }
      break;
    case "/scstd/specs": {
      const params = [];
      for (let i = 0; i + 4 < a.length; i += 5) {
        const name = String(a[i]);
        params.push({ name, min: a[i + 1], max: a[i + 2], def: a[i + 3], value: a[i + 4], desc: descriptions[name] ?? "" });
      }
      state.params = params;
      lastPong = Date.now();
      state.connected = true;
      broadcast({ type: "specs", params, connected: true });
      break;
    }
    case "/scstd/changed": {
      const name = String(a[0]);
      const p = state.params.find((x) => x.name === name);
      if (p) p.value = a[1];
      broadcast({ type: "changed", name, value: a[1] });
      break;
    }
    case "/scstd/presetlist":
      state.presets = a.map(String);
      broadcast({ type: "presets", presets: state.presets });
      break;
  }
});

udp.bind(OSC_PORT, "127.0.0.1", () => {
  sendSC("/scstd/hello");
  // Heartbeat: sclang answers /scstd/pong (and re-registers this relay after a restart).
  setInterval(() => {
    sendSC("/scstd/ping");
    if (state.connected && Date.now() - lastPong > 3000) {
      state.connected = false;
      broadcast({ type: "status", connected: false });
    }
  }, 1000);
});

// ---------------------------------------------------------------------------------------------
// HTTP: static files from ui/ (read-only, no directory listing, no paths outside ui/).

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  // Current state as JSON: the panel loads it on start (instant first paint), then goes live
  // over the WebSocket.
  if (url.pathname === "/state.json") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ params: state.params, presets: state.presets, connected: state.connected }));
    return;
  }
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = path.resolve(UI_DIR, rel);
  if (!file.startsWith(UI_DIR + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  fs.createReadStream(file).pipe(res);
});

// ---------------------------------------------------------------------------------------------
// WebSocket: panels.

const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(data);
}

const known = (name) => state.params.some((p) => p.name === name);
const safeName = (s) => typeof s === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(s);

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "specs", params: state.params, connected: state.connected }));
  ws.send(JSON.stringify({ type: "presets", presets: state.presets }));
  ws.on("message", (data) => {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    switch (m?.type) {
      case "set":
        if (known(m.name) && Number.isFinite(m.value)) sendSC("/scstd/set", m.name, Number(m.value));
        break;
      case "reset":
        sendSC("/scstd/reset");
        break;
      case "preset":
        if (safeName(m.name)) sendSC("/scstd/preset", m.name);
        break;
      case "save":
        if (safeName(m.name)) {
          const keys = Array.isArray(m.keys) ? m.keys.filter(known) : [];
          sendSC("/scstd/savepreset", m.name, ...keys);
        }
        break;
      case "presets":
        sendSC("/scstd/presets");
        break;
      case "noteon":
      case "noteoff":
        if (Number.isInteger(m.midi) && m.midi >= 0 && m.midi <= 127) sendSC(`/scstd/${m.type}`, m.midi);
        break;
    }
  });
});

server.listen(HTTP_PORT, "127.0.0.1", () => {
  console.log(`synth-SC-STD panel: http://localhost:${HTTP_PORT}  (SuperCollider at ${SC_HOST}:${SC_PORT}, relay UDP ${OSC_PORT})`);
});
