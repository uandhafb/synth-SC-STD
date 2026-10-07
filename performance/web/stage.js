// Arrival Times: the projection. A globe that turns to each earthquake, the P and S wave fronts
// spreading from it, and words choreographed by the data (after Joana Chicau's web choreographies:
// the page is a stage, the letters are the dancers; here the Earth writes the score).
//   magnitude -> how hard the letters shake (and for how long)
//   position  -> the direction the letters are pushed (away from where the quake is on the map)
//   depth     -> how far the words sink and blur
//   M >= 5.5  -> everything on the page scatters, then gathers again
// Events come from the quake relay (Server-Sent Events on /events).

import { STATIONS, destination, distanceDeg, project, frontDeg, arrivals, SECONDS_PER_MINUTE } from "/quakes/lib/geo.js";

const canvas = document.getElementById("globe"), ctx = canvas.getContext("2d");
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const COL = { ink: css("--ink"), dim: css("--dim"), line: css("--line"), p: css("--p"), s: css("--s") };
let W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;
let land = [];
const view = { lon: -30, lat: 15 }, target = { lon: -30, lat: 15 };
const waves = [];                 // { q, t0, hit: Set of station names already reached }
const glow = new Map();           // station name -> { t, wave } for the dot that lights up
let energy = 0, lastQuakeAt = 0;
const trace = new Float32Array(600);   // the seismograph line at the bottom
let traceAt = 0;

fetch("/quakes/data/land.json").then((r) => r.json()).then((d) => { land = d; });

function resize() {
  dpr = window.devicePixelRatio || 1;
  const box = canvas.parentElement.getBoundingClientRect();          // the right half of the stage
  W = box.width; H = box.height;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  R = Math.min(W * 0.36, H * 0.33); cx = W * 0.5; cy = H * 0.43;
}
window.addEventListener("resize", resize); resize();

// ---- drawing ------------------------------------------------------------------------------------

// Draws a line through geographic points, lifting the pen where the line is behind the globe.
function strokeGeo(points) {
  let pen = false;
  ctx.beginPath();
  for (const pt of points) {
    const s = project(pt, view, R);
    if (!s) { pen = false; continue; }
    if (pen) ctx.lineTo(cx + s.x, cy + s.y); else ctx.moveTo(cx + s.x, cy + s.y);
    pen = true;
  }
  ctx.stroke();
}

function circleAround(p, deg) {
  const pts = [];
  for (let b = 0; b <= 360; b += 3) pts.push(destination(p, b, deg));
  return pts;
}

