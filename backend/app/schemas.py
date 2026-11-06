"""Contrats de données de l'API (configuration d'expérience) et validation scientifique."""
from __future__ import annotations

import hashlib
import json
from typing import Literal, Optional

from pydantic import BaseModel, Field

from tis_engine.model import CROPS
from tis_engine.parameters import MAX_REPLICATES, MIN_REPLICATES, BIOLOGY_PARAMS, INVASION_PRESETS, STRATEGY_META, biology_defaults
from tis_engine.runner import REMATING_MODES, STRATEGY_PRESETS, build_schedule


class StrategySpec(BaseModel):
    key: Literal["no_tis", "daily", "every_3", "every_7", "front_70", "front_100", "periodic", "front_loaded"]
    interval: Optional[int] = None
    first_day: Optional[int] = None
    initial_fraction: Optional[float] = None
    maintenance_interval: Optional[int] = None
    label: Optional[str] = None


class Invasion(BaseModel):
    preset: Optional[str] = None
    wild: int
    females: int


class ExperimentConfig(BaseModel):
    crops: list[str] = Field(min_length=1)
    strategies: list[StrategySpec] = Field(min_length=1)
    invasion: Invasion
    budget: int
    remating: str = "preference"
    replicates: int = MIN_REPLICATES
    seed: int = 42
    include_control: bool = True
    biology: dict = Field(default_factory=biology_defaults)


class ExperimentCreate(BaseModel):
    name: str
    project: str = "Étude 01"
    description: str = ""
    config: ExperimentConfig
    parent_id: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    run: bool = True


def strategy_id(s: StrategySpec) -> str:
    parts = [s.key] + [f"{k}={v}" for k, v in s.model_dump(exclude={"key", "label"}).items() if v is not None]
    return "|".join(parts)


def strategy_label(s: StrategySpec) -> str:
    if s.label:
        return s.label
    overrides = {k: v for k, v in s.model_dump(exclude={"key", "label"}).items() if v is not None}
    if s.key in STRATEGY_META and not overrides:
        return STRATEGY_META[s.key]["label"]
    p = {**STRATEGY_PRESETS[s.key], **overrides}   # valeurs effectives (presets du moteur)
    if p["kind"] == "periodic":
        return f"J+{p['interval']}" + (f" (dès J{p['first_day']})" if p["first_day"] else "")
    if p["kind"] == "front_loaded":
        fr, mi = p["initial_fraction"], p["maintenance_interval"]
        return f"{round(fr * 100)} % initial" + (f" + maint. {mi} j" if fr < 1 and mi else "")
    return STRATEGY_META.get(s.key, {}).get("label", s.key)


def config_hash(cfg: ExperimentConfig) -> str:
    return hashlib.sha256(json.dumps(cfg.model_dump(), sort_keys=True).encode()).hexdigest()[:16]


def crop_label(crop: str) -> str:
    from tis_engine.parameters import CROP_META
    return CROP_META.get(crop, {}).get("label", crop)


def count_seasons(cfg: ExperimentConfig) -> int:
    n_strat = len(cfg.strategies) + (1 if cfg.include_control and not any(s.key == "no_tis" for s in cfg.strategies) else 0)
    return len(cfg.crops) * n_strat * cfg.replicates


