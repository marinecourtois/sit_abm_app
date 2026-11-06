"""Exécution asynchrone des expériences : file, progression, annulation, journal, flux en direct."""
from __future__ import annotations

import multiprocessing as mp
import os
import threading
import time
import traceback
from concurrent.futures import ProcessPoolExecutor, wait, FIRST_COMPLETED

from tis_engine.model import CROPS
from tis_engine.runner import SERIES_VARS, Cancelled, aggregate, build_schedule

from . import store
from .schemas import ExperimentConfig, StrategySpec, strategy_id, strategy_label
from .worker import run_task

WORKERS = int(os.environ.get("TIS_WORKERS", min(8, os.cpu_count() or 1)))
_ctx = mp.get_context("spawn")
_pool: ProcessPoolExecutor | None = None
_manager = None
_queue = None
_cancel = None
STATE: dict[str, dict] = {}
_state_lock = threading.Lock()


def start():
    global _pool, _manager, _queue, _cancel
    _manager = _ctx.Manager()
    _queue = _manager.Queue()
    _cancel = _manager.dict()
    _pool = ProcessPoolExecutor(max_workers=WORKERS, mp_context=_ctx)
    threading.Thread(target=_listen, daemon=True).start()


def shutdown():
    if _pool:
        _pool.shutdown(cancel_futures=True)


def _log(st, msg):
    st["log"].append({"t": store.now(), "msg": msg})


def _listen():
    while True:
        try:
            kind, job, scen, rep, day, row = _queue.get()
        except (EOFError, OSError):
            return
        st = STATE.get(job)
        if not st:
            continue
        with _state_lock:
            if kind == "day":
                lv = st["live"].setdefault(scen, {"day": 0, "rows": []})
                lv["day"] = day
                lv["rows"].append(row)
            elif kind == "season":
                st["done"] += 1
                st["progress"] = st["done"] / st["total"]


def scenario_plan(cfg: ExperimentConfig):
    """Liste ordonnée des scénarios (culture × stratégie [+ témoin])."""
    strategies = list(cfg.strategies)
    if cfg.include_control and not any(s.key == "no_tis" for s in strategies):
        strategies = [StrategySpec(key="no_tis")] + strategies
    out = []
    for crop in cfg.crops:
        L = CROPS[crop].season_length
        for s in strategies:
            budget = 0 if s.key == "no_tis" else cfg.budget
            sched = build_schedule(s.model_dump(exclude_none=True), budget, L)
            out.append({"key": f"{crop}::{strategy_id(s)}", "crop": crop, "strategy": s.model_dump(exclude_none=True),
                        "strategy_key": s.key, "strategy_label": strategy_label(s), "is_control": s.key == "no_tis",
                        "budget": budget, "schedule": sched})
    return out


def replicate_seed(base: int, rep: int) -> int:
    # Nombres aléatoires communs : la répétition r utilise la même graine dans tous les scénarios
    return base + 1000 * rep


def submit(exp: dict):
    eid = exp["id"]
    cfg = ExperimentConfig(**exp["config"])
    plan = scenario_plan(cfg)
    total = len(plan) * cfg.replicates
    STATE[eid] = {"status": "queued", "done": 0, "total": total, "progress": 0.0, "live": {}, "log": [],
                  "plan": [{k: v for k, v in p.items() if k != "schedule"} for p in plan]}
    _log(STATE[eid], f"{len(plan)} scénarios × {cfg.replicates} répétitions = {total} saisons, {WORKERS} processus.")
    store.update(eid, status="queued", progress=0.0, error=None)
    threading.Thread(target=_run, args=(eid, cfg, plan), daemon=True).start()


def cancel(eid):
    _cancel[eid] = True
    st = STATE.get(eid)
    if st:
        _log(st, "Annulation demandée.")


def _run(eid, cfg: ExperimentConfig, plan):
    st = STATE[eid]
    t0 = time.time()
    store.update(eid, status="running", started_at=store.now())
    st["status"] = "running"
    _log(st, "Exécution démarrée.")
    futures = {}
    try:
        for p in plan:
            for rep in range(cfg.replicates):
                task = {"crop": p["crop"], "wild": cfg.invasion.wild, "females": cfg.invasion.females,
                        "remating": cfg.remating, "seed": replicate_seed(cfg.seed, rep),
                        "schedule": p["schedule"], "biology": cfg.biology}
                f = _pool.submit(run_task, eid, p["key"], rep, task, rep == 0, _queue, _cancel)
                futures[f] = (p["key"], rep)
        results: dict[str, dict[int, dict]] = {}
        pending = set(futures)
        while pending:
            done, pending = wait(pending, timeout=0.5, return_when=FIRST_COMPLETED)
            for f in done:
                key, rep = futures[f]
                results.setdefault(key, {})[rep] = f.result()
            if _cancel.get(eid):
                for f in pending:
                    f.cancel()
                raise Cancelled()
        doc = build_results(eid, cfg, plan, results)
        doc["duration_s"] = round(time.time() - t0, 2)
        store.save_results(eid, doc)
        store.update(eid, status="completed", progress=1.0, finished_at=store.now(), duration_s=doc["duration_s"])
        st["status"] = "completed"
        _log(st, f"Terminé en {doc['duration_s']} s.")
    except Cancelled:
        store.update(eid, status="cancelled", finished_at=store.now(), error="Annulée par l'utilisateur",
                     duration_s=round(time.time() - t0, 2))
        st["status"] = "cancelled"
        _log(st, "Simulation interrompue.")
    except Exception as e:  # noqa: BLE001
        store.update(eid, status="error", finished_at=store.now(), error=f"{type(e).__name__}: {e}",
                     duration_s=round(time.time() - t0, 2))
        st["status"] = "error"
        _log(st, "Erreur : " + "".join(traceback.format_exception_only(e)).strip())
    finally:
        _cancel.pop(eid, None)


