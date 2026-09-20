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

`kommungrans_osm.py` hämtar Norrköpings kommungräns från OpenStreetMap (Nominatim) till
`data/derived/kommungrans.geojson` (ODbL, incheckad). Interim tills Lantmäteriets polygon hämtas via STAC.

## Origo (verktygsläget)

`build-origo.mjs` klonar en taggad Origo-version, bygger den med webpack och vendorerar exakt de
filer som behövs till `public/vendor/origo-<version>/` (+ sidrelativa bilder i `public/origo/img/`).
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
