"""API FastAPI — Modelly TIS Research."""
from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
import os
import platform
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path

import modelly
from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from tis_engine.parameters import MIN_REPLICATES, INVASION_PRESETS, biology_defaults, registry
from tis_engine.runner import STRATEGIES

from . import APP_VERSION, jobs, store
from .schemas import ExperimentConfig, ExperimentCreate, Invasion, config_hash, count_seasons, invasion_name, validate_config

REF = store.DATA / "reference"
(store.DATA / "factorial").mkdir(exist_ok=True)
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
    return {"app_version": APP_VERSION, "engine_version": r["engine_version"], "params_version": r["params_version"],
            "schema_version": r["schema_version"], "modelly_version": modelly.__version__,
            "modelly_source": MODELLY_SOURCE, "python": platform.python_version()}


def reference_config() -> dict:
    """Étude de référence de la vue d'ensemble : plan du notebook à invasion Moyenne, budget 9 000."""
    return ExperimentConfig(
        crops=["strawberry", "cherry"],
        strategies=[{"key": k} for k in ("daily", "every_3", "every_7", "front_70", "front_100")],
        invasion={"preset": "moyenne", **{k: INVASION_PRESETS["moyenne"][k] for k in ("wild", "females")}},
        budget=9000, remating="preference", replicates=MIN_REPLICATES, seed=42, include_control=True,
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
              openapi_url="/api/openapi.json" if _DOCS else None, version=APP_VERSION)
# Compression des réponses JSON (registre, listes, flux en direct). Les réponses déjà compressées
# (résultats, données de référence) portent Content-Encoding et ne sont pas recompressées.
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=6)


@app.middleware("http")
async def cache_headers(request: Request, call_next):
    resp = await call_next(request)
    if request.url.path.startswith("/assets/"):
        # fichiers du build Vite : nom haché par contenu, donc immuables
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif request.url.path.startswith("/api/"):
        resp.headers.setdefault("Cache-Control", "no-store")
    return resp


def _json_bytes(request: Request, raw: bytes, gz: bytes | None = None, cache: str | None = None) -> Response:
    """Réponse JSON pré-sérialisée ; envoie la version gzip telle quelle si le client l'accepte."""
    headers = {"Vary": "Accept-Encoding"}
    if cache:
        headers["Cache-Control"] = cache
    if gz is not None and "gzip" in request.headers.get("accept-encoding", ""):
        headers["Content-Encoding"] = "gzip"
        return Response(gz, media_type="application/json", headers=headers)
    return Response(raw if raw is not None else gzip.decompress(gz), media_type="application/json", headers=headers)


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
        src = factorial_source()
        rows, sha = _read_csv(src["path"])
        u = lambda k: {r[k] for r in rows}
        _PLAN_CACHE.update({"crops": len(u("Crop")), "invasions": sorted(u("Invasion"), key=lambda x: int(x.split("(")[1].split()[0])),
                            "budgets": sorted(u("Budget")), "remating": sorted(u("Remating")), "strategies": len(u("Strategy")),
                            "replicates": len(u("Replicate")), "seasons": len(rows), "sha256": sha,
                            "origin": src["origin"], "file": src["path"].name})
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
def live(eid: str, since: int = Query(0, ge=0)):
    """Flux en direct. ``since`` = curseur ``seq`` de la réponse précédente : seules les lignes
    plus récentes sont renvoyées (``from`` = index de la première ligne renvoyée par scénario)."""
    from bisect import bisect_right
    e = _get(eid)
    st = jobs.STATE.get(e["id"])
    if not st:
        return {"status": e["status"], "progress": e["progress"], "live": {}, "log": [], "plan": [], "seq": 0,
                "elapsed_s": None, "eta_s": None}
    with jobs._state_lock:
        out = {}
        for key, lv in st["live"].items():
            i = bisect_right(lv["seqs"], since)
            out[key] = {"day": lv["day"], "from": i, "rows": lv["rows"][i:]}
        seq = st["seq"]
    return {"status": st["status"], "progress": st["progress"], "done": st["done"], "total": st["total"],
            "live": out, "seq": seq, "log": st["log"], "plan": st["plan"], **jobs.timing(st)}


@app.get("/api/queue")
def queue():
    """Exécutions en file ou en cours (indicateur d'activité global de l'interface)."""
    return {"workers": jobs.WORKERS, "active": jobs.active()}


@app.get("/api/experiments/{eid}/results")
def results(request: Request, eid: str):
    e = _get(eid)
    gz = store.results_gz(e["id"])
    if gz is None:
        raise HTTPException(404, "Aucun résultat pour cette expérience.")
    # résultats immuables (une expérience terminée ne change plus) : mis en cache par le navigateur
    return _json_bytes(request, None, gz, cache="private, max-age=31536000, immutable")


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
        return _download(_protocol_json(e), f"{name}-protocole.json", "application/json")
    if r is None:
        raise HTTPException(404, "Aucun résultat à exporter.")
    if format == "json":
        return _download(_results_json(e, r), f"{name}.json", "application/json")
    if format == "csv-metrics":
        return _download(_metrics_csv(name, r, e["config"]), f"{name}-{format}.csv", "text/csv")
    if format == "csv-series":
        return _download(_series_csv(name, r, e["config"]), f"{name}-{format}.csv", "text/csv")
    if format == "archive":
        return Response(_archive(e, r), media_type="application/zip",
                        headers={"Content-Disposition": f'attachment; filename="{name}-archive.zip"'})
    raise HTTPException(400, "Format inconnu")


