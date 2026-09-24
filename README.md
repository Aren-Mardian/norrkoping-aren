# Norrköpingskartan

En öppen, snabb och tillgänglig kartportal för Norrköpings kommuns invånare och besökare.
Kravspecifikation: [docs/kravspecifikation.md](docs/kravspecifikation.md) (KRAV-NKPG-001 v1.0).

> Ett oberoende projekt av Aren Mardian. **Inte** en officiell tjänst från Norrköpings kommun.

Målplattform: `https://arenm.se/projekt/norrkoping`

## Status

| Sprint | Milstolpe | Läge |
|---|---|---|
| 0 | Grund — repo, Vite+TS, CI, tile-proxy, CSP/headers, dev-läge utan token | **Klar** — i drift på Netlify. Headerledet är dock inte i mål, se driftnotisen nedan |
| 1 | Karta står — LM-bakgrund, växlare, kommungräns, startextent, skalstock | **Klar** — Lantmäteriets topografiska karta självhostad som PMTiles (ADR-09/10), **kommungräns från Lantmäteriet** (CC BY 4.0), växlare inkl. mörkt läge och **flygbild 1960/1975** (ADR-14), startextent, skalstock |
| 3 | Badplatser — HaV-integration, status, Topp 3, varningar, filter, SMHI | **Klar (första version)** — 19 badplatser, `/api/bad/status` (IK-02) med stale-cache, `/api/vader` (IK-03, SMHI snow1g), Topp 3 med viktningen förklarad på plats, avrådan som inte kan filtreras bort (DK-07), panel/bottom sheet i app-skal (UX-03, ADR-13). Återstår: faciliteter (kuratering), badindex (FK-19), tillgänglighetsfilter (FK-20) |
| 4 | Verktygsläge — mät, rita, koordinater, höjd, dela, utskrift, lager | **Klar** (ADR-11/12/15) — Origo laddas in i **samma karta** med knappen "Verktyg"; ingen egen sida längre. Gamla `/origo/`- och `/verktyg/`-länkar ger 301 till kartan |
| — | Lantmäteriets API:er — flygbild, höjd, ortnamn, kommungräns | **Klar** (ADR-14) — `/api/hojd` (Markhöjd Direkt), ortnamnssök, höjd som punktmätning i verktygsläget (ADR-16). Återstår: OGC-Features (appkontot saknar behörighet) |
| 2, 5–7 | Se kravspec §12 | Ej påbörjad. Om/Källor/Integritet är beslutade att ligga på arenm.se (ADR-13), inte som egna sidor här |

## Kom igång (under 10 minuter)

Kräver Node ≥ 22.12 (se `.nvmrc`).

```bash
npm install
npm run dev
```

Öppna <http://localhost:5173/projekt/norrkoping/>. Bakgrundskartan är Lantmäteriets topografiska
webbkarta som självhostad PMTiles-fil (`data/derived/topowebb-farg.pmtiles`, CC BY 4.0) — hela
kommunen i källans egen upplösning **0,5 m/px**, 665 MB (ADR-18). Den ligger
inte i git: `npm run build` (eller `npm run fetch:tiles`) hämtar den från GitHub Releases enligt
`data/derived/manifest.json` och verifierar SHA-256 ([ADR-10](docs/adr/ADR-10-leverans-av-stora-datafiler.md)).
Repot är publikt, så release-filen hämtas utan token (privat repo: se ADR-10).
Hur den skapas från Lantmäteriets 163-GB-fil står i [ADR-09](docs/adr/ADR-09-sjalvhostad-bakgrundskarta.md)
och [tools/README.md](tools/README.md). Saknas filen faller appen tillbaka på OpenStreetMap
(reprojicerad till SWEREF 99 TM) med en synlig utvecklingsbanner (FK-33). Utan `.env` saknas dessutom
flygbilden, som går via edge-proxyn.

### Edge-funktionerna lokalt

`npm run dev` kör även `netlify/functions/*.mts` (tile-proxy, badvattenstatus, väder) direkt i
Vites dev-server via [vite/devFunctions.ts](vite/devFunctions.ts) — ingen `netlify-cli` behövs
(ADR-12). `.env` läses in i `process.env` precis som på Netlify.

### Med Lantmäteriets appkonto (flygbild, kommungräns, ortnamn)

