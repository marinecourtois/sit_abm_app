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
    assert series[0].startswith("experiment,crop,invasion,wild,females,remating,strategy,budget,immigration_wild,immigration_females,immigration_every,day")
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


def test_plan_crosses_budgets_invasions_and_regimes(client):
    """Plan (1.7.0) : chaque cellule culture × invasion × régime × stratégie × budget est une saison
    du moteur au bit près, avec les graines communes, et le témoin apparié est celui de sa cellule."""
    from tis_engine.runner import build_schedule, run_season
    invs = [{"preset": "faible", "wild": 90, "females": 90}, {"preset": None, "wild": 120, "females": 150}]
    config = cfg(client, crops=["strawberry"], strategies=[{"key": "every_7"}], budgets=[3000, 6000],
                 invasions=invs, rematings=["preference", "first"])
    v = client.post("/api/validate", json=config).json()
    assert v["ok"], v["errors"]
    assert v["estimate"]["seasons"] == 1 * 2 * 2 * (1 + 2) * 10
    e = wait(client, client.post("/api/experiments", json={"name": "plan", "config": config}).json()["id"], timeout=300)
    assert e["status"] == "completed"
    res = client.get(f"/api/experiments/{e['id']}/results").json()
    scs = res["scenarios"]
    assert len(scs) == 12 and len({s["key"] for s in scs}) == 12
    assert sorted({s["budget"] for s in scs}) == [0, 3000, 6000]
    for s in scs:
        assert s["seeds"] == [1234 + 1000 * r for r in range(10)]
        for rep in (0, 9):
            direct = run_season({"crop": "strawberry", "wild": s["invasion"]["wild"], "females": s["invasion"]["females"],
                                 "remating": s["remating"], "seed": s["seeds"][rep],
                                 "schedule": build_schedule(s["strategy"], s["budget"], 100), "biology": config["biology"]})["metrics"]
            for k, val in direct.items():
                assert s["metrics"][k]["values"][rep] == val, (s["key"], k)
        if not s["is_control"]:
            ctrl = next(c for c in scs if c["is_control"] and c["invasion"] == s["invasion"] and c["remating"] == s["remating"])
            lv = lambda x: x["metrics"]["larvae_produced"]["values"]
            expect = [100 * (a - b) / b for a, b in zip(lv(s), lv(ctrl))]
            assert s["vs_control"]["larvae_produced"]["values"] == pytest.approx(expect)
    rows = list(csv.DictReader(io.StringIO(client.get(f"/api/experiments/{e['id']}/export?format=csv-metrics").text)))
    assert len(rows) == 120 and {r["remating"] for r in rows} == {"preference", "first"}
    assert {r["invasion"] for r in rows} == {"Faible (90 W : 90 F)", "Personnalisé (120 W : 150 F)"}


def test_plan_limits_and_legacy_hash(client):
    from app.schemas import ExperimentConfig, config_hash
    big = cfg(client, budgets=list(range(1000, 21000, 1000)), replicates=50,
              rematings=["preference", "first", "last", "mixed"], crops=["strawberry", "cherry"])
    r = client.post("/api/validate", json=big).json()
    assert not r["ok"] and any("saisons" in x for x in r["errors"])
    dup = client.post("/api/validate", json=cfg(client, budgets=[3000, 3000])).json()
    assert not dup["ok"] and any("double" in x for x in dup["errors"])
    # une configuration sans plan garde l'empreinte d'avant la 1.7.0
    legacy = cfg(client)
    import hashlib, json
    from tis_engine.parameters import EXTENSION_PARAMS
    dump = ExperimentConfig(**legacy).model_dump(exclude={"budgets", "invasions", "rematings", "immigration", "immigration_compare"})
    dump["invasion"].pop("by_crop")   # champ 1.10.0
    for k in EXTENSION_PARAMS:   # forme d'une configuration d'avant la 1.9.0 (sans extensions)
        dump["biology"].pop(k)
    assert config_hash(ExperimentConfig(**legacy)) == hashlib.sha256(json.dumps(dump, sort_keys=True).encode()).hexdigest()[:16]
    # une liste à une valeur ou vide équivaut à la valeur unique
    assert config_hash(ExperimentConfig(**cfg(client, budgets=[3000]))) == config_hash(ExperimentConfig(**legacy))


