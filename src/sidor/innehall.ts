/**
 * Innehållet i Om projektet, Källor och licenser samt Integritet — som **data**, inte som
 * markup (DK-08). Renderaren i dialog.ts bygger DOM av det här; ingen sträng går någonsin
 * genom innerHTML, så innehållet kan inte injicera något och CSP:n behöver inga undantag.
 *
 * Siffror som finns i datafilerna hämtas ur bygget (`__TOPO_FACTS__` m.fl.) i stället för att
 * skrivas av för hand. Då kan sidorna inte påstå något annat än vad som faktiskt levereras
 * (JK-01) — samma princip som sidfoten.
 *
 * Länkar skrivs som [text](url) och tolkas av renderaren. Inget annat märkspråk stöds.
 */

import type { SidaId } from './ids.ts';

export type Block =
  | { t: 'h'; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'dl'; rows: Array<[string, string]> }
  | { t: 'table'; caption?: string; head: string[]; rows: string[][] }
  | { t: 'note'; text: string };

export interface Sida {
  /** Rubrik i dialogen och i dokumenttiteln. */
  title: string;
  /** En mening som sammanfattar sidan, satt i större grad. */
  lead: string;
  blocks: Block[];
  /** Visas längst ned: när innehållet senast gicks igenom. */
  updated: string;
}

const REPO = 'https://github.com/Aren-Mardian/norrkoping-aren';
const GRANSKAD = '2026-09-24';

// ─────────────────────────────────────────────────────────────────────────────

const om: Sida = {
  title: 'Om projektet',
  lead: 'En öppen, snabb och tillgänglig karta över Norrköpings kommun — byggd av en person, på fritiden, av enbart öppna data.',
  blocks: [
    {
      t: 'note',
      text:
        'Det här är **inte** en officiell tjänst från Norrköpings kommun, och har ingen koppling till kommunen. ' +
        'Det är ett oberoende projekt av Aren Mardian.',
    },
    { t: 'h', text: 'Vad sidan visar' },
    {
      t: 'ul',
      items: [
        'Lantmäteriets topografiska karta över hela kommunen, i källans egen upplösning 0,5 m/px.',
        'Kommunens 19 badplatser med badvattenstatus, senaste provsvar och eventuell avrådan från Havs- och vattenmyndigheten, samt väderprognos från SMHI.',
        'Historiska flygbilder från 1960 och 1975.',
        `Sökning bland ${__ORTNAMN_FACTS__.count} ortnamn inom kommunen, med koordinater i SWEREF 99 TM och markhöjd i RH 2000.`,
        'Verktyg för att mäta, rita, läsa koordinater, skriva ut och dela en vy.',
      ],
    },
    { t: 'h', text: 'Varför det finns' },
    {
      t: 'p',
      text:
        'Dels som ett arbetsprov: hela kedjan från Lantmäteriets råa geodata till en publicerad karta, gjord ' +
        'med de krav på prestanda, tillgänglighet och geodetisk korrekthet som en riktig tjänst skulle ha. ' +
        'Dels för att uppgifterna är värda att vara lätta att komma åt — de är redan offentliga, men sällan ' +
        'samlade på ett ställe.',
    },
    { t: 'h', text: 'Hur den är byggd' },
    {
      t: 'dl',
      rows: [
        ['Karta', 'OpenLayers, renderad i SWEREF 99 TM (EPSG:3006) — sajtens enda referenssystem.'],
        [
          'Bakgrundskarta',
          'Ett utsnitt av Lantmäteriets topografiska webbkarta, klippt mot kommungränsen och självhostat som en enda PMTiles-fil. Din webbläsare hämtar bara de rutor som syns och anropar aldrig Lantmäteriet.',
        ],
        [
          'Levande uppgifter',
          'Badvattenstatus, väder, markhöjd och flygbilder hämtas genom sajtens egen proxy. Uppgifterna når aldrig din webbläsare direkt från källan, och källan får aldrig se dig.',
        ],
        ['Verktyg', 'Origo 2.10.0, som laddas in i samma karta först när du trycker på Verktyg — aldrig innan.'],
        ['Drift', 'Statiska filer plus fyra små serverfunktioner. Ingen databas, ingen inloggning, inga kakor.'],
      ],
    },
    { t: 'h', text: 'Vad du inte ska förlita dig på' },
    {
      t: 'p',
      text:
        'Uppgifterna kommer från myndigheters öppna data och kan vara inaktuella eller fel. Badvattenstatus ' +
        'gäller det datum provet togs, inte idag. Bakgrundskartan är ett utsnitt från ett bestämt datum och ' +
        'uppdateras inte löpande. Höjderna är markhöjd i RH 2000 ur en modell, inte en mätning på plats.',
    },
    {
      t: 'note',
      text:
        'Använd inte sidan som underlag för beslut där fel kan skada någon — bad vid avrådan, navigation, ' +
        'projektering eller myndighetsutövning. Gå då till källan. Varje uppgift anger var den kommer ifrån ' +
        'under [Källor och licenser](#kallor).',
    },
    { t: 'h', text: 'Fel i innehållet?' },
    {
      t: 'p',
      text:
        'Hittar du något som är fel — en badplats som saknas, en uppgift som inte stämmer, en länk som är död — ' +
        `är rapporter välkomna via [projektets ärendelista på GitHub](${REPO}/issues). Det kräver ett GitHub-konto ` +
        'men inga kakor här, och ärendet blir synligt för alla.',
    },
    { t: 'h', text: 'Källkod' },
    {
      t: 'p',
      text:
        `Koden är öppen under MIT-licens och finns på [GitHub](${REPO}). Där ligger också kravspecifikationen ` +
        'som styr projektet, besluten bakom arkitekturen och verktygen som bearbetar geodatan.',
    },
    {
      t: 'dl',
      rows: [
        ['Av', 'Aren Mardian — systemvetare, GIS och fullstack'],
        ['Kod', 'MIT'],
        ['Kuraterat innehåll och rankningar', '© Aren Mardian'],
      ],
    },
  ],
  updated: GRANSKAD,
};

