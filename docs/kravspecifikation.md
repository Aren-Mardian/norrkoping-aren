# Kravspecifikation — Norrköpingskartan

**En öppen, snabb och tillgänglig kartportal för Norrköpings kommuns invånare och besökare**

| Fält | Värde |
|---|---|
| Dokument-ID | KRAV-NKPG-001 |
| Version | 1.0 |
| Status | Utkast för granskning |
| Datum | 2026-09-15 |
| Författare | Aren Mardian (systemvetare, GIS/fullstack) |
| Projektägare | Aren Mardian |
| Målplattform | `https://arenm.se/projekt/norrkoping` |
| Utvecklingsmiljö | Lokal (`localhost`) → preview-deploy → produktion |
| Budgetram | 0 SEK löpande kostnad (domän `arenm.se` redan ägd) |
| Typ av projekt | Oberoende portfolio-/samhällsnytteprojekt. **Inte** en officiell tjänst från Norrköpings kommun. |

### Revisionshistorik

| Version | Datum | Ändring | Av |
|---|---|---|---|
| 0.1 | 2026-09-15 | Första utkast, kravinsamling | AM |
| 1.0 | 2026-09-15 | Komplett kravbild, arkitektur, juridisk analys, testplan | AM |

### Kravnotation

| Prefix | Betyder |
|---|---|
| `FK-nn` | Funktionellt krav |
| `NFK-nn` | Icke-funktionellt krav |
| `DK-nn` | Datakrav |
| `IK-nn` | Integrations-/API-krav |
| `UX-nn` | Användarupplevelse-/gränssnittskrav |
| `JK-nn` | Juridiskt/licensmässigt krav |
| `TK-nn` | Test-/verifieringskrav |

**Prioritering enligt MoSCoW:** `M` = Must have (release 1.0 blockeras utan), `S` = Should have, `C` = Could have, `W` = Won't have (denna release, men dokumenterat).

Varje krav har ett **acceptanskriterium** som är objektivt verifierbart. Krav utan mätbart acceptanskriterium är inte ett krav — det är en önskan, och hör hemma i bilaga D.

---

## Innehåll

