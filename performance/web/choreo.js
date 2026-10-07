// Arrival Times: the choreography of a real web page.
//
// A small movement vocabulary for the words of a page, in the spirit of Joana Chicau's
// choreographic coding (the web page as a stage, its elements as bodies, code as the score).
// The verbs are the performer's own, from her MIDI web-choreography sketches:
//     shake  wobble  float  stretch  tilt  bounce  fall  incline  crack  restore
//     + breathing (after Chicau)  + still
// The damage stays: fallen letters lie where they fell and cracked images stay cracked, so the page
// wears down as the earthquakes pass. restore() (and every new replay) rebuilds it.
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
  const out = [...content().querySelectorAll(".choreo-w")].filter((el) => inView(el, 0) && !el.dataset.fallen);
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
  if (what === "headings") return [...document.querySelectorAll("h1, h2, h3, h4, caption, th, figcaption")].filter((el) => inView(el, 0.05));
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
  const a = clamp(amount), els = bodies(what, Math.round(10 + 50 * a));
  for (const el of els) {
    const up = -(12 + 150 * a) * rand(0.5, 1), side = a > 0.6 ? rand(-1, 1) * 260 * a : 0, turn = a > 0.6 ? rand(-1, 1) * 28 * a : 0;
    animate(el, [{ transform: "translate(0, 0) rotate(0deg)" }, { transform: `translate(${side.toFixed(0)}px, ${up.toFixed(0)}px) rotate(${turn.toFixed(1)}deg)`, offset: 0.18 },
      { transform: `translate(${(side * 0.8).toFixed(0)}px, ${(-up * 0.25).toFixed(0)}px) rotate(${(turn * 0.7).toFixed(1)}deg)`, offset: 0.45 },
      { transform: "translate(0, 0) rotate(0deg)" }],
      { duration: 1600 + 5000 * a, delay: rand(0, 350), easing: "cubic-bezier(.2,.7,.2,1)" });
  }
  light(els, 1600 + 5000 * a);
}

// fall: the letters let go, drop down the page tumbling, and STAY where they land, piling up at the
// bottom of the screen. The words keep their holes until restore().
export function fall(what, amount = 0.5) {
  say("fall", what, amount);
  const a = clamp(amount), els = bodies(what, Math.round(2 + 7 * a * a)).filter((el) => el.classList?.contains("choreo-w") && !el.dataset.fallen);   // few at a time: one day of earthquakes takes about half the words on screen
  for (const el of els) {
    el.dataset.fallen = "1"; el.classList.add("choreo-fallen");
    const room = Math.max(40, innerHeight - el.getBoundingClientRect().top - 14);       // down to the bottom of the screen
    for (const l of letters(el)) {
      const there = `translate(${rand(-60, 60).toFixed(0)}px, ${(room * rand(0.9, 1)).toFixed(0)}px) rotate(${rand(-170, 170).toFixed(0)}deg)`;
      const fallAnim = animate(l, [{ transform: "translate(0, 0) rotate(0deg)" }, { transform: there }],
        { duration: rand(700, 1500), delay: rand(0, 700), easing: "cubic-bezier(.55,0,1,.45)", fill: "forwards", composite: "replace" });   // gravity
      fallAnim.finished.then(() => { l.style.transform = there; fallAnim.cancel(); }).catch(() => {});
    }
  }
}

// crack: an image breaks in two along a fault line and the halves slide apart. Every crack adds to
// the last one; nothing heals until restore(). crack("Indonesia") breaks the images beside that
// name (its flag); crack("images", amount) breaks some of the images on screen.
export function crack(what = "images", amount = 0.5) {
  say("crack", what, amount);
  const a = clamp(amount);
  const onScreen = (img) => inView(img, 0) && !img.classList.contains("choreo-half") && img.getBoundingClientRect().width >= 12;
  let imgs;
  if (what === "images") imgs = [...content().querySelectorAll("img")].filter(onScreen).sort(() => Math.random() - 0.5).slice(0, Math.round(1 + 3 * a));
  else imgs = findWord(what).filter((el) => inView(el, 0)).flatMap((el) => [...(el.closest("td, th, li, p, figure") ?? el.parentElement).querySelectorAll("img")]).filter(onScreen);
  for (const img of new Set(imgs)) {
    let wrap = img.closest(".choreo-crack");
    if (!wrap) {
      wrap = document.createElement("span"); wrap.className = "choreo-crack";
      wrap.style.cssText = `display:inline-block;position:relative;line-height:0;vertical-align:${getComputedStyle(img).verticalAlign}`;
      img.replaceWith(wrap); wrap.appendChild(img);
      const x1 = rand(25, 75), x2 = clamp(x1 + rand(-35, 35), 5, 95);                 // the fault: from x1% at the top to x2% at the bottom
      for (const clip of [`polygon(0 0, ${x1}% 0, ${x2}% 100%, 0 100%)`, `polygon(${x1}% 0, 100% 0, 100% 100%, ${x2}% 100%)`]) {
        const half = img.cloneNode(); half.removeAttribute("id"); half.classList.add("choreo-half");
        half.style.cssText += `;position:absolute;left:0;top:0;margin:0;clip-path:${clip};transition:transform 1.1s cubic-bezier(.2,.8,.2,1)`;
        wrap.appendChild(half);
      }
      img.style.visibility = "hidden"; wrap.dataset.d = "0";
    }
    const size = img.getBoundingClientRect().height || 16;
    const d = Math.min(Number(wrap.dataset.d) + size * (0.03 + 0.12 * a), size * 0.6);   // each crack adds a little; up to 60% of the image by the end of the day
    wrap.dataset.d = String(d);
    const [one, two] = wrap.querySelectorAll(".choreo-half");
    one.style.transform = `translate(${(-d * 0.35).toFixed(1)}px, ${d.toFixed(1)}px) rotate(${(-d * 0.25).toFixed(1)}deg)`;
    two.style.transform = `translate(${(d * 0.35).toFixed(1)}px, ${(-d * 0.6).toFixed(1)}px) rotate(${(d * 0.2).toFixed(1)}deg)`;
  }
}