def _paired_change(reps, ctrl_reps, fn):
    vals = []
    for r in sorted(reps):
        if r in ctrl_reps:
            x0 = fn(ctrl_reps[r])
            if x0:
                vals.append(100 * (fn(reps[r]) - x0) / x0)
    if not vals:
        return None
    n = len(vals)
    m = sum(vals) / n
    sd = (sum((v - m) ** 2 for v in vals) / (n - 1)) ** 0.5 if n > 1 else 0.0
    return {"mean": m, "sd": sd, "n": n, "values": vals}


def _paired_ratio_band(reps, ctrl_reps):
    adults = lambda r, i: r["series"]["Wild_males"][i] + r["series"]["Females"][i]
    common = [r for r in sorted(reps) if r in ctrl_reps]
    n_t = len(reps[common[0]]["series"]["Time"])
    mean, sd = [], []
    for i in range(n_t):
        vals = [adults(reps[r], i) / max(1, adults(ctrl_reps[r], i)) for r in common]
        m = sum(vals) / len(vals)
        mean.append(m)
        sd.append((sum((v - m) ** 2 for v in vals) / (len(vals) - 1)) ** 0.5 if len(vals) > 1 else 0.0)
    return {"mean": mean, "sd": sd}


def _events(crop, series, schedule):
    L = CROPS[crop].season_length
    ev = []
    days = sorted(int(d) for d, n in schedule.items() if n > 0)
    if days:
        ev.append({"type": "release", "day": days[0], "label": f"Premier lâcher ({schedule[days[0]]:,} stériles)".replace(",", " ")})
    c = CROPS[crop]
    harvest = [t for t in range(1, L) if c.harvest_frequency and t % c.harvest_frequency == 0]
    if crop == "cherry":
        harvest = [L - 1]
    if harvest:
        ev.append({"type": "harvest_start", "day": harvest[0], "label": "Début de récolte"})
        if len(harvest) > 1:
            ev.append({"type": "harvest_end", "day": harvest[-1], "label": "Dernière récolte"})
        else:
            ev[-1]["label"] = "Récolte unique"
    wa = series["Wild_adults"]["mean"]
    pk = max(range(len(wa)), key=lambda i: wa[i])
    ev.append({"type": "peak", "day": pk, "label": f"Pic adultes sauvages (≈ {wa[pk]:,.0f})".replace(",", " ")})
    lv = series["Larvae"]["mean"]
    pl = max(range(len(lv)), key=lambda i: lv[i])
    ev.append({"type": "larvae_peak", "day": pl, "label": f"Pic larvaire (≈ {lv[pl]:,.0f})".replace(",", " ")})
    sw = series["SW_ratio"]["mean"]
    above = [i for i, v in enumerate(sw) if v >= 1]
    if above and days:
        ev.append({"type": "threshold", "day": above[0], "label": "Ratio S/W ≥ 1 (parité)"})
        after = [i for i in range(above[0], len(sw)) if sw[i] < 1]
        if after:
            ev.append({"type": "threshold_down", "day": after[0], "label": "Ratio S/W repasse sous 1"})
    return sorted(ev, key=lambda e: e["day"])


def build_results(eid, cfg: ExperimentConfig, plan, results):
    scenarios = []
    ctrl_by_crop = {p["crop"]: results[p["key"]] for p in plan if p["is_control"]}
    for p in plan:
        reps = results[p["key"]]
        agg = aggregate([reps[r] for r in sorted(reps)])
        sc = {**p, "schedule": {str(k): v for k, v in p["schedule"].items()},
              "seeds": [replicate_seed(cfg.seed, r) for r in sorted(reps)],
              "metrics": agg["metrics"], "series": agg["series"],
              "events": _events(p["crop"], agg["series"], p["schedule"])}
        ctrl = ctrl_by_crop.get(p["crop"])
        if ctrl:
            # Population relative au témoin : (W+F)_scénario / (W+F)_témoin, même jour, même graine
            sc["series"]["Wild_adults_vs_control"] = _paired_ratio_band(reps, ctrl)
        if ctrl and not p["is_control"]:
            m = lambda k: (lambda r: r["metrics"][k])
            sc["vs_control"] = {
                "larval_damage_pct": _paired_change(reps, ctrl, m("larval_damage_pct")),
                "larvae_produced": _paired_change(reps, ctrl, m("larvae_produced")),
                "rotten_pct": _paired_change(reps, ctrl, m("rotten_pct")),
                "wild_adults_final": _paired_change(reps, ctrl, lambda r: r["series"]["Wild_males"][-1] + r["series"]["Females"][-1]),
                "harvested_clean_pct": _paired_change(reps, ctrl, m("harvested_clean_pct")),
            }
        scenarios.append(sc)
    return {"experiment_id": eid, "schema_version": 1, "series_vars": ["Time", *SERIES_VARS,
            "Wild_adults", "SW_ratio", "Wild_adults_relative", "Wild_adults_vs_control"], "scenarios": scenarios,
            "computed_at": store.now()}
