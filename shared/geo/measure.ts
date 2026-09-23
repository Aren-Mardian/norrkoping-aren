/**
 * Längdmätning — aldrig planärt i Web Mercator (NFK-12, TK-03).
 *
 * Två godkända metoder:
 *  1. Planärt i SWEREF 99 TM (EPSG:3006) — sajtens enda referenssystem (ADR-18). I Norrköping
 *     ger det ca −0,03 % avvikelse, långt under kravet 0,5 %.
 *  2. Geodetiskt på GRS80-ellipsoiden (Vincentys inversa formel). Referensmetod.
 *
 * Planär beräkning i EPSG:3857 avvisas aktivt: skalfaktorn är ≈ 1,92 på 58,6° N,
 * så 1 000 m skulle rapporteras som ≈ 1 914 m (Bilaga B.4).
 */
import { MEASURABLE_PROJECTIONS, ProjectionNotMeasurableError, planarLength } from './planar.ts';
import { EPSG_3006, EPSG_3857, EPSG_4326, transformXY, type LonLat, type XY } from './projDefs.ts';

// Vitlistan och den planära beräkningen ligger i planar.ts (utan beroenden) och återexporteras
// här, så att den som bara behöver dem slipper dra in proj4 (Origo-sidan gör det).
export { MEASURABLE_PROJECTIONS, ProjectionNotMeasurableError, planarLength } from './planar.ts';

/**
 * Längd av en bruten linje given i `projection`. Kastar för 3857 och andra
 * icke-godkända system. Lon/lat (4326) beräknas geodetiskt.
 */
export function measureLength(coords: readonly XY[], projection: string): number {
  if (projection === EPSG_4326) return geodesicLength(coords as readonly LonLat[]);
  if (!MEASURABLE_PROJECTIONS.has(projection)) throw new ProjectionNotMeasurableError(projection);
  return planarLength(coords);
}

/** Längd i EPSG:3006 av lon/lat-koordinater — den metod verktygsläget använder. */
export function lengthInSweref99TM(lonLat: readonly LonLat[]): number {
  return planarLength(lonLat.map((c) => transformXY(c, EPSG_4326, EPSG_3006)));
}

/** Geodetisk längd (GRS80) av lon/lat-koordinater. */
export function geodesicLength(lonLat: readonly LonLat[]): number {
  let sum = 0;
  for (let i = 1; i < lonLat.length; i++) sum += vincentyInverse(lonLat[i - 1]!, lonLat[i]!);
  return sum;
}

// GRS80 — SWEREF 99 bygger på GRS80; skillnaden mot WGS 84 är < 0,1 mm i halva lillaxeln.
const A = 6_378_137;
const F = 1 / 298.257222101;
const B = A * (1 - F);

/** Vincentys inversa formel: geodetiskt avstånd i meter mellan två lon/lat-punkter. */
export function vincentyInverse(p1: LonLat, p2: LonLat): number {
  const toRad = Math.PI / 180;
  const phi1 = p1[1] * toRad;
  const phi2 = p2[1] * toRad;
  const L = (p2[0] - p1[0]) * toRad;
  const U1 = Math.atan((1 - F) * Math.tan(phi1));
  const U2 = Math.atan((1 - F) * Math.tan(phi2));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let sinSigma = 0;
  let cosSigma = 0;
  let sigma = 0;
  let cosSqAlpha = 0;
  let cos2SigmaM = 0;
  for (let iter = 0; iter < 100; iter++) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    sinSigma = Math.hypot(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
    if (sinSigma === 0) return 0; // sammanfallande punkter
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha === 0 ? 0 : cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha;
    const C = (F / 16) * cosSqAlpha * (4 + F * (4 - 3 * cosSqAlpha));
    const lambdaPrev = lambda;
    lambda =
      L +
      (1 - C) *
        F *
        sinAlpha *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    if (Math.abs(lambda - lambdaPrev) < 1e-12) break;
  }

  const uSq = (cosSqAlpha * (A * A - B * B)) / (B * B);
  const kA = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const kB = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    kB *
    sinSigma *
    (cos2SigmaM +
      (kB / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (kB / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
  return B * kA * (sigma - deltaSigma);
}

/** Exporteras för det negativa testet i TK-03: så här stort blir felet i Web Mercator. */
export function planarLengthInWebMercatorForTestOnly(lonLat: readonly LonLat[]): number {
  return planarLength(lonLat.map((c) => transformXY(c, EPSG_4326, EPSG_3857)));
}
