// For piece_test.sh: the real relay on test ports, a 40 s replay, then a big quake.
import { Relay } from "../quake-relay.js";
const relay = new Relay({ scPort: 57139, tidalPort: 6021, replaySeconds: 40, log: (m) => console.log(m) });
await relay.load(); relay.start(); relay.replay();
setTimeout(() => relay.fireBig(0), 46000);
setTimeout(() => { relay.stop(); process.exit(0); }, 58000);
