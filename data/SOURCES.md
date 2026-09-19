# Datakällor, licenser och villkor

Kravspec §5, JK-01–JK-07. Varje lager som publiceras ska finnas här **innan** det går till produktion,
med licens, attribution, hämtdatum och villkor. Detta dokument är också underlag för `/kallor`-sidan.

Senast uppdaterad: 2026-09-19.

## Sammanfattning av läget (sprint 0)

| ID | Källa | Status 2026-09-19 | Konto/nyckel |
|---|---|---|---|
| DS-1 | Lantmäteriet, topografisk webbkarta | **Ej klar.** Produkten i kravspecen, *Topografisk webbkarta Visning, översiktlig*, **utgår 2026-12-31** enligt Lantmäteriets produktsida. Ersättare att välja: *Topografisk webbkarta Visning, cache* (WMTS, raster) eller *Topografi Visning, vector tiles*. | Geotorget-konto + behörighet per produkt + appkonto |
| DS-2 | Lantmäteriet, Ortofoto Visning | Ej klar. Finns i produktlistan. | Som ovan |
| DS-5 | HaV, Badplatsen API | **Verifierad.** Fungerar utan nyckel. 19 badplatser i kommunen (kommunkod 0581). | Inget konto. Användarvillkor ska läsas och sammanfattas här (JK-01). |
| DS-6 | SMHI, meteorologisk prognos | **Verifierad.** Det gamla API:et `pmp3g` är avvecklat (2026-03-31). Ersättaren `snow1g` v1 svarar utan nyckel. | Inget konto |
| DS-7 | OpenStreetMap | Används just nu bara som fallback-bakgrund (raster tiles). | Inget konto |
| DS-8–DS-12 | Wikidata, RAÄ, kommunen, SCB, egen kuratering | Ej påbörjade (sprint 2+). | — |

## Lager i lagerkonfigurationen

Fält enligt JK-01: `license`, `licenseUrl`, `attribution`, `retrieved`, `terms`.

### topowebb — Lantmäteriet, topografisk webbkarta (WMTS, EPSG:3006)

- **license:** Avgiftsfri produkt från Lantmäteriet; villkor accepteras i Geotorget vid behörighetsansökan.
- **licenseUrl:** _fylls i från Geotorget_
- **attribution:** `© Lantmäteriet` (Bilaga C)
- **retrieved:** live via proxy
- **terms:** _Sammanfattning av villkoren, inklusive om vidareförmedling via egen proxy är tillåten (JK-07), skrivs här när behörigheten är beviljad. Om villkoren förbjuder proxy-mönstret ska arkitekturen justeras före lansering._
- **Beslut som väntar:** vilken produkt som ersätter den utgående *översiktlig*-produkten (se ADR-09 när det är beslutat).

### ortofoto — Lantmäteriet, Ortofoto Visning (WMTS, EPSG:3006)

- Som ovan. URL-mall och lagernamn i `.env.example` är antaganden och ska verifieras mot Geotorgets tekniska beskrivning.

### osm — OpenStreetMap standard tiles (fallback, EPSG:3857)

- **license:** ODbL 1.0 (data), tile-bilderna enligt OSMF:s Tile Usage Policy
- **licenseUrl:** <https://www.openstreetmap.org/copyright>
- **attribution:** `© OpenStreetMap-bidragsgivare`
- **retrieved:** live; direkt i dev-läge, via proxy i produktion (CSP och integritet)
- **terms:** OSMF:s Tile Usage Policy kräver tydlig User-Agent och attribution och avråder från tung användning. Lagret används enbart som fallback när Lantmäteriet inte är tillgängligt. Ska på sikt ersättas av självhostade vektortiles (PMTiles, ADR-06) från ett Geofabrik-uttag.

## Havs- och vattenmyndigheten — Badplatsen API (DS-5)

Verifierat 2026-09-19, inga nycklar:

- `GET https://badplatsen.havochvatten.se/badplatsen/api/feature` — GeoJSON med alla badplatser i Sverige
  (2 638 st). Egenskaper: `NUTSKOD`, `NAMN`, `KMN_NAMN`. Filtrera på `NUTSKOD` som börjar med `SE0230581`
  (kommunkod 0581).
- `GET https://badplatsen.havochvatten.se/badplatsen/api/detail/{NUTSKOD}` — detaljer: `classification`,
  `classificationText`, `classificationYear`, `qualityRating[]` (per år), `testResult[]` (provsvar med
  `sampleDate`, `sampleText`, `ecoliValue`, `enteroValue`, `tempValue`, `algalText`), `dissuasion[]`
  (avrådan), `sampleTemperature`, `contactMail/Phone/Url`, `bathInformation`.

Badplatser i Norrköpings kommun per 2026-09-19 (19 st): Glan Skarsätter, Bråviken Lindöbadet, Bråviken
Kvarsebobadet, Ensjön Ensjöbadet, Slätbaken Stegeborgsgården, Mårn Mårängsbadet, Arkösund Nordanskogsbadet
Camping, Böksjön Böksjöbadet, Lilla Älgsjön, Lillsjöbadet, Bolen Bolenbadet, Sörsjöbadet, Nedre Glottern
Gransjönäsbadet, Ågelsjön, Arkösund Badholmarna, Arkösund Sköldvik, Dalbystrand, Inre hamn/Motala ström,
Inre hamnen plaskdammen. (Kravspec DK-06 nämner "ett tjugotal" — stämmer.)

**Att göra (JK-01):** läs och sammanfatta HaV:s användarvillkor för API:et här innan `/api/bad/status` går i produktion.

## SMHI — meteorologisk prognos (DS-6)

- Det API som kravspecens källista pekar på (`pmp3g` v2) svarar 404; SMHI avvecklade det 2026-03-31.
- Ersättare: `snow1g` v1, t.ex.
  `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/16.19/lat/58.59/data.json`
  (verifierad 2026-09-19, HTTP 200, ingen nyckel). Dokumentation: <https://opendata.smhi.se/metfcst/snow1gv1>.
- **license:** SMHI öppna data (CC BY 4.0 enligt SMHI:s villkor — verifiera och länka).
- **attribution:** `Källa: SMHI`

## Google Maps Platform — används inte (JK-05)

Inget innehåll från Google Maps Platform (Places, Geocoding, foton, betyg, koordinater, öppettider) får
kopieras in i projektets datafiler eller visas ovanpå Lantmäteriets karta. Googles Service Specific Terms
förbjuder både visning tillsammans med icke-Google-kartor och lagring längre än 30 dagar. Rankningen av
Topp 10 och Topp 3 bygger i stället på en egen, publicerad metodik (DK-05) med belägg från källor som får
återpubliceras. Geometri hämtas från OpenStreetMap, Lantmäteriets Ortnamn eller egen mätning; beskrivningar
från Wikidata/Wikipedia eller egen text.
