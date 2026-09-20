# ADR-13 — App-skal utan dokumentscroll; Om/Källor/Integritet på arenm.se

**Status:** Beslutad 2026-09-20. Rör UX-01–UX-03, JK-01, JK-04, NFK-21, NFK-32.

## Kontext

Landningsvyn var ett vanligt dokument: topbar, karta med fast höjd, panel (bottom sheet med
`position: fixed` på mobil) och sidfot under. Det gav tre problem som alla yttrade sig som
"sidan och kartan hamnar längst ner" när man tryckte på något:

1. **Dokumentet var scrollbart** (sidfoten låg under kartan; på desktop stämde dessutom
   `--topbar-h` inte med topbarens verkliga höjd). Fokus som flyttas programmatiskt
   (`back.focus()` när en badplats öppnas), tangentbordsnavigering eller ett `<a href="#…">`
   fick webbläsaren att scrolla dokumentet — och i iOS Safari scrollar `focus()` i ett
   `position: fixed`-element notoriskt hela sidan till botten.
2. **Panelkroppens scrollposition följde med** från listan in i detaljvyn: öppnade man en badplats
   långt ner i listan visades detaljvyn scrollad till sitt slut (vädret) i stället för till namnet.
3. **Kartan passade om sig** till startvyn vid varje storleksändring så länge användaren inte
   rört själva kartan — även efter att appen själv flugit till en vald badplats.

Dessutom pekade `Om`, `Datakällor och licenser`, `Integritet` och `Så räknas rankningen` på
sidor (`/om`, `/kallor`, `/integritet`, `/metod`) som inte finns; SPA-fallbacken i `netlify.toml`
gjorde att de tyst visade landningsvyn under fel adress.

## Beslut

1. **App-skal.** `body` är exakt vyporten (`100dvh`, `overflow: hidden`) och en flex-kolumn:
   topbar (fast 56 px) → `main` (fyller, `min-height: 0`) → sidfot. Det enda som scrollar är
   panelens kropp (`.panel__body`). Sheeten på mobil är `position: absolute` inne i `main`, och
   kartan slutar där sheeten börjar i peek-läge så att zoom, växlare, skalstock och attribution
   alltid syns (JK-02). Öppnad sheet lägger sig över kartan; vald badplats centreras i den synliga
   delen (`zoomTo(center, zoom, bottomInsetPx)`).
2. **Fokus utan scroll och nollställd scroll.** Programmatiskt fokus använder
   `{ preventScroll: true }`; varje byte lista ↔ detalj och varje filterbyte sätter
   `panelBody.scrollTop = 0`. `zoomTo` markerar att startvyn lämnats, så en storleksändring
   (t.ex. utfälld källförteckning) inte återställer kartan.
3. **Sidfoten är ett element som flyttas.** På desktop ligger den som en låg list under kartan
   (källförteckningen hopfälld i `<details>`, max 40 vh när den öppnas); på mobil flyttar
   `placeFooter()` samma element sist i sheetens scrollyta, utfällt. Ett DOM-träd, en i18n-uppsättning.
4. **Källor, hur de hämtas och hur färska de är, står på sidan** (JK-01, Bilaga C): per källa
   *varifrån* (Lantmäteriet, HaV, SMHI, OpenStreetMap, Origo/OpenLayers), *hur* (självhostad
   PMTiles-fil, statisk GeoJSON, live via `/api/...` genom proxyn med angiven cache) och *när*
   (kartutsnittets datum injiceras från `data/derived/manifest.json` vid bygge via Vite `define`;
   statusens ålder visas i panelen; prognosens utgivningstid i vädermodulen). Plus en rad om
   integritet: inga kakor, ingen spårning, IP-adressen skickas inte vidare (NFK-23).
5. **Om projektet, Källor och licenser, Integritet länkar till arenm.se** (portfolion), på
   uttrycklig begäran. Sajten har inga egna sidor utöver `/` och `/origo/`; Topp 3-metoden
   förklaras på plats i ett `<details>` i stället för på `/metod`.
6. **Riktiga 404.** SPA-fallbacken är borttagen. `/sv/*` och `/en/*` leder fortfarande till
   landningsvyn (språkprefix, FK-34); allt annat okänt ger `404.html` med status 404.
7. **Språkväxlare i topbaren.** Länken pekar på samma sida med `?lang=` för det andra språket
   (URL-buret, ingen lagring — NFK-21) och interna menylänkar får med sig ett uttryckligt val.

## Konsekvenser

- Landningsvyns kritiska väg: 158,7 kB JS + 6,0 kB CSS gzip (budget 180 / 25). Ingen ny
  beroende; `src/ui/chrome.ts` är ~1 kB.
- Sidfotens `<footer>` hamnar inne i `<aside>` på mobil och är då inte `contentinfo` för
  skärmläsare — acceptabelt: innehållet är detsamma och nås i läsordning sist i panelen.
- Kravspecens `/kallor`, `/om`, `/integritet` (§12 sprint 6) realiseras inte som egna sidor i
  denna sajt utan hos arenm.se; ändras det beslutet är det tre `href` och en redirect-regel.
- Verifierat 2026-09-20: 0 konsolfel under produktions-CSP (lokal testserver som speglar
  netlify.toml), inget dokumentscroll på 375×812 och 1366×720, fokus och scrollposition korrekta
  vid lista → detalj → lista, sheet peek/half/full, sidfot i båda lägena.
