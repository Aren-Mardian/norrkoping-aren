#!/usr/bin/env python
"""
Klipper ut Norrköpings kommun ur Lantmäteriets "Topografisk webbkarta Nedladdning, raster"
(GeoPackage, hela Sverige, EPSG:3006, 0,5 m/px, ~163 GB) till en PMTiles-fil som kan
självhostas på CDN utan tile-server (kravspec ADR-06, ADR-09).

Kartrutorna kopieras oförändrade (originalets PNG-blobbar) — ingen omkodning, inga
kvalitetsförluster. Bara SQLite, shapely och pmtiles behövs; ingen GDAL.

Tile-matrisen i filen är Lantmäteriets WMTS-matris "3006": origo (−1 200 000, 8 500 000),
256 px, upplösning 4096/2^z m/px för z = 0…13. PMTiles kräver att z=0 är EN ruta, men LM:s
nivå 0 är 4×4 rutor, därför lagras LM-nivå z som PMTiles-nivå z+2 (samma x/y). Offseten
skrivs i metadata som "lm_zoom_offset" och används av klienten.

Urval per nivå (--steps ZMAX:BUFFER,…): en ruta tas med om den skär kommungränsen
(--clip, GeoJSON i EPSG:4326) buffrad med BUFFER meter — översiktsnivåer får stor buffert
för panorering (FK-04), detaljnivåer bara en smal kant. Detaljområden (--detail) lägger
till högre nivåer inom ett mindre område.

Standardkörning (~650 MB): hela kommunen i källans egen upplösning 0,5 m/px, utan omkodning.
Besökaren laddar bara de rutor som syns (Range-requests mot PMTiles), så filstorleken kostar
lagring och byggtid — inte laddtid för besökaren.

  python tools/extract_topowebb.py --gpkg D:/lantmateriet/6104864_234624.gpkg --out data/derived/topowebb-farg.pmtiles

  --dry-run räknar bara rutor och uppskattar storlek utan att skriva.
"""
from __future__ import annotations

import argparse
import json
import math
import sqlite3
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from pyproj import Transformer
from shapely.geometry import box, shape
from shapely.ops import transform as shp_transform
from shapely.prepared import prep

# Lantmäteriets matris — verifieras mot filens gpkg_tile_matrix vid körning.
LM_ORIGIN = (-1_200_000.0, 8_500_000.0)
LM_TILE_PX = 256

DEFAULT_CLIP = "data/derived/kommungrans.geojson"
# Hela kommunen i källans egen upplösning, 0,5 m/px (ADR-18). Översiktsnivåerna får 5 km
# buffert — lika mycket som kartan får panoreras (ADR-16) — och detaljnivåerna en smal kant
# på 500 m så att gränsen ritas snyggt utan att rutor över grannkommunerna följer med.
DEFAULT_STEPS = "8:5000,9:5000,11:3000,13:500"
# Inga extra detaljområden behövs: hela kommunen ligger redan på finaste nivån.
DEFAULT_DETAIL: list[str] = []


@dataclass(frozen=True)
class Matrix:
    zoom: int
    res: float
    width: int
    height: int


@dataclass(frozen=True)
class Selection:
    """Rutor som ska tas med på en nivå."""

    zoom: int
    tiles: list[tuple[int, int]]  # (col, row)
    label: str


def detect_type(blob: bytes) -> TileType:
    if blob[:8] == b"\x89PNG\r\n\x1a\n":
        return TileType.PNG
    if blob[:3] == b"\xff\xd8\xff":
        return TileType.JPEG
    if blob[:4] == b"RIFF" and blob[8:12] == b"WEBP":
        return TileType.WEBP
    raise ValueError("Okänt bildformat i tile_data")


def open_gpkg(path: str) -> tuple[sqlite3.Connection, str, dict[int, Matrix], int]:
    uri = f"file:{Path(path).as_posix()}?mode=ro"
    con = sqlite3.connect(uri, uri=True)
    con.execute("PRAGMA query_only = 1")
    rows = con.execute("SELECT table_name FROM gpkg_contents WHERE data_type = 'tiles'").fetchall()
    if len(rows) != 1:
        sys.exit(f"Förväntade exakt en tiles-tabell i gpkg_contents, hittade {len(rows)}")
    table = rows[0][0]

    (min_x, max_y) = con.execute(
        "SELECT min_x, max_y FROM gpkg_tile_matrix_set WHERE table_name = ?", (table,)
    ).fetchone()
    if abs(min_x - LM_ORIGIN[0]) > 1e-6 or abs(max_y - LM_ORIGIN[1]) > 1e-6:
        sys.exit(f"Filens origo ({min_x}, {max_y}) är inte Lantmäteriets ({LM_ORIGIN}) — fel produkt?")

    matrices: dict[int, Matrix] = {}
    for zoom, w, h, tw, th, px in con.execute(
        "SELECT zoom_level, matrix_width, matrix_height, tile_width, tile_height, pixel_x_size "
        "FROM gpkg_tile_matrix WHERE table_name = ? ORDER BY zoom_level",
        (table,),
    ):
        expected = 4096 / 2**zoom
        if tw != LM_TILE_PX or th != LM_TILE_PX or abs(px - expected) > 1e-9:
            sys.exit(f"Nivå {zoom}: {tw}×{th} px @ {px} m/px matchar inte LM-matrisen ({expected} m/px)")
        matrices[zoom] = Matrix(zoom, px, w, h)

    width0 = matrices[0].width
    offset = int(math.log2(width0))
    if 2**offset != width0:
        sys.exit(f"Nivå 0 har {width0} kolumner — inte en tvåpotens, PMTiles-offset går inte att beräkna")
    return con, table, matrices, offset


