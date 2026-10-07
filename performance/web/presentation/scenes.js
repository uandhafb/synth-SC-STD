// The Hydra visuals: a seismograph. Every scene is made of the same thing, thin horizontal traces
// like the lines a seismometer draws on paper, and differs in how many there are, how they move
// and what bends them. The camera is in s0: the presenter is drawn BY the traces (the brightness
// of the camera image pushes each line up and down), not laid over them.
//   h    Hydra's functions (osc, noise, src, s0, o0 …)
//   L    live values, read every frame:  L.ground (0..1, the ground under Montréal),
//        L.pulse (jumps up on an earthquake or a change of block, then fades), L.cam (camera on)
// Colours: acid lime and hot pink on black.

const lime = [0.83, 1.0, 0.23], pink = [1.0, 0.31, 0.85], paper = [0.96, 0.96, 0.94];
const TAU = Math.PI * 2;

// n thin horizontal lines.
const lines = (h, n, thin = 0.965) => h.osc(n * TAU, 0, 0).rotate(Math.PI / 2).thresh(thin, 0.012);
// What a seismometer adds: a displacement that changes quickly along the line and is different
// for each line (the noise is cut into n rows), moving like paper under the pen.
const tremor = (h, n, grain = 22, speed = 0.5) => h.noise(grain, speed).pixelate(900, n).scrollX(0, 0.03);
// How far the lines are pushed: a little always, more with the real ground, most on an earthquake.
const shake = (L, rest, ground = 0.05, hit = 0.12) => () => rest + ground * L.ground + hit * L.pulse;
// The camera as a mirror, in grey: what bends the lines into the presenter's figure.
const cam = (h) => h.src(h.s0).scale(1, -1, 1).saturate(0).contrast(1.5);
// Bend the traces with the camera, add a faint ghost of the image so the figure is easy to find,
// and dim everything so the text on top stays readable.
const finish = (h, L, chain, { figure = 0.05, ghost = 0.16, tint = pink, dim = 0.7 } = {}) =>
  chain.modulateScrollY(cam(h), () => (L.cam ? figure : 0))
    .add(cam(h).thresh(0.5, 0.3).color(...tint), () => (L.cam ? ghost : 0))
    .mult(h.solid(dim, dim, dim));

export const SCENES = {
  // the paper at rest: many calm traces
  paper: (h, L) => finish(h, L,
    lines(h, 26).color(...lime).modulateScrollY(tremor(h, 26), shake(L, 0.006))),

  // the presenter: the camera is the signal; few, strong lines
  figure: (h, L) => finish(h, L,
    lines(h, 34, 0.95).color(...paper).modulateScrollY(tremor(h, 34, 30), shake(L, 0.004, 0.03, 0.06)),
    { figure: 0.11, ghost: 0.28, tint: pink, dim: 0.75 }),

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
};
