// The presentation: builds the blocks from content.js, runs Hydra behind them, turns them with
// the keyboard or with the hands (hands.js), and lets the visuals feel the live ground (the relay).
import { BLOCKS, QA } from "./content.js";
import { SCENES, prepare } from "./scenes.js";

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// ---- the words ----------------------------------------------------------------------------------

// Text from content.js to HTML: **strong**, `code`, [anything in square brackets] in pink.
// Everything else is escaped.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rich = (s) => esc(s).replace(/\{([^{}|]+)\|([^{}|\s]+)\}/g, '<a class="name" href="https://$2" target="_blank" rel="noopener">$1<sup>↗</sup></a>').replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\[([^\[\]]{2,})\]/g, '<span class="placeholder">[$1]</span>')
  .replace(/→ ((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<]*)?)/g, '<a class="ref" href="https://$1" target="_blank" rel="noopener">→ $1</a>');

const node = (label, small, i, cls = "") => `<div class="node ${cls}" style="--i:${i}">${label}${small ? `<small>${small}</small>` : ""}</div>`;
const arrow = '<span class="arrow">→</span>';
const EXTRAS = {
  // The architecture, checked against the code (sc/synthdefs/00_modules.scd, the voice function):
  // four lanes. The boxes of lanes 1 and 2 light up in the order a note travels; each envelope
  // lights together with the module it opens.
  schematic: () => `<div class="arch">
    <div class="lane"><div class="lab">1 · the code <span class="file">tidal/params.hs · strudel/params.js</span></div>
      <div class="row">${node("Tidal · Strudel", "I type a pattern", 0)}<span class="arrow osc">— OSC →</span>${node("SuperDirt", "gets one message per note, inside SuperCollider", 1)}</div></div>
    <div class="lane"><div class="lab">2 · the synth <span class="file">sc/synthdefs/ 00_modules.scd · scstd.scd · spring.scd</span></div>
      <div class="row">${[node("VCO 1 · VCO 2 · VCO 3", "oscillators + noise, ring mod", 2), node("mixer", "", 3), node("VCF", "filter", 4), node("VCA", "amplifier", 5), node("spring reverb", "one for all voices", 6), node("speakers", "", 7)].join(arrow)}</div></div>
    <div class="lane"><div class="lab">3 · <span class="file" style="margin-left:0">sc/synthdefs/ 00_modules.scd</span></div>
      <div class="row gap">${node("ADSR envelope", "opens the filter", 4, "side")}${node("AR envelope", "opens the amplifier", 5, "side")}${node("sample &amp; hold · lag · envelope follower", "the patch cords: to pitch, filter and level", 2, "side")}</div></div>
    <div class="lane"><div class="lab">4 · the panel <span class="file">ui/ · relay/ · sc/buses.scd</span></div>
      <div class="row">${node("sliders in the browser", "", 0, "side")}<span class="arrow osc">← OSC →</span>${node("SuperCollider", "keeps every value the code does not set", 1, "side")}</div></div>
  </div>`,
  code: () => `<div class="codebox"><span class="c">-- TidalCycles</span>
d1 <span class="k">$</span> n <span class="s">"c e g"</span> <span class="k">#</span> s <span class="s">"scstd"</span> <span class="k">#</span> vcfcut 800

<span class="c">// Strudel: the same line</span>
d1: n(<span class="s">"c e g"</span>).s(<span class="s">"scstd"</span>).vcfcut(800)</div>`,
  mapping: () => `<div class="mapping">
    <span>bigger</span><span class="to">→</span><span>lower, longer, louder</span>
    <span>deeper</span><span class="to">→</span><span>darker</span>
    <span>more earthquakes</span><span class="to">→</span><span>the music opens and gets denser</span>
    <span>the ground in Montréal</span><span class="to">→</span><span>its own voice, and the tremor of this page</span>
  </div>`,
  qr: () => `<div class="qr"><div class="code" id="qrCode"></div><div class="url" id="qrUrl">start the relay to show the QR code</div></div>`,
  sections: () => `<div class="sections">${[["o chão respira", "the ground breathes"], ["a falha", "the fault"], ["o enxame", "the swarm"], ["a ruptura", "the rupture"], ["as réplicas", "the aftershocks"], ["agora", "now"]].map(([pt, en]) => `<span>${pt}<b>${en}</b></span>`).join("")}</div>`,
};

