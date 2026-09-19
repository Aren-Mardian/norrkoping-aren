# ADR-09 — Självhostad bakgrundskarta i stället för Lantmäteriets visningstjänst

**Status:** Beslutad 2026-09-19. Ersätter antagandet i kravspec DS-1/DS-2 och kompletterar ADR-04.

## Kontext

Kravspecen (v1.0) förutsatte att Lantmäteriets *Topografisk webbkarta Visning* och *Ortofoto Visning*
är avgiftsfria WMTS-tjänster som konsumeras live via en tile-proxy (ADR-04, IK-01). Vid genomgång av
Geotorgets produktlista 2026-09-19 visade det sig att:

- den enda avgiftsfria topografiska visningstjänsten, *Topografisk webbkarta Visning, översiktlig*,
  **utgår 2026-12-31** och bara är avsedd för skalor mindre än 1:30 236 (inte kvartersnivå, FK-01);
- *Topografisk webbkarta Visning* (cache/skiktindelad), *Topografi Visning, vector tiles* och
  *Ortofoto Visning* (aktuellt) är **avgiftsbelagda** — oförenligt med M4/NFK-27 (0 kr);
- *Topografisk webbkarta Nedladdning, raster* är **avgiftsfri**: samma förrenderade kartrutor som
  cache-tjänsten, levererade som en GeoPackage-fil för hela Sverige (163 GB, 0,5 m/px) på öppen FTP.

Risk R1/R2 i kravspecen har därmed slagit in.

## Beslut

1. **Bakgrundskartan självhostas.** Ett utsnitt av *Topografisk webbkarta Nedladdning, raster* över
   Norrköpings kommun (+ buffert) packas till en PMTiles-fil med `tools/extract_topowebb.py` och
   serveras som statisk fil från egen origin (`/projekt/norrkoping/data/topowebb-farg.pmtiles`).
   Klienten läser den med HTTP Range-requests (ADR-06). Ingen tile-server, ingen token, ingen proxy.
2. **Rutorna kopieras oförändrade** (Lantmäteriets palett-PNG:er). Ingen omkodning: omkodning till
   WebP gav bara 5–35 % mindre och kostar kvalitet.
3. **Tile-matrisen behålls.** Filen använder Lantmäteriets WMTS-matris "3006" (origo −1 200 000 /
   8 500 000, 256 px, 4096/2^z m/px), samma som `shared/geo/lmTileGrid.ts`. Eftersom PMTiles kräver en
   enda ruta på nivå 0 lagras LM-nivå z som PMTiles-nivå z + 2 (`lm_zoom_offset` i metadata).
4. **Detaljnivå styrs per område, klippt mot kommungränsen.** Kommunen + 25 km till 16 m/px
   (panoreringsbuffert, FK-04), + 10 km vid 8 m/px, + 3 km vid 4–2 m/px; centralorten till 1 m/px och
   innerstaden till 0,5 m/px. Saknas en ruta skalar klienten upp närmaste förälder
   (`src/map/pmtilesSource.ts`) — kartan blir aldrig tom (A5).
5. **Flygbild = *Ortofoto historiska Visning*** (WMS, CC0, 1949–2005) via proxyn. Aktuellt ortofoto
   utgår ur omfattningen tills en avgiftsfri källa finns.
6. **Tile-proxyn (ADR-04) behålls** för *översiktlig*-WMTS fram till 2026-12-31 och för WMS/fallback.

## Konsekvenser

- **Kostnad:** 0 kr i drift. En engångsnedladdning (163 GB, ~4 h) som raderas efteråt.
- **Prestanda:** rutor från egen CDN utan proxy-hopp; färre externa beroenden i kritisk väg (NFK-06).
- **Offline (FK-35):** service workern kan cacha Range-svar från en fil — enklare än WMTS.
- **Integritet (NFK-23):** inga anrop till Lantmäteriet från besökaren över huvud taget.
- **Storlek:** 251 MB (32 448 rutor) efter klippning mot kommungränsen — 4–2 m/px bara inom kommunen
  + 3 km, 1 m/px i centralorten, 0,5 m/px i innerstaden. Ett första oklippt utsnitt var 644 MB.
  Filen checkas **inte** in i git (GitHub-gräns 100 MB); levereras enligt ADR-10.
- **Aktualitet:** kartan uppdateras när utsnittet regenereras (FTP-filen dateras; senast 2026-06-22).
  Datum visas på `/kallor`.
- **Juridik (JK-01, JK-07):** villkoren för *Topografisk webbkarta Nedladdning, raster* är **CC BY 4.0**
  (docs/villkor/) — vidarepublicering från egen server är tillåten. Attribution enligt §3.1 i
  kartan, i PMTiles-metadata och på `/kallor`. Avgjort 2026-09-19.

## Alternativ som valdes bort

| Alternativ | Varför inte |
|---|---|
| Betala för *Visning, cache* | Bryter M4/NFK-27 |
| Live-WMTS *översiktlig* som enda källa | Utgår 2026-12-31; täcker inte kvartersnivå |
| Egna vektorrutor från *Topografi 50 Nedladdning* | Bäst långsiktigt (~30 MB, mörkt läge), men flera dagars kartografiarbete; kvar som framtida förbättring |
| *Karta 1:10 000 Nedladdning, raster* → egen pyramid | Ritad för utskrift; grötig utzoomad |
| Läsa GeoPackage-filen på distans utan att ladda ned | Fungerar tekniskt (GDAL/vsicurl) men FTP gör slumpläsning ~100× långsammare än sekventiell nedladdning |