def validate_config(cfg: ExperimentConfig, history: list[dict] | None = None) -> dict:
    """Vérifie unités, bornes, compatibilités. Ne corrige jamais silencieusement."""
    errors, warnings = [], []
    for c in cfg.crops:
        if c not in CROPS:
            errors.append(f"Culture inconnue du moteur : « {c} ».")
    if cfg.remating not in REMATING_MODES:
        errors.append(f"Régime de réaccouplement inconnu : « {cfg.remating} ».")
    if not MIN_REPLICATES <= cfg.replicates <= MAX_REPLICATES:
        errors.append(f"Le nombre de répétitions doit être compris entre {MIN_REPLICATES} et {MAX_REPLICATES} "
                      f"(minimum de l'étude : {MIN_REPLICATES} répétitions par scénario).")
    if cfg.budget < 0 or cfg.budget > 1_000_000:
        errors.append("Le budget (nombre total de mâles stériles lâchés) doit être compris entre 0 et 1 000 000.")
    if cfg.invasion.wild < 0 or cfg.invasion.females < 0:
        errors.append("Les effectifs initiaux d'insectes doivent être positifs.")
    if cfg.invasion.wild + cfg.invasion.females > 200_000:
        errors.append("Population initiale supérieure à 200 000 individus : non prise en charge.")
    if cfg.invasion.preset and cfg.invasion.preset in INVASION_PRESETS:
        p = INVASION_PRESETS[cfg.invasion.preset]
        if (p["wild"], p["females"]) != (cfg.invasion.wild, cfg.invasion.females):
            warnings.append("Les effectifs diffèrent du préréglage choisi : ils seront utilisés tels quels.")
    if not 0 <= cfg.seed < 2**31:
        errors.append("La graine aléatoire doit être un entier entre 0 et 2³¹−1.")

    missing = [k for k in BIOLOGY_PARAMS if k not in cfg.biology]
    unknown = [k for k in cfg.biology if k not in BIOLOGY_PARAMS]
    if missing:
        errors.append("Paramètres biologiques manquants : " + ", ".join(missing))
    if unknown:
        errors.append("Paramètres non pris en charge par le moteur : " + ", ".join(unknown))
    for k, meta in BIOLOGY_PARAMS.items():
        if k in cfg.biology:
            v = cfg.biology[k]
            if not isinstance(v, (int, float)) or isinstance(v, bool):
                errors.append(f"{k} : valeur numérique attendue ({meta[1]}).")
            elif not meta[3] <= v <= meta[4]:
                errors.append(f"{k} = {v} hors de la plage admise [{meta[3]} ; {meta[4]}] ({meta[1]}).")
            elif v != meta[2]:
                warnings.append(f"{k} = {v} {meta[1]} (valeur du notebook : {meta[2]}).")

    scenarios = []
    if not errors:
        for crop in cfg.crops:
            L = CROPS[crop].season_length
            for s in cfg.strategies:
                if s.interval is not None and not 1 <= s.interval <= L:
                    errors.append(f"{strategy_label(s)} : l'intervalle doit être compris entre 1 et {L} jours ({crop}).")
                    continue
                if s.first_day is not None and not 0 <= s.first_day < L:
                    errors.append(f"{strategy_label(s)} : le premier jour doit être dans la saison (0–{L - 1}).")
                    continue
                if s.initial_fraction is not None and not 0 <= s.initial_fraction <= 1:
                    errors.append(f"{strategy_label(s)} : fraction initiale entre 0 et 1.")
                    continue
                if s.maintenance_interval is not None and not 0 <= s.maintenance_interval <= L:
                    errors.append(f"{strategy_label(s)} : intervalle de maintenance entre 0 et {L} jours.")
                    continue
                try:
                    sched = build_schedule(s.model_dump(exclude_none=True), cfg.budget, L)
                except (ValueError, ZeroDivisionError) as e:
                    errors.append(f"{strategy_label(s)} : calendrier impossible ({e}).")
                    continue
                n_days = sum(1 for v in sched.values() if v > 0)
                if s.key != "no_tis" and cfg.budget == 0:
                    warnings.append(f"{strategy_label(s)} : budget nul, aucun lâcher (équivaut au témoin).")
                if s.key != "no_tis" and 0 < cfg.budget < len(sched):
                    warnings.append(f"{strategy_label(s)} ({crop}) : budget inférieur au nombre de jours de lâcher, certains jours reçoivent 0 stérile.")
                if s.key != "no_tis" and 0 < n_days <= 4:
                    days = ", ".join(f"J{d}" for d in sorted(int(k) for k, v in sched.items() if v))
                    warnings.append(f"{crop_label(crop)} · {strategy_label(s)} : seulement {n_days} lâcher{'s' if n_days > 1 else ''} "
                                    f"sur une saison de {L} jours ({days}).")
                scenarios.append({"crop": crop, "strategy": strategy_label(s), "strategy_key": s.key, "release_days": n_days,
                                  "total_released": sum(sched.values()), "season_length": L,
                                  "schedule": {str(k): v for k, v in sched.items() if v}})

    seasons = count_seasons(cfg)
    estimate = {"seasons": seasons, "seconds": None,
                "basis": "Aucune exécution terminée sur ce serveur : pas d'estimation mesurée."}
    runs = [h for h in (history or []) if h["seasons"] and h["duration_s"]]
    if runs:
        # durée murale par saison mesurée sur ce serveur (même parallélisme), pondérée par le nombre de saisons
        rate = sum(h["duration_s"] for h in runs) / sum(h["seasons"] for h in runs)
        estimate = {"seasons": seasons, "seconds": round(seasons * rate, 1),
                    "basis": f"Mesuré : {rate:.2f}".replace(".", ",") + f" s par saison en moyenne sur {len(runs)} exécution{'s' if len(runs) > 1 else ''} "
                             f"terminée{'s' if len(runs) > 1 else ''} de ce serveur. La durée réelle dépend de la culture et des effectifs."}
    return {"ok": not errors, "errors": errors, "warnings": warnings, "scenarios": scenarios,
            "estimate": estimate}
