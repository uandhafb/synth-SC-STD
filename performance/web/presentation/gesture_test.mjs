import { Gestures, isOpen, HOLD } from "./gesture.js";
let pass = 0, total = 0; const check = (n, ok, info = "") => { total++; if (ok) pass++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${info ? "  (" + info + ")" : ""}`); };
// run a script of [durationMs, openHands] at 15 frames a second, collect the steps
const run = (script) => { const g = new Gestures(), fires = []; let t = 1000; for (const [ms, open] of script) for (let e = t + ms; t < e; t += 66) { const r = g.update(typeof open === "function" ? open(t) : open, t); if (r.fire) fires.push(r.fire); } return fires.join(","); };
check("one open hand held: one step forward, once", run([[300, 0], [1500, 1], [600, 0]]) === "next", run([[300, 0], [1500, 1], [600, 0]]));
check("a hand held for five seconds does not repeat", run([[5000, 1]]) === "next");
check("two hands raised together: one step back", run([[1500, 2], [600, 0]]) === "back");
check("two hands, the second 250 ms late: back, not next", run([[250, 1], [1500, 2], [600, 0]]) === "back", run([[250, 1], [1500, 2], [600, 0]]));
check("two hands, the second 500 ms late: still back", run([[500, 1], [1500, 2], [600, 0]]) === "back", run([[500, 1], [1500, 2], [600, 0]]));
check("a quick wave (300 ms) does nothing", run([[300, 1], [800, 0]]) === "");
check("one missed camera frame does not cancel the hold", run([[300, 1], [100, 0], [600, 1], [600, 0]]) === "next");
check("next, hands down, next again: two steps", run([[900, 1], [700, 0], [900, 1], [700, 0]]) === "next,next");
check("without lowering the hand there is no second step", run([[900, 1], [100, 0], [900, 1]]) === "next");
check("after going back with two hands, dropping to one hand does not go forward", run([[1200, 2], [1500, 1], [600, 0]]) === "back");
check("hands flickering open and closed (typing, talking) do nothing", run([[4000, (t) => (Math.floor(t / 200) % 2 ? 1 : 0)]]) === "", run([[4000, (t) => (Math.floor(t / 200) % 2 ? 1 : 0)]]));
// hand shapes: a flat open palm, a fist, a pointing finger (x, y in 0..1; wrist at the bottom)
const hand = (curl, spread = 1) => { const lm = [{ x: 0.5, y: 0.9 }]; const fingers = [[-0.10, 0.05, 1], [-0.05, 0, curl[0]], [0, 0, curl[1]], [0.04, 0, curl[2]], [0.08, 0.02, curl[3]]];
  for (const [dx, dy, c] of fingers) for (let j = 1; j <= 4; j++) { const reach = [0.18, 0.28, 0.35, 0.42][j - 1], y = j <= 1 ? 0.9 - reach : 0.9 - 0.18 - (reach - 0.18) * c; lm.push({ x: 0.5 + dx * spread * (0.6 + 0.1 * j), y: y + dy }); } return lm; };
check("an open palm is open", isOpen(hand([1, 1, 1, 1])));
check("a fist is not open", !isOpen(hand([0.1, 0.1, 0.1, 0.1])));
check("a pointing finger is not open", !isOpen(hand([1, 0.1, 0.1, 0.1])));
check("a flat hand with the fingers pressed together is not open (needs a little spread)", !isOpen(hand([1, 1, 1, 1], 0.3)));
console.log(`\n${pass}/${total} checks passed (hold ${HOLD} ms)`); process.exit(pass === total ? 0 : 1);