def test_configs_before_extensions_still_validate_and_run_identically(client):
    """Une configuration d'avant la 1.9.0 (biologie sans les clés d'extension) est acceptée,
    garde son empreinte et donne exactement les mêmes nombres qu'avec les extensions à 0."""
    from app.schemas import ExperimentConfig, config_hash
    from tis_engine.parameters import EXTENSION_PARAMS
    new = cfg(client, crops=["strawberry"], strategies=[{"key": "every_3"}], replicates=10)
    old = {**new, "biology": {k: v for k, v in new["biology"].items() if k not in EXTENSION_PARAMS}}
    assert client.post("/api/validate", json=old).json()["ok"]
    assert config_hash(ExperimentConfig(**old)) == config_hash(ExperimentConfig(**new))
    a = wait(client, client.post("/api/experiments", json={"name": "avant 1.9", "config": old}).json()["id"])
    b = wait(client, client.post("/api/experiments", json={"name": "1.9", "config": new}).json()["id"])
    ra, rb = (client.get(f"/api/experiments/{x['id']}/results").json() for x in (a, b))
    for sa, sb in zip(ra["scenarios"], rb["scenarios"]):
        assert sa["metrics"] == sb["metrics"]


def test_active_extension_is_flagged(client):
    v = client.post("/api/validate", json=cfg(client, crops=["strawberry"], biology={**cfg(client)["biology"], "turning_days": 5, "immigration_females": 8})).json()
    assert v["ok"]
    assert any("Extension hors notebook active" in w for w in v["warnings"])
    assert any("couvre toute la phase jeune" in w for w in v["warnings"])
    frac = client.post("/api/validate", json=cfg(client, biology={**cfg(client)["biology"], "immigration_females": 0.5})).json()
    assert not frac["ok"] and any("entière" in e for e in frac["errors"])
    bad = client.post("/api/validate", json=cfg(client, biology={**cfg(client)["biology"], "turning_days": "trois"}))
    assert bad.status_code == 200 and not bad.json()["ok"]   # erreur explicite, pas de 500


def test_strong_inoculum_per_crop_and_immigration_per_crop(client):
    """1.10.0 : l'inoculum fort a des effectifs propres à chaque culture (pic du témoin) et
    l'immigration quotidienne se règle par culture ; chaque saison reçoit les valeurs de sa culture."""
    from tis_engine.parameters import FORT_BY_CROP, IMMIGRATION_DEFAULTS
    meta = client.get("/api/meta").json()
    fort = meta["invasions"]["forte"]
    assert fort["by_crop"] == FORT_BY_CROP and fort["label"].startswith("Fort")
    assert meta["immigration_defaults"] == IMMIGRATION_DEFAULTS
    config = cfg(client, crops=["strawberry", "cherry"], strategies=[{"key": "every_7"}], replicates=10,
                 invasion={"preset": "forte", "wild": fort["wild"], "females": fort["females"], "by_crop": fort["by_crop"]},
                 immigration=IMMIGRATION_DEFAULTS)
    v = client.post("/api/validate", json=config).json()
    assert v["ok"], v["errors"]
    assert any("Immigration active" in w for w in v["warnings"])
    assert not any("diffèrent du préréglage" in w for w in v["warnings"])
    e = wait(client, client.post("/api/experiments", json={"name": "fort + immigration", "config": config}).json()["id"], timeout=300)
    assert e["status"] == "completed"
    res = client.get(f"/api/experiments/{e['id']}/results").json()
    for sc in res["scenarios"]:
        assert (sc["invasion"]["wild"], sc["invasion"]["females"]) == (FORT_BY_CROP[sc["crop"]]["wild"], FORT_BY_CROP[sc["crop"]]["females"])
        imm = IMMIGRATION_DEFAULTS[sc["crop"]]
        assert sc["immigration"] == imm
        days = len(sc["series"]["Time"]) - 1
        assert sc["metrics"]["immigrants"]["values"] == [(imm["wild"] + imm["females"]) * (days - 1)] * 10
    rows = list(csv.DictReader(io.StringIO(client.get(f"/api/experiments/{e['id']}/export?format=csv-metrics").text)))
    assert {r["invasion"] for r in rows} == {"Fort (pic du témoin)"}
    assert {(r["crop"], r["immigration_wild"]) for r in rows} == {("strawberry", "15"), ("cherry", "8")}


