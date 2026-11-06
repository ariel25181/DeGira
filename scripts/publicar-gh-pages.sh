#!/usr/bin/env bash
# Publica el contenido de dist/ en la rama gh-pages (la que sirve GitHub Pages), reemplazando todo lo anterior.
# Usado por el CI; se puede ensayar contra un repositorio local con ORIGIN=<ruta> (ver tests/scripts/publicar.test.ts).
set -euo pipefail
ORIGIN="${ORIGIN:-origin}"
SHA="${GITHUB_SHA:-local}"
[ -f dist/index.html ] || { echo "No existe dist/index.html: ejecutá primero el build." >&2; exit 1; }

touch dist/.nojekyll
git config user.name "${GIT_AUTHOR_NAME:-github-actions[bot]}"
git config user.email "${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
git fetch "$ORIGIN" gh-pages
WT="$(mktemp -d)"
ROOT="$(pwd)"
trap 'cd "$ROOT" && git worktree remove --force "$WT" >/dev/null 2>&1 || true; git worktree prune' EXIT
git worktree prune
git worktree add -q -B gh-pages "$WT" FETCH_HEAD
find "$WT" -mindepth 1 -maxdepth 1 -not -name .git -exec rm -rf {} +
cp -a dist/. "$WT"/
cd "$WT"
git add -A
if git diff --cached --quiet; then echo "gh-pages ya está al día: no hay cambios que publicar."; exit 0; fi
git commit -q -m "deploy: ${SHA:0:7}"
git push "$ORIGIN" gh-pages
echo "Publicado en gh-pages (${SHA:0:7})."
