"""Registre documenté des paramètres exposés à l'application.

Chaque entrée renvoie à l'endroit du notebook où la valeur est définie. Les plages admises
sont des bornes de validité *techniques* (le modèle reste défini), pas des plages
biologiquement validées : le notebook ne fournit pas de plage d'incertitude.
"""
from __future__ import annotations

from .model import CHERRY, ECHELLE, ENGINE_VERSION, STRAWBERRY

PARAMS_VERSION = "nb-2025.10-echelle30"
SCHEMA_VERSION = 1

INVASION_PRESETS = {
    "faible": {"label": f"Faible ({3 * ECHELLE} W : {3 * ECHELLE} F)", "wild": 3 * ECHELLE, "females": 3 * ECHELLE},
    "moyenne": {"label": f"Moyenne ({10 * ECHELLE} W : {10 * ECHELLE} F)", "wild": 10 * ECHELLE, "females": 10 * ECHELLE},
    "forte": {"label": f"Forte ({30 * ECHELLE} W : {30 * ECHELLE} F)", "wild": 30 * ECHELLE, "females": 30 * ECHELLE},
}

BUDGET_PRESETS = [b * ECHELLE for b in (0, 150, 300, 600)]  # cellule 6 : BUDGETS

STRATEGY_META = {
    "no_tis":    {"label": "Témoin (sans TIS)", "short": "Témoin", "nb": "No TIS",
                  "description": "Aucun lâcher de mâles stériles. Scénario de référence."},
    "daily":     {"label": "Quotidien", "short": "Quotidien", "nb": "Daily",
                  "description": "Budget réparti uniformément sur chaque jour de la saison (continuous_schedule)."},
    "every_3":   {"label": "J+3", "short": "J+3", "nb": "Every 3 days",
                  "description": "Un lâcher tous les 3 jours à partir de J0 (periodic_schedule, interval=3)."},
    "every_7":   {"label": "J+7", "short": "J+7", "nb": "Every 7 days",
                  "description": "Un lâcher tous les 7 jours à partir de J0 (periodic_schedule, interval=7)."},
    "front_70":  {"label": "70 % initial + maintenance", "short": "70 % + maint.", "nb": "70% init + 7d maint",
                  "description": "70 % du budget à J0, le reste réparti tous les 7 jours (front_loaded_schedule)."},
    "front_100": {"label": "100 % initial", "short": "100 % initial", "nb": "100% init",
                  "description": "Tout le budget lâché à J0 (front_loaded_schedule, initial_fraction=1)."},
}

REMATING_META = {
    "preference": {"label": "Préférence (polyandrie)", "description": "P(sperme fertile) = F / (F + η_s·S). Régime principal du notebook."},
    "first": {"label": "Premier accouplement (monandrie)", "description": "La femelle utilise le sperme de son premier accouplement."},
    "last": {"label": "Dernier accouplement", "description": "La femelle utilise le sperme de son dernier accouplement (non utilisé dans le plan du notebook)."},
    "mixed": {"label": "Mélange proportionnel", "description": "P(sperme fertile) = F / (F + S) (non utilisé dans le plan du notebook)."},
}

CROP_META = {
    "strawberry": {
        "label": "Fraise", "latin": "Fragaria × ananassa",
        "summary": "Production continue : 900 fruits/jour pendant 100 jours, récolte et prophylaxie tous les 3 jours.",
        "params": STRAWBERRY.to_dict(),
    },
    "cherry": {
        "label": "Cerise", "latin": "Prunus avium",
        "summary": "Stock fermé : 90 000 fruits présents à J0, saison de 25 jours, récolte unique à J24.",
        "params": CHERRY.to_dict(),
    },
}

