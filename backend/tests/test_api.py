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
            "replicates": 2, "seed": 1234, "include_control": True,
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
    assert sc["seeds"] == [1234, 2234]
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
    a = wait(client, client.post("/api/experiments", json={"name": "a", "config": cfg(client, replicates=1)}).json()["id"])
    b = wait(client, client.post("/api/experiments", json={"name": "b", "config": cfg(client, replicates=1)}).json()["id"])
    ra = client.get(f"/api/experiments/{a['id']}/results").json()
    rb = client.get(f"/api/experiments/{b['id']}/results").json()
    assert [s["metrics"] for s in ra["scenarios"]] == [s["metrics"] for s in rb["scenarios"]]
    assert a["config_hash"] == b["config_hash"]
    assert client.post(f"/api/experiments/{a['id']}/run").status_code == 409
    d = client.post(f"/api/experiments/{a['id']}/duplicate", json={"config": {"seed": 99}}).json()
    assert d["parent_id"] == a["id"] and d["status"] == "ready" and d["config"]["seed"] == 99


def test_cancel(client):
    e = client.post("/api/experiments", json={"name": "long", "config": cfg(client, crops=["strawberry"], replicates=30)}).json()
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
