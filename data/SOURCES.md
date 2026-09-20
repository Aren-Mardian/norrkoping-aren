# Datakällor, licenser och villkor

Kravspec §5, JK-01–JK-07. Varje lager som publiceras ska finnas här **innan** det går till produktion,
med licens, attribution, hämtdatum och villkor. Sajtens sidfot ("Så hämtas informationen", ADR-13)
sammanfattar detta dokument för besökaren: per källa varifrån, hur (självhostad fil, statisk fil
eller live via `/api/...`) och hur färskt. Texterna ligger i `src/i18n/sv.ts`/`en.ts` under
`footer.src.*` — ändras en källa här ska de raderna följa med. Sidorna Om/Källor/Integritet länkar
till arenm.se.

Senast uppdaterad: 2026-09-20.

## Sammanfattning av läget

Senast uppdaterad 2026-09-19 efter genomgång av Geotorgets produktlista och beställningar.

| ID | Källa | Status | Konto/nyckel |
|---|---|---|---|
| DS-1 | Lantmäteriet, bakgrundskarta | **Ändrad plan.** Kravspecens produkt (*Topografisk webbkarta Visning, översiktlig*) utgår 2026-12-31 och de övriga visningstjänsterna kostar. Bakgrundskartan byggs i stället från **Topografisk webbkarta Nedladdning, raster** (avgiftsfri) → självhostad PMTiles. Se avsnittet Lantmäteriet nedan. | Geotorget-konto; nedladdning via öppen FTP (ingen inloggning) |
| DS-2 | Lantmäteriet, ortofoto | **Ändrad plan.** *Ortofoto Visning* (aktuellt) kostar. Flygbild = **Ortofoto historiska Visning** (1949–2005, CC0, WMS). | Appkonto för WMS (verifieras) |
| DS-3 | Lantmäteriet, höjddata | Beställd: *Markhöjdmodell Nedladdning* (1 m, COG via STAC) och *grid 50+* (CC0). | Appkonto för STAC-API |
| DS-4 | Lantmäteriet, ortnamn | Beställd: *Ortnamn Nedladdning, vektor* (GeoPackage via STAC). | Appkonto för STAC-API |
| — | Lantmäteriet, kommungräns | Beställd: *Kommun, Län och Rike Nedladdning* (GeoPackage via STAC). Ersätter den uppskattade bbox:en (FK-04, FK-05, DK-01). | Appkonto för STAC-API |
| DS-5 | HaV, Badplatsen API | **I drift.** `/api/bad/status` normaliserar 19 badplatser (kommunkod 0581); grunddata i `data/bad/badplatser.geojson`. API:et svarar intermittent 500 → omförsök + stale-cache. | Inget konto. |
| DS-6 | SMHI, meteorologisk prognos | **I drift.** `/api/vader` mot `snow1g` v1 (ersatte `pmp3g` 2026-03-31). | Inget konto |
| DS-7 | OpenStreetMap | Fallback-bakgrund (raster tiles). | Inget konto |
| DS-8–DS-12 | Wikidata, RAÄ, kommunen, SCB, egen kuratering | Ej påbörjade (sprint 2+). | — |

## Lantmäteriet — beställda produkter (Geotorget, 2026-09-19)

Alla nedan är **avgiftsfria** och utan juridisk prövning om inte annat anges. Villkorstexterna
ska sparas i `docs/villkor/` när de är hämtade från Geotorget (JK-01, JK-07).