const deck = $("deck");
deck.innerHTML = BLOCKS.map((b) => `<section class="block${b.photo || b.qr ? " has-photo" : ""}${b.dense ? " dense" : ""}" data-id="${esc(b.id)}">
  <div class="kicker">${rich(b.kicker ?? "")}</div>
  <h1>${rich(b.title ?? "")}</h1>
  <div class="text">${(b.lines ?? []).map((l) => `<p>${rich(l)}</p>`).join("")}</div>
  ${b.photo ? `<figure class="pic"><img class="photo" alt="" src="photos/${esc(b.photo)}" data-file="${esc(b.photo)}">${b.credit ? `<figcaption>${esc(b.credit)}</figcaption>` : ""}</figure>` : ""}
  ${b.qr ? `<figure class="pic qrpic"><div class="code" data-qr="https://${esc(b.qr)}"></div><figcaption>${esc(b.qr)}</figcaption></figure>` : ""}
  ${b.extra && EXTRAS[b.extra] ? `<div class="extra">${EXTRAS[b.extra]()}</div>` : ""}
</section>`).join("");
// a photo that is not there yet: say which file is expected
for (const img of deck.querySelectorAll("img.photo")) img.addEventListener("error", () => { const d = document.createElement("div"); d.className = "photo missing"; d.textContent = `photo: put ${img.dataset.file} in presentation/photos/`; img.replaceWith(d); });
// QR codes for fixed addresses (made here, no internet needed)
for (const el of deck.querySelectorAll("[data-qr]")) { try { const qr = window.qrcode(0, "M"); qr.addData(el.dataset.qr); qr.make(); el.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true }); } catch { el.textContent = el.dataset.qr; } }
$("dots").innerHTML = BLOCKS.map(() => "<i></i>").join("");

// ---- Hydra ----------------------------------------------------------------------------------------

const L = { ground: 0, swell: 0.5, wave: 0, pulse: 0, cam: false };   // live values the scenes read (see scenes.js)
let h = null;
try {
  const canvas = $("hydra"), scale = Math.min(devicePixelRatio || 1, 1.5);
  // The canvas must be given its real size here. Hydra does not resize a canvas it is handed, and
  // a canvas left at its default (300 x 150) is stretched over the whole screen: every thin line
  // then turns into steps, dots and dashes.
  canvas.width = Math.round(innerWidth * scale); canvas.height = Math.round(innerHeight * scale);
  const hydra = new window.Hydra({ canvas, width: Math.round(innerWidth * scale), height: Math.round(innerHeight * scale), detectAudio: false, makeGlobal: false,
    // Full precision for the drawing maths. Hydra's default (medium) is coarse on many graphics
    // chips: positions and, above all, the growing clock get rounded, and after a minute the thin
    // lines turn into steps, dots and dashes.
    precision: "highp" });
  h = hydra.synth;
  const fit = () => hydra.setResolution(Math.round(innerWidth * scale), Math.round(innerHeight * scale));
  fit(); addEventListener("resize", fit);
} catch (err) { note(`visuals not available: ${err?.message ?? err}`, 8000); }
(function fade() { L.pulse *= 0.94; requestAnimationFrame(fade); })();

function runScene(name) {
  if (!h) return;
  try { (SCENES[name] ?? SCENES.paper)(h, L).out(h.o0); } catch (err) { console.error("scene", name, err); }
}

// ---- moving through the blocks ----------------------------------------------------------------------

let at = -1;
function go(i) {
  i = clamp(i, 0, BLOCKS.length - 1);
  if (i === at) return;
  at = i;
  [...deck.children].forEach((el, k) => { el.classList.toggle("on", k === i); el.classList.toggle("seen", k < i); });
  [...$("dots").children].forEach((el, k) => el.classList.toggle("on", k <= i));
  L.pulse = 0.7;
  runScene(BLOCKS[i].scene);
  try { history.replaceState(null, "", `#${i + 1}`); } catch { /* file:// */ }
}
const next = () => go(at + 1), back = () => go(at - 1);

// ---- questions ------------------------------------------------------------------------------------------

