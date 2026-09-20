#!/usr/bin/env python
"""
Hämtar Lantmäteriets avgiftsfria vektordata via STAC-API:et (CC BY 4.0) och härleder
kommunspecifika filer till data/derived/:

  kommungrans.geojson   Norrköpings kommun (kommunkod 0581) ur "Kommun, län och rike" —
                        ersätter OSM-interimspolygonen (FK-04, FK-05, DK-01).
  ortnamn.geojson       Ortnamn inom kommunen ur "Ortnamn" — underlag för sök (FK-32).

Katalogen (https://api.lantmateriet.se/stac-vektor/v1) är öppen; själva filerna på
dl1.lantmateriet.se kräver appkontot från Geotorget (HTTP Basic). Uppgifterna läses ur .env
(LM_USER / LM_PASSWORD) och skrivs aldrig ut.

  tools/.venv/Scripts/python tools/lm_stac.py            # båda
  tools/.venv/Scripts/python tools/lm_stac.py kommun     # bara kommungränsen
  tools/.venv/Scripts/python tools/lm_stac.py ortnamn    # bara ortnamn (58 MB nedladdning)

Kräver: pyproj, shapely, fiona (pip install fiona) för GeoPackage-läsning.
"""
from __future__ import annotations

import base64
import io
import json
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import mapping, shape

STAC = "https://api.lantmateriet.se/stac-vektor/v1"
UA = "Norrkopingskartan/0.1 (+https://norrkoping.netlify.app)"
KOMMUN_KOD = "0581"
RAW = Path("data/raw/lantmateriet")
OUT = Path("data/derived")


def read_env() -> tuple[str, str]:
    env: dict[str, str] = {}
    p = Path(".env")
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    user, pw = env.get("LM_USER", ""), env.get("LM_PASSWORD", "")
    if not user or not pw:
        sys.exit("LM_USER/LM_PASSWORD saknas i .env — appkontot från Geotorget behövs för nedladdningen.")
    return user, pw


def fetch(url: str, auth: tuple[str, str] | None = None, dest: Path | None = None) -> bytes:
    headers = {"User-Agent": UA, "Accept": "*/*"}
    if auth:
        headers["Authorization"] = "Basic " + base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=600) as resp:
        data = resp.read()
    if dest:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    return data


def stac_asset(collection: str, item: str) -> dict:
    meta = json.loads(fetch(f"{STAC}/collections/{collection}/items/{item}"))
    asset = meta["assets"]["data"]
    return {"href": asset["href"], "size": asset.get("file:size"), "datetime": meta["properties"].get("datetime"), "updated": meta["properties"].get("updated")}


def download(collection: str, item: str, auth: tuple[str, str]) -> Path:
    a = stac_asset(collection, item)
    dest = RAW / Path(a["href"]).name
    if dest.exists() and (a["size"] is None or dest.stat().st_size == a["size"]):
        print(f"{dest.name}: finns redan ({dest.stat().st_size/2**20:.1f} MB)")
    else:
        print(f"{dest.name}: hämtar {a['size'] and a['size']/2**20:.1f} MB …")
        fetch(a["href"], auth, dest)
    return dest


def gpkg_layers(zip_path: Path) -> list[tuple[str, str]]:
    """(gpkg-fil i zip, lagernamn) för alla lager."""
    import fiona  # noqa: PLC0415

    out = []
    with zipfile.ZipFile(zip_path) as z:
        for name in z.namelist():
            if name.lower().endswith(".gpkg"):
                tmp = RAW / Path(name).name
                if not tmp.exists():
                    tmp.write_bytes(z.read(name))
                for layer in fiona.listlayers(tmp):
                    out.append((str(tmp), layer))
    return out