// restore: the page is rebuilt. Fallen letters climb back into their words and the cracks close.
export function restore() {
  const down = [...document.querySelectorAll(".choreo-w[data-fallen]")], cracked = [...document.querySelectorAll(".choreo-crack")].filter((w) => Number(w.dataset.d) > 0);
  if (!down.length && !cracked.length) return;
  say("restore");
  for (const el of down) {
    delete el.dataset.fallen;
    for (const l of el.children) {
      const from = l.style.transform; if (!from) continue;
      l.style.transform = "";
      animate(l, [{ transform: from }, { transform: "translate(0, 0) rotate(0deg)" }], { duration: rand(1500, 3200), delay: rand(0, 1200), easing: "cubic-bezier(.2,.7,.2,1)", composite: "replace", fill: "backwards" });
    }
    setTimeout(() => el.classList.remove("choreo-fallen"), 4500);
  }
  for (const wrap of cracked) { wrap.dataset.d = "0"; for (const half of wrap.querySelectorAll(".choreo-half")) half.style.transform = "none"; }
}

// incline: the text leans over to an angle and STAYS there, its lines running diagonally. With
// "text", every line of text on the page tilts inside its own place: tables, borders and layout do
// not move. Unlike tilt, it does not swing back by itself. incline("text", 0) levels it.
export function incline(what, degrees = 5, quiet = false) {
  if (!quiet) say("incline", what, degrees);
  const deg = `${clamp(degrees, -20, 20).toFixed(2)}deg`;
  if (what === "text") { document.documentElement.style.setProperty("--choreo-lean", deg); return; }
  for (const el of bodies(what)) { el.style.transition = "rotate 1.6s cubic-bezier(.3,.7,.2,1)"; el.style.rotate = deg; }
}

// breathing: the resting state. The text fades almost away and returns, every 5 seconds; nothing
// changes size or place.
export function breathing() {
  say("breathing");
  document.documentElement.classList.add("choreo-breathing");
  breath = { cancel: () => document.documentElement.classList.remove("choreo-breathing") };
}

// still: everything stops and rests.
export function still() {
  say("still");
  breath?.cancel(); breath = null;
  for (const a of [...running]) a.cancel();
  document.documentElement.style.setProperty("--choreo-lean", "0deg");
}

// ---- the score: how an earthquake becomes movement ----------------------------------------------

const STATES = { CA: "California", AK: "Alaska", NV: "Nevada", HI: "Hawaii", WA: "Washington", OR: "Oregon", TX: "Texas", OK: "Oklahoma", MT: "Montana", UT: "Utah", ID: "Idaho", WY: "Wyoming", NM: "New Mexico", AZ: "Arizona", PR: "Puerto Rico" };

// "121 km NNE of Teluknaga, Indonesia" -> ["Indonesia", "Teluknaga"]: the names to look for.
export function placeWords(place) {
  const name = place.replace(/^.*? of /, "").replace(/\b(region|off the coast of|central|southern|northern|eastern|western|near the coast of)\b/gi, "").trim();
  const parts = name.split(",").map((s) => s.trim()).filter(Boolean).reverse();
  return parts.flatMap((p) => (STATES[p] ? [STATES[p]] : [p])).filter((p) => p.length > 2);
}

// How far the text leans: it follows the Earth's agitation (the relay's "energy", 0..1), towards the
// side of the map where the last earthquake was, and comes back to level as things calm down.
const LEAN = 9;                        // degrees at full agitation
let energy = 0, side = -1;

