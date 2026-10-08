// The Hydra visuals: a seismograph. Every scene is made of the same thing, thin horizontal traces
// like the lines a seismometer draws on paper, and differs in how many there are, how they move
// and what bends them. The camera is in s0: the presenter is drawn BY the traces (the brightness
// of the camera image pushes each line up and down), not laid over them.
//   h    Hydra's functions (osc, noise, src, s0, o0 …)
//   L    live values from a real seismometer, read every frame (see main.js):
//          L.wave   the seismograph line itself (-1..1): the whole picture rides on it
//          L.swell  how busy the ground is compared with a moment ago (0.5 = as usual)
//          L.ground how strongly it moves (0..1)
//        and  L.pulse (jumps up on a change of block or a movement played in the piece, then
//        fades),  L.cam (camera on)
// Colours: acid lime and hot pink on black.

const lime = [0.83, 1.0, 0.23], pink = [1.0, 0.31, 0.85], paper = [0.96, 0.96, 0.94];
const TAU = Math.PI * 2;

// n thin horizontal lines.
const lines = (h, n, thin = 0.965) => h.osc(n * TAU, 0, 0).rotate(Math.PI / 2).thresh(thin, 0.012);
// What moves the lines: one slow, smooth field of noise. Smooth matters: with a fast, grainy field
// the thin lines break into dots and dashes (noise on the screen); with a slow one they stay whole
// and bend in long curves, like contour lines or a calm sea. `grain` is how tight the curves are
// (small = long and wide), `speed` how fast they drift. (n is kept so each scene reads the same.)
const tremor = (h, n, grain = 22, speed = 0.5) => h.noise(Math.max(1.2, grain / 9), speed * 0.25);
// How far the lines are pushed. The ground decides: when it is as busy as usual the lines draw
// their long curves; when it has just become busier they swing wide (up to three times as far),
// when it goes quiet they almost straighten. A change of block adds a short swell.
const shake = (L, rest, ground = 0.05, hit = 0.12) => () => 0.012 + 0.11 * L.swell * L.swell * 1.6 + 0.35 * hit * L.pulse;
// The whole picture rides on the seismograph line: up when the line goes up, down when it goes
// down, at the same instant as the trace in the corner.
const ride = (L) => () => L.wave * 0.02;
// The camera as a mirror, in grey.
const cam = (h) => h.src(h.s0).scale(1, -1, 1).saturate(0).contrast(1.5);
// What bends the lines into the presenter's figure: the camera, SOFTENED. A sharp camera image
// (edges, hair, the grain of a dark room) breaks the thin lines into dots and dashes, the same way
// grainy noise does. So the camera is first blurred into its own buffer (o1): every frame it is
// mixed with its own previous frame, nudged a little in the four directions, which spreads the
// image out in space and in time. The lines then bend around a soft body, not around its details.
export function prepare(h) {
  const past = () => h.src(h.o1);
  cam(h).blend(past().add(past().scrollX(0.007), 1).add(past().scrollX(-0.007), 1).add(past().scrollY(0.007), 1).add(past().scrollY(-0.007), 1)
    .mult(h.solid(0.2, 0.2, 0.2)), 0.82).out(h.o1);
}
const soft = (h) => h.src(h.o1);
// Bend the traces with the camera, add a faint ghost of the image so the figure is easy to find,
// and dim everything so the text on top stays readable.
const finish = (h, L, chain, { figure = 0.05, ghost = 0.16, tint = pink, dim = 0.7 } = {}) =>
  chain.scrollY(ride(L)).modulateScrollY(soft(h), () => (L.cam ? figure * 1.6 : 0))
    .add(cam(h).thresh(0.5, 0.3).color(...tint), () => (L.cam ? ghost : 0))
    .mult(h.solid(dim, dim, dim));

