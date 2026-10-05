// Minimal OSC 1.0 message encoder/decoder for the quake relay (its own copy, so the synth
// project's relay stays untouched). Numbers are sent as float32 (Tidal's cF only reads floats);
// wrap whole numbers that must be ints as int(x) (e.g. SuperDirt's orbit). Strings as strings.

export const int = (x) => ({ int: Math.round(x) });

function oscString(str) {
  const b = Buffer.from(str + "\0", "utf8");
  return Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
}

export function encodeOSC(address, args = []) {
  let tags = ",";
  const parts = [];
  for (const a of args) {
    if (typeof a === "number") {
      const b = Buffer.alloc(4); b.writeFloatBE(a); tags += "f"; parts.push(b);
    } else if (a !== null && typeof a === "object" && "int" in a) {
      const b = Buffer.alloc(4); b.writeInt32BE(a.int); tags += "i"; parts.push(b);
    } else {
      tags += "s"; parts.push(oscString(String(a)));
    }
  }
  return Buffer.concat([oscString(address), oscString(tags), ...parts]);
}

// A bundle with one message, stamped `aheadMs` in the future: SuperDirt then plays it exactly on
// time instead of "as soon as it arrives" (which it reports as "late").
export function encodeBundle(address, args = [], aheadMs = 150) {
  const msg = encodeOSC(address, args);
  const t = (Date.now() + aheadMs) / 1000 + 2208988800;        // NTP time: seconds since 1900
  const head = Buffer.alloc(12);
  head.writeUInt32BE(Math.floor(t), 0);
  head.writeUInt32BE(Math.floor((t % 1) * 4294967296), 4);
  head.writeInt32BE(msg.length, 8);
  return Buffer.concat([oscString("#bundle"), head, msg]);
}

// Used by the tests to read back what was sent.
export function decodeOSC(buf) {
  if (buf.toString("utf8", 0, 7) === "#bundle") buf = buf.subarray(20);   // unwrap a one-message bundle
  let pos = 0;
  const readString = () => {
    const end = buf.indexOf(0, pos);
    const s = buf.toString("utf8", pos, end);
    pos = end + 1; pos += (4 - (pos % 4)) % 4;
    return s;
  };
  const address = readString();
  const tags = readString();
  const args = [];
  for (const t of tags.slice(1)) {
    if (t === "i") { args.push(buf.readInt32BE(pos)); pos += 4; }
    else if (t === "f") { args.push(buf.readFloatBE(pos)); pos += 4; }
    else if (t === "s") { args.push(readString()); }
    else break;
  }
  return { address, args };
}