// Only the text and the images move; the page itself, its tables and its layout stay where they are.
// The breathing never stops (the Earth never does). Fallen letters and cracks accumulate.
export function score(q) {
  side = q.lon >= 0 ? -1 : 1;                               // quake in the east: the text leans to the left
  energy = Math.min(1, energy + 0.2 + 0.8 * q.mag01);
  incline("text", Math.round(side * energy * LEAN * 10) / 10);
  if (!breath) breathing();
  // The place's name, where it is written on screen; otherwise a handful of the words on screen.
  const word = placeWords(q.place).find((w) => findWord(w).some((el) => inView(el, 0)));
  shake(word ?? "words", q.mag01);
  setTimeout(() => shake("headings", Math.round(q.mag01 * 80) / 100), 150);                       // the titles on screen tremble too
  if (word) setTimeout(() => crack(word, q.mag01), 250);                                           // its flag breaks
  if (word && q.mag01 > 0.45) wobble(word, Math.round(q.mag01 * 80) / 100);
  if (q.mag01 > 0.2) setTimeout(() => fall("words", Math.round(q.mag01 * 100) / 100), 500);         // letters fall, and stay down
  if (q.mag01 > 0.4) setTimeout(() => crack("images", Math.round(q.mag01 * 100) / 100), 700);       // images break, and stay broken
  if (q.mag >= 5) setTimeout(() => bounce("words", Math.round(q.mag01 * 100) / 100), 300);          // big: the words are thrown
  if (q.mag >= 5.5) setTimeout(() => stretch("headings", Math.round(q.mag01 * 60) / 100), 900);     // very big: the titles are pulled wide
}

// ---- on the page --------------------------------------------------------------------------------

const style = document.createElement("style");
style.textContent = `
  .choreo-w { display: inline-block; white-space: pre; transition: background-color .6s, color .6s; border-radius: 2px; }
  .choreo-l { display: inline-block; white-space: pre; position: relative; z-index: 5; }
  .choreo-t { display: inline-block; max-width: 100%; }
  /* only the text on (or near) the screen leans and breathes: the page is very long */
  .choreo-t.choreo-near { rotate: var(--choreo-lean, 0deg); transition: rotate 1.4s cubic-bezier(.3,.7,.2,1); }
  .choreo-breathing .choreo-t.choreo-near { animation: choreo-breath 5s ease-in-out infinite; }
  /* how far the text fades at the bottom of each breath: set from the live ground (see below) */
  @keyframes choreo-breath { 0%, 100% { opacity: 1; } 50% { opacity: var(--choreo-breath, 0.22); } }
  .choreo-w.choreo-fallen { background: transparent !important; }
  .choreo-w.choreo-fallen, .choreo-w.choreo-fallen a, .choreo-w.choreo-fallen .choreo-l { color: #e8431f !important; font-weight: 700; }
  .choreo-w.choreo-on { background: #ff5a36; color: #fff !important; }
  .choreo-w.choreo-on a { color: #fff !important; }
  html { overflow-x: hidden; }`;
document.head.appendChild(style);

Object.assign(window, { shake, wobble, float, stretch, tilt, bounce, fall, incline, crack, restore, breathing, still });       // for the console
// Begin at the first table that lists earthquakes by country (a screen full of place names);
// you can scroll by hand to any part of the page you like.
// The text of every cell, paragraph, list item and title gets its own wrapper, so it can lean and
// fade inside its place while the boxes around it stay still.
for (const el of content().querySelectorAll("td, th, p, li, dd, dt, h1, h2, h3, h4, caption, figcaption")) {
  if (!el.firstChild || el.querySelector("table, ul, ol, p, td")) continue;      // only the innermost holders of text
  const t = document.createElement("span"); t.className = "choreo-t";
  while (el.firstChild) t.appendChild(el.firstChild);
  el.appendChild(t);
}

const near = new IntersectionObserver((entries) => { for (const e of entries) e.target.classList.toggle("choreo-near", e.isIntersecting); }, { rootMargin: "60% 0px" });
for (const t of content().querySelectorAll(".choreo-t")) near.observe(t);

// Everything turns, leans and swells around the middle of what is on screen (the page is very
// tall: turning it around its own middle would slide the visible part out of the frame).
const base = (() => { const r = content().getBoundingClientRect(); return { left: r.left + scrollX, top: r.top + scrollY }; })();
const centre = () => { content().style.transformOrigin = `${(scrollX + innerWidth / 2 - base.left).toFixed(0)}px ${(scrollY + innerHeight / 2 - base.top).toFixed(0)}px`; };
addEventListener("scroll", centre, { passive: true }); addEventListener("resize", centre);
const tables = [...document.querySelectorAll("table.wikitable")];
(tables.find((t) => t.querySelectorAll(".flagicon, .mw-flagicon, img").length >= 6) ?? tables[0])?.scrollIntoView({ block: "start" });
centre();
document.addEventListener("click", (e) => { if (e.target.closest("a")) e.preventDefault(); }, true);   // links stay still

const events = new EventSource(`${ORIGIN}/events`);
let groundNow = 0.35;
events.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === "quake") score(m.q);
  else if (m.type === "activity") { energy = m.energy; incline("text", energy < 0.02 ? 0 : side * energy * LEAN, true); }   // easing back, silently
  else if (m.type === "mode" && m.mode === "replay") restore();                // every new replay starts from a whole page
  else if (m.type === "ground") {
    // The breath follows the live ground under Montréal: still ground = a shallow breath (the text
    // fades to 55%), moving ground = a deep one (down to 8%).
    groundNow += (m.value - groundNow) * 0.08;
    document.documentElement.style.setProperty("--choreo-breath", (0.55 - 0.47 * clamp(groundNow * 1.6)).toFixed(2));
  }
};
breathing();
