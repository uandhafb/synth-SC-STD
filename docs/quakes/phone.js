// Arrival Times: this phone is a seismic station.
//
// It is given one of the real stations in lib/geo.js. Then:
//   1. every earthquake the laptop plays arrives here the way it would at that station: first the
//      P wave (a knock), later the S wave (a heavy hit like the synth's, then a wash like the sea
//      with the station's note trembling in it), after the real travel
//      time compressed into seconds; nothing in the shadow zone (104-140 degrees away), where the
//      Earth's liquid core hides the earthquake; only a faint late P on the far side.
//      Every station has its own note of D minor (the key of the piece), so the room is a chord
//      and a passing wave is an arpeggio; near stations sound bright, far ones dull;
//   2. between earthquakes it plays, very quietly, the live ground of its own station (the same
//      real-time signal the laptop reads for Montréal).
// The sound is made here (Web Audio: sine tones and noise); nothing is downloaded. The output
// passes a limiter and a ceiling, so it can never reach the full level of the phone.
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

const VERSION = 3;                        // shown on the page, to tell a fresh copy from one the phone kept (change it with ?v= in index.html)
$("roomTxt").textContent = `room ${ROOM} · v${VERSION}`;
let station = null, mq = null, audio = null, ground = null;
let state = { on: true, level: 1 };       // set by the laptop (phones on/off, overall level)
let land = [];
const seen = new Set();                   // earthquake ids already scheduled (the broker may repeat)
const waves = [];                         // for the map: { q, t0 }

// ---- sound --------------------------------------------------------------------------------------

// Each station's note: D minor pentatonic (D F G A C) over two octaves from D5. Phone speakers play
// nothing below about 300 Hz, so the phones are the high, bright layer over the synth's low one.
// The order makes the first phones in the room a wide chord (D A F C D' G …), not a cluster.
const SCALE = [0, 7, 3, 10, 12, 5, 15, 19, 17, 22, 24];
const NAMES = ["D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B", "C", "C♯"];
const noteOf = (index) => { const st = SCALE[((index % SCALE.length) + SCALE.length) % SCALE.length]; return { freq: 587.33 * 2 ** (st / 12), name: NAMES[st % 12] }; };
const CEILING = 0.6;                      // the loudest the page can ever be: 60% of the phone's full level

