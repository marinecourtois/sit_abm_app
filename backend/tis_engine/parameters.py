"""Registre documenté des paramètres exposés à l'application.

Chaque entrée renvoie à l'endroit du notebook où la valeur est définie. Les plages admises
sont des bornes de validité *techniques* (le modèle reste défini), pas des plages
biologiquement validées : le notebook ne fournit pas de plage d'incertitude.
"""
from __future__ import annotations

from .runner import STRATEGY_PRESETS
from .model import (CHERRY, ECHELLE, EGGS_MAX_PER_DAY, EGGS_POISSON_MEAN, ENGINE_VERSION, FRUITS_PER_CLUTCH_MAX,
                    LARVAL_EMERGENCE, LARVAL_MORTALITY, RF_FERTILE, RF_STERILE, SEX_RATIO, STRAWBERRY)

# Répétitions par scénario : minimum de l'étude (exigence de robustesse statistique) et plafond technique
MIN_REPLICATES = 10
MAX_REPLICATES = 50
# Valeur proposée par défaut dans le Studio (1.8.0) ; le minimum accepté reste MIN_REPLICATES
DEFAULT_REPLICATES = 20

PARAMS_VERSION = "nb-2025.10-echelle30-ext1"   # ext1 (1.9.0) : + 5 paramètres d'extension, désactivés ; valeurs du notebook inchangées
SCHEMA_VERSION = 2   # 2 (1.9.0) : plans, extensions, champs par scénario, nouvelles séries et métriques

INVASION_PRESETS = {
    "faible": {"label": f"Faible ({3 * ECHELLE} W : {3 * ECHELLE} F)", "wild": 3 * ECHELLE, "females": 3 * ECHELLE},
    "moyenne": {"label": f"Moyenne ({10 * ECHELLE} W : {10 * ECHELLE} F)", "wild": 10 * ECHELLE, "females": 10 * ECHELLE},
    "forte": {"label": f"Forte ({30 * ECHELLE} W : {30 * ECHELLE} F)", "wild": 30 * ECHELLE, "females": 30 * ECHELLE},
}

BUDGET_PRESETS = [b * ECHELLE for b in (0, 150, 300, 600)]  # cellule 6 : BUDGETS

def _strategy_description(key):
    """Description générée depuis STRATEGY_PRESETS (aucun chiffre recopié à la main)."""
    p = STRATEGY_PRESETS[key]
    if p["kind"] == "none":
        return "Aucun lâcher de mâles stériles. Scénario de référence."
    if p["kind"] == "continuous":
        return "Budget réparti uniformément sur chaque jour de la saison (continuous_schedule)."
    if p["kind"] == "periodic":
        return f"Un lâcher tous les {p['interval']} jours à partir de J{p['first_day']} (periodic_schedule, interval={p['interval']})."
    f, m = p["initial_fraction"], p["maintenance_interval"]
    if f >= 1:
        return "Tout le budget lâché à J0 (front_loaded_schedule, initial_fraction=1)."
    return (f"{round(f * 100)} % du budget à J0, le reste réparti tous les {m} jours à partir de J{m} "
            f"(front_loaded_schedule, initial_fraction={f}).")


_NAMES = {  # noms des stratégies : notebook (nb) et traduction affichée
    "no_tis": ("Témoin (sans TIS)", "Témoin", "No TIS"),
    "daily": ("Quotidien", "Quotidien", "Daily"),
    "every_3": ("J+3", "J+3", "Every 3 days"),
    "every_7": ("J+7", "J+7", "Every 7 days"),
    "front_70": ("70 % initial + maintenance", "70 % + maint.", "70% init + 7d maint"),
    "front_100": ("100 % initial", "100 % initial", "100% init"),
}
STRATEGY_META = {k: {"label": l, "short": sh, "nb": nb, "description": _strategy_description(k),
                     "params": {kk: vv for kk, vv in STRATEGY_PRESETS[k].items() if kk != "kind"}}
                 for k, (l, sh, nb) in _NAMES.items()}

