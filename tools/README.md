# tools/ — offline-bearbetning av geodata

Kravspec A3: tung bearbetning sker en gång, offline, och resultatet checkas in som statiska
artefakter under `data/derived/`. Verktygen här är Python-scripts i en egen virtuell miljö —
inget av detta hamnar i webbappen.

## Installation

```bash
python -m venv tools/.venv
tools/.venv/Scripts/python -m pip install -r tools/requirements.txt
```

(`tools/.venv/` är git-ignorerad.)

## Topografisk webbkarta → PMTiles

`extract_topowebb.py` klipper ut Norrköpings kommun ur Lantmäteriets GeoPackage
(`Farg_05m_sweref/6104864_234624.gpkg`, 163 GB, hela Sverige) till en PMTiles-fil.
Rutorna kopieras oförändrade; ingen GDAL behövs.

1. Ladda ned filen en gång till D: (återupptagbar):

   ```bash
   curl -C - -o D:/lantmateriet/6104864_234624.gpkg ftp://download-opendata.lantmateriet.se/Topografisk_webbkarta_raster/Farg_05m_sweref/6104864_234624.gpkg
   ```

2. Räkna först (skriver inget):

   ```bash
   tools/.venv/Scripts/python tools/extract_topowebb.py --gpkg D:/lantmateriet/6104864_234624.gpkg --out data/derived/topowebb-farg.pmtiles --zmax 11 --dry-run
   ```

3. Kör på riktigt (standardvärdena: kommungränsen +25/10/3 km per nivåintervall till 2 m/px,
   centralorten till 1 m/px, innerstaden till 0,5 m/px — ~250 MB, ~15 s):

   ```bash
   tools/.venv/Scripts/python tools/extract_topowebb.py --gpkg D:/lantmateriet/6104864_234624.gpkg --out data/derived/topowebb-farg.pmtiles
   ```

4. Uppdatera `data/derived/manifest.json` (sha256, bytes, URL) och publicera filen som release-artefakt (ADR-10).

PMTiles-nivå = LM-nivå + 2 (metadata `lm_zoom_offset`); se docstringen i scriptet.

## Kommungräns

`lm_stac.py kommun` hämtar Norrköpings kommungräns från Lantmäteriet (CC BY 4.0) till
`data/derived/kommungrans.geojson`. Den OSM-baserade interimsvägen (`kommungrans_osm.py`) togs bort
2026-09-23 när Lantmäteriets polygon var på plats — finns i git-historiken om den behövs igen.

## Origo (verktygsläget)

`build-origo.mjs` klonar en taggad Origo-version, bygger den med webpack och vendorerar exakt de
filer som behövs till `public/vendor/origo-<version>/` (+ sidrelativa bilder i `public/img/`, som Origo löser mot `<base href>`).
Node-script, ingen Python:

```bash
node tools/build-origo.mjs            # v2.10.0
node tools/build-origo.mjs v2.11.0    # annan tagg
```

Efter byte av version: uppdatera `ORIGO_VERSION` i `src/origo/origoConfig.ts` och sökvägarna i
`origo/index.html`, kör `npm run check`, och verifiera CSP:n (ADR-11).

## Ekonomiska kartan (historiska blad)

`lm_ftp_ekonomiska.py` väljer och hämtar bara de 5 × 5 km-blad som täcker ett område:

```bash
tools/.venv/Scripts/python tools/lm_ftp_ekonomiska.py --bbox 562000 6490000 576000 6500000 --dry-run
```

Hela kommunens bbox = 272 blad ≈ 17 GB; centrala Norrköping = 9 blad ≈ 0,56 GB.
Nedladdade blad hamnar i `data/raw/` (git-ignorerat) och bearbetas vidare till PMTiles i ett senare steg.

## kommun_polygon.py — kommungränsen som spärr

```bash
tools/.venv/Scripts/python tools/kommun_polygon.py   # → shared/geo/kommunPolygon.ts
```

Förenklar Lantmäteriets kommungräns till 222 hörn i EPSG:3006 och skriver den som en
TypeScript-modul med `pointInKommun()`. Används av `/api/hojd` och höjdverktyget för att avgöra
om en punkt är Norrköping — bbox:en duger inte, den rymmer fyra grannkommuner (ADR-16).
Kör om efter varje ny hämtning av kommungränsen. Filen är genererad och redigeras inte för hand.

## ortnamn_index.py — sökindex för ortnamn (FK-32)

```bash
tools/.venv/Scripts/python tools/lm_stac.py ortnamn     # 56 MB från Lantmäteriet → derived/ortnamn.geojson
tools/.venv/Scripts/python tools/ortnamn_index.py       # → data/sok/ortnamn.json (87 kB gzip)
```

Gör om GeoJSON-uttaget till det index klienten söker i: koordinater transformerade till EPSG:3006
och avrundade till hela meter (kartan renderar i samma system, så klienten slipper proj4), namntyper
som index i stället för koder, och punkter för samma namngivna objekt sammanslagna med enkellänkad
klustring inom 10 km — annars listas långsträckta objekt som Bråviken fem gånger i sökresultatet.

Mellanfilen `data/derived/ortnamn.geojson` är git-ignorerad och följer inte med bygget; det är
indexet i `data/sok/` som checkas in och levereras.
