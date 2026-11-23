"""Fonction exécutée dans les processus de calcul (importable par `spawn`).

La file du flux en direct et le registre d'annulation sont transmis une seule fois, à la
création du processus (`init`), au lieu d'être sérialisés avec chaque saison.
"""
from tis_engine.runner import Cancelled, run_season

# Une saison vérifie l'annulation tous les CANCEL_EVERY jours : chaque lecture du registre
# partagé est un aller-retour inter-processus (~1 ms). Le vérifier chaque jour coûtait près
# de 50 % du temps de calcul d'une saison de fraise (100 jours).
CANCEL_EVERY = 10

_queue = None
_cancel = None


def init(queue, cancel):
    global _queue, _cancel
    _queue, _cancel = queue, cancel


def run_task(job_id, scen_key, rep, task, live):
    if _cancel.get(job_id):          # saison en attente d'une expérience déjà annulée : ne pas la calculer
        raise Cancelled()

    def on_day(day, row):
        if day % CANCEL_EVERY == 0 and _cancel.get(job_id):
            raise Cancelled()
        if live:
            _queue.put(("day", job_id, scen_key, rep, day, row))

    res = run_season(task, on_day)
    _queue.put(("season", job_id, scen_key, rep, None, None))
    return res
