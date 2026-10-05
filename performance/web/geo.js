// Arrival Times: the geography and seismology shared by the projection and the phones.

// The stations: each phone in the room becomes one of these cities.
export const STATIONS = [
  { name: "Montréal", lat: 45.50, lon: -73.57 }, { name: "Tokyo", lat: 35.68, lon: 139.69 },
  { name: "Santiago", lat: -33.45, lon: -70.67 }, { name: "Reykjavík", lat: 64.15, lon: -21.94 },
  { name: "Jakarta", lat: -6.21, lon: 106.85 }, { name: "Nairobi", lat: -1.29, lon: 36.82 },
  { name: "Mexico City", lat: 19.43, lon: -99.13 }, { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "Lisbon", lat: 38.72, lon: -9.14 }, { name: "Istanbul", lat: 41.01, lon: 28.98 },
  { name: "Delhi", lat: 28.61, lon: 77.21 }, { name: "Beijing", lat: 39.90, lon: 116.41 },
  { name: "Sydney", lat: -33.87, lon: 151.21 }, { name: "Auckland", lat: -36.85, lon: 174.76 },
  { name: "Honolulu", lat: 21.31, lon: -157.86 }, { name: "Anchorage", lat: 61.22, lon: -149.90 },
  { name: "Los Angeles", lat: 34.05, lon: -118.24 }, { name: "Cape Town", lat: -33.92, lon: 18.42 },
  { name: "Lagos", lat: 6.52, lon: 3.38 }, { name: "Tehran", lat: 35.69, lon: 51.39 },
];

const RAD = Math.PI / 180;

// Angle between two places seen from the Earth's centre, in degrees (0 = same place, 180 = opposite side).
export function distanceDeg(a, b) {
  const s = Math.sin(a.lat * RAD) * Math.sin(b.lat * RAD) + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
  return Math.acos(Math.min(1, Math.max(-1, s))) / RAD;
}

// The point `dist` degrees away from `p` in compass direction `bearing` (degrees).
export function destination(p, bearing, dist) {
  const f = p.lat * RAD, d = dist * RAD, b = bearing * RAD;
  const lat = Math.asin(Math.sin(f) * Math.cos(d) + Math.cos(f) * Math.sin(d) * Math.cos(b));
  const lon = p.lon * RAD + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f), Math.cos(d) - Math.sin(f) * Math.sin(lat));
  return { lat: lat / RAD, lon: ((lon / RAD + 540) % 360) - 180 };
}

// Travel times of seismic waves through the Earth, in minutes, by distance in degrees.
// Rounded values of the standard tables (IASP91, surface source): good enough to be recognisably
// real. P is the fast compression wave, S the slower shear wave.
const P_TABLE = [[0, 0], [10, 2.4], [20, 4.6], [30, 6.2], [40, 7.6], [50, 8.9], [60, 10.1], [70, 11.2], [80, 12.2], [90, 13.0], [104, 13.9]];
const S_TABLE = [[0, 0], [10, 4.3], [20, 8.2], [30, 11.1], [40, 13.7], [50, 16.1], [60, 18.4], [70, 20.4], [80, 22.2], [90, 23.9], [104, 25.7]];
// Beyond the shadow zone only P waves that crossed the liquid outer core arrive (PKP), late and weak.
const PKP_TABLE = [[140, 19.5], [160, 20.0], [180, 20.2]];
export const SHADOW_FROM = 104, SHADOW_TO = 140;

function lookup(table, x) {
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

// What a station at `deg` degrees from the earthquake receives.
//   p, s: arrival times in minutes (null = that wave does not arrive), strength 0..1.
// Shadow zone (104-140 degrees): the liquid outer core bends P waves away and stops S waves
// (liquids cannot carry shear), so almost nothing arrives. Beyond 140 degrees: a weak, late P only.
export function arrivals(deg) {
  if (deg <= SHADOW_FROM) return { p: lookup(P_TABLE, deg), s: lookup(S_TABLE, deg), strength: 1 - 0.6 * (deg / SHADOW_FROM), zone: "direct" };
  if (deg < SHADOW_TO) return { p: null, s: null, strength: 0.04, zone: "shadow" };
  return { p: lookup(PKP_TABLE, deg), s: null, strength: 0.25, zone: "core" };
}

// How far (degrees) a wave front has travelled after `minutes` (for drawing the rings).
export function frontDeg(minutes, wave = "p") {
  const table = wave === "p" ? P_TABLE : S_TABLE;
  for (let i = 1; i < table.length; i++) {
    if (minutes <= table[i][1]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return x0 + ((minutes - y0) / (y1 - y0)) * (x1 - x0);
    }
  }
  return null;       // past 104 degrees: the direct wave is gone
}

// The piece's time scale for the waves: 1 real minute of travel = this many seconds in the room
// (the slowest S wave, 25.7 minutes, takes about 10 s).
export const SECONDS_PER_MINUTE = 0.4;

// Orthographic projection (the globe seen from far away), centred on `c`. Returns null if the
// point is on the far side.
export function project(p, c, R) {
  const dl = (p.lon - c.lon) * RAD, f = p.lat * RAD, f0 = c.lat * RAD;
  const visible = Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(dl);
  if (visible < 0) return null;
  return { x: R * Math.cos(f) * Math.sin(dl), y: -R * (Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(dl)) };
}
