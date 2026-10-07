// Arrival Times: the geography and seismology shared by the projection, the relay and the phones.

// The stations: each phone in the room becomes one of these real seismic stations. All of them
// stream their ground motion live through EarthScope's real-time server (checked 2026-10-05);
// `id` is the stream of the vertical channel. Most belong to the Global Seismographic Network
// (IU, II); Montréal is the Canadian National Seismograph Network (CN). The order spreads the
// first phones around the globe.
export const STATIONS = [
  ["CN.MNTQ", "Montréal", "Canada", 45.50, -73.62, "CN_MNTQ__H_H_Z"],
  ["IU.LCO", "Las Campanas", "Chile", -29.01, -70.70, "IU_LCO_00_B_H_Z"],
  ["IU.KMBO", "Kilima Mbogo", "Kenya", -1.13, 37.25, "IU_KMBO_00_B_H_Z"],
  ["IU.CTAO", "Charters Towers", "Australia", -20.09, 146.25, "IU_CTAO_00_B_H_Z"],
  ["II.BORG", "Borgarfjörður", "Iceland", 64.75, -21.33, "II_BORG_00_B_H_Z"],
  ["IU.COLA", "College", "Alaska", 64.87, -147.86, "IU_COLA_00_B_H_Z"],
  ["II.PALK", "Pallekele", "Sri Lanka", 7.27, 80.70, "II_PALK_00_B_H_Z"],
  ["IU.PAB", "San Pablo", "Spain", 39.54, -4.35, "IU_PAB_00_B_H_Z"],
  ["IU.SNZO", "South Karori", "New Zealand", -41.31, 174.70, "IU_SNZO_00_B_H_Z"],
  ["IU.TEIG", "Tepich", "Mexico", 20.23, -88.28, "IU_TEIG_00_B_H_Z"],
  ["II.SUR", "Sutherland", "South Africa", -32.38, 20.81, "II_SUR_00_B_H_Z"],
  ["IU.CHTO", "Chiang Mai", "Thailand", 18.81, 98.94, "IU_CHTO_00_B_H_Z"],
  ["IU.RCBR", "Riachuelo", "Brazil", -5.83, -35.90, "IU_RCBR_00_B_H_Z"],
  ["IU.ANTO", "Ankara", "Turkey", 39.87, 32.79, "IU_ANTO_00_B_H_Z"],
  ["IU.GUMO", "Guam", "Mariana Islands", 13.59, 144.87, "IU_GUMO_00_B_H_Z"],
  ["IU.YAK", "Yakutsk", "Russia", 62.03, 129.68, "IU_YAK_00_B_H_Z"],
  ["II.NNA", "Ñaña", "Peru", -11.99, -76.84, "II_NNA_00_B_H_Z"],
  ["IU.KONO", "Kongsberg", "Norway", 59.65, 9.60, "IU_KONO_00_B_H_Z"],
  ["IU.RAR", "Rarotonga", "Cook Islands", -21.21, -159.77, "IU_RAR_00_B_H_Z"],
  ["IU.TSUM", "Tsumeb", "Namibia", -19.20, 17.58, "IU_TSUM_00_B_H_Z"],
  ["II.AAK", "Ala Archa", "Kyrgyzstan", 42.64, 74.49, "II_AAK_00_B_H_Z"],
  ["IU.ANMO", "Albuquerque", "New Mexico", 34.95, -106.46, "IU_ANMO_00_B_H_Z"],
  ["IU.DAV", "Davao", "Philippines", 7.07, 125.58, "IU_DAV_00_B_H_Z"],
  ["II.ASCN", "Ascension Island", "South Atlantic", -7.93, -14.36, "II_ASCN_00_B_H_Z"],
  ["IU.ULN", "Ulaanbaatar", "Mongolia", 47.87, 107.05, "IU_ULN_00_B_H_Z"],
  ["IU.OTAV", "Otavalo", "Ecuador", 0.24, -78.45, "IU_OTAV_00_B_H_Z"],
  ["II.KDAK", "Kodiak Island", "Alaska", 57.78, -152.58, "II_KDAK_00_B_H_Z"],
  ["IU.KEV", "Kevo", "Finland", 69.76, 27.00, "IU_KEV_00_B_H_Z"],
  ["IU.PTCN", "Pitcairn Island", "South Pacific", -25.07, -130.10, "IU_PTCN_00_B_H_Z"],
  ["II.EFI", "Mount Kent", "Falkland Islands", -51.68, -58.06, "II_EFI_00_B_H_Z"],
  ["IU.HRV", "Harvard", "Massachusetts", 42.51, -71.56, "IU_HRV_00_B_H_Z"],
  // not sending live data on 2026-10-07 (checked all 34 for 50 s): kept last, so they are only dealt
  // when more than 31 phones are in the room
  ["IU.MAJO", "Matsushiro", "Japan", 36.55, 138.20, "IU_MAJO_00_B_H_Z"],
  ["IU.PMSA", "Palmer Station", "Antarctica", -64.77, -64.05, "IU_PMSA_00_B_H_Z"],
  ["II.MSEY", "Mahé", "Seychelles", -4.67, 55.48, "II_MSEY_10_B_H_Z"],
].map(([code, name, region, lat, lon, id]) => ({ code, name, region, lat, lon, match: `FDSN:${id}/MSEED` }));

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
