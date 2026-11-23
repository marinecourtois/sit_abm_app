"""Tests de bout en bout de l'API : validation, exécution, fidélité des paramètres, immuabilité, exports."""
import csv
import io
import os
import tempfile
import time

import pytest

os.environ.setdefault("TIS_WORKERS", "4")


@pytest.fixture(scope="module")
def client():
    from app import store
    tmp = tempfile.mkdtemp()
    store.DB = store.Path(tmp) / "test.db"
    store.RESULTS = store.Path(tmp) / "results"
    store.RESULTS.mkdir()
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c


def wait(c, eid, timeout=120):
    t0 = time.time()
    while time.time() - t0 < timeout:
        e = c.get(f"/api/experiments/{eid}").json()
        if e["status"] in ("completed", "cancelled", "error"):
            return e
        time.sleep(0.3)
    raise TimeoutError


def cfg(c, **over):
    base = {"crops": ["cherry"], "strategies": [{"key": "every_7"}, {"key": "front_loaded", "initial_fraction": 0.5, "maintenance_interval": 5}],
            "invasion": {"preset": None, "wild": 120, "females": 150}, "budget": 3000, "remating": "first",
            "replicates": 10, "seed": 1234, "include_control": True,
            "biology": {**c.get("/api/meta").json()["biology_defaults"], "eta": 0.65, "lifespan_sterile": 9.0}}
    base.update(over)
    return base


def test_validation_rejects_invalid(client):
    bad = cfg(client, replicates=0, budget=-1)
    bad["biology"]["eta"] = 99
    r = client.post("/api/validate", json=bad).json()
    assert not r["ok"] and len(r["errors"]) >= 3
    assert client.post("/api/experiments", json={"name": "x", "config": bad}).status_code == 422


def test_parameters_reach_engine_exactly(client):
    from tis_engine.runner import build_schedule, run_season
    config = cfg(client)
    e = client.post("/api/experiments", json={"name": "fidélité", "config": config}).json()
    e = wait(client, e["id"])
    assert e["status"] == "completed"
    res = client.get(f"/api/experiments/{e['id']}/results").json()
    sc = next(s for s in res["scenarios"] if s["strategy_key"] == "front_loaded")
    assert sc["seeds"] == [1234 + 1000 * r for r in range(10)]
    for rep, seed in enumerate(sc["seeds"]):
        direct = run_season({"crop": "cherry", "wild": 120, "females": 150, "remating": "first", "seed": seed,
                             "schedule": build_schedule({"key": "front_loaded", "initial_fraction": 0.5, "maintenance_interval": 5}, 3000, 25),
                             "biology": config["biology"]})["metrics"]
        for k, v in direct.items():
            assert sc["metrics"][k]["values"][rep] == v, k
    # témoin apparié présent et calendrier conforme
    assert any(s["is_control"] for s in res["scenarios"])
    assert sum(sc["schedule"].values()) == 3000


def test_reproducible_and_immutable(client):
    a = wait(client, client.post("/api/experiments", json={"name": "a", "config": cfg(client)}).json()["id"])
    b = wait(client, client.post("/api/experiments", json={"name": "b", "config": cfg(client)}).json()["id"])
    ra = client.get(f"/api/experiments/{a['id']}/results").json()
    rb = client.get(f"/api/experiments/{b['id']}/results").json()
    assert [s["metrics"] for s in ra["scenarios"]] == [s["metrics"] for s in rb["scenarios"]]
    assert a["config_hash"] == b["config_hash"]
    assert client.post(f"/api/experiments/{a['id']}/run").status_code == 409
    d = client.post(f"/api/experiments/{a['id']}/duplicate", json={"config": {"seed": 99}}).json()
    assert d["parent_id"] == a["id"] and d["status"] == "ready" and d["config"]["seed"] == 99


def test_cancel(client):
    e = client.post("/api/experiments", json={"name": "long", "config": cfg(client, crops=["strawberry"], replicates=50)}).json()
    time.sleep(0.8)
    assert client.post(f"/api/experiments/{e['id']}/cancel").status_code == 200
    e = wait(client, e["id"])
    assert e["status"] == "cancelled"
    assert client.get(f"/api/experiments/{e['id']}/results").status_code == 404


def test_exports_and_protocol_roundtrip(client):
    e = next(x for x in client.get("/api/experiments").json() if x["status"] == "completed")
    rows = list(csv.DictReader(io.StringIO(client.get(f"/api/experiments/{e['id']}/export?format=csv-metrics").text)))
    assert rows and "larval_damage_pct" in rows[0]
    series = client.get(f"/api/experiments/{e['id']}/export?format=csv-series").text.splitlines()
    assert series[0].startswith("experiment,crop,strategy,day")
    proto = client.get(f"/api/experiments/{e['id']}/export?format=protocol").json()
    imp = client.post("/api/protocol/import", json=proto).json()
    assert imp["config"] == e["config"] and imp["status"] == "ready"


