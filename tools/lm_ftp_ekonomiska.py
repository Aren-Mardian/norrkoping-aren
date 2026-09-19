#!/usr/bin/env python
"""
Laddar ned bara de blad av Lantmäteriets "Ekonomiska kartan" (1935–1978, avgiftsfri, FTP)
som täcker ett område — i stället för hela Sverige.

Bladen ligger på ftp://download-opendata.lantmateriet.se/Ekonomiska_kartan/<storruta>/ och
är georefererade i RT90 2,5 gon V (EPSG:3021), 5 × 5 km, 1 m/px, ~75 MB per blad (GeoTIFF).
Namnet kodar läget: "133_8g0a48_0_b2.tif" = storruta 8G, blad 0a, år 1948.

  storruta siffra N  → nord  6 100 000 + (N−1)·50 000
  storruta bokstav L → ost   1 200 000 + idx(L)·50 000     (a=0, b=1, …)
  blad siffra d      → nord  + d·5 000                     (0 = sydligast)
  blad bokstav l     → ost   + idx(l)·5 000                (a = västligast)

Exempel — lista vad som täcker centrala Norrköping (Industrilandskapet), utan att ladda ned:

  python tools/lm_ftp_ekonomiska.py --bbox 562000 6490000 576000 6500000 --dry-run

Ta bort --dry-run för att hämta till data/raw/ekonomiska_kartan/ (återupptar avbrutna filer).
Hela kommunens bbox är ~270 blad ≈ 20 GB — börja med ett mindre område.
"""
from __future__ import annotations

import argparse
import ftplib
import math
import sys
from pathlib import Path

from pyproj import Transformer

HOST = "download-opendata.lantmateriet.se"
ROOT = "/Ekonomiska_kartan"
KOMMUN_BBOX_3006 = (532256, 6460016, 618039, 6532953)
SHEET_M = 5_000
BLOCK_M = 50_000
N0, E0 = 6_100_000, 1_200_000


def sheets_for_bbox_rt90(minx: float, miny: float, maxx: float, maxy: float) -> dict[str, set[str]]:
    """Storruta → mängd bladkoder som skär bbox (RT90-koordinater: x = ost, y = nord)."""
    out: dict[str, set[str]] = {}
    col0, col1 = math.floor((minx - E0) / SHEET_M), math.floor((maxx - E0) / SHEET_M)
    row0, row1 = math.floor((miny - N0) / SHEET_M), math.floor((maxy - N0) / SHEET_M)
    for row in range(row0, row1 + 1):
        for col in range(col0, col1 + 1):
            block_n, sheet_d = divmod(row, 10)
            block_l, sheet_l = divmod(col, 10)
            block = f"{block_n + 1}{chr(ord('a') + block_l)}"
            sheet = f"{sheet_d}{chr(ord('a') + sheet_l)}"
            out.setdefault(block, set()).add(sheet)
    return out


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("MINE", "MINN", "MAXE", "MAXN"),
                    default=KOMMUN_BBOX_3006, help="Område i EPSG:3006 (standard: hela kommunens bbox)")
    ap.add_argument("--out", default="data/raw/ekonomiska_kartan", help="Målmapp")
    ap.add_argument("--dry-run", action="store_true", help="Lista bara, ladda inte ned")
    args = ap.parse_args()

    # Bbox 3006 → RT90 2,5 gon V. Transformera alla fyra hörn och ta ytterkanterna.
    to_rt90 = Transformer.from_crs("EPSG:3006", "EPSG:3021", always_xy=True)
    xs, ys = zip(*(to_rt90.transform(x, y) for x in (args.bbox[0], args.bbox[2]) for y in (args.bbox[1], args.bbox[3])))
    wanted = sheets_for_bbox_rt90(min(xs), min(ys), max(xs), max(ys))

    ftp = ftplib.FTP(HOST, timeout=60)
    ftp.login()
    files: list[tuple[str, str, int]] = []  # (storruta, filnamn, storlek)
    for block in sorted(wanted):
        lines: list[str] = []
        try:
            ftp.retrlines(f"LIST {ROOT}/{block}", lines.append)
        except ftplib.error_perm:
            print(f"  (storruta {block} finns inte på FTP:n — utanför kartans täckning)")
            continue
        for line in lines:
            # "-r--r--r--   1 ftp  ftp  76430494 Oct 27  2017 133_8g0a48_0_b2.tif"
            parts = line.split(None, 8)
            if len(parts) < 9 or not parts[0].startswith("-"):
                continue
            size, name = int(parts[4]), parts[8]
            # 133_8g0a48_0_b2.tif → storruta "8g", blad "0a"
            code = name.split("_")[1] if "_" in name else ""
            sheet = code[len(block) : len(block) + 2]
            if sheet in wanted[block] and name.lower().endswith((".tif", ".tfw", ".tab")):
                files.append((block, name, size))

    total = sum(s for _, _, s in files)
    tifs = [f for f in files if f[1].lower().endswith(".tif")]
    print(f"{len(tifs)} blad ({len(files)} filer), {total / 2**30:.2f} GB, storrutor: {', '.join(sorted(wanted))}")
    for block, name, size in files:
        if name.lower().endswith(".tif"):
            print(f"  {block}/{name}  {size / 2**20:6.1f} MB")
    if args.dry_run:
        ftp.quit()
        return 0

    out = Path(args.out)
    ftp.voidcmd("TYPE I")  # binärt läge så att TIFF-filerna kommer oförvanskade
    for i, (block, name, size) in enumerate(files, 1):
        dest = out / block / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        have = dest.stat().st_size if dest.exists() else 0
        if have == size:
            continue
        mode = "ab" if 0 < have < size else "wb"
        with dest.open(mode) as fh:
            ftp.retrbinary(f"RETR {ROOT}/{block}/{name}", fh.write, blocksize=1 << 20, rest=have or None)
        print(f"  [{i}/{len(files)}] {name} klar")
    ftp.quit()
    print(f"Klart → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
