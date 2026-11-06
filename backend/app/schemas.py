"""Contrats de données de l'API (configuration d'expérience) et validation scientifique."""
from __future__ import annotations

import hashlib
import json
from typing import Literal, Optional

from pydantic import BaseModel, Field

from tis_engine.model import CROPS
from tis_engine.parameters import BIOLOGY_PARAMS, INVASION_PRESETS, STRATEGY_META, biology_defaults
from tis_engine.runner import REMATING_MODES, build_schedule


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
    replicates: int = 3
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
    if s.key in STRATEGY_META and all(v is None for v in (s.interval, s.first_day, s.initial_fraction, s.maintenance_interval)):
        return STRATEGY_META[s.key]["label"]
    if s.key in ("periodic", "every_3", "every_7"):
        iv = s.interval or (7 if s.key == "every_7" else 3)
        return f"J+{iv}" + (f" (dès J{s.first_day})" if s.first_day else "")
    if s.key in ("front_loaded", "front_70", "front_100"):
        fr = s.initial_fraction if s.initial_fraction is not None else (1.0 if s.key == "front_100" else 0.7)
        mi = s.maintenance_interval if s.maintenance_interval is not None else (0 if s.key == "front_100" else 7)
        return f"{round(fr * 100)} % initial" + (f" + maint. {mi} j" if fr < 1 and mi else "")
    return STRATEGY_META.get(s.key, {}).get("label", s.key)


def config_hash(cfg: ExperimentConfig) -> str:
    return hashlib.sha256(json.dumps(cfg.model_dump(), sort_keys=True).encode()).hexdigest()[:16]


def validate_config(cfg: ExperimentConfig) -> dict:
    """Vérifie unités, bornes, compatibilités. Ne corrige jamais silencieusement."""
    errors, warnings = [], []
    for c in cfg.crops:
        if c not in CROPS:
            errors.append(f"Culture inconnue du moteur : « {c} ».")
    if cfg.remating not in REMATING_MODES:
        errors.append(f"Régime de réaccouplement inconnu : « {cfg.remating} ».")
    if not 1 <= cfg.replicates <= 30:
        errors.append("Le nombre de répétitions doit être compris entre 1 et 30.")
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
                scenarios.append({"crop": crop, "strategy": strategy_label(s), "strategy_key": s.key, "release_days": n_days,
                                  "total_released": sum(sched.values()), "season_length": L,
                                  "schedule": {str(k): v for k, v in sched.items() if v}})
    if "cherry" in cfg.crops and any(s.key == "every_7" for s in cfg.strategies):
        warnings.append("Cerise : la saison dure 25 jours ; J+7 ne donne que 4 lâchers (J0, J7, J14, J21).")

    n_scen = len(cfg.crops) * (len(cfg.strategies) + (1 if cfg.include_control and not any(s.key == "no_tis" for s in cfg.strategies) else 0))
    seasons = n_scen * cfg.replicates
    pop = (cfg.invasion.wild + cfg.invasion.females) / 600
    per = sum(0.6 if c == "strawberry" else 0.5 for c in cfg.crops) / max(1, len(cfg.crops))
    workers = 8
    est = seasons * per * max(0.5, pop) / min(workers, max(1, seasons)) + 1.0
    return {"ok": not errors, "errors": errors, "warnings": warnings, "scenarios": scenarios,
            "estimate": {"seasons": seasons, "seconds": round(est, 1),
                         "basis": "≈0,5 s par saison et par cœur à invasion Moyenne (mesure locale), 8 processus"}}
