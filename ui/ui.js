// synth-SC-STD panel. Built entirely from the parameter list SuperCollider sends (sc/buses.scd:
// /scstd/specs), so every parameter in docs/params.md appears here without extra code.
// Talks to relay/index.js over a WebSocket; see the "Web panel protocol" in sc/buses.scd.
"use strict";

// ---------------------------------------------------------------------------------------------
// Layout knowledge (presentation only; the parameters themselves come from SuperCollider).

const GROUPS = [
  ["VCO 1", ["o1wave", "o1lvl", "o1oct", "o1fine", "o1lf", "o1lfrate", "o1kbd"]],
  ["VCO 2", ["o2wave", "o2lvl", "o2oct", "o2fine", "o2pw", "o2pwm", "o2sync", "o2fm", "o2kbd"]],
  ["VCO 3", ["o3wave", "o3lvl", "o3oct", "o3fine", "o3pw", "o3pwm", "o3fm", "o3kbd"]],
  ["Filter (VCF)", ["vcfcut", "vcfres", "vcfenv", "vcfkey", "vcfdrive", "vcfmodel"]],
  ["Amplifier (VCA)", ["vcalvl", "vcaenv", "vcainit"]],
  ["ADSR envelope", ["eatk", "edec", "esus", "erel", "ecurve"]],
  ["AR envelope", ["aratk", "arrel"]],
  ["Noise", ["nzcol", "nzlvl"]],
  ["Ring modulator", ["rmlvl", "rma", "rmb"]],
  ["Sample & hold", ["shrate", "shsrc", "shlag"]],
  ["Lag processor", ["lagtime", "lagsrc"]],
  ["Mixer / inverter", ["mixa", "mixalvl", "mixb", "mixblvl"]],
  ["Electronic switch", ["swrate", "swa", "swb", "swlvl"]],
  ["Audio input", ["ingain", "inlvl", "efatk", "efrel"]],
  ["Voice", ["monomode", "glide", "drift", "vspread"]],
  ["Spring reverb", ["spmix", "spdecay", "sptone"]],
];

const LABELS = {
  o1wave: "saw → square", o1lvl: "level", o1oct: "octave", o1fine: "fine", o1lf: "LFO mode",
  o1lfrate: "LFO rate", o1kbd: "keyboard",
  o2wave: "wave", o2lvl: "level", o2oct: "octave", o2fine: "fine", o2pw: "pulse width",
  o2pwm: "PWM", o2sync: "sync to VCO 1", o2fm: "FM from VCO 1", o2kbd: "keyboard",
  o3wave: "saw → pulse", o3lvl: "level", o3oct: "octave", o3fine: "fine", o3pw: "pulse width",
  o3pwm: "PWM", o3fm: "FM from VCO 2", o3kbd: "keyboard",
  vcfcut: "cutoff", vcfres: "resonance", vcfenv: "ADSR amount", vcfkey: "key tracking",
  vcfdrive: "drive", vcfmodel: "character",
  vcalvl: "level", vcaenv: "AR amount", vcainit: "initial gain",
  eatk: "attack", edec: "decay", esus: "sustain", erel: "release", ecurve: "curve",
  aratk: "attack", arrel: "release",
  nzcol: "colour", nzlvl: "level", rmlvl: "level", rma: "input A", rmb: "input B",
  shrate: "clock rate", shsrc: "input", shlag: "smoothing", lagtime: "lag time", lagsrc: "input",
  mixa: "source A", mixalvl: "level A", mixb: "source B", mixblvl: "level B",
  swrate: "rate", swa: "input A", swb: "input B", swlvl: "level",
  ingain: "sensitivity", inlvl: "mic → mixer", efatk: "follow attack", efrel: "follow release",
  monomode: "mono mode", glide: "glide", drift: "drift", vspread: "spread",
  spmix: "amount", spdecay: "decay", sptone: "tone",
};

