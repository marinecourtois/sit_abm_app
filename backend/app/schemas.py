"""Contrats de données de l'API (configuration d'expérience) et validation scientifique."""
from __future__ import annotations

import hashlib
import json
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from tis_engine.model import CROPS
from tis_engine.parameters import (MAX_REPLICATES, MIN_REPLICATES, BIOLOGY_PARAMS, EXTENSION_PARAMS, INVASION_PRESETS, STRATEGY_META,
                                   active_extensions, biology_defaults)
from tis_engine.runner import REMATING_MODES, STRATEGY_PRESETS, build_schedule


class StrategySpec(BaseModel):
    key: Literal["no_tis", "daily", "every_3", "every_7", "front_70", "front_100", "periodic", "front_loaded"]
    interval: Optional[int] = None
    first_day: Optional[int] = None
    initial_fraction: Optional[float] = None
    maintenance_interval: Optional[int] = None
    label: Optional[str] = None


class Counts(BaseModel):
    wild: int
    females: int


class Arrivals(BaseModel):
    """Immigration d'une culture (1.11.0) : ``wild`` mâles sauvages et ``females`` femelles
    fécondées qui arrivent tous les ``every`` jours, à partir de J1."""
    wild: int
    females: int
    every: int = 1


class Invasion(BaseModel):
    """Inoculum de départ (« invasion » dans le notebook et l'API). ``by_crop`` (1.10.0) : effectifs
    propres à chaque culture (inoculum fort = pic du témoin) ; ``wild``/``females`` sinon."""
    preset: Optional[str] = None
    wild: int
    females: int
    by_crop: Optional[dict[str, Counts]] = None


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
    # Plan (1.7.0) : plusieurs budgets, invasions ou régimes croisés dans la même expérience, avec
    # les mêmes graines (nombres aléatoires communs). None : la valeur unique ci-dessus.
    budgets: Optional[list[int]] = None
    invasions: Optional[list[Invasion]] = None
    rematings: Optional[list[str]] = None
    # Immigration quotidienne par culture (1.10.0, extension hors notebook) : None = désactivée.
    immigration: Optional[dict[str, Arrivals]] = None
    # 1.11.0 : croiser « avec » et « sans » immigration dans la même expérience (mêmes graines)
    immigration_compare: bool = False

    @model_validator(mode="after")
    def _immigration_of_selected_crops(self):
        # Immigration : seules les cultures sélectionnées avec un apport non nul comptent ; vide = None
        if self.immigration is not None:
            kept = {c: v for c, v in self.immigration.items() if (c in self.crops or c not in CROPS) and (v.wild or v.females)}
            self.immigration = kept or None
        return self

    @field_validator("biology")
    @classmethod
    def _extensions_off_when_absent(cls, bio: dict) -> dict:
        # Configurations d'avant la 1.9.0 : les extensions hors notebook absentes sont désactivées
        defaults = biology_defaults()
        return {**{k: defaults[k] for k in EXTENSION_PARAMS if k not in bio}, **bio}


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


PLAN_FIELDS = ("budgets", "invasions", "rematings")
# Paramètres biologiques entiers (le moteur les utilise via int())
INTEGER_PARAMS = ("fruit_capacity", "immigration_wild_males", "immigration_females", "carrying_capacity", "turning_days")
MAX_SEASONS = 10_000


def config_hash(cfg: ExperimentConfig) -> str:
    d = cfg.model_dump()
    # Plan normalisé : une liste vide ou à une valeur équivaut à la valeur unique ; une liste à
    # plusieurs valeurs rend la valeur unique sans effet. Sans plan : même empreinte qu'avant la 1.7.0.
    for lst, one in (("budgets", "budget"), ("invasions", "invasion"), ("rematings", "remating")):
        v = d[lst]
        if v is not None and len(v) <= 1:
            if v:
                d[one] = v[0]
            v = None
        if v is None:
            del d[lst]
        else:
            del d[one]
    for inv in [d.get("invasion"), *(d.get("invasions") or [])]:   # champs 1.10.0 absents : même empreinte
        if inv is not None and inv.get("by_crop") is None:
            inv.pop("by_crop", None)
    if not d.get("immigration"):
        d.pop("immigration", None)
    else:   # « tous les jours » (every = 1) : même empreinte qu'en 1.10.0
        for v in d["immigration"].values():
            if v.get("every") == 1:
                v.pop("every")
    if not d.get("immigration_compare") or "immigration" not in d:
        d.pop("immigration_compare", None)
    defaults = biology_defaults()
    for k in EXTENSION_PARAMS:   # extensions désactivées : même empreinte qu'avant la 1.9.0
        if d["biology"].get(k) == defaults[k]:
            del d["biology"][k]
    if not d["biology"].get("turning_days"):   # p_t sans effet quand le stade tournant est désactivé
        d["biology"].pop("turning_puncture_probability", None)
    return hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest()[:16]


def plan_budgets(cfg: ExperimentConfig) -> list[int]:
    return list(cfg.budgets) if cfg.budgets else [cfg.budget]


def plan_invasions(cfg: ExperimentConfig) -> list[Invasion]:
    return list(cfg.invasions) if cfg.invasions else [cfg.invasion]


