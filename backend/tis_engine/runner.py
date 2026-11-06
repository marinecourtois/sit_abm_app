"""Exécution d'une saison et agrégation des répétitions.

Toutes les métriques reprennent les définitions du notebook (cellule 5,
`_run_factorial_season`). Deux indicateurs dérivés sont ajoutés, définis ici :

* ``larval_damage_pct`` — fruits ayant reçu au moins une ponte fertile, quel que soit leur
  devenir (récoltés + pourris + restés sur la plante), en % des fruits produits. C'est la
  définition de l'axe « Infestés / Larves » du radar du notebook (cellule 24, FIGURE 5).
* ``sterile_puncture_share_pct`` — part des pontes stériles (non viables) parmi toutes les
  pontes déposées dans les fruits pendant la saison (compteurs APP 3).
"""
from __future__ import annotations

import math
from typing import Callable

from .model import CROPS, RematingModel
from .schedules import continuous_schedule, front_loaded_schedule, periodic_schedule

SERIES_VARS = [
    "Wild_males", "Sterile_males", "Females", "Larvae",
    "Young_fruits", "Harvestable_fruits", "Rotten_natural", "Rotten_sterile_only", "Rotten_larvae",
    "Harvested_cumul", "Rotten_cumul",
]

# Stratégies du notebook (make_strategies) : clé app -> nom notebook
STRATEGIES = {
    "no_tis": "No TIS",
    "daily": "Daily",
    "every_3": "Every 3 days",
    "every_7": "Every 7 days",
    "front_70": "70% init + 7d maint",
    "front_100": "100% init",
}

REMATING_MODES = ["preference", "first", "last", "mixed"]


class Cancelled(Exception):
    pass


def build_schedule(strategy: dict, budget: int, season_length: int) -> dict[int, int]:
    """Construit le calendrier à partir des fonctions du notebook.

    ``strategy`` : {"key": ..., "interval"?, "first_day"?, "initial_fraction"?, "maintenance_interval"?}
    Les paramètres omis prennent les valeurs de ``make_strategies``.
    """
    key = strategy["key"]
    if key == "no_tis" or budget == 0:
        return {}
    if key == "daily":
        return continuous_schedule(budget, season_length)
    if key in ("every_3", "every_7", "periodic"):
        default = {"every_3": 3, "every_7": 7}.get(key, 3)
        return periodic_schedule(budget, season_length, int(strategy.get("interval", default)),
                                 int(strategy.get("first_day", 0)))
    if key in ("front_70", "front_100", "front_loaded"):
        frac = float(strategy.get("initial_fraction", 1.0 if key == "front_100" else 0.70))
        maint = int(strategy.get("maintenance_interval", 0 if key == "front_100" else 7))
        return front_loaded_schedule(budget, season_length, frac, maint)
    raise ValueError(f"Stratégie inconnue : {key}")


