// The presentation: builds the blocks from content.js, runs Hydra behind them, turns them with
// the keyboard or with the hands (hands.js), and lets the visuals feel the live ground (the relay).
import { BLOCKS, QA } from "./content.js";
import { SCENES } from "./scenes.js";

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// ---- the words ----------------------------------------------------------------------------------

// Text from content.js to HTML: **strong**, `code`, [PLACEHOLDER]. Everything else is escaped.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\[([A-Z0-9 ,.:'’\-]{4,})\]/g, '<span class="placeholder">[$1]</span>');

const node = (label, small, i, cls = "") => `<div class="node ${cls}" style="--i:${i}">${label}${small ? `<small>${small}</small>` : ""}</div>`;
const arrow = '<span class="arrow">→</span>';
const EXTRAS = {
  schematic: () => `<div class="schematic">
    <div class="row">${[node("Tidal · Strudel", "the pattern", 0), node("SuperDirt", "one message per note", 1), node("3 oscillators", "+ noise, ring mod", 2), node("mixer", "", 3), node("filter", "VCF", 4), node("amplifier", "VCA", 5), node("spring reverb", "shared", 6), node("speakers", "", 7)].join(arrow)}</div>
    <div class="row">${node("envelopes · sample &amp; hold · envelope follower", "they move the pitch, the filter and the level (the patch cords)", 0, "side")}<span class="arrow">↑</span>${node("the panel in the browser", "sets every value the code leaves alone", 0, "side")}</div>
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
deck.innerHTML = BLOCKS.map((b) => `<section class="block${b.photo ? " has-photo" : ""}" data-id="${esc(b.id)}">
  <div class="kicker">${rich(b.kicker ?? "")}</div>
  <h1>${rich(b.title ?? "")}</h1>
  <div class="text">${(b.lines ?? []).map((l) => `<p>${rich(l)}</p>`).join("")}</div>
  ${b.photo ? `<img class="photo" alt="" src="photos/${esc(b.photo)}" data-file="${esc(b.photo)}">` : ""}
  ${b.extra && EXTRAS[b.extra] ? `<div class="extra">${EXTRAS[b.extra]()}</div>` : ""}
</section>`).join("");
// a photo that is not there yet: say which file is expected
for (const img of deck.querySelectorAll("img.photo")) img.addEventListener("error", () => { const d = document.createElement("div"); d.className = "photo missing"; d.textContent = `photo: put ${img.dataset.file} in presentation/photos/`; img.replaceWith(d); });
$("dots").innerHTML = BLOCKS.map(() => "<i></i>").join("");

// ---- Hydra ----------------------------------------------------------------------------------------

const L = { ground: 0, pulse: 0, cam: false };          // live values the scenes read (see scenes.js)
let h = null;
try {
  const canvas = $("hydra"), scale = Math.min(devicePixelRatio || 1, 1.5);
  const hydra = new window.Hydra({ canvas, width: Math.round(innerWidth * scale), height: Math.round(innerHeight * scale), detectAudio: false, makeGlobal: false });
  h = hydra.synth;
  addEventListener("resize", () => hydra.setResolution(Math.round(innerWidth * scale), Math.round(innerHeight * scale)));
} catch (err) { note(`visuals not available: ${err?.message ?? err}`, 8000); }
(function fade() { L.pulse *= 0.94; requestAnimationFrame(fade); })();

function runScene(name) {
  if (!h) return;
  try { (SCENES[name] ?? SCENES.rings)(h, L).out(h.o0); } catch (err) { console.error("scene", name, err); }
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
    if (h) { h.s0.init({ src: $("video") }); L.cam = true; runScene(BLOCKS[at].scene); }
  } catch (err) {
    $("cam").hidden = true;
    note(`no camera or no hand tracking (${err?.message ?? err}). Use the arrow keys.`, 9000);
  }
}
$("startBtn").addEventListener("click", () => start(true));
$("startNoCam").addEventListener("click", () => start(false));

// ---- the Earth: the relay's live messages (only when the page is opened through the relay) ----------------------

try {
  const events = new EventSource("/events");
  events.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.type === "ground") L.ground += (clamp(m.value * 1.6) - L.ground) * 0.15;       // smoothed: a tremor, not a flicker
    else if (m.type === "quake") L.pulse = Math.max(L.pulse, 0.4 + 0.6 * (m.q?.mag01 ?? 0.5));
    else if (m.type === "room" && m.url && window.qrcode && $("qrCode")) {
      const qr = window.qrcode(0, "M"); qr.addData(m.url); qr.make();
      $("qrCode").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
      $("qrUrl").textContent = m.url.replace(/^https?:\/\//, "");
    }
  };
  events.onerror = () => { L.ground *= 0.5; };
} catch { /* opened as a file: no live ground, the rest works */ }

window.presentation = { go, next, back, L, get at() { return at; }, get hands() { return hands; } };   // for tests and the console
