#!/usr/bin/env python
"""
Hämtar Norrköpings kommungräns från OpenStreetMap (via Nominatim) och skriver
data/derived/kommungrans.geojson — EPSG:4326, lon/lat, 6 decimaler (DK-02, NFK-07).

Interimslösning tills Lantmäteriets "Kommun, Län och Rike" finns via STAC-API (kräver appkonto).
OSM-data är ODbL 1.0: den härledda filen publiceras under ODbL med källangivelse (JK-03) och
lagret attribueras "© OpenStreetMap-bidragsgivare" när det visas (Bilaga C).

Polygonen används till
  1. klippning av kartutsnittet (tools/extract_topowebb.py --clip),
  2. kommungränslagret i kartan (FK-05),
  3. panoreringsspärr och datavalidering (FK-04, DK-01) i stället för den uppskattade bbox:en.

  python tools/kommungrans_osm.py
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

USER_AGENT = "Norrkopingskartan/0.1 (+https://norrkoping.netlify.app)"
QUERY = "Norrköpings kommun"
# ~5 m förenkling i Nominatim (grader). Gränsen ritas som mest vid 2 m/px utanför centralorten.
THRESHOLD_DEG = 0.00005
OUT = Path("data/derived/kommungrans.geojson")
LICENSE_FILE = Path("data/derived/LICENSE-ODbL")

ODBL_NOTICE = """Open Database License (ODbL) 1.0
================================

Filer i denna katalog som anger "license": "ODbL-1.0" i sina metadata är härledda
ur OpenStreetMap-databasen, © OpenStreetMap-bidragsgivare, och tillhandahålls under
Open Database License 1.0: https://opendatacommons.org/licenses/odbl/1-0/

Kort: du får kopiera, sprida, bearbeta och använda databasen även kommersiellt, så
länge du anger källan och gör härledda databaser tillgängliga under samma licens.
Fullständig text: https://opendatacommons.org/licenses/odbl/1-0/
Attribution: https://www.openstreetmap.org/copyright
"""


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    params = urllib.parse.urlencode(
        {"q": QUERY, "format": "jsonv2", "polygon_geojson": 1, "polygon_threshold": THRESHOLD_DEG, "limit": 3}
    )
    req = urllib.request.Request(f"https://nominatim.openstreetmap.org/search?{params}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        results = json.load(resp)

    hit = next(
        (r for r in results if r.get("osm_type") == "relation" and r.get("addresstype") == "municipality"),
        None,
    )
    if not hit:
        sys.exit(f"Hittade ingen kommunrelation för '{QUERY}' i svaret: {[r.get('display_name') for r in results]}")

    geom = hit["geojson"]

    def rounded(coords):  # noqa: ANN001 — rekursiv över godtyckligt djup
        if isinstance(coords[0], (int, float)):
            return [round(coords[0], 6), round(coords[1], 6)]
        return [rounded(c) for c in coords]

    geom["coordinates"] = rounded(geom["coordinates"])
    vertices = sum(len(ring) for poly in (geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]) for ring in poly)

    feature = {
        "type": "Feature",
        "id": "nkpg-kommun-0581",
        "geometry": geom,
        "properties": {
            "name": {"sv": "Norrköpings kommun", "en": "Norrköping Municipality"},
            "kommunkod": "0581",
            "license": "ODbL-1.0",
            "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
            "attribution": "© OpenStreetMap-bidragsgivare",
            "source": "OpenStreetMap via Nominatim",
            "sourceId": f"relation/{hit['osm_id']}",
            "sourceUrl": f"https://www.openstreetmap.org/relation/{hit['osm_id']}",
            "retrieved": time.strftime("%Y-%m-%d"),
            "terms": "ODbL 1.0: källangivelse krävs; härledda databaser delas under samma licens. Interim tills Lantmäteriets kommungräns (CC BY 4.0) ersätter.",
            "provenance": {
                "geometrySource": "OpenStreetMap",
                "geometryLicense": "ODbL-1.0",
                "positionAccuracyM": 10,
                "simplifiedToleranceDeg": THRESHOLD_DEG,
                "updated": time.strftime("%Y-%m-%d"),
            },
        },
    }
    collection = {"type": "FeatureCollection", "features": [feature]}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    LICENSE_FILE.write_text(ODBL_NOTICE, encoding="utf-8")
    bbox = hit["boundingbox"]
    print(f"{OUT}: {geom['type']} med {vertices} hörn, {OUT.stat().st_size/1024:.1f} kB")
    print(f"bbox lat {bbox[0]}–{bbox[1]}, lon {bbox[2]}–{bbox[3]}  (OSM relation {hit['osm_id']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