export const SCENES = {
  // the paper at rest: many calm traces
  paper: (h, L) => finish(h, L,
    lines(h, 26).color(...lime).modulateScrollY(tremor(h, 26), shake(L, 0.006))),

  // the presenter: the paper turned on its side. Vertical pale lines, like a curtain or rain,
  // pushed sideways by the (softened) camera, so the figure stands in them; pink ghost behind.
  figure: (h, L) =>
    h.osc(30 * TAU, 0, 0).thresh(0.955, 0.012).color(...paper)
      .modulateScrollX(tremor(h, 30, 14, 0.4), shake(L, 0.004, 0.03, 0.05)).scrollX(ride(L))
      .modulateScrollX(soft(h), () => (L.cam ? 0.07 : 0))
      .add(cam(h).thresh(0.5, 0.3).color(...pink), () => (L.cam ? 0.3 : 0))
      .mult(h.solid(0.72, 0.72, 0.72)),

  // three traces: three languages, each with its own hand
  three: (h, L) => finish(h, L,
    lines(h, 3, 0.985).color(...lime).modulateScrollY(tremor(h, 3, 9, 0.8), shake(L, 0.05))
      .add(lines(h, 3, 0.985).scrollY(0.11).color(...pink).modulateScrollY(tremor(h, 3, 16, 0.5), shake(L, 0.035)))
      .add(lines(h, 3, 0.985).scrollY(0.22).color(...paper).modulateScrollY(tremor(h, 3, 30, 0.3), shake(L, 0.02))),
    { figure: 0.03 }),

  // an old recording: slow traces that leave their past behind them
  old: (h, L) => finish(h, L,
    lines(h, 12, 0.97).color(...pink).modulateScrollY(tremor(h, 12, 6, 0.2), shake(L, 0.03))
      .blend(h.src(h.o0).scrollY(0.002).hue(0.004), 0.82),
    { tint: lime, ghost: 0.12 }),

  // the schematic: traces and the time marks of the paper
  marks: (h, L) => finish(h, L,
    lines(h, 16).color(...lime).modulateScrollY(tremor(h, 16, 14), shake(L, 0.008))
      .add(h.osc(24 * TAU, 0.02, 0).thresh(0.992, 0.004).color(...pink), 0.5),
    { figure: 0.03, dim: 0.55 }),

  // reading code: fine paper running upwards
  feed: (h, L) => finish(h, L,
    lines(h, 48, 0.94).scrollY(0, 0.02).color(...lime).modulateScrollY(tremor(h, 48, 40, 0.9), shake(L, 0.003, 0.02, 0.05)),
    { figure: 0.03, dim: 0.5 }),

  // the waves arriving: two fronts cross the paper, the P (pale) ahead of the S (pink)
  arrive: (h, L) => finish(h, L,
    lines(h, 22).color(...lime).modulateScrollY(tremor(h, 22), shake(L, 0.008))
      .add(h.osc(TAU, 0.06, 0).thresh(0.996, 0.003).color(...paper), 0.9)
      .add(h.osc(TAU, 0.035, 0.5).thresh(0.99, 0.006).color(...pink), 0.9),
    { figure: 0.04 }),

  // the earthquake: the pens swing wide, in two colours, with the real ground in them
  shock: (h, L) => finish(h, L,
    lines(h, 18, 0.96).color(...pink).modulateScrollY(tremor(h, 18, 26, 1.2), shake(L, 0.02, 0.16, 0.3))
      .add(lines(h, 18, 0.975).scrollY(0.027).color(...lime).modulateScrollY(tremor(h, 18, 12, 0.7), shake(L, 0.012, 0.1, 0.2)))
      .blend(h.src(h.o0), 0.35),
    { figure: 0.06, tint: lime }),

  // inside the code: a wall of small marks, like characters on a screen, appearing and
  // disappearing line by line and drifting slowly upwards
  glyphs: (h, L) => finish(h, L,
    h.osc(64 * TAU, 0, 0).thresh(0.35, 0.1).mult(h.osc(30 * TAU, 0, 0).rotate(Math.PI / 2).thresh(0.45, 0.1))
      .mult(h.noise(26, 0.12).pixelate(64, 30).thresh(0.08, 0.25))
      .scrollY(0, 0.012).color(...lime)
      .modulate(h.noise(1.5, 0.05), shake(L, 0.002, 0.02, 0.04)),
    { figure: 0.02, ghost: 0.2, tint: pink, dim: 0.5 }),

  // the end: circles leaving a centre, the way the waves of an earthquake leave it, in two
  // colours (the pale P wave ahead, the pink S wave behind), softly bent by the presenter
  ripples: (h, L) =>
    h.osc(110, -0.02, 0).kaleid(180).thresh(0.9, 0.03).color(...paper)
      .add(h.osc(55, -0.012, 0.5).kaleid(180).thresh(0.93, 0.02).color(...pink))
      .modulate(h.noise(1.6, 0.06), shake(L, 0.004, 0.03, 0.06)).scale(() => 1 + L.wave * 0.03)
      .modulate(soft(h), () => (L.cam ? 0.04 : 0))
      .add(cam(h).thresh(0.5, 0.3).color(...lime), () => (L.cam ? 0.18 : 0))
      .mult(h.solid(0.62, 0.62, 0.62)),
};
