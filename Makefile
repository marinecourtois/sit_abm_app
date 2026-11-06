# Modelly TIS Research
PY := backend/.venv/bin/python
# Source de modelly : chemin d'un dépôt Modelly local (version de développement la plus récente).
# Vide → version publiée sur PyPI (modelly-abm). Exemple : make install MODELLY_SRC=~/Desktop/work/Modelly
MODELLY_SRC ?= $(HOME)/Desktop/work/Modelly

install:            ## Installe le backend (venv) et le frontend
	uv venv -q backend/.venv --python '>=3.12'
	uv pip install -q --python $(PY) -r backend/requirements.txt
	@if [ -n "$(MODELLY_SRC)" ] && [ -f "$(MODELLY_SRC)/pyproject.toml" ]; then \
		echo "modelly : construction depuis $(MODELLY_SRC)"; \
		uv pip install -q --python $(PY) --reinstall --no-deps "$(MODELLY_SRC)"; \
	else echo "modelly : version PyPI"; fi
	cd frontend && npm install
	npm install            # SmartTest (racine du dépôt)

dev:                ## API (8765) + frontend Vite (5173, proxy /api)
	(cd backend && TIS_API_DOCS=1 .venv/bin/uvicorn app.main:app --port 8765 --reload) & (cd frontend && npm run dev)

build:              ## Construit le frontend ; l'API le sert ensuite sur http://localhost:8765
	cd frontend && npm run build

serve: build        ## Application complète sur http://localhost:8765
	cd backend && .venv/bin/uvicorn app.main:app --port 8765

test:               ## Tous les tests : backend (pytest) + frontend (Vitest)
	cd backend && .venv/bin/python -m pytest -q tests
	cd frontend && npx vitest run

test-smart:         ## Uniquement les tests affectés par les modifications non commitées (SmartTest)
	npx smarttest run

test-all:           ## Tous les tests (backend + frontend) via SmartTest, avec rapport HTML
	npx smarttest run --all

factorial:          ## Recalcule le plan factoriel du notebook avec 10 répétitions (page Analyses, quelques minutes)
	cd backend && .venv/bin/python scripts/factorial.py --reps 10

fixtures:           ## Régénère l'instantané du registre utilisé par les tests du frontend
	cd backend && .venv/bin/python -c "import json; from app.main import meta; print(json.dumps(meta(), ensure_ascii=False, indent=2))" > ../frontend/src/test/fixtures/meta.json

modelly:            ## Réinstalle modelly depuis MODELLY_SRC (après une mise à jour du dépôt Modelly)
	uv pip install --python $(PY) --reinstall --no-deps "$(MODELLY_SRC)"
	$(PY) -c "import modelly; print('modelly', modelly.__version__)"

.PHONY: install dev build serve test test-smart test-all factorial fixtures modelly
