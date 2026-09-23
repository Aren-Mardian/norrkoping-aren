# ADR-16 — Robusta lägen: spritar, flygbild, punktmätning och kommungränsen som spärr

**Status:** Beslutad 2026-09-23. Följdbeslut till [ADR-15](ADR-15-en-karta-en-sida.md) efter tre
fel som visade sig i drift, plus en skärpning av vilka data sajten över huvud taget hämtar.

## Kontext

Tre saker slutade fungera efter sammanslagningen till en sida:

1. **Fem tomma block ovanför kartan.** Origo lägger sina ikonspritar som
   `<div><svg style="display:none">` direkt i `<body>` och litar helt på inline-stilen. En strikt
   CSP (`style-src` utan `'unsafe-inline'`) tar bort den — då blir divarna synliga tomma block som
   trycker ner kartan. Regeln som tidigare täckte det låg i `src/origo/origo.css`, scopad till
   klassen `.origo-page`. När den sidan togs bort försvann både klassen och den enda importen av
   filen: **hela stilfilen var död kod och kom aldrig med i bygget.**
2. **Flygbildsknappen gick inte att trycka på.** Tillgängligheten avgjordes av byggflaggan
   `VITE_LM_ENABLED`. Den måste vara satt *vid bygget*; saknas den på Netlify blir knappen
   permanent avstängd, oavsett att servern har appkontot och proxyn fungerar.
3. **Höjdverktyget ritade linjer.** Det var byggt kring en höjdprofil med `Draw`-interaktion —
   mer maskineri än uppgiften kräver, och i vägen för den som bara vill veta höjden i en punkt.

Dessutom: bbox:en runt Norrköpings kommun är 114 × 49 km och rymmer stora delar av Söderköping,
Finspång, Nyköping och Linköping. Punktfrågor som bara kontrollerades mot bbox:en kunde alltså
besvara frågor om andra kommuner.

## Beslut

1. **Spritarna döljs av ett attribut, inte av en stil.** `tools.ts` märker behållarna med klassen
   `origo-sprite` (CSS i `style.css`, som alltid levereras). Spritarna hämtas asynkront och finns
   sällan när Origos `load` går, så en kortlivad `MutationObserver` fångar dem när de dyker upp
   och kopplas ned efter 15 s. En `:has()`-regel täcker glappet innan klassen hinner sättas.
   Spritarna får inte tas bort ur dokumentet — ikonerna refererar dem med `<use>`.
2. **Flygbilden avgörs vid körning, inte vid bygget.** Knappen är på så länge proxyn finns
   (allt utom ren `npm run dev` utan `.env`). Svarar Lantmäteriet inte — fel appkonto, tjänsten
   nere — räknas fyra misslyckade rutor utan en enda lyckad, varefter knappen stängs av, kartan
   går tillbaka till topografiska och besökaren får veta varför. `VITE_LM_ENABLED` styr numera
   bara lokal utveckling.
3. **Höjdverktyget är punktbaserat.** Ett klick ger markhöjden i den punkten, nästa klick nästa
   höjd; upp till tolv punkter ligger kvar samtidigt. Ingen `Draw`, inga linjer — den som vill
   mäta sträckor har Origos mätverktyg i samma karta. Höjdprofilen, dess sampling och statistik
   är borttagna, liksom batchläget (`POST /api/hojd`) som bara fanns för profilen. Tjänsten hos
   Lantmäteriet stöder fortfarande batch om det behövs igen.
4. **Kommungränsen är spärren för punktfrågor, inte bbox:en.** `tools/kommun_polygon.py`
   genererar `shared/geo/kommunPolygon.ts` ur Lantmäteriets kommungräns: 222 hörn i EPSG:3006
   (5,9 kB källa, ~2 kB gzip), förenklad med 150 m tolerans och buffrad 150 m utåt så att punkter
   precis på gränsen inte nekas. `pointInKommun()` gör bbox-test följt av strålkastning.
   Används av `/api/hojd` (serversidan) och av höjdverktyget (så att ett klick utanför kommunen
   inte ens blir ett anrop). Filen är genererad — den redigeras inte för hand.
5. **Panoreringsbufferten sänks 25 km → 5 km.** Den styr både hur långt kartan får panoreras och
   hur långt utanför kommunen tile-proxyn levererar bakgrundsrutor (NFK-18). 5 km räcker för att
   kanten ska ritas snyggt, och sajten hämtar därmed inte längre bildrutor över halva Östergötland.
6. **Origo förhämtas vid avsikt.** Pekaren mot "Verktyg" startar `import()` av verktygsmodulen
   (NFK-34). Den som aldrig rör knappen hämtar fortfarande ingenting.

## Konsekvenser

- **Rotorsaken till den tomma bakgrundskartan i verktygsläget** var att Origo skapades medan dess
  element delade yta med vår karta och därefter ändrade storlek: rutlagret behöll då en tom,
  cachad ram trots att rutorna hämtats. Ordningen är nu omvänd — kartytan växlas *före*
  initieringen, så Origo byggs direkt i full storlek och behöver aldrig ändra den. Ytan visar ett
  skelett medan bundlen laddas.
- **Flygbilden fungerar förbi zoom 13** sedan rutnätet slutar på tjänstens sista nivå (ADR-15);
  verifierat på zoom 14 där nivå 13 skalas upp.
- **Mindre kod:** höjdprofilen, dess tester och batchvägen är borta (−1 testfil, −3 exporterade
  funktioner). `src/origo/origo.css` raderad som död kod. Sidans kritiska väg 160,0 kB gzip
  (budget 180), verktygschunken 770,6 kB (budget 900).
- **Det som hämtas håller sig till kommunen:** bakgrundsrutor och flygbild inom kommunens bbox
  + 5 km, markhöjd innanför kommungränsen, badplatser på kommunkod 0581, ortnamn förberett som
  urval inom kommunen, väder bara för badplatser i kommunen.
- **Verifierat 2026-09-23:** fyra sprite-behållare märkta och utan höjd, bakgrundskartan ritas
  direkt i verktygsläget, flygbild 1960 på zoom 14, flygbildsknappen stängs av med förklaring när
  rutorna fallerar, höjd i punkt efter punkt (9,4 m och 1,1 m) utan linjer, 67 tester gröna.
