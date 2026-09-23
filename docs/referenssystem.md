# Referenssystem och transformationer

Kravspec §6.1, Bilaga B, NFK-12, NFK-13, TK-02, TK-03.

## Vilka system används till vad

**Sajten har ett enda referenssystem: SWEREF 99 TM (EPSG:3006)** (ADR-18). Allt besökaren ser —
kartan, koordinatavläsningen, mätningen, höjdpunkterna — är i det systemet. SWEREF 99 16 30 (3010)
togs bort 2026-09-23; WGS 84 finns kvar enbart som *dataformat* och visas aldrig.

| Användning | System | EPSG | Var i koden |
|---|---|---|---|
| Kartvisning, tile-matris, koordinatavläsning, mätning | SWEREF 99 TM | 3006 | `src/map/createMap.ts` (View), `shared/geo/lmTileGrid.ts`, `src/origo/origoConfig.ts` |
| Inkommande data i GeoJSON (RFC 7946 kräver det) | WGS 84 | 4326 | `data/**/*.geojson` (lon, lat) |
| Punktprognos från SMHI (API:et tar lat/lon) | WGS 84 | 4326 | `netlify/functions/vader.mts` |
| Export av ritade objekt (RFC 7946 kräver det) | WGS 84 | 4326 | Origos draw-kontroll |
| Referensmetod för längd | Geodetiskt på GRS80 (Vincenty) | — | `shared/geo/measure.ts` |
| Fallback-bakgrund (raster, reprojiceras) | Web Mercator | 3857 | `src/map/basemaps.ts` |
| **Förbjudet för mätning** | Web Mercator | 3857 | `measureLength()` kastar `ProjectionNotMeasurableError` |

## proj4-definitioner

Källa: `shared/geo/projDefs.ts`. Definitionerna motsvarar EPSG-registret; `+towgs84=0,0,0,0,0,0,0`
uttrycker att SWEREF 99 realiserar ETRS89 och behandlas som identiskt med WGS 84 på den noggrannhetsnivå
som gäller här (skillnaden är i storleksordningen decimeter och växer ca 2–3 cm/år på grund av
plattdrift — irrelevant för kartvisning och mätning på meter-nivå).

```
EPSG:3006  +proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs
```

Samma sträng används av klienten och av Origos inbyggda proj4 (`proj4Defs` i `origoConfig.ts`), så
koordinater kan inte skilja sig åt mellan kartan och verktygen (NFK-13).

**Att göra före produktion (NFK-13):** jämför mot Lantmäteriets officiella parametrar för
SWEREF 99 TM och notera datum för kontrollen här.

## Kontrollpunkter (TK-02)

Referensvärdena är beräknade med PROJ via pyproj 3.6.1 (`Transformer.from_crs(..., always_xy=True)`),
alltså oberoende av proj4js som används i klienten. Testet `shared/geo/projDefs.test.ts` kräver
avvikelse ≤ 0,01 m.

Kolumnen för SWEREF 99 16 30 står kvar som underlag för analysen nedan; systemet erbjuds inte
längre i gränssnittet (ADR-18) och testas inte.

| Punkt | WGS 84 (lon, lat) | SWEREF 99 TM (E, N) | SWEREF 99 16 30 (E, N) |
|---|---|---|---|
| Norrköping centrum (Bilaga B.2) | 16,18590, 58,58734 | 568 943,872, 6 494 712,526 | 131 731,519, 6 496 744,986 |
| Himmelstalund | 16,1400, 58,5970 | 566 257,313, 6 495 741,779 | 129 067,698, 6 497 834,388 |
| Kolmården | 16,4290, 58,6640 | 582 893,820, 6 503 522,208 | 145 879,569, 6 505 243,483 |
| Arkösund | 16,9427, 58,4907 | 613 246,493, 6 484 980,487 | 175 818,920, 6 486 022,840 |

Kravspecens avrundade värden (568 944 / 6 494 713 och 131 732 / 6 496 745) stämmer.

## Kontrollsträcka (TK-03)

En sträcka som är exakt 1 000,000 m geodetiskt (GRS80, `Geod.fwd` rakt österut från referenspunkten)
slutar i 16,20309351° Ö, 58,58733885° N. Så här lång blir den beräknad på olika sätt:

| Metod | Resultat | Avvikelse | Godkänd? |
|---|---|---|---|
| Geodetiskt (Vincenty, GRS80) | 1 000,000 m | referens | ja |
| Planärt i EPSG:3006 | 999,659 m | −0,034 % | ja |
| Planärt i EPSG:3010 | 1 000,004 m | +0,0004 % | ~~ja~~ — systemet erbjuds inte längre (ADR-18) |
| Planärt i EPSG:3857 | 1 913,973 m | **+91,4 %** | **nej — avvisas av koden** |

Tabellen är skälet till att SWEREF 99 TM räcker som enda system: −0,034 % på en kilometer är
0,34 meter, långt under TK-03:s ±5 m. Testet `shared/geo/measure.test.ts` verifierar de rader som
fortfarande gäller, inklusive att implementationen kastar vid försök att mäta i 3857.

## Mätning i verktygsläget (Origo)

Origos mätkontroll använder `ol/sphere` (`getLength`/`getArea` med kartans projektion): koordinaterna
transformeras från EPSG:3006 till lon/lat och avståndet beräknas geodetiskt på en sfär med
R = 6 371 008,8 m — aldrig planärt i Web Mercator (NFK-12). Skillnaden mot GRS80-ellipsoiden är på
Norrköpings latitud som störst ≈ 0,35 % (öst–västliga sträckor; krökningsradien i primvertikalen är
≈ 6 393 km) och ≈ 0,12 % för nord–sydliga. Det ligger inom TK-03:s krav (1 000 ± 5 m), men vår egen
`shared/geo/measure.ts` (Vincenty på GRS80) är referensen om skillnaden någon gång blir avgörande.

Koordinatavläsningen i Origo (position-kontrollen) visar sedan 2026-09-23 enbart SWEREF 99 TM
(ADR-18) och använder samma proj4-sträng som klienten, så kartan och verktygen kan inte visa olika
koordinater för samma punkt.

## Lantmäteriets tile-matris "3006"

Antaganden i `shared/geo/lmTileGrid.ts`, att verifiera mot GetCapabilities när Geotorget-behörigheten
finns:

- Utbredning: −1 200 000, 4 700 000 → 2 600 000, 8 500 000
- Origo: övre vänstra hörnet (−1 200 000, 8 500 000)
- Rutstorlek: 256 px
- 16 nivåer, upplösning 4096 / 2^z m/px (nivå 0 = 4 096 m/px, nivå 15 = 0,125 m/px)

## Kommunens bounding box

Från kravspec Bilaga B.3 (ungefärlig; ska ersättas av verklig kommungränsgeometri i sprint 1):

| System | Min | Max |
|---|---|---|
| WGS 84 | 15,55° Ö, 58,28° N | 17,05° Ö, 58,92° N |
| SWEREF 99 TM | 532 256, 6 460 016 | 618 039, 6 532 953 |
| Web Mercator | 1 731 018, 8 026 368 | 1 897 998, 8 163 116 |

Panorering och tile-proxyn tillåter 5 km buffert utanför denna (FK-04, NFK-18; sänkt från 25 km
2026-09-23, ADR-16 — sajten hämtar ingen information om andra kommuner). I Web Mercator motsvarar
5 km på marken ca 9,6 km i kartenheter på den här latituden — det är skalfaktorn 1,92 igen.