const TOGGLES = new Set(["o1lf", "o1kbd", "o2kbd", "o3kbd", "o2sync", "monomode"]);
const CHOICES = {
  vcfmodel: ["ladder", "FF"],
  shsrc: ["noise", "VCO 1", "VCO 2", "VCO 3", "mixer"],
  rma: ["VCO 1", "VCO 2", "VCO 3", "noise"],
  rmb: ["VCO 1", "VCO 2", "VCO 3", "noise"],
  swa: ["VCO 1", "VCO 2", "VCO 3", "noise", "input"],
  swb: ["VCO 1", "VCO 2", "VCO 3", "noise", "input"],
  mixa: ["VCO 1", "VCO 2", "VCO 3", "noise", "S&H", "ADSR", "AR", "follower", "ring"],
  mixb: ["VCO 1", "VCO 2", "VCO 3", "noise", "S&H", "ADSR", "AR", "follower", "ring"],
  lagsrc: ["VCO 1", "mixer"],
};
// Sliders with an exponential feel: frequencies and times (min > 0) use a log scale;
// times that start at 0 use a cubic curve (fine control near 0).
const EXP = new Set(["vcfcut", "o1lfrate", "shrate", "swrate", "eatk", "edec", "erel", "aratk", "arrel", "efatk", "efrel"]);
const POW3 = new Set(["glide", "lagtime"]);
const UNITS = { vcfcut: "Hz", o1lfrate: "Hz", shrate: "Hz", swrate: "Hz", eatk: "s", edec: "s", erel: "s",
  aratk: "s", arrel: "s", efatk: "s", efrel: "s", glide: "s", lagtime: "s", o1fine: "st", o2fine: "st", o3fine: "st",
  o1oct: "oct", o2oct: "oct", o3oct: "oct" };

const SOURCES = ["vco1", "vco2", "vco3", "noise", "sh", "adsr", "ar", "envf", "mix", "rm"];
const SOURCE_LABELS = { vco1: "VCO 1", vco2: "VCO 2", vco3: "VCO 3", noise: "noise", sh: "S&H", adsr: "ADSR",
  ar: "AR", envf: "follower", mix: "mixer", rm: "ring mod" };
const DESTS = ["pitch", "vcf", "pw", "vca"];
const DEST_LABELS = { pitch: "pitch", vcf: "filter", pw: "pulse width", vca: "volume" };
const DEST_UNITS = { pitch: "st", vcf: "oct", pw: "", vca: "" };
const NORMALLED = { adsr_vcf: "vcfenv", ar_vca: "vcaenv" };    // the pre-wired cables
const NEW_CABLE_AMOUNT = { pitch: 12, vcf: 1.5, pw: 0.5, vca: 0.5 };
const PALETTE = ["#e0663a", "#d4a017", "#5b9b3a", "#2f8fbf", "#8a5cc2", "#c2477a", "#3aa39a", "#9b7b4a", "#6b7fd1", "#b85c38"];
const MIC_KEYS = ["ingain", "inlvl", "efatk", "efrel"];

// ---------------------------------------------------------------------------------------------
// State

const params = new Map();      // name -> {name, min, max, def, value, desc}
const views = new Map();       // name -> [update(value) functions]
const dragging = new Set();    // params this panel is currently moving (ignore echoes)
let connected = false;
let ws = null;
let wsFailed = false;           // true once a connection attempt has failed (relay not running)

const $ = (sel) => document.querySelector(sel);

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// Throttle: at most one "set" per animation frame per parameter while dragging.
const pendingSet = new Map();
function setParam(name, value) {
  const p = params.get(name);
  if (!p) return;
  p.value = value;
  const first = !pendingSet.has(name);
  pendingSet.set(name, value);
  if (first) requestAnimationFrame(() => {
    send({ type: "set", name, value: pendingSet.get(name) });
    pendingSet.delete(name);
  });
  refresh(name, true);
}

function refresh(name, fromSelf = false) {
  const p = params.get(name);
  if (!p) return;
  for (const fn of views.get(name) ?? []) fn(p.value, fromSelf);
  if (isCableRelated(name)) drawCables();
}

function isCableRelated(name) {
  return /_(pitch|vcf|pw|vca)$/.test(name) || name === "vcfenv" || name === "vcaenv";
}

// ---------------------------------------------------------------------------------------------
// Value <-> slider position (0..1)

