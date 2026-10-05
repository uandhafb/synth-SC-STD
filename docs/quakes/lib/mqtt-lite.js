// A very small MQTT client (version 3.1.1, over a WebSocket, "at most once" delivery): connect,
// subscribe, publish, keep-alive, reconnect. Enough for the phones and the relay to exchange small
// JSON messages through a public broker, with no library to load. Runs in browsers and in Node 22+.
// (The ensemble idea, one static page per phone plus a broker, follows Gabriel Vigliensoni's
// phase-study ensemble.)

export function connectMqtt(url, { clientId, keepalive = 30, onConnect, onMessage, onState } = {}) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const subs = new Set();
  let ws = null, ping = null, buf = new Uint8Array(0), closed = false, connected = false, pid = 1;

  const str = (s) => { const b = enc.encode(s), out = new Uint8Array(2 + b.length); out[0] = b.length >> 8; out[1] = b.length & 255; out.set(b, 2); return out; };
  const varint = (n) => { const out = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; out.push(d); } while (n > 0); return out; };
  function packet(first, ...parts) {
    const len = parts.reduce((a, p) => a + p.length, 0), v = varint(len), out = new Uint8Array(1 + v.length + len);
    out[0] = first; out.set(v, 1);
    let o = 1 + v.length;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  const sendSub = (topic) => { ws.send(packet(0x82, [pid >> 8, pid & 255], str(topic), [0])); pid = (pid % 65535) + 1; };

  function handle(type, flags, body) {
    if (type === 2) {                                   // CONNACK
      if (body[1] !== 0) return;
      connected = true;
      for (const t of subs) sendSub(t);
      ping = setInterval(() => ws.readyState === 1 && ws.send(new Uint8Array([0xc0, 0])), (keepalive * 1000) / 2);
      onState?.(true); onConnect?.();
    } else if (type === 3) {                            // PUBLISH
      const tl = (body[0] << 8) | body[1], qos = (flags >> 1) & 3;
      onMessage?.(dec.decode(body.subarray(2, 2 + tl)), dec.decode(body.subarray(2 + tl + (qos ? 2 : 0))), { retained: (flags & 1) === 1 });
    }
  }

  function open() {
    if (closed) return;
    try { ws = new WebSocket(url, "mqtt"); } catch { return setTimeout(open, 3000); }
    ws.binaryType = "arraybuffer";
    ws.onopen = () => ws.send(packet(0x10, str("MQTT"), [4, 2, keepalive >> 8, keepalive & 255], str(clientId)));
    ws.onmessage = (ev) => {
      const add = new Uint8Array(ev.data), joined = new Uint8Array(buf.length + add.length);
      joined.set(buf); joined.set(add, buf.length); buf = joined;
      for (;;) {                                        // a frame can hold several packets, or part of one
        if (buf.length < 2) break;
        let len = 0, mult = 1, i = 1, done = false;
        for (; i < buf.length && i <= 4; i++) { len += (buf[i] & 127) * mult; mult *= 128; if (!(buf[i] & 128)) { done = true; i++; break; } }
        if (!done || buf.length < i + len) break;
        handle(buf[0] >> 4, buf[0] & 15, buf.subarray(i, i + len));
        buf = buf.slice(i + len);
      }
    };
    ws.onerror = () => {};
    ws.onclose = () => { clearInterval(ping); buf = new Uint8Array(0); if (connected) onState?.(false); connected = false; if (!closed) setTimeout(open, 2000); };
  }
  open();

  return {
    get connected() { return connected; },
    subscribe(topic) { subs.add(topic); if (connected) sendSub(topic); },
    // retain: the broker keeps the last message and gives it to whoever subscribes later
    publish(topic, payload, { retain = false } = {}) {
      if (!connected) return false;
      ws.send(packet(0x30 | (retain ? 1 : 0), str(topic), enc.encode(typeof payload === "string" ? payload : JSON.stringify(payload))));
      return true;
    },
    close() { closed = true; clearInterval(ping); try { ws?.close(); } catch { /* already closed */ } },
  };
}

export const BROKER = "wss://broker.hivemq.com:8884/mqtt";      // free, public, shared: fine for a class
export const topicsFor = (room) => { const b = `arrivaltimes/v1/${room}`; return { quake: `${b}/quake`, state: `${b}/state`, join: `${b}/join`, here: `${b}/here`, assign: (id) => `${b}/assign/${id}` }; };