| Produkt | Villkor | Åtkomst | Format | Åtkomstpunkt | Används till |
|---|---|---|---|---|---|
| Topografisk webbkarta Nedladdning, raster | **CC BY 4.0** — [villkor](../docs/villkor/topografisk-webbkarta-nedladdning-raster.md) | FTP, öppen | GeoPackage (tile-pyramid) | `ftp://download-opendata.lantmateriet.se/Topografisk_webbkarta_raster/` | Bakgrundskarta (FK-01, FK-02) |
| Topografisk webbkarta Visning, översiktlig | utgår 2026-12-31 | WMTS | PNG | via Geotorget (URL verifieras) | Live-bakgrund via proxy fram till årsskiftet; test av IK-01 |
| Kommun, Län och Rike Nedladdning | CC BY 4.0 (STAC-katalogen anger licensen) | STAC-API (katalog öppen; nedladdning kräver appkonto, Basic) | GeoPackage i zip, item `aktuell` (6 MB) | `https://api.lantmateriet.se/stac-vektor/v1/collections/kommun-lan-rike` | Kommungräns (FK-05), panoreringsspärr (FK-04), validering (DK-01) — `tools/lm_stac.py kommun` |
| Ortnamn Nedladdning, vektor | CC BY 4.0 | STAC-API (som ovan) | GeoPackage i zip, item `ortnamn_se` (58 MB) | `https://api.lantmateriet.se/stac-vektor/v1/collections/ortnamn` | Ortnamnssök (FK-32) — `tools/lm_stac.py ortnamn` |
| Ortofoto historiska Visning | **CC0** | WMS 1.1.1 | JPEG/PNG | `https://maps.lantmateriet.se/historiska-ortofoton/wms/v1?request=GetCapabilities&version=1.1.1&service=WMS` | Flygbild (FK-02), tidsresa (FK-38) |
| Markhöjdmodell Nedladdning | Användningsvillkor för värdefulla datamängder | STAC-API | COG (1 m) | `https://api.lantmateriet.se/stac-hojd/v1` | Hillshade (FK-39), höjd RH 2000 (NFK-14) |
| Markhöjdmodell Nedladdning, grid 50+ | **CC0** | Filnedladdning i Geotorget / API Geotorget Nedladdning | ASCII-grid | Rutor **64_5, 64_6, 65_5, 65_6** täcker kommunen | Grov terrängmodell, reserv |
| Markhöjd Direkt | Användningsvillkor för värdefulla datamängder | REST | JSON | `https://api.lantmateriet.se/distribution/produkter/markhojd/v1` | Höjd för punkt/linje (Bilaga D: höjdprofil) |
| Belägenhetsadress Nedladdning, vektor | Villkor för värdefulla datamängder **med personuppgifter**, **juridisk prövning** | STAC-API | GeoPackage | `https://api.lantmateriet.se/stac-vektor/v1` | Adressök (FK-32) — om prövningen godkänns; annars OSM |
| Ekonomiska kartan (1935–1978) | avgiftsfri, villkor verifieras | FTP, öppen | GeoTIFF, RT90 2,5 gon V, 5 × 5 km, 1 m/px | `ftp://download-opendata.lantmateriet.se/Ekonomiska_kartan/<storruta>/` | Historiskt kartlager (Bilaga D 7), C-krav |

**Ej beställda (kostar → bryter M4/NFK-27):** Topografisk webbkarta Visning (cache/skiktindelad),
Topografi Visning vector tiles, Ortofoto Visning (aktuellt), Ortofoto Visning Årsvisa, Markhöjdmodell Visning.

### Topografisk webbkarta Nedladdning, raster — vad som faktiskt levereras

Undersökt 2026-09-19 (anonym FTP, ingen inloggning krävs):

```
Topografisk_webbkarta_raster/
  Farg_05m_sweref/      6104864_234624.gpkg   163 GB   färg, EPSG:3006      <- den enda vi behöver
  Nedtonad_05m_sweref/  6104864_234624.gpkg   147 GB   gråskala, EPSG:3006  (eventuellt senare)
  Farg_05m_mercator/    1159000_7377433.gpkg  146 GB   Web Mercator          (används inte)
  Nedtonad_05m_mercator/                                                     (används inte)
```

- **En fil per variant, hela Sverige.** Kan inte laddas ned per kommun.
- Innehåll (läst på distans med GDAL): EPSG:3006, 0,5 m/px, 8 388 608 × 8 388 608 px, 256-px-rutor,
  14 nivåer (4096 → 0,5 m/px), origo (−1 200 000, 8 500 000). Det är **Lantmäteriets WMTS-matris
  "3006"**, identisk med `shared/geo/lmTileGrid.ts`. Utsnittet passar därför rakt in i kartkärnan.
- Servern tillåter byte-intervall (REST), men slumpmässig läsning över FTP är för långsam för ett helt
  kommunutsnitt (varje liten läsning = ny överföring). Sekventiell hastighet ~10 MB/s (parallellt ~13 MB/s):
  **hela filen tar ~4 h**. Beslut: ladda ned en gång till D:, klipp ut kommunen lokalt med
  `tools/extract_topowebb.py`, radera originalet.