function toPos(p, v) {
  const t = (v - p.min) / (p.max - p.min);
  if (EXP.has(p.name) && p.min > 0) return Math.log(v / p.min) / Math.log(p.max / p.min);
  if (POW3.has(p.name)) return Math.cbrt(Math.max(0, t));
  return t;
}
function fromPos(p, x) {
  if (EXP.has(p.name) && p.min > 0) return p.min * Math.pow(p.max / p.min, x);
  if (POW3.has(p.name)) return p.min + (p.max - p.min) * x * x * x;
  return p.min + (p.max - p.min) * x;
}
function fmt(name, v) {
  const a = Math.abs(v);
  const s = a >= 1000 ? v.toFixed(0) : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
  const u = UNITS[name] ?? DEST_UNITS[(name.match(/_(pitch|vcf|pw|vca)$/) ?? [])[1]] ?? "";
  return u ? `${s} ${u}` : s;
}

// ---------------------------------------------------------------------------------------------
// Controls

function addView(name, fn) {
  if (!views.has(name)) views.set(name, []);
  views.get(name).push(fn);
}

function makeControl(p) {
  const row = document.createElement("div");
  row.className = "ctl";
  const id = `ctl-${p.name}`;
  const label = document.createElement("label");
  label.textContent = LABELS[p.name] ?? p.name;
  label.title = `${p.name}${p.desc ? " — " + p.desc : ""}\n(double-click: back to default)`;
  label.htmlFor = id;
  label.addEventListener("dblclick", () => setParam(p.name, p.def));
  row.append(label);
  const markChanged = (v) => row.classList.toggle("changed", Math.abs(v - p.def) > 1e-6);

  if (TOGGLES.has(p.name)) {
    const b = document.createElement("button");
    b.type = "button"; b.id = id; b.className = "toggle";
    b.addEventListener("click", () => setParam(p.name, p.value >= 0.5 ? 0 : 1));
    row.append(b);
    addView(p.name, (v) => { b.setAttribute("aria-pressed", String(v >= 0.5)); b.textContent = v >= 0.5 ? "on" : "off"; markChanged(v); });
  } else if (CHOICES[p.name]) {
    const seg = document.createElement("div");
    seg.className = "seg"; seg.id = id; seg.setAttribute("role", "group");
    const buttons = CHOICES[p.name].map((txt, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = txt;
      b.addEventListener("click", () => setParam(p.name, i));
      seg.append(b);
      return b;
    });
    row.append(seg);
    addView(p.name, (v) => { buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(Math.round(v) === i))); markChanged(v); });
  } else {
    const input = document.createElement("input");
    input.type = "range"; input.min = "0"; input.max = "1000"; input.step = "1"; input.id = id;
    const val = document.createElement("span");
    val.className = "val";
    input.addEventListener("pointerdown", () => dragging.add(p.name));
    const release = () => dragging.delete(p.name);
    input.addEventListener("pointerup", release);
    input.addEventListener("blur", release);
    input.addEventListener("input", () => setParam(p.name, fromPos(p, input.value / 1000)));
    row.append(input, val);
    addView(p.name, (v, fromSelf) => {
      if (!fromSelf && dragging.has(p.name)) return;
      if (!fromSelf) input.value = String(Math.round(toPos(p, v) * 1000));
      val.textContent = fmt(p.name, v);
      markChanged(v);
    });
  }
  return row;
}

function buildModules() {
  const box = $("#modules");
  box.replaceChildren();
  views.clear();
  const groups = GROUPS.map(([title, names]) => [title, names.filter((n) => params.has(n))]);
  const others = [...params.keys()].filter((n) => !isCableName(n) && !GROUPS.some(([, ns]) => ns.includes(n)));
  if (others.length) groups.push(["Other", others]);
  for (const [title, names] of groups) {
    if (!names.length) continue;
    const card = document.createElement("section");
    card.className = "card";
    const h = document.createElement("h2");
    h.textContent = title;
    card.append(h);
    for (const n of names) card.append(makeControl(params.get(n)));
    box.append(card);
  }
  buildMatrix();
  for (const n of params.keys()) refresh(n);
  drawCables();
}

function isCableName(n) { return /^[a-z0-9]+_(pitch|vcf|pw|vca)$/.test(n); }
function cableParam(src, dest) {
  const n = `${src}_${dest}`;
  if (params.has(n)) return n;
  if (NORMALLED[n] && params.has(NORMALLED[n])) return NORMALLED[n];
  return null;
}