$("qaList").innerHTML = QA.map((x) => `<li>${rich(x.q)}</li>`).join("");
const qaOpen = () => !$("qa").hidden;
function showQA(on) { $("qa").hidden = !on; if (on) answer(-1); }
function answer(i) {
  [...$("qaList").children].forEach((li, k) => li.classList.toggle("on", k === i));
  const box = $("qaAnswer"), x = QA[i];
  box.hidden = !x;
  if (x) box.innerHTML = `<h2>${rich(x.q)}</h2>${x.a.map((l) => `<p>${rich(l)}</p>`).join("")}<div class="where">where: ${rich(x.where ?? "")}</div>`;
}
[...$("qaList").children].forEach((li, k) => li.addEventListener("click", () => answer(k)));

// ---- keys -------------------------------------------------------------------------------------------------

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (qaOpen()) {
    if (k === "Escape" || k.toLowerCase() === "q") showQA(false);
    else if (/^[0-9]$/.test(k)) answer(k === "0" ? 9 : Number(k) - 1);
    return;
  }
  if (k === "ArrowRight" || k === "PageDown" || k === " ") { e.preventDefault(); next(); }
  else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); back(); }
  else if (k === "Home") go(0);
  else if (k === "End") go(BLOCKS.length - 1);
  else if (k.toLowerCase() === "q") showQA(true);
  else if (k.toLowerCase() === "f") { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
  else if (k.toLowerCase() === "h" && hands) { hands.setEnabled(!hands.enabled); note(hands.enabled ? "hands: on" : "hands: off (keys only)", 1500); }
  else if (k.toLowerCase() === "c") { const c = $("cam"); if (c.classList.contains("small")) { c.classList.remove("small"); c.style.visibility = "hidden"; } else if (c.style.visibility === "hidden") c.style.visibility = ""; else c.classList.add("small"); }
});

// ---- the hands ----------------------------------------------------------------------------------------------

let hands = null, noteTimer = null;
function note(text, ms = 4000) { const n = $("note"); n.textContent = text; n.hidden = false; clearTimeout(noteTimer); noteTimer = setTimeout(() => { n.hidden = true; }, ms); }

function onHandState(s) {
  const ring = $("ring"), fill = ring.querySelector(".fill");
  ring.classList.toggle("back", s.direction === "back");
  fill.style.strokeDashoffset = String(100.5 * (1 - s.progress));
  $("ringTxt").textContent = s.direction === "back" ? "←" : s.direction === "next" ? "→" : "";
  $("cam").classList.toggle("off", !s.enabled);
  $("camTxt").textContent = !s.enabled ? "hands off · press H" : s.waiting ? "done · lower your hands" : s.hands === 0 ? "no hand in view" : `${s.hands} hand${s.hands === 1 ? "" : "s"} · ${s.open} open${s.open === 1 ? " → next" : s.open >= 2 ? " → back" : ""}`;
}

async function start(withCamera) {
  $("start").hidden = true;
  go(Math.max(0, (Number(location.hash.slice(1)) || 1) - 1));
  if (!withCamera) return;
  $("cam").hidden = false;
  try {
    const { startHands } = await import("./hands.js");
    hands = await startHands({ video: $("video"), view: $("camView"), onState: onHandState,
      onStep: (dir) => { if (qaOpen()) return; if (dir === "next") next(); else back(); } });
    if (h) { h.s0.init({ src: $("video") }); prepare(h); L.cam = true; runScene(BLOCKS[at].scene); }
  } catch (err) {
    $("cam").hidden = true;
    note(`no camera or no hand tracking (${err?.message ?? err}). Use the arrow keys.`, 9000);
  }
}
$("startBtn").addEventListener("click", () => start(true));
$("startNoCam").addEventListener("click", () => start(false));

// ---- the Earth ------------------------------------------------------------------------------------
// The visuals feel two things:
//   the ground under Riachuelo, in the north-east of Brazil (station IU.RCBR), live: the page
//     listens to that seismometer by itself, straight from EarthScope, the way the phones do;
//   the movements the laptop plays in the piece: from the relay when the page is opened through it
//     (localhost), otherwise from the room's channel (MQTT), like a phone.

