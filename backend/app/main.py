"""API FastAPI — Modelly TIS Research."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import platform
from contextlib import asynccontextmanager
from pathlib import Path

import modelly
from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from tis_engine.parameters import INVASION_PRESETS, biology_defaults, registry
from tis_engine.runner import STRATEGIES

from . import jobs, store
from .schemas import ExperimentConfig, ExperimentCreate, config_hash, count_seasons, validate_config

REF = store.DATA / "reference"
DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
REFERENCE_TAG = "référence"


def _modelly_source() -> str:
    """Provenance de modelly : « PyPI » ou le chemin local d'où il a été construit (PEP 610)."""
    try:
        from importlib.metadata import distribution
        raw = distribution("modelly-abm").read_text("direct_url.json")
        if raw:
            url = json.loads(raw).get("url", "")
            return "source locale " + url.removeprefix("file://")
    except Exception:  # noqa: BLE001
        pass
    return "PyPI"


MODELLY_SOURCE = _modelly_source()


def versions():
    r = registry()
    return {"engine_version": r["engine_version"], "params_version": r["params_version"],
            "schema_version": r["schema_version"], "modelly_version": modelly.__version__,
            "modelly_source": MODELLY_SOURCE, "python": platform.python_version()}


def reference_config() -> dict:
    """Étude de référence de la vue d'ensemble : plan du notebook à invasion Moyenne, budget 9 000."""
    return ExperimentConfig(
        crops=["strawberry", "cherry"],
        strategies=[{"key": k} for k in ("daily", "every_3", "every_7", "front_70", "front_100")],
        invasion={"preset": "moyenne", **{k: INVASION_PRESETS["moyenne"][k] for k in ("wild", "females")}},
        budget=9000, remating="preference", replicates=3, seed=42, include_control=True,
        biology=biology_defaults(),
    ).model_dump()


def reference_description(cfg: dict, inv: str) -> str:
    budget = f"{cfg['budget']:,}".replace(",", "\u202f")
    return (f"{len(cfg['strategies'])} stratégies TIS et témoin, invasion {inv}, budget {budget} stériles, "
            f"régime « {cfg['remating']} », {cfg['replicates']} répétitions, graine {cfg['seed']}.")


@asynccontextmanager
async def lifespan(app):
    store.init()
    jobs.start()
    if not any(REFERENCE_TAG in e["tags"] and e["status"] == "completed" for e in store.list_all()):
        cfg = reference_config()
        inv = next((v["label"] for v in INVASION_PRESETS.values() if (v["wild"], v["females"]) == (cfg["invasion"]["wild"], cfg["invasion"]["females"])), "personnalisée")
        _create(ExperimentCreate(name="Étude de référence — Fraise vs Cerise", project="Étude 01",
                                 description=reference_description(cfg, inv),
                                 config=cfg, tags=[REFERENCE_TAG]))
    yield
    jobs.shutdown()


# Documentation interactive de l'API (Swagger) : uniquement en développement (TIS_API_DOCS=1),
# pour qu'aucune documentation technique ne soit exposée sur le site.
_DOCS = os.environ.get("TIS_API_DOCS") == "1"
app = FastAPI(title="Modelly TIS Research", lifespan=lifespan,
              docs_url="/api/docs" if _DOCS else None, redoc_url=None,
              openapi_url="/api/openapi.json" if _DOCS else None)


def _create(body: ExperimentCreate) -> dict:
    v = validate_config(body.config)
    if not v["ok"]:
        raise HTTPException(422, {"errors": v["errors"]})
    cfg = body.config.model_dump()
    exp = store.create(body.name, body.project, body.description, cfg, config_hash(body.config), versions(),
                       body.parent_id, body.tags)
    if body.run:
        jobs.submit(exp)
    return store.get(exp["id"])


def _get(eid) -> dict:
    e = store.get(eid)
    if not e:
        raise HTTPException(404, "Expérience introuvable")
    return e


def _with_state(e):
    st = jobs.STATE.get(e["id"])
    if st and e["status"] in ("queued", "running"):
        e["progress"] = st["progress"]
    return e


_PLAN_CACHE: dict = {}


def reference_plan() -> dict:
    """Résumé du plan factoriel du notebook, calculé à partir du CSV (et non recopié)."""
    if not _PLAN_CACHE:
        rows, sha = _read_csv("resultats_experience_factorielle.csv")
        u = lambda k: {r[k] for r in rows}
        _PLAN_CACHE.update({"crops": len(u("Crop")), "invasions": sorted(u("Invasion"), key=lambda x: int(x.split("(")[1].split()[0])),
                            "budgets": sorted(u("Budget")), "remating": sorted(u("Remating")), "strategies": len(u("Strategy")),
                            "replicates": len(u("Replicate")), "seasons": len(rows), "sha256": sha})
    return _PLAN_CACHE


