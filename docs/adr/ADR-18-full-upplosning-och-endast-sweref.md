# ADR-18 — Full upplösning i hela kommunen, och SWEREF 99 TM som enda referenssystem

**Status:** Beslutad 2026-09-23 på beställarens begäran. Ändrar ADR-09 (utsnittets detaljnivå) och
kravspecens FK-26 (koordinatavläsning i flera system).

## Kontext

Två önskemål: kartan skulle bli **mer detaljerad och av högre kvalitet även om det kostar något i
hastighet**, och sajten skulle visa **bara SWEREF**.

Bakgrundskartan var ett utsnitt i tre detaljnivåer: hela kommunen till 2 m/px, centralorten till
1 m/px och innerstaden till 0,5 m/px — 251 MB. Utanför Norrköpings tätort skalades alltså rutor
från 2 m/px upp när man zoomade in, vilket syntes som suddig karta i Skärblacka, Åby, Krokek,
Kolmården och skärgården.

Samtidigt erbjöd gränssnittet fyra referenssystem: SWEREF 99 TM, SWEREF 99 16 30, WGS 84 i
decimalgrader och WGS 84 i grader-minuter-sekunder.

## Beslut

1. **Hela kommunen i källans egen upplösning, 0,5 m/px.** `tools/extract_topowebb.py` har nya
   standardvärden: översiktsnivåer med 5 km buffert (samma som panoreringsgränsen, ADR-16),
   4–2 m/px med 3 km, och 1–0,5 m/px med 500 m kant. Inga särskilda detaljområden behövs längre.
   Utfall: **189 052 rutor, 665 MB** — rutorna kopieras oförändrade ur GeoPackage-filen, så ingen
   omkodning och ingen kvalitetsförlust.
2. **Storleken kostar lagring och byggtid, inte laddtid.** PMTiles läses med Range-requests:
   besökaren hämtar bara de rutor som syns, precis som förr. Det som växer är filen i GitHub-releasen
   (665 MB, inom gränsen 2 GB per artefakt) och nedladdningen i varje Netlify-bygge. Den tidigare
   uppskattningen på 2,3 GB i `data/SOURCES.md` avsåg bbox + 25 km buffert; klippt mot kommungränsen
   blev det under en tredjedel.
3. **SWEREF 99 TM (EPSG:3006) är sajtens enda referenssystem.** SWEREF 99 16 30 är borttaget helt —
   ur `crs.ts`, `projDefs.ts`, mätningens vitlista, Origos `proj4Defs`, positionskontrollen, testerna
   och dokumentationen. Positionskontrollen visar bara kartans egen projektion.
4. **WGS 84 finns kvar som dataformat, aldrig i gränssnittet.** Tre ställen kräver det och kan inte
   ändras utan att bryta mot standarder eller mot ett externt API:
   - GeoJSON in (`kommungrans.geojson`, `badplatser.geojson`) — RFC 7946 föreskriver WGS 84.
   - GeoJSON ut (ritade objekt från Origo) — samma skäl. Hade vi exporterat SWEREF hade filen inte
     kunnat läsas korrekt av andra verktyg utan att man känner till avvikelsen.
   - SMHI:s punktprognos tar lat/lon.
   Det står uttryckligen i Origos "Om verktygen" och i sidfoten att exportfilen bär WGS 84 medan allt
   som visas är SWEREF 99 TM.
5. **Upplösning och kvalitet redovisas för besökaren.** Sidfoten anger nu 0,5 m/px, filstorleken
   (injicerad ur manifestet vid bygget, så siffran inte kan glida isär från verkligheten), att rutorna
   kopierats utan omkodning, och att allt sker i SWEREF 99 TM.

## Konsekvenser

- **Kvalitet:** skarp karta i hela kommunen vid maxzoom, inte bara i centralorten. Verifierat i
  Skärblacka (556 200, 6 494 200) på zoom 13, där kartan tidigare var en uppskalning från 2 m/px.
- **Mätnoggrannhet oförändrad:** SWEREF 99 TM ger −0,034 % på en kilometer, alltså 0,34 m — långt
  under TK-03:s ±5 m. Tabellen i `docs/referenssystem.md` står kvar som underlag för just det
  beslutet, med 3010-raden markerad som inte längre erbjuden.
- **Mindre kod:** en projektionsdefinition i stället för två, en rad i `proj4Defs`, tom lista i
  positionskontrollen, nio tester färre (58 kvar) eftersom 3010-transformationerna inte längre finns.
- **Avsteg från kravspecen:** FK-26 kräver tre system. Avsteget är beställarens beslut och antecknat
  direkt vid kravet i `docs/kravspecifikation.md`.
- **Kräver en åtgärd vid publicering:** `data/derived/manifest.json` pekar på en ny GitHub-release
  (`data-2026-09-23`). Bygget hämtar filen därifrån och verifierar SHA-256, så releasen måste finnas
  innan nästa Netlify-deploy — annars misslyckas bygget med ett tydligt fel.
- **Verifierat 2026-09-23:** utsnittet 189 052 rutor / 665 MB på 69 sekunder, SHA-256 i manifestet,
  58 tester gröna, kritisk väg 160,1 kB gzip (budget 180), sidfoten visar rätt upplösning och storlek.