def _protocol_json(e) -> str:
    doc = {"format": "modelly-tis-protocol", "schema_version": 1, "name": e["name"], "config": e["config"],
           "source_experiment": e["short_id"], "versions": versions()}
    return json.dumps(doc, indent=2, ensure_ascii=False)


def _results_json(e, r) -> str:
    return json.dumps({"metadata": _metadata(e), "config": e["config"], "versions": versions(), "results": r}, ensure_ascii=False)


_CELL_COLS = ["crop", "invasion", "wild", "females", "remating", "strategy", "budget"]


def _cell(sc, cfg) -> list:
    """Identification d'un scénario : culture, invasion, régime, stratégie, budget (plan ou valeurs uniques)."""
    inv = sc.get("invasion") or cfg["invasion"]
    return [sc["crop"], invasion_name(Invasion(**inv)), inv["wild"], inv["females"], sc.get("remating") or cfg["remating"],
            sc["strategy_label"], sc["budget"]]


def _metrics_csv(name, r, cfg) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    keys = list(r["scenarios"][0]["metrics"])
    w.writerow(["experiment", *_CELL_COLS, "replicate", "seed", *keys])
    for sc in r["scenarios"]:
        cell = _cell(sc, cfg)
        for i, seed in enumerate(sc["seeds"]):
            w.writerow([name, *cell, i, seed, *[sc["metrics"][k]["values"][i] for k in keys]])
    return buf.getvalue()


def _series_csv(name, r, cfg) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    vars_ = [v for v in r["series_vars"] if v != "Time"]
    w.writerow(["experiment", *_CELL_COLS, "day", *[f"{v}_{s}" for v in vars_ for s in ("mean", "sd")]])
    for sc in r["scenarios"]:
        cell = _cell(sc, cfg)
        for i, t in enumerate(sc["series"]["Time"]):
            w.writerow([name, *cell, t,
                        *[x for v in vars_ for x in ((sc["series"][v]["mean"][i], sc["series"][v]["sd"][i]) if v in sc["series"] else ("", ""))]])
    return buf.getvalue()


def _archive(e, r) -> bytes:
    """Archive de reproductibilité : protocole réimportable, résultats complets, CSV, et un
    LISEZMOI qui liste versions, graines et empreintes SHA-256 de chaque fichier."""
    name = e["short_id"]
    files = {
        "protocole.json": _protocol_json(e),
        "resultats.json": _results_json(e, r),
        "metriques_par_repetition.csv": _metrics_csv(name, r, e["config"]),
        "series_journalieres.csv": _series_csv(name, r, e["config"]),
    }
    data = {k: v.encode("utf-8") for k, v in files.items()}
    rt = e.get("runtime") or {}
    cfg = e["config"]
    lines = [
        f"Modelly TIS Research — archive de l'expérience {name}",
        "",
        f"Nom            : {e['name']}",
        f"Projet         : {e['project']}",
        f"Créée          : {e['created_at']}",
        f"Calculée       : {e.get('started_at') or '—'} → {e.get('finished_at') or '—'} ({e.get('duration_s')} s)",
        f"Hash config    : {e['config_hash']}",
        f"Graine de base : {cfg['seed']} (répétition r : graine + 1000 × r, communes à tous les scénarios)",
        f"Répétitions    : {cfg['replicates']}",
        "",
        "Versions de l'exécution (enregistrées au calcul) :",
        *[f"  {k:16s} {v}" for k, v in (rt or {k: e.get(k) for k in ('engine_version', 'params_version', 'schema_version')}).items()],
        "",
        "Fichiers (SHA-256) :",
        *[f"  {hashlib.sha256(b).hexdigest()}  {fn}" for fn, b in data.items()],
        "",
        "Reproduire : Expériences → Importer un protocole → protocole.json, puis lancer.",
        "Mêmes versions et même graine ⇒ mêmes nombres, au bit près.",
        "",
    ]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{name}/LISEZMOI.txt", "\n".join(lines))
        for fn, b in data.items():
            z.writestr(f"{name}/{fn}", b)
    return buf.getvalue()


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
def _read_csv(path: Path):
    with open(path) as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for k, v in r.items():
            try:
                r[k] = float(v) if any(c in v for c in ".e") else int(v)
            except ValueError:
                pass
    return rows, hashlib.sha256(path.read_bytes()).hexdigest()


