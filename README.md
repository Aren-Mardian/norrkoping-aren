# Norrköpingskartan

En öppen, snabb och tillgänglig kartportal för Norrköpings kommuns invånare och besökare.
Kravspecifikation: [docs/kravspecifikation.md](docs/kravspecifikation.md) (KRAV-NKPG-001 v1.0).

> Ett oberoende projekt av Aren Mardian. **Inte** en officiell tjänst från Norrköpings kommun.

Målplattform: `https://arenm.se/projekt/norrkoping`

## Status

| Sprint | Milstolpe | Läge |
|---|---|---|
| 0 | Grund — repo, Vite+TS, CI, tile-proxy, CSP/headers, dev-läge utan token | **Klar lokalt** — väntar på Netlify-sajt (användaren) |
| 1 | Karta står — LM-bakgrund, växlare, kommungräns, startextent, skalstock | **Nästan klar** — Lantmäteriets topografiska karta självhostad som PMTiles (ADR-09/10), kommungräns (OSM tills LM:s finns), växlare inkl. mörkt läge, startextent, skalstock. Återstår: flygbild (historiska ortofoton, kräver appkonto) |
| 3 | Badplatser — HaV-integration, status, Topp 3, varningar, filter, SMHI | **Klar (första version)** — 19 badplatser, `/api/bad/status` (IK-02) med stale-cache, `/api/vader` (IK-03, SMHI snow1g), Topp 3 med viktningen förklarad på plats, avrådan som inte kan filtreras bort (DK-07), panel/bottom sheet i app-skal (UX-03, ADR-13), språkväxlare. Återstår: faciliteter (kuratering), badindex (FK-19), tillgänglighetsfilter (FK-20) |
| 4 | Verktygsläge — Origo på egen route: mät, rita, koordinater, dela, utskrift, lager | **Klar** (ADR-11/12) — `/verktyg/`, Origo 2.10.0 vendorerad, PMTiles-bakgrund, CSP per sida. Återstår: höjdmätning (Markhöjd Direkt) |
| 2, 5–7 | Se kravspec §12 | Ej påbörjad. Om/Källor/Integritet är beslutade att ligga på arenm.se (ADR-13), inte som egna sidor här |

## Kom igång (under 10 minuter)

Kräver Node ≥ 22.12 (se `.nvmrc`).

```bash
npm install
npm run dev
```

Öppna <http://localhost:5173/projekt/norrkoping/>. Bakgrundskartan är Lantmäteriets topografiska
webbkarta som självhostad PMTiles-fil (`data/derived/topowebb-farg.pmtiles`, CC BY 4.0). Den ligger
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
   samt `VITE_LM_ENABLED=true`. `.env` är git-ignorerad och får aldrig checkas in. Samma värden läggs
   som miljövariabler i Netlify (Site configuration → Environment variables).
2. Flygbild = Lantmäteriets *Ortofoto historiska* (WMS, CC0) via proxyn `/api/tiles/histortho/…`.
   Lagernamnet (`LM_HISTORTHO_LAYER`) verifieras mot GetCapabilities, se `.env.example`.
3. `tools/.venv/Scripts/python tools/lm_stac.py` hämtar Lantmäteriets kommungräns och ortnamn via
   STAC-API:et och skriver `data/derived/kommungrans.geojson` (ersätter OSM) och `ortnamn.geojson`.

Proxyn är den enda platsen där Lantmäteriets uppgifter finns. Klientbundlen innehåller aldrig
en hemlighet — variabler med prefix `VITE_` är publika.

### Badplatser

Grunddata: `data/bad/badplatser.geojson`, genererad av `tools/badplatser_hav.py` från HaV:s
Badplatsen-API (19 badplatser, kommunkod 0581) med Topp 3 enligt kravspecens viktning (DK-05) —
reproducerbart och dokumenterat i filens `top3Method`. Dynamisk status: `/api/bad/status`
(normaliserad i `netlify/lib/hav.ts`, cachad 1 h, stale-svar vid uppströmsfel). Väder:
`/api/vader?lat&lon` (SMHI snow1g, koordinater avrundade till 2 decimaler).

### Verktygsläget (Origo)