def derive_kommun(auth: tuple[str, str]) -> None:
    import fiona  # noqa: PLC0415

    zip_path = download("kommun-lan-rike", "aktuell", auth)
    layers = gpkg_layers(zip_path)
    print("lager:", [l for _, l in layers])
    kommun_layer = next(((f, l) for f, l in layers if "kommun" in l.lower()), None)
    if not kommun_layer:
        sys.exit(f"Hittade inget kommunlager i {zip_path}")
    gpkg, layer = kommun_layer
    with fiona.open(gpkg, layer=layer) as src:
        crs = src.crs.to_string() if src.crs else "EPSG:3006"
        print("schema:", list(src.schema["properties"].keys())[:12], "| crs:", crs)
        code_field = next((k for k in src.schema["properties"] if "kommunkod" in k.lower() or k.lower() in ("kommun", "kod")), None)
        feats = [f for f in src if str(f["properties"].get(code_field, "")).zfill(4) == KOMMUN_KOD]
    if not feats:
        sys.exit(f"Ingen kommun med kod {KOMMUN_KOD} i lagret {layer} (fält {code_field})")
    f = feats[0]
    geom = shape(f["geometry"])
    to_wgs = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    from shapely.ops import transform as shp_transform  # noqa: PLC0415

    geom_wgs = shp_transform(to_wgs.transform, geom).simplify(0.00002, preserve_topology=True)
    rounded = json.loads(json.dumps(mapping(geom_wgs)), parse_float=lambda x: round(float(x), 6))
    name = next((v for k, v in f["properties"].items() if "namn" in k.lower()), "Norrköpings kommun")
    feature = {
        "type": "Feature",
        "id": "nkpg-kommun-0581",
        "geometry": rounded,
        "properties": {
            "name": {"sv": str(name), "en": "Norrköping Municipality"},
            "kommunkod": KOMMUN_KOD,
            "license": "CC-BY-4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": "© Lantmäteriet",
            "source": "Lantmäteriet, Kommun, län och rike Nedladdning (STAC, item 'aktuell')",
            "sourceUrl": f"{STAC}/collections/kommun-lan-rike/items/aktuell",
            "retrieved": time.strftime("%Y-%m-%d"),
            "terms": "Användningsvillkor för värdefulla datamängder (CC BY 4.0). Datakälla: Kommun, län och rike Nedladdning, © Lantmäteriet, bearbetad (urval + förenkling ~2 m).",
            "provenance": {"geometrySource": "Lantmäteriet", "geometryLicense": "CC-BY-4.0", "positionAccuracyM": 2, "simplifiedToleranceDeg": 0.00002, "updated": time.strftime("%Y-%m-%d")},
        },
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "kommungrans.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [feature]}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    n = sum(len(r) for poly in (rounded["coordinates"] if rounded["type"] == "MultiPolygon" else [rounded["coordinates"]]) for r in poly)
    print(f"kommungrans.geojson: {rounded['type']} med {n} hörn ({(OUT / 'kommungrans.geojson').stat().st_size/1024:.0f} kB) — Lantmäteriet ersätter OSM")


def derive_ortnamn(auth: tuple[str, str]) -> None:
    import fiona  # noqa: PLC0415
    from shapely.prepared import prep  # noqa: PLC0415

    kommun = json.loads((OUT / "kommungrans.geojson").read_text(encoding="utf-8"))
    poly = prep(shape(kommun["features"][0]["geometry"]))
    zip_path = download("ortnamn", "ortnamn_se", auth)
    layers = gpkg_layers(zip_path)
    print("lager:", [l for _, l in layers])
    out_feats = []
    for gpkg, layer in layers:
        with fiona.open(gpkg, layer=layer) as src:
            crs = src.crs.to_string() if src.crs else "EPSG:3006"
            to_wgs = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
            fields = list(src.schema["properties"].keys())
            name_f = next((k for k in fields if k.lower() in ("textstrang", "namn", "ortnamn", "name")), fields[0])
            type_f = next((k for k in fields if "typ" in k.lower() or "kategori" in k.lower()), None)
            for f in src:
                g = shape(f["geometry"])
                pt = g.representative_point() if g.geom_type != "Point" else g
                lon, lat = to_wgs.transform(pt.x, pt.y)
                from shapely.geometry import Point  # noqa: PLC0415

                if not poly.contains(Point(lon, lat)):
                    continue
                out_feats.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
                    "properties": {"name": f["properties"].get(name_f), "type": f["properties"].get(type_f) if type_f else None, "layer": layer},
                })
    collection = {
        "type": "FeatureCollection",
        "license": "CC-BY-4.0",
        "attribution": "© Lantmäteriet (Ortnamn Nedladdning, vektor, CC BY 4.0, bearbetad: urval inom Norrköpings kommun)",
        "retrieved": time.strftime("%Y-%m-%d"),
        "features": out_feats,
    }
    (OUT / "ortnamn.geojson").write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"ortnamn.geojson: {len(out_feats)} namn ({(OUT / 'ortnamn.geojson').stat().st_size/1024:.0f} kB)")


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    auth = read_env()
    if what in ("all", "kommun"):
        derive_kommun(auth)
    if what in ("all", "ortnamn"):
        derive_ortnamn(auth)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
