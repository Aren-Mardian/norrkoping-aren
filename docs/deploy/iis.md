# Drift på IIS (web.config) — och varför det inte behövs här

## Vad din kollega menar

På kommunala GIS-avdelningar körs webbkartor (Origo, ArcGIS Web AppBuilder, egna OpenLayers-appar)
ofta på **Windows Server med IIS** (Internet Information Services). IIS konfigureras per webbplats
med en fil som heter **`web.config`** i webbroten. Där sätter man, innan man släpper in kartan:

| Vad | Varför det spelar roll för GIS |
|---|---|
| **MIME-typer** för `.geojson`, `.pmtiles`, `.mvt/.pbf`, `.json`, `.svg` | IIS vägrar servera okända filändelser (404). Vektorrutor och GeoJSON är okända för IIS som standard. |
| **Statisk komprimering** (gzip/brotli) | Kartdata är text; komprimering ger 5–10× mindre överföring. |
| **Cache-headers** per katalog | Hashade assets "för alltid", data en dag, HTML aldrig. |
| **URL Rewrite** | SPA-fallback (djuplänkar → index.html), avslutande snedstreck, https-tvång. |
| **Säkerhetsheaders** | CSP, HSTS, X-Content-Type-Options, Referrer-Policy — samma som vi. |
| **Range-requests** | Krävs för PMTiles/COG. IIS stödjer det för statiska filer utan konfiguration. |
| **Request-filtrering** | Maxstorlek på anrop, blockerade filändelser (`.env`, `.config`). |

Det är alltså precis samma **serverkonfiguration** som vi redan har — bara i ett annat format.

## Vad vi har i stället

Norrköpingskartan körs på **Netlify** (statisk CDN + edge-funktioner), inte på IIS. Motsvarigheten
till `web.config` är [`netlify.toml`](../../netlify.toml) plus byggets `<meta http-equiv>` för CSP:

| IIS / web.config | Vårt projekt |
|---|---|
| `<staticContent><mimeMap>` | Netlify känner till `.geojson`/`.pmtiles`; Vite-pluginen sätter typerna lokalt |
| `<urlCompression>` / `<httpCompression>` | Netlify komprimerar (brotli) automatiskt — verifierat på `kommungrans.geojson` |
| `<clientCache>` / `<httpProtocol><customHeaders>` | `[[headers]]` i netlify.toml (assets immutable, vendor 30 d, data 1 d + SWR) |
| `<rewrite><rules>` | `[[redirects]]` i netlify.toml (SPA-fallback, `/verktyg` → `/verktyg/`, 404 för saknad data) |
| Säkerhetsheaders | `[[headers]]` + CSP-meta per sida (ADR-11/12) |
| Applikationskod (ASP.NET, proxy) | Netlify Functions (`netlify/functions/*.mts`) |

Så: **ingen web.config behövs för driften på Netlify.** Det finns inget att göra "innan projektet" —
motsvarande beslut är redan tagna och versionshanterade.

## Om projektet en dag ska köras på kommunens IIS

Bygget är rena statiska filer (`dist/`) och funktionerna är små och isolerade. Att flytta till IIS
kräver:

1. Kopiera `dist/` till webbroten och lägg [`web.config`](web.config) (mall i den här katalogen)
   bredvid `index.html`. Mallen täcker MIME-typer, komprimering, cache, SPA-omskrivning och
   säkerhetsheaders — samma värden som netlify.toml.
2. Ersätt edge-funktionerna (`/api/tiles`, `/api/bad/status`, `/api/vader`) med en liten
   Node-/ASP.NET-tjänst eller en reverse proxy med cache. Logiken ligger i `netlify/lib/` och är
   plattformsoberoende (ren TypeScript, `fetch`/`Request`/`Response`) — den kan köras i Node
   ("node:http") med ett tunt adapterlager.
3. Sätt appkontot (`LM_USER`/`LM_PASSWORD`) som miljövariabler på servern — aldrig i web.config
   (den filen hamnar lätt i git eller i backuper).

Mallen är **inte** deployad någonstans i dag och ligger utanför `public/` så att den inte följer
med i Netlify-bygget.