const STATION = "IU.RCBR";
// From the seismometer, three live values for the visuals:
//   L.wave    the line itself, right now (-1..1): everything on screen rides up and down on it
//   L.ground  how strongly the ground is moving (0..1)
//   L.swell   the same, compared with its own last half minute (0.5 = as usual, towards 1 = the
//             ground has just become busier, towards 0 = quieter). A seismometer never rests, so
//             "more than a moment ago" is what the eye can follow, not the absolute level.
let usual = null;
const feel = (v) => {
  L.ground += (clamp(v * 1.6) - L.ground) * 0.15;
  usual = usual === null ? v : usual + (v - usual) * 0.003;                       // about 15 s to settle (20 values a second)
  L.swell += (clamp(0.5 + (v - usual) / (2.2 * usual + 0.04)) - L.swell) * 0.08;    // eased: a swell takes about a second
};
const hit = (q) => { L.pulse = Math.max(L.pulse, 0.4 + 0.6 * (q?.mag01 ?? 0.5)); };
let source = "none";

// The seismograph in the corner: the real line, as it arrives (about 50 points a second).
const trace = new Float32Array(560); let traceAt = 0, lastData = 0, station = null, groundDelay = null, waveTo = 0;
function drawTrace(now) {
  requestAnimationFrame(drawTrace);
  L.wave += (waveTo - L.wave) * 0.25;
  const cv = $("trace"), c = cv.getContext("2d"), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  c.strokeStyle = "rgba(255,255,255,0.12)"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
  c.strokeStyle = "#d4ff3a"; c.lineWidth = 2; c.beginPath();
  for (let i = 0; i < trace.length; i++) { const y = H / 2 - trace[(traceAt + i) % trace.length] * H * 0.46; if (i) c.lineTo(i, y); else c.moveTo(i, y); }
  c.stroke();
  const live = now - lastData < 45000 && lastData > 0;
  $("seismoTxt").innerHTML = station ? (live ? `the ground under <b>${station.name}, ${station.region}</b><br>live · ${Math.round(groundDelay ?? 0)} s ago` : `${station.name}, ${station.region}<br>waiting for the signal…`) : "waiting for the ground…";
}

(async () => {
  try {
    const [{ Ground }, { STATIONS }] = await Promise.all([import("../quakes/lib/ground.js"), import("../quakes/lib/geo.js")]);
    station = STATIONS.find((x) => x.code === STATION) ?? STATIONS[0];
    const g = new Ground({ match: station.match, name: station.name, delay: 9, log: () => {},
      onValue: (v) => { if (v > 0) source = station.name; feel(v); },
      onTrace: (pts) => { lastData = performance.now(); groundDelay = g.delay ?? g.o.delay;
        for (const p of pts) { const y = Math.max(-1, Math.min(1, p * 2.2)); trace[traceAt] = y; traceAt = (traceAt + 1) % trace.length; waveTo = y; } } });
    g.start();
    $("seismo").hidden = false; requestAnimationFrame(drawTrace);
  } catch (err) { console.warn("no live ground:", err); }
})();

async function roomChannel() {
  try {
    const { connectMqtt, BROKER, topicsFor } = await import("../quakes/lib/mqtt-lite.js");
    const room = (new URLSearchParams(location.search).get("room") || "EAST398498").replace(/[^A-Za-z0-9]/g, "").slice(0, 12), topic = topicsFor(room).quake;
    const mq = connectMqtt(BROKER, { clientId: `at-talk-${Math.random().toString(36).slice(2, 10)}`,
      onMessage: (t, payload) => { if (t === topic) { try { hit(JSON.parse(payload)); } catch { /* not a movement */ } } } });
    mq.subscribe(topic);
  } catch (err) { console.warn("no room channel:", err); }
}

if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  let relay = false;
  try {
    const events = new EventSource("/events");
    events.onopen = () => { relay = true; };
    events.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.type === "quake") hit(m.q); };
    events.onerror = () => { if (!relay) { events.close(); roomChannel(); } };     // no relay behind this page
  } catch { roomChannel(); }
} else roomChannel();

window.presentation = { go, next, back, L, get h() { return h; }, get source() { return source; }, get at() { return at; }, get hands() { return hands; } };   // for tests and the console