# Régimes d'utilisation du sperme — Females_Agent.use_fertile_sperm (cellule 3).
# Dans tous les régimes la femelle se réaccouple (périodes réfractaires) ; seul l'usage du sperme change.
REMATING_META = {
    "preference": {"label": "Polyandrie avec préférence", "short": "Polyandrie", "notebook": "preference",
                   "formula": "P(\\text{œuf fertile}) = \\dfrac{n_f}{n_f + \\eta_s\\, n_s}",
                   "description": "Chaque accouplement compte : un œuf est fécondé par du sperme fertile avec une probabilité "
                                  "qui dépend des nombres d'accouplements fertiles (n_f) et stériles (n_s), le sperme stérile "
                                  "étant pondéré par η_s. Régime principal du notebook."},
    "first": {"label": "Monandrie (priorité au premier mâle)", "short": "Monandrie", "notebook": "first",
              "formula": "\\text{œuf fertile} \\iff \\text{1}^{\\text{er}}\\text{ mâle sauvage}",
              "description": "Seul le premier accouplement détermine la descendance : une femelle d'abord accouplée à un mâle "
                             "stérile reste stérile, même si elle se réaccouple ensuite avec un sauvage."},
    "last": {"label": "Priorité au dernier mâle", "short": "Dernier mâle", "notebook": "last",
             "formula": "\\text{œuf fertile} \\iff \\text{dernier mâle sauvage}",
             "description": "Seul le dernier accouplement compte. Non utilisé dans le plan du notebook."},
    "mixed": {"label": "Polyandrie, mélange proportionnel", "short": "Mélange", "notebook": "mixed",
              "formula": "P(\\text{œuf fertile}) = \\dfrac{n_f}{n_f + n_s}",
              "description": "Sperme fertile et stérile utilisés en proportion des accouplements, sans préférence. "
                             "Non utilisé dans le plan du notebook."},
}

def _fr(x):
    return f"{x:,}".replace(",", "\u202f")


def _crop_summary(c):
    """Résumé généré à partir des CropParameters (aucun texte écrit à la main)."""
    if c.initial_fruits and not c.daily_fruit_production:
        txt = f"Stock fermé : {_fr(c.initial_fruits)} fruits présents à J0, saison de {c.season_length} jours"
    else:
        txt = f"Production continue : {_fr(c.daily_fruit_production)} fruits/jour pendant {c.season_length} jours"
    if c.harvest_frequency:
        txt += f", récolte tous les {c.harvest_frequency} jours"
    if c.final_harvest:
        txt += f", récolte unique à J{c.season_length - 1}"
    if c.prophylaxis_frequency:
        txt += f", prophylaxie tous les {c.prophylaxis_frequency} jours"
    return txt + "."