@app.get("/api/meta")
def meta():
    return {**registry(), "versions": versions(), "biology_defaults": biology_defaults(), "reference_plan": reference_plan(),
            "strategy_nb_names": STRATEGIES, "workers": jobs.WORKERS}


def _history():
    """Exécutions terminées de ce serveur : base de l'estimation de durée (mesurée, pas supposée)."""
    out = []
    for e in store.list_all(status="completed")[:50]:
        try:
            out.append({"seasons": count_seasons(ExperimentConfig(**e["config"])), "duration_s": e["duration_s"]})
        except Exception:  # noqa: BLE001
            continue
    return out


@app.post("/api/validate")
def validate(cfg: ExperimentConfig):
    return validate_config(cfg, _history())


@app.get("/api/experiments")
def list_experiments(q: str | None = None, project: str | None = None, status: str | None = None):
    return [_with_state(e) for e in store.list_all(q, project, status)]


@app.post("/api/experiments")
def create_experiment(body: ExperimentCreate):
    return _create(body)


@app.get("/api/experiments/{eid}")
def get_experiment(eid: str):
    return _with_state(_get(eid))


@app.patch("/api/experiments/{eid}")
def patch_experiment(eid: str, body: dict = Body(...)):
    e = _get(eid)
    allowed = {k: body[k] for k in ("name", "description", "tags", "project") if k in body}
    store.update(e["id"], **allowed)
    return store.get(e["id"])


@app.delete("/api/experiments/{eid}")
def delete_experiment(eid: str):
    e = _get(eid)
    if e["status"] in ("queued", "running"):
        raise HTTPException(409, "Annulez l'exécution avant de supprimer l'expérience.")
    store.delete(e["id"])
    return {"ok": True}


@app.post("/api/experiments/{eid}/run")
def run_experiment(eid: str):
    e = _get(eid)
    if e["status"] == "completed":
        raise HTTPException(409, "Expérience terminée et immuable : dupliquez-la pour la relancer.")
    if e["status"] in ("queued", "running"):
        raise HTTPException(409, "Déjà en cours.")
    if e["status"] in ("cancelled", "error"):
        # une relance crée une nouvelle exécution identifiable, l'ancienne est conservée
        return _create(ExperimentCreate(name=e["name"], project=e["project"], description=e["description"],
                                        config=e["config"], parent_id=e["id"], tags=e["tags"]))
    jobs.submit(e)
    return store.get(e["id"])


@app.post("/api/experiments/{eid}/cancel")
def cancel_experiment(eid: str):
    e = _get(eid)
    if e["status"] not in ("queued", "running"):
        raise HTTPException(409, "Aucune exécution en cours.")
    jobs.cancel(e["id"])
    return {"ok": True}


@app.post("/api/experiments/{eid}/duplicate")
def duplicate_experiment(eid: str, body: dict = Body(default={})):
    e = _get(eid)
    cfg = {**e["config"], **(body.get("config") or {})}
    return _create(ExperimentCreate(name=body.get("name") or f"{e['name']} (copie)", project=body.get("project") or e["project"],
                                    description=e["description"], config=cfg, parent_id=e["id"],
                                    tags=[t for t in e["tags"] if t != REFERENCE_TAG], run=body.get("run", False)))


@app.get("/api/experiments/{eid}/live")
def live(eid: str):
    e = _get(eid)
    st = jobs.STATE.get(e["id"])
    if not st:
        return {"status": e["status"], "progress": e["progress"], "live": {}, "log": [], "plan": []}
    return {"status": st["status"], "progress": st["progress"], "done": st["done"], "total": st["total"],
            "live": st["live"], "log": st["log"], "plan": st["plan"]}


@app.get("/api/experiments/{eid}/results")
def results(eid: str):
    e = _get(eid)
    r = store.load_results(e["id"])
    if r is None:
        raise HTTPException(404, "Aucun résultat pour cette expérience.")
    return r


def _metadata(e):
    return {k: e.get(k) for k in ("id", "short_id", "name", "project", "description", "config_hash", "status", "runtime",
                              "engine_version", "params_version", "schema_version", "seed", "created_at",
                              "started_at", "finished_at", "error", "parent_id", "duration_s")}