1. Kopiera `.env.example` till `.env` och fyll i `LM_USER`/`LM_PASSWORD` (appkonto från Geotorget)
   samt `VITE_LM_ENABLED=true`. `.env` är git-ignorerad och får aldrig checkas in.
   `LM_USER`/`LM_PASSWORD` läggs dessutom som miljövariabler i Netlify (Site configuration →
   Environment variables). `VITE_LM_ENABLED` behövs **bara lokalt**: i produktion finns proxyn
   alltid, och flygbilden avgörs vid körning i stället för vid bygget (ADR-16).
2. Flygbild = Lantmäteriets *Ortofoto historiska* (WMS, CC0) via proxyn `/api/tiles/histortho/…`.
   Lagernamnet (`LM_HISTORTHO_LAYER`) verifieras mot GetCapabilities, se `.env.example`.
3. `tools/.venv/Scripts/python tools/lm_stac.py` hämtar Lantmäteriets kommungräns och ortnamn via
   STAC-API:et och skriver `data/derived/kommungrans.geojson` och `ortnamn.geojson`;
   `tools/ortnamn_index.py` gör om det senare till sökindexet `data/sok/ortnamn.json`.
4. Höjd (`/api/hojd`) och flygbild (`/api/tiles/histortho60|histortho75`) går via edge-proxyn med
   samma appkonto. Vilka av Lantmäteriets sju API:er som används, och varför inte de övriga, står i
   [ADR-14](docs/adr/ADR-14-lantmateriets-api.md).

Proxyn är den enda platsen där Lantmäteriets uppgifter finns. Klientbundlen innehåller aldrig
en hemlighet — variabler med prefix `VITE_` är publika.

### Sök, höjd och flygbild

Sökrutan över kartan (båda sidorna) söker i 7 865 ortnamn inom kommunen — ett index härlett ur
Lantmäteriets *Ortnamn* med koordinater i EPSG:3006. Indexet (87 kB gzip) och sökmotorn laddas
med `import()` först när du fokuserar sökfältet, så landningsvyns kritiska väg är opåverkad (TK-05).
En vald plats visar koordinater i SWEREF 99 TM och markhöjd i RH 2000 från *Markhöjd Direkt*.
Med verktygen öppna ger knappen **Höjd** markhöjden där du klickar — ett klick, en höjd, nästa
klick nästa höjd (ADR-16). Klick utanför kommungränsen ger inget anrop alls.

### Badplatser

Grunddata: `data/bad/badplatser.geojson`, genererad av `tools/badplatser_hav.py` från HaV:s
Badplatsen-API (19 badplatser, kommunkod 0581) med Topp 3 enligt kravspecens viktning (DK-05) —
reproducerbart och dokumenterat i filens `top3Method`. Dynamisk status: `/api/bad/status`
(normaliserad i `netlify/lib/hav.ts`, cachad 1 h, stale-svar vid uppströmsfel). Väder:
`/api/vader?lat&lon` (SMHI snow1g, koordinater avrundade till 2 decimaler).

### Verktygsläget (Origo i samma karta)