- Uppskattad storlek på utsnittet (bbox + 25 km buffert): ≈ 150 MB t.o.m. 2 m/px, ≈ 600 MB t.o.m. 1 m/px,
  ≈ 2,3 GB t.o.m. 0,5 m/px. Plan: hela kommunen till 2 m/px + centralorten till 0,5 m/px; mäts när filen finns.

### Ekonomiska kartan — struktur

- Mappar per storruta (`8g`, `9g` …, 50 × 50 km i RT90), ~100 blad per storruta, ~60–75 MB per blad.
- Norrköpings kommun täcks av storrutorna **8f, 8g, 8h, 9f, 9g, 9h** — hela bbox:en är 272 blad ≈ 17 GB.
  Centrala Norrköping (Industrilandskapet) är 9 blad ≈ 0,56 GB. Välj med `tools/lm_ftp_ekonomiska.py`.
- `Bladindelningskartor/` innehåller index-PDF:er.

## Lager i lagerkonfigurationen

Fält enligt JK-01: `license`, `licenseUrl`, `attribution`, `retrieved`, `terms`.

### topowebb — Lantmäteriet, Topografisk webbkarta (EPSG:3006)

Två källor under övergångsperioden:

1. **Självhostad PMTiles** (`data/derived/topowebb-farg.pmtiles`, 251 MB, 32 448 rutor), utsnitt av *Topografisk webbkarta Nedladdning, raster*.
   - **license:** CC BY 4.0
   - **licenseUrl:** <https://creativecommons.org/licenses/by/4.0/> — villkorstext: [docs/villkor/topografisk-webbkarta-nedladdning-raster.md](../docs/villkor/topografisk-webbkarta-nedladdning-raster.md)
   - **attribution:** i kartan `© Lantmäteriet, CC BY 4.0` (licensen länkad); fullständig text enligt villkoren §3.1 i PMTiles-metadata (`attribution_full`) och på `/kallor`: *"Datakälla: Topografisk webbkarta Nedladdning, raster. © Lantmäteriet. Informationen har bearbetats (utsnitt över Norrköpings kommun, ompaketerad till PMTiles). CC BY 4.0 gäller för Topografisk webbkarta Nedladdning, raster."*
   - **retrieved:** FTP-filens datum 2026-06-22, nedladdad 2026-09-19; utsnitt genererat 2026-09-19 med `tools/extract_topowebb.py` (urval: kommungräns +25 km t.o.m. 16 m/px, +10 km vid 8 m/px, +3 km vid 4–2 m/px; centralorten till 1 m/px; innerstaden till 0,5 m/px)
   - **terms:** vidarepublicering från egen server tillåten (CC BY). Produkten kan innehålla personuppgifter (§4) — utsnittet är enbart kartbild; ingen personuppgiftsbehandling. Leverans till produktion enligt ADR-10 (GitHub Release + manifest med SHA-256).
2. **Live-WMTS via proxy** (*Topografisk webbkarta Visning, översiktlig*, utgår 2026-12-31) — endast fram till årsskiftet.
   - **terms:** _Sammanfattning skrivs här när behörigheten är beviljad (JK-07)._

### ortofoto — Lantmäteriet, Ortofoto historiska Visning (WMS, CC0)

- **license:** Creative Commons CC0
- **licenseUrl:** <https://creativecommons.org/publicdomain/zero/1.0/>
- **attribution:** `© Lantmäteriet` (Bilaga C)
- **retrieved:** live via proxy (WMS 1.1.1; lager och årtal väljs efter GetCapabilities)
- **terms:** CC0 — inga begränsningar; attribution ges ändå enligt Bilaga C. Aktuellt ortofoto (*Ortofoto Visning*) kostar och ingår inte.

### kommungrans — Norrköpings kommungräns (GeoJSON, EPSG:4326)

- **license:** ODbL 1.0 — `data/derived/LICENSE-ODbL`; filen bär `"license": "ODbL-1.0"` i sina egenskaper (JK-03)
- **licenseUrl:** <https://opendatacommons.org/licenses/odbl/1-0/>
- **attribution:** `© OpenStreetMap-bidragsgivare` (visas i kartan när lagret är tänt)
- **retrieved:** 2026-09-19 via Nominatim, OSM-relation 935447, förenklad ~5 m, 899 hörn, 20 kB (7 kB gzip)
- **terms:** interim tills Lantmäteriets *Kommun, Län och Rike* (CC BY 4.0) hämtats via STAC. Används till kommungränslagret (FK-05), panoreringsspärr (FK-04), datavalidering (DK-01) och till klippning av kartutsnittet. Lägesosäkerhet ~10 m. Reproduceras med `tools/kommungrans_osm.py`.

