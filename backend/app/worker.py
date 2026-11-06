"""Fonction exécutée dans les processus de calcul (importable par `spawn`)."""
from tis_engine.runner import Cancelled, run_season


def run_task(job_id, scen_key, rep, task, live, q, cancel):
    def on_day(day, row):
        if cancel.get(job_id):
            raise Cancelled()
        if live:
            q.put(("day", job_id, scen_key, rep, day, row))

    res = run_season(task, on_day)
    q.put(("season", job_id, scen_key, rep, None, None))
    return res