def factorial_source() -> dict:
    """Plan factoriel servi à la page Analyses : le recalcul de l'application à ≥ MIN_REPLICATES
    répétitions s'il existe (scripts/factorial.py), sinon le CSV du notebook (3 répétitions)."""
    done = []
    for prov_file in (store.DATA / "factorial").glob("factorial_r*.json"):
        prov = json.loads(prov_file.read_text(encoding="utf-8"))
        csv_file = prov_file.with_suffix(".csv")
        if csv_file.exists() and prov.get("replicates", 0) >= MIN_REPLICATES:
            done.append((prov["replicates"], csv_file, prov))
    if done:
        n, path, prov = max(done, key=lambda d: d[0])
        return {"path": path, "origin": "application", "provenance": prov,
                "label": f"Plan factoriel du notebook recalculé par l'application ({n} répétitions) → {path.name}",
                "verified": (f"Mêmes plan et formule de graine que le notebook ; les {prov['notebook_rows_identical']} "
                             "saisons déjà calculées par le notebook (répétitions 0 à 2) sont identiques au bit près "
                             "(vérifié par scripts/factorial.py avant écriture).")}
    path = REF / "resultats_experience_factorielle.csv"
    return {"path": path, "origin": "notebook", "provenance": None,
            "label": f"Notebook_ABM_TIS_Optimise_Modelly.ipynb → {path.name}",
            "verified": "Reproduit à l'identique par le moteur extrait (tests/test_regression.py)."}


_REF_CACHE: dict = {}


@app.get("/api/reference/{which}")
def reference(request: Request, which: str):
    """Données de référence (CSV de 0,5 Mo) : sérialisées et compressées une seule fois par
    version du fichier (clé = chemin + date de modification), puis servies depuis la mémoire."""
    if which not in ("factorial", "dynamics"):
        raise HTTPException(404)
    src_path = factorial_source()["path"] if which == "factorial" else REF / "dynamiques_temporelles_journalieres.csv"
    key = (which, str(src_path), src_path.stat().st_mtime_ns)
    if _REF_CACHE.get(which, (None,))[0] != key:
        raw = json.dumps(_reference_doc(which), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        _REF_CACHE[which] = (key, raw, gzip.compress(raw, 6))
    _, raw, gz = _REF_CACHE[which]
    return _json_bytes(request, raw, gz)


def _reference_doc(which: str) -> dict:
    if which == "factorial":
        src = factorial_source()
    elif which == "dynamics":
        p = REF / "dynamiques_temporelles_journalieres.csv"
        src = {"path": p, "origin": "notebook", "provenance": None, "label": f"Notebook_ABM_TIS_Optimise_Modelly.ipynb → {p.name}",
               "verified": "Reproduit à l'identique par le moteur extrait (tests/test_regression.py)."}
    else:
        raise HTTPException(404)
    rows, sha = _read_csv(src["path"])
    uniq = lambda k: sorted({r[k] for r in rows}, key=str)
    if which == "factorial":
        desc = (f"Plan factoriel du notebook : {len(uniq('Crop'))} cultures × {len(uniq('Invasion'))} invasions × "
                f"{len(uniq('Budget'))} budgets ({', '.join(str(b) for b in sorted(uniq('Budget')))}) × {len(uniq('Remating'))} régimes × "
                f"{len(uniq('Strategy'))} stratégies (dont le témoin au budget 0) × {len(uniq('Replicate'))} répétitions — {len(rows)} saisons.")
    else:
        desc = (f"Dynamiques journalières du notebook : {len(uniq('Crop'))} cultures × {len(uniq('Strategy'))} stratégies × "
                f"{len(uniq('Remating'))} régimes × {len(uniq('Replicate'))} répétitions — {len(rows)} lignes (une par jour).")
    return {"source": src["label"], "origin": src["origin"], "provenance": src["provenance"], "sha256": sha,
            "description": desc, "verified": src["verified"], "rows": rows}


_OVERVIEW_CACHE: dict = {}


@app.get("/api/overview")
def overview(request: Request):
    refs = [e for e in store.list_all() if REFERENCE_TAG in e["tags"]]
    done = [e for e in refs if e["status"] == "completed"]
    if done:
        e = done[0]
        key = (e["id"], e["name"], e["description"], e["project"], tuple(e["tags"]))
        if _OVERVIEW_CACHE.get("key") != key:
            # étude terminée = immuable : réponse assemblée et compressée une seule fois
            gz = store.results_gz(e["id"])
            raw = (b'{"experiment":' + json.dumps(e, ensure_ascii=False).encode("utf-8")
                   + b',"results":' + (gzip.decompress(gz) if gz else b"null") + b"}")
            _OVERVIEW_CACHE.update(key=key, raw=raw, gz=gzip.compress(raw, 6))
        return _json_bytes(request, _OVERVIEW_CACHE["raw"], _OVERVIEW_CACHE["gz"])
    return JSONResponse({"experiment": _with_state(refs[0]) if refs else None, "results": None})


@app.get("/api/health")
def health():
    return {"ok": True, **versions()}


if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.api_route("/{path:path}", methods=["GET", "HEAD"])   # HEAD : sondes de disponibilité des proxys
    def spa(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Route d'API inconnue")
        f = DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(DIST / "index.html")