Knappen **Verktyg** över kartan laddar
[Origo](https://github.com/origo-map/origo) 2.10.0 (BSD 2-clause) från `public/vendor/origo-2.10.0/`
och monterar den i samma kartruta, med samma vy och samma badplatser (ADR-15).
Origo finns inte på npm; bundlen byggs reproducerbart med `node tools/build-origo.mjs` och checkas in
(2,7 MB, med `VERSION.json`). Sidans kritiska väg laddar aldrig Origo — den hämtas först vid klick,
och `npm run check:budget` bevakar båda delarna (TK-05). Detaljer i
[ADR-11](docs/adr/ADR-11-origo-verktygslage.md) och [ADR-15](docs/adr/ADR-15-en-karta-en-sida.md).

### Layout och sidfot (ADR-13)

Sidan är ett app-skal: topbar, karta + panel och sidfot fyller exakt vyporten och dokumentet
scrollar aldrig — bara panelens innehåll. På mobil är panelen en bottom sheet (peek/half/full)
och sidfoten flyttas in sist i sheeten. Sidfoten anger för varje uppgift **varifrån** den kommer,
**hur** den hämtas (självhostad fil, statisk fil eller live via `/api/...` genom proxyn) och
**hur färsk** den är; kartutsnittets datum injiceras från `data/derived/manifest.json` vid bygge.
Menyn har två poster: **Karta** och **Om** (arenm.se). `Källor och licenser` och `Integritet` i
sidfoten går också till arenm.se. Okända adresser ger 404.

**Driftnotis (uppdaterad 2026-09-24):** Netlify svarar fortfarande med headers från repots
*allra första* commit. Mätt mot den publicerade sajten:

| | `_headers` säger | Sajten svarar |
|---|---|---|
| `/assets/<hash>.js` | `max-age=31536000, immutable` | `no-cache` |
| `data/…pmtiles` (665 MB) | `max-age=86400, stale-while-revalidate` | `no-cache` |
| CSP | `frame-ancestors 'none'` | hela första commitens policy, ordagrant |

Omdirigeringarna från `_redirects` slår däremot igenom (`/verktyg` → 301, okänd adress → 404), så
det är bara headerledet som är fast. Konsekvensen är inte bara cache: webbläsaren tillämpar
**snittet** av header-CSP:n och sidans meta-CSP, och den gamla headern har `style-src 'self'`.
Sidans egen policy tillåter `'unsafe-inline'` för att Origo bygger paneler med style-attribut — i
snittet faller det bort, och verktygsläget ger **403 konsolfel** av typen *"Applying inline style
violates ... 'style-src 'self''"*. Det är också grundorsaken till att Origos sprite-behållare tappar
sin `display:none` och lägger sig som tomma rutor över kartan; `markSprites()` i
[src/origo/tools.ts](src/origo/tools.ts) är en motåtgärd, inte en lösning.

Sedan 2026-09-24 ligger headerreglerna därför i **både** `netlify.toml` och `_headers` (netlify.toml
vinner vid konflikt, så läses den nya filen vinner rätt värden), och `netlify.toml` bär markören
`X-Config-Source: toml-2026-09-24`. Efter nästa deploy:

```bash
curl -sI https://norrkoping.netlify.app/projekt/norrkoping/assets/ | grep -iE "x-config-source|cache-control"
```

- **Markören syns + `immutable`** → löst. Ta bort markören ur `netlify.toml` och notera det här.
- **Markören syns inte** → konfigurationen är fastfrusen. Kör "Clear cache and deploy site" i
  Netlify; hjälper inte det heller, skapa om sajten från repot (och lägg tillbaka `LM_USER` och
  `LM_PASSWORD`). Kontrollera samtidigt att deployens sammanfattning rapporterar **10 redirect- och
  4 headerregler**.

Sajten fungerar under tiden (ADR-16). `netlify/rules.test.ts` ser till att de två
uppsättningarna inte glider isär.

## Kommandon

| Kommando | Vad |
|---|---|
| `npm run dev` | Vite dev-server inkl. edge-funktionerna (ADR-12) |
| `npm run build` | Hämtar kartdata enligt manifestet, sedan produktionsbygge till `dist/projekt/norrkoping/` |
| `npm run fetch:tiles` | Bara nedladdning/verifiering av kartdata (ADR-10) |
| `npm run typecheck` | `tsc --noEmit` i strikt läge för klient och funktioner (NFK-29) |
| `npm test` | Vitest: geodetiska tester (TK-02, TK-03) och proxyns spärrar (NFK-18) |
| `npm run check:budget` | Bundlebudget (NFK-02) och Origo-isolering (TK-05) mot `dist/` |
| `npm run scan:secrets` | gitleaks på git-historiken och på `dist/` (TK-06); kräver `gitleaks` i PATH. Regler i `.gitleaks.toml` |
| `npm run check` | Allt ovan i följd — samma som CI |

## Säkerhet i CI

Två jobb på varje push (`.github/workflows/ci.yml`): typkontroll → tester → bygge → bundlebudget →
gitleaks på byggutdatan, samt gitleaks på hela git-historiken. Reglerna i [.gitleaks.toml](.gitleaks.toml)
är gitleaks standard plus undantag för kompilerad/minifierad kod (vendorerad Origo/OpenLayers och Vites
hashade chunkar) — där matchar OpenLayers interna cache-nycklar (`textKey_` …) regeln `generic-api-key`
av en slump. Egen kod, konfiguration, data och dokumentation skannas fullt ut. Hemligheter finns aldrig i
repot: `.env` är git-ignorerad, appkonton ligger bara i Netlifys miljövariabler och når enbart edge-funktionerna.

## Struktur

```
index.html              Sidans skal: karta, panel, sidfot (UX-01, JK-04, ADR-15)
src/                    Klient (Vite + TypeScript, vanilla)
  config/site.ts        BASE, API_BASE, LM_ENABLED — allt publikt
  geo/olProjections.ts  Registrerar EPSG:3006 i OpenLayers
  i18n/                 Svensk textkatalog utan runtime-bibliotek (ADR-15)
  bad/                  Badplatser: datamodell, kartlager, panel (Kärnfunktion B)
  lm/                   Lantmäteriets tjänster i klienten (höjd via /api/hojd)
  sok/                  Ortnamnssök: sökruta (kritisk väg) + motor och index (lazy, FK-32)
  map/                  Kartkärna, bakgrundskartor med fallback, PMTiles-läsare/-källa, egna kontroller
  net/                  fetch med timeout/omförsök (IK-06, IK-07)
  origo/                Origo-konfiguration, lazy bootstrap och höjdverktyg (ADR-11/15)
  ui/                   Banners, bottom sheet, panelens in-/utfällning, verktygsväxlaren (ADR-13/15)
shared/                 Ren logik utan DOM/OL — delas av klient, edge och test
  geo/crs.ts            SWEREF 99 TM-definitionen och utbredningen (ren data, inga beroenden);
                        WGS 84 och 3857 finns bara som dataformat respektive spärr (ADR-18)
  geo/projDefs.ts       proj4-registrering och transformationer (Bilaga B.5)
  geo/lmTileGrid.ts     Lantmäteriets 3006-matris
  geo/planar.ts         Planär längd + vitlistan över mätbara projektioner (utan beroenden)
  geo/measure.ts        Längdmätning planärt i 3006 eller geodetiskt, aldrig 3857 (NFK-12)
  geo/kommun.ts         Kommunkod, bbox, panoreringsbuffert (5 km)
  geo/kommunPolygon.ts  Kommungränsen som förenklad polygon + pointInKommun (genererad)
  api/errors.ts         Enhetlig felmodell (IK-04)
netlify/functions/      Edge-funktioner (Netlify Functions 2.0)
  tiles.mts             IK-01 tile-proxy (flygbild 1960/1975 via WMS, OSM-fallback)
  hojd.mts              IK-08 markhöjd (Markhöjd Direkt, en punkt per anrop)
  bad-status.mts        IK-02 badvattenstatus (HaV)
  vader.mts             IK-03 väder (SMHI)
netlify/rules.ts        Omdirigeringar och headers — skrivs som _redirects/_headers vid bygget (ADR-17)
netlify/lib/            Testbar logik för funktionerna (hav.ts, smhi.ts, tilesGuard.ts, hojd.ts, upstream.ts)
vite/                   Vite-plugin som kör edge-funktionerna i dev
data/                   Kuraterad geodata (GeoJSON, EPSG:4326), SOURCES.md, derived/ (PMTiles, ej i git)
public/vendor/          Vendorerade bibliotek (Origo, versionerad sökväg)
docs/                   Kravspec, referenssystem, villkor, ADR-09–18, deploy/ (IIS-mall)
scripts/                Byggkontroller, hämtning av kartdata
tools/                  Offline-bearbetning (Python): GeoPackage → PMTiles, FTP-urval; Origo-bygge
```

## Arkitektur i korthet

Statisk sajt + edge-funktioner (ADR-01). **En sida med en karta** (ADR-15), renderad av OpenLayers i
**SWEREF 99 TM (EPSG:3006)** — sajtens enda referenssystem (ADR-18). Gränssnittet är enspråkigt svenskt.
WGS 84 förekommer bara som dataformat (GeoJSON in och ut, SMHI:s API) och visas aldrig.
Bakgrundskartan är ett självhostat PMTiles-utsnitt av Lantmäteriets topografiska webbkarta (ADR-09) —
inga anrop till Lantmäteriet från besökaren. Flygbild och live-tjänster går via en tile-proxy med
Origin-lås, zoom- och bbox-spärr (ADR-04, NFK-18). Verktygsläget (Origo) laddas in i samma kartruta
på begäran (ADR-15) och hamnar aldrig i sidans kritiska väg — `npm run check:budget` bevakar det (TK-05).

Se [docs/referenssystem.md](docs/referenssystem.md) för geodetiken och
[data/SOURCES.md](data/SOURCES.md) för datakällor, licenser och villkor.

## Licens

Kod: MIT, se [LICENSE](LICENSE). Vendorerad Origo under `public/vendor/origo-2.10.0/` är BSD 2-clause.
Data har egna licenser per källa, se [data/SOURCES.md](data/SOURCES.md). Kuraterat innehåll och
rankning © Aren Mardian. Hur man bidrar: [CONTRIBUTING.md](CONTRIBUTING.md).