CROP_META = {
    "strawberry": {"label": "Fraise", "latin": "Fragaria × ananassa", "summary": _crop_summary(STRAWBERRY), "params": STRAWBERRY.to_dict()},
    "cherry": {"label": "Cerise", "latin": "Prunus avium", "summary": _crop_summary(CHERRY), "params": CHERRY.to_dict()},
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
    # Extensions HORS NOTEBOOK (1.9.0, proposées par Marine Courtois). Valeur par défaut = désactivée :
    # le moteur reproduit alors le notebook au bit près.
    "immigration_wild_males": ("m_W", "mâles / jour", 0, 0, 1000, 1, "Extension hors notebook (EXT 1, 1.9.0)",
                               "Mâles sauvages qui entrent dans la parcelle chaque jour à partir de J1. 0 = parcelle fermée, comme le notebook. "
                               "Proposition de Marine : 15 / jour en fraise, 8 / jour en cerise.", True),
    "immigration_females": ("m_F", "femelles / jour", 0, 0, 1000, 1, "Extension hors notebook (EXT 1, 1.9.0)",
                            "Femelles déjà fécondées au champ qui entrent dans la parcelle chaque jour à partir de J1. 0 = parcelle fermée (notebook).", True),
    "carrying_capacity": ("K_a", "adultes sauvages", 0, 0, 100000, 100, "Extension hors notebook (EXT 2, 1.9.0)",
                          "Capacité de charge : quand les adultes sauvages (W + F) atteignent K_a, une larve qui émerge meurt au lieu "
                          "de devenir adulte. 0 = aucune limite (notebook). Proposition de Marine : 3 000.", True),
    "turning_days": ("d_t", "jours", 0, 0, 30, 1, "Extension hors notebook (EXT 3, 1.9.0)",
                     "Stade « tournant » : les d_t derniers jours de la phase jeune d'un fruit (jeune aux âges 0 … M), une ponte réussit avec la probabilité p_t "
                     "au lieu de p_y. 0 = deux stades, jeune et mûr (notebook). Maturité tirée en 2–4 j (fraise) et 10–15 j (cerise).", True),
    "turning_puncture_probability": ("p_t", "probabilité", 0.30, 0.0, 1.0, 0.01, "Extension hors notebook (EXT 3, 1.9.0)",
                                     "Réussite d'une ponte sur un fruit « tournant » ; n'agit que si d_t > 0. Proposition de Marine : 0,30 "
                                     "(avec p_y = 0 pour les fruits verts).", True),
}
# Clés des extensions hors notebook et leur valeur « désactivée »
EXTENSION_PARAMS = ("immigration_wild_males", "immigration_females", "carrying_capacity", "turning_days", "turning_puncture_probability")

def _dec(x):
    return str(x).replace(".", ",")


def _rng(a, b):
    return f"U{{{a}…{b}}}"


# Constantes fixes : lues dans model.py (source unique), jamais recopiées à la main.
MODEL_CONSTANTS = {
    "eggs_poisson_mean": EGGS_POISSON_MEAN, "eggs_max_per_day": EGGS_MAX_PER_DAY,
    "fruits_per_clutch_max": FRUITS_PER_CLUTCH_MAX,
    "refractory_fertile": [RF_FERTILE[0], RF_FERTILE[1] - 1],
    "refractory_sterile": [RF_STERILE[0], RF_STERILE[1] - 1],
    "larval_emergence": list(LARVAL_EMERGENCE),
    "larval_mortality": [{"p": p, "days": list(d)} for p, d in LARVAL_MORTALITY],
    "sex_ratio": SEX_RATIO, "scale": ECHELLE,
}
FIXED_CONSTANTS = [
    {"name": "Ponte journalière", "symbol": "\\lambda", "value": f"Poisson({EGGS_POISSON_MEAN}), plafonnée à {EGGS_MAX_PER_DAY}",
     "unit": "œufs / femelle / jour", "source": "model.py — EGGS_POISSON_MEAN, EGGS_MAX_PER_DAY (cellule 3)"},
    {"name": "Fruits visés par ponte", "symbol": "n_{fr}", "value": _rng(1, FRUITS_PER_CLUTCH_MAX),
     "unit": "fruits", "source": "model.py — FRUITS_PER_CLUTCH_MAX (cellule 3)"},
    {"name": "Période réfractaire après accouplement fertile", "symbol": "R_f", "value": _rng(RF_FERTILE[0], RF_FERTILE[1] - 1),
     "unit": "jours", "source": "model.py — RF_FERTILE (cellule 3)"},
    {"name": "Période réfractaire après accouplement stérile", "symbol": "R_s", "value": _rng(RF_STERILE[0], RF_STERILE[1] - 1),
     "unit": "jours", "source": "model.py — RF_STERILE (cellule 3)"},
    {"name": "Développement larvaire (émergence)", "symbol": "D", "value": _rng(*LARVAL_EMERGENCE),
     "unit": "jours", "source": "model.py — LARVAL_EMERGENCE (cellule 3)"},
    {"name": "Mortalité larvaire séquentielle", "symbol": "\\mu",
     "value": " ; ".join(f"{_dec(p)} → J+{a}" + (f"…{b}" if b != a else "") for p, (a, b) in LARVAL_MORTALITY),
     "unit": "probabilité → jour de mort", "source": "model.py — LARVAL_MORTALITY (cellule 3)"},
    {"name": "Sex-ratio à l'émergence", "symbol": "r", "value": _dec(SEX_RATIO), "unit": "fraction de mâles",
     "source": "model.py — SEX_RATIO (cellule 3)"},
    {"name": "Échelle", "symbol": "E", "value": str(ECHELLE), "unit": "facteur multiplicatif", "source": "model.py — ECHELLE (cellule 2)"},
]


