/**
 * TK-02 — Transformationstest.
 * Kända kontrollpunkter transformeras mellan EPSG:4326 och SWEREF 99 TM (3006) med
 * avvikelse ≤ 0,01 m mot referensvärden. Sedan ADR-18 är 3006 sajtens enda referenssystem;
 * 4326 finns kvar enbart som inkommande dataformat.
 *
 * Referensvärdena är beräknade oberoende av proj4js, med PROJ via pyproj 3.6.1
 * (Transformer.from_crs('EPSG:4326', 'EPSG:3006', always_xy=True)).
 * Kravspec Bilaga B.2 anger samma punkt avrundad till hel meter: 568 944 / 6 494 713.
 */
import { describe, expect, it } from 'vitest';
import { EPSG_3006, toLonLat, toSweref99TM, transformXY, type LonLat } from './projDefs.ts';

const TOLERANCE_M = 0.01;

interface ControlPoint {
  name: string;
  lonLat: LonLat;
  sweref99tm: readonly [number, number];
  sweref991630: readonly [number, number];
}

const CONTROL_POINTS: readonly ControlPoint[] = [
  {
    name: 'Norrköping centrum (Bilaga B.2)',
    lonLat: [16.1859, 58.58734],
    sweref99tm: [568943.8724, 6494712.5258],
    sweref991630: [131731.5185, 6496744.9864],
  },
  {
    name: 'Himmelstalund',
    lonLat: [16.14, 58.597],
    sweref99tm: [566257.3131, 6495741.7789],
    sweref991630: [129067.6976, 6497834.3878],
  },
  {
    name: 'Kolmården',
    lonLat: [16.429, 58.664],
    sweref99tm: [582893.8204, 6503522.2077],
    sweref991630: [145879.5692, 6505243.4829],
  },
  {
    name: 'Arkösund',
    lonLat: [16.9427, 58.4907],
    sweref99tm: [613246.4934, 6484980.4869],
    sweref991630: [175818.9197, 6486022.8402],
  },
];

describe('TK-02 transformationer mellan 4326 och SWEREF 99 TM', () => {
  for (const cp of CONTROL_POINTS) {
    it(`${cp.name}: 4326 → 3006 inom ${TOLERANCE_M} m`, () => {
      const [e, n] = toSweref99TM(cp.lonLat);
      expect(Math.abs(e - cp.sweref99tm[0])).toBeLessThanOrEqual(TOLERANCE_M);
      expect(Math.abs(n - cp.sweref99tm[1])).toBeLessThanOrEqual(TOLERANCE_M);
    });


    it(`${cp.name}: 3006 → 4326 → 3006 rundtur inom 0,001 m`, () => {
      const back = transformXY(toLonLat(cp.sweref99tm, EPSG_3006), 'EPSG:4326', EPSG_3006);
      expect(Math.abs(back[0] - cp.sweref99tm[0])).toBeLessThanOrEqual(0.001);
      expect(Math.abs(back[1] - cp.sweref99tm[1])).toBeLessThanOrEqual(0.001);
    });
  }
});