# ---------------------------------------------------------------- 1.6.0 : performance et nouveautés
def test_live_stream_is_incremental_and_gapless(client):
    """Le curseur `since` ne renvoie que les nouvelles lignes ; recollées, elles forment la série complète."""
    e = client.post("/api/experiments", json={"name": "direct", "config": cfg(client, crops=["strawberry"])}).json()
    acc, seq, seen_running = {}, 0, False
    t0 = time.time()
    while time.time() - t0 < 120:
        lv = client.get(f"/api/experiments/{e['id']}/live", params={"since": seq}).json()
        if lv["status"] == "running":
            seen_running = True
            assert lv["elapsed_s"] is not None
        for key, part in lv["live"].items():
            rows = acc.setdefault(key, [])
            assert part["from"] <= len(rows), "trou dans le flux"
            del rows[part["from"]:]
            rows.extend(part["rows"])
            assert len(rows) == part["day"]
        seq = lv["seq"]
        if lv["status"] in ("completed", "cancelled", "error"):
            break
        time.sleep(0.05)
    assert seen_running and lv["status"] == "completed"
    assert lv["eta_s"] is None and lv["live"] == {}     # flux libéré à la fin : les séries sont dans les résultats
    res = client.get(f"/api/experiments/{e['id']}/results").json()
    for key, rows in acc.items():                         # répétition 0 en direct = répétition 0 enregistrée (mêmes graines)
        if rows and len(rows) == 100:
            sc = next(s for s in res["scenarios"] if s["key"] == key)
            assert sc["seeds"][0] == 1234


def test_queue_lists_active_runs(client):
    e = client.post("/api/experiments", json={"name": "file", "config": cfg(client, crops=["strawberry"], replicates=30)}).json()
    q = client.get("/api/queue").json()
    assert q["workers"] >= 1
    run = next(r for r in q["active"] if r["id"] == e["id"])
    assert run["total"] == 3 * 30 and run["short_id"] == e["short_id"]
    client.post(f"/api/experiments/{e['id']}/cancel")
    wait(client, e["id"])
    assert all(r["id"] != e["id"] for r in client.get("/api/queue").json()["active"])


def test_results_are_served_precompressed_and_cacheable(client):
    from app import store
    e = next(x for x in client.get("/api/experiments").json() if x["status"] == "completed")
    r = client.get(f"/api/experiments/{e['id']}/results", headers={"Accept-Encoding": "gzip"})
    assert r.headers["content-encoding"] == "gzip" and "immutable" in r.headers["cache-control"]
    assert r.json() == store.load_results(e["id"])
    plain = client.get(f"/api/experiments/{e['id']}/results", headers={"Accept-Encoding": "identity"})
    assert "content-encoding" not in plain.headers and plain.json() == r.json()
    assert client.get("/api/meta").headers["cache-control"] == "no-store"
    ref = client.get("/api/reference/factorial", headers={"Accept-Encoding": "gzip"})
    assert ref.headers["content-encoding"] == "gzip" and ref.json()["rows"]


def test_reproducibility_archive(client):
    import hashlib
    import json
    import zipfile
    e = next(x for x in client.get("/api/experiments").json() if x["status"] == "completed")
    r = client.get(f"/api/experiments/{e['id']}/export", params={"format": "archive"})
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    z = zipfile.ZipFile(io.BytesIO(r.content))
    sid = e["short_id"]
    names = set(z.namelist())
    assert names == {f"{sid}/{n}" for n in ("LISEZMOI.txt", "protocole.json", "resultats.json",
                                             "metriques_par_repetition.csv", "series_journalieres.csv")}
    readme = z.read(f"{sid}/LISEZMOI.txt").decode()
    for n in names - {f"{sid}/LISEZMOI.txt"}:                # chaque empreinte du LISEZMOI correspond au fichier
        assert f"{hashlib.sha256(z.read(n)).hexdigest()}  {n.split('/')[1]}" in readme
    assert "app_version" in readme and e["config_hash"] in readme
    proto = json.loads(z.read(f"{sid}/protocole.json"))
    assert client.post("/api/protocol/import", json=proto).json()["config"] == e["config"]


def test_health_reports_app_version(client):
    from app import APP_VERSION
    h = client.get("/api/health").json()
    assert h["app_version"] == APP_VERSION and h["engine_version"]
