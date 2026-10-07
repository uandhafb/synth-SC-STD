// The Hydra visuals, one scene per kind of block. Each scene is a function of
//   h    Hydra's functions (osc, noise, shape, src, s0, o0 …)
//   L    live values, read every frame:  L.ground (0..1, the ground under Montréal),
//        L.pulse (jumps to 1 on an earthquake or a change of block, then fades), L.cam (is the camera on)
// The camera is in s0. Every scene ends by mixing the camera in (withCam), so the presenter is
// inside the picture, and keeps the image dark enough for the text on top.
//
// The look follows the LAÇO site: black, acid lime, hot pink, feedback trails.

const lime = [0.83, 1.0, 0.23], pink = [1.0, 0.31, 0.85];

// The camera as a drawing in light: mirrored, high contrast, tinted, laid over the scene.
const withCam = (h, L, chain, amount = 0.45, tint = lime) =>
  chain.add(h.src(h.s0).scale(1, -1, 1).saturate(0).contrast(1.6).brightness(-0.12).thresh(0.42, 0.25).color(...tint), () => (L.cam ? amount : 0));

// Everything is dimmed a little, and trembles with the ground.
const finish = (h, L, chain, dim = 0.62) =>
  chain.modulate(h.noise(3, 0.4), () => 0.004 + 0.05 * L.ground + 0.05 * L.pulse).brightness(() => -0.08 + 0.1 * L.pulse).mult(h.solid(dim, dim, dim));

export const SCENES = {
  // two rings tied together, with trails (the LAÇO opening)
  rings: (h, L) => finish(h, L, withCam(h, L,
    h.shape(99, () => 0.34 + 0.05 * L.pulse, 0.02).diff(h.shape(99, 0.3, 0.02)).scrollX(0.12)
      .add(h.shape(99, 0.34, 0.02).diff(h.shape(99, 0.3, 0.02)).scrollX(-0.12))
      .color(...lime).modulate(h.noise(2, 0.1), 0.02)
      .blend(h.src(h.o0).scale(1.015).hue(0.03), 0.85), 0.3, pink)),

  // the presenter, large: the camera is the scene
  mirror: (h, L) => finish(h, L,
    h.src(h.s0).scale(1, -1, 1).saturate(0).contrast(1.5).thresh(0.4, 0.3).color(...pink)
      .modulate(h.osc(8, 0.05), () => 0.02 + 0.1 * L.ground)
      .blend(h.src(h.o0).scale(1.01).hue(0.02), 0.7)
      .add(h.osc(30, 0.02, 0).thresh(0.92, 0.02).color(...lime), 0.25), 0.75),

  // three threads crossing: the three languages
  weave: (h, L) => finish(h, L, withCam(h, L,
    h.osc(18, 0.04, 0).thresh(0.9, 0.03).color(...lime)
      .add(h.osc(18, -0.03, 0).rotate(1.047).thresh(0.9, 0.03).color(...pink))
      .add(h.osc(18, 0.02, 0).rotate(-1.047).thresh(0.9, 0.03).color(0.9, 0.9, 0.85))
      .modulate(h.noise(1.5, 0.08), 0.06)
      .blend(h.src(h.o0).scale(1.006), 0.6))),

  // slow analog drift: the old machine
  drift: (h, L) => finish(h, L, withCam(h, L,
    h.osc(6, 0.03, 0.8).color(1.0, 0.45, 0.75).modulate(h.noise(2, 0.05), 0.35)
      .mask(h.shape(4, 0.75, 0.3)).diff(h.osc(40, 0.01).thresh(0.5, 0.4).color(...lime), 0.15)
      .blend(h.src(h.o0).scale(1.02).rotate(0.004), 0.8), 0.35)),

  // a patch grid: the schematic
  grid: (h, L) => finish(h, L, withCam(h, L,
    h.shape(4, 0.9, 0.01).diff(h.shape(4, 0.86, 0.01)).repeat(8, 5).color(...lime)
      .modulate(h.osc(2, 0.05), () => 0.01 + 0.04 * L.pulse)
      .blend(h.src(h.o0).scale(1.004), 0.7), 0.3, pink), 0.5),

  // scan lines: reading code
  scan: (h, L) => finish(h, L, withCam(h, L,
    h.osc(60, 0.02, 0).thresh(0.75, 0.05).color(...lime).mult(h.noise(3, 0.2).thresh(0.1, 0.4))
      .scrollY(0, 0.03).blend(h.src(h.o0).scrollY(0.004), 0.75), 0.35, pink), 0.5),

  // the earthquake: rings leaving a centre, everything shaken by the real ground
  quake: (h, L) => finish(h, L, withCam(h, L,
    h.osc(24, 0.08, 0).kaleid(60).thresh(0.82, 0.04).color(...pink)
      .add(h.shape(99, () => 0.06 + 0.25 * L.pulse, 0.01).color(...lime))
      .modulate(h.noise(4, 0.6), () => 0.02 + 0.3 * L.ground + 0.2 * L.pulse)
      .blend(h.src(h.o0).scale(1.02).hue(0.01), 0.8), 0.3)),
};
