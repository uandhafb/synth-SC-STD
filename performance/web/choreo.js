// Arrival Times: the choreography of a real web page.
//
// A small movement vocabulary for the words of a page, in the spirit of Joana Chicau's
// choreographic coding (the web page as a stage, its elements as bodies, code as the score).
// The verbs are the performer's own, from her MIDI web-choreography sketches:
//     shake  wobble  float  stretch  tilt  bounce  fall  + breathing (after Chicau)  + still
// Here the earthquakes call them (see score()); they can also be typed in the browser console:
//     shake("Indonesia", 0.8)     bounce("rows", 0.6)     tilt("page", -8)     still()
//
// "what" can be a word of the page ("Indonesia": every place it is written on screen), "words"
// (a handful of the words on screen), "page", "rows", "headings", or a CSS selector.
// Amounts go from 0 to 1. The page never scrolls by itself: the words move where they are.
// The relay adds this file to the page it fetched; every call is also shown as code on the stage.

const ORIGIN = new URL(import.meta.url).origin;
const content = () => document.querySelector("#mw-content-text") ?? document.body;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const running = new Set();          // animations in progress (so still() can stop them)
let breath = null;

// ---- finding the bodies -------------------------------------------------------------------------

const wordCache = new Map();

// Every place a word is written: each occurrence is wrapped in its own <span> so it can move.
function findWord(word) {
  const key = word.toLowerCase();
  if (wordCache.has(key)) return wordCache.get(key);
  const spans = [];
  const walker = document.createTreeWalker(content(), NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.toLowerCase().includes(key) && !n.parentElement.closest("script, style, .choreo-w") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const nodes = [];
  while (walker.nextNode() && nodes.length < 400) nodes.push(walker.currentNode);
  for (const node of nodes) {
    let rest = node, at;
    while (rest && (at = rest.nodeValue.toLowerCase().indexOf(key)) >= 0 && spans.length < 400) {
      const hit = rest.splitText(at);
      rest = hit.splitText(word.length);
      const span = document.createElement("span");
      span.className = "choreo-w";
      hit.replaceWith(span); span.appendChild(hit);
      spans.push(span);
    }
  }
  wordCache.set(key, spans);
  return spans;
}

const inView = (el, margin = 0.5) => { const r = el.getBoundingClientRect(); return r.bottom > -innerHeight * margin && r.top < innerHeight * (1 + margin) && r.width > 0; };

// A handful of the words that are on screen right now (each wrapped once, then reused).
function someWords(n) {
  const blocks = [...content().querySelectorAll("td, th, p, li, h2, h3, caption, figcaption")].filter((el) => inView(el, 0) && el.textContent.trim().length > 3);
  const out = [...content().querySelectorAll(".choreo-w")].filter((el) => inView(el, 0));
  for (let tries = 0; out.length < n && tries < n * 4 && blocks.length; tries++) {
    const block = blocks[Math.floor(Math.random() * blocks.length)];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (/[\p{L}]{4,}/u.test(t.nodeValue) && !t.parentElement.closest(".choreo-w, script, style, sup") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    if (!nodes.length) continue;
    const node = nodes[Math.floor(Math.random() * nodes.length)];
    const words = [...node.nodeValue.matchAll(/[\p{L}]{4,}/gu)], m = words[Math.floor(Math.random() * words.length)];
    const hit = node.splitText(m.index); hit.splitText(m[0].length);
    const span = document.createElement("span"); span.className = "choreo-w";
    hit.replaceWith(span); span.appendChild(hit);
    out.push(span);
  }
  return out.sort(() => Math.random() - 0.5).slice(0, n);
}

// The letters of a word, each in its own <span> (so they can fall one by one).
function letters(word) {
  if (!word.dataset.split) {
    const text = word.textContent; word.textContent = ""; word.dataset.split = "1";
    for (const ch of text) { const l = document.createElement("span"); l.className = "choreo-l"; l.textContent = ch; word.appendChild(l); }
  }
  return [...word.children];
}

function bodies(what, n = 14) {
  if (what instanceof Element) return [what];
  if (what === "words") return someWords(n);
  if (what === "page") return [content()];
  if (what === "rows") return [...content().querySelectorAll("tr")].filter((el) => inView(el, 0.1));
  if (what === "headings") return [...document.querySelectorAll("h1, h2, h3, caption, th")].filter((el) => inView(el, 0.1));
  if (/^[.#\[]/.test(what)) return [...document.querySelectorAll(what)].filter((el) => inView(el, 0.1));
  return findWord(what).filter((el) => inView(el));
}

// ---- the stage directions (shown as code) ---------------------------------------------------------

const fmt = (x) => (typeof x === "number" ? String(Math.round(x * 100) / 100) : JSON.stringify(x));
function say(verb, ...args) {
  const code = `${verb}(${args.filter((a) => a !== undefined).map(fmt).join(", ")})`;
  try { window.parent.postMessage({ choreo: code }, "*"); } catch { /* no stage around this page */ }
  return code;
}

function animate(el, frames, options) {
  const a = el.animate(frames, { composite: "add", easing: "linear", ...options });
  running.add(a);
  a.finished.catch(() => {}).finally(() => running.delete(a));
  return a;
}

function light(els, ms, cls = "choreo-on") {           // the moving words are marked, so the eye finds them
  for (const el of els) if (el.classList.contains("choreo-w")) { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }
}

// ---- the vocabulary -----------------------------------------------------------------------------

// shake: a fast side-to-side tremor that dies away (the seismograph's needle).
export function shake(what, amount = 0.5) {
  say("shake", what, amount);
  const a = clamp(amount), els = bodies(what, Math.round(8 + 40 * a)), ms = 800 + 4200 * a, px = (what === "page" ? 1 : 3) + (what === "page" ? 14 : 34) * a;
  for (const el of els) {
    const steps = Math.round(ms / 45), frames = [];
    for (let i = 0; i <= steps; i++) {
      const k = Math.exp(-3.2 * (i / steps)) * (i === steps ? 0 : 1);
      frames.push({ transform: `translate(${(rand(-1, 1) * px * k).toFixed(1)}px, ${(rand(-0.4, 0.4) * px * k).toFixed(1)}px)` });
    }
    animate(el, frames, { duration: ms });
  }
  light(els, ms);
}

// wobble: a slow rotation back and forth that settles.
export function wobble(what, amount = 0.5) {
  say("wobble", what, amount);
  const a = clamp(amount), deg = (what === "page" ? 0.3 : 2) + (what === "page" ? 1.5 : 14) * a, ms = 2000 + 3000 * a;
  const els = bodies(what);
  for (const el of els) {
    const frames = [];
    for (let i = 0; i <= 24; i++) frames.push({ transform: `rotate(${(Math.sin(i * 0.9 + rand(0, 0.3)) * deg * Math.exp(-2.6 * (i / 24))).toFixed(2)}deg)` });
    frames.push({ transform: "rotate(0deg)" });
    animate(el, frames, { duration: ms });
  }
  light(els, ms);
}

// float: lifts (amount > 0) or sinks (amount < 0), hangs there, and comes back.
export function float(what, amount = 0.5) {
  say("float", what, amount);
  const a = clamp(amount, -1, 1), page = what === "page";
  const dist = page ? `${(-a * 9).toFixed(1)}vh` : `${(-a * 46).toFixed(0)}px`;
  const blur = page ? `blur(${(Math.abs(a) * 1.3).toFixed(1)}px)` : "blur(0px)";
  for (const el of bodies(what)) {
    animate(el, [{ transform: "translateY(0)", filter: "blur(0px)" }, { transform: `translateY(${dist})`, filter: blur, offset: 0.25 },
      { transform: `translateY(${dist})`, filter: blur, offset: 0.6 }, { transform: "translateY(0)", filter: "blur(0px)" }],
      { duration: 4500 + 3500 * Math.abs(a), easing: "ease-in-out", composite: "replace" });
  }
}

// stretch: pulled wide, then released.
export function stretch(what, amount = 0.5) {
  say("stretch", what, amount);
  const a = clamp(amount), els = bodies(what);
  for (const el of els) animate(el, [{ transform: "scaleX(1)" }, { transform: `scaleX(${(1 + 1.6 * a).toFixed(2)})`, offset: 0.3 }, { transform: "scaleX(1)" }],
    { duration: 900 + 1500 * a, easing: "cubic-bezier(.2,.8,.2,1)" });
  light(els, 900 + 1500 * a);
}

// tilt: the whole body leans by `degrees` and swings back upright.
export function tilt(what, degrees = 5) {
  say("tilt", what, degrees);
  const d = clamp(degrees, -25, 25);
  for (const el of bodies(what)) {
    animate(el, [{ transform: "rotate(0deg)" }, { transform: `rotate(${d}deg)`, offset: 0.12 }, { transform: `rotate(${(-d * 0.45).toFixed(2)}deg)`, offset: 0.4 },
      { transform: `rotate(${(d * 0.18).toFixed(2)}deg)`, offset: 0.68 }, { transform: "rotate(0deg)" }], { duration: 2600, easing: "ease-out" });
  }
}

// bounce: each body is thrown up and lands; with a large amount they scatter before gathering.
export function bounce(what, amount = 0.5) {
  say("bounce", what, amount);
  const a = clamp(amount), els = bodies(what);
  for (const el of els) {
    const up = -(12 + 150 * a) * rand(0.5, 1), side = a > 0.6 ? rand(-1, 1) * 260 * a : 0, turn = a > 0.6 ? rand(-1, 1) * 28 * a : 0;
    animate(el, [{ transform: "translate(0, 0) rotate(0deg)" }, { transform: `translate(${side.toFixed(0)}px, ${up.toFixed(0)}px) rotate(${turn.toFixed(1)}deg)`, offset: 0.18 },
      { transform: `translate(${(side * 0.8).toFixed(0)}px, ${(-up * 0.25).toFixed(0)}px) rotate(${(turn * 0.7).toFixed(1)}deg)`, offset: 0.45 },
      { transform: "translate(0, 0) rotate(0deg)" }],
      { duration: 1600 + 5000 * a, delay: rand(0, 350), easing: "cubic-bezier(.2,.7,.2,1)" });
  }
  light(els, 1600 + 5000 * a);
}

// fall: the letters let go, drop down the page tumbling, lie there, and climb back to their places.
export function fall(what, amount = 0.5) {
  say("fall", what, amount);
  const a = clamp(amount), els = bodies(what, Math.round(6 + 44 * a)).filter((el) => el.classList?.contains("choreo-w"));
  const ms = 3500 + 4500 * a;
  for (const el of els) {
    const room = Math.max(40, innerHeight - el.getBoundingClientRect().top - 10);       // how far down the screen goes
    for (const l of letters(el)) {
      const down = room * rand(0.55, 1) * (0.5 + 0.5 * a), side = rand(-40, 40) * a, turn = rand(-160, 160);
      const there = `translate(${side.toFixed(0)}px, ${down.toFixed(0)}px) rotate(${turn.toFixed(0)}deg)`;
      animate(l, [{ transform: "translate(0, 0) rotate(0deg)", easing: "cubic-bezier(.55,0,1,.45)" },                 // gravity
        { transform: there, offset: 0.28, easing: "linear" }, { transform: there, offset: 0.62, easing: "cubic-bezier(.2,.7,.2,1)" },
        { transform: "translate(0, 0) rotate(0deg)" }], { duration: ms, delay: rand(0, 700), composite: "replace" });
    }
  }
  light(els, ms, "choreo-fall");
}

// breathing: the resting state. The page slowly swells and settles while the Earth is quiet.
export function breathing() {
  say("breathing");
  breath?.cancel();
  breath = content().animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.012)", opacity: 0.86 }, { transform: "scale(1)", opacity: 1 }],
    { duration: 6500, iterations: Infinity, easing: "ease-in-out" });
}

// still: everything stops and rests.
export function still() {
  say("still");
  breath?.cancel(); breath = null;
  for (const a of [...running]) a.cancel();
}

// ---- the score: how an earthquake becomes movement ----------------------------------------------

const STATES = { CA: "California", AK: "Alaska", NV: "Nevada", HI: "Hawaii", WA: "Washington", OR: "Oregon", TX: "Texas", OK: "Oklahoma", MT: "Montana", UT: "Utah", ID: "Idaho", WY: "Wyoming", NM: "New Mexico", AZ: "Arizona", PR: "Puerto Rico" };

// "121 km NNE of Teluknaga, Indonesia" -> ["Indonesia", "Teluknaga"]: the names to look for.
export function placeWords(place) {
  const name = place.replace(/^.*? of /, "").replace(/\b(region|off the coast of|central|southern|northern|eastern|western|near the coast of)\b/gi, "").trim();
  const parts = name.split(",").map((s) => s.trim()).filter(Boolean).reverse();
  return parts.flatMap((p) => (STATES[p] ? [STATES[p]] : [p])).filter((p) => p.length > 2);
}

let breathTimer = null;

export function score(q) {
  breath?.cancel(); breath = null;                  // the earthquake interrupts the breathing
  clearTimeout(breathTimer);
  // The place's name, where it is written on screen; otherwise a handful of the words on screen.
  const word = placeWords(q.place).find((w) => findWord(w).some((el) => inView(el, 0)));
  // Small and medium earthquakes move words and letters only. The whole page moves (leans, sinks,
  // throws its rows) only for big ones (M 5+), so a replay does not rock the page all the time.
  shake(word ?? "words", q.mag01);
  if (word && q.mag01 > 0.45) wobble(word, Math.round(q.mag01 * 80) / 100);
  if (q.mag01 > 0.35) setTimeout(() => fall("words", Math.round(q.mag01 * 100) / 100), 500);                          // stronger: letters fall
  if (q.mag >= 5) {
    setTimeout(() => tilt("page", Math.round(-(q.lon / 180) * (2 + 9 * q.mag01) * 10) / 10), 250);                    // leans away from the quake's side of the map
    if (q.depth01 > 0.6) setTimeout(() => float("page", -Math.round(q.depth01 * 60) / 100), 1200);                    // deep: the page sinks a little
  }
  if (q.mag >= 5.5) setTimeout(() => { bounce("rows", q.mag01); shake("page", Math.round(q.mag01 * 70) / 100); }, 450);  // very big: the table is thrown
  breathTimer = setTimeout(breathing, 9000 + 6000 * q.mag01);
}

// ---- on the page --------------------------------------------------------------------------------

const style = document.createElement("style");
style.textContent = `
  .choreo-w { display: inline-block; white-space: pre; transition: background-color .6s, color .6s; border-radius: 2px; }
  .choreo-l { display: inline-block; white-space: pre; position: relative; z-index: 5; }
  .choreo-w.choreo-fall { background: transparent !important; }
  .choreo-w.choreo-fall, .choreo-w.choreo-fall a, .choreo-w.choreo-fall .choreo-l { color: #e8431f !important; font-weight: 700; }
  .choreo-w.choreo-on { background: #ff5a36; color: #fff !important; }
  .choreo-w.choreo-on a { color: #fff !important; }
  #mw-content-text, body { transform-origin: 50% 30%; }
  html { overflow-x: hidden; }`;
document.head.appendChild(style);

Object.assign(window, { shake, wobble, float, stretch, tilt, bounce, fall, breathing, still });       // for the console
// Begin at the first table that lists earthquakes by country (a screen full of place names);
// you can scroll by hand to any part of the page you like.
const tables = [...document.querySelectorAll("table.wikitable")];
(tables.find((t) => t.querySelectorAll(".flagicon, .mw-flagicon, img").length >= 6) ?? tables[0])?.scrollIntoView({ block: "start" });
document.addEventListener("click", (e) => { if (e.target.closest("a")) e.preventDefault(); }, true);   // links stay still

const events = new EventSource(`${ORIGIN}/events`);
events.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "quake") score(m.q); };
breathing();
