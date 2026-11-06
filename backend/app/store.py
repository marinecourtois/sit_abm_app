"""Persistance des expériences (SQLite) et des résultats (JSON compressé).

Une expérience terminée est immuable : toute modification passe par une copie
(`parent_id`) qui reçoit un nouvel identifiant.
"""
from __future__ import annotations

import gzip
import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
RESULTS = DATA / "results"
RESULTS.mkdir(parents=True, exist_ok=True)
DB = DATA / "app.db"
_lock = threading.Lock()

FINAL = {"completed", "cancelled", "error"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _conn():
    c = sqlite3.connect(DB, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def init():
    with _lock, _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS experiments (
            id TEXT PRIMARY KEY, short_id TEXT, name TEXT, project TEXT, description TEXT,
            config TEXT, config_hash TEXT, status TEXT, progress REAL DEFAULT 0,
            engine_version TEXT, params_version TEXT, schema_version INTEGER,
            seed INTEGER, created_at TEXT, started_at TEXT, finished_at TEXT,
            error TEXT, parent_id TEXT, tags TEXT, duration_s REAL)""")
        # Une exécution interrompue par un arrêt du serveur ne doit pas rester « en cours »
        c.execute("UPDATE experiments SET status='cancelled', error='Interrompue par un redémarrage du serveur', finished_at=? "
                  "WHERE status IN ('queued','running')", (now(),))


def _row(r) -> dict:
    d = dict(r)
    d["config"] = json.loads(d["config"])
    d["tags"] = json.loads(d["tags"] or "[]")
    d["has_results"] = (RESULTS / f"{d['id']}.json.gz").exists()
    return d


def create(name, project, description, config, config_hash, versions, parent_id=None, tags=()):
    eid = str(uuid.uuid4())
    short = "TIS-" + eid[:8].upper()
    with _lock, _conn() as c:
        c.execute("INSERT INTO experiments (id, short_id, name, project, description, config, config_hash, status, "
                  "engine_version, params_version, schema_version, seed, created_at, parent_id, tags) "
                  "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (eid, short, name, project, description, json.dumps(config), config_hash, "ready",
                   versions["engine_version"], versions["params_version"], versions["schema_version"],
                   config["seed"], now(), parent_id, json.dumps(list(tags))))
    return get(eid)


def get(eid) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM experiments WHERE id=? OR short_id=?", (eid, eid)).fetchone()
    return _row(r) if r else None


def list_all(q: str | None = None, project: str | None = None, status: str | None = None) -> list[dict]:
    sql, args = "SELECT * FROM experiments WHERE 1=1", []
    if q:
        sql += " AND (name LIKE ? OR short_id LIKE ? OR description LIKE ? OR config LIKE ?)"
        args += [f"%{q}%"] * 4
    if project:
        sql += " AND project=?"; args.append(project)
    if status:
        sql += " AND status=?"; args.append(status)
    sql += " ORDER BY created_at DESC"
    with _conn() as c:
        return [_row(r) for r in c.execute(sql, args).fetchall()]


def update(eid, **fields):
    cur = get(eid)
    if cur is None:
        raise KeyError(eid)
    # immuabilité : seuls les champs d'exécution peuvent changer, et jamais après la fin
    if cur["status"] in FINAL and set(fields) - {"name", "description", "tags", "project"}:
        raise PermissionError("Expérience terminée : immuable.")
    if "tags" in fields:
        fields["tags"] = json.dumps(fields["tags"])
    cols = ", ".join(f"{k}=?" for k in fields)
    with _lock, _conn() as c:
        c.execute(f"UPDATE experiments SET {cols} WHERE id=?", (*fields.values(), cur["id"]))


def delete(eid):
    cur = get(eid)
    if cur:
        with _lock, _conn() as c:
            c.execute("DELETE FROM experiments WHERE id=?", (cur["id"],))
        (RESULTS / f"{cur['id']}.json.gz").unlink(missing_ok=True)


def save_results(eid, results: dict):
    with gzip.open(RESULTS / f"{eid}.json.gz", "wt", encoding="utf-8") as f:
        json.dump(results, f, separators=(",", ":"))


def load_results(eid) -> dict | None:
    p = RESULTS / f"{eid}.json.gz"
    if not p.exists():
        return None
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.load(f)
