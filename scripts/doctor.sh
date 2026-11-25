#!/usr/bin/env bash
# make doctor — vérifie l'installation de Modelly TIS Research et répare ce qui est cassé.
#
# Ne supprime jamais de données : une base abîmée est déplacée dans backend/data/sauvegarde-<date>/
# avant d'être recréée. Ne tue aucun processus : un port occupé est seulement signalé.
# Mac et Linux (sous Windows : utiliser WSL).
set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd)
PY="$ROOT/backend/.venv/bin/python"
STAMP=$(date +%Y%m%d-%H%M%S)
FIXED=0; WARN=0; FAIL=0

if [ -t 1 ]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; N=$'\e[0m'; else G=; Y=; R=; B=; N=; fi
ok()   { echo "  ${G}✓${N} $*"; }
fix()  { echo "  ${Y}↻${N} $*"; FIXED=$((FIXED + 1)); }
warn() { echo "  ${Y}!${N} $*"; WARN=$((WARN + 1)); }
bad()  { echo "  ${R}✗${N} $*"; FAIL=$((FAIL + 1)); }
step() { echo; echo "${B}$*${N}"; }

# ---------------------------------------------------------------- 1. outils
step "1. Outils"
command -v git >/dev/null && ok "git $(git --version | awk '{print $3}')" || bad "git introuvable"
if ! command -v uv >/dev/null; then
  for d in "$HOME/.local/bin" "$HOME/.cargo/bin"; do [ -x "$d/uv" ] && export PATH="$d:$PATH"; done
fi
if command -v uv >/dev/null; then
  ok "uv $(uv --version | awk '{print $2}')"
else
  fix "uv absent : installation (https://astral.sh/uv)"
  if curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1; then
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
    command -v uv >/dev/null && ok "uv installé ($(uv --version | awk '{print $2}')) — rouvrez le terminal pour l'avoir partout" || bad "uv installé mais introuvable dans le PATH"
  else
    bad "installation de uv impossible : voir https://docs.astral.sh/uv/getting-started/installation/"
  fi
fi
if command -v node >/dev/null; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$NODE_MAJOR" -ge 20 ]; then ok "Node.js $(node --version)"; else bad "Node.js $(node --version) : version 20 ou plus récente requise (https://nodejs.org ou « nvm install 22 »)"; fi
else
  bad "Node.js introuvable : installez la version 20 ou plus récente (https://nodejs.org, « brew install node » ou « nvm install 22 »)"
fi

# ---------------------------------------------------------------- 2. dépôt
step "2. Dépôt"
case "$ROOT" in
  *"Mobile Documents"*|*iCloud*|*OneDrive*|*Dropbox*|*"Google Drive"*)
    warn "dossier synchronisé ($ROOT) : la base SQLite peut y être bloquée. Déplacez le dépôt, par exemple dans ~/dev/" ;;
  "$HOME/Desktop"*|"$HOME/Documents"*)
    [ "$(uname)" = Darwin ] && warn "dépôt dans Bureau/Documents : si iCloud synchronise ces dossiers, SQLite peut échouer. En cas d'erreur « disk I/O » ou « database is locked », déplacez-le dans ~/dev/" ;;
esac
BRANCH=$(git branch --show-current 2>/dev/null)
if git fetch -q origin 2>/dev/null; then
  BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
  if [ "$BEHIND" = 0 ]; then
    ok "à jour avec origin/main (branche ${BRANCH:-détachée})"
  elif [ "$BRANCH" = main ] && [ -z "$(git status --porcelain --untracked-files=no)" ]; then
    git pull -q --ff-only origin main && fix "main mise à jour ($BEHIND commit(s) récupéré(s))" || warn "git pull impossible : faites-le à la main"
  else
    warn "$BEHIND commit(s) de retard sur origin/main ; branche « ${BRANCH:-détachée} » ou modifications en cours : « git switch main && git pull » quand vous êtes prête"
  fi
else
  warn "git fetch impossible (hors ligne ou pas d'accès) : version non vérifiée"
fi

# ---------------------------------------------------------------- 3. Python
step "3. Environnement Python (backend/.venv)"
py_ok() {
  [ -x "$PY" ] || return 1
  "$PY" - <<'EOF' 2>/dev/null
import sys, sqlite3
assert sys.version_info >= (3, 12)
sqlite3.connect(":memory:").execute("select 1")
import fastapi, uvicorn, pydantic, modelly  # noqa: F401
EOF
}
if py_ok; then
  ok "Python $("$PY" -c 'import sys; print(sys.version.split()[0])'), SQLite $("$PY" -c 'import sqlite3; print(sqlite3.sqlite_version)'), modelly $("$PY" -c 'import modelly; print(modelly.__version__)')"
else
  if [ -x "$PY" ]; then
    REASON=$("$PY" -c 'import sys, sqlite3, fastapi, uvicorn, modelly' 2>&1 | grep -v RuntimeWarning | tail -1)
    fix "environnement Python inutilisable (${REASON:-version < 3.12}) : recréation avec un Python 3.12 géré par uv (SQLite inclus)"
  else
    fix "environnement Python absent : création"
  fi
  if command -v uv >/dev/null && make -s install-backend; then
    py_ok && ok "Python $("$PY" -c 'import sys; print(sys.version.split()[0])'), SQLite $("$PY" -c 'import sqlite3; print(sqlite3.sqlite_version)'), modelly $("$PY" -c 'import modelly; print(modelly.__version__)')" \
          || bad "l'environnement Python ne fonctionne toujours pas : voir les messages ci-dessus"
  else
    bad "installation du backend impossible (uv manquant ou erreur ci-dessus)"
  fi
fi