def run_season(task: dict, on_day: Callable[[int, dict], None] | None = None) -> dict:
    """Une saison. ``task`` = configuration entièrement résolue (aucun défaut implicite)."""
    crop = CROPS[task["crop"]]
    bio = task["biology"]
    model = RematingModel(
        crop_parameters=crop,
        sterile_release_schedule={int(k): int(v) for k, v in task["schedule"].items()},
        num_agents_wild=int(task["wild"]),
        num_agents_females=int(task["females"]),
        sperm_selection=task["remating"],
        fruit_capacity=int(bio["fruit_capacity"]),
        young_puncture_probability=float(bio["young_puncture_probability"]),
        rotten_puncture_probability=float(bio["rotten_puncture_probability"]),
        rotten_threshold=float(bio["rotten_threshold"]),
        larva_age_weight=float(bio["larva_age_weight"]),
        rot_hazard_sterile=float(bio["rot_hazard_sterile"]),
        rot_hazard_fertile=float(bio["rot_hazard_fertile"]),
        harvest_fraction=float(bio["harvest_fraction"]),
        prophylaxis_fraction=float(bio["prophylaxis_fraction"]),
        lifespan_means={"sterile": float(bio["lifespan_sterile"]), "wild": float(bio["lifespan_wild"]),
                        "female": float(bio["lifespan_female"])},
        lifespan_cv={"sterile": float(bio["lifespan_cv"]), "wild": float(bio["lifespan_cv"]),
                     "female": float(bio["lifespan_cv"])},
        eta=float(bio["eta"]),
        eta_sperm_choice=float(bio["eta_sperm_choice"]),
        seed=int(task["seed"]),
    )
    mv = model.datacollector.model_vars
    for day in range(crop.season_length):
        model.advance_day()
        if on_day is not None:
            on_day(day + 1, {v: mv[v][-1] for v in SERIES_VARS})
    tot = crop.total_fruits
    rem = model.remaining_on_plant()
    ovip = model.cumulative_fertile_ovipositions + model.cumulative_sterile_ovipositions
    metrics = {
        "harvested_clean_pct": 100 * model.cumulative_harvested_clean / tot,
        "harvested_sterile_only_pct": 100 * model.cumulative_harvested_sterile_only / tot,
        "harvested_larvae_pct": 100 * model.cumulative_harvested_with_larvae / tot,
        "harvested_pct": 100 * model.cumulative_harvested_fruits / tot,
        "rotten_pct": 100 * model.cumulative_rotten_fruits / tot,
        "rotten_larvae_pct": 100 * model.cumulative_rotten_with_larvae / tot,
        "rotten_sterile_only_pct": 100 * model.cumulative_rotten_sterile_only / tot,
        "rotten_clean_pct": 100 * model.cumulative_rotten_clean / tot,
        "larvae_produced": model.cumulative_larvae_born,
        "remaining_pct": 100 * sum(rem) / tot,
        "remaining_clean_pct": 100 * rem[0] / tot,
        "remaining_sterile_only_pct": 100 * rem[1] / tot,
        "remaining_larvae_pct": 100 * rem[2] / tot,
        "sterile_released": model.total_sterile_released,
    }
    metrics["larval_damage_pct"] = (metrics["harvested_larvae_pct"] + metrics["rotten_larvae_pct"]
                                    + metrics["remaining_larvae_pct"])
    metrics["sterile_puncture_share_pct"] = (100 * model.cumulative_sterile_ovipositions / ovip) if ovip else 0.0
    return {"metrics": metrics, "series": {v: list(mv[v]) for v in ["Time", *SERIES_VARS]}}


# ---------------------------------------------------------------- agrégation
def _stats(values: list[float]) -> dict:
    n = len(values)
    mean = sum(values) / n
    sd = math.sqrt(sum((v - mean) ** 2 for v in values) / (n - 1)) if n > 1 else 0.0  # écart-type corrigé (ddof=1, comme seaborn errorbar="sd")
    return {"mean": mean, "sd": sd, "min": min(values), "max": max(values), "n": n, "values": values}


def aggregate(replicates: list[dict]) -> dict:
    keys = replicates[0]["metrics"].keys()
    metrics = {k: _stats([r["metrics"][k] for r in replicates]) for k in keys}
    series = {"Time": replicates[0]["series"]["Time"]}
    derived = {
        "Wild_adults": lambda s, i: s["Wild_males"][i] + s["Females"][i],
        "SW_ratio": lambda s, i: s["Sterile_males"][i] / max(1, s["Wild_males"][i]),  # notebook : S / max(1, W)
    }
    n_t = len(series["Time"])
    for v in SERIES_VARS:
        cols = [[r["series"][v][i] for r in replicates] for i in range(n_t)]
        series[v] = _band(cols)
    for name, fn in derived.items():
        cols = [[fn(r["series"], i) for r in replicates] for i in range(n_t)]
        series[name] = _band(cols)
    # Population relative : adultes sauvages (W + F) / leur effectif au jour 0, par répétition
    cols = [[(r["series"]["Wild_males"][i] + r["series"]["Females"][i])
             / max(1, r["series"]["Wild_males"][0] + r["series"]["Females"][0]) for r in replicates]
            for i in range(n_t)]
    series["Wild_adults_relative"] = _band(cols)
    return {"metrics": metrics, "series": series}


def _band(cols):
    means, sds = [], []
    for c in cols:
        s = _stats(c)
        means.append(s["mean"])
        sds.append(s["sd"])
    return {"mean": means, "sd": sds}
