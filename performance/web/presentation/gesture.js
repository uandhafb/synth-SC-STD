// The gestures that turn the blocks, as plain logic (no camera here, so it can be tested alone):
//   one open hand, held  -> next block
//   two open hands, held -> previous block
// "Held" matters: hands move all the time while talking and typing. A block changes only when an
// open palm stays in view for HOLD ms, and then nothing more happens until the hands are closed or
// lowered again (one gesture, one step).

export const HOLD = 600;       // ms an open hand must stay before the block changes
export const SECOND = 350;     // ms the count must stay at two before it counts as "two hands"
export const GRACE = 180;      // ms the hand may vanish (a missed camera frame) without cancelling
export const RELEASE = 400;    // ms with no open hand before the next gesture is accepted

// One hand, from its 21 landmarks (MediaPipe's order: 0 wrist, 4 thumb tip, 8 index tip, 12 middle,
// 16 ring, 20 little; each finger: base, two joints, tip). A finger is stretched when its tip is
// clearly farther from the wrist than its middle joint. Open = the four fingers stretched, and
// spread at least a little (so a pointing hand or a fist is not an open hand).
export function isOpen(lm) {
  if (!lm || lm.length < 21) return false;
  const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  const palm = d(0, 9) || 1e-6;                                        // wrist to the middle finger's base
  const stretched = [[8, 6], [12, 10], [16, 14], [20, 18]].filter(([tip, mid]) => d(0, tip) > d(0, mid) * 1.25 && d(0, tip) > palm * 1.45).length;
  const spread = d(8, 20) / palm;                                      // index tip to little-finger tip
  return stretched === 4 && spread > 0.55;
}

// How big the hand is in the picture (0..1 of its width): hands far away (the audience) are ignored.
export const handSize = (lm) => Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y);

// The state machine. Call update(openHands, nowMs) for every camera frame; it returns
//   { fire: "next" | "back" | null, progress: 0..1, direction: "next" | "back" | null, waiting }
export class Gestures {
  constructor() { this.reset(); }
  reset() { this.state = "idle"; this.start = 0; this.lastSeen = 0; this.twoSince = null; this.two = false; this.clearSince = null; }
  update(open, now) {
    const out = { fire: null, progress: 0, direction: null, waiting: false };
    if (this.state === "release") {                                    // after a step: wait for the hands to go away
      if (open === 0) { this.clearSince ??= now; if (now - this.clearSince >= RELEASE) this.reset(); }
      else this.clearSince = null;
      out.waiting = this.state === "release";
      return out;
    }
    if (open > 0) {
      if (this.state === "idle") { this.state = "holding"; this.start = now; this.two = false; this.twoSince = null; }
      this.lastSeen = now;
      if (open >= 2) { this.twoSince ??= now; if (!this.two && now - this.twoSince >= SECOND) { this.two = true; } }
      else this.twoSince = null;
    } else if (this.state === "holding" && now - this.lastSeen > GRACE) { this.reset(); return out; }
    if (this.state !== "holding") return out;
    // A second hand that has just come up gets its time to be confirmed before anything fires.
    const pendingTwo = this.twoSince !== null && !this.two;
    const end = Math.max(this.start + HOLD, pendingTwo ? this.twoSince + SECOND : 0);
    out.direction = this.two || pendingTwo ? "back" : "next";
    out.progress = Math.min(1, (now - this.start) / (end - this.start));
    if (now >= end) { out.fire = this.two ? "back" : "next"; out.direction = out.fire; out.progress = 1; this.state = "release"; this.clearSince = null; }
    return out;
  }
}