def test_immigration_cannot_be_set_twice(client):
    b = {**cfg(client)["biology"], "immigration_females": 5}
    v = client.post("/api/validate", json=cfg(client, biology=b, immigration={"cherry": {"wild": 8, "females": 8}})).json()
    assert not v["ok"] and any("deux fois" in e for e in v["errors"])


def test_inoculum_and_immigration_edge_cases(client):
    """Deux inoculums qui donnent les mêmes effectifs pour une culture sont refusés (clés de
    scénario identiques) ; l'immigration d'une culture non sélectionnée ou nulle est ignorée et
    ne change pas l'empreinte."""
    from app.schemas import ExperimentConfig, config_hash
    from tis_engine.parameters import FORT_BY_CROP
    fort = {"preset": "forte", "wild": 900, "females": 900, "by_crop": FORT_BY_CROP}
    dup = client.post("/api/validate", json=cfg(client, crops=["strawberry"], invasions=[fort, {"preset": None, **FORT_BY_CROP["strawberry"]}])).json()
    assert not dup["ok"] and any("mêmes effectifs" in e for e in dup["errors"])
    base = cfg(client, crops=["strawberry"])
    other = cfg(client, crops=["strawberry"], immigration={"strawberry": {"wild": 0, "females": 0}, "cherry": {"wild": 8, "females": 8}})
    assert ExperimentConfig(**other).immigration is None
    assert config_hash(ExperimentConfig(**other)) == config_hash(ExperimentConfig(**base))
    assert not any("immigration" in w for w in client.post("/api/validate", json=other).json()["warnings"])


def test_compare_with_and_without_immigration(client):
    """1.11.0 : une expérience calcule chaque scénario avec et sans immigration, mêmes graines.
    « Sans » est identique au bit près au moteur sans immigration ; chaque scénario est apparié
    au témoin de la même condition."""
    from tis_engine.runner import build_schedule, run_season
    config = cfg(client, crops=["strawberry"], strategies=[{"key": "every_3"}], replicates=10,
                 immigration={"strawberry": {"wild": 15, "females": 15}}, immigration_compare=True)
    v = client.post("/api/validate", json=config).json()
    assert v["ok"], v["errors"]
    assert v["estimate"]["seasons"] == 2 * 2 * 10
    e = wait(client, client.post("/api/experiments", json={"name": "avec / sans immigration", "config": config}).json()["id"], timeout=300)
    assert e["status"] == "completed"
    scs = client.get(f"/api/experiments/{e['id']}/results").json()["scenarios"]
    assert sorted(s["key"] for s in scs) == ["strawberry::imm=avec::every_3", "strawberry::imm=avec::no_tis",
                                             "strawberry::imm=sans::every_3", "strawberry::imm=sans::no_tis"]
    by = {s["key"]: s for s in scs}
    sans = by["strawberry::imm=sans::every_3"]
    assert sans["immigration"] is None and by["strawberry::imm=avec::every_3"]["immigration"] == {"wild": 15, "females": 15, "every": 1}
    direct = run_season({"crop": "strawberry", "wild": 120, "females": 150, "remating": "first", "seed": sans["seeds"][0],
                         "schedule": build_schedule({"key": "every_3"}, 3000, 100), "biology": config["biology"]})["metrics"]
    for k, val in direct.items():
        assert sans["metrics"][k]["values"][0] == val, k
    for mode in ("avec", "sans"):
        s, c = by[f"strawberry::imm={mode}::every_3"], by[f"strawberry::imm={mode}::no_tis"]
        lv = lambda x: x["metrics"]["larvae_produced"]["values"]
        assert s["vs_control"]["larvae_produced"]["values"] == pytest.approx([100 * (a - b) / b for a, b in zip(lv(s), lv(c))])
    assert not client.post("/api/validate", json=cfg(client, immigration_compare=True)).json()["ok"]
    # une arrivée tous les 100 jours en fraise (jours simulés 0 … 99) n'arriverait jamais : refusé
    late = client.post("/api/validate", json=cfg(client, crops=["strawberry"], immigration={"strawberry": {"wild": 5, "females": 5, "every": 100}})).json()
    assert not late["ok"] and any("tous les 1 à 99 jours" in e for e in late["errors"])
