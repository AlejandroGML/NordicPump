#!/usr/bin/env bash
# Install scripts/pre-commit.sh as the git pre-commit hook.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cp "$ROOT/scripts/pre-commit.sh" "$ROOT/.git/hooks/pre-commit"
chmod +x "$ROOT/.git/hooks/pre-commit"
echo "✅ pre-commit hook installed."