function drawGlobe(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // the sphere
  const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
  g.addColorStop(0, "#151a21"); g.addColorStop(1, "#0a0d11");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.stroke();

  // graticule
  ctx.strokeStyle = "rgba(125,135,148,0.13)"; ctx.lineWidth = 0.6;
  for (let lon = -180; lon < 180; lon += 30) { const m = []; for (let lat = -90; lat <= 90; lat += 5) m.push({ lon, lat }); strokeGeo(m); }
  for (let lat = -60; lat <= 60; lat += 30) { const m = []; for (let lon = -180; lon <= 180; lon += 5) m.push({ lon, lat }); strokeGeo(m); }

  // coastlines
  ctx.strokeStyle = "rgba(233,230,223,0.55)"; ctx.lineWidth = 0.9;
  for (const ring of land) strokeGeo(ring.map(([lon, lat]) => ({ lon, lat })));

  // wave fronts
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i], age = (now - w.t0) / 1000, minutes = age / SECONDS_PER_MINUTE;
    const fade = Math.max(0, 1 - age / 14);
    if (fade <= 0) { waves.splice(i, 1); continue; }
    const strength = 0.35 + 0.65 * w.q.mag01;
    for (const [wave, color, width] of [["p", COL.p, 1], ["s", COL.s, 2.6]]) {
      const deg = frontDeg(minutes, wave);
      if (deg === null || deg < 0.5) continue;
      ctx.strokeStyle = color; ctx.lineWidth = width * (0.6 + w.q.mag01);
      ctx.globalAlpha = fade * strength * (1 - deg / 130);
      strokeGeo(circleAround(w.q, deg));
    }
    ctx.globalAlpha = 1;
    // stations reached by a front light up
    for (const st of STATIONS) {
      const a = arrivals(distanceDeg(w.q, st));
      if (a.p !== null && minutes >= a.p && !w.hit.has(st.name + "p")) { w.hit.add(st.name + "p"); glow.set(st.name, { t: now, wave: "p", k: a.strength * strength }); }
      if (a.s !== null && minutes >= a.s && !w.hit.has(st.name + "s")) { w.hit.add(st.name + "s"); glow.set(st.name, { t: now, wave: "s", k: a.strength * strength }); }
    }
    // the epicentre
    const e = project(w.q, view, R);
    if (e) {
      ctx.fillStyle = COL.s; ctx.globalAlpha = fade;
      ctx.beginPath(); ctx.arc(cx + e.x, cy + e.y, 3 + 9 * w.q.mag01 * (0.6 + 0.4 * Math.sin(age * 9)), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // stations
  ctx.font = `${Math.max(10, W * 0.014)}px ui-monospace, Menlo, monospace`;
  // The stations in the room (the phones) are named; the others are small dots. Before anyone
  // has joined, the first dozen are named so the globe is not empty.
  STATIONS.forEach((st, i) => {
    const s = project(st, view, R);
    if (!s) return;
    const here = room.stations.includes(i), named = here || (room.phones === 0 && i < 12);
    const gl = glow.get(st.name), lit = gl ? Math.max(0, 1 - (now - gl.t) / (gl.wave === "s" ? 2200 : 700)) * gl.k : 0;
    ctx.fillStyle = lit > 0 ? (gl.wave === "s" ? COL.s : COL.p) : here ? COL.ink : COL.dim;
    ctx.beginPath(); ctx.arc(cx + s.x, cy + s.y, (here ? 3 : 1.6) + 9 * lit, 0, Math.PI * 2); ctx.fill();
    if (!named && lit < 0.05) return;
    ctx.fillStyle = lit > 0.05 || here ? COL.ink : "rgba(125,135,148,0.75)";
    ctx.fillText(st.name, cx + s.x + 7, cy + s.y + 3);
  });

  // the seismograph line: the real ground under the station while its signal arrives (see the
  // "ground" events below); otherwise a tremor drawn from the earthquakes' activity
  const real = now - groundAt < 3000;
  elGround.textContent = real ? groundLabel : "";
  if (!real) { trace[traceAt] = energy * (0.35 + 0.65 * Math.sin(now * 0.045) * Math.sin(now * 0.0131 + 1.7)) + (Math.random() - 0.5) * 0.02; traceAt = (traceAt + 1) % trace.length; }
  const y0 = H * 0.925, x0 = W * 0.04, x1 = W * 0.72;
  ctx.strokeStyle = COL.ink; ctx.globalAlpha = 0.7; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < trace.length; i++) {
    const v = trace[(traceAt + i) % trace.length], x = x0 + ((x1 - x0) * i) / (trace.length - 1), y = y0 - v * H * 0.035;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke(); ctx.globalAlpha = 1;
}

// ---- the words ----------------------------------------------------------------------------------

const elWords = document.getElementById("words"), elWhere = document.getElementById("where");
const elPlace = document.getElementById("place"), elMeta = document.getElementById("meta");
const elLog = document.getElementById("log"), elMode = document.getElementById("mode");
let letters = [];                 // { el, f1, f2, ph1, ph2, sx, sy, rot, weight }
let move = { t0: 0, amp: 0, tau: 1, dx: 0, dy: 0, push: 0, scatter: 0 };

function setText(el, text, weight) {
  el.textContent = "";
  for (const ch of text) {
    const span = document.createElement("span");
    span.textContent = ch;
    el.appendChild(span);
    letters.push({ el: span, f1: 6 + Math.random() * 9, f2: 11 + Math.random() * 12, ph1: Math.random() * 6.3, ph2: Math.random() * 6.3,
      sx: (Math.random() - 0.5), sy: (Math.random() - 0.5), rot: (Math.random() - 0.5), weight });
  }
}

function showQuake(q, info) {
  // "121 km NNE of Teluknaga, Indonesia" -> a small line (how far, which way) and the big name
  const m = /^(.*? of )(.*)$/.exec(q.place);
  letters = [];
  setText(elWhere, m ? m[1].trim() : (info.live ? "right now" : " "), 0.5);
  const name = m ? m[2] : q.place;
  elPlace.style.fontSize = `${Math.min(3.4, 72 / Math.max(8, name.length))}vw`;
  setText(elPlace, name, 1);
  setText(elMeta, `M ${q.mag.toFixed(1)}  ·  ${Math.round(q.depth)} km deep  ·  ${utc(q.time)} UTC${info.live ? "  ·  LIVE" : ""}`, 0.5);
  letters.forEach((l, i) => setTimeout(() => l.el.classList.add("on"), i * 22));       // typed in

  // The choreography for this earthquake.
  const big = q.mag >= 5.5;
  const len = Math.hypot(q.lon / 180, q.lat / 90) || 1;
  move = { t0: performance.now(),
    amp: 2 + 40 * Math.pow(q.mag01, 1.6),             // px: M 3 trembles, M 6.5 throws the letters
    tau: 0.9 + 5 * q.mag01,                           // s: how long until it calms down
    dx: -(q.lon / 180) / len, dy: (q.lat / 90) / len, // pushed away from the quake's place on the map
    push: 6 + 50 * q.mag01,
    scatter: big ? 1 : 0 };
  // Depth: deep quakes pull the words down the page and out of focus.
  elWords.style.transform = `translateY(${(q.depth01 * 4).toFixed(2)}vh)`;
  elWords.style.filter = `blur(${(Math.max(0, q.depth01 - 0.45) * 5).toFixed(2)}px)`;
  if (big) scatterLog();
}

function animateWords(now) {
  const t = (now - move.t0) / 1000;
  const shake = move.amp * Math.exp(-t / move.tau);
  const push = move.push * Math.exp(-t / 0.45) * Math.cos(t * 11);
  const sc = move.scatter ? Math.pow(Math.max(0, 1 - t / 7), 3) : 0;      // scattered, then gathers (7 s)
  for (const l of letters) {
    const k = l.weight;
    const x = shake * k * (0.6 * Math.sin(t * l.f1 + l.ph1) + 0.4 * Math.sin(t * l.f2 + l.ph2)) + move.dx * push * k + sc * l.sx * W * 0.5;
    const y = shake * k * 0.7 * (0.6 * Math.sin(t * l.f2 + l.ph1) + 0.4 * Math.sin(t * l.f1 + l.ph2)) + move.dy * push * k + sc * l.sy * H * 0.6;
    const r = shake * k * 0.12 * Math.sin(t * l.f1 + l.ph2) + sc * l.rot * 140;
    l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg)`;
  }
}

const utc = (ms) => new Date(ms).toISOString().slice(11, 19);

function logQuake(q, info) {
  const row = document.createElement("div");
  row.className = `row new${info.live ? " live" : ""}${info.big ? " big" : ""}`;
  for (const text of [info.live ? "LIVE" : info.big ? "BIG" : utc(q.time).slice(0, 5), `M ${q.mag.toFixed(1)}`, `${Math.round(q.depth)} km`, q.place]) {
    const s = document.createElement("span"); s.textContent = text; row.appendChild(s);
  }
  elLog.prepend(row);
  setTimeout(() => row.classList.remove("new"), 2500);
  while (elLog.children.length > 9) elLog.lastChild.remove();
}

function scatterLog() {
  for (const row of elLog.children) {
    row.style.transition = "none";
    row.style.transform = `translate(${((Math.random() - 0.5) * 30).toFixed(1)}vw, ${((Math.random() - 0.5) * 50).toFixed(1)}vh) rotate(${((Math.random() - 0.5) * 60).toFixed(0)}deg)`;
    requestAnimationFrame(() => requestAnimationFrame(() => { row.style.transition = "transform 6s cubic-bezier(.2,.7,.2,1)"; row.style.transform = "none"; }));
  }
}

// ---- events from the relay ----------------------------------------------------------------------

// The live seismometer: its waveform replaces the drawn tremor.
const elGround = document.getElementById("ground");
let groundAt = -1e9, groundLabel = "";
function onGround(m) {
  groundAt = performance.now();
  groundLabel = `the ground under ${m.name} · live, ${m.delay} s ago`;
  for (const p of m.points) { trace[traceAt] = Math.max(-1.5, Math.min(1.5, p * 2.2)); traceAt = (traceAt + 1) % trace.length; }
}

// The room: how many phones are stations, and the invitation (QR code).
let room = { phones: 0, stations: [], url: "" };
const elRoom = document.getElementById("room"), elQr = document.getElementById("qr");
function onRoom(m) {
  const first = m.url !== room.url;
  room = m;
  elRoom.innerHTML = m.phones ? `<b>${m.phones}</b> phone${m.phones === 1 ? "" : "s"} · <b>${m.stations.length}</b> station${m.stations.length === 1 ? "" : "s"}${m.on ? "" : " · resting"}` : (m.broker ? `room ${m.room} · press c for the QR code` : "phones: connecting…");
  document.getElementById("qrCount").textContent = m.phones ? `${m.phones} station${m.phones === 1 ? "" : "s"} in the room` : "";
  if (first && m.url) {
    const qr = window.qrcode(0, "M"); qr.addData(m.url); qr.make();
    document.getElementById("qrCode").innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    document.getElementById("qrUrl").textContent = m.url.replace(/^https?:\/\//, "");
  }
}
const toggleQr = () => { elQr.hidden = !elQr.hidden; };

const MODES = { idle: "waiting for the Earth", replay: "REPLAY · the last 24 hours", live: "LIVE · the Earth right now", paused: "paused" };

// The score, as it is written: one line per earthquake, the data and the movements it calls.
// The calls arrive from the page on the left (choreo.js posts each one as it performs it).
const elStrip = document.getElementById("strip");
let codeLine = null;
function stripQuake(q, info) {
  const line = document.createElement("div"); line.className = "line";
  const data = document.createElement("span"); data.className = "data";
  data.textContent = `${info.live ? "LIVE  " : info.big ? "BIG  " : ""}M ${q.mag.toFixed(1)} · ${Math.round(q.depth)} km · ${q.place}`;
  const arrow = document.createElement("span"); arrow.className = "arrow"; arrow.textContent = "→";
  codeLine = document.createElement("span"); codeLine.className = "code";
  line.append(data, arrow, codeLine); elStrip.append(line);
  while (elStrip.children.length > 3) elStrip.firstChild.remove();
}
window.addEventListener("message", (e) => {
  if (typeof e.data?.choreo !== "string") return;
  if (!codeLine) stripQuake({ mag: 0, depth: 0, place: "" }, {}), (codeLine.parentElement.querySelector(".data").textContent = "the Earth is quiet");
  const call = document.createElement("b"); call.className = "fresh"; call.textContent = e.data.choreo;
  codeLine.append(call);
  setTimeout(() => call.classList.remove("fresh"), 700);
});

function onQuake(q, info = {}) {
  lastQuakeAt = performance.now();
  stripQuake(q, info);
  waves.push({ q, t0: lastQuakeAt, hit: new Set() });
  // Turn the globe to the earthquake (not all the way to the poles, so the map stays readable).
  target.lon = q.lon; target.lat = Math.max(-50, Math.min(50, q.lat * 0.7));
  energy = Math.min(1, energy + 0.2 + 0.8 * q.mag01);
  showQuake(q, info); logQuake(q, info);
}

const events = new EventSource("/events");
events.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === "quake") onQuake(m.q, m.info);
  else if (m.type === "mode") elMode.textContent = MODES[m.mode] ?? m.mode;
  else if (m.type === "activity") energy = m.energy;
  else if (m.type === "ground") onGround(m);
  else if (m.type === "room") onRoom(m);
  else if (m.type === "qr") toggleQr();
  else if (m.type === "page") { document.getElementById("credit").textContent = m.credit; if (m.reload) document.getElementById("page").src = `/wiki?${Date.now()}`; }
};

// For looking at the page without the relay: stage.html?demo fires earthquakes by itself.
if (new URLSearchParams(location.search).has("demo")) {
  events.close();
  const demo = (mag, depth, lat, lon, place) => onQuake({ mag, depth, lat, lon, place, time: Date.now(),
    mag01: Math.min(1, Math.max(0, (mag - 2) / 5)), depth01: Math.min(1, Math.log1p(depth) / Math.log1p(700)) });
  setTimeout(() => demo(4.4, 35, 46.2, 150.5, "279 km ENE of Kuril’sk, Russia"), 300);
  setTimeout(() => demo(6.6, 10, -21.3, 168.6, "80 km ENE of Tadine, New Caledonia"), 5000);
}

function frame(now) {
  // ease the globe towards the target; drift slowly when the Earth is quiet
  let d = ((target.lon - view.lon + 540) % 360) - 180;
  view.lon += d * 0.035; view.lat += (target.lat - view.lat) * 0.035;
  if (now - lastQuakeAt > 9000) target.lon += 0.03;
  energy *= 0.997;
  drawGlobe(now); animateWords(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// u: choose another page to dance, live (a web address, or a Wikipedia title).
async function choosePage() {
  const want = prompt("Which page should the earthquakes move?\n\nA web address (https://…), or a Wikipedia title: Montreal · Plate tectonics · pt:Terremoto\n(empty = back to the list of earthquakes)");
  if (want === null) return;
  const r = await (await fetch(`/page?url=${encodeURIComponent(want)}`)).json();
  if (!r.ok) alert(`That page could not be opened:\n${r.error}\n\nThe current page stays.`);
}
document.addEventListener("keydown", (e) => { if (e.key === "f") document.documentElement.requestFullscreen?.(); if (e.key === "c") toggleQr(); if (e.key === "u") choosePage(); });