def immigration_on(cfg: ExperimentConfig) -> bool:
    return bool(cfg.immigration) and any(c.wild or c.females for c in cfg.immigration.values())


def plan_rematings(cfg: ExperimentConfig) -> list[str]:
    return list(cfg.rematings) if cfg.rematings else [cfg.remating]


def is_plan(cfg: ExperimentConfig) -> bool:
    return any(len(f(cfg)) > 1 for f in (plan_budgets, plan_invasions, plan_rematings))


def invasion_for(inv: Invasion, crop: str) -> tuple[int, int]:
    """Effectifs de l'inoculum de départ pour une culture."""
    if inv.by_crop and crop in inv.by_crop:
        c = inv.by_crop[crop]
        return c.wild, c.females
    return inv.wild, inv.females


def invasion_name(inv: Invasion) -> str:
    p = INVASION_PRESETS.get(inv.preset or "")
    if p:
        if (p["wild"], p["females"]) == (inv.wild, inv.females) and not inv.by_crop:
            return p["label"] if "by_crop" not in p else p["nb_label"].replace("Forte", "Fort")
        if "by_crop" in p and (inv.by_crop or any((v["wild"], v["females"]) == (inv.wild, inv.females) for v in p["by_crop"].values())):
            return p["label"]
    return f"Personnalisé ({inv.wild} W : {inv.females} F)"


def crop_label(crop: str) -> str:
    from tis_engine.parameters import CROP_META
    return CROP_META.get(crop, {}).get("label", crop)


def count_seasons(cfg: ExperimentConfig) -> int:
    treated = sum(1 for s in cfg.strategies if s.key != "no_tis")
    control = 1 if cfg.include_control or any(s.key == "no_tis" for s in cfg.strategies) else 0
    per_cell = control + treated * len(plan_budgets(cfg))   # le témoin (budget 0) est commun à tous les budgets
    modes = 2 if cfg.immigration_compare and immigration_on(cfg) else 1
    return len(cfg.crops) * len(plan_invasions(cfg)) * len(plan_rematings(cfg)) * modes * per_cell * cfg.replicates


