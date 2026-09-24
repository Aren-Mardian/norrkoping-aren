# ADR-19 — Om projektet, Källor och licenser och Integritet som sidor i appen

**Status:** Beslutad 2026-09-24 på beställarens begäran. Ändrar [ADR-13](ADR-13-app-skal-och-externa-sidor.md)
(sidorna skulle ligga på `arenm.se`) och uppfyller kravspecens NFK-24.

## Kontext

ADR-13 flyttade Om, Källor och Integritet till portfoliosajten `arenm.se` för att hålla
kartappen till en enda sida. Beslutet genomfördes bara till hälften: menyn och sidfoten fick
länkar, men alla tre pekade på `https://arenm.se/` — portfolions rot, inte tre olika sidor.
Någon som tryckte på **Integritet** hamnade på en startsida utan integritetspolicy.

Det gjorde tre saker samtidigt:

- **NFK-24 var inte uppfylld.** Sajten använder positionsdata (FK-06) och anropar tre myndigheter
  genom en proxy. Att sakna integritetspolicy är inte en formsak.
- **JK-01 vilade på sidfoten ensam.** Sidfotens `<details>` sammanfattar källorna, men
  attributionsmatrisen, licenserna och vad som faktiskt bearbetats fanns bara i repots
  `data/SOURCES.md` — inte för besökaren.
- **Friskrivningen (JK-04) fanns i en rad i sidfoten** och ingen annanstans.

Dessutom är `arenm.se` en annan sajt med en annan publiceringstakt. En integritetspolicy som
beskriver den här sajtens beteende bör ändras i takt med den här sajtens kod, inte i en annan.

## Beslut

1. **De tre sidorna bor i appen**, som innehåll i en modal `<dialog>` över kartan. Sajten har
   fortfarande en sida och en karta (ADR-15) — kartan laddas aldrig om för att man läser en text.
2. **`<dialog>` med `showModal()`, inte en egen overlay.** Webbläsaren ger fokusfälla, Escape,
   inert bakgrund och återställt fokus (NFK-08). Mindre kod och mer korrekt än en handbyggd lösning.
3. **Innehållet är data, inte markup** (`src/sidor/innehall.ts`, DK-08). Renderaren bygger DOM-noder;
   ingen sträng passerar `innerHTML`, så CSP:n behöver inga undantag och innehållet kan inte
   injicera något. Enda märkspråket är `[text](url)` och `**fet**`.
4. **Siffror hämtas ur bygget, inte ur huvudet.** Kartutsnittets datum och storlek,
   ortnamnsindexets datum och antal, och kommungränsens hämtdatum kommer från `__TOPO_FACTS__`,
   `__ORTNAMN_FACTS__` och `__KOMMUN_RETRIEVED__` — samma källa som sidfoten. Sidorna kan inte
   påstå något annat än vad som faktiskt levereras (JK-01).
5. **Ingenting i landningsvyns kritiska väg.** `src/ui/sidor.ts` är den ivriga delen och vet bara
   vilka länkar som finns; texter, renderare och stilar hämtas med `import()` först när någon
   visar avsikt, med förhämtning vid `pointerenter`/`focus`/`touchstart` — samma mönster som
   verktygsknappen. Identiteterna ligger i en egen liten `sidor/ids.ts` just för att den ivriga
   delen inte ska dra in innehållet.
6. **Adresserna `#om`, `#kallor` och `#integritet` går att dela** och öppnar sidan direkt.
   Dokumenttiteln följer med, och stängning återställer både titel och adress.

## Konsekvenser

- **NFK-24 uppfylld.** Policyn beskriver vad som faktiskt sker: ingen spårning, positionen stannar
  i webbläsaren, söktermer lämnar aldrig enheten, myndighetsanropen går genom proxyn, och
  webbhotellets driftloggar är den enda behandlingen som återstår — med ändamål, rättslig grund
  och registrerades rättigheter.
- **JK-01 och JK-04 syns för besökaren.** Källsidan bär hela attributionsmatrisen, licenserna,
  hur varje uppgift hämtas och vad som bearbetats. Om-sidan bär friskrivningen och en tydlig
  avgränsning av vad sidan inte ska användas till.
- **FV-03 delvis löst.** Felrapporter tas emot via repots ärendelista — en väg utan kakor och
  utan formulärtjänst. Ska en e-postadress användas i stället är det en rad i `innehall.ts`.
- **Kostnad:** +0,3 kB gzip i kritiska vägen (160,0 → 160,3 kB av 180). Själva sidorna väger
  5,7 kB JS och 1,0 kB CSS i en egen chunk som bara den som öppnar en sida hämtar.
- **`arenm.se` är inte bortkopplat.** Vill man senare peka ut till riktiga sidor där är det tre
  `href` och tre `data-sida` i `index.html`; `src/sidor/ids.test.ts` fångar om de inte stämmer.
- **Verifierat 2026-09-24:** öppning via meny, sidfot och delad adress, internt hopp mellan
  sidorna, Escape som stänger och återställer titel och adress, ljust och mörkt läge, 375 px
  bredd utan horisontell scroll på dokumentet, inga konsolfel. 73 tester gröna.

## Alternativ som valdes bort

- **Riktiga sidor på arenm.se.** Det som ADR-13 beslutade. Kvarstår som möjlighet, men skulle
  betyda att policyn för den här sajten lever i en annan sajts publiceringskedja — och fram till
  dess ingen policy alls.
- **Egna adresser här (`/om`, `/kallor`, `/integritet`).** Skulle bryta ensidesarkitekturen,
  kräva egna byggposter och ladda om kartan för en textsida.
- **Allt i sidfotens `<details>`.** Sidfoten är en list; en integritetspolicy med rubriker och
  en attributionsmatris får inte plats där utan att listen slutar vara en list.
