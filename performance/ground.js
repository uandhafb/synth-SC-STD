// Arrival Times: the ground, live. A seismometer's continuous signal from EarthScope's real-time
// server (DataLink protocol over a WebSocket; miniSEED 2 records, Steim compression), decoded
// here without any library. Default station: CN.MNTQ, Montréal (Canadian National Seismograph
// Network), vertical channel HHZ, 100 samples per second, about 2 s behind the ground itself.
//
// In a city the ground never rests (traffic, the metro, people), so this is the one source that
// is always alive. It becomes:  value 0..1 (how much the ground moves now, relative to the last
// minute) for Tidal, and the waveform itself for the seismograph line on the projection.

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ---- miniSEED 2 ---------------------------------------------------------------------------------

// Steim 1 / Steim 2: the samples are stored as small differences packed into 64-byte frames.
function steim(view, off, nbytes, nsamp, big, v2) {
  const out = []; let last = 0, x0 = 0;
  const sx = (val, bits) => (val << (32 - bits)) >> (32 - bits);          // sign-extend
  for (let f = 0; f * 64 < nbytes && out.length < nsamp; f++) {
    const base = off + f * 64, nibbles = view.getUint32(base, !big);
    for (let w = 0; w < 16 && out.length < nsamp; w++) {
      const nib = (nibbles >>> (30 - 2 * w)) & 3, word = view.getUint32(base + 4 * w, !big);
      if (f === 0 && w === 1) { x0 = word | 0; continue; }                 // first sample of the record
      if (f === 0 && w === 2) continue;                                    // last sample (a checksum)
      const diffs = [];
      if (nib === 1) for (let i = 3; i >= 0; i--) diffs.push(sx((word >>> (8 * i)) & 0xff, 8));
      else if (!v2 && nib === 2) for (let i = 1; i >= 0; i--) diffs.push(sx((word >>> (16 * i)) & 0xffff, 16));
      else if (!v2 && nib === 3) diffs.push(word | 0);
      else if (v2 && nib === 2) { const dn = word >>> 30;
        if (dn === 1) diffs.push(sx(word & 0x3fffffff, 30));
        else if (dn === 2) for (let i = 1; i >= 0; i--) diffs.push(sx((word >>> (15 * i)) & 0x7fff, 15));
        else if (dn === 3) for (let i = 2; i >= 0; i--) diffs.push(sx((word >>> (10 * i)) & 0x3ff, 10)); }
      else if (v2 && nib === 3) { const dn = word >>> 30;
        if (dn === 0) for (let i = 4; i >= 0; i--) diffs.push(sx((word >>> (6 * i)) & 0x3f, 6));
        else if (dn === 1) for (let i = 5; i >= 0; i--) diffs.push(sx((word >>> (5 * i)) & 0x1f, 5));
        else if (dn === 2) for (let i = 6; i >= 0; i--) diffs.push(sx((word >>> (4 * i)) & 0xf, 4)); }
      for (const d of diffs) { if (out.length >= nsamp) break; last = out.length === 0 ? x0 : last + d; out.push(last); }
    }
  }
  return out;
}

// One miniSEED 2 record -> { start (ms since 1970), rate (Hz), samples (integer counts) }.
export function decodeRecord(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 64) return null;
  const nsamp = v.getUint16(30), f = v.getInt16(32), m = v.getInt16(34), dataOff = v.getUint16(44), blk = v.getUint16(46);
  if (!nsamp || !dataOff || !blk || v.getUint16(blk) !== 1000) return null;       // needs blockette 1000
  const encoding = v.getUint8(blk + 4), big = v.getUint8(blk + 5) === 1, reclen = 2 ** v.getUint8(blk + 6);
  if (encoding !== 10 && encoding !== 11) return null;                            // Steim 1 or Steim 2 only
  const rate = f > 0 ? (m > 0 ? f * m : -f / m) : (m > 0 ? -m / f : 1 / (f * m));
  const start = Date.UTC(v.getUint16(20), 0, v.getUint16(22), v.getUint8(24), v.getUint8(25), v.getUint8(26), v.getUint16(28) / 10);
  return { start, rate, samples: steim(v, dataOff, Math.min(reclen, bytes.length) - dataOff, nsamp, big, encoding === 11) };
}

// ---- the live signal ----------------------------------------------------------------------------

