#!/usr/bin/env python
"""
Bygger data/bad/badplatser.geojson (kravspec §6.3, DK-06) från Havs- och vattenmyndighetens
Badplatsen-API — alla EU-registrerade badplatser i Norrköpings kommun (kommunkod 0581).

Statisk grunddata: läge, namn, vattenförekomst, HaV-id, typ, faciliteter (okända tills
kommunens/OSM:s uppgifter kuraterats — fälten finns men är null), härkomst. Den dynamiska
statusen (klassificering, provsvar, alger, avrådan, temperatur) hämtas i drift av
/api/bad/status (IK-02) — aldrig från den här filen.

Topp 3 (DK-05) räknas här från HaV:s historik med den publicerade viktningen:
  40 % badvattenklassificering senaste säsong (utmärkt=100, bra=75, tillfredsställande=40, dålig=0)
       — ingen av Norrköpings badplatser är EU-klassificerad (2026), så delen är neutral (50) tills vidare
  25 % historik utan otjänliga prov (5 år); "tjänligt med anmärkning" räknas som halvt avdrag
  20 % faciliteter/tillgänglighet — okänt ännu → neutralt 50
  15 % frekvens av algblomningsanmärkningar (5 år)
Badplatser med aktiv avrådan kan aldrig bli Topp 3 (DK-07). Resultatet är reproducerbart:
kör scriptet igen och samma tal kommer ut för samma HaV-data.

  tools/.venv/Scripts/python tools/badplatser_hav.py
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://badplatsen.havochvatten.se/badplatsen/api"
UA = "Norrkopingskartan/0.1 (+https://norrkoping.netlify.app)"
NUTS_PREFIX = "SE0230581"  # SE + 023 (Östergötland) + 0581 (Norrköping)
OUT = Path("data/bad/badplatser.geojson")

CLASS_SCORE = {1: 100, 2: 75, 3: 40, 4: 0}  # HaV: 1 utmärkt, 2 bra, 3 tillfredsställande, 4 dålig, 0 ej klassificerad, 6 ny
TOP3_WEIGHTS = {"classification": 0.40, "history": 0.25, "facilities": 0.20, "algae": 0.15}
YEARS = 5

def get(url: str):
    """HaV:s API svarar intermittent 500 — försök igen med backoff innan vi ger upp."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except (urllib.error.HTTPError, urllib.error.URLError) as err:
            if attempt == 4:
                raise
            time.sleep(1.5 * (attempt + 1))
            last = err
    raise RuntimeError(f"HaV svarade inte: {url}") from last


def slugify(name: str) -> str:
    s = name.lower().replace("å", "a").replace("ä", "a").replace("ö", "o").replace("é", "e")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def water_type(name: str, water: str | None) -> str:
    w = (water or name).lower()
    if any(k in w for k in ("bråviken", "arkösund", "slätbaken", "hav")):
        return "hav"
    if any(k in w for k in ("ström", "å ", "ån", "kanal")):
        return "å"
    return "sjö"


