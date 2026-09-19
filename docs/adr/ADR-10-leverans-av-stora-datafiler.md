# ADR-10 — Leverans av stora datafiler till produktion

**Status:** Beslutad 2026-09-19. Kompletterar ADR-06 och ADR-09.

## Kontext

Bakgrundskartan är en PMTiles-fil på ~250 MB (`data/derived/topowebb-farg.pmtiles`). Den ska serveras
som statisk fil från samma origin som sajten (CSP `connect-src 'self'`, NFK-16; ingen tredje part i
kritisk väg, NFK-06; besökarens IP når ingen annan, NFK-23). Sajten byggs av Netlify direkt från
GitHub-repot, och GitHub tillåter max 100 MB per fil i git. Git LFS på GitHub ger 1 GB bandbredd per
månad — för lite för byggen som drar filen varje gång. Betald lagring (S3, R2 med kort) bryter M4/NFK-27.

## Beslut

1. **Stora härledda filer checkas inte in i git** (`data/derived/*.pmtiles` i `.gitignore`).
   Små härledda filer (GeoJSON under ~1 MB) checkas in som vanligt.
2. **Filerna publiceras som release-artefakter på GitHub** (upp till 2 GB per fil, fri bandbredd,
   Range-requests stöds). Varje datarelease taggas `data-ÅÅÅÅ-MM-DD`.
3. **`data/derived/manifest.json`** (incheckad) anger per fil: namn, URL till release-artefakten,
   byte-storlek och SHA-256. Manifestet är sanningen om vilken version som hör till koden.
4. **`scripts/fetch-tiles.mjs` körs först i `npm run build`.** Det hämtar filer som saknas eller
   inte matchar manifestet, verifierar SHA-256 och lägger dem i `data/derived/`. Vite-pluginen
   kopierar dem sedan till `dist/projekt/norrkoping/data/`. I CI är en saknad eller felaktig fil ett
   **byggfel** — en deploy utan bakgrundskarta får inte ske i tysthet (A5).
5. **Netlify serverar filen som vanlig statisk tillgång** med `Cache-Control: public, max-age=86400,
   stale-while-revalidate=604800`. Netlifys deploy är innehållsadresserad: filen laddas upp en gång
   och återanvänds tills hashen ändras.
6. Saknad datafil ger **404**, inte SPA-fallbackens `index.html` (annars läser PMTiles-klienten HTML
   och felar på ett obegripligt sätt).

## Arbetsflöde vid ny datarelease

```bash
# 1. Generera filen (tools/extract_topowebb.py) och uppdatera manifestet:
sha256sum data/derived/topowebb-farg.pmtiles      # → sha256 och bytes in i manifest.json, ny URL/tagg
# 2. Publicera artefakten:
gh release create data-ÅÅÅÅ-MM-DD data/derived/topowebb-farg.pmtiles --title "Kartdata ÅÅÅÅ-MM-DD" --notes "…"
# 3. Committa manifest.json och pusha → Netlify bygger, hämtar, verifierar, deployar.
```

## Konsekvenser

- Bygget blir ~10–20 s längre (nedladdning på Netlifys nät). Netlify Free ger 300 byggminuter/månad;
  detta är försumbart.
- Repot förblir litet; en klon kräver inte kartdata (lokal utveckling faller tillbaka på OSM, FK-33).
- Manifestet ger reproducerbarhet (NFK-28): en viss commit pekar på en viss datafil med känd hash.
- Om Netlify skulle visa sig inte klara filer i den här storleken (odokumenterad gräns) är reserven att
  låta klienten läsa artefakten direkt från GitHub via en Netlify-proxy-regel — då måste
  Range-vidarebefordran verifieras. Kontrolleras vid första deploy.

## Alternativ som valdes bort

| Alternativ | Varför inte |
|---|---|
| Git LFS | 1 GB/månad bandbredd på GitHub Free; varje Netlify-bygge drar filen |
| Dela upp i filer < 100 MB i git | Repo-bloat, klumpig versionering, löser inte grundproblemet |
| Cloudflare R2 / S3 | Kräver kort på fil (NFK-27) |
| Klienten läser direkt från GitHub Releases | Tredje part i kritisk väg (NFK-06), IP till GitHub (NFK-23), CSP-undantag |
