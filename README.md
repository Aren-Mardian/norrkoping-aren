# Norrköpingskartan

En öppen, snabb och tillgänglig kartportal för Norrköpings kommuns invånare och besökare.
Kravspecifikation: [docs/kravspecifikation.md](docs/kravspecifikation.md) (KRAV-NKPG-001 v1.0).

> Ett oberoende projekt av Aren Mardian. **Inte** en officiell tjänst från Norrköpings kommun.

Målplattform: `https://arenm.se/projekt/norrkoping`

## Status

| Sprint | Milstolpe | Läge |
|---|---|---|
| 0 | Grund — repo, Vite+TS, CI, tile-proxy, CSP/headers, dev-läge utan token | **Klar lokalt** — väntar på Netlify-sajt (användaren) |
| 1 | Karta står — LM-bakgrund, växlare, kommungräns, startextent, skalstock | **Nästan klar** — Lantmäteriets topografiska karta självhostad som PMTiles (ADR-09/10), kommungräns (OSM tills LM:s finns), växlare, startextent, skalstock. Återstår: flygbild (historiska ortofoton, kräver appkonto) |
| 2–7 | Se kravspec §12 | Ej påbörjad |

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
Hur den skapas från Lantmäteriets 163-GB-fil står i [ADR-09](docs/adr/ADR-09-sjalvhostad-bakgrundskarta.md)
och [tools/README.md](tools/README.md). Saknas filen faller appen tillbaka på OpenStreetMap
(reprojicerad till SWEREF 99 TM) med en synlig utvecklingsbanner (FK-33). Utan `.env` saknas dessutom
flygbilden, som går via edge-proxyn.

### Med Lantmäteriets bakgrundskartor

1. Kopiera `.env.example` till `.env` och fyll i `LM_USER`/`LM_PASSWORD` (appkonto från Geotorget)
   samt `VITE_LM_ENABLED=true`. `.env` är git-ignorerad och får aldrig checkas in.
2. Kör `npm run dev:netlify` (kräver `npm i -g netlify-cli`). Netlify Dev kör edge-funktionerna
   lokalt så att `/api/tiles/...` fungerar.

Tile-proxyn är den enda platsen där Lantmäteriets uppgifter finns. Klientbundlen innehåller aldrig
en hemlighet — variabler med prefix `VITE_` är publika.

## Kommandon

| Kommando | Vad |
|---|---|
| `npm run dev` | Vite dev-server (fallback-läge) |
| `npm run dev:netlify` | Vite + edge-funktioner via Netlify Dev |
| `npm run build` | Hämtar kartdata enligt manifestet, sedan produktionsbygge till `dist/projekt/norrkoping/` |
| `npm run fetch:tiles` | Bara nedladdning/verifiering av kartdata (ADR-10) |
| `npm run typecheck` | `tsc --noEmit` i strikt läge för klient och funktioner (NFK-29) |
| `npm test` | Vitest: geodetiska tester (TK-02, TK-03) och proxyns spärrar (NFK-18) |
| `npm run check:budget` | Bundlebudget (NFK-02) och Origo-isolering (TK-05) mot `dist/` |
| `npm run check` | Allt ovan i följd — samma som CI |

## Struktur

```
index.html              Landningsvyns skal (UX-01, JK-04)
src/                    Klient (Vite + TypeScript, vanilla)
  config/site.ts        BASE, API_BASE, LM_ENABLED — allt publikt
  geo/olProjections.ts  Registrerar EPSG:3006/3010 i OpenLayers
  i18n/                 sv/en-kataloger utan runtime-bibliotek (FK-34)
  map/                  Kartkärna, bakgrundskartor med fallback, PMTiles-källa, egna kontroller
  ui/                   Banners och statusrader
shared/                 Ren logik utan DOM/OL — delas av klient, edge och test
  geo/projDefs.ts       proj4-definitioner (Bilaga B.5)
  geo/lmTileGrid.ts     Lantmäteriets 3006-matris
  geo/measure.ts        Längdmätning: 3006/3010/geodetiskt, aldrig 3857 (NFK-12)
  geo/kommun.ts         Kommunkod, bbox, panoreringsbuffert
  api/errors.ts         Enhetlig felmodell (IK-04)
netlify/functions/      Edge-funktioner (Netlify Functions 2.0)
  tiles.mts             IK-01 tile-proxy
netlify/lib/            Testbar logik för funktionerna
data/                   Kuraterad geodata (GeoJSON, EPSG:4326), SOURCES.md, derived/ (PMTiles, ej i git)
docs/                   Kravspec, referenssystem, ADR:er
scripts/                Byggkontroller
tools/                  Offline-bearbetning (Python): GeoPackage → PMTiles, FTP-urval
```

## Arkitektur i korthet

Statisk sajt + edge-funktioner (ADR-01). Kartan renderas av OpenLayers i **EPSG:3006** (ADR-03).
Bakgrundskartan är ett självhostat PMTiles-utsnitt av Lantmäteriets topografiska webbkarta (ADR-09) —
inga anrop till Lantmäteriet från besökaren. Flygbild och live-tjänster går via en tile-proxy med
Origin-lås, zoom- och bbox-spärr (ADR-04, NFK-18). Verktygsläget (Origo) blir en egen lazy route under `/verktyg` (ADR-02) och får
aldrig hamna i landningsvyns kritiska väg — `npm run check:budget` bevakar det (TK-05).

Se [docs/referenssystem.md](docs/referenssystem.md) för geodetiken och
[data/SOURCES.md](data/SOURCES.md) för datakällor, licenser och villkor.

## Licens

Kod: MIT (se `LICENSE`, läggs till vid publicering — FV-04). Data har egna licenser per källa, se
`data/SOURCES.md`. Kuraterat innehåll och rankning © Aren Mardian.
