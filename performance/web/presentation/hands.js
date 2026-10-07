// The camera and the hands. One camera stream is used three times: the hand tracker reads it
// (MediaPipe Hand Landmarker, running in the browser: nothing is sent anywhere), Hydra mixes it into
// the visuals, and a small mirrored view in the corner shows what the tracker sees.
import { FilesetResolver, HandLandmarker } from "./vendor/mediapipe/vision_bundle.js";
import { Gestures, isOpen, handSize } from "./gesture.js";

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const MIN_SIZE = 0.07;        // smaller hands (people at the back of the room) do not count

// start({ video, view, onStep, onState }) -> { stop, setEnabled }
//   onStep("next" | "back")       a gesture was completed
//   onState({ open, hands, progress, direction, waiting, enabled })   for the ring and the label
export async function startHands({ video, view, onStep, onState }) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
  video.srcObject = stream; video.muted = true; video.playsInline = true;
  await video.play();

  const files = await FilesetResolver.forVisionTasks(new URL("./vendor/mediapipe/wasm", import.meta.url).href);
  const options = (delegate) => ({ baseOptions: { modelAssetPath: new URL("./vendor/mediapipe/hand_landmarker.task", import.meta.url).href, delegate },
    runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5 });
  let tracker;
  try { tracker = await HandLandmarker.createFromOptions(files, options("GPU")); }
  catch { tracker = await HandLandmarker.createFromOptions(files, options("CPU")); }       // no WebGL for it: slower, still fine

  const gestures = new Gestures(), ctx = view.getContext("2d");
  let enabled = true, running = true, lastTime = -1, lastRun = 0;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - lastRun < 60 || video.readyState < 2 || video.currentTime === lastTime) return;   // about 15 times a second is plenty
    lastRun = now; lastTime = video.currentTime;
    let hands = [];
    try { hands = tracker.detectForVideo(video, now).landmarks ?? []; } catch { /* a bad frame */ }
    hands = hands.filter((lm) => handSize(lm) >= MIN_SIZE);
    const openFlags = hands.map(isOpen), open = openFlags.filter(Boolean).length;
    const g = enabled ? gestures.update(open, now) : { fire: null, progress: 0, direction: null, waiting: false };
    if (!enabled) gestures.reset();

    // the corner view: the camera as in a mirror, with the hands drawn on it
    const W = view.width, H = view.height;
    ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H);
    hands.forEach((lm, i) => {
      ctx.strokeStyle = ctx.fillStyle = openFlags[i] ? "#d4ff3a" : "rgba(244,244,239,0.6)"; ctx.lineWidth = openFlags[i] ? 2.5 : 1.5;
      ctx.beginPath(); for (const [a, b] of BONES) { ctx.moveTo(lm[a].x * W, lm[a].y * H); ctx.lineTo(lm[b].x * W, lm[b].y * H); } ctx.stroke();
      for (const p of lm) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 2, 0, 7); ctx.fill(); }
    });
    ctx.restore();

    onState?.({ open, hands: hands.length, ...g, enabled });
    if (g.fire) onStep?.(g.fire);
  }
  requestAnimationFrame(frame);

  return {
    stop() { running = false; stream.getTracks().forEach((t) => t.stop()); tracker.close?.(); },
    setEnabled(on) { enabled = on; },
    get enabled() { return enabled; },
  };
}