1. [Inledning och syfte](#1-inledning-och-syfte)
2. [Mål, intressenter och framgångskriterier](#2-mål-intressenter-och-framgångskriterier)
3. [Omfattning och avgränsningar](#3-omfattning-och-avgränsningar)
4. [Systemarkitektur](#4-systemarkitektur)
5. [Datakällor, licenser och juridiska förutsättningar](#5-datakällor-licenser-och-juridiska-förutsättningar)
6. [Datamodell och innehållsstyrning](#6-datamodell-och-innehållsstyrning)
7. [Funktionella krav](#7-funktionella-krav)
8. [Icke-funktionella krav](#8-icke-funktionella-krav)
9. [UX-, gränssnitts- och kartografikrav](#9-ux--gränssnitts--och-kartografikrav)
10. [Integrations- och API-krav](#10-integrations--och-api-krav)
11. [Test, verifiering och kvalitetssäkring](#11-test-verifiering-och-kvalitetssäkring)
12. [Leveransplan och milstolpar](#12-leveransplan-och-milstolpar)
13. [Risker och riskhantering](#13-risker-och-riskhantering)
14. [Förvaltning och vidareutveckling](#14-förvaltning-och-vidareutveckling)
- [Bilaga A — Arkitekturbeslut (ADR)](#bilaga-a--arkitekturbeslut-adr)
- [Bilaga B — Geodetiska parametrar](#bilaga-b--geodetiska-parametrar)
- [Bilaga C — Attributionsmatris](#bilaga-c--attributionsmatris)
- [Bilaga D — Idébank utanför release 1.0](#bilaga-d--idébank-utanför-release-10)
- [Bilaga E — Ordlista](#bilaga-e--ordlista)
- [Bilaga F — Källor](#bilaga-f--källor)

---

## 1. Inledning och syfte

### 1.1 Bakgrund

Norrköpings kommun hade 145 002 invånare den 31 augusti 2026 och ett besöksnäringsutbud som spänner från Kolmårdens djurpark och Industrilandskapet till Himmelstalunds hällristningar och Arkösunds skärgård. Kommunen publicerar i dag begränsat med öppna geodata — i huvudsak fastighetsuttag, stompunkter och geotekniska undersökningar via `geoteknik.norrkoping.se` — och saknar en lättviktig, publik kartportal som samlar "vad ska jag göra här och var badar jag bäst" på ett ställe.

Samtidigt är statliga geodata i Sverige i praktiken gratis sedan Lantmäteriets värdefulla datamängder blev avgiftsfria. Det gör det möjligt att bygga en professionell kartportal utan licenskostnad.

### 1.2 Syfte

Projektet har två samverkande syften som båda måste uppfyllas:

**S1 — Samhällsnytta.** Ge Norrköpings invånare och besökare ett snabbt, tillgängligt och reklamfritt verktyg för att hitta de mest sevärda platserna och de bästa badplatserna i kommunen, med korrekt geografisk information och aktuell badvattenstatus.

**S2 — Kompetensdemonstration.** Demonstrera kompetens inom GIS och fullstackutveckling på en nivå som är direkt granskningsbar av en rekryterande GIS-samordnare, kommunal GIS-ingenjör eller teknisk lead: korrekt hantering av referenssystem och projektioner, tjänstekonsumtion (WMTS/WMS/WFS/REST), datamodellering, prestandaoptimering, tillgänglighet, säkerhet och juridisk efterlevnad.

> **Designprincip som följer av S2:** Där ett enklare alternativ finns men ett mer korrekt finns också, väljs det korrekta och motiveras i dokumentationen. Ett exempel är mätning i projicerat referenssystem i stället för Web Mercator (se [NFK-12](#nfk-12) och [Bilaga B](#bilaga-b--geodetiska-parametrar)) — den skillnaden är närmare **92 %** i Norrköpings latitud och är exakt den typen av fel en erfaren granskare letar efter.

### 1.3 Dokumentets målgrupp

Dokumentet skrivs för tre läsare samtidigt: utvecklaren själv (som implementationsunderlag och backlog-källa), en teknisk granskare (som bevis på systematik), och en eventuell framtida samarbetspart hos kommunen eller besöksnäringen (som beskrivning av vad tjänsten är och inte är).

---

## 2. Mål, intressenter och framgångskriterier

### 2.1 Primära användargrupper (personas)

| ID | Persona | Situation | Primärt behov | Kritisk begränsning |
|---|---|---|---|---|
| P1 | **Lina, 34, Norrköpingsbo** | Söndagsförmiddag i juli, ska bada med barnen | "Vilket bad är rent och nära just nu?" | Mobil, 4G, en hand ledig, solsken på skärmen |
| P2 | **Markus & Ida, turister** | Två dagar i Norrköping, bil, inget lokalkännedom | "Vad får vi inte missa, och i vilken ordning?" | Utländskt SIM, dyr data, engelska |
| P3 | **Sven, 71, invånare** | Vill hitta tillgängliga badplatser med ramp och parkering | Tydlig text, stora klickytor, filtrera på tillgänglighet | Skärmläsare eller 200 % zoom |
| P4 | **Amina, kommunal GIS-ingenjör** | Utvärderar tjänsten/utvecklaren | Se referenssystem, datakällor, aktualitet, mätverktyg | Granskar kritiskt; upptäcker genvägar |
| P5 | **Jon, rekryterande teknisk chef** | 90 sekunder på sajten innan nästa kandidat | Omedelbar visuell kvalitet + möjlighet att gräva djupt | Otålig; bounce vid >3 s laddtid |

### 2.2 Projektmål

| ID | Mål | Mätetal | Måltillstånd vid lansering |
|---|---|---|---|
| M1 | Snabbhet på riktig mobil | Largest Contentful Paint, 4G, mid-tier Android | ≤ 1,8 s (mål 1,2 s) |
| M2 | Mätbar kvalitet | Lighthouse mobil, alla fyra kategorier | ≥ 95 |
| M3 | Tillgänglighet | WCAG 2.2 nivå AA, automatiskt + manuellt test | 0 kritiska axe-fel, manuell tangentbords- och skärmläsargenomgång godkänd |
| M4 | Löpande kostnad | SEK/månad utöver befintlig domän | 0 |
| M5 | Geodetisk korrekthet | Avvikelse i mätverktyg mot kontrollsträcka | ≤ 0,5 % och ≤ 1 m per 1 000 m |
| M6 | Datafärskhet | Badvattenstatus | Max 24 h gammal vid visning, ålder alltid utskriven |
| M7 | Juridisk efterlevnad | Villkorsgenomgång per datakälla | 100 % av visade lager har dokumenterad licens och attribution |
| M8 | Kompetenssignal | Extern granskning | Projektet kan förklaras i detalj på 10 minuter i en teknisk intervju |

### 2.3 Framgångskriterier efter lansering (6 månader)

- S1: Minst 500 unika sessioner under en badsäsong, mätt cookielöst.
- S2: Projektet fungerar som samtalsunderlag i minst tre tekniska intervjuer.
- Noll incidenter där API-nyckel, token eller personuppgift läckt.
- Noll klagomål om att tjänsten förväxlats med kommunens officiella tjänst.

---

## 3. Omfattning och avgränsningar

### 3.1 Inom omfattning (release 1.0)

- Publik webbplats, responsiv, under `arenm.se/projekt/norrkoping`.
- Snabb landningsvy med karta över Norrköpings kommun och kuraterat innehåll.
- **Kärnfunktion A:** Topp 10 mest sevärda/besökta platser i kommunen.
- **Kärnfunktion B:** Topp 3 badplatser, rankade på renhet och kvalitet, samt samtliga övriga badplatser i kommunen med aktuell status.
- **Kärnfunktion C:** Origo-baserat verktygsläge för mätning, ritning, koordinatavläsning, utskrift och lagerhantering.
- Bakgrundskartor från Lantmäteriet (topografisk webbkarta, ortofoto) samt fallback-bakgrund.
- Sök på plats- och adressnivå inom kommunen.
- Två språk: svenska och engelska.
- PWA med offlinestöd för kommunens yta.
- Metodik- och källsida som redovisar hur rankningar tagits fram.

### 3.2 Utanför omfattning (release 1.0)

| Vad | Varför |
|---|---|
| Användarkonton, inloggning, profiler | Ingen funktion kräver det; ökar GDPR-yta och driftkostnad |
| Användargenererat innehåll (recensioner, bilder) | Moderering, ansvar för publicerat material, GDPR |
| Realtidsdata från kommunens verksamhetssystem | Kräver avtal och integration som inte finns |
| Betalfunktioner, bokning, biljetter | Utanför syftet, kräver PCI-hänsyn |
| Rutt- och navigeringsmotor (turn-by-turn) | Gratis alternativ är antingen begränsade eller kräver serverdrift; se Bilaga D |
| Server med databas (PostGIS i drift) | Bryter mot 0-kr-kravet; all geodatabearbetning sker i förväg, offline |
| Kommunens logotyp eller kommunvapen | Skyddad beteckning, se [JK-04](#jk-04) |

### 3.3 Antaganden

- Domänen `arenm.se` och nuvarande deploy-kedja (Vite + statisk hosting) är tillgänglig och kan utökas med en underkatalog och en serverless-funktion inom kostnadsfri nivå.
- Lantmäteriets avgiftsfria produkter fortsätter vara avgiftsfria under projektets livslängd; behörighet beviljas för privatperson via Geotorget.
- Projektet drivs av en person på deltid.

### 3.4 Beroenden

| Beroende | Kritikalitet | Alternativ vid bortfall |
|---|---|---|
| Lantmäteriet Geotorget-behörighet | Hög | OpenStreetMap-baserad bakgrundskarta (självhostade vektortiles) |
| Havs- och vattenmyndighetens badplats-API | Hög för kärnfunktion B | Nedfryst ögonblicksbild med tydlig åldersmärkning |
| Statisk hosting med serverless-funktion på fri nivå | Hög | Cloudflare Pages + Workers, fri nivå |
| SMHI öppna data | Låg | Dölj vädermodul |

---

## 4. Systemarkitektur

### 4.1 Arkitekturprinciper

| # | Princip | Konsekvens |
|---|---|---|
| A1 | **Statiskt först** | All HTML, CSS, JS och all kuraterad geodata är förbyggda filer på CDN. Ingen server renderar sidor. |
| A2 | **Ingen hemlighet i klienten** | Varje anrop som kräver token går via en edge-proxy. Klientbundlen får aldrig innehålla en nyckel. |
| A3 | **Tung bearbetning sker offline** | Höjdmodeller, isokroner, förenklade geometrier och hillshade beräknas en gång i QGIS/GDAL och checkas in som statiska artefakter. |
| A4 | **Progressiv laddning** | Landningsvyn laddar bara det som syns. Origo-verktygsläget laddas först när användaren efterfrågar det. |
| A5 | **Degraderar aldrig till vit skärm** | Varje extern källa har ett definierat fallback-beteende och en synlig statusindikator. |
| A6 | **Härkomst är en förstklassig egenskap** | Varje lager och varje POI bär källa, licens, aktualitet och lägesosäkerhet i datamodellen — inte bara i en fotnot. |

### 4.2 Logisk arkitektur

```
┌─────────────────────────────────────────────────────────────────────┐
│  KLIENT (webbläsare)                                                │
│                                                                     │
│  ┌───────────────────────┐        ┌──────────────────────────────┐  │
│  │  Skal (eget, Vite/TS) │        │  Verktygsläge (Origo)        │  │
│  │  • Landningsvy        │ lazy   │  • Mät längd/area/höjd       │  │
│  │  • Topp 10-karta      │ ─────▶ │  • Rita & exportera          │  │
│  │  • Badvy + status     │ import │  • Koordinater, sharemap     │  │
│  │  • Sök, filter, i18n  │        │  • Utskrift, legend, lager   │  │
│  │  ~150–250 kB gzip     │        │  ~lazy-chunk, egen route     │  │
│  └───────────┬───────────┘        └──────────────┬───────────────┘  │
│              └──────────── OpenLayers-kärna ─────┘                  │
│                            proj4js: EPSG:3006 / 3010                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Service Worker: tile-cache (kommunens bbox), statusdata SWR  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS, egen origin, strikt CSP
┌────────────────────────────▼────────────────────────────────────────┐
│  EDGE (serverless-funktioner, fri nivå)                             │
│  /api/tiles/:layer/:z/:y/:x   → signerar mot Lantmäteriet, cachar    │
│  /api/bad/status              → HaV, normaliserar, cachar 1 h        │
│  /api/vader                   → SMHI punktprognos, cachar 30 min     │
│  Referer-lås · rate limit · s-maxage · stale-while-revalidate        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
        ┌────────────────────┼─────────────────────┬─────────────────┐
        ▼                    ▼                     ▼                 ▼
┌───────────────┐  ┌──────────────────┐  ┌────────────────┐  ┌─────────────┐
│ Lantmäteriet  │  │ Havs- och vatten-│  │ SMHI öppna     │  │ Statiska    │
│ Geotorget     │  │ myndigheten      │  │ data           │  │ artefakter  │
│ WMTS/WMS      │  │ Badplatsen API   │  │ prognos-API    │  │ (GeoJSON,   │
│ ortofoto/topo │  │ GeoJSON + detalj │  │                │  │ PMTiles,    │
└───────────────┘  └──────────────────┘  └────────────────┘  │ hillshade)  │
                                                              └─────────────┘
                                         ▲
                              byggs offline i QGIS/GDAL/Python
                              (OSM, Wikidata, RAÄ, egen kuratering)
```

### 4.3 Vald teknisk lösning

| Lager | Val | Motivering |
|---|---|---|
| Byggverktyg | Vite + TypeScript | Samma kedja som `arenm.se`, snabb HMR, bra code splitting och `build.rollupOptions` för manuella chunkar |
| Kartkärna | OpenLayers (via Origo) | Origo bygger på OpenLayers; en delad kärna undviker två kartbibliotek i samma bundle |
| Verktygsläge | Origo (BSD 2-clause) | Ger mät-, rit-, dela-, utskrifts- och lagerkontroller som kommunal standard utan egenutveckling |
| Projektionsstöd | proj4js | EPSG:3006 och EPSG:3010 är inte inbyggda i OpenLayers och måste definieras explicit |
| Vektorlagring | Statisk GeoJSON (små lager) + PMTiles (stora lager) | PMTiles kräver ingen tile-server — en fil på CDN med Range-requests |
| Edge-funktioner | Serverless-funktioner på hostingplattformens fria nivå | Enda platsen där Lantmäteriet-token får finnas |
| i18n | Egna JSON-kataloger, ingen tung i18n-runtime | Två språk motiverar inte 40 kB bibliotek |
| Analys | Cookielös, självhostad eller inbyggd i hostingplattformen | GDPR utan samtyckesbanner |

> **Arkitekturell nyckelpunkt:** Origo är ett komplett "desktop-like"-ramverk. Att låta hela publika sajten vara en Origo-app skulle göra M1 och M2 svåra att nå. Därför är Origo isolerat till en egen route (`/verktyg`) med egen lazy-laddad chunk, medan landningsvyn är ett eget lättviktigt skal. Origo-koden får inte importeras i landningsvyns kritiska väg. Detta verifieras automatiskt, se [TK-05](#tk-05).

### 4.4 Miljöer

| Miljö | URL | Syfte | Data |
|---|---|---|---|
| Lokal | `http://localhost:5173` | Utveckling | Mockade tiles vid behov, riktiga statiska GeoJSON |
| Preview | Auto-deploy per pull request | Granskning, Lighthouse CI | Samma som prod, separat token |
| Produktion | `https://arenm.se/projekt/norrkoping` | Publik | Riktig |

**Krav på lokalt läge:** Projektet ska kunna köras lokalt utan giltig Lantmäteriet-token. Saknas token används automatiskt en fallback-bakgrundskarta och en tydlig utvecklingsbanner visas. Detta är [FK-33](#fk-33).

---

## 5. Datakällor, licenser och juridiska förutsättningar

### 5.1 Översikt

| ID | Källa | Innehåll | Åtkomst | Kostnad | Licens/villkor |
|---|---|---|---|---|---|
| DS-1 | Lantmäteriet, Topografisk webbkarta Visning (+ översiktlig) | Bakgrundskarta | WMTS/WMS via Geotorget | 0 kr | Avgiftsfri; kräver konto + behörighet + accepterade villkor |
| DS-2 | Lantmäteriet, Ortofoto Visning | Flygbild | WMTS/WMS via Geotorget | 0 kr | Som ovan |
| DS-3 | Lantmäteriet, Höjddata / markhöjdmodell | Terräng, hillshade | Nedladdning (STAC) | 0 kr | Som ovan; bearbetas offline |
| DS-4 | Lantmäteriet, Ortnamn | Ortnamnssök | API/nedladdning | 0 kr | Som ovan |
| DS-5 | Havs- och vattenmyndigheten, Badplatsen API | Badplatser, klassificering, provsvar, algblomning, vattentemperatur | REST/GeoJSON | 0 kr | Öppna data; användarvillkorsavtal ska accepteras |
| DS-6 | SMHI öppna data, meteorologisk prognos | Temperatur, vind, nederbörd, molnighet | REST, ingen nyckel | 0 kr | Öppna data |
| DS-7 | OpenStreetMap | POI-geometrier, gångnät, faciliteter | Overpass/Geofabrik-uttag, offline | 0 kr | **ODbL 1.0 — share-alike på databaser** |
| DS-8 | Wikidata / Wikipedia | Beskrivningar, bilder, identifierare | REST, ingen nyckel | 0 kr | CC0 (Wikidata) / CC BY-SA (text) |
| DS-9 | Riksantikvarieämbetet, K-samsök / Fornsök | Fornlämningar, hällristningar | API | 0 kr | Öppna data |
| DS-10 | Norrköpings kommun, öppna kartdata | Fastighetsuttag, stompunkter | E-tjänst, DWG | 0 kr | Kontrolleras per uttag |
| DS-11 | SCB öppna geodata | Statistikgrundade lager (t.ex. tätortsgränser) | Nedladdning | 0 kr | Öppna data |
| DS-12 | Egen kuratering | Rankning, texter, motiveringar | Repo | 0 kr | Upphovsrätt Aren Mardian |

### 5.2 Krav på datakällehantering

<a id="jk-01"></a>
**JK-01 (M) — Villkorsgenomgång före publicering.** Innan ett lager publiceras i produktion ska dess licens, attributionskrav och eventuella begränsningar dokumenteras i `data/SOURCES.md` och i lagrets metadata.
*Acceptanskriterium:* Varje lager i lagerkonfigurationen har fälten `license`, `licenseUrl`, `attribution`, `retrieved` och `terms` ifyllda. CI-jobb felar om något fält saknas.

<a id="jk-02"></a>
**JK-02 (M) — Attribution är synlig och beständig.** Attribution för aktiva lager visas alltid i kartvyn och får inte kunna döljas permanent.
*Acceptanskriterium:* Attributionskontrollen är synlig i alla vyportsbredder ≥ 320 px och återkommer vid lagerbyte. Manuell kontroll mot [Bilaga C](#bilaga-c--attributionsmatris).

<a id="jk-03"></a>
**JK-03 (M) — ODbL-efterlevnad för OpenStreetMap-härledda data.** Data som härleds från OSM och publiceras som fil ska publiceras under ODbL med tydlig källangivelse; produced works (t.ex. renderade bilder) attribueras enligt OSM:s riktlinjer.
*Acceptanskriterium:* `data/derived/` innehåller `LICENSE-ODbL` och varje härledd fil har `"license": "ODbL-1.0"` i sina metadata.

<a id="jk-04"></a>
**JK-04 (M) — Ingen förväxling med kommunen.** Tjänsten får inte använda Norrköpings kommuns logotyp, kommunvapen eller grafiska profil, och får inte utformas så att den kan uppfattas som officiell.
*Acceptanskriterium:* Sidfot och Om-sida innehåller på båda språken en tydlig friskrivning: *"Ett oberoende projekt av Aren Mardian. Inte en officiell tjänst från Norrköpings kommun."* Ingen kommunal logotyp förekommer i repot.

<a id="jk-05"></a>
**JK-05 (M) — Google Maps Platform-innehåll får inte lagras eller visas på annan karta.**
Detta är projektets enskilt viktigaste juridiska begränsning och påverkar kärnfunktion A direkt.

Google Maps Platform Service Specific Terms innehåller två klausuler som är oförenliga med en Lantmäteriet-baserad karta:

1. **"No Use With Non-Google Maps"** (bl.a. § 14.2 för Places API, § 6.2 för Geocoding): innehåll från dessa tjänster får inte visas tillsammans med en icke-Google-karta.
2. **Cachningsbegränsning** (bl.a. § 14.3 för Places API): koordinater m.m. får inte lagras längre än 30 kalenderdagar. Undantaget är `place_id`, som får cachas tills vidare.

**Konsekvens:** Betyg, recensionsantal, popularitetsmått, foton, öppettider och koordinater hämtade från Google Maps/Places **får inte** kopieras in i projektets GeoJSON och visas ovanpå Lantmäteriets bakgrundskarta. Det gäller oavsett om hämtningen sker via API eller manuellt.

**Vad som är tillåtet och därför ska göras i stället:**

- Använd Google som **researchverktyg** för att bilda dig en uppfattning — precis som du skulle använda en guidebok — men publicera aldrig Googles data.
- Bygg rankningen på en **egen, dokumenterad redaktionell metodik** med belägg från källor som får återpubliceras (se [DK-05](#dk-05)).
- Hämta **geometrin** från OpenStreetMap, Lantmäteriets Ortnamn eller egen GNSS-mätning i fält — inte från Google.
- Hämta **beskrivningar** från Wikidata/Wikipedia (med korrekt licensangivelse) eller skriv dem själv.

*Acceptanskriterium:* Kodgranskning och datagranskning visar noll fält med ursprung Google Maps Platform i publicerade datafiler. `data/SOURCES.md` innehåller ett uttryckligt avsnitt som redogör för detta beslut.

> **Kommentar:** Den här begränsningen är inte ett hinder — den är en möjlighet. En transparent metodiksida som visar *varför* en plats hamnat på plats 3 är mer intressant för både besökare och en granskande arbetsgivare än en oförklarad siffra från en tredjepart.

<a id="jk-06"></a>
**JK-06 (M) — Bildrättigheter.** Varje publicerad bild ska ha känt ursprung, licens och fotografkredit.
*Acceptanskriterium:* Inga bilder utan `credit` och `license` i datamodellen. Personer får inte vara identifierbara i förgrunden utan samtycke.

<a id="jk-07"></a>
**JK-07 (S) — Lantmäteriets villkor för visningstjänster.** Åtkomstvillkoren för respektive avgiftsfri produkt ska läsas i sin helhet vid behörighetsansökan och sammanfattas i `data/SOURCES.md`, inklusive eventuella begränsningar för vidareförmedling via egen proxy.
*Acceptanskriterium:* Sammanfattning finns och är daterad. Om villkoren förbjuder proxy-mönstret enligt [IK-01](#ik-01) ska arkitekturen justeras innan lansering.

---

## 6. Datamodell och innehållsstyrning

### 6.1 Referenssystem

| Användning | Referenssystem | EPSG |
|---|---|---|
| Kartvisning och tile-matrix | SWEREF 99 TM | 3006 |
| Lokalt kommunalt system (visning/inmatning) | SWEREF 99 16 30 | 3010 |
| Lagring i GeoJSON-filer | WGS 84 | 4326 |
| **Längd- och areamätning** | SWEREF 99 TM, med geodetisk kontrollberäkning | 3006 |
| Höjd | RH 2000 | — |
| Förbjudet för mätning | Web Mercator | 3857 |

Se [Bilaga B](#bilaga-b--geodetiska-parametrar) för beräknade värden och felanalys.

### 6.2 Datamodell — sevärdhet (POI)

Kanonisk lagring: `data/poi/top10.geojson`, `EPSG:4326`, RFC 7946.

```jsonc
{
  "type": "Feature",
  "id": "nkpg-poi-003",
  "geometry": { "type": "Point", "coordinates": [16.1859, 58.5873] },
  "properties": {
    "slug": "industrilandskapet",
    "rank": 3,                          // 1–10, unikt
    "name":    { "sv": "Industrilandskapet", "en": "The Industrial Landscape" },
    "summary": { "sv": "…max 160 tecken…", "en": "…" },
    "body":    { "sv": "…markdown, max 1200 tecken…", "en": "…" },
    "rationale": {                      // DK-05: varför denna placering
      "sv": "Riksintresse för kulturmiljövård; …",
      "en": "…"
    },
    "evidence": [                        // belägg som FÅR publiceras
      { "metric": "besökare/år", "value": 250000, "year": 2025,
        "source": "…", "url": "https://…", "license": "…" }
    ],
    "category": "industriarv",           // attraktion|natur|kultur|industriarv|utsikt|bad
    "themes": ["familj", "regnväder", "gratis"],
    "season": ["01","02","03","04","05","06","07","08","09","10","11","12"],
    "fee": "gratis",                     // gratis|avgift|delvis
    "openingHours": "Mo-Su 00:00-24:00", // OSM opening_hours-syntax
    "accessibility": {
      "wheelchair": "yes",               // yes|limited|no|unknown
      "parking": true, "toilet": true, "hearingLoop": false
    },
    "transit": { "stopName": "…", "walkMinutes": 6 },
    "images": [
      { "src": "/img/poi/industrilandskapet-800.avif", "width": 800,
        "alt": { "sv": "…", "en": "…" },
        "credit": "Förnamn Efternamn", "license": "CC BY-SA 4.0",
        "licenseUrl": "https://…" }
    ],
    "links": {
      "official": "https://…",
      "wikidata": "Q1234567",
      "osm": "way/123456789"
    },
    "provenance": {                      // A6: härkomst är förstklassig
      "geometrySource": "OpenStreetMap",
      "geometryLicense": "ODbL-1.0",
      "positionAccuracyM": 5,
      "curatedBy": "Aren Mardian",
      "updated": "2026-09-15",
      "reviewDue": "2027-03-15"
    }
  }
}
```

### 6.3 Datamodell — badplats

Kanonisk lagring: `data/bad/badplatser.geojson` (statisk grunddata) + dynamisk status via `/api/bad/status`.

```jsonc
{
  "type": "Feature",
  "id": "nkpg-bad-004",
  "geometry": { "type": "Point", "coordinates": [16.28, 58.60] },
  "properties": {
    "slug": "lindobadet",
    "name": { "sv": "Lindöbadet", "en": "Lindö beach" },
    "waterBody": "Bråviken",
    "havId": "SE0…",                    // NUTSKOD/id från HaV, nyckel mot API
    "isTop3": true, "top3Rank": 2,
    "top3Rationale": { "sv": "…", "en": "…" },
    "type": "hav",                       // hav|sjö|å
    "facilities": {
      "sand": true, "jetty": true, "changingRoom": true, "toilet": true,
      "ramp": false, "parking": true, "kiosk": false, "playground": true,
      "lifebuoy": true, "dogFriendly": false
    },
    "accessibility": { "wheelchair": "limited", "accessibleParking": true },
    "provenance": {
      "geometrySource": "Havs- och vattenmyndigheten",
      "facilitiesSource": "Norrköpings kommun + OpenStreetMap",
      "positionAccuracyM": 15,
      "updated": "2026-09-15"
    }
  }
}
```

Dynamiskt statusobjekt (normaliserat av edge-funktionen):

```jsonc
{
  "havId": "SE0…",
  "classification": "utmärkt",          // utmärkt|bra|tillfredsställande|dålig|ej klassificerat
  "classificationSeason": 2025,
  "latestSample": { "date": "2026-09-08", "result": "tjänligt" },
  "algae": { "status": "ingen", "observed": null },
  "advisory": null,                      // t.ex. "avrådan från bad"
  "waterTemperatureC": 16.2,
  "waterTemperatureAt": "2026-09-14T08:00:00Z",
  "fetchedAt": "2026-09-15T06:03:11Z",
  "stale": false
}
```

### 6.4 Datakrav

<a id="dk-01"></a>
**DK-01 (M) — Schemavaliderad geodata.** All statisk geodata valideras mot JSON Schema och RFC 7946 i CI.
*Acceptanskriterium:* `npm run validate:data` felar vid ogiltig GeoJSON, saknat obligatoriskt fält, dubblerad `rank` eller koordinat utanför kommunens bounding box (se [Bilaga B](#bilaga-b--geodetiska-parametrar)).

<a id="dk-02"></a>
**DK-02 (M) — Koordinatordning och referenssystem.** GeoJSON lagras alltid i EPSG:4326 med ordningen longitud, latitud.
*Acceptanskriterium:* Valideringen avvisar filer med `crs`-medlem eller med koordinatpar som ligger utanför `[15,58]`–`[18,59]`.

<a id="dk-03"></a>
**DK-03 (M) — Lägesosäkerhet ska anges.** Varje geometri har `provenance.positionAccuracyM`.
*Acceptanskriterium:* Fältet finns på 100 % av objekten; UI visar värdet i objektets detaljvy.

<a id="dk-04"></a>
**DK-04 (M) — Aktualitet ska visas, inte antas.** Varje statusvärde visas tillsammans med sin ålder.
*Acceptanskriterium:* Badvattenstatus äldre än 24 h märks "uppdaterad för X timmar sedan"; äldre än 7 dygn märks visuellt som inaktuell.

<a id="dk-05"></a>
**DK-05 (M) — Transparent rankningsmetodik.** Rankningen av Topp 10 och Topp 3 ska vara reproducerbar från publicerade kriterier.
*Acceptanskriterium:* Sidan `/metod` beskriver viktade kriterier och varje objekt har ifyllt `rationale` samt minst ett `evidence`-objekt med publicerbar källa.

**Föreslagen viktning för Topp 10** (justeras av dig, men ska vara publicerad):

| Kriterium | Vikt | Belägg som får publiceras |
|---|---|---|
| Besöksvolym / regional betydelse | 30 % | Årsredovisningar, kommunens besöksstatistik, turismrapporter |
| Kulturhistoriskt eller naturvärde | 25 % | Riksintresse, RAÄ-registrering, naturreservatsbeslut |
| Tillgänglighet (kollektivtrafik, avgift, öppettider) | 20 % | Egen fältkontroll, OSM, officiella sidor |
| Året-runt-användbarhet | 15 % | Egen bedömning, öppettider |
| Geografisk spridning i kommunen | 10 % | Egen beräkning (max 4 objekt inom centralorten) |

**Föreslagen viktning för Topp 3 badplatser** — med objektiv grunddata i botten:

| Kriterium | Vikt | Källa |
|---|---|---|
| Badvattenklassificering senaste säsong | 40 % | HaV (utmärkt=100, bra=75, tillfredsställande=40, dålig=0) |
| Historik utan otjänliga prov (5 år) | 25 % | HaV provsvar |
| Faciliteter och tillgänglighet | 20 % | Kommunen + OSM |
| Frekvens av algblomningsanmärkningar | 15 % | HaV |

<a id="dk-06"></a>
**DK-06 (S) — Fullständig badplatsförteckning.** Samtliga badplatser som kommunen registrerat ska finnas i datasetet, inte bara topp 3.
*Acceptanskriterium:* Antalet objekt matchar HaV:s förteckning för Norrköpings kommun (per 2026-09: ett tjugotal, inklusive bl.a. Arkösund Badholmarna, Nordanskog, Sköldvik, Lindöbadet, Kvarsebobadet, Sörsjöbadet, Ågelsjön, Ensjöbadet, Bolenbadet, Böksjöbadet, Dalbystrand, Lillsjöbadet, Mårängsbadet, Gransjönäsbadet, Skarsätter vid Glan, Stegeborgsgården). Avvikelse loggas med orsak.

<a id="dk-07"></a>
**DK-07 (M) — Avrådanden ska alltid visas.** Badplatser där kommunen avråder från bad (t.ex. Inre hamnen/Motala ström) ska aldrig kunna visas som rekommenderade.
*Acceptanskriterium:* Objekt med `advisory != null` renderas med varningssymbol, exkluderas ur Topp 3 och kan inte döljas av filter.

<a id="dk-08"></a>
**DK-08 (S) — Innehåll som data, inte som kod.** Texter och rankningar ändras i datafiler, inte i komponenter.
*Acceptanskriterium:* Att ändra ordningen i Topp 10 kräver enbart ändring i `top10.geojson` och en ny build.

---

## 7. Funktionella krav

### 7.1 Kartgrund och navigering

<a id="fk-01"></a>
**FK-01 (M) — Bakgrundskarta från Lantmäteriet.** Kartan ska visa Lantmäteriets topografiska webbkarta som standardbakgrund.
*Acceptanskriterium:* Kartan renderar korrekta tiles i EPSG:3006 från zoomnivå som motsvarar hela kommunen ned till kvartersnivå, utan synliga sömmar eller feletiketter.

<a id="fk-02"></a>
**FK-02 (M) — Bakgrundsväxlare.** Användaren ska kunna växla mellan minst: topografisk karta, ortofoto och en mörk/neutral bakgrund.
*Acceptanskriterium:* Växling sker utan omladdning av sidan, tar < 300 ms till första synliga tile och behåller aktuell vy och aktiva lager.

<a id="fk-03"></a>
**FK-03 (M) — Startvy låst till kommunen.** Kartan startar centrerad över Norrköpings kommun med hela kommunytan synlig.
*Acceptanskriterium:* Startextent motsvarar kommunens bounding box (se Bilaga B) med 5 % marginal, på alla skärmstorlekar.

<a id="fk-04"></a>
**FK-04 (S) — Panoreringsbegränsning.** Kartan begränsar panorering till en generös buffert runt kommunen.
*Acceptanskriterium:* Användaren kan inte panorera längre än 25 km utanför kommungränsen; ett tryck på "Återställ vy" återgår till startextent.

<a id="fk-05"></a>
**FK-05 (M) — Kommungräns synlig.** Norrköpings kommungräns renderas som eget lager.
*Acceptanskriterium:* Gränsen syns i alla bakgrundslägen med tillräcklig kontrast och kan tändas/släckas.

<a id="fk-06"></a>
**FK-06 (M) — Min position.** Användaren kan visa sin egen position.
*Acceptanskriterium:* Funktionen kräver aktiv användarhandling, visar noggrannhetsradie, och positionen lämnar aldrig klienten. Avslag på behörighet hanteras med förklarande meddelande, inte tyst fel.

<a id="fk-07"></a>
**FK-07 (S) — Skalstock och zoomindikator.** Kartan visar metrisk skalstock och aktuell skala.
*Acceptanskriterium:* Skalstocken är beräknad i EPSG:3006 och stämmer mot kontrollmätning enligt [TK-03](#tk-03).

### 7.2 Kärnfunktion A — Topp 10

<a id="fk-08"></a>
**FK-08 (M) — Topp 10 på kartan.** De tio platserna visas som numrerade, tydligt urskiljbara symboler.
*Acceptanskriterium:* Symbolerna är läsbara på mobil (minst 44×44 px träffyta), kolliderar inte vid startzoom, och numret motsvarar `rank`.

<a id="fk-09"></a>
**FK-09 (M) — Synkroniserad lista och karta.** En lista visar samma tio platser i rangordning; hovring/fokus i listan markerar objektet på kartan och tvärtom.
*Acceptanskriterium:* Markering sker inom 100 ms; markering fungerar med enbart tangentbord.

<a id="fk-10"></a>
**FK-10 (M) — Detaljvy.** Klick på en plats öppnar en panel med namn, bild, sammanfattning, motivering, praktisk information (avgift, öppettider, tillgänglighet, kollektivtrafik) och källor.
*Acceptanskriterium:* Panelen är en bottom sheet på < 768 px och en sidopanel på ≥ 768 px, går att stänga med Escape och flyttar fokus korrekt.

<a id="fk-11"></a>
**FK-11 (M) — Djuplänk per plats.** Varje plats har en delbar URL.
*Acceptanskriterium:* `…/norrkoping/plats/industrilandskapet` öppnar kartan zoomad till platsen med panelen öppen, även vid kall laddning. URL:en har unik `<title>` och Open Graph-bild.

<a id="fk-12"></a>
**FK-12 (M) — Motivering och belägg visas.** Varje plats visar varför den rankats som den gjort.
*Acceptanskriterium:* `rationale` och minst ett `evidence`-objekt renderas i detaljvyn med klickbar källa. Inget Google-härlett innehåll förekommer ([JK-05](#jk-05)).

<a id="fk-13"></a>
**FK-13 (S) — Temafilter.** Användaren kan filtrera på tema (familj, gratis, inomhus/regnväder, natur, kultur).
*Acceptanskriterium:* Filter uppdaterar både karta och lista utan sidladdning och återspeglas i URL:en.

<a id="fk-14"></a>
**FK-14 (C) — Föreslagen rundtur.** En knapp genererar en ordnad dagsrutt genom valda platser.
*Acceptanskriterium:* Ordningen beräknas på förberäknade avstånd (statisk matris), visas som numrerad lista och kan exporteras som GPX.

### 7.3 Kärnfunktion B — Badplatser

<a id="fk-15"></a>
**FK-15 (M) — Topp 3 badplatser framhävda.** De tre högst rankade badplatserna presenteras separat och tydligt.
*Acceptanskriterium:* Visas med rank, motivering och aktuell status direkt i landningsvyn under badsäsong (maj–september) utan extra klick.

<a id="fk-16"></a>
**FK-16 (M) — Aktuell badvattenstatus.** För varje badplats visas klassificering, senaste provsvar, eventuell algblomning och eventuell avrådan.
*Acceptanskriterium:* Värdena hämtas via `/api/bad/status`, är max 24 h gamla vid visning och märks med ålder enligt [DK-04](#dk-04).

<a id="fk-17"></a>
**FK-17 (M) — Varningar kan inte döljas.** Avrådan och algblomning visas alltid, oavsett filter och zoom.
*Acceptanskriterium:* Enligt [DK-07](#dk-07). Verifieras med automatiskt test.

<a id="fk-18"></a>
**FK-18 (S) — Vattentemperatur och väder.** Badplatsens vattentemperatur visas när den finns, tillsammans med lufttemperatur, vind och nederbördsrisk för de närmaste timmarna.
*Acceptanskriterium:* Väderdata hämtas från SMHI via proxy, cachas ≤ 30 min och visar prognostidpunkt.

<a id="fk-19"></a>
**FK-19 (S) — Badindex.** Ett sammanvägt, förklarat index (0–100) per badplats för "hur bra är det att bada här idag".
*Acceptanskriterium:* Indexets formel är publicerad på `/metod`, komponenterna visas var för sig, och indexet döljs när underlaget är inaktuellt. Indexet får aldrig ersätta eller dölja en avrådan.

<a id="fk-20"></a>
**FK-20 (S) — Tillgänglighetsfilter.** Filtrera badplatser på ramp, tillgänglig parkering, toalett, sandstrand, brygga, lekplats.
*Acceptanskriterium:* Filtren motsvarar fält i datamodellen och kombineras med AND; antalet träffar annonseras för skärmläsare via `aria-live`.

<a id="fk-21"></a>
**FK-21 (C) — Närmaste bad.** "Hitta närmast mig" sorterar badplatser efter fågelvägsavstånd från användarens position.
*Acceptanskriterium:* Avståndet beräknas geodetiskt (inte planärt i Web Mercator) och avrundas till 100 m.

### 7.4 Kärnfunktion C — Origo-verktygsläge

<a id="fk-22"></a>
**FK-22 (M) — Separat verktygsläge.** Origo-applikationen nås via egen route och laddas först vid behov.
*Acceptanskriterium:* `/projekt/norrkoping/verktyg` laddar Origo-chunken; inget Origo-bundlat script laddas på landningsvyn ([TK-05](#tk-05)).

<a id="fk-23"></a>
**FK-23 (M) — Längdmätning.** Användaren kan mäta sträcka längs en bruten linje.
*Acceptanskriterium:* Resultat i meter/kilometer med rätt antal värdesiffror; avvikelse ≤ 0,5 % mot kontrollsträcka enligt [TK-03](#tk-03); delsträckor visas.

<a id="fk-24"></a>
**FK-24 (M) — Areamätning.** Användaren kan mäta area på polygon.
*Acceptanskriterium:* Resultat i m²/hektar/km²; avvikelse ≤ 1 % mot kontrollpolygon; areaberäkning sker inte i Web Mercator.

<a id="fk-25"></a>
**FK-25 (S) — Buffert och snappning.** Mätverktyget stödjer buffert runt geometri och snappning mot ritade objekt.
*Acceptanskriterium:* Buffertradie anges i meter och renderas korrekt i EPSG:3006.

<a id="fk-26"></a>
**FK-26 (M) — Koordinatavläsning.** Aktuell muspekare/markering visar koordinater i minst SWEREF 99 TM, SWEREF 99 16 30 och WGS 84 (decimalgrader och grader-minuter-sekunder).
*Acceptanskriterium:* Värdena stämmer mot kontrollpunkter i Bilaga B inom 0,1 m i plan.

<a id="fk-27"></a>
**FK-27 (M) — Rita och exportera.** Användaren kan rita punkter, linjer, polygoner och text, och exportera som GeoJSON.
*Acceptanskriterium:* Exporterad fil validerar mot RFC 7946 och öppnas korrekt i QGIS med rätt referenssystem.

<a id="fk-28"></a>
**FK-28 (S) — Dela karta (sharemap).** Aktuell vy, lager och ritade objekt kan delas som länk.
*Acceptanskriterium:* Länken återskapar vyn exakt; ingen persondata kodas i URL:en; URL-längd hålls under 2 000 tecken (annars komprimerad payload).

<a id="fk-29"></a>
**FK-29 (S) — Utskrift.** Kartan kan skrivas ut/exporteras till PDF med skalstock, norrpil, titel och attribution.
*Acceptanskriterium:* Utskriften innehåller korrekt skala och samtliga attributioner enligt [JK-02](#jk-02).

<a id="fk-30"></a>
**FK-30 (S) — Lagerhanterare med metadata.** Legenden visar lagerträd, opacitetsreglage och per lager: källa, licens, aktualitet.
*Acceptanskriterium:* Metadata kommer från lagerkonfigurationen, inte hårdkodad text.

<a id="fk-31"></a>
**FK-31 (C) — Dra och släpp egen fil.** Användaren kan släppa en GeoJSON/GPX-fil på kartan för visning.
*Acceptanskriterium:* Filen läses enbart lokalt i webbläsaren, laddas aldrig upp, och en tydlig notis förklarar detta.

### 7.5 Sök, språk och generella funktioner

<a id="fk-32"></a>
**FK-32 (M) — Sök.** Sökfältet hittar platser i Topp 10, badplatser och ortnamn/adresser inom kommunen.
*Acceptanskriterium:* Första träfflista visas inom 200 ms för lokala data; träffar grupperas per typ; tangentbordsnavigering med piltangenter och Enter fungerar.

<a id="fk-33"></a>
**FK-33 (M) — Fungerande utvecklingsläge utan token.** Applikationen startar lokalt utan Lantmäteriet-token.
*Acceptanskriterium:* `npm run dev` utan `.env` startar med fallback-bakgrund och en synlig utvecklingsbanner; inga konsolfel.

<a id="fk-34"></a>
**FK-34 (M) — Tvåspråkighet.** Hela gränssnittet och allt kuraterat innehåll finns på svenska och engelska.
*Acceptanskriterium:* Språkval styrs av URL-prefix (`/sv/`, `/en/`), respekterar `Accept-Language` vid första besök, och `<html lang>` sätts korrekt. Inga hårdkodade strängar i komponenter.

<a id="fk-35"></a>
**FK-35 (S) — PWA med offlineläge.** Sajten kan installeras och fungerar utan nätverk inom kommunens yta.
*Acceptanskriterium:* Efter ett besök online fungerar kartan offline för zoomnivåerna som täcker kommunen, samt Topp 10 och badplatslistan (med tydlig "offline — data kan vara inaktuell"-markering).

<a id="fk-36"></a>
**FK-36 (S) — Mörkt läge.** Gränssnitt och kartstil följer `prefers-color-scheme` och kan växlas manuellt.
*Acceptanskriterium:* Kontrastkrav uppfylls i båda lägena; kartsymboler byter stil, inte bara UI-chrome.

<a id="fk-37"></a>
**FK-37 (M) — Statussida för datakällor.** En sida visar varje källas tillgänglighet och senaste lyckade hämtning.
*Acceptanskriterium:* `/status` visar per källa: OK/degraderad/nere, tidpunkt och vilken fallback som används.

<a id="fk-38"></a>
**FK-38 (C) — Tidsresa med ortofoto.** Swipe-jämförelse mellan historiskt och aktuellt ortofoto.
*Acceptanskriterium:* Swipe-reglaget fungerar med mus, touch och tangentbord; årtal visas för båda sidorna.

<a id="fk-39"></a>
**FK-39 (C) — Terrängskuggning.** Ett hillshade-lager från Lantmäteriets höjdmodell, förberäknat offline.
*Acceptanskriterium:* Levereras som statiska tiles/PMTiles, ökar inte initial laddning och kan tändas/släckas.

<a id="fk-40"></a>
**FK-40 (C) — Hällristnings- och fornlämningslager.** Fornlämningar från Riksantikvarieämbetet, med Himmelstalund framhävt.
*Acceptanskriterium:* Lagret är klustrat, har egen legend och länkar till Fornsök.

---

## 8. Icke-funktionella krav

### 8.1 Prestanda

<a id="nfk-01"></a>
**NFK-01 (M) — Core Web Vitals.**
*Acceptanskriterium (landningsvy, mobil, simulerad 4G, CPU-strypning 4×):*

| Mätetal | Gräns | Mål |
|---|---|---|
| Largest Contentful Paint | ≤ 1,8 s | ≤ 1,2 s |
| Interaction to Next Paint | ≤ 200 ms | ≤ 120 ms |
| Cumulative Layout Shift | ≤ 0,05 | ≤ 0,02 |
| Time to First Byte | ≤ 400 ms | ≤ 200 ms |
| Tid till interaktiv karta | ≤ 2,5 s | ≤ 1,8 s |

<a id="nfk-02"></a>
**NFK-02 (M) — Bundlebudget.** Budgeten är hård och bryter bygget.

| Resurs | Budget (gzip) |
|---|---|
| Kritisk JS på landningsvy | ≤ 180 kB |
| Kritisk CSS | ≤ 25 kB |
| Total överföring, första vy (exkl. tiles) | ≤ 350 kB |
| Topp 10-GeoJSON | ≤ 40 kB |
| Badplats-GeoJSON | ≤ 60 kB |
| Origo-chunk (lazy) | ≤ 900 kB |
| Bilder i första vy | ≤ 150 kB, AVIF/WebP med `srcset` |

*Acceptanskriterium:* `size-limit`-kontroll i CI felar vid överskridande.

<a id="nfk-03"></a>
**NFK-03 (M) — Tile-ekonomi.** Antalet tile-anrop i startvyn hålls lågt.
*Acceptanskriterium:* ≤ 30 tile-requests för startvy på 390×844 px; tile-storlek 256 eller 512 px väljs efter mätning; `tilePixelRatio` anpassas till skärmens DPR.

<a id="nfk-04"></a>
**NFK-04 (M) — Cachestrategi.**
*Acceptanskriterium:* Statiska tillgångar har innehållshashade filnamn och `Cache-Control: public, max-age=31536000, immutable`. Tiles via proxy har `s-maxage` ≥ 7 dagar. Statusdata har `s-maxage=3600, stale-while-revalidate=86400`. Dokument har `no-cache` med ETag.

<a id="nfk-05"></a>
**NFK-05 (S) — Vektorprestanda.** Punktlager med fler än 300 objekt klustras eller renderas via `WebGLPointsLayer`.
*Acceptanskriterium:* Panorering håller ≥ 50 fps på mid-tier mobil med alla lager tända.

<a id="nfk-06"></a>
**NFK-06 (S) — Ingen tredjepartsbegäran i kritisk väg.** Inga typsnitt, script eller bilder från tredjepartsdomän vid första rendering.
*Acceptanskriterium:* Nätverkspanelen visar enbart egen origin fram till LCP. Typsnitt självhostas och laddas med `font-display: swap` samt subsettas till latin + svenska tecken.

<a id="nfk-07"></a>
**NFK-07 (S) — Datareduktion.** Geometrier förenklas för sin visningsskala.
*Acceptanskriterium:* Douglas–Peucker/Visvalingam tillämpas i byggsteget med tolerans per zoomintervall; koordinater avrundas till 6 decimaler (≈ 0,1 m).

### 8.2 Tillgänglighet

<a id="nfk-08"></a>
**NFK-08 (M) — WCAG 2.2 nivå AA.**
*Acceptanskriterium:* Noll kritiska eller allvarliga fel i axe-core på samtliga vyer. Manuell genomgång dokumenterad i `docs/tillganglighet.md`.

<a id="nfk-09"></a>
**NFK-09 (M) — Kartan har ett likvärdigt icke-visuellt alternativ.** All information som finns på kartan ska gå att nå utan att se kartan.
*Acceptanskriterium:* Listvyn innehåller samma objekt, samma attribut och samma varningar som kartan. Kartan har `role="application"` med instruktionstext och kan panoreras/zoomas med tangentbord.

<a id="nfk-10"></a>
**NFK-10 (M) — Kontrast och träffytor.**
*Acceptanskriterium:* Textkontrast ≥ 4,5:1 (≥ 3:1 för stor text), grafiska objekt och kartsymboler ≥ 3:1 mot underlaget i båda kartstilarna. Alla interaktiva ytor ≥ 44×44 px (WCAG 2.2 Target Size, AA-nivå 24×24 px överträffas medvetet).

<a id="nfk-11"></a>
**NFK-11 (S) — Rörelse och zoom.** `prefers-reduced-motion` respekteras; sidan fungerar vid 200 % zoom och 320 px bredd utan horisontell scroll.
*Acceptanskriterium:* Manuellt verifierat på tre vyportsbredder.

### 8.3 Geodetisk korrekthet

<a id="nfk-12"></a>
**NFK-12 (M) — Mätning sker aldrig planärt i Web Mercator.**
*Acceptanskriterium:* Kodgranskning visar att alla längd- och areaberäkningar antingen sker i EPSG:3006 eller med geodetisk beräkning på ellipsoiden. Automatiskt test enligt [TK-03](#tk-03).

*Bakgrund:* I Norrköpings latitud (≈ 58,59° N) är Web Mercators skalfaktor ungefär 1,92. En sträcka på 1 000 m mäts till cirka **1 914 m** om beräkningen görs planärt i EPSG:3857; för area blir felet cirka **+268 %**. Samma sträcka i EPSG:3006 ger 999,66 m, alltså 0,03 % avvikelse.

<a id="nfk-13"></a>
**NFK-13 (S) — Transformationskedjan är dokumenterad.** Varje transformation mellan referenssystem ska vara medveten och dokumenterad.
*Acceptanskriterium:* `docs/referenssystem.md` listar proj4-definitioner, källa för dem och förväntad noggrannhet.

<a id="nfk-14"></a>
**NFK-14 (S) — Höjdangivelser anger system.** Om höjd visas anges alltid RH 2000.
*Acceptanskriterium:* Ingen höjdsiffra visas utan systemangivelse.

### 8.4 Säkerhet

<a id="nfk-15"></a>
**NFK-15 (M) — Inga hemligheter i klienten.**
*Acceptanskriterium:* Sökning i produktionsbundlen efter token-, nyckel- och URL-mönster ger noll träffar. CI-jobb med hemlighetsskanning (t.ex. `gitleaks`) körs på varje push och på hela historiken.

<a id="nfk-16"></a>
**NFK-16 (M) — Strikt Content Security Policy.**
*Acceptanskriterium:* `default-src 'self'; img-src 'self' data: blob:; connect-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; upgrade-insecure-requests`. Inga `unsafe-inline` eller `unsafe-eval`. Rapportering aktiverad under introduktionsperiod.

<a id="nfk-17"></a>
**NFK-17 (M) — Säkerhetsheaders.**
*Acceptanskriterium:* `Strict-Transport-Security` (≥ 1 år, includeSubDomains), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` som nekar allt utom `geolocation=(self)`. Betyg A eller bättre i extern headerkontroll.

<a id="nfk-18"></a>
**NFK-18 (M) — Proxy-missbruksskydd.** Edge-proxyn får inte bli en öppen relä för Lantmäteriets tjänster.
*Acceptanskriterium:* Proxyn kontrollerar `Origin`/`Referer`, begränsar tillåtna lager och zoomnivåer, begränsar bounding box till kommunens område med buffert, och tillämpar hastighetsbegränsning per IP. Avvisade anrop loggas utan att lagra full IP.

<a id="nfk-19"></a>
**NFK-19 (S) — Beroendehygien.**
*Acceptanskriterium:* `npm audit` utan kända höga/kritiska sårbarheter vid release; automatiska beroendeuppdateringar aktiverade; låsfil incheckad; antal direkta produktionsberoenden hålls under 15.

<a id="nfk-20"></a>
**NFK-20 (S) — Ingen kod från CDN i produktion.** Alla bibliotek bundlas från `node_modules`.
*Acceptanskriterium:* Noll `<script src="https://…">` mot extern domän i byggd HTML.

### 8.5 Integritet och GDPR

<a id="nfk-21"></a>
**NFK-21 (M) — Ingen samtyckesbanner behövs, för att inget samtycke krävs.**
*Acceptanskriterium:* Inga cookies sätts. Ingen `localStorage` används för identifierande data. Webbanalys är cookielös och aggregerad, utan möjlighet att spåra individ.

<a id="nfk-22"></a>
**NFK-22 (M) — Positionsdata stannar i klienten.**
*Acceptanskriterium:* Användarens koordinater skickas aldrig till någon server, inklusive egen. Avståndsberäkningar sker lokalt. Detta anges i integritetspolicyn.

<a id="nfk-23"></a>
**NFK-23 (M) — Tredjepartsanrop döljs bakom proxy.** Besökarens IP exponeras inte för Lantmäteriet, HaV eller SMHI.
*Acceptanskriterium:* Nätverkspanelen visar enbart anrop till egen origin. Proxyn vidarebefordrar inte `X-Forwarded-For`.

<a id="nfk-24"></a>
**NFK-24 (M) — Integritetspolicy på båda språken.**
*Acceptanskriterium:* `/integritet` beskriver vilka data som behandlas (i praktiken: serverloggar hos hostingleverantören, aggregerad statistik), rättslig grund, lagringstid och kontaktuppgift.

### 8.6 Drift, robusthet och övervakning

<a id="nfk-25"></a>
**NFK-25 (M) — Graciös degradering.** Varje extern källa har definierat fallback-beteende.
*Acceptanskriterium:*

| Bortfall | Beteende |
|---|---|
| Lantmäteriet WMTS | Byt automatiskt till fallback-bakgrund, visa diskret notis |
| HaV-API | Visa senast cachade status med åldersmärkning; om > 7 dygn, dölj status men behåll badplatserna |
| SMHI | Dölj vädermodul utan layoutförskjutning |
| Allt externt | Topp 10, badplatslista, sök och verktyg fungerar på statiska data |

<a id="nfk-26"></a>
**NFK-26 (S) — Syntetisk övervakning.** Ett schemalagt jobb kontrollerar att sajten och varje datakälla svarar.
*Acceptanskriterium:* Schemalagt CI-jobb (kostnadsfri nivå) kör dagligen, uppdaterar `/status` och larmar via e-post vid fel två körningar i rad.

<a id="nfk-27"></a>
**NFK-27 (M) — Kostnadsspärr.** Ingen konfiguration får kunna generera en faktura.
*Acceptanskriterium:* Endast tjänster på kostnadsfri nivå används; inga betalkortsuppgifter kopplas till projektets konton; hostingens funktionsanrop och bandbredd övervakas mot 70 % av fri kvot.

<a id="nfk-28"></a>
**NFK-28 (S) — Deploy är reproducerbar och återställbar.**
*Acceptanskriterium:* Bygget är deterministiskt från låsfil; varje release har tagg; återgång till föregående version tar < 5 minuter.

### 8.7 Underhållbarhet och kod

<a id="nfk-29"></a>
**NFK-29 (M) — TypeScript i strikt läge.**
*Acceptanskriterium:* `strict: true`, `noUncheckedIndexedAccess: true`; noll `any` i egen kod utan kommenterad motivering.

<a id="nfk-30"></a>
**NFK-30 (S) — Kodkvalitetsgrindar.** Linting, formatering och typkontroll körs i CI.
*Acceptanskriterium:* Pull request kan inte mergas med fel från ESLint, Prettier eller `tsc --noEmit`.

<a id="nfk-31"></a>
**NFK-31 (S) — Dokumentation som någon annan kan följa.**
*Acceptanskriterium:* `README.md` beskriver uppstart på under 10 minuter från ren maskin; `docs/` innehåller arkitektur, referenssystem, datakällor, tillgänglighet och ADR:er.

### 8.8 SEO, delbarhet och hållbarhet

<a id="nfk-32"></a>
**NFK-32 (S) — Indexerbart innehåll.** Varje plats och badplats har en serverlevererad HTML-representation.
*Acceptanskriterium:* Statiskt förrenderade sidor per objekt med unik `<title>`, meta-beskrivning, `hreflang` för sv/en och `TouristAttraction`/`Beach`-strukturerad data enligt schema.org.

<a id="nfk-33"></a>
**NFK-33 (S) — Delningsbilder.** Varje objekt har en Open Graph-bild.
*Acceptanskriterium:* Bilderna genereras i byggsteget (1 200×630 px) och innehåller platsnamn — inte tredjepartsbilder utan licens.

<a id="nfk-34"></a>
**NFK-34 (C) — Låg klimatpåverkan.**
*Acceptanskriterium:* Uppskattad överföring per sidvisning ≤ 500 kB inklusive tiles vid normal användning; siffran redovisas öppet på Om-sidan tillsammans med metod.

---

## 9. UX-, gränssnitts- och kartografikrav

### 9.1 Informationsarkitektur

```
/projekt/norrkoping/                 Landningsvy: karta + Topp 10 + badstatus
  ├── /plats/<slug>                  Detaljsida per sevärdhet (förrenderad)
  ├── /bad                           Alla badplatser, lista + karta
  │     └── /bad/<slug>              Detaljsida per badplats
  ├── /verktyg                       Origo-verktygsläge (lazy)
  ├── /metod                         Rankningsmetodik och viktning
  ├── /kallor                        Datakällor, licenser, aktualitet
  ├── /status                        Datakällornas hälsa
  ├── /om                            Om projektet + friskrivning
  └── /integritet                    Integritetspolicy
```

<a id="ux-01"></a>
**UX-01 (M) — Kartan syns direkt.** Landningsvyn visar karta utan att användaren behöver scrolla eller klicka.
*Acceptanskriterium:* Kartcontainern upptar ≥ 50 % av vyporten på mobil ovanför vikningen och har reserverad höjd (ingen layoutförskjutning).

<a id="ux-02"></a>
**UX-02 (M) — Enhandsdrift på mobil.** Alla primära kontroller är nåbara i skärmens nedre tredjedel.
*Acceptanskriterium:* Zoom, "min position", bakgrundsväxlare och panelhandtag ligger inom tummens räckvidd på en 6,1-tumsskärm.

<a id="ux-03"></a>
**UX-03 (M) — Bottom sheet på mobil, sidopanel på desktop.**
*Acceptanskriterium:* Panelen har tre lägen (dold/halv/full), kan dras, stängs med Escape, och fokushantering följer WAI-ARIA dialogmönster.

<a id="ux-04"></a>
**UX-04 (M) — Ingen "vit skärm" under laddning.** Skelettvy visas medan data hämtas.
*Acceptanskriterium:* Skelett visas inom 200 ms och ersätts utan layoutförskjutning (CLS-bidrag = 0).

<a id="ux-05"></a>
**UX-05 (S) — Designsystem med tokens.** Färger, typografi, radier och avstånd definieras som CSS-variabler.
*Acceptanskriterium:* Inga hårdkodade färgvärden i komponenter; ljus och mörk palett härleds ur samma tokens.

<a id="ux-06"></a>
**UX-06 (S) — Kartografiskt genomtänkt symbolisering.** Topp 10-symboler, badplatssymboler och statusfärger utgör ett sammanhållet system.
*Acceptanskriterium:* Statusfärger fungerar för de vanligaste färgseendevariationerna — status kodas alltid med både färg **och** form/ikon/text, aldrig enbart färg.

<a id="ux-07"></a>
**UX-07 (S) — Läsbar kartetikettering.** Etiketter kolliderar inte och har halo mot bakgrunden.
*Acceptanskriterium:* Vid startzoom och tre inzoomningsnivåer syns inga överlappande etiketter i manuell kontroll.

<a id="ux-08"></a>
**UX-08 (C) — Guidad introduktion.** Ett kort, avfärdbart onboarding-steg förklarar de tre kärnfunktionerna.
*Acceptanskriterium:* Visas högst en gång per enhet, kan hoppas över med ett tryck, blockerar aldrig innehåll.

<a id="ux-09"></a>
**UX-09 (C) — Berättarläge för Industrilandskapet.** En scrollstyrd guidad tur med kamerarörelser mellan platser.
*Acceptanskriterium:* Respekterar `prefers-reduced-motion` och har ett textbaserat alternativ.

---

## 10. Integrations- och API-krav

### 10.1 Edge-endpoints

<a id="ik-01"></a>
**IK-01 (M) — Tile-proxy.** `GET /api/tiles/:layer/:z/:y/:x.:ext`
*Acceptanskriterium:*
- Signerar mot Lantmäteriet med token som enbart finns i miljövariabel på edge.
- Tillåter endast vitlistade `layer` och `z` inom definierat intervall.
- Avvisar anrop utanför kommunens buffrade bounding box med 400.
- Sätter `Cache-Control: public, s-maxage=604800, stale-while-revalidate=86400`.
- Svarar 503 med `Retry-After` vid uppströmsfel, aldrig 200 med trasig bild.
- Median svarstid vid cache-miss ≤ 400 ms.

<a id="ik-02"></a>
**IK-02 (M) — Badstatus.** `GET /api/bad/status`
*Acceptanskriterium:*
- Hämtar samtliga badplatser för Norrköpings kommun från HaV och normaliserar till statusschemat i [6.3](#63-datamodell--badplats).
- Returnerar alltid `fetchedAt` och `stale`.
- Cachar `s-maxage=3600, stale-while-revalidate=86400`.
- Vid uppströmsfel returneras senast kända svar med `stale: true` och HTTP 200, alternativt 503 om ingen cache finns.
- Svarets storlek ≤ 30 kB gzip.

<a id="ik-03"></a>
**IK-03 (S) — Väder.** `GET /api/vader?lat=&lon=`
*Acceptanskriterium:* Koordinater avrundas till 2 decimaler innan vidaresändning (cachevänligt och integritetsvänligt), endast koordinater inom kommunens bbox accepteras, `s-maxage=1800`.

<a id="ik-04"></a>
**IK-04 (M) — Enhetlig felmodell.** Alla endpoints svarar med samma felformat.
*Acceptanskriterium:* `{ "error": { "code": "UPSTREAM_UNAVAILABLE", "message": "…", "retryAfter": 300 } }` och korrekt HTTP-status. Inga stacktraces eller uppströms-URL:er i svaret.

<a id="ik-05"></a>
**IK-05 (S) — Ingen personuppgift i loggar.**
*Acceptanskriterium:* Edge-loggar innehåller inte fullständig IP, `User-Agent` i klartext eller koordinater med högre upplösning än 2 decimaler.

### 10.2 Klientsidig integration

<a id="ik-06"></a>
**IK-06 (M) — Timeout och avbrytbarhet.** Alla nätverksanrop har timeout och kan avbrytas.
*Acceptanskriterium:* `AbortController` används; timeout 8 s för data, 5 s för tiles; avbrutna anrop loggar inte fel.

<a id="ik-07"></a>
**IK-07 (S) — Omförsök med backoff.** Transienta fel görs om.
*Acceptanskriterium:* Max 2 omförsök med exponentiell backoff och jitter; aldrig omförsök på 4xx.

<a id="ik-08"></a>
**IK-08 (S) — Service Worker-strategi.**
*Acceptanskriterium:* Tiles: cache-first med kvottak (≤ 60 MB, LRU-utrensning). Statusdata: stale-while-revalidate. Appskal: precache. Versionshanterad cache som rensas vid ny release.

---

## 11. Test, verifiering och kvalitetssäkring

### 11.1 Teststrategi

| Nivå | Verktyg | Omfattning | När |
|---|---|---|---|
| Statisk analys | TypeScript, ESLint, Prettier | All kod | Varje push |
| Dataintegritet | Ajv + GeoJSON-schema, egna regler | All statisk geodata | Varje push |
| Enhetstest | Vitest | Transformationer, beräkningar, rankningslogik, normalisering | Varje push |
| Integrationstest | Vitest + MSW | Edge-endpoints med mockade uppströmssvar | Varje push |
| E2E | Playwright | Kritiska användarflöden på Chromium, Firefox, WebKit | Varje PR |
| Tillgänglighet | axe-core i Playwright | Alla vyer, båda språken, båda teman | Varje PR |
| Prestanda | Lighthouse CI + size-limit | Landningsvy, badvy, verktygsläge | Varje PR |
| Visuell regression | Playwright snapshots | Kartstilar, symboler, paneler | Varje PR |
| Geodetisk kontroll | Egen testsvit | Mätverktyg och transformationer | Varje PR |
| Manuell | Checklista | Skärmläsare, riktig mobil, solljus | Före release |

### 11.2 Verifieringskrav

<a id="tk-01"></a>
**TK-01 (M) — Kritiska flöden i E2E.**
*Acceptanskriterium:* Följande flöden är automatiserade och gröna: (a) öppna sajten → se karta och Topp 10, (b) klicka plats → panel med motivering, (c) dela djuplänk → kall laddning återskapar vyn, (d) öppna badvy → status visas med ålder, (e) öppna verktygsläge → mät sträcka, (f) byt språk → allt innehåll byter språk, (g) offline → sajten fungerar.

<a id="tk-02"></a>
**TK-02 (M) — Transformationstest.**
*Acceptanskriterium:* Kända kontrollpunkter transformeras mellan EPSG:4326, 3006 och 3010 med avvikelse ≤ 0,01 m mot referensvärden i [Bilaga B](#bilaga-b--geodetiska-parametrar).

<a id="tk-03"></a>
**TK-03 (M) — Mätkontroll mot känd sträcka.**
*Acceptanskriterium:* Testet mäter en definierad sträcka på 1 000,000 m (geodetiskt) och kräver resultat inom 1 000 ± 5 m. Ett negativt test verifierar att planär Web Mercator-beräkning ger ≈ 1 914 m och därför avvisas av implementationen.

<a id="tk-04"></a>
**TK-04 (M) — Varningar kan inte döljas.**
*Acceptanskriterium:* Automatiskt test försöker filtrera bort en badplats med aktiv avrådan och verifierar att den ändå visas med varning.

<a id="tk-05"></a>
**TK-05 (M) — Bundle-isolering.**
*Acceptanskriterium:* Test som analyserar byggresultatet verifierar att ingen Origo-modul ingår i landningsvyns entry-chunk och att Origo-chunken bara laddas på `/verktyg`.

<a id="tk-06"></a>
**TK-06 (M) — Hemlighetsskanning.**
*Acceptanskriterium:* `gitleaks` körs på hela git-historiken och på byggartefakter; noll träffar.

<a id="tk-07"></a>
**TK-07 (S) — Prestandagrind i CI.**
*Acceptanskriterium:* Lighthouse CI körs mot preview-deploy; PR blockeras om något värde i [NFK-01](#nfk-01) eller [NFK-02](#nfk-02) överskrids.

<a id="tk-08"></a>
**TK-08 (S) — Länk- och källkontroll.**
*Acceptanskriterium:* Schemalagt jobb kontrollerar alla externa länkar i datafilerna och rapporterar döda länkar.

<a id="tk-09"></a>
**TK-09 (S) — Manuell releasechecklista.**
*Acceptanskriterium:* Dokumenterad checklista genomförd och signerad: skärmläsare (NVDA eller VoiceOver), riktig mobil på 4G, utomhusläsbarhet, utskriftsfunktion, 200 % zoom, mörkt läge, båda språken.

### 11.3 Definition of Done

Ett krav är levererat när: koden är mergad, kravets acceptanskriterium är automatiserat eller manuellt verifierat och dokumenterat, dokumentationen är uppdaterad, prestandabudget och tillgänglighetsgrindar passerats, och funktionen fungerar i preview-deploy på riktig mobil.

---

## 12. Leveransplan och milstolpar

Uppskattning för en person på deltid. Sprintlängd två veckor.

| Sprint | Milstolpe | Leverabler | Krav som stängs |
|---|---|---|---|
| 0 | **Grund** | Geotorget-konto och behörigheter, repo, Vite+TS, CI, deploy-kedja, `/api/tiles`-proxy, CSP och headers | IK-01, NFK-15–17, NFK-27, FK-33 |
| 1 | **Karta står** | OpenLayers i EPSG:3006, Lantmäteriets bakgrunder, växlare, kommungräns, startextent, skalstock | FK-01–07, NFK-12, DK-02 |
| 2 | **Topp 10** | Datamodell, kuratering, symbolisering, lista+karta, detaljpanel, djuplänkar, metodiksida | FK-08–13, DK-01, DK-03, DK-05, JK-05 |
| 3 | **Badplatser** | HaV-integration, statusnormalisering, topp 3, varningar, filter, SMHI | FK-15–20, IK-02–03, DK-06, DK-07 |
| 4 | **Verktygsläge** | Origo integrerat, lazy-route, mät/rita/koordinater/dela/utskrift, lagermetadata | FK-22–30, TK-03, TK-05 |
| 5 | **Polering** | i18n, PWA/offline, mörkt läge, tillgänglighetsgenomgång, prestandaoptimering, SEO och OG-bilder | FK-34–37, NFK-01–11, NFK-32–33 |
| 6 | **Release** | Statussida, dokumentation, ADR:er, manuell checklista, lansering under `arenm.se/projekt/norrkoping` | FK-37, NFK-31, TK-09 |
| 7+ | **Extra** | Hillshade, tidsresa med ortofoto, fornlämningslager, berättarläge, rundtur | FK-14, FK-38–40, UX-09 |

**Kritisk väg:** Sprint 0 är blockerande — utan Geotorget-behörighet finns ingen bakgrundskarta. Ansök om behörighet först av allt, och bygg sprint 1 mot fallback-bakgrunden under tiden.

---

## 13. Risker och riskhantering

| ID | Risk | S | K | Riskvärde | Åtgärd |
|---|---|---|---|---|---|
| R1 | Geotorget-behörighet dröjer eller nekas för privatperson | M | H | Hög | Ansök i sprint 0. Bygg mot fallback-bakgrund från dag ett, så att hela systemet fungerar utan Lantmäteriet |
| R2 | Lantmäteriets villkor tillåter inte proxy-mönstret | L | H | Medel | Läs villkoren vid ansökan ([JK-07](#jk-07)). Alternativ: tokenlös publik tjänst, eller självhostade vektortiles från OSM-uttag |
| R3 | Token läcker till klienten | L | H | Medel | Arkitekturprincip A2, hemlighetsskanning i CI ([TK-06](#tk-06)), rotationsrutin dokumenterad |
| R4 | Proxyn missbrukas och spränger fri kvot | M | M | Medel | Referer-lås, bbox- och zoombegränsning, hastighetsbegränsning, kvotlarm vid 70 % ([NFK-18](#nfk-18), [NFK-27](#nfk-27)) |
| R5 | Google Maps-villkor överträds av misstag | M | H | Hög | Explicit förbud i [JK-05](#jk-05), granskningspunkt i Definition of Done, egen metodik i stället |
| R6 | Origo tynger bundlen och Lighthouse-målen missas | M | M | Medel | Lazy route + isolationstest ([TK-05](#tk-05)); reservplan: eget mätverktyg på OpenLayers |
| R7 | HaV:s API ändras eller upphör | L | M | Låg | Normaliseringslager isolerar förändringen; nedfryst ögonblicksbild som reserv |
| R8 | Inaktuell badstatus leder till felaktig rekommendation | M | H | Hög | Åldersmärkning ([DK-04](#dk-04)), varningar som inte kan döljas ([DK-07](#dk-07)), tydlig friskrivning |
| R9 | Tjänsten förväxlas med kommunens officiella | L | M | Låg | Friskrivning i sidfot och Om-sida ([JK-04](#jk-04)), ingen kommunal grafisk profil |
| R10 | Kuraterat innehåll blir inaktuellt (öppettider, avgifter) | H | M | Hög | `reviewDue` per objekt, halvårsvis genomgång, "senast kontrollerad"-datum synligt för användaren |
| R11 | Projektet dör av ambitionsspridning | H | M | Hög | Strikt MoSCoW; allt utanför Must flyttas till Bilaga D tills release 1.0 är ute |
| R12 | Bilder utan klarlagd licens publiceras | M | M | Medel | [JK-06](#jk-06), CI-kontroll att varje bildpost har `credit` och `license` |

*S = sannolikhet, K = konsekvens, L/M/H = låg/medel/hög.*

---

## 14. Förvaltning och vidareutveckling

<a id="fv-01"></a>
**FV-01 (M) — Innehållsöversyn var sjätte månad.** Öppettider, avgifter, rankningar och länkar granskas enligt `reviewDue`.
*Acceptanskriterium:* Ett schemalagt jobb skapar en påminnelse när något objekt passerat sitt `reviewDue`.

<a id="fv-02"></a>
**FV-02 (M) — Säsongsläge.** Badfunktionerna framhävs maj–september och tonas ned övrig tid.
*Acceptanskriterium:* Beteendet styrs av datum, inte av manuell deploy, och kan överstyras via URL-parameter för demo.

<a id="fv-03"></a>
**FV-03 (S) — Kontaktväg för felrapporter.** Användare kan rapportera fel i data.
*Acceptanskriterium:* Formulär utan cookies (t.ex. befintlig formulärtjänst) eller e-postlänk, med tydlig information om vad som lagras.

<a id="fv-04"></a>
**FV-04 (C) — Öppen källkod.** Repot publiceras med licens och bidragsguide.
*Acceptanskriterium:* MIT eller motsvarande för kod, tydligt separerad från datalicenser; `CONTRIBUTING.md` finns.

<a id="fv-05"></a>
**FV-05 (C) — Dialog med kommunen.** När 1.0 är ute, presentera projektet för kommunens GIS-funktion och besöksnäring.
*Acceptanskriterium:* En kort presentation och en demolänk är framtagna.

---

## Bilaga A — Arkitekturbeslut (ADR)

| ADR | Beslut | Alternativ som valdes bort | Motivering |
|---|---|---|---|
| ADR-01 | Statisk sajt + edge-funktioner | Node-server med PostGIS | 0-kr-kravet; ingen driftbörda; PostGIS behövs bara för bearbetning, som sker offline |
| ADR-02 | Hybrid: eget skal + Origo på egen route | Hela sajten i Origo | Origos bundlestorlek är oförenlig med LCP ≤ 1,8 s; hybriden ger både prestanda och Origo-kompetens |
| ADR-03 | EPSG:3006 som kartprojektion | EPSG:3857 (enklare) | Lantmäteriets tile-matrix är i 3006; mätning i 3857 ger ~92 % längdfel i Norrköping |
| ADR-04 | Tile-proxy på edge | Token direkt i klienten | Token får aldrig exponeras; proxy ger dessutom cache och kvotkontroll |
| ADR-05 | Egen redaktionell rankning | Google Places-baserad popularitet | Googles villkor förbjuder både lagring > 30 dagar och visning på icke-Google-karta |
| ADR-06 | PMTiles för stora vektorlager | GeoServer/tile-server | Ingen serverdrift; en fil på CDN med Range-requests |
| ADR-07 | Förberäknad hillshade | Terrain-RGB i realtid | Lägre klientbelastning, färre anrop, bättre kontroll över kartografin |
| ADR-08 | Cookielös analys | Google Analytics | Undviker samtyckesbanner och tredjepartsöverföring helt |

---

## Bilaga B — Geodetiska parametrar

### B.1 Referenssystem

| System | EPSG | Central­meridian | Skalfaktor | Användning |
|---|---|---|---|---|
| SWEREF 99 TM | 3006 | 15° Ö | 0,9996 | Nationell standard, kartvisning, mätning |
| SWEREF 99 16 30 | 3010 | 16° 30′ Ö | 1,0 | Norrköpings kommunala system |
| WGS 84 | 4326 | — | — | Datalagring (GeoJSON) |
| Web Mercator | 3857 | 0° | varierar | **Får inte användas för mätning** |
| RH 2000 | — | — | — | Höjdsystem |

### B.2 Kontrollvärden (beräknade med PROJ)

Referenspunkt, Norrköping centrum: **58,58734° N, 16,18590° Ö** (WGS 84)

| System | Ost/X | Nord/Y |
|---|---|---|
| SWEREF 99 TM (3006) | 568 944 m | 6 494 713 m |
| SWEREF 99 16 30 (3010) | 131 732 m | 6 496 745 m |

### B.3 Kommunidentitet och bounding box

**Kommunkod:** 0581 (Norrköping, Östergötlands län). Används för filtrering mot HaV:s badplatsdata och SCB:s geodata.

Bounding box nedan är ungefärlig och ska verifieras mot faktisk kommungränsgeometri innan den låser panorering ([FK-04](#fk-04)) och datavalidering ([DK-01](#dk-01)).

| System | Min ost | Min nord | Max ost | Max nord |
|---|---|---|---|---|
| WGS 84 | 15,55° | 58,28° | 17,05° | 58,92° |
| SWEREF 99 TM | 532 300 | 6 460 000 | 618 000 | 6 533 000 |

### B.4 Skalfelsanalys — varför mätprojektionen spelar roll

| Latitud | Web Mercator skalfaktor (1/cos φ) | Längdfel | Areafel |
|---|---|---|---|
| 58,28° N (kommunens sydspets) | 1,902 | +90,2 % | +261 % |
| 58,587° N (centralorten) | 1,919 | +91,9 % | +268 % |
| 58,92° N (kommunens nordspets) | 1,937 | +93,7 % | +275 % |

**Konkret kontrollfall:** En sträcka som geodetiskt är exakt 1 000,000 m i Norrköpings centrum beräknas till:

| Metod | Resultat | Avvikelse |
|---|---|---|
| Planärt i EPSG:3857 | 1 914,0 m | +91,4 % — oacceptabelt |
| Planärt i EPSG:3006 | 999,66 m | −0,034 % — godkänt |
| Geodetiskt på WGS 84-ellipsoiden | 1 000,000 m | referens |

Detta är grunden för [NFK-12](#nfk-12) och testfallet i [TK-03](#tk-03).

### B.5 proj4-definitioner som ska registreras i klienten

```
EPSG:3006  +proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs
EPSG:3010  +proj=tmerc +lat_0=0 +lon_0=16.5 +k=1 +x_0=150000 +y_0=0
           +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs
```

*Definitionerna ska verifieras mot Lantmäteriets officiella parametrar innan produktion ([NFK-13](#nfk-13)).*

---

## Bilaga C — Attributionsmatris

| Lager/data | Attributionstext som ska visas | Visas när |
|---|---|---|
| Topografisk webbkarta | © Lantmäteriet | Lagret är aktivt |
| Ortofoto | © Lantmäteriet | Lagret är aktivt |
| Hillshade (härlett ur höjddata) | Höjddata © Lantmäteriet, bearbetning Aren Mardian | Lagret är aktivt |
| Badplatser och badvattenstatus | Källa: Havs- och vattenmyndigheten | Badvy och badpaneler |
| Väderprognos | Källa: SMHI | Vädermodulen syns |
| POI-geometrier från OSM | © OpenStreetMap-bidragsgivare (ODbL) | Alltid när OSM-härledd geometri visas |
| Beskrivningar från Wikipedia | CC BY-SA 4.0, källa Wikipedia + länk | I respektive textstycke |
| Fornlämningar | Källa: Riksantikvarieämbetet | Lagret är aktivt |
| Fallback-bakgrund | Enligt vald källas villkor | Lagret är aktivt |
| Kuraterat innehåll och rankning | © Aren Mardian | Sidfot |

---

## Bilaga D — Idébank utanför release 1.0

Parkerat medvetet, inte bortglömt. Varje post kräver egen kravskrivning innan den plockas in.

1. **Isokroner** — "vad når du på 15 minuters promenad" från valfri punkt, förberäknat på OSM-gångnät.
2. **Kollektivtrafikintegration** — närmaste hållplats och nästa avgång via ResRobot/Trafiklab fria nivå.
3. **Höjdprofil längs ritad linje** — från Lantmäteriets höjdmodell, bra demonstration av rasteranalys.
4. **Solstånds- och skuggsimulering** — när ligger badplatsen i sol.
5. **3D-vy över Industrilandskapet** — MapLibre terrain eller three.js, kopplar till din befintliga WebGL-kompetens.
6. **Cykelvänliga rutter** — via öppen ruttmotor på fri nivå.
7. **Historisk karta som lager** — Ekonomiska kartan från 1940-talet över dagens karta.
8. **Crowdsourcad badtemperatur** — kräver backend och moderering, därför parkerad.
9. **Vinterläge** — skridskois, pulkabackar, belysta spår.
10. **Öppet API från projektet** — publicera det kuraterade datasetet som ett eget öppet API för andra att bygga på.

---

## Bilaga E — Ordlista

| Term | Förklaring |
|---|---|
| **WMTS** | Web Map Tile Service — standard för förrenderade kartrutor |
| **WMS** | Web Map Service — standard för dynamiskt renderade kartbilder |
| **WFS** | Web Feature Service — standard för vektorobjekt med attribut |
| **SWEREF 99 TM** | Sveriges nationella plana referenssystem, EPSG:3006 |
| **RH 2000** | Sveriges nationella höjdsystem |
| **Origo** | Öppet svenskt kartramverk byggt på OpenLayers, BSD 2-clause |
| **PMTiles** | Enfilsformat för kartrutor som läses med HTTP Range-requests, utan tile-server |
| **ODbL** | Open Database License — OpenStreetMaps licens, med share-alike |
| **LCP / INP / CLS** | Core Web Vitals: laddningstid, interaktionssvar, layoutstabilitet |
| **MoSCoW** | Prioriteringsmodell: Must, Should, Could, Won't |
| **ADR** | Architecture Decision Record — dokumenterat arkitekturbeslut |
| **Isokron** | Yta som kan nås inom en viss restid från en punkt |

---

## Bilaga F — Källor

- [Öppna data | Lantmäteriet](https://www.lantmateriet.se/oppnadata)
- [Avgiftsfria produkter | Lantmäteriet](https://www.lantmateriet.se/sv/geodata/vara-produkter/avgiftsfria-produkter/)
- [Topografisk webbkarta Visning, översiktlig | Lantmäteriet](https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/topografisk-webbkarta-visning-oversiktlig/)
- [Geotorget produktstöd — guider | Lantmäteriet](https://www.lantmateriet.se/sv/geotorget-produktstod/guider/)
- [Öppna dataportalen | Lantmäteriet](https://opendata.lantmateriet.se/)
- [Origo — origo-map/origo på GitHub](https://github.com/origo-map/origo)
- [Origo documentation](https://origo-map.github.io/origo-documentation/latest/)
- [API Badplatser och badvatten | Havs- och vattenmyndigheten](https://www.havochvatten.se/data-kartor-och-rapporter/data-och-statistik/data-och-apier/api-badplatser-och-badvatten.html)
- [Badplatser i Norrköpings kommun | Havs- och vattenmyndigheten](https://www.havochvatten.se/badplatser-och-badvatten/kommuner/badplatser-i-norrkopings-kommun.html)
- [Badplatser | Norrköpings kommun](https://norrkoping.se/se-och-gora/fritid-och-aktiviteter/badplatser)
- [Öppna kartdata och tjänster | Norrköpings kommun](https://norrkoping.se/boende-trafik-och-miljo/lantmateri-och-kartor/oppna-kartdata-och-tjanster)
- [API för väderprognosdata | SMHI](https://www.smhi.se/data/oppna-data/meteorologiska-data/api-for-vaderprognosdata-1.34233)
- [Nya API:er för meteorologiska prognoser och analyser | SMHI](https://www.smhi.se/data/om-smhis-data/uppdateringar-oppna-data/uppdateringar-i-smhis-oppna-data/2025-09-12-nya-apier-for-meteorologiska-prognoser-och-analyser)
- [Google Maps Platform Service Specific Terms | Google Cloud](https://cloud.google.com/maps-platform/terms/maps-service-terms)
- [K-samsöks API | Riksantikvarieämbetet](https://www.raa.se/hitta-information/k-samsok/att-anvanda-k-samsok/api/)
- [SCB:s öppna geodata](https://www.scb.se/vara-tjanster/oppna-data/oppna-geodata/)
- [Befolkningsutveckling, Norrköping — månadsdata | Norrköpings kommun](https://norrkoping.se/kommun-och-politik/om-norrkoping/statistik/statistik-befolkning/befolkningsutveckling-norrkoping-manadsdata)

---

*Slut på kravspecifikation KRAV-NKPG-001 v1.0.*
