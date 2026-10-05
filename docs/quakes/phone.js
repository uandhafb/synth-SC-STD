// Arrival Times: this phone is a seismic station.
//
// It is given one of the real stations in lib/geo.js. Then:
//   1. every earthquake the laptop plays arrives here the way it would at that station: first the
//      P wave (a short knock), later the S wave (a longer rumble), after the real travel time
//      compressed into seconds; nothing in the shadow zone (104-140 degrees away), where the Earth's
//      liquid core hides the earthquake; only a faint late P on the far side;
//   2. between earthquakes it plays, very quietly, the live ground of its own station (the same
//      real-time signal the laptop reads for Montréal).
// The sound is made here (Web Audio: noise and a tone); nothing is downloaded.
// Messages come through a public MQTT broker (the approach of Gabriel Vigliensoni's phase-study
// ensemble); the page itself is static.

import { STATIONS, distanceDeg, arrivals, SECONDS_PER_MINUTE } from "./lib/geo.js";
import { connectMqtt, BROKER, topicsFor } from "./lib/mqtt-lite.js";
import { Ground } from "./lib/ground.js";

const params = new URLSearchParams(location.search);
const ROOM = (params.get("room") || "TEST").replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
const T = topicsFor(ROOM);
const $ = (id) => document.getElementById(id);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const store = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } } };
const ID = store.get("at-id") || (() => { const id = Math.random().toString(36).slice(2, 10); store.set("at-id", id); return id; })();

$("roomTxt").textContent = `room ${ROOM}`;
let station = null, mq = null, audio = null, ground = null;
let state = { on: true, level: 1 };       // set by the laptop (phones on/off, overall level)
let land = [];
const seen = new Set();                   // earthquake ids already scheduled (the broker may repeat)
const waves = [];                         // for the map: { q, t0 }

// ---- sound --------------------------------------------------------------------------------------

function makeAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (navigator.audioSession) { try { navigator.audioSession.type = "playback"; } catch { /* older iOS */ } }   // sound despite the silent switch
  const master = ctx.createGain(); master.gain.value = 0.9;
  const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -8; limit.ratio.value = 12;
  master.connect(limit).connect(ctx.destination);
  // two seconds of noise, reused for everything
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = () => { const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true; n.loopStart = Math.random(); return n; };

  // P wave: a short, sharp knock. Shallow earthquakes sound brighter, deep ones darker.
  function pWave(at, amp, depth01) {
    const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain();
    const freq = 700 + 1500 * (1 - depth01);
    f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 2.5;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, at + 0.11);
    o.frequency.setValueAtTime(freq * 0.9, at); o.frequency.exponentialRampToValueAtTime(freq * 0.45, at + 0.08);
    og.gain.setValueAtTime(0, at); og.gain.linearRampToValueAtTime(amp * 0.6, at + 0.003); og.gain.exponentialRampToValueAtTime(0.0008, at + 0.09);
    n.connect(f).connect(g).connect(master); o.connect(og).connect(master);
    n.start(at); n.stop(at + 0.2); o.start(at); o.stop(at + 0.2);
  }

  // S wave: a longer, heavier rumble with a tremor in it. Bigger = longer; deeper = darker.
  function sWave(at, amp, depth01, mag01) {
    const len = 0.7 + 3.6 * mag01;
    const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    f.type = "lowpass"; f.frequency.setValueAtTime(420 + 900 * (1 - depth01), at); f.frequency.exponentialRampToValueAtTime(220, at + len); f.Q.value = 1.2;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.05); g.gain.exponentialRampToValueAtTime(0.0008, at + len);
    // phone speakers cannot play real bass: the "low" tone sits where they can (around 200 Hz)
    o.type = "triangle"; o.frequency.setValueAtTime(250 - 70 * depth01, at); o.frequency.exponentialRampToValueAtTime(170 - 40 * depth01, at + len);
    og.gain.setValueAtTime(0, at); og.gain.linearRampToValueAtTime(amp * 0.7, at + 0.06); og.gain.exponentialRampToValueAtTime(0.0008, at + len);
    lfo.frequency.value = 13 + 9 * Math.random(); lg.gain.value = amp * 0.5; lfo.connect(lg).connect(g.gain);
    n.connect(f).connect(g).connect(master); o.connect(og).connect(master);
    for (const x of [n, o, lfo]) { x.start(at); x.stop(at + len + 0.1); }
    return len;
  }

  // The station's own ground: a very quiet band of noise that swells when the ground moves more.
  const bed = noise(), bf = ctx.createBiquadFilter(), bg = ctx.createGain();
  bf.type = "bandpass"; bf.frequency.value = 420; bf.Q.value = 0.9; bg.gain.value = 0;
  bed.connect(bf).connect(bg).connect(master); bed.start();
  function groundLevel(v) {
    const t = ctx.currentTime;
    bg.gain.setTargetAtTime(state.on ? 0.012 + 0.11 * v * v : 0, t, 0.12);
    bf.frequency.setTargetAtTime(300 + 900 * v, t, 0.2);
  }

  return { ctx, master, pWave, sWave, groundLevel };
}