def score(detail: dict) -> tuple[float, dict]:
    now_year = datetime.now(timezone.utc).year
    ratings = {r["ratingYear"]: r["qualityRating"] for r in detail.get("qualityRating", [])}
    latest_year = max((y for y in ratings if ratings[y] in CLASS_SCORE), default=None)
    classification = CLASS_SCORE[ratings[latest_year]] if latest_year else 50  # ny/ej klassificerad → neutralt
    recent = [t for t in detail.get("testResult", []) if t.get("sampleDate") and datetime.fromtimestamp(t["sampleDate"] / 1000, timezone.utc).year >= now_year - YEARS]
    # HaV sampleValue: 1 tjänligt, 2 tjänligt med anmärkning, 3 otjänligt, 4 uppgift saknas (räknas inte)
    results = [t for t in recent if t.get("sampleValue") in (1, 2, 3)]
    n = len(results)
    unfit = sum(1 for t in results if t.get("sampleValue") == 3)
    remark = sum(1 for t in results if t.get("sampleValue") == 2)
    history = 100 * (1 - (unfit + 0.5 * remark) / n) if n else 50
    # HaV algalValue: 3 blomning, 4 ingen blomning, 5 uppgift saknas (räknas inte)
    algae_obs = [t for t in recent if t.get("algalValue") in (3, 4)]
    algae = sum(1 for t in algae_obs if t.get("algalValue") == 3)
    algae_score = 100 * (1 - algae / len(algae_obs)) if algae_obs else 50
    facilities = 50  # okänt tills kuraterat
    total = (
        TOP3_WEIGHTS["classification"] * classification
        + TOP3_WEIGHTS["history"] * history
        + TOP3_WEIGHTS["facilities"] * facilities
        + TOP3_WEIGHTS["algae"] * algae_score
    )
    return round(total, 1), {
        "classification": classification,
        "classificationYear": latest_year,
        "history": round(history, 1),
        "samples5y": n,
        "unfit5y": unfit,
        "remark5y": remark,
        "algae": round(algae_score, 1),
        "algaeObservations5y": algae,
        "facilities": facilities,
    }


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    all_sites = get(f"{API}/feature")["features"]
    sites = [f for f in all_sites if str(f["properties"].get("NUTSKOD", "")).startswith(NUTS_PREFIX)]
    print(f"{len(sites)} badplatser i Norrköpings kommun (av {len(all_sites)} i Sverige)")

    features = []
    for f in sites:
        nuts = f["properties"]["NUTSKOD"]
        detail = get(f"{API}/detail/{nuts}")
        full = detail.get("locationName") or f["properties"]["NAMN"]
        water, _, short = full.partition(", ")
        if not short:
            short, water = full, None
        total, parts = score(detail)
        dissuasion = detail.get("dissuasion") or []
        lon, lat = f["geometry"]["coordinates"]
        features.append({
            "type": "Feature",
            "id": f"nkpg-bad-{nuts[-4:]}",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "slug": slugify(short),
                "name": {"sv": short, "en": short},
                "fullName": full,
                "waterBody": water,
                "havId": nuts,
                "type": water_type(short, water),
                "euBathingWater": bool(detail.get("euType")),
                "top3Score": total,
                "top3Parts": parts,
                "hasDissuasion": len(dissuasion) > 0,
                "facilities": {k: None for k in ("sand", "jetty", "changingRoom", "toilet", "ramp", "parking", "kiosk", "playground", "lifebuoy", "dogFriendly")},
                "accessibility": {"wheelchair": "unknown", "accessibleParking": None},
                "contact": {"url": detail.get("contactUrl"), "phone": detail.get("contactPhone")},
                "provenance": {
                    "geometrySource": "Havs- och vattenmyndigheten",
                    "facilitiesSource": None,
                    "positionAccuracyM": 15,
                    "updated": time.strftime("%Y-%m-%d"),
                    "reviewDue": f"{datetime.now().year + 1}-05-01",
                },
            },
        })
        print(f"  {nuts}  {full:38s} score {total:5.1f}  klass {parts['classification']:>3} ({parts['classificationYear']})  prov5å {parts['samples5y']:>2}  otjänliga {parts['unfit5y']}  alger {parts['algaeObservations5y']}  avrådan {'JA' if dissuasion else '-'}")

    # Topp 3: högst poäng, aldrig med avrådan (DK-07), aldrig plaskdamm
    # Vid lika poäng: fler prov = starkare underlag; därefter namn (deterministiskt).
    ranked = sorted(
        (x for x in features if not x["properties"]["hasDissuasion"] and "plaskdamm" not in x["properties"]["fullName"].lower()),
        key=lambda x: (-x["properties"]["top3Score"], -x["properties"]["top3Parts"]["samples5y"], x["properties"]["fullName"]),
    )
    for i, x in enumerate(ranked[:3], 1):
        x["properties"]["isTop3"] = True
        x["properties"]["top3Rank"] = i
        p = x["properties"]["top3Parts"]
        x["properties"]["top3Rationale"] = {
            "sv": f"Klassificering {p['classification']}/100 ({p['classificationYear'] or 'ej klassificerad'}), "
                  f"{p['samples5y']} prov senaste {YEARS} åren varav {p['unfit5y']} otjänliga och {p['remark5y']} med anmärkning, "
                  f"{p['algaeObservations5y']} algobservationer. Faciliteter ej kuraterade ännu (neutralt 50).",
            "en": f"Classification {p['classification']}/100 ({p['classificationYear'] or 'not classified'}), "
                  f"{p['samples5y']} samples in the last {YEARS} years of which {p['unfit5y']} unfit and {p['remark5y']} with remarks, "
                  f"{p['algaeObservations5y']} algae observations. Facilities not yet curated (neutral 50).",
        }
    for x in features:
        x["properties"].setdefault("isTop3", False)

    features.sort(key=lambda x: x["properties"]["fullName"])
    collection = {
        "type": "FeatureCollection",
        "name": "badplatser-norrkoping",
        "license": "Öppna data, Havs- och vattenmyndigheten (Badplatsen API); kuratering © Aren Mardian",
        "attribution": "Källa: Havs- och vattenmyndigheten",
        "retrieved": time.strftime("%Y-%m-%d"),
        "top3Method": {
            "weights": TOP3_WEIGHTS,
            "years": YEARS,
            "classScore": CLASS_SCORE,
            "note": "Se /metod. Ingen badplats i kommunen är EU-klassificerad → klassificering neutral 50. Faciliteter neutralt 50 tills kuraterade. Anmärkning = halvt avdrag. Lika poäng: fler prov vinner.",
        },
        "features": features,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"\nTopp 3: {[x['properties']['fullName'] for x in ranked[:3]]}")
    print(f"{OUT}: {len(features)} objekt, {OUT.stat().st_size/1024:.1f} kB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