def load_clip_3006(path: str):  # noqa: ANN201 — shapely-geometri
    """Kommungränsen (EPSG:4326) projicerad till EPSG:3006."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    feature = data["features"][0] if data.get("type") == "FeatureCollection" else data
    geom = shape(feature["geometry"])
    to_3006 = Transformer.from_crs("EPSG:4326", "EPSG:3006", always_xy=True)
    return shp_transform(to_3006.transform, geom)


def select_tiles(m: Matrix, area) -> list[tuple[int, int]]:  # noqa: ANN001
    """Alla rutor på nivån vars utbredning skär området."""
    size = m.res * LM_TILE_PX
    minx, miny, maxx, maxy = area.bounds
    col0 = max(0, math.floor((minx - LM_ORIGIN[0]) / size))
    col1 = min(m.width - 1, math.floor((maxx - LM_ORIGIN[0]) / size))
    row0 = max(0, math.floor((LM_ORIGIN[1] - maxy) / size))
    row1 = min(m.height - 1, math.floor((LM_ORIGIN[1] - miny) / size))
    prepared = prep(area)
    out: list[tuple[int, int]] = []
    for col in range(col0, col1 + 1):
        x0 = LM_ORIGIN[0] + col * size
        for row in range(row0, row1 + 1):
            y1 = LM_ORIGIN[1] - row * size
            if prepared.intersects(box(x0, y1 - size, x0 + size, y1)):
                out.append((col, row))
    return out


def parse_steps(text: str) -> list[tuple[int, float]]:
    steps = []
    for part in text.split(","):
        z, b = part.split(":")
        steps.append((int(z), float(b)))
    return sorted(steps)


def parse_detail(text: str) -> tuple[tuple[float, float, float, float], int]:
    bbox, z = text.split(":")
    e0, n0, e1, n1 = (float(v) for v in bbox.split(","))
    return (e0, n0, e1, n1), int(z)


def main() -> int:
    # Windows-konsolen är ofta cp1252; tvinga UTF-8 så att svenska tecken och pilar inte kraschar utskriften.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--gpkg", required=True, help="Sökväg till 6104864_234624.gpkg (lokal fil)")
    ap.add_argument("--out", required=True, help="Utfil .pmtiles")
    ap.add_argument("--clip", default=DEFAULT_CLIP, help=f"Kommungräns, GeoJSON i EPSG:4326 (standard {DEFAULT_CLIP})")
    ap.add_argument("--steps", default=DEFAULT_STEPS, help=f"ZMAX:BUFFER_M,… kumulativa nivåintervall (standard {DEFAULT_STEPS})")
    ap.add_argument("--detail", action="append", metavar="MINE,MINN,MAXE,MAXN:ZMAX",
                    help="Detaljområde i EPSG:3006 med högre maxnivå; kan upprepas (standard: centralort till 12, innerstad till 13)")
    ap.add_argument("--name", default="Topografisk webbkarta (Lantmäteriet), Norrköpings kommun")
    ap.add_argument("--dry-run", action="store_true", help="Räkna bara rutor, skriv inget")
    args = ap.parse_args()

    con, table, matrices, offset = open_gpkg(args.gpkg)
    clip = load_clip_3006(args.clip)
    steps = parse_steps(args.steps)
    details = sorted((parse_detail(d) for d in (args.detail or DEFAULT_DETAIL)), key=lambda d: d[1])

    t0 = time.time()
    plan: list[Selection] = []
    z = 0
    for zmax, buffer_m in steps:
        area = clip.buffer(buffer_m)
        for zz in range(z, zmax + 1):
            plan.append(Selection(zz, select_tiles(matrices[zz], area), f"kommun +{buffer_m/1000:g} km"))
        z = zmax + 1
    for bbox, zmax in details:
        area = box(*bbox)
        for zz in range(z, zmax + 1):
            plan.append(Selection(zz, select_tiles(matrices[zz], area), f"detalj {bbox[0]:.0f},{bbox[1]:.0f}–{bbox[2]:.0f},{bbox[3]:.0f}"))
        z = zmax + 1

    total = sum(len(s.tiles) for s in plan)
    print(f"Tiles-tabell: {table}  |  PMTiles-offset: LM z → z+{offset}  |  urval på {time.time()-t0:.1f} s")
    for s in plan:
        print(f"  LM z{s.zoom:2d} ({matrices[s.zoom].res:>7.3f} m/px): {len(s.tiles):>8,} rutor  ({s.label})")
    print(f"  Totalt (max, tomma rutor borträknas vid körning): {total:,} rutor")

    if args.dry_run:
        est = 0.0
        for s in plan:
            sample = s.tiles[:: max(1, len(s.tiles) // 200)]
            sizes: list[int] = []
            for col, row in sample:
                got = con.execute(
                    f"SELECT LENGTH(tile_data) FROM {table} WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
                    (s.zoom, col, row),
                ).fetchone()
                sizes.append(got[0] if got else 0)
            avg = sum(sizes) / len(sizes) if sizes else 0
            est += avg * len(s.tiles)
            print(f"  z{s.zoom:2d}: snitt {avg/1024:5.1f} kB → ~{avg*len(s.tiles)/2**20:6.0f} MB")
        print(f"  Uppskattat totalt: ~{est/2**20:,.0f} MB")
        return 0

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tile_type: TileType | None = None
    written = 0
    bytes_written = 0

    with out.open("wb") as f:
        writer = Writer(f)
        for s in plan:
            # PMTiles-ordning (Hilbert-kurva) gör filen "clustered" = snabbast att läsa med Range-requests.
            ids = sorted((zxy_to_tileid(s.zoom + offset, col, row), col, row) for col, row in s.tiles)
            found = 0
            for tid, col, row in ids:
                got = con.execute(
                    f"SELECT tile_data FROM {table} WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
                    (s.zoom, col, row),
                ).fetchone()
                if not got:
                    continue  # tom ruta (utanför kartans täckning)
                blob = got[0]
                kind = detect_type(blob)
                if tile_type is None:
                    tile_type = kind
                elif kind != tile_type:
                    sys.exit(f"Blandade bildformat ({tile_type} och {kind}) — PMTiles kräver ett format per fil")
                writer.write_tile(tid, blob)
                found += 1
                bytes_written += len(blob)
            written += found
            print(f"  LM z{s.zoom:2d}: {found:>8,} rutor skrivna ({bytes_written/2**20:,.0f} MB hittills, {time.time()-t0:,.0f} s)")

        if tile_type is None:
            sys.exit("Inga rutor hittades i området")

        to_4326 = Transformer.from_crs("EPSG:3006", "EPSG:4326", always_xy=True)
        outer = clip.buffer(steps[0][1]).bounds
        lon0, lat0 = to_4326.transform(outer[0], outer[1])
        lon1, lat1 = to_4326.transform(outer[2], outer[3])
        header = {
            "tile_type": tile_type,
            "tile_compression": Compression.NONE,
            "min_lon_e7": int(lon0 * 1e7),
            "min_lat_e7": int(lat0 * 1e7),
            "max_lon_e7": int(lon1 * 1e7),
            "max_lat_e7": int(lat1 * 1e7),
            "center_zoom": offset + 5,
            "center_lon_e7": int(16.1859 * 1e7),
            "center_lat_e7": int(58.58734 * 1e7),
        }
        metadata = {
            "name": args.name,
            "attribution": "© Lantmäteriet, CC BY 4.0",
            "attribution_full": (
                "Datakälla: Topografisk webbkarta Nedladdning, raster. © Lantmäteriet. "
                "Informationen har bearbetats (utsnitt över Norrköpings kommun, ompaketerad till PMTiles). "
                "CC BY 4.0 gäller för Topografisk webbkarta Nedladdning, raster."
            ),
            "license": "CC-BY-4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "description": "Utsnitt av Topografisk webbkarta Nedladdning, raster (Lantmäteriet) över Norrköpings kommun med buffert.",
            "type": "baselayer",
            "format": tile_type.name.lower(),
            "crs": "EPSG:3006",
            "tile_matrix": "Lantmäteriet WMTS 3006",
            "origin": list(LM_ORIGIN),
            "tile_size": LM_TILE_PX,
            "lm_zoom_offset": offset,
            "resolutions": [4096 / 2**zz for zz in range(len(matrices))],
            "selection": {
                "clip": Path(args.clip).name,
                "steps": args.steps,
                "detail": [f"{b[0]:.0f},{b[1]:.0f},{b[2]:.0f},{b[3]:.0f}:{zm}" for b, zm in details],
            },
            "source_file": Path(args.gpkg).name,
            "generated": time.strftime("%Y-%m-%d"),
        }
        writer.finalize(header, metadata)

    print(f"Klart: {written:,} rutor, {out.stat().st_size/2**20:,.0f} MB → {out} ({time.time()-t0:,.0f} s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