export class Ground {
  // onValue(v): 20 times per second, 0..1.   onTrace(points): the waveform, about -1..1, 50 points per second.
  constructor(opts = {}) {
    this.o = { url: "wss://rtserve.earthscope.org/datalink", match: "FDSN:CN_MNTQ__H_H_Z/MSEED", name: "Montréal · station CN.MNTQ",
      delay: 7,                  // seconds behind real time: the server sends ~3 s blocks ~2 s late
      onValue: () => {}, onTrace: () => {}, log: console.log, ...opts };
    this.queue = [];             // { t, v } not yet played
    this.lastEnd = 0;            // to drop the duplicate records the server sometimes sends
    this.dc = null; this.fast = 0; this.slow = null; this.value = 0;
    this.alive = false; this.lastData = 0;
  }

  start() {
    this.connect();
    this.timer = setInterval(() => this.tick(), 50);
  }

  stop() { clearInterval(this.timer); clearTimeout(this.retry); this.closing = true; try { this.ws?.close(); } catch { /* already closed */ } }

  connect() {
    if (this.closing) return;
    const enc = new TextEncoder(), dec = new TextDecoder();
    let ws;
    try { ws = new WebSocket(this.o.url, "DataLink1.0"); } catch { return this.again(); }
    this.ws = ws; ws.binaryType = "arraybuffer";
    const send = (header, data = "") => {
      const h = enc.encode(header), d = enc.encode(data), out = new Uint8Array(3 + h.length + d.length);
      out[0] = 68; out[1] = 76; out[2] = h.length; out.set(h, 3); out.set(d, 3 + h.length);      // "DL" + header length
      ws.send(out);
    };
    let asked = false;
    ws.onopen = () => send("ID arrivaltimes:relay:0:node");
    ws.onmessage = (ev) => {
      const buf = new Uint8Array(ev.data), hl = buf[2], header = dec.decode(buf.subarray(3, 3 + hl));
      if (header.startsWith("ID ")) send(`MATCH ${enc.encode(this.o.match).length}`, this.o.match);
      else if (header.startsWith("OK") && !asked) { asked = true; send("STREAM"); this.o.log(`the ground, live: ${this.o.name}`); }
      else if (header.startsWith("PACKET")) { const rec = decodeRecord(buf.subarray(3 + hl)); if (rec) this.push(rec); }
    };
    ws.onerror = () => {};
    ws.onclose = () => this.again();
  }

  again() { if (!this.closing) this.retry = setTimeout(() => this.connect(), 5000); }

  push(rec) {
    if (rec.start <= this.lastEnd - 5) return;                    // a record we already have
    const dt = 1000 / rec.rate;
    for (let i = 0; i < rec.samples.length; i++) this.queue.push({ t: rec.start + i * dt, v: rec.samples[i] });
    this.lastEnd = rec.start + rec.samples.length * dt;
    this.rate = rec.rate; this.lastData = Date.now();
    if (this.queue.length > rec.rate * 60) this.queue.splice(0, this.queue.length - rec.rate * 60);
  }

  // Plays the queue at real speed, `delay` seconds late, so the blocks become a smooth signal.
  tick(now = Date.now()) {
    const head = now - this.o.delay * 1000, trace = [];
    let n = 0;
    while (this.queue.length && this.queue[0].t <= head) {
      const s = this.queue.shift(); n++;
      if (this.dc === null) this.dc = s.v;
      this.dc += (s.v - this.dc) * 0.002;                         // the slow offset of the instrument
      const x = s.v - this.dc, k = 1 / (this.rate ?? 100);
      this.fast += (x * x - this.fast) * (k / 0.25);              // loudness now (a quarter of a second)
      // loudness of the last ~minute; it adapts fast at first (1 s), so the level is right at once
      this.heard = (this.heard ?? 0) + k;
      if (this.slow === null) this.slow = Math.max(1, x * x);
      this.slow += (x * x - this.slow) * (k / Math.min(45, 1 + this.heard));
      if (n % 2 === 0) trace.push(Math.max(-1, Math.min(1, x / (5 * Math.sqrt(this.slow) + 1e-9))));
    }
    this.alive = now - this.lastData < 15000 && this.slow !== null;
    if (n) this.value = clamp01(Math.sqrt(this.fast) / (3 * Math.sqrt(this.slow) + 1e-9));
    else this.value *= 0.97;                                      // no samples: let it settle
    this.o.onValue(this.alive ? this.value : 0);
    if (trace.length) this.o.onTrace(trace);
  }
}