// ─────────────────────────────────────────────────────────────────────────────

const kallor: Sida = {
  title: 'Källor och licenser',
  lead: 'Varje uppgift på sidan kommer från en öppen källa. Här står vilken, under vilken licens, hur den hämtas och hur färsk den är.',
  blocks: [
    { t: 'h', text: 'Geodata' },
    {
      t: 'table',
      head: ['Vad', 'Källa och produkt', 'Licens', 'Hur den hämtas'],
      rows: [
        [
          'Bakgrundskarta',
          'Lantmäteriet — Topografisk webbkarta, nedladdning raster',
          'CC BY 4.0',
          `Utsnitt över kommunen, 0,5 m/px, ${__TOPO_FACTS__.size}. Självhostad PMTiles-fil, läses med Range-anrop. Utsnitt från ${__TOPO_FACTS__.date}.`,
        ],
        [
          'Flygbild 1960 och 1975',
          'Lantmäteriet — Ortofoto historiska, visningstjänst (WMS)',
          'CC0',
          'Live, ruta för ruta genom sajtens proxy. 0,5 m/px, svartvitt.',
        ],
        [
          'Kommungräns',
          'Lantmäteriet — Kommun, län och rike',
          'CC BY 4.0',
          `Statisk fil, hämtad ${__KOMMUN_RETRIEVED__} via STAC-API:et. Kommunkod 0581, lägesosäkerhet ca 2 m.`,
        ],
        [
          'Ortnamn',
          'Lantmäteriet — Ortnamn, nedladdning vektor',
          'CC BY 4.0',
          `Sökindex med ${__ORTNAMN_FACTS__.count} namn inom kommunen, hämtat ${__ORTNAMN_FACTS__.date}. Laddas först när du söker.`,
        ],
        [
          'Markhöjd',
          'Lantmäteriet — Markhöjd Direkt',
          'CC BY 4.0',
          'Live genom proxyn, en punkt per anrop. Höjdsystem RH 2000. Bara punkter innanför kommungränsen.',
        ],
        [
          'Badplatser',
          'Havs- och vattenmyndigheten — Badplatsen',
          'CC BY 4.0',
          'Grunddata som statisk fil (19 badplatser), status live genom proxyn med en timmes cache.',
        ],
        [
          'Väder',
          'SMHI — meteorologisk prognos, punktprognos',
          'CC BY 4.0',
          'Live genom proxyn när du öppnar en badplats. Koordinaterna avrundas först till 2 decimaler.',
        ],
        [
          'Reservkarta',
          'OpenStreetMap',
          'ODbL 1.0',
          'Visas bara om den självhostade bakgrundskartan inte svarar, med en synlig notis.',
        ],
      ],
    },
    { t: 'h', text: 'Så anges källorna' },
    {
      t: 'p',
      text:
        'Attributionen syns nere till höger i kartan och gäller de lager som är tända just då. Den går inte ' +
        'att stänga av. Lantmäteriets villkor för öppna data kräver att både upphovsman och licens anges, ' +
        'och licensen är därför länkad i kartan.',
    },
    {
      t: 'table',
      head: ['Lager', 'Text i kartan'],
      rows: [
        ['Topografisk karta', '© Lantmäteriet, CC BY 4.0'],
        ['Kommungräns', '© Lantmäteriet, Kommun, län och rike'],
        ['Flygbild', '© Lantmäteriet, historiska ortofoton 1960 / 1975'],
        ['Badplatser och status', 'Källa: Havs- och vattenmyndigheten'],
        ['Väder', 'Källa: SMHI, med prognosens utgivningstid'],
        ['Reservkarta', '© OpenStreetMap-bidragsgivare'],
      ],
    },
    { t: 'h', text: 'Bearbetning' },
    {
      t: 'p',
      text:
        'Ingen datakälla visas rakt av. Bakgrundskartan är klippt mot kommungränsen — rutorna kopieras ' +
        'oförändrade ur Lantmäteriets fil, utan omkodning, så ingen kvalitet går förlorad. Kommungränsen är ' +
        'förenklad till ungefär 2 meters tolerans. Ortnamnen är filtrerade till kommunen, omprojicerade till ' +
        'SWEREF 99 TM och sammanslagna där flera namn beskriver samma plats. Badplatsernas rangordning räknas ' +
        'fram ur provsvar och algobservationer de senaste fem åren enligt en viktning som står i kartan.',
    },
    {
      t: 'p',
      text:
        `Alla bearbetningssteg är skript i [projektets repo](${REPO}/tree/main/tools) och går att köra om. ` +
        `Fullständiga villkor per källa finns i [data/SOURCES.md](${REPO}/blob/main/data/SOURCES.md).`,
    },
    { t: 'h', text: 'Programvara' },
    {
      t: 'table',
      head: ['Bibliotek', 'Roll', 'Licens'],
      rows: [
        ['OpenLayers 10', 'Kartmotorn', 'BSD 2-clause'],
        ['Origo 2.10.0', 'Verktygsläget — mät, rita, skriv ut, dela', 'BSD 2-clause'],
        ['proj4js', 'Transformation mellan referenssystem', 'MIT'],
        ['PMTiles', 'Läser den självhostade kartfilen med Range-anrop', 'BSD 3-clause'],
      ],
    },
    {
      t: 'note',
      text:
        'Google Maps eller Google Places används inte, varken för kartan eller för underlag till rankningar. ' +
        'Villkoren tillåter varken lagring över tid eller visning på en annan karta.',
    },
  ],
  updated: GRANSKAD,
};