// ---------------------------------------------------------------------------------------------
// Patch matrix (table) and cable view (SVG)

function buildMatrix() {
  const t = $("#matrix");
  t.replaceChildren();
  const head = t.insertRow();
  head.append(document.createElement("th"));
  for (const d of DESTS) { const th = document.createElement("th"); th.textContent = DEST_LABELS[d]; head.append(th); }
  for (const s of SOURCES) {
    const row = t.insertRow();
    const th = document.createElement("th");
    th.textContent = SOURCE_LABELS[s];
    row.append(th);
    for (const d of DESTS) {
      const td = row.insertCell();
      const name = cableParam(s, d);
      if (!name) continue;
      const p = params.get(name);
      const normalled = !isCableName(name);
      if (normalled) { td.classList.add("normalled"); td.title = `normalled: ${name}`; }
      const cell = document.createElement("div");
      cell.className = "cell";
      const input = document.createElement("input");
      input.type = "range"; input.min = "0"; input.max = "1000"; input.step = "1";
      input.setAttribute("aria-label", `${SOURCE_LABELS[s]} → ${DEST_LABELS[d]}`);
      const val = document.createElement("span");
      input.addEventListener("pointerdown", () => dragging.add(name));
      input.addEventListener("pointerup", () => dragging.delete(name));
      input.addEventListener("input", () => setParam(name, fromPos(p, input.value / 1000)));
      input.addEventListener("dblclick", () => setParam(name, normalled ? p.def : 0));
      cell.append(input, val);
      td.append(cell);
      addView(name, (v, fromSelf) => {
        if (!fromSelf && dragging.has(name)) return;
        if (!fromSelf) input.value = String(Math.round(toPos(p, v) * 1000));
        val.textContent = Math.abs(v) < 1e-6 ? "–" : v.toFixed(Math.abs(v) >= 10 ? 0 : 2);
        td.classList.toggle("on", Math.abs(v) > 1e-6);
      });
    }
  }
}

const svgNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function jackPositions() {
  const svg = $("#cables");
  const W = svg.clientWidth || 400, H = svg.clientHeight || 330;
  const src = {}, dst = {};
  SOURCES.forEach((s, i) => { src[s] = { x: 96, y: 18 + i * ((H - 36) / (SOURCES.length - 1)) }; });
  DESTS.forEach((d, i) => { dst[d] = { x: W - 96, y: H * 0.2 + i * (H * 0.6 / (DESTS.length - 1)) }; });
  return { W, H, src, dst };
}