# name -> (symbole LaTeX, unité, défaut, min, max, pas, source, description, avancé ?)
BIOLOGY_PARAMS = {
    "eta": ("\\eta", "sans dimension", 0.8, 0.0, 2.0, 0.01, "Cellule 3 — Females_Agent.eta",
            "Compétitivité d'accouplement des mâles stériles relativement aux sauvages. P(accouplement fertile) = W / (W + η·S).", False),
    "eta_sperm_choice": ("\\eta_s", "sans dimension", 0.59, 0.0, 2.0, 0.01, "Cellule 3 — Females_Agent.eta_sperm_choice",
                         "Poids du sperme stérile dans le choix de la femelle (régime « preference »).", True),
    "lifespan_sterile": ("\\bar{T}_S", "jours", 7.0, 1.0, 60.0, 0.5, "Cellule 3 — LIFESPAN_MEANS['sterile']",
                         "Durée de vie moyenne des mâles stériles (loi normale tronquée à 1 j).", False),
    "lifespan_wild": ("\\bar{T}_W", "jours", 25.0, 1.0, 120.0, 0.5, "Cellule 3 — LIFESPAN_MEANS['wild']",
                      "Durée de vie moyenne des mâles sauvages.", True),
    "lifespan_female": ("\\bar{T}_F", "jours", 25.0, 1.0, 120.0, 0.5, "Cellule 3 — LIFESPAN_MEANS['female']",
                        "Durée de vie moyenne des femelles.", True),
    "lifespan_cv": ("CV_T", "sans dimension", 0.30, 0.0, 1.0, 0.01, "Cellule 3 — LIFESPAN_CV",
                    "Coefficient de variation des durées de vie (commun aux trois groupes).", True),
    "fruit_capacity": ("K", "pontes / fruit", 20, 1, 200, 1, "Cellule 4 — RematingModel(fruit_capacity)",
                       "Nombre maximal de pontes (fertiles ou stériles) par fruit.", True),
    "young_puncture_probability": ("p_y", "probabilité", 0.30, 0.0, 1.0, 0.01, "Cellule 4 — young_puncture_probability",
                                   "Probabilité qu'une ponte tentée sur un fruit jeune réussisse.", True),
    "rotten_puncture_probability": ("p_r", "probabilité", 0.10, 0.0, 1.0, 0.01, "Cellule 5 — rotten_puncture_probability=0.10",
                                    "Probabilité qu'une ponte tentée sur un fruit pourri réussisse.", True),
    "rotten_threshold": ("\\theta", "score", 5.0, 0.5, 100.0, 0.5, "Cellule 4 — rotten_threshold",
                         "Seuil du score larvaire S(t) au-delà duquel le fruit pourrit.", True),
    "larva_age_weight": ("w", "jour⁻¹", 0.5, 0.0, 5.0, 0.05, "Cellule 4 — larva_age_weight",
                         "Poids de l'âge des larves dans le score S(t).", True),
    "rot_hazard_sterile": ("h_s", "jour⁻¹", 0.2310, 0.0, 5.0, 0.001, "Cellule 4 — rot_hazard_sterile",
                           "Taux de pourrissement journalier d'un fruit piqué uniquement par des pontes stériles.", True),
    "rot_hazard_fertile": ("h_f", "jour⁻¹", 0.3054, 0.0, 5.0, 0.001, "Cellule 4 — rot_hazard_fertile",
                           "Taux de pourrissement journalier d'un fruit portant au moins une ponte fertile.", True),
    "harvest_fraction": ("\\phi_h", "fraction", 0.90, 0.0, 1.0, 0.01, "Cellule 4 — harvest_fraction",
                         "Part des fruits récoltables cueillis à chaque récolte.", True),
    "prophylaxis_fraction": ("\\phi_p", "fraction", 0.60, 0.0, 1.0, 0.01, "Cellule 4 — prophylaxis_fraction",
                             "Part des fruits pourris retirés à chaque passage de prophylaxie (fraise).", True),
}

FIXED_CONSTANTS = [
    {"name": "Ponte journalière", "symbol": "\\lambda", "value": "Poisson(6), plafonnée à 6", "unit": "œufs / femelle / jour", "source": "Cellule 3 — Females_Agent.egglaying"},
    {"name": "Période réfractaire après accouplement fertile", "symbol": "R_f", "value": "U{3…12}", "unit": "jours", "source": "Cellule 3 — RF_fertilized"},
    {"name": "Période réfractaire après accouplement stérile", "symbol": "R_s", "value": "U{4…10}", "unit": "jours", "source": "Cellule 3 — RF_sterilized"},
    {"name": "Développement larvaire (émergence)", "symbol": "D", "value": "U{6…11}", "unit": "jours", "source": "Cellule 3 — Larvae_Agent"},
    {"name": "Mortalité larvaire J+1 / J+2 / J+3", "symbol": "\\mu_{1,2,3}", "value": "0,132 / 0,087 / 0,048", "unit": "probabilité séquentielle", "source": "Cellule 3 — Larvae_Agent.mortality"},
    {"name": "Mortalité larvaire J+4–5 / J+7–11", "symbol": "\\mu_{4,5}", "value": "0,100 / 0,056", "unit": "probabilité séquentielle", "source": "Cellule 3 — Larvae_Agent.mortality"},
    {"name": "Sex-ratio à l'émergence", "symbol": "r", "value": "0,5", "unit": "fraction de mâles", "source": "Cellule 3 — Larvae_Agent.sex_ratio"},
    {"name": "Échelle", "symbol": "E", "value": str(ECHELLE), "unit": "facteur multiplicatif", "source": "Cellule 2 — ECHELLE"},
]


def biology_defaults() -> dict:
    return {k: v[2] for k, v in BIOLOGY_PARAMS.items()}


def registry() -> dict:
    return {
        "engine_version": ENGINE_VERSION,
        "params_version": PARAMS_VERSION,
        "schema_version": SCHEMA_VERSION,
        "crops": CROP_META,
        "strategies": STRATEGY_META,
        "remating": REMATING_META,
        "invasions": INVASION_PRESETS,
        "budget_presets": BUDGET_PRESETS,
        "biology": [
            {"name": k, "symbol": v[0], "unit": v[1], "default": v[2], "min": v[3], "max": v[4], "step": v[5],
             "source": v[6], "description": v[7], "advanced": v[8]}
            for k, v in BIOLOGY_PARAMS.items()
        ],
        "fixed_constants": FIXED_CONSTANTS,
        "limits": {"replicates": [1, 30], "budget": [0, 1_000_000], "wild": [0, 100_000], "females": [0, 100_000]},
    }
