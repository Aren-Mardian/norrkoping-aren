# ADR-14 — Lantmäteriets sju API:er: vad som används, hur, och vad som inte används

**Status:** Beslutad 2026-09-23. Realiserar FK-02 (flygbild), FK-05 (kommungräns), FK-32 (ortnamn)
och IK-08 (höjd). Bygger på ADR-04 (tile-proxy) och ADR-09 (självhostad bakgrundskarta).

## Kontext

Appkontot i Geotorget (`dein0001`) ger tillgång till sju gränssnitt. Alla verifierades mot skarpa
anrop 2026-09-23 med HTTP Basic:

| API | Bas-URL | Auth | Utfall |
|---|---|---|---|
| STAC-vektor | `…/stac-vektor/v1` | Basic | **200.** 6 kollektioner, bl.a. `kommun-lan-rike` och `ortnamn` |
| STAC-karta | `…/stac-karta/v1` | Basic | **200.** `topowebb` — källan till vår PMTiles-fil (ADR-09) |
| STAC-höjd | `…/stac-hojd/v1` | Basic | **200.** Markhöjdmodell, rutindelad (`mhm-*`) |
| STAC-bild | `…/stac-bild/v1` | Basic | **200.** Ortofoton för nedladdning, inkl. historiska |
| OGC-Features | `…/ogc-features/v1` | Basic | **Metadata 200, data 403** — se nedan |
| Markhöjd Direkt | `…/distribution/produkter/markhojd/v1` | Basic | **200.** Punkt och batch |
| Höjd Direkt | `…/distribution/produkter/hojd/v1` | Endast OAuth | Fungerar, men token lever 1 h |

Två saker avgjorde hur de skulle användas:

1. **Var data ska hämtas ifrån spelar roll för prestanda.** Ett API som svarar på varje kartruta
   kostar latens vid varje panorering; ett som körs en gång offline kostar ingenting alls i drift.
2. **Appkontot får aldrig nå klienten** (NFK-15). Allt som måste hämtas live går via edge-proxyn.

## Beslut

**Offline (noll kostnad i drift) — STAC:**

- `stac-vektor/kommun-lan-rike`, item `aktuell` → `data/derived/kommungrans.geojson` (25 kB).
  Ersätter OSM-polygonen; licensen går från ODbL till CC BY 4.0 och lägesosäkerheten från ~10 m
  till ~2 m. Körs av `tools/lm_stac.py kommun`.
- `stac-vektor/ortnamn`, item `ortnamn_se` (56 MB) → `data/derived/ortnamn.geojson` (8 445 namn
  inom kommunen) → `tools/ortnamn_index.py` → `data/sok/ortnamn.json`: **7 865 namn, 87 kB gzip**,
  koordinater i EPSG:3006 som heltalsmeter. Mellanfilen är git-ignorerad och följer inte med bygget.
- `stac-karta/topowebb` är redan källan till bakgrundskartan (ADR-09) — oförändrat.
- `stac-hojd` (markhöjdmodell som COG) används **inte**: Markhöjd Direkt ger samma höjder som en
  tjänst, utan att vi behöver lagra och hosta rutor.
- `stac-bild` (ortofoton för nedladdning) används **inte**: visningstjänsten nedan ger samma bilder
  utan att något behöver lagras.

**Live via edge-proxyn:**

- **Flygbild** — *Ortofoto historiska Visning* (WMS 1.1.1). GetCapabilities visade att färglagren
  (`OI.Histortho_color_2002…2005`) är projektvisa mosaiker: ett testanrop över Norrköping gav en
  nästan tom ruta. De två **rikstäckande referensårsmosaikerna täcker kommunen helt**, så proxyn har
  exakt två lager: `histortho60` (`OI.Histortho_60`) och `histortho75` (`OI.Histortho_75`), båda
  0,5 m sv/v, licens CC0 enligt Geotorgets produktvillkor. Landningsvyn visar dem bakom knappen "Flygbild" med en årtalsrad; Origo-sidan har dem
  som två släckta bakgrundslager. Ett lager per årgång i stället för ett med bytbart lagernamn:
  då ligger redan hämtade rutor kvar i cachen och 1960↔1975 kan jämföras utan ny nedladdning.
- **Höjd** — *Markhöjd Direkt* via ny funktion `netlify/functions/hojd.mts` (IK-08):
  `GET /api/hojd?e&n` för en punkt (cachas 7 dygn på kanten — markhöjden ändras inte) och
  `POST /api/hojd {points}` för upp till 200 punkter i ett anrop, vilket ger höjdprofilen i Origo.
  Samma bbox-spärr och Origin-lås som tile-proxyn; nodata (−9999) normaliseras till `null` så att
  ingen −9999 kan hamna i gränssnittet som en höjd.

**Inte använt, med skäl:**

- **OGC-Features**: `/collections` svarar 200, men varje `/items` ger **403 "Scope validation
  failed"**. Appkontot saknar alltså läsbehörighet till själva datat (scope `ogc-features:*.read`).
  Ingen kod är byggd mot det — när behörigheten finns är `administrativ-indelning`, `hydrografi`
  och `marktacke` naturliga nästa steg. Att beställa behörigheten är en Geotorget-åtgärd.
- **Höjd Direkt**: samma höjddata som Markhöjd Direkt men bara med OAuth2. Åtkomsttoken lever en
  timme, vilket kräver en förnyelsemekanism på edge — mer rörliga delar för exakt samma svar.
  Markhöjd Direkt med Basic valdes därför. Byter Lantmäteriet villkor är `LM_MARKHOJD_URL` och
  en Authorization-header allt som behöver ändras.

## Konsekvenser

- **Prestanda:** landningsvyns kritiska väg växte 158,8 → 162,7 kB gzip (budget 180) — sökrutans
  skal och platskortet. Sökmotorn och indexet (87 kB) laddas med `import()` först vid fokus i
  sökfältet, så ett besök som inte söker betalar ingenting. Origo-sidan: 787,7 kB (budget 900).
- **proj4 i Origo-sidan:** höjdverktyget mäter längd, och `shared/geo/measure.ts` drar in proj4 —
  42 kB som Origo redan har inbyggt. Den planära delen och projektionsvitlistan flyttades därför
  till `shared/geo/planar.ts` **utan beroenden**; `measure.ts` återexporterar dem. Web
  Mercator-spärren (NFK-12) gäller oförändrat, och `planarLengthIn` kastar för 3857.
- **Licenser:** kommungränsen går från ODbL till CC BY 4.0. Sidfoten och Origos lagermetadata
  anger källa, hämtdatum och licens per lager; hämtdatum och antal namn injiceras vid bygget ur
  datafilerna själva, så texten kan inte glida isär från det som levereras.
- **Verifierat 2026-09-23:** 80 tester (från 50), höjd både som punkt (12,75 m) och profil
  (120 punkter, 3,33 km), flygbild 1960/1975 i båda vyerna, sök med diakritikfällning
  ("bravik" → Bråviken), bbox-spärren avvisar punkter utanför kommunen, och `.env` är
  git-ignorerad och osynlig för både bygget och CI:s hemlighetsskanning.
