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


def test_worker_skips_seasons_of_cancelled_runs():
    """Une saison mise en file d'une expérience déjà annulée n'est pas calculée."""
    from app import worker
    from tis_engine.runner import Cancelled
    sent = []
    worker.init(type("Q", (), {"put": lambda self, m: sent.append(m)})(), {"job": True})
    with pytest.raises(Cancelled):
        worker.run_task("job", "k", 0, {}, True)
    assert sent == []


# ---------------------------------------------------------------- 1.9.0 : séries et extensions hors notebook
def _season(**bio):
    t = task("strawberry", "Every 3 days", 9000, 10 * ECHELLE, "preference", 4242)
    t["biology"] = {**t["biology"], **bio}
    return run_season(t)


def test_new_series_are_consistent_and_draw_nothing():
    """Femelles fécondées ≤ femelles ; probabilité d'accouplement stérile dans [0, 1], nulle sans
    stériles. Ces lectures ne tirent aucun nombre : les métriques restent celles du notebook
    (vérifié par test_factorial_bit_exact et test_dynamics_bit_exact)."""
    s = _season()["series"]
    assert all(0 <= ff <= f for ff, f in zip(s["Fertile_females"], s["Females"]))
    assert max(s["Fertile_females"]) > 0
    assert all(0.0 <= p <= 1.0 for p in s["Sterile_mating_prob"])
    for p, st in zip(s["Sterile_mating_prob"], s["Sterile_males"]):
        if st == 0:
            assert p == 0.0
    t = task("strawberry", "No TIS", 0, 10 * ECHELLE, "first", 4242)
    assert set(run_season(t)["series"]["Sterile_mating_prob"]) == {0.0}


def test_immigration_extension():
    base, imm = _season(), _season(immigration_wild_males=15, immigration_females=8)
    assert base["metrics"]["immigrants"] == 0
    assert imm["metrics"]["immigrants"] == (15 + 8) * (SEASON["strawberry"] - 1)   # de J1 à la fin de la saison
    assert imm["metrics"]["larvae_produced"] > base["metrics"]["larvae_produced"]


def test_immigration_every_x_days():
    """1.11.0 : une arrivée tous les X jours, à partir de J1 (jours X, 2X, …)."""
    for every in (1, 3, 7):
        m = _season(immigration_wild_males=10, immigration_females=5, immigration_every=every)["metrics"]
        assert m["immigrants"] == 15 * ((SEASON["strawberry"] - 1) // every), every
    assert _season(immigration_every=3)["metrics"] == _season()["metrics"]   # sans effectif, sans effet


def test_carrying_capacity_extension():
    """Sans lâcher, la population grandit ; avec K_a, une émergence n'a lieu que si W + F < K_a,
    donc W + F ne dépasse jamais K_a (l'effectif initial, 600, est en dessous)."""
    t = task("strawberry", "No TIS", 0, 10 * ECHELLE, "preference", 4242)
    off = run_season(t)
    t["biology"] = {**t["biology"], "carrying_capacity": 900}
    on = run_season(t)
    assert off["metrics"]["emergences_blocked"] == 0
    assert max(w + f for w, f in zip(off["series"]["Wild_males"], off["series"]["Females"])) > 900
    assert on["metrics"]["emergences_blocked"] > 0
    assert max(w + f for w, f in zip(on["series"]["Wild_males"], on["series"]["Females"])) <= 900


def test_turning_stage_extension():
    """Avec p_y = 0 et un stade tournant qui couvre toute la phase jeune (d_t ≥ maturité max),
    la réussite d'une ponte sur fruit jeune vaut p_t partout : identique au bit près au modèle
    du notebook avec p_y = p_t. Un stade plus court change les résultats."""
    ref = _season(young_puncture_probability=0.3)
    full = _season(young_puncture_probability=0.0, turning_days=10, turning_puncture_probability=0.3)
    assert full["metrics"] == ref["metrics"]
    short = _season(young_puncture_probability=0.0, turning_days=1, turning_puncture_probability=0.3)
    assert short["metrics"]["larvae_produced"] != ref["metrics"]["larvae_produced"]
    # d_t = maturité max (4 j pour la fraise) ne couvre pas encore l'âge 0 : différent de la couverture totale
    edge = _season(young_puncture_probability=0.0, turning_days=4, turning_puncture_probability=0.3)
    assert edge["metrics"] != ref["metrics"]


def test_turning_window_lasts_exactly_d_t_days():
    """Un fruit est jeune aux âges 0 … M ; avec d_t, seuls les âges M-d_t+1 … M sont « tournants »."""
    from tis_engine.model import CROPS, RematingModel
    m = RematingModel(CROPS["cherry"], turning_days=3, turning_puncture_probability=1.0, young_puncture_probability=0.0, seed=1)
    f = m.fruits[0]
    hits = []
    for t in range(f.maturation_age + 1):
        m.time = t
        hits.append(f.can_receive_oviposition())
    assert hits == [False] * (f.maturation_age + 1 - 3) + [True] * 3


def test_fort_inoculum_matches_calibration():
    """L'inoculum fort figé dans parameters.FORT_BY_CROP est exactement celui que calcule
    tis_engine.calibration (pic du témoin sans lâcher depuis l'inoculum modéré, 20 répétitions)."""
    from tis_engine.calibration import fort_inoculum
    from tis_engine.parameters import FORT_BY_CROP
    for crop in ("strawberry", "cherry"):
        assert fort_inoculum(crop) == FORT_BY_CROP[crop], crop


def test_notebook_inoculum_names_unchanged():
    """Le plan factoriel du notebook garde ses noms et ses effectifs (900 W : 900 F pour « Forte »)."""
    from tis_engine.parameters import INVASION_PRESETS
    names = [p["nb_label"] for p in INVASION_PRESETS.values()]
    assert names == ["Faible (90 W : 90 F)", "Moyenne (300 W : 300 F)", "Forte (900 W : 900 F)"]
    with open(REF / "resultats_experience_factorielle.csv") as f:
        assert {r["Invasion"] for r in csv.DictReader(f)} == set(names)