<http://localhost:5173/projekt/norrkoping/verktyg/> — en egen sida som laddar
[Origo](https://github.com/origo-map/origo) 2.10.0 (BSD 2-clause) från `public/vendor/origo-2.10.0/`.
Origo finns inte på npm; bundlen byggs reproducerbart med `node tools/build-origo.mjs` och checkas in
(2,7 MB, med `VERSION.json`). Landningsvyn laddar aldrig Origo — `npm run check:budget` bevakar det
(TK-05). Detaljer i [ADR-11](docs/adr/ADR-11-origo-verktygslage.md).

### Layout och sidfot (ADR-13)

Sidan är ett app-skal: topbar, karta + panel och sidfot fyller exakt vyporten och dokumentet
scrollar aldrig — bara panelens innehåll. På mobil är panelen en bottom sheet (peek/half/full)
och sidfoten flyttas in sist i sheeten. Sidfoten anger för varje uppgift **varifrån** den kommer,
**hur** den hämtas (självhostad fil, statisk fil eller live via `/api/...` genom proxyn) och
**hur färsk** den är; kartutsnittets datum injiceras från `data/derived/manifest.json` vid bygge.
`Om`, `Källor och licenser` och `Integritet` länkar till arenm.se. Okända adresser ger 404.

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
index.html              Landningsvyns skal (UX-01, JK-04)
verktyg/index.html      Verktygslägets sida (FK-22) — egen Vite-entry, laddar Origo
src/                    Klient (Vite + TypeScript, vanilla)
  config/site.ts        BASE, API_BASE, LM_ENABLED — allt publikt
  geo/olProjections.ts  Registrerar EPSG:3006/3010 i OpenLayers
  i18n/                 sv/en-kataloger utan runtime-bibliotek (FK-34)
  bad/                  Badplatser: datamodell, kartlager, panel (Kärnfunktion B)
  map/                  Kartkärna, bakgrundskartor med fallback, PMTiles-läsare/-källa, egna kontroller
  net/                  fetch med timeout/omförsök (IK-06, IK-07)
  verktyg/              Origo-konfiguration och bootstrap för verktygsläget (ADR-11)
  ui/                   Banners, bottom sheet, språkväxlare och sidfotens placering (ADR-13)
shared/                 Ren logik utan DOM/OL — delas av klient, edge och test
  geo/crs.ts            EPSG-koder, proj4-strängar, utbredning (ren data, inga beroenden)
  geo/projDefs.ts       proj4-registrering och transformationer (Bilaga B.5)
  geo/lmTileGrid.ts     Lantmäteriets 3006-matris
  geo/measure.ts        Längdmätning: 3006/3010/geodetiskt, aldrig 3857 (NFK-12)
  geo/kommun.ts         Kommunkod, bbox, panoreringsbuffert
  api/errors.ts         Enhetlig felmodell (IK-04)
netlify/functions/      Edge-funktioner (Netlify Functions 2.0)
  tiles.mts             IK-01 tile-proxy (flygbild via WMS, OSM-fallback)
  bad-status.mts        IK-02 badvattenstatus (HaV)
  vader.mts             IK-03 väder (SMHI)
netlify/lib/            Testbar logik för funktionerna (hav.ts, smhi.ts, tilesGuard.ts, upstream.ts)
vite/                   Vite-plugin som kör edge-funktionerna i dev
data/                   Kuraterad geodata (GeoJSON, EPSG:4326), SOURCES.md, derived/ (PMTiles, ej i git)
public/vendor/          Vendorerade bibliotek (Origo, versionerad sökväg)
docs/                   Kravspec, referenssystem, villkor, ADR-09–13, deploy/ (IIS-mall)
scripts/                Byggkontroller, hämtning av kartdata
tools/                  Offline-bearbetning (Python): GeoPackage → PMTiles, FTP-urval; Origo-bygge
```

## Arkitektur i korthet

Statisk sajt + edge-funktioner (ADR-01). Kartan renderas av OpenLayers i **EPSG:3006** (ADR-03).
Bakgrundskartan är ett självhostat PMTiles-utsnitt av Lantmäteriets topografiska webbkarta (ADR-09) —
inga anrop till Lantmäteriet från besökaren. Flygbild och live-tjänster går via en tile-proxy med
Origin-lås, zoom- och bbox-spärr (ADR-04, NFK-18). Verktygsläget (Origo) är en egen sida under
`/verktyg/` (ADR-02, ADR-11) och hamnar aldrig i landningsvyns kritiska väg — `npm run check:budget`
bevakar det (TK-05).

Se [docs/referenssystem.md](docs/referenssystem.md) för geodetiken och
[data/SOURCES.md](data/SOURCES.md) för datakällor, licenser och villkor.

## Licens

Kod: MIT (se `LICENSE`, läggs till vid publicering — FV-04). Data har egna licenser per källa, se
`data/SOURCES.md`. Kuraterat innehåll och rankning © Aren Mardian.
