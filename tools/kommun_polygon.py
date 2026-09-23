#!/usr/bin/env python
"""
Genererar `shared/geo/kommunPolygon.ts` ur Lantmäteriets kommungräns
(data/derived/kommungrans.geojson, CC BY 4.0 — hämtad av tools/lm_stac.py).

Varför: bbox:en runt Norrköpings kommun är 114 × 49 km och rymmer stora ytor som inte är
Norrköping. Punktfrågor (markhöjd) ska inte besvaras för dem. En förenklad polygon i
EPSG:3006 räcker för att avgöra innanför/utanför, och blir liten nog att ligga i både
edge-funktionen och klienten.

Toleransen väljs så att polygonen krymper obetydligt men blir få hörn. Generaliseringen
görs med Douglas–Peucker (shapely.simplify) i meter, och kontrollen skriver ut hur mycket
arean ändras — den ska stanna långt under en promille.

    tools/.venv/Scripts/python tools/kommun_polygon.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as shapely_transform

sys.stdout.reconfigure(encoding="utf-8")

SRC = Path("data/derived/kommungrans.geojson")
OUT = Path("shared/geo/kommunPolygon.ts")

# Meter. 150 m är långt under kommungränsens egen lägesosäkerhet i de sammanhang polygonen
# används till (spärr för punktfrågor), och ger en polygon på några hundra hörn.
TOLERANCE_M = 150


def main() -> int:
    if not SRC.exists():
        sys.exit(f"{SRC} saknas — kör först: tools/.venv/Scripts/python tools/lm_stac.py kommun")

    data = json.loads(SRC.read_text(encoding="utf-8"))
    feature = data["features"][0]
    to_3006 = Transformer.from_crs("EPSG:4326", "EPSG:3006", always_xy=True).transform
    geom = shapely_transform(to_3006, shape(feature["geometry"]))

    simplified = geom.simplify(TOLERANCE_M, preserve_topology=True)
    # Buffra ut en aning: hellre släppa igenom en punkt precis på gränsen än att neka en
    # som ligger innanför men utanför den förenklade konturen.
    simplified = simplified.buffer(TOLERANCE_M).simplify(TOLERANCE_M, preserve_topology=True)

    polygons = list(simplified.geoms) if simplified.geom_type == "MultiPolygon" else [simplified]
    rings = [[(round(x), round(y)) for x, y in p.exterior.coords] for p in polygons]
    points = sum(len(r) for r in rings)
    diff = (simplified.area - geom.area) / geom.area * 100

    minx, miny, maxx, maxy = simplified.bounds
    body = ",\n".join("  [" + ", ".join(f"[{x}, {y}]" for x, y in ring) + "]" for ring in rings)

    OUT.write_text(
        f'''/**
 * Norrköpings kommun som förenklad polygon i EPSG:3006 — genererad av tools/kommun_polygon.py
 * ur Lantmäteriets "Kommun, län och rike" (CC BY 4.0). **Redigera inte för hand.**
 *
 * Används som spärr för punktfrågor (markhöjd, IK-08): bbox:en rymmer stora ytor som inte är
 * Norrköping, och om dem ska ingen information hämtas. Tolerans {TOLERANCE_M} m, {points} hörn,
 * area {diff:+.3f} % mot originalet.
 *
 * Ingen import här — filen ska kunna användas av både edge-funktioner och klient.
 */

/** Ytterringar i EPSG:3006. Kommunen har {len(rings)} del{'ar' if len(rings) != 1 else ''} (öar räknas som egna ringar). */
export const KOMMUN_RINGS_3006: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
{body},
];

/** Polygonens omslutande rektangel — billig förhandskontroll före punkt-i-polygon. */
export const KOMMUN_POLYGON_BBOX_3006: readonly [number, number, number, number] = [
  {round(minx)}, {round(miny)}, {round(maxx)}, {round(maxy)},
];

/**
 * Ligger punkten i Norrköpings kommun? Strålkastningsmetoden (even–odd): räkna hur många
 * kanter en stråle åt höger korsar. Udda antal = innanför. Punkter exakt på en kant kan hamna
 * åt endera hållet — polygonen är därför buffrad {TOLERANCE_M} m utåt vid genereringen.
 */
export function pointInKommun(e: number, n: number): boolean {{
  const [minE, minN, maxE, maxN] = KOMMUN_POLYGON_BBOX_3006;
  if (e < minE || e > maxE || n < minN || n > maxN) return false;
  for (const ring of KOMMUN_RINGS_3006) {{
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {{
      const a = ring[i];
      const b = ring[j];
      if (!a || !b) continue;
      const [ax, ay] = a;
      const [bx, by] = b;
      if (ay > n !== by > n && e < ((bx - ax) * (n - ay)) / (by - ay) + ax) inside = !inside;
    }}
    if (inside) return true;
  }}
  return false;
}}
''',
        encoding="utf-8",
        newline="\n",
    )
    print(f"{OUT}: {len(rings)} ring(ar), {points} hörn, area {diff:+.3f} %, {OUT.stat().st_size / 1024:.1f} kB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