function cablePath(a, b) {
  const sag = 30 + Math.abs(b.y - a.y) * 0.25;
  const dx = (b.x - a.x) * 0.35;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y + sag} ${b.x - dx} ${b.y + sag} ${b.x} ${b.y}`;
}

let drag = null;   // {src, line}
function drawCables() {
  const svg = $("#cables");
  if (!svg || !params.size) return;
  const { W, H, src, dst } = jackPositions();
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.replaceChildren();
  // cables first (under the jacks)
  SOURCES.forEach((s, si) => {
    for (const d of DESTS) {
      const name = cableParam(s, d);
      if (!name) continue;
      const p = params.get(name);
      if (Math.abs(p.value) < 1e-6) continue;
      const span = Math.max(Math.abs(p.min), Math.abs(p.max));
      const path = svgEl("path", {
        d: cablePath(src[s], dst[d]), class: `cable${isCableName(name) ? "" : " normalled"}`,
        stroke: PALETTE[si % PALETTE.length], "stroke-width": (2 + 4 * Math.abs(p.value) / span).toFixed(1),
      });
      const title = svgEl("title", {});
      title.textContent = `${SOURCE_LABELS[s]} → ${DEST_LABELS[d]}: ${fmt(name, p.value)} (${name}) — double-click to remove`;
      path.append(title);
      path.addEventListener("dblclick", () => setParam(name, 0));
      svg.append(path);
    }
  });
  SOURCES.forEach((s) => {
    const { x, y } = src[s];
    const t = svgEl("text", { x: x - 14, y: y + 4, "text-anchor": "end" });
    t.textContent = SOURCE_LABELS[s];
    const c = svgEl("circle", { cx: x, cy: y, r: 7, class: "jack src", "data-src": s });
    c.addEventListener("pointerdown", (e) => startDrag(e, s));
    svg.append(t, c);
  });
  DESTS.forEach((d) => {
    const { x, y } = dst[d];
    const t = svgEl("text", { x: x + 14, y: y + 4 });
    t.textContent = DEST_LABELS[d];
    svg.append(t, svgEl("circle", { cx: x, cy: y, r: 8, class: "jack dest", "data-dest": d }));
  });
}

function svgPoint(e) {
  const svg = $("#cables");
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  return { x: (e.clientX - r.left) * (vb.width / r.width), y: (e.clientY - r.top) * (vb.height / r.height) };
}

function startDrag(e, s) {
  e.preventDefault();
  const svg = $("#cables");
  const { src } = jackPositions();
  const line = svgEl("path", { class: "dragline" });
  svg.append(line);
  drag = { src: s, line };
  const move = (ev) => {
    const p = svgPoint(ev);
    line.setAttribute("d", cablePath(src[s], p));
  };
  const up = (ev) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    line.remove();
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    const d = target?.getAttribute?.("data-dest");
    drag = null;
    if (!d) return;
    const name = cableParam(s, d);
    if (!name) return;
    const p = params.get(name);
    if (Math.abs(p.value) > 1e-6) return;                       // already connected
    setParam(name, isCableName(name) ? NEW_CABLE_AMOUNT[d] : (p.def || 0.5));
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

window.addEventListener("resize", () => drawCables());

// ---------------------------------------------------------------------------------------------
// Presets

function fillPresets(list) {
  const sel = $("#preset-select");
  const current = sel.value;
  sel.replaceChildren(...list.map((n) => { const o = document.createElement("option"); o.value = o.textContent = n; return o; }));
  if (list.includes(current)) sel.value = current;
}
$("#preset-load").addEventListener("click", () => { const n = $("#preset-select").value; if (n) send({ type: "preset", name: n }); });
$("#preset-save").addEventListener("click", () => {
  const inp = $("#preset-name");
  const name = inp.value.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) { inp.setCustomValidity("letters, digits, _ and - only"); inp.reportValidity(); return; }
  inp.setCustomValidity("");
  send({ type: "save", name, keys: $("#preset-mic").checked ? MIC_KEYS : undefined });
});
$("#reset").addEventListener("click", () => { if (confirm("Reset every setting to its default?")) send({ type: "reset" }); });

// ---------------------------------------------------------------------------------------------
// Keyboard (on screen + computer keys). Mono, last-note priority (handled in SuperCollider).

let baseMidi = 48;                         // lowest key: C3
const NUM_KEYS = 25;
const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12);
const noteName = (m) => ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][m % 12] + (Math.floor(m / 12) - 1);
const down = new Set();

function noteOn(m) { if (down.has(m)) return; down.add(m); send({ type: "noteon", midi: m }); markKey(m, true); }
function noteOff(m) { if (!down.has(m)) return; down.delete(m); send({ type: "noteoff", midi: m }); markKey(m, false); }
function allOff() { for (const m of [...down]) noteOff(m); }
function markKey(m, on) { document.querySelector(`.key[data-midi="${m}"]`)?.classList.toggle("down", on); }

function buildKeyboard() {
  const kb = $("#keyboard");
  kb.replaceChildren();
  const whites = [];
  for (let i = 0; i < NUM_KEYS; i++) if (!isBlack(baseMidi + i)) whites.push(baseMidi + i);
  const w = 100 / whites.length;
  for (let i = 0; i < NUM_KEYS; i++) {
    const m = baseMidi + i;
    const k = document.createElement("div");
    k.className = `key${isBlack(m) ? " black" : ""}`;
    k.dataset.midi = String(m);
    if (isBlack(m)) {
      const wi = whites.indexOf(m - 1);
      k.style.left = `${(wi + 0.68) * w}%`;
      k.style.width = `${w * 0.64}%`;
    } else if (m % 12 === 0) {
      const n = document.createElement("span"); n.className = "note-name"; n.textContent = noteName(m); k.append(n);
    }
    kb.append(k);
  }
  $("#oct-label").textContent = noteName(baseMidi);
}

// Pointer: press, glide over keys while held, release.
let pointerKey = null;
function keyAt(e) { const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".key"); return el ? Number(el.dataset.midi) : null; }
$("#keyboard").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  $("#keyboard").setPointerCapture(e.pointerId);
  pointerKey = keyAt(e);
  if (pointerKey !== null) noteOn(pointerKey);
});
$("#keyboard").addEventListener("pointermove", (e) => {
  if (pointerKey === null) return;
  const k = keyAt(e);
  if (k !== null && k !== pointerKey) { noteOn(k); noteOff(pointerKey); pointerKey = k; }
});
const pointerEnd = () => { if (pointerKey !== null) { noteOff(pointerKey); pointerKey = null; } };
$("#keyboard").addEventListener("pointerup", pointerEnd);
$("#keyboard").addEventListener("pointercancel", pointerEnd);

const KEYMAP = "awsedftgyhujkolp;'";      // C C# D D# E F F# G G# A A# B C C# D D# E F
window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" && document.activeElement.type === "text") return;
  const k = e.key.toLowerCase();
  if (k === "z" || k === "x") {
    allOff();
    baseMidi = Math.min(96, Math.max(12, baseMidi + (k === "x" ? 12 : -12)));
    buildKeyboard();
    return;
  }
  const i = KEYMAP.indexOf(k);
  if (i >= 0) { e.preventDefault(); noteOn(baseMidi + i); }
});
window.addEventListener("keyup", (e) => {
  const i = KEYMAP.indexOf(e.key.toLowerCase());
  if (i >= 0) noteOff(baseMidi + i);
});
window.addEventListener("blur", allOff);       // never leave a note stuck
$("#oct-down").addEventListener("click", () => { allOff(); baseMidi = Math.max(12, baseMidi - 12); buildKeyboard(); });
$("#oct-up").addEventListener("click", () => { allOff(); baseMidi = Math.min(96, baseMidi + 12); buildKeyboard(); });

// ---------------------------------------------------------------------------------------------
// Connection

function setStatus() {
  const el = $("#status");
  const open = ws && ws.readyState === WebSocket.OPEN;
  el.classList.toggle("ok", open && connected);
  el.querySelector(".status-text").textContent = !open
    ? (wsFailed ? "relay offline — run: node relay/index.js" : "connecting…")
    : connected ? "connected to SuperCollider" : "waiting for SuperCollider — run sc/startup.scd";
  $("#waiting").hidden = connected && params.size > 0;
}

function connect() {
  ws = new WebSocket(`ws://${location.host}/ws`);
  ws.addEventListener("open", () => { wsFailed = false; setStatus(); });
  ws.addEventListener("close", () => { wsFailed = true; connected = false; setStatus(); setTimeout(connect, 2000); });
  ws.addEventListener("message", (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type === "specs") {
      applySpecs(m.params, m.connected);
    } else if (m.type === "changed") {
      const p = params.get(m.name);
      if (p) { if (!dragging.has(m.name)) p.value = m.value; refresh(m.name); }
    } else if (m.type === "presets") {
      fillPresets(m.presets);
    } else if (m.type === "status") {
      connected = !!m.connected;
    }
    setStatus();
  });
}

function applySpecs(list, isConnected) {
  connected = !!isConnected;
  if (list.length) {
    params.clear();
    for (const p of list) params.set(p.name, p);
    buildModules();
  }
}

// Colour theme: auto (follow the computer) -> light -> dark. Remembered in this browser only.
const THEMES = ["auto", "light", "dark"];
function applyTheme(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  $("#theme").textContent = `theme: ${t}`;
}
let theme = "auto";
theme = new URLSearchParams(location.search).get("theme") || "";
try { theme = theme || localStorage.getItem("scstd-theme") || "auto"; } catch { theme = theme || "auto"; }
if (!THEMES.includes(theme)) theme = "auto";
applyTheme(theme);
$("#theme").addEventListener("click", () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  applyTheme(theme);
  try { localStorage.setItem("scstd-theme", theme); } catch { /* storage blocked */ }
});

buildKeyboard();
// First paint from the relay's current state, then live updates over the WebSocket.
fetch("state.json").then((r) => r.json()).then((s) => {
  if (!params.size) applySpecs(s.params, s.connected);
  fillPresets(s.presets);
  setStatus();
}).catch(() => {});
connect();
