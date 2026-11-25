"""Calibration de l'inoculum « fort » (application 1.10.0, demande de Marine Courtois).

L'inoculum fort d'une culture est la population d'adultes sauvages (W + F) qu'atteint le témoin
sans lâcher, en moyenne sur 20 répétitions, partie de l'inoculum modéré (300 W + 300 F), au pic de
la saison. Dans ce modèle la population sans lâcher croît jusqu'au dernier jour : le pic est la
population en fin de saison (J100 fraise, J25 cerise). Régime « preference », paramètres
biologiques du notebook, graines 42 + 1000·r. Les effectifs sont répartis à parts égales entre
mâles et femelles (une femelle de plus si le total est impair).

Les valeurs sont figées dans parameters.FORT_BY_CROP ; tests/test_regression.py vérifie qu'elles
sont exactement celles que calcule cette fonction.
"""
from __future__ import annotations

from .model import CROPS
from .runner import run_season

FORT_FROM = {"wild": 300, "females": 300}
FORT_REPLICATES = 20


def control_peak(crop: str, reps: int = FORT_REPLICATES) -> tuple[float, int]:
    """Pic de la moyenne (sur les répétitions) des adultes sauvages W + F du témoin, et son jour."""
    from .parameters import biology_defaults
    series = []
    for r in range(reps):
        s = run_season({"crop": crop, "wild": FORT_FROM["wild"], "females": FORT_FROM["females"], "remating": "preference",
                        "seed": 42 + 1000 * r, "schedule": {}, "biology": biology_defaults()})["series"]
        series.append([w + f for w, f in zip(s["Wild_males"], s["Females"])])
    mean = [sum(x[i] for x in series) / reps for i in range(len(series[0]))]
    peak = max(mean)
    return peak, mean.index(peak)


def fort_inoculum(crop: str, reps: int = FORT_REPLICATES) -> dict:
    total = round(control_peak(crop, reps)[0])
    return {"wild": total // 2, "females": total - total // 2}


if __name__ == "__main__":
    for c in CROPS:
        pk, day = control_peak(c)
        print(c, fort_inoculum(c), f"pic {pk:.2f} à J{day}")