# ---------------------------------------------------------------- 4. interface
step "4. Interface (frontend)"
if command -v npm >/dev/null; then
  if [ -x frontend/node_modules/.bin/vite ] && [ -x frontend/node_modules/.bin/tsc ]; then
    ok "dépendances npm installées"
  else
    fix "dépendances npm manquantes : installation"
    make -s install-frontend >/dev/null 2>&1 && ok "dépendances npm installées" || bad "npm install a échoué : lancez « cd frontend && npm install » pour voir l'erreur"
  fi
  if (cd frontend && npm run -s build >/dev/null 2>&1); then ok "interface construite (frontend/dist)"; else bad "la construction de l'interface a échoué : lancez « make build » pour voir l'erreur"; fi
else
  bad "npm introuvable (installé avec Node.js)"
fi

# ---------------------------------------------------------------- 5. données
step "5. Base de données (backend/data)"
mkdir -p backend/data/results
if [ ! -w backend/data ]; then
  bad "backend/data n'est pas accessible en écriture"
elif [ -x "$PY" ]; then
  # Lecture seule : aucune migration ni écriture (un serveur peut tourner sur cette base)
  DB_CHECK=$(cd backend && "$PY" - <<'EOF' 2>/dev/null | grep '^DOCTOR ' | tail -1
import sqlite3
from pathlib import Path
db = Path("data/app.db")
if not db.exists():
    print("DOCTOR ABSENTE")
else:
    try:
        c = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=5)
        r = c.execute("PRAGMA integrity_check").fetchone()[0]
        if r != "ok":
            print(f"DOCTOR CORROMPUE {r}")
        elif not c.execute("select 1 from sqlite_master where type='table' and name='experiments'").fetchone():
            print("DOCTOR VIDE")
        else:
            print(f"DOCTOR OK {c.execute('select count(*) from experiments').fetchone()[0]}")
    except sqlite3.DatabaseError as e:
        msg = str(e)
        print(f"DOCTOR {'VERROU' if 'locked' in msg else 'CORROMPUE'} {msg}")
    except Exception as e:  # noqa: BLE001
        print(f"DOCTOR ERREUR {type(e).__name__}: {e}")
EOF
)
  DB_CHECK=${DB_CHECK#DOCTOR }
  case "$DB_CHECK" in
    OK*) ok "base SQLite saine, ${DB_CHECK#OK } expérience(s)" ;;
    ABSENTE*|VIDE*) ok "base pas encore initialisée : elle sera créée au premier démarrage (avec l'étude de référence)" ;;
    VERROU*) warn "base verrouillée (${DB_CHECK#VERROU }) : un autre serveur l'utilise ; arrêtez-le avant de relancer" ;;
    CORROMPUE*)
      SAVE="backend/data/sauvegarde-$STAMP"
      mkdir -p "$SAVE"
      for f in backend/data/app.db backend/data/app.db-wal backend/data/app.db-shm backend/data/results; do [ -e "$f" ] && mv "$f" "$SAVE/"; done
      mkdir -p backend/data/results
      fix "base corrompue (${DB_CHECK#CORROMPUE }) : déplacée dans $SAVE ; une base neuve sera créée au démarrage" ;;
    *) warn "vérification de la base impossible (${DB_CHECK:-pas de réponse de Python}) : rien n'a été modifié" ;;
  esac
else
  warn "vérification de la base sautée (pas d'environnement Python)"
fi

# ---------------------------------------------------------------- 6. port
step "6. Port 8765"
if command -v lsof >/dev/null && lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
  P=$(lsof -nP -iTCP:8765 -sTCP:LISTEN -t | head -1)
  if curl -s -m2 http://localhost:8765/api/health 2>/dev/null | grep -q '"ok":true'; then
    warn "un serveur Modelly tourne déjà sur 8765 (PID $P) : arrêtez-le (Ctrl+C ou « kill $P ») avant « make serve » pour qu'il prenne cette version"
  else
    bad "le port 8765 est occupé par un autre programme (PID $P, $(ps -o comm= -p "$P" 2>/dev/null)) : fermez-le ou « kill $P »"
  fi
else
  ok "port 8765 libre"
fi

# ---------------------------------------------------------------- 7. essai
step "7. Essai du backend et du moteur"
if [ -x "$PY" ]; then
  SMOKE=$(cd backend && "$PY" - <<'EOF' 2>&1
from app.main import health, meta
from tis_engine.parameters import biology_defaults
from tis_engine.runner import build_schedule, run_season
h = health(); m = meta()
assert h["ok"] and m["biology"], "API"
r = run_season({"crop": "cherry", "wild": 90, "females": 90, "remating": "preference", "seed": 1,
                "schedule": build_schedule({"key": "every_7"}, 4500, 25), "biology": biology_defaults()})
assert r["metrics"]["harvested_pct"] > 0, "moteur"
print(f"DOCTOR OK application {h['app_version']}, moteur {h['engine_version']}, modelly {h['modelly_version']} ({h['modelly_source']})")
EOF
)
  LINE=$(echo "$SMOKE" | grep '^DOCTOR OK ' | tail -1)
  if [ -n "$LINE" ]; then ok "${LINE#DOCTOR OK }"; else bad "le backend ne démarre pas : $(echo "$SMOKE" | grep -v RuntimeWarning | tail -1)"; fi
fi

# ---------------------------------------------------------------- bilan
echo
if [ "$FAIL" -gt 0 ]; then
  echo "${R}${B}$FAIL problème(s) à régler à la main${N} (voir ✗ ci-dessus), $FIXED réparation(s), $WARN avertissement(s)."
  exit 1
fi
echo "${G}${B}Tout est prêt${N} ($FIXED réparation(s), $WARN avertissement(s)). Lancez : ${B}make serve${N} puis http://localhost:8765"
