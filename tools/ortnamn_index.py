#!/usr/bin/env python
"""
Bygger ett kompakt sökindex för ortnamn (FK-32) ur data/derived/ortnamn.geojson
(Lantmäteriet, Ortnamn Nedladdning vektor, CC BY 4.0 — hämtas av tools/lm_stac.py).

GeoJSON-filen är 1,3 MB och bär mycket som sökningen inte behöver. Indexet är en enda
JSON-fil med parallella fält och koordinater i **EPSG:3006, avrundade till hela meter** —
samma system som kartan renderar i, så klienten slipper både proj4-transform och decimaler:

    {"types": ["Tätort", …],
     "items": [["Lillsjön", 2, 578123, 6497456], …]}

Sorterat efter typvikt och namn, så att träffordningen blir rimlig utan extra logik i klienten.
Filen laddas först när besökaren börjar söka (dynamisk import, TK-05) och cachas 1 dygn.

    tools/.venv/Scripts/python tools/ortnamn_index.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from pyproj import Transformer

sys.stdout.reconfigure(encoding="utf-8")

SRC = Path("data/derived/ortnamn.geojson")
OUT = Path("data/sok/ortnamn.json")

# Lantmäteriets namntyper → etikett i gränssnittet, i den ordning träffar ska rangordnas.
# (BEBTÄTTX = tätort, BEBTX = bebyggelse, TRAKTTX = trakt/by, TERRTX = terräng …)
TYPES: list[tuple[str, str]] = [
    ("BEBTÄTTX", "Tätort"),
    ("BEBTX", "Bebyggelse"),
    ("TRAKTTX", "Trakt"),
    ("VATTTX", "Sjö"),
    ("VATTDRTX", "Vattendrag"),
    ("VATTDELTX", "Vattendel"),
    ("NATTX", "Naturnamn"),
    ("KULTURTX", "Kulturnamn"),
    ("ANLTX", "Anläggning"),
    ("KYRKATX", "Kyrka"),
    ("TERRTX", "Terräng"),
    ("SANKTX", "Sankmark"),
]
ORDER = {code: i for i, (code, _) in enumerate(TYPES)}


# Punkter närmare varandra än så här hör till samma namngivna objekt. 10 km räcker för att
# binda ihop etiketterna längs Bråviken och Motala ström, utan att slå ihop skilda sjöar
# med samma namn i olika delar av kommunen (kommunen är ~115 km bred).
LINKAGE_M = 10_000


def cluster_points(points: list[tuple[float, float]]) -> list[list[tuple[float, float]]]:
    """Enkellänkad klustring: punkter binds ihop via grannar inom LINKAGE_M."""
    remaining = list(points)
    clusters: list[list[tuple[float, float]]] = []
    limit = LINKAGE_M**2
    while remaining:
        cluster = [remaining.pop()]
        grew = True
        while grew:
            grew = False
            for i in range(len(remaining) - 1, -1, -1):
                px, py = remaining[i]
                if any((px - cx) ** 2 + (py - cy) ** 2 <= limit for cx, cy in cluster):
                    cluster.append(remaining.pop(i))
                    grew = True
        clusters.append(cluster)
    return clusters


def main() -> int:
    if not SRC.exists():
        sys.exit(f"{SRC} saknas — kör först: tools/.venv/Scripts/python tools/lm_stac.py ortnamn")

    data = json.loads(SRC.read_text(encoding="utf-8"))
    to_3006 = Transformer.from_crs("EPSG:4326", "EPSG:3006", always_xy=True)

    # Långsträckta objekt (Bråviken, Motala ström …) etiketteras på flera ställen i Lantmäteriets
    # data. I en sökruta är fem rader "Bråviken · Sjö" bara brus. Punkter med samma namn och typ
    # slås därför ihop med enkellänkad klustring: allt som hänger ihop inom LINKAGE_M blir EN
    # träff i klustrets tyngdpunkt, medan två skilda sjöar med samma namn förblir två träffar.
    groups: dict[tuple[str, int], list[tuple[float, float]]] = {}
    names: dict[tuple[str, int], str] = {}
    skipped = 0
    for feature in data["features"]:
        props = feature["properties"]
        name = (props.get("name") or "").strip()
        code = props.get("type") or ""
        if not name or code not in ORDER:
            skipped += 1
            continue
        lon, lat = feature["geometry"]["coordinates"][:2]
        e, n = to_3006.transform(lon, lat)
        key = (name.casefold(), ORDER[code])
        groups.setdefault(key, []).append((e, n))
        names.setdefault(key, name)

    items: list[tuple[str, int, int, int]] = []
    for (_, type_index), points in groups.items():
        clusters = cluster_points(points)
        skipped += len(points) - len(clusters)
        for cluster in clusters:
            e = sum(p[0] for p in cluster) / len(cluster)
            n = sum(p[1] for p in cluster) / len(cluster)
            items.append((names[(_, type_index)], type_index, round(e), round(n)))


    items.sort(key=lambda r: (r[1], r[0].casefold()))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    index = {
        "$comment": "Sökindex härlett ur data/derived/ortnamn.geojson av tools/ortnamn_index.py. Koordinater i EPSG:3006 (heltalsmeter).",
        "license": data.get("license", "CC-BY-4.0"),
        "attribution": data.get("attribution", "© Lantmäteriet"),
        "retrieved": data.get("retrieved"),
        "crs": "EPSG:3006",
        "types": [label for _, label in TYPES],
        "items": [list(row) for row in items],
    }
    OUT.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8", newline="\n")
    size = OUT.stat().st_size
    print(f"{OUT}: {len(items)} namn ({size / 1024:.0f} kB), {skipped} överhoppade")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