// ---- an earthquake arrives ----------------------------------------------------------------------

function onQuake(q) {
  if (!station || !audio || seen.has(q.id)) return;
  seen.add(q.id);
  const deg = distanceDeg(q, station), a = arrivals(deg);
  waves.push({ q, t0: performance.now() });
  const where = q.place.replace(/^.*? of /, "");
  if (!state.on) return;
  if (a.zone === "shadow") {
    setTimeout(() => say(`<b>${where}</b> · M ${q.mag.toFixed(1)}<br>${Math.round(deg)}° away: in the shadow zone.<br>The Earth's core hides this one from here.`), 3000);
    return;
  }
  const loud = clamp01(a.strength * (0.3 + 0.7 * q.mag01)) * state.level;
  const now = audio.ctx.currentTime;
  const tp = a.p * SECONDS_PER_MINUTE, ts = a.s === null ? null : a.s * SECONDS_PER_MINUTE;
  audio.pWave(now + tp, 0.5 * loud + 0.05, q.depth01);
  setTimeout(() => {
    flash("p", 0.25 + 0.5 * loud, 0.35); shake(3 + 10 * loud, 0.35);
    say(`<b>P wave</b> from ${where} · M ${q.mag.toFixed(1)}<br>${Math.round(deg)}° away · ${a.p.toFixed(1)} min through the Earth${a.zone === "core" ? "<br>(it crossed the core: faint, and no S wave)" : ""}`);
  }, tp * 1000);
  if (ts !== null) {
    const len = audio.sWave(now + ts, 0.75 * loud + 0.05, q.depth01, q.mag01);
    setTimeout(() => {
      flash("s", 0.3 + 0.6 * loud, len); shake(6 + 26 * loud, len);
      say(`<b class="s">S wave</b> from ${where} · M ${q.mag.toFixed(1)}<br>${Math.round(deg)}° away · ${a.s.toFixed(1)} min through the Earth`);
      if (navigator.vibrate) navigator.vibrate(q.mag01 > 0.6 ? [180, 60, 260, 60, 400] : q.mag01 > 0.3 ? [120, 50, 200] : [90]);
    }, ts * 1000);
  }
}

const say = (html) => { $("arrival").innerHTML = html; };
function flash(kind, amount, seconds) {
  const el = $("flash"); el.className = ""; void el.offsetWidth;
  el.style.setProperty("--amt", amount.toFixed(2)); el.style.setProperty("--len", `${seconds.toFixed(2)}s`); el.className = kind;
}
function shake(px, seconds) {
  const el = $("name"); el.classList.remove("shake"); void el.offsetWidth;
  el.style.setProperty("--px", `${px.toFixed(1)}px`); el.style.setProperty("--len", `${Math.max(0.3, seconds).toFixed(2)}s`); el.classList.add("shake");
}

// ---- the map and the live line ------------------------------------------------------------------

const trace = new Float32Array(240); let traceAt = 0, groundAt = -1e9;

function draw(now) {
  const map = $("map"), dpr = window.devicePixelRatio || 1, r = map.getBoundingClientRect();
  if (r.width) {
    if (map.width !== Math.round(r.width * dpr)) { map.width = Math.round(r.width * dpr); map.height = Math.round(r.height * dpr); }
    const c = map.getContext("2d"), W = r.width, H = r.height;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const X = (lon) => ((lon + 180) / 360) * W, Y = (lat) => ((90 - lat) / 180) * H;
    c.strokeStyle = "rgba(233,230,223,0.4)"; c.lineWidth = 0.7;
    for (const ring of land) { c.beginPath(); ring.forEach(([lon, lat], i) => { if (i && Math.abs(lon - ring[i - 1][0]) < 90) c.lineTo(X(lon), Y(lat)); else c.moveTo(X(lon), Y(lat)); }); c.stroke(); }
    for (let i = waves.length - 1; i >= 0; i--) {              // the epicentres, fading
      const w = waves[i], age = (now - w.t0) / 1000, fade = 1 - age / 14;
      if (fade <= 0) { waves.splice(i, 1); continue; }
      c.fillStyle = `rgba(255,90,54,${fade.toFixed(2)})`; c.beginPath(); c.arc(X(w.q.lon), Y(w.q.lat), 3 + 10 * w.q.mag01, 0, 7); c.fill();
      c.strokeStyle = `rgba(255,90,54,${(fade * 0.5).toFixed(2)})`; c.lineWidth = 1; c.beginPath(); c.moveTo(X(w.q.lon), Y(w.q.lat)); c.lineTo(X(station.lon), Y(station.lat)); c.stroke();
    }
    if (station) { c.fillStyle = "#e9e6df"; c.beginPath(); c.arc(X(station.lon), Y(station.lat), 4.5, 0, 7); c.fill();
      c.strokeStyle = "#e9e6df"; c.lineWidth = 1; c.beginPath(); c.arc(X(station.lon), Y(station.lat), 9 + 2 * Math.sin(now / 400), 0, 7); c.stroke(); }
  }
  const tr = $("trace"), tb = tr.getBoundingClientRect();
  if (tb.width) {
    if (tr.width !== Math.round(tb.width * dpr)) { tr.width = Math.round(tb.width * dpr); tr.height = Math.round(tb.height * dpr); }
    const c = tr.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, tb.width, tb.height);
    c.strokeStyle = "rgba(233,230,223,0.85)"; c.lineWidth = 1; c.beginPath();
    for (let i = 0; i < trace.length; i++) { const v = trace[(traceAt + i) % trace.length], x = (tb.width * i) / (trace.length - 1), y = tb.height / 2 - v * tb.height * 0.45; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
    $("groundTxt").textContent = now - groundAt < 8000 ? `the ground at ${station.name}, live (${Math.round(ground.delay ?? 9)} s ago)` : station ? "waiting for this station's signal…" : "";
  }
  requestAnimationFrame(draw);
}