function makeAudio(ctx = new (window.AudioContext || window.webkitAudioContext)()) {
  if (navigator.audioSession) { try { navigator.audioSession.type = "playback"; } catch { /* older iOS */ } }   // sound despite the silent switch
  // Protection, in three steps: (1) a limiter that only works when many waves pile up (ordinary
  // earthquakes pass untouched, so small stays small and big stays big); (2) a fixed gain that
  // undoes the make-up gain browsers add to the limiter; (3) a soft clipper (tanh) as the hard
  // ceiling: whatever happens before it, nothing louder than CEILING leaves the page.
  const master = ctx.createGain(); master.gain.value = 0.9;
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -6; limit.knee.value = 3; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.2;
  const trim = ctx.createGain(); trim.gain.value = 0.7;
  const ceil = ctx.createWaveShaper(), curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) curve[i] = CEILING * Math.tanh((i / 1024 - 1) * 1.3);
  ceil.curve = curve; ceil.oversample = "2x";
  master.connect(limit).connect(trim).connect(ceil).connect(ctx.destination);
  // two seconds of noise, reused for everything
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = () => { const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true; n.loopStart = Math.random(); return n; };

  // In a swarm many waves overlap: from the 7th sounding voice on they are played at half level,
  // and beyond 12 they are left out, so a busy minute does not turn into a wall.
  const sounding = [];
  const crowd = (at, len) => { for (let i = sounding.length - 1; i >= 0; i--) if (sounding[i] < ctx.currentTime) sounding.splice(i, 1);
    const n = sounding.filter((end) => end > at).length; if (n < 12) sounding.push(at + len); return n >= 12 ? 0 : n >= 6 ? 0.5 : 1; };

  // A small "spring" shared by all the sounds, after the synth's spring reverb: two short delays
  // (43 and 52 ms, the synth's two springs) feeding back through a lowpass.
  const spring = ctx.createGain(), back = ctx.createGain(), tone = ctx.createBiquadFilter(), wet = ctx.createGain();
  tone.type = "lowpass"; tone.frequency.value = 2600; wet.gain.value = 0.6;
  back.gain.value = 0.3;                  // two delays share the loop: 2 x 0.3 = 0.6 around, so it always dies away
  for (const t of [0.043, 0.052]) { const dl = ctx.createDelay(0.2); dl.delayTime.value = t; spring.connect(dl); back.connect(dl); dl.connect(tone); }
  tone.connect(back); tone.connect(wet).connect(master);
  const drive = new Float32Array(1025); for (let i = 0; i < drive.length; i++) drive[i] = Math.tanh((i / 512 - 1) * 2.2);

  // The hit: the phone's version of the note the synth plays for an earthquake (ruptureNote in the
  // relay), on the station's own note. The same recipe, scaled for a phone speaker:
  //   a saw and a triangle whose pitch FALLS into the note (the "thud": 10..24 semitones, like adsr_pitch)
  //   + dark noise, more for bigger earthquakes (nzlvl), all driven (vcfdrive)
  //   through a resonant lowpass that closes fast (vcfenv, edec); deep or far = darker
  //   and a send to the spring (spmix), more for bigger earthquakes.
  // m = size (0..1), len = seconds until it has died away.
  function hit(at, amp, freq, m, depth01, bright, len) {
    const fall = 0.04 + 0.14 * m, dec = Math.min(len, 0.2 + 1.3 * m);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), og = ctx.createGain(), n = noise(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
    o1.type = "sawtooth"; o2.type = "triangle"; og.gain.value = 0.5;
    for (const [o, f] of [[o1, freq], [o2, freq * 2]]) { o.frequency.setValueAtTime(f * 2 ** ((10 + 14 * m) / 12), at); o.frequency.exponentialRampToValueAtTime(f, at + fall); }
    nf.type = "lowpass"; nf.frequency.value = 1800; ng.gain.value = 0.3 + 1.6 * m;
    const sh = ctx.createWaveShaper(); sh.curve = drive;
    const cut = Math.max(freq * 1.3, (500 + 2400 * (1 - depth01)) * (0.35 + 0.65 * bright));
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 3.5;
    f.frequency.setValueAtTime(Math.min(9000, cut * (2 + 4 * bright)), at); f.frequency.exponentialRampToValueAtTime(cut, at + dec);
    const g = ctx.createGain(), send = ctx.createGain();
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp * 0.3, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, at + len);
    send.gain.value = 0.2 + 0.5 * m;
    o1.connect(sh); o2.connect(og).connect(sh); n.connect(nf).connect(ng).connect(sh); sh.connect(f).connect(g); g.connect(master); g.connect(send).connect(spring);
    for (const x of [o1, o2, n]) { x.start(at); x.stop(at + len + 0.05); }
  }

  // P wave: the first, smaller hit: a dry knock on the station's note.
  function pWave(at, amp, depth01, freq = 1174.66, bright = 1, mag01 = 0.5) {
    const len = 0.25 + 0.45 * mag01;
    amp *= crowd(at, len); if (!amp) return;
    hit(at, amp * 1.6, freq, 0.1 + 0.3 * mag01, depth01, bright, len);   // short, so it needs more level to be heard
  }

  // S wave: the big hit, an octave lower, and then the sea it leaves behind: a wash of noise that
  // rolls in slowly, with the station's note trembling quietly inside it.
  //   magnitude: bigger = a heavier hit, a longer wash, a stronger tremor
  function sWave(at, amp, depth01, mag01, freq = 1174.66, bright = 1) {
    const len = 0.7 + 3.6 * mag01, f2 = freq / 2;
    amp *= crowd(at, len); if (!amp) return len;
    hit(at, amp, f2, mag01, depth01, bright, Math.min(len, 0.5 + 2.2 * mag01));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp * 0.5, at + Math.min(0.5, len * 0.3)); g.gain.exponentialRampToValueAtTime(0.0008, at + len);
    // the wash: noise through a bandpass that rises and falls slowly, like a wave on a beach
    const n = noise(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(), sweep = ctx.createOscillator(), sg = ctx.createGain();
    nf.type = "bandpass"; nf.Q.value = 0.7; nf.frequency.value = 700 + 900 * bright; ng.gain.value = 0.45;
    sweep.frequency.value = 0.45 + 0.3 * Math.random(); sg.gain.value = 350 + 400 * bright; sweep.connect(sg).connect(nf.frequency);
    // the note inside it, with the tremor as its own gain stage (1 +- depth), so it never turns the
    // tone inside out (which would detune it)
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), og = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), trem = ctx.createGain();
    o1.type = "triangle"; o1.frequency.value = f2; o2.frequency.value = f2 * 1.004; og.gain.value = 0.6;
    lfo.frequency.value = 6 + 7 * mag01 + 2 * Math.random(); lg.gain.value = 0.2 + 0.5 * mag01; lfo.connect(lg).connect(trem.gain);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = Math.max(f2 * 1.5, (500 + 5000 * bright * bright) * (1 - 0.4 * depth01));
    n.connect(nf).connect(ng).connect(g); o1.connect(og); o2.connect(og); og.connect(trem).connect(g); g.connect(lp).connect(master);
    for (const x of [n, sweep, o1, o2, lfo]) { x.start(at); x.stop(at + len + 0.1); }
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
  const note = noteOf(STATIONS.indexOf(station)), bright = clamp01((a.strength - 0.2) / 0.8);   // near = bright, far = dull
  const now = audio.ctx.currentTime;
  const tp = a.p * SECONDS_PER_MINUTE, ts = a.s === null ? null : a.s * SECONDS_PER_MINUTE;
  audio.pWave(now + tp, 0.5 * loud + 0.05, q.depth01, note.freq, bright, q.mag01);
  setTimeout(() => {
    flash("p", 0.25 + 0.5 * loud, 0.35); shake(3 + 10 * loud, 0.35);
    say(`<b>P wave</b> from ${where} · M ${q.mag.toFixed(1)}<br>${Math.round(deg)}° away · ${a.p.toFixed(1)} min through the Earth${a.zone === "core" ? "<br>(it crossed the core: faint, and no S wave)" : ""}`);
  }, tp * 1000);
  if (ts !== null) {
    const len = audio.sWave(now + ts, 0.6 * loud + 0.05, q.depth01, q.mag01, note.freq, bright);
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
  $("code").textContent = station.code; $("name").textContent = station.name; $("region").textContent = `${station.region} · ${Math.abs(station.lat).toFixed(1)}°${station.lat >= 0 ? "N" : "S"} ${Math.abs(station.lon).toFixed(1)}°${station.lon >= 0 ? "E" : "W"} · its note: ${noteOf(STATIONS.indexOf(station)).name}`;
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
window.arrivalTimes = { onQuake, become, makeAudio, noteOf, CEILING, get station() { return station; }, get groundLive() { return performance.now() - groundAt < 8000; } };   // for tests and the console
