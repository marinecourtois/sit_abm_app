"""Non-régression scientifique : le moteur extrait doit reproduire les sorties du notebook.

Références :
* cellule 9 (test rapide, sortie affichée dans le notebook) ;
* data/reference/resultats_experience_factorielle.csv (sha256 974eab8e7659…) ;
* data/reference/dynamiques_temporelles_journalieres.csv (sha256 cb01eac6d360…).
"""
import csv
import hashlib
from pathlib import Path

import pytest

from tis_engine.model import ECHELLE
from tis_engine.parameters import biology_defaults
from tis_engine.runner import STRATEGIES, build_schedule, run_season
from tis_engine.schedules import make_strategies

REF = Path(__file__).resolve().parent.parent / "data" / "reference"
NB_TO_KEY = {v: k for k, v in STRATEGIES.items()}
SEASON = {"strawberry": 100, "cherry": 25}


def task(crop, strategy_nb, budget, inv, remating, seed):
    key = NB_TO_KEY[strategy_nb]
    return {
        "crop": crop, "wild": inv, "females": inv, "remating": remating, "seed": seed,
        "schedule": build_schedule({"key": key}, budget, SEASON[crop]),
        "biology": biology_defaults(),
    }


def test_reference_files_unchanged():
    h = lambda p: hashlib.sha256((REF / p).read_bytes()).hexdigest()
    assert h("resultats_experience_factorielle.csv").startswith("974eab8e7659")
    assert h("dynamiques_temporelles_journalieres.csv").startswith("cb01eac6d360")


@pytest.mark.parametrize("budget", [0, 4500, 9000, 18000])
def test_schedules_match_make_strategies(budget):
    for crop, L in SEASON.items():
        for nb_name, sched in make_strategies(budget, L).items():
            assert build_schedule({"key": NB_TO_KEY[nb_name]}, budget, L) == sched
            assert sum(sched.values()) == budget


# Sortie affichée de la cellule 9 (fraise, invasion Moyenne, budget 9 000, preference, graine 42)
CELL9 = {
    "No TIS": (50.7, 30.5, 30.1, 0.0, 2.9, 74415),
    "Daily": (82.9, 8.3, 3.7, 3.4, 3.3, 7350),
    "Every 3 days": (82.8, 8.3, 3.3, 3.7, 3.3, 6478),
    "Every 7 days": (86.0, 6.4, 2.0, 3.1, 3.3, 3838),
    "70% init + 7d maint": (88.0, 5.3, 0.9, 2.9, 3.4, 1791),
    "100% init": (81.1, 9.7, 6.5, 2.0, 3.2, 13826),
}


@pytest.mark.parametrize("strategy", list(CELL9))
def test_cell9_quick_test(strategy):
    budget = 0 if strategy == "No TIS" else 300 * ECHELLE
    m = run_season(task("strawberry", strategy, budget, 10 * ECHELLE, "preference", 42))["metrics"]
    got = (round(m["harvested_clean_pct"], 1), round(m["rotten_pct"], 1), round(m["rotten_larvae_pct"], 1),
           round(m["rotten_sterile_only_pct"], 1), round(m["remaining_pct"], 1), m["larvae_produced"])
    assert got == CELL9[strategy]


COLS = {
    "Harvested - clean (%)": "harvested_clean_pct", "Harvested - sterile only (%)": "harvested_sterile_only_pct",
    "Harvested - larvae (%)": "harvested_larvae_pct", "Harvested (%)": "harvested_pct", "Rotten (%)": "rotten_pct",
    "Rotten - larvae (%)": "rotten_larvae_pct", "Rotten - sterile only (%)": "rotten_sterile_only_pct",
    "Rotten - clean (%)": "rotten_clean_pct", "Larvae produced": "larvae_produced",
    "Remaining on plant (%)": "remaining_pct", "Remaining - clean (%)": "remaining_clean_pct",
    "Remaining - sterile only (%)": "remaining_sterile_only_pct", "Remaining - larvae (%)": "remaining_larvae_pct",
}


def factorial_rows():
    with open(REF / "resultats_experience_factorielle.csv") as f:
        rows = list(csv.DictReader(f))
    # échantillon déterministe couvrant cultures, invasions, régimes, budgets, stratégies
    return rows[::23]


@pytest.mark.parametrize("row", factorial_rows(), ids=lambda r: f"{r['Crop']}-{r['Strategy']}-{r['Budget']}-{r['Remating']}-{r['Replicate']}")
def test_factorial_bit_exact(row):
    inv_name, b, s_name, rep = row["Invasion"], int(row["Budget"]), row["Strategy"], int(row["Replicate"])
    inv = int(inv_name.split("(")[1].split(" ")[0])
    seed = 42 + rep * 1000 + b * 7 + len(s_name) * 13 + len(inv_name) * 19  # cellule 5, base_seed=42
    m = run_season(task(row["Crop"], s_name, b, inv, row["Remating"], seed))["metrics"]
    for col, key in COLS.items():
        assert float(row[col]) == m[key], col   # égalité exacte, pas d'approximation


def test_dynamics_bit_exact():
    with open(REF / "dynamiques_temporelles_journalieres.csv") as f:
        rows = list(csv.DictReader(f))
    for crop, s_name, rem, rep in [("strawberry", "Daily", "preference", 0), ("cherry", "100% init", "first", 2),
                                   ("strawberry", "No TIS", "first", 4)]:
        ref = [r for r in rows if (r["Crop"], r["Strategy"], r["Remating"], r["Replicate"]) == (crop, s_name, rem, str(rep))]
        b = 0 if s_name == "No TIS" else 300 * ECHELLE
        seed = 42 + rep * 1000 + len(s_name) * 17  # cellule 12
        s = run_season(task(crop, s_name, b, 10 * ECHELLE, rem, seed))["series"]
        assert len(ref) == SEASON[crop] + 1
        for i, r in enumerate(ref):
            for v in ("Wild_males", "Sterile_males", "Females", "Larvae", "Young_fruits", "Harvestable_fruits",
                      "Rotten_natural", "Rotten_sterile_only", "Rotten_larvae", "Harvested_cumul", "Rotten_cumul"):
                assert int(r[v]) == s[v][i], (crop, s_name, i, v)