# Libellés courts et regroupement thématique des paramètres (affichage du Studio et du Protocole)
PARAM_GROUPS = [
    ("accouplement", "Accouplement"),
    ("durees", "Durées de vie des adultes"),
    ("ponte", "Ponte dans les fruits"),
    ("pourrissement", "Pourrissement des fruits"),
    ("recolte", "Récolte et prophylaxie"),
    ("extensions", "Extensions hors notebook (désactivées par défaut)"),
]
PARAM_UI = {
    "eta": ("Compétitivité des mâles stériles", "accouplement"),
    "eta_sperm_choice": ("Poids du sperme stérile", "accouplement"),
    "lifespan_sterile": ("Mâles stériles", "durees"),
    "lifespan_wild": ("Mâles sauvages", "durees"),
    "lifespan_female": ("Femelles", "durees"),
    "lifespan_cv": ("Variabilité (coefficient de variation)", "durees"),
    "fruit_capacity": ("Pontes maximales par fruit", "ponte"),
    "young_puncture_probability": ("Réussite d'une ponte sur fruit jeune", "ponte"),
    "rotten_puncture_probability": ("Réussite d'une ponte sur fruit pourri", "ponte"),
    "rotten_threshold": ("Seuil de charge larvaire", "pourrissement"),
    "larva_age_weight": ("Poids de l'âge des larves", "pourrissement"),
    "rot_hazard_sterile": ("Taux après piqûres stériles", "pourrissement"),
    "rot_hazard_fertile": ("Taux après ponte fertile", "pourrissement"),
    "harvest_fraction": ("Part des fruits mûrs récoltés", "recolte"),
    "prophylaxis_fraction": ("Part des fruits pourris retirés", "recolte"),
    "immigration_wild_males": ("Immigration de mâles sauvages", "extensions"),
    "immigration_females": ("Immigration de femelles fécondées", "extensions"),
    "carrying_capacity": ("Capacité de charge des adultes sauvages", "extensions"),
    "turning_days": ("Durée du stade « tournant »", "extensions"),
    "turning_puncture_probability": ("Réussite d'une ponte sur fruit tournant", "extensions"),
}


def active_extensions(bio: dict) -> list[str]:
    """Extensions hors notebook actives dans un jeu de paramètres biologiques."""
    on = []
    if bio.get("immigration_wild_males", 0) or bio.get("immigration_females", 0):
        on.append("immigration")
    if bio.get("carrying_capacity", 0):
        on.append("carrying_capacity")
    if bio.get("turning_days", 0):
        on.append("turning")
    return on


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
            {"name": k, "label": PARAM_UI[k][0], "group": PARAM_UI[k][1], "symbol": v[0], "unit": v[1], "default": v[2],
             "min": v[3], "max": v[4], "step": v[5], "source": v[6], "description": v[7], "advanced": v[8],
             "extension": k in EXTENSION_PARAMS}
            for k, v in BIOLOGY_PARAMS.items()
        ],
        "biology_groups": [{"key": k, "label": l} for k, l in PARAM_GROUPS],
        "fixed_constants": FIXED_CONSTANTS,
        "model_constants": MODEL_CONSTANTS,
        "default_replicates": DEFAULT_REPLICATES,
        "limits": {"replicates": [MIN_REPLICATES, MAX_REPLICATES], "budget": [0, 1_000_000], "wild": [0, 100_000], "females": [0, 100_000]},
    }