// ---- joining ------------------------------------------------------------------------------------

function become(index) {
  station = STATIONS[((index % STATIONS.length) + STATIONS.length) % STATIONS.length];
  store.set("at-station", String(index));
  $("code").textContent = station.code; $("name").textContent = station.name; $("region").textContent = `${station.region} · ${Math.abs(station.lat).toFixed(1)}°${station.lat >= 0 ? "N" : "S"} ${Math.abs(station.lon).toFixed(1)}°${station.lon >= 0 ? "E" : "W"}`;
  ground?.stop();
  ground = new Ground({ match: station.match, name: station.name, delay: 9, log: () => {},
    onValue: (v) => audio?.groundLevel(v),
    onTrace: (pts) => { groundAt = performance.now(); for (const p of pts) { trace[traceAt] = Math.max(-1, Math.min(1, p * 2.2)); traceAt = (traceAt + 1) % trace.length; } } });
  ground.start();
}

async function keepAwake() {
  try { const lock = await navigator.wakeLock?.request("screen"); lock?.addEventListener("release", () => document.visibilityState === "visible" && keepAwake()); } catch { /* not allowed (low power mode) */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && station) { keepAwake(); audio?.ctx.resume(); } });

function join() {
  audio = makeAudio(); audio.ctx.resume();
  $("join").hidden = true; $("station").hidden = false;
  keepAwake();
  const saved = store.get("at-station");
  if (saved !== null) become(Number(saved));
  // ask the laptop which station to be; if it does not answer (4 s after the connection is up, or
  // 15 s in all), choose one at random
  const random = () => { if (!station) become(Math.floor(Math.random() * STATIONS.length)); };
  let fallback = setTimeout(random, 15000);
  mq = connectMqtt(params.get("broker") || BROKER, { clientId: `at-phone-${ID}`,
    onState: (ok) => $("status").classList.toggle("ok", ok),
    onConnect: () => { mq.publish(T.join, { id: ID, want: station ? STATIONS.indexOf(station) : null }); if (!station) { clearTimeout(fallback); fallback = setTimeout(random, 4000); } },
    onMessage: (topic, payload) => {
      let m; try { m = JSON.parse(payload); } catch { return; }
      if (topic === T.quake) onQuake(m);
      else if (topic === T.state) { state = { on: m.on !== false, level: typeof m.level === "number" ? m.level : 1 }; if (!state.on) say("resting…"); }
      else if (topic === T.assign(ID) && typeof m.station === "number") { clearTimeout(fallback); if (!station || STATIONS.indexOf(station) !== m.station) become(m.station); }
    } });
  for (const t of [T.quake, T.state, T.assign(ID)]) mq.subscribe(t);
  setInterval(() => station && mq.publish(T.here, { id: ID, station: STATIONS.indexOf(station) }), 10000);
  $("vol").addEventListener("input", (e) => audio.master.gain.setTargetAtTime(Number(e.target.value), audio.ctx.currentTime, 0.05));
  fetch("data/land.json").then((r) => r.json()).then((d) => { land = d; }).catch(() => {});
  requestAnimationFrame(draw);
}
$("joinBtn").addEventListener("click", join, { once: true });

// For testing without a laptop: ?demo plays an earthquake a few seconds after joining.
if (params.has("demo")) $("joinBtn").addEventListener("click", () => setTimeout(() => onQuake({ id: "demo", mag: 6.5, depth: 30, lat: -5, lon: 106.9, place: "121 km NNE of Teluknaga, Indonesia", mag01: 0.9, depth01: 0.52 }), 2500));
window.arrivalTimes = { onQuake, become, get station() { return station; }, get groundLive() { return performance.now() - groundAt < 8000; } };   // for tests and the console