def validate_config(cfg: ExperimentConfig, history: list[dict] | None = None) -> dict:
    """Vérifie unités, bornes, compatibilités. Ne corrige jamais silencieusement."""
    errors, warnings = [], []
    for c in cfg.crops:
        if c not in CROPS:
            errors.append(f"Culture inconnue du moteur : « {c} ».")
    for r in plan_rematings(cfg):
        if r not in REMATING_MODES:
            errors.append(f"Régime de réaccouplement inconnu : « {r} ».")
    if not MIN_REPLICATES <= cfg.replicates <= MAX_REPLICATES:
        errors.append(f"Le nombre de répétitions doit être compris entre {MIN_REPLICATES} et {MAX_REPLICATES} "
                      f"(minimum de l'étude : {MIN_REPLICATES} répétitions par scénario).")
    for b in plan_budgets(cfg):
        if b < 0 or b > 1_000_000:
            errors.append(f"Budget {b} : le budget (nombre total de mâles stériles lâchés) doit être compris entre 0 et 1 000 000.")
    for inv in plan_invasions(cfg):
        for crop in cfg.crops:
            w, f = invasion_for(inv, crop)
            if w < 0 or f < 0:
                errors.append("Les effectifs de l'inoculum de départ doivent être positifs.")
            if w + f > 200_000:
                errors.append("Inoculum de départ supérieur à 200 000 individus : non pris en charge.")
        if inv.by_crop and any(c not in CROPS for c in inv.by_crop):
            errors.append("Inoculum par culture : culture inconnue.")
        if inv.preset and inv.preset in INVASION_PRESETS:
            p = INVASION_PRESETS[inv.preset]
            expected = {c: (v["wild"], v["females"]) for c, v in p["by_crop"].items()} if "by_crop" in p and inv.by_crop else None
            same = (all(invasion_for(inv, c) == expected[c] for c in cfg.crops if c in expected) if expected
                    else (p["wild"], p["females"]) == (inv.wild, inv.females))
            if not same:
                warnings.append(f"Inoculum « {p['label']} » : les effectifs diffèrent du préréglage, ils seront utilisés tels quels.")
    if cfg.immigration is not None:
        for crop, c in cfg.immigration.items():
            if crop not in CROPS:
                errors.append(f"Immigration : culture inconnue « {crop} ».")
            elif not (0 <= c.wild <= 1000 and 0 <= c.females <= 1000):
                errors.append(f"Immigration ({crop_label(crop)}) : entre 0 et 1 000 individus par arrivée.")
            elif not 1 <= c.every <= CROPS[crop].season_length - 1:   # jours simulés 0 … L−1, arrivées aux jours X, 2X…
                errors.append(f"Immigration ({crop_label(crop)}) : une arrivée tous les 1 à {CROPS[crop].season_length - 1} jours.")
        if cfg.biology.get("immigration_wild_males", 0) or cfg.biology.get("immigration_females", 0):
            errors.append("Immigration définie deux fois (par culture et dans les paramètres biologiques) : n'en garder qu'une.")
    if cfg.immigration_compare:
        missing = [crop_label(c) for c in cfg.crops if not (cfg.immigration or {}).get(c)]
        if not immigration_on(cfg):
            errors.append("Comparaison avec / sans immigration : activez l'immigration et donnez au moins un apport non nul.")
        elif missing:
            errors.append("Comparaison avec / sans immigration : donnez un apport non nul pour " + ", ".join(missing) + ".")
    for name, values in (("budgets", plan_budgets(cfg)), ("régimes", plan_rematings(cfg)),
                         ("inoculums", [(i.wild, i.females, json.dumps(i.model_dump()["by_crop"], sort_keys=True)) for i in plan_invasions(cfg)])):
        if len(set(values)) != len(values):
            errors.append(f"Plan : {name} en double.")
    for crop in cfg.crops:   # inoculums distincts mais mêmes effectifs pour une culture (ex. Fort et un personnalisé identique)
        resolved = [invasion_for(i, crop) for i in plan_invasions(cfg)]
        if len(set(resolved)) != len(resolved) and len(set(json.dumps(i.model_dump(), sort_keys=True) for i in plan_invasions(cfg))) == len(resolved):
            errors.append(f"Plan : deux inoculums donnent les mêmes effectifs pour {crop_label(crop)} ; n'en garder qu'un.")
    if count_seasons(cfg) > MAX_SEASONS:
        errors.append(f"Plan de {count_seasons(cfg):,} saisons : au-delà de {MAX_SEASONS:,} saisons par expérience. ".replace(",", " ")
                      + "Réduisez le nombre de budgets, d'inoculums de départ, de régimes, de stratégies ou de répétitions.")
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
            elif k in INTEGER_PARAMS and v != int(v):
                errors.append(f"{k} = {v} : valeur entière attendue ({meta[1]}).")
            elif not meta[3] <= v <= meta[4]:
                errors.append(f"{k} = {v} hors de la plage admise [{meta[3]} ; {meta[4]}] ({meta[1]}).")
            elif v != meta[2] and k not in EXTENSION_PARAMS:
                warnings.append(f"{k} = {v} {meta[1]} (valeur du notebook : {meta[2]}).")
    ext = [e for e in active_extensions(cfg.biology) if e != "immigration"]
    if immigration_on(cfg) or "immigration" in active_extensions(cfg.biology):
        warnings.append("Immigration active : les résultats ne sont pas comparables au plan factoriel de référence, "
                        "calculé sans immigration.")
    if ext:
        names = {"carrying_capacity": "capacité de charge", "turning": "stade « tournant »"}
        warnings.append("Extension hors notebook active : " + ", ".join(names[e] for e in ext)
                        + ". Les résultats ne sont plus comparables au notebook ni au plan factoriel de référence.")
    td = cfg.biology.get("turning_days", 0)
    for c in cfg.crops:
        # un fruit est jeune aux âges 0 … M : d_t > M_max couvre toute la phase jeune
        if isinstance(td, (int, float)) and not isinstance(td, bool) and td and c in CROPS and td > CROPS[c].maturation_max:
            warnings.append(f"{crop_label(c)} : d_t = {td} j couvre toute la phase jeune (maturité en {CROPS[c].maturation_min}–"
                            f"{CROPS[c].maturation_max} j) ; tous les fruits jeunes sont « tournants ».")

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
                for budget in plan_budgets(cfg):
                    try:
                        sched = build_schedule(s.model_dump(exclude_none=True), budget, L)
                    except (ValueError, ZeroDivisionError) as e:
                        errors.append(f"{strategy_label(s)} : calendrier impossible ({e}).")
                        break
                    n_days = sum(1 for v in sched.values() if v > 0)
                    if s.key != "no_tis" and budget == 0:
                        warnings.append(f"{strategy_label(s)} : budget nul, aucun lâcher (équivaut au témoin).")
                    if s.key != "no_tis" and 0 < budget < len(sched):
                        warnings.append(f"{strategy_label(s)} ({crop}, {budget}) : budget inférieur au nombre de jours de lâcher, certains jours reçoivent 0 stérile.")
                    if s.key != "no_tis" and 0 < n_days <= 4:
                        days = ", ".join(f"J{d}" for d in sorted(int(k) for k, v in sched.items() if v))
                        warnings.append(f"{crop_label(crop)} · {strategy_label(s)} : seulement {n_days} lâcher{'s' if n_days > 1 else ''} "
                                        f"sur une saison de {L} jours ({days}).")
                    scenarios.append({"crop": crop, "strategy": strategy_label(s), "strategy_key": s.key, "budget": 0 if s.key == "no_tis" else budget,
                                      "release_days": n_days, "total_released": sum(sched.values()), "season_length": L,
                                      "schedule": {str(k): v for k, v in sched.items() if v}})
                    if s.key == "no_tis":
                        break

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
    warnings = list(dict.fromkeys(warnings))   # un avertissement par cause, pas un par budget
    return {"ok": not errors, "errors": errors, "warnings": warnings, "scenarios": scenarios,
            "estimate": estimate}
