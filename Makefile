# Modelly TIS Research
PY := backend/.venv/bin/python

install:            ## Installe le backend (venv) et le frontend
	uv venv -q backend/.venv --python '>=3.12'
	uv pip install -q --python $(PY) -r backend/requirements.txt
	cd frontend && npm install

dev:                ## API (8765) + frontend Vite (5173, proxy /api)
	(cd backend && TIS_API_DOCS=1 .venv/bin/uvicorn app.main:app --port 8765 --reload) & (cd frontend && npm run dev)

build:              ## Construit le frontend ; l'API le sert ensuite sur http://localhost:8765
	cd frontend && npm run build

serve: build        ## Application complète sur http://localhost:8765
	cd backend && .venv/bin/uvicorn app.main:app --port 8765

test:               ## Non-régression scientifique + tests de l'API
	cd backend && .venv/bin/python -m pytest -q tests

.PHONY: install dev build serve test
