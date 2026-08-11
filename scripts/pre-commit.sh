#!/usr/bin/env bash
# Pre-commit hook — run backend + frontend checks before every commit.
#
# Install:  bash scripts/install-precommit.sh
# Checks:   ruff (backend), mypy (backend), pytest (backend), vitest (frontend)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "── backend: ruff ──"
(cd backend && .venv/bin/ruff check .)

echo "── backend: mypy ──"
(cd backend && .venv/bin/mypy .)

echo "── backend: pytest ──"
(cd backend && .venv/bin/pytest -q)

echo "── frontend: vitest ──"
(cd frontend && pnpm exec ng test --watch=false)

echo "✅ All checks passed — committing."
