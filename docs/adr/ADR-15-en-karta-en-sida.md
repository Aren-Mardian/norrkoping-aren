# ADR-15 — En karta, en sida, ett språk

**Status:** Beslutad 2026-09-23. Ersätter ADR-02 och ADR-11 i fråga om *var* verktygen bor, och
upphäver den tvåspråkighet kravspecen beskriver (FK-34). Bygger vidare på ADR-13 (app-skalet).

## Kontext

Sajten hade två kartor på två sidor: badplatsvyn (vår egen OpenLayers, 160 kB gzip) och
verktygsläget (Origo, 764 kB gzip) under `/origo/`. Uppdraget var att slå ihop dem till **en
karta med alla funktioner**, döpa badplatsvyn till "Karta", ha bara *Karta* och *Om* i menyn,
och ta bort engelskan helt.

Det som styrde lösningen: **Origo kan inte överta en befintlig OpenLayers-karta.** Konfigurationens
`options.map` är ett kartnamn, inte en instans; Origo skapar alltid sin egen `ol/Map` i sitt eget
DOM-träd. Två OpenLayers-bundlar kan inte heller dela lagerobjekt — klasserna är API-identiska men
kommer ur olika byggen, och renderarna förutsätter sin egen instans.

Därmed fanns tre vägar: (a) låta Origo vara kartan från start, (b) bygga verktygen själva direkt på
OpenLayers och släppa Origo, eller (c) en kartyta där vår lätta karta visas direkt och Origo laddas
in i samma ruta på begäran. (a) kostar 764 kB gzip vid *varje* besök och bryter NFK-02; (b) tar bort
det ramverk kravspecens Kärnfunktion C uttryckligen pekar ut. Beställaren valde (c).

## Beslut

1. **En sida, en kartyta, två motorer.** `index.html` har både `#map` (vår OpenLayers) och
   `#origo-mount` (tom tills vidare). Knappen "Verktyg" hämtar Origo med `import()`, monterar den
   i `#origo-mount`, döljer `#map` och visar Origo — **samma vy, samma zoom, samma badplatser,
   samma markering**. Stänger man verktygen lämnas vyn tillbaka. Den som aldrig öppnar verktygen
   laddar aldrig Origo: kritiska vägen är 159,9 kB gzip, verktygschunken 769,3 kB (budget 900).
2. **Badplatslagret byggs en gång.** `src/bad/layerCore.ts` implementerar symboler, träffytor,
   Topp 3-ring och markeringslogik mot ett *injicerat* OpenLayers (`OlKit`). `src/bad/layer.ts`
   skickar in våra egna importer, `src/origo/tools.ts` skickar in `Origo.ol`. Koordinaterna
   transformeras till EPSG:3006 en gång av anroparen, så kärnan behöver varken proj4 eller
   projektionsregistret.
3. **`src/ui/toolsToggle.ts` är det enda stället som vet vilken motor som är aktiv.** Resten av
   appen anropar `zoomTo`, `setSites`, `setSelected` och `setHover` utan att bry sig. Vid varje
   växling mäts den nu synliga kartan om och ritas om på nästa frame — utan det hinner motorn mäta
   upp ytan medan den fortfarande delas med den andra kartan, och bakgrundsrutorna hämtas men
   målas aldrig (observerat 2026-09-23).
4. **Menyn har två poster:** *Karta* (sidan själv) och *Om* (arenm.se). `/origo/*` och `/verktyg/*`
   ger 301 till kartan, så gamla länkar och bokmärken fungerar.
5. **Panelen kan fällas in.** På desktop fäller pilen i panelhuvudet ihop hela kolumnen så att
   kartan får full bredd; en flik vid kanten fäller ut den igen. Läget ligger i `sessionStorage`
   (gränssnittsläge, inte spårning — NFK-21) och den infällda panelen sätts `inert` så att den inte
   går att tabba in i. På mobil styr bottom sheet-lägena som förut (ADR-13).
6. **Enspråkigt svenskt.** `src/i18n/en.ts` och språkväxlaren är borttagna; `t()` och katalogen
   `sv.ts` finns kvar som enda plats för texter. `?lang=`, `/sv/*` och `/en/*` är borta.
   **Detta avviker medvetet från kravspecens FK-34** (tvåspråkigt gränssnitt) på beställarens
   uttryckliga begäran. Datafilerna bär fortfarande `name.sv`/`name.en`; bara gränssnittet är
   enspråkigt, så engelskan kan återinföras utan att data behöver hämtas om.
7. **Rullhjulet zoomar utan Ctrl i båda motorerna.** Vår karta får `defaultInteractions({ onFocusOnly: false })`.
   Origo kräver Ctrl som standard; villkoret på dess MouseWheelZoom byts efter `load` mot ett som
   alltid gäller. Interaktionen identifieras på sina egna fält (`useAnchor_`, `deltaPerZoom_`),
   inte på klassnamnet — bundlen är minifierad. Kravet fyller ingen funktion här: kartan fyller sin
   egen yta och dokumentet bakom scrollar aldrig (ADR-13), så det finns inget att skrolla förbi.

## Konsekvenser

- **Flygbilden fungerar nu förbi zoom 13.** Buggen var att ortofotolagrets rutnät hade alla 16
  nivåer medan WMS:en bara levererar t.o.m. 13 — vid zoom 14 blev kartan helt tom. Rutnätet slutar
  nu vid nivå 13, så OpenLayers skalar upp sista nivån i stället.
- **Tappade funktioner vid växlingen:** i verktygsläget ritas ingen nål för en vald sökträff
  (kortet med koordinater och höjd visas ändå, och kartan centreras). Origos egen `featureinfo`
  och positionskontroll fyller samma behov där.
- **ADR-11 gäller fortfarande** för hur Origo vendoreras, byggs och konfigureras; bara punkt 2–3
  (egen HTML-sida, egen Vite-entry) är ersatta. `origo/index.html` och `src/origo/main.ts` är borta.
- **Bundlebudgeten mäter nu verktygschunken** i stället för en egen sida: Origos bundle plus
  `assets/tools-*.js`. `forbidOrigo` på kritiska vägen är kvar och bevakar TK-05.
- **Verifierat 2026-09-23:** växling fram och tillbaka med bevarad vy (578000/6497000, zoom 10),
  badplatser och markering i båda motorerna, höjdprofil, flygbild 1960/1975 inklusive zoom 14,
  rullhjulszoom utan Ctrl i båda, panelen in- och utfälld, 80 tester gröna.
