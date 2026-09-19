# Referenssystem och transformationer

Kravspec §6.1, Bilaga B, NFK-12, NFK-13, TK-02, TK-03.

## Vilka system används till vad

| Användning | System | EPSG | Var i koden |
|---|---|---|---|
| Kartvisning och tile-matris | SWEREF 99 TM | 3006 | `src/map/createMap.ts` (View), `shared/geo/lmTileGrid.ts` |
| Lokalt kommunalt system (visning/inmatning) | SWEREF 99 16 30 | 3010 | `shared/geo/projDefs.ts` |
| Lagring i GeoJSON | WGS 84 | 4326 | `data/**/*.geojson` (lon, lat) |
| Längd- och areamätning | SWEREF 99 TM eller geodetiskt på GRS80 | 3006 / — | `shared/geo/measure.ts` |
| Fallback-bakgrund (raster, reprojiceras) | Web Mercator | 3857 | `src/map/basemaps.ts` |
| **Förbjudet för mätning** | Web Mercator | 3857 | `measureLength()` kastar `ProjectionNotMeasurableError` |

## proj4-definitioner

Källa: `shared/geo/projDefs.ts`. Definitionerna motsvarar EPSG-registret; `+towgs84=0,0,0,0,0,0,0`
uttrycker att SWEREF 99 realiserar ETRS89 och behandlas som identiskt med WGS 84 på den noggrannhetsnivå
som gäller här (skillnaden är i storleksordningen decimeter och växer ca 2–3 cm/år på grund av
plattdrift — irrelevant för kartvisning och mätning på meter-nivå).

```
EPSG:3006  +proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs
EPSG:3010  +proj=tmerc +lat_0=0 +lon_0=16.5 +k=1 +x_0=150000 +y_0=0
           +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs
```

**Att göra före produktion (NFK-13):** jämför mot Lantmäteriets officiella parametrar för SWEREF 99 TM
och SWEREF 99 16 30 och notera datum för kontrollen här.

## Kontrollpunkter (TK-02)

Referensvärdena är beräknade med PROJ via pyproj 3.6.1 (`Transformer.from_crs(..., always_xy=True)`),
alltså oberoende av proj4js som används i klienten. Testet `shared/geo/projDefs.test.ts` kräver
avvikelse ≤ 0,01 m.

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
| Planärt i EPSG:3010 | 1 000,004 m | +0,0004 % | ja |
| Planärt i EPSG:3857 | 1 913,973 m | **+91,4 %** | **nej — avvisas av koden** |

Testet `shared/geo/measure.test.ts` verifierar alla fyra raderna, inklusive att implementationen kastar
vid försök att mäta i 3857.

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

Panorering och tile-proxyn tillåter 25 km buffert utanför denna (FK-04, NFK-18). I Web Mercator
motsvarar 25 km på marken ca 48 km i kartenheter på den här latituden — det är skalfaktorn 1,92 igen.
