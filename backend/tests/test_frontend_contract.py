"""Contrat backend → frontend : l'instantané du registre utilisé par les tests du frontend
(frontend/src/test/fixtures/meta.json) doit être identique au registre réel du moteur.
Régénérer avec `make fixtures` après une modification de tis_engine/parameters.py."""
import json
from pathlib import Path

from tis_engine.parameters import biology_defaults, registry

FIXTURE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "test" / "fixtures" / "meta.json"
STABLE = ("crops", "strategies", "remating", "invasions", "budget_presets", "biology",
          "fixed_constants", "model_constants", "limits", "engine_version", "params_version", "schema_version")


def test_frontend_meta_fixture_matches_engine():
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    live = json.loads(json.dumps(registry()))   # normalise tuples → listes comme en JSON
    for key in STABLE:
        assert fixture[key] == live[key], f"{key} : instantané frontend obsolète, lancer `make fixtures`"
    assert fixture["biology_defaults"] == biology_defaults()


def _declared_keys(block: str) -> set[str]:
    """Clés `key: "…"` déclarées dans un tableau de frontend/src/lib/variables.ts."""
    import re
    src = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "variables.ts").read_text(encoding="utf-8")
    body = src.split(f"export const {block}", 1)[1].split("];", 1)[0]
    return set(re.findall(r'key:\s*"([^"]+)"', body))


def test_engine_produces_everything_the_interface_displays():
    """Une vraie saison courte : chaque indicateur et chaque série déclarés par l'interface
    doivent exister dans la sortie du moteur (ou être dérivés par app/jobs.py)."""
    from tis_engine.runner import aggregate, build_schedule, run_season
    task = {"crop": "cherry", "wild": 20, "females": 20, "remating": "preference", "seed": 1,
            "schedule": build_schedule({"key": "every_7"}, 200, 25), "biology": biology_defaults()}
    res = aggregate([run_season(task)])
    assert _declared_keys("METRICS") <= set(res["metrics"]), "indicateur affiché mais non calculé"
    jobs_src = (Path(__file__).resolve().parents[1] / "app" / "jobs.py").read_text(encoding="utf-8")
    derived_in_jobs = {k for k in _declared_keys("VARIABLES") if f'"{k}"' in jobs_src}
    assert _declared_keys("VARIABLES") <= set(res["series"]) | derived_in_jobs, "série affichée mais non produite"