### osm — OpenStreetMap standard tiles (fallback, EPSG:3857)

- **license:** ODbL 1.0 (data), tile-bilderna enligt OSMF:s Tile Usage Policy
- **licenseUrl:** <https://www.openstreetmap.org/copyright>
- **attribution:** `© OpenStreetMap-bidragsgivare`
- **retrieved:** live; direkt i dev-läge, via proxy i produktion (CSP och integritet)
- **terms:** OSMF:s Tile Usage Policy kräver tydlig User-Agent och attribution och avråder från tung användning. Lagret används enbart som fallback när Lantmäteriet inte är tillgängligt. Ska på sikt ersättas av självhostade vektortiles (PMTiles, ADR-06) från ett Geofabrik-uttag.

## Programvara med attributionskrav

| Komponent | Version | Licens | Var | Attribution |
|---|---|---|---|---|
| OpenLayers | 10.x | BSD 2-clause | npm-beroende, bundlas | — (ingen synlig attribution krävs; nämns på `/om`) |
| Origo | 2.10.0 (commit 6f313a9) | BSD 2-clause | `public/vendor/origo-2.10.0/` med `LICENSE.txt` och `VERSION.json` | "Om verktygen" på Origo-sidan (`/origo/`); sidfoten |
| PMTiles (protomaps) | 4.x | BSD 3-clause | npm-beroende, bundlas | `/om` |
| proj4js | 2.x | MIT | npm-beroende, bundlas | `/om` |

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

**Villkor (JK-01):** HaV:s badplatsdata är öppna data (myndighetens API-sida: "API Badplatser och
badvatten", fritt att använda). Vi visar alltid källan ("Källa: Havs- och vattenmyndigheten", Bilaga C),
vidarebefordrar aldrig besökarens IP (proxy, NFK-23), anropar högst en gång i timmen (cache) och
visar statusens ålder (DK-04). Ingen personuppgift förekommer i datat. Kontaktuppgifterna
(`contactMail/Phone`) i API:et är myndighetsfunktioner, inte personer; vi publicerar bara URL:en.

**Kodvärden (verifierade 2026-09-20):** classification/qualityRating 1 utmärkt, 2 bra,
3 tillfredsställande, 4 dålig, 0 ej klassificerad, 6 ny badplats · sampleValue 1 tjänligt,
2 tjänligt med anmärkning, 3 otjänligt, 4 uppgift saknas · algalValue 3 blomning, 4 ingen,
5 uppgift saknas · dissuasion.type 1 otjänligt prov, 2 algblomning. **Ingen av kommunens 19
badplatser är EU-klassificerad** — klassificeringsdelen i Topp 3-viktningen är därför neutral (50).

## SMHI — meteorologisk prognos (DS-6)

- Det API som kravspecens källista pekar på (`pmp3g` v2) svarar 404; SMHI avvecklade det 2026-03-31.
- Ersättare: `snow1g` v1, t.ex.
  `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/16.19/lat/58.59/data.json`
  (verifierad 2026-09-19, HTTP 200, ingen nyckel). Dokumentation: <https://opendata.smhi.se/metfcst/snow1gv1>.
- **license:** SMHI:s öppna data, Creative Commons Erkännande 4.0 (CC BY 4.0) — <https://www.smhi.se/data/om-smhis-data/villkor-for-anvandning-av-smhis-oppna-data>
- **attribution:** `Källa: SMHI` + prognosens utgivningstid, visas i vädermodulen (FK-18)
- **retrieved:** live via `/api/vader` (30 min cache; koordinater avrundade till 2 decimaler, IK-03)

## Google Maps Platform — används inte (JK-05)

Inget innehåll från Google Maps Platform (Places, Geocoding, foton, betyg, koordinater, öppettider) får
kopieras in i projektets datafiler eller visas ovanpå Lantmäteriets karta. Googles Service Specific Terms
förbjuder både visning tillsammans med icke-Google-kartor och lagring längre än 30 dagar. Rankningen av
Topp 10 och Topp 3 bygger i stället på en egen, publicerad metodik (DK-05) med belägg från källor som får
återpubliceras. Geometri hämtas från OpenStreetMap, Lantmäteriets Ortnamn eller egen mätning; beskrivningar
från Wikidata/Wikipedia eller egen text.
