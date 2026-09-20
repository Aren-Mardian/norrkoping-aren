# ADR-12 — CSP per sida via meta, och edge-funktioner i dev-servern

**Status:** Beslutad 2026-09-20. Ändrar hur NFK-16 realiseras (ADR-11 punkt 6 ersätts).

## Kontext

ADR-11 relaxade CSP:n för `/verktyg/*` med en sökvägsspecifik Netlify-headerregel. I drift visade
det sig att **Netlify inte tillämpar en mer specifik regel när en generell regel sätter samma
header** — `/*`-regelns `style-src 'self'` gällde även `/verktyg/img/loading.gif`, oavsett
ordning i `netlify.toml`. Samma sak drabbade `Cache-Control`: en generell `no-cache`-regel slog ut
`immutable` för hashade assets. Verktygsläget (Origo) blockerades därför helt i produktion
(394 CSP-överträdelser, tom sida) — "Origo syns inte".

Samtidigt saknade `npm run dev` edge-funktionerna (`/api/*`), vilket gjorde badplatsstatus och
väder otestbara lokalt utan `netlify-cli`.

## Beslut

1. **CSP levereras som `<meta http-equiv="Content-Security-Policy">` i varje HTML-sida**, injicerad
   av en Vite-plugin vid bygge (`cspMeta()` i `vite.config.ts`): strikt policy på landningsvyn och
   404-sidan, relaxad `style-src 'unsafe-inline'` + `base-uri 'self'` enbart på verktygssidan.
   Headern i `netlify.toml` bär bara `frame-ancestors 'none'` (kan inte uttryckas i meta).
   Policyn definieras på ett ställe och följer sidan — portabel till vilken värd som helst (IIS, se
   docs/deploy/iis.md). Injiceringen sker bara vid bygge: i dev injicerar Vite `<style>` för HMR.
2. **Ingen header sätts av mer än en regel** i `netlify.toml`. Den generella `no-cache`-regeln togs
   bort (Netlifys standard `max-age=0, must-revalidate` + ETag ger samma effekt för HTML).
3. **Edge-funktionerna körs i Vites dev-server** via `vite/devFunctions.ts`: `netlify/functions/*.mts`
   laddas med Vites SSR-laddare, matchas på `config.path` (`:param`-segment), anropas med en vanlig
   `Request` och svaret skrivs tillbaka. `.env` läses in i `process.env`. `npm run dev` ger därmed
   hela stacken; `dev:netlify` togs bort.

## Konsekvenser

- CSP-skydd oförändrat i styrka; verifieras lokalt mot bygget med en statisk testserver som
  speglar `netlify.toml` (noll överträdelser på båda sidorna 2026-09-20).
- Rapportering (`report-to`) är inte möjlig i meta-CSP; introduktionsperiodens rapportering
  (NFK-16) får ske via header när den behövs.
- Cache-headers verifieras på live efter deploy: `assets/*` immutable, `vendor/*` 30 d, `data/*` 1 d.