@app.get("/api/experiments/{eid}/export")
def export(eid: str, format: str = Query("json")):
    e = _get(eid)
    r = store.load_results(e["id"])
    name = e["short_id"]
    if format == "protocol":
        doc = {"format": "modelly-tis-protocol", "schema_version": 1, "name": e["name"], "config": e["config"],
               "source_experiment": e["short_id"], "versions": versions()}
        return _download(json.dumps(doc, indent=2, ensure_ascii=False), f"{name}-protocole.json", "application/json")
    if r is None:
        raise HTTPException(404, "Aucun résultat à exporter.")
    if format == "json":
        doc = {"metadata": _metadata(e), "config": e["config"], "versions": versions(), "results": r}
        return _download(json.dumps(doc, ensure_ascii=False), f"{name}.json", "application/json")
    buf = io.StringIO()
    w = csv.writer(buf)
    if format == "csv-metrics":
        keys = list(r["scenarios"][0]["metrics"])
        w.writerow(["experiment", "crop", "strategy", "budget", "replicate", "seed", *keys])
        for sc in r["scenarios"]:
            for i, seed in enumerate(sc["seeds"]):
                w.writerow([name, sc["crop"], sc["strategy_label"], sc["budget"], i, seed,
                            *[sc["metrics"][k]["values"][i] for k in keys]])
    elif format == "csv-series":
        vars_ = [v for v in r["series_vars"] if v != "Time"]
        w.writerow(["experiment", "crop", "strategy", "day", *[f"{v}_{s}" for v in vars_ for s in ("mean", "sd")]])
        for sc in r["scenarios"]:
            for i, t in enumerate(sc["series"]["Time"]):
                w.writerow([name, sc["crop"], sc["strategy_label"], t,
                            *[x for v in vars_ for x in ((sc["series"][v]["mean"][i], sc["series"][v]["sd"][i]) if v in sc["series"] else ("", ""))]])
    else:
        raise HTTPException(400, "Format inconnu")
    return _download(buf.getvalue(), f"{name}-{format}.csv", "text/csv")


def _download(content, filename, media):
    return Response(content, media_type=media + "; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.post("/api/protocol/import")
def import_protocol(doc: dict = Body(...)):
    if doc.get("format") != "modelly-tis-protocol":
        raise HTTPException(422, {"errors": ["Fichier non reconnu : format « modelly-tis-protocol » attendu."]})
    cfg = ExperimentConfig(**doc["config"])
    return _create(ExperimentCreate(name=f"{doc.get('name', 'Protocole importé')} (importé)", config=cfg, run=False,
                                    description=f"Importé depuis {doc.get('source_experiment', 'un fichier')}"))


# ---------------------------------------------------------------- données de référence du notebook
def _read_csv(name):
    p = REF / name
    with open(p) as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for k, v in r.items():
            try:
                r[k] = float(v) if any(c in v for c in ".e") else int(v)
            except ValueError:
                pass
    return rows, hashlib.sha256(p.read_bytes()).hexdigest()


@app.get("/api/reference/{which}")
def reference(which: str):
    files = {"factorial": "resultats_experience_factorielle.csv", "dynamics": "dynamiques_temporelles_journalieres.csv"}
    if which not in files:
        raise HTTPException(404)
    rows, sha = _read_csv(files[which])
    uniq = lambda k: sorted({r[k] for r in rows}, key=str)
    if which == "factorial":
        desc = (f"Plan factoriel du notebook : {len(uniq('Crop'))} cultures × {len(uniq('Invasion'))} invasions × "
                f"{len(uniq('Budget'))} budgets ({', '.join(str(b) for b in sorted(uniq('Budget')))}) × {len(uniq('Remating'))} régimes × "
                f"{len(uniq('Strategy'))} stratégies (dont le témoin au budget 0) × {len(uniq('Replicate'))} répétitions — {len(rows)} saisons.")
    else:
        desc = (f"Dynamiques journalières du notebook : {len(uniq('Crop'))} cultures × {len(uniq('Strategy'))} stratégies × "
                f"{len(uniq('Remating'))} régimes × {len(uniq('Replicate'))} répétitions — {len(rows)} lignes (une par jour).")
    return {"source": f"Notebook_ABM_TIS_Optimise_Modelly.ipynb → {files[which]}", "sha256": sha,
            "description": desc,
            "verified": "Reproduit à l'identique par le moteur extrait (tests/test_regression.py).",
            "rows": rows}


@app.get("/api/overview")
def overview():
    refs = [e for e in store.list_all() if REFERENCE_TAG in e["tags"]]
    done = [e for e in refs if e["status"] == "completed"]
    if done:
        return {"experiment": done[0], "results": store.load_results(done[0]["id"])}
    return JSONResponse({"experiment": _with_state(refs[0]) if refs else None, "results": None})


@app.get("/api/health")
def health():
    return {"ok": True, **versions()}


if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Route d'API inconnue")
        f = DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(DIST / "index.html")
