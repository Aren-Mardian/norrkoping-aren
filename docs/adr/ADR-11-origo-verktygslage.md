# ADR-11 — Origo som verktygsläge på egen sida

**Status:** Beslutad 2026-09-19. Realiserar kravspec Kärnfunktion C (FK-22–FK-31).
**Delvis ersatt av [ADR-15](ADR-15-en-karta-en-sida.md) (2026-09-23):** Origo har ingen egen sida
längre utan laddas in i samma karta på begäran. Punkt 1 och 4–7 nedan gäller oförändrat; punkt 2–3
(egen HTML-sida, egen Vite-entry, förhämtning från menyn) är ersatta.

## Kontext

Kravspecen kräver ett Origo-baserat verktygsläge — mätning, ritning, koordinatavläsning, utskrift,
delning och lagerhantering — som inte får belasta landningsvyn (TK-05, NFK-02: Origo-chunk ≤ 900 kB
gzip, lazy). Vid integrationen visade sig tre saker:

1. **Origo finns inte på npm** och GitHub-releaserna innehåller bara källkod. Bygget kräver
   webpack med ~660 paket och tar minuter — inget man vill ha i varje Netlify-deploy.
2. **Origo bygger sina paneler med `style="…"`-attribut** (63 st i bundlen) och lägger alltid till ett
   `<base>`-element. Det kolliderar med sajtens strikta CSP (`style-src 'self'`, `base-uri 'none'`, NFK-16).
3. **Origos XYZ-lager tar bara en URL.** Vår bakgrundskarta är en PMTiles-fil som läses med
   Range-requests (ADR-09) — ingen tile-URL finns.

Origo bundlar sin egen OpenLayers och proj4. Mätning sker med `ol/sphere` (geodetiskt på sfär), aldrig
planärt i Web Mercator — förenligt med NFK-12.

## Beslut

1. **Origo vendoreras som färdigbyggd artefakt** i `public/vendor/origo-<version>/` (2,7 MB: `origo.min.js`,
   CSS, SVG-sprites, norrpil) plus sidrelativa bilder i `public/origo/img/`. Bygget är reproducerbart
   med `tools/build-origo.mjs` (klonar taggen, `npm ci`, `npm run build`, kopierar exakt de filer bundlen
   refererar) och dokumenterat i `VERSION.json` (version, commit, licens, byggdatum). Versionen ligger i
   sökvägen → filerna kan cachas i 30 dagar som `immutable`. BSD 2-clause-licensen följer med.
2. **Verktygsläget är en egen HTML-sida** (`origo/index.html` → `/projekt/norrkoping/origo/`; hette
   `/verktyg/` t.o.m. 2026-09-20, 301-redirect finns kvar — sidan heter "Origo" i menyn så att det
   är tydligt vad den är) med egen
   Vite-entry. Landningsvyn importerar inget härifrån; `npm run check:budget` verifierar att `index.html`
   inte refererar Origo (TK-05) och att verktygssidans kritiska väg håller 900 kB (mätt: 778 kB gzip,
   varav Origo 764; Netlify skickar brotli ≈ 590 kB).
3. **Origo laddas som klassiskt script** (`window.Origo`) från egen origin, med `<link rel="preload">`
   så att hämtningen startar parallellt med vår modulkod. Landningsvyn **förhämtar** scriptet först när
   användaren visar avsikt (pointerenter/focus/touchstart på "Verktyg"-länken) — aldrig annars (NFK-34).
4. **Konfigurationen är ett TypeScript-objekt** (`src/origo/origoConfig.ts`) byggt från samma
   konstanter som landningsvyn: EPSG:3006 med proj4-definitioner för 3006/3010 (`shared/geo/crs.ts`),
   Lantmäteriets upplösningar och tile-matris, kommunens utbredning och panoreringsspärr.
   `defaultControls: []` — annars dubblerar Origo sina standardkontroller.
5. **Bakgrundskartan kopplas in efter `load`**: Origos XYZ-lager skapas med tom URL och
   `transition: 0`; sedan byts `tileUrlFunction`/`tileLoadFunction` mot PMTiles-läsaren
   (`src/map/pmtilesLoader.ts`, ramverksoberoende — samma kod som landningsvyn) och en omritning
   triggas per laddad ruta. Utan `transition: 0` fastnar rutorna i intoningen när
   `requestAnimationFrame` är strypt.
6. **CSP relaxas enbart för verktygssidan**: `style-src 'self' 'unsafe-inline'` och `base-uri 'self'`.
   `script-src 'self'` förblir strikt överallt — Origos `eval` finns bara i stilfilter vi inte
   använder, och webpacks `new Function` faller tillbaka på `window`. *Hur* policyn levereras per sida
   ändrades i ADR-12 (meta i stället för Netlify-header, eftersom Netlify inte tillämpar
   sökvägsspecifika headers förutsägbart).
7. **Kontroller enligt kravspec:** measure (längd, area, buffert, delsträckor, snappning — FK-23/24/25),
   position (3006, 3010, WGS 84 decimalgrader och DMS — FK-26), draw med nedladdning som GeoJSON i
   WGS 84 (FK-27), sharemap (FK-28), print med skalstock/norrpil/titel/attribution (FK-29), legend med
   `abstract` per lager: källa, licens, aktualitet (FK-30), draganddrop för GeoJSON/GPX/KML som läses
   lokalt (FK-31), geoposition (FK-06), home/zoom/scaleline/attribution/fullscreen, about (licenser +
   friskrivning JK-04) och länk tillbaka.

## Konsekvenser

- **Prestanda:** landningsvyn oförändrad (150 kB gzip). Verktygssidan 778 kB gzip, laddas bara på
  begäran; ett besök drar dessutom bara de kartrutor som syns (Range-requests mot samma fil).
- **Underhåll:** ny Origo-version = kör `tools/build-origo.mjs vX.Y.Z`, uppdatera `ORIGO_VERSION` i
  `origoConfig.ts` och sökvägen i `origo/index.html`, verifiera CSP med den lokala testservern.
- **Geodesi:** Origos mätning använder sfärisk geodesi (R = 6 371 008,8 m). På Norrköpings latitud
  avviker det ≤ 0,35 % från GRS80-ellipsoiden — inom TK-03 (0,5 %). Se docs/referenssystem.md.
- **Noll konsolfel** under produktions-CSP på båda sidorna (verifierat med `scripts`-fri lokal server
  som speglar netlify.toml).
- **Mörkt läge på landningsvyn** (FK-02/FK-36) löstes samtidigt: samma PMTiles-lager med ett
  GPU-kompositerat CSS-filter (`invert` + `hue-rotate`) i stället för en tom svart yta — inga extra rutor.

## Alternativ som valdes bort

| Alternativ | Varför inte |
|---|---|
| Bygga Origo i Netlify-bygget (git-beroende + webpack) | Minuter per deploy, 660 paket, skör kedja |
| Eget mätverktyg på OpenLayers (kravspecens reservplan R6) | Origo är uttryckligen efterfrågat (ADR-02) och ger tio kontroller för priset av en |
| Tillåta 'unsafe-inline' globalt | Onödig försvagning av landningsvyn; per-sökväg räcker |
| Service worker som exponerar PMTiles som tile-URL:er | Fungerar inte förrän SW är registrerad; skör vid första besök |
