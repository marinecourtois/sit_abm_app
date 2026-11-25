"""Recalcule le plan factoriel du notebook (cellule 6) avec N répétitions.

Même plan, même ordre de boucles et même formule de graine que `run_factorial_experiment` :
    seed = 42 + rep·1000 + B·7 + len(stratégie)·13 + len(invasion)·19
Les répétitions 0 à 2 sont donc identiques au CSV du notebook ; le script le vérifie
(égalité exacte) avant d'écrire quoi que ce soit.

Usage : .venv/bin/python scripts/factorial.py --reps 10
Sortie : data/factorial/factorial_r<N>.csv + factorial_r<N>.json (provenance)
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tis_engine.model import CHERRY, ECHELLE, ENGINE_VERSION, STRAWBERRY  # noqa: E402
from tis_engine.parameters import INVASION_PRESETS, biology_defaults  # noqa: E402
from tis_engine.runner import STRATEGIES, build_schedule, run_season  # noqa: E402
from tis_engine.schedules import make_strategies  # noqa: E402

NB_TO_KEY = {v: k for k, v in STRATEGIES.items()}
COLS = {  # colonnes du CSV du notebook -> métriques du moteur
    "Harvested - clean (%)": "harvested_clean_pct", "Harvested - sterile only (%)": "harvested_sterile_only_pct",
    "Harvested - larvae (%)": "harvested_larvae_pct", "Harvested (%)": "harvested_pct", "Rotten (%)": "rotten_pct",
    "Rotten - larvae (%)": "rotten_larvae_pct", "Rotten - sterile only (%)": "rotten_sterile_only_pct",
    "Rotten - clean (%)": "rotten_clean_pct", "Larvae produced": "larvae_produced",
    "Remaining on plant (%)": "remaining_pct", "Remaining - clean (%)": "remaining_clean_pct",
    "Remaining - sterile only (%)": "remaining_sterile_only_pct", "Remaining - larvae (%)": "remaining_larvae_pct",
}


def tasks(n_reps: int):
    invasions = {p["nb_label"]: p for p in INVASION_PRESETS.values()}        # Faible, Moyenne, Forte (noms et effectifs du notebook)
    budgets = [b * ECHELLE for b in (0, 150, 300, 600)]
    for crop in (STRAWBERRY, CHERRY):
        for inv_name, pop in invasions.items():
            for rem in ("preference", "first"):
                for b in budgets:
                    for s_name in make_strategies(b, crop.season_length):
                        for rep in range(n_reps):
                            seed = 42 + rep * 1000 + b * 7 + len(s_name) * 13 + len(inv_name) * 19
                            yield {"crop": crop.name, "inv_name": inv_name, "wild": pop["wild"], "females": pop["females"],
                                   "remating": rem, "budget": b, "s_name": s_name, "rep": rep, "seed": seed,
                                   "season_length": crop.season_length}


def run_one(t):
    task = {"crop": t["crop"], "wild": t["wild"], "females": t["females"], "remating": t["remating"], "seed": t["seed"],
            "schedule": build_schedule({"key": NB_TO_KEY[t["s_name"]]}, t["budget"], t["season_length"]),
            "biology": biology_defaults()}
    m = run_season(task)["metrics"]
    row = {"Crop": t["crop"], "Invasion": t["inv_name"], "Budget": t["budget"], "Remating": t["remating"],
           "Strategy": t["s_name"], "Replicate": t["rep"]}
    row.update({col: m[key] for col, key in COLS.items()})
    row["Seed"] = t["seed"]
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reps", type=int, default=10)
    ap.add_argument("--workers", type=int, default=min(16, os.cpu_count() or 1))
    a = ap.parse_args()
    todo = list(tasks(a.reps))
    print(f"{len(todo)} saisons, {a.workers} processus", flush=True)
    t0 = time.time()
    rows = []
    with ProcessPoolExecutor(a.workers) as ex:
        for i, r in enumerate(ex.map(run_one, todo, chunksize=4), 1):
            rows.append(r)
            if i % 100 == 0:
                print(f"  {i}/{len(todo)}  {time.time() - t0:.0f} s", flush=True)

    # Vérification : les répétitions déjà calculées par le notebook doivent être identiques au bit près
    ref = ROOT / "data" / "reference" / "resultats_experience_factorielle.csv"
    nb = {(r["Crop"], r["Invasion"], r["Budget"], r["Remating"], r["Strategy"], r["Replicate"]): r for r in csv.DictReader(open(ref))}
    checked = 0
    for r in rows:
        k = (r["Crop"], r["Invasion"], str(r["Budget"]), r["Remating"], r["Strategy"], str(r["Replicate"]))
        if k in nb:
            for col in COLS:
                if float(nb[k][col]) != float(r[col]):
                    sys.exit(f"ÉCHEC : {k} {col} notebook={nb[k][col]} recalcul={r[col]} — rien n'est écrit.")
            checked += 1
    if checked != len(nb):
        sys.exit(f"ÉCHEC : {checked} lignes du notebook retrouvées sur {len(nb)}.")

    out = ROOT / "data" / "factorial"
    out.mkdir(exist_ok=True)
    path = out / f"factorial_r{a.reps}.csv"
    fields = list(rows[0])
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    import modelly
    prov = {"replicates": a.reps, "seasons": len(rows), "notebook_rows_identical": checked,
            "seed_formula": "42 + rep*1000 + budget*7 + len(strategy)*13 + len(invasion)*19 (notebook, cellule 5)",
            "engine_version": ENGINE_VERSION, "modelly_version": modelly.__version__,
            "modelly_file": modelly.__file__, "computed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "duration_s": round(time.time() - t0, 1), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    (out / f"factorial_r{a.reps}.json").write_text(json.dumps(prov, indent=2, ensure_ascii=False))
    print(json.dumps(prov, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