// ─────────────────────────────────────────────────────────────────────────────

const integritet: Sida = {
  title: 'Integritet',
  lead: 'Sidan sätter inga kakor, mäter inget om dig och kräver ingen inloggning. Därför finns heller ingen samtyckesruta.',
  blocks: [
    { t: 'h', text: 'Det korta svaret' },
    {
      t: 'ul',
      items: [
        'Inga kakor och ingen lagring i webbläsaren som följer dig mellan besök.',
        'Ingen besöksmätning, ingen analys, inga annonsnätverk, inga sociala insticksmoduler.',
        'Inget anrop till någon annan domän än den här — inga typsnitt, skript eller bilder utifrån.',
        'Din position lämnar aldrig din webbläsare.',
        'Dina sökningar lämnar aldrig din enhet.',
      ],
    },
    { t: 'h', text: 'Din position' },
    {
      t: 'p',
      text:
        'Knappen för att visa var du är använder webbläsarens positionstjänst, och bara när du trycker på den. ' +
        'Webbläsaren frågar dig om lov först. Positionen används enbart för att rita en punkt på kartan och ' +
        'skickas inte till sajten, till någon myndighet eller till någon annan. Den sparas inte.',
    },
    { t: 'h', text: 'Din sökning' },
    {
      t: 'p',
      text:
        'Ortnamnssöket sker i din webbläsare mot ett index som laddats ned. Det du skriver skickas aldrig ' +
        'någonstans. Först när du väljer en träff hämtas markhöjden för just den punkten.',
    },
    { t: 'h', text: 'Anrop till myndigheter' },
    {
      t: 'p',
      text:
        'Badvattenstatus, väder, markhöjd och flygbilder kommer från Havs- och vattenmyndigheten, SMHI och ' +
        'Lantmäteriet. De anropen görs av sajtens egen server, inte av din webbläsare. Myndigheterna ser ' +
        'därför serverns förfrågan, aldrig din IP-adress och aldrig vad just du tittar på.',
    },
    {
      t: 'p',
      text:
        'För väderprognosen avrundas dessutom koordinaterna till två decimaler, ungefär en kilometer, innan ' +
        'de skickas vidare. Det räcker gott för en prognos och gör förfrågan mindre specifik.',
    },
    { t: 'h', text: 'Vad som ändå registreras' },
    {
      t: 'p',
      text:
        'Sidan ligger hos en webbhotellsleverantör som av drift- och säkerhetsskäl loggar inkommande ' +
        'förfrågningar: IP-adress, tidpunkt, vilken adress som efterfrågades och vilken webbläsare som ' +
        'användes. Det är standard för all webbhosting och sker innan sidans egen kod körs. Loggarna används ' +
        'bara för att hålla tjänsten uppe och avvärja missbruk, de analyseras inte, och de gallras enligt ' +
        'leverantörens villkor.',
    },
    {
      t: 'dl',
      rows: [
        ['Personuppgiftsansvarig', 'Aren Mardian, privatperson'],
        ['Vilka uppgifter', 'Driftloggar hos webbhotellet: IP-adress, tidpunkt, begärd adress, webbläsare'],
        ['Ändamål', 'Att hålla tjänsten tillgänglig och skydda den mot missbruk'],
        ['Rättslig grund', 'Berättigat intresse (dataskyddsförordningen artikel 6.1 f)'],
        ['Mottagare', 'Ingen utöver webbhotellet, som är personuppgiftsbiträde'],
        ['Lagringstid', 'Enligt webbhotellets gallringsrutin — sajten sparar inget eget'],
        ['Profilering', 'Förekommer inte'],
      ],
    },
    { t: 'h', text: 'Dina rättigheter' },
    {
      t: 'p',
      text:
        'Du har rätt att begära utdrag, rättelse eller radering av uppgifter om dig, och att invända mot ' +
        'behandlingen. I praktiken finns bara driftloggarna, som inte är sökbara på person. Begäran och frågor ' +
        `tas emot via [projektets ärendelista](${REPO}/issues) — skriv inget känsligt där, den är offentlig. ` +
        'Du kan också klaga hos Integritetsskyddsmyndigheten (IMY).',
    },
    {
      t: 'note',
      text:
        'Öppnar du en länk härifrån till en annan webbplats gäller den platsens egna villkor, inte de här.',
    },
  ],
  updated: GRANSKAD,
};

export const SIDOR: Record<SidaId, Sida> = { om, kallor, integritet };
