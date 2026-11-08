#!/usr/bin/env bash
# ==============================================================================
# DeGira - Utilidad para hacer commit y push de fixes a GitHub
# ==============================================================================
# Uso:
#   npm run push
#   npm run push -- "fix: selector de perfil y tour guiado"
#   bash scripts/push-fix.sh "fix: descripción del fix" [--no-verify] [--pages] [--force]
# ==============================================================================
set -euo pipefail

REPO_DEFAULT="https://github.com/ariel25181/DeGira.git"
REPO_WEB="https://github.com/ariel25181/DeGira"
PAGES_WEB="https://ariel25181.github.io/DeGira/"
BRANCH="main"

MSG=""
NO_VERIFY=0
DEPLOY_PAGES=0
FORCE_PUSH=0

# Parsear argumentos
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-verify|-n)
      NO_VERIFY=1
      shift
      ;;
    --pages|-p)
      DEPLOY_PAGES=1
      shift
      ;;
    --force|-f)
      FORCE_PUSH=1
      shift
      ;;
    -h|--help)
      echo "Uso: npm run push [opciones] -- [mensaje]"
      echo ""
      echo "Opciones:"
      echo "  \"mensaje\"     Mensaje descriptivo del commit (opcional)"
      echo "  --no-verify   Saltea las pruebas y compilación previa"
      echo "  --pages       Publica directamente en la rama gh-pages (GitHub Pages)"
      echo "  --force       Usa push forzado seguro (--force-with-lease)"
      exit 0
      ;;
    *)
      if [ -z "$MSG" ]; then
        MSG="$1"
      else
        MSG="$MSG $1"
      fi
      shift
      ;;
  esac
done

# Mensaje por defecto con fecha y hora si no se proveyó uno
if [ -z "$MSG" ]; then
  FECHA_HORA="$(date '+%Y-%m-%d %H:%M')"
  MSG="fix: mejoras y correcciones en la app [$FECHA_HORA]"
fi

echo "============================================================"
echo "🚀 DeGira: Enviando fixes a GitHub ($BRANCH)"
echo "📝 Mensaje: $MSG"
echo "============================================================"

# 1. Asegurar repositorio Git local
git config --global --add safe.directory "$PWD" 2>/dev/null || true
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "📦 Inicializando repositorio git local en rama '$BRANCH'..."
  git init -q -b "$BRANCH"
fi

# Configurar identidad de autor si no existe
if [ -z "$(git config user.name || true)" ]; then
  git config user.name "${GIT_AUTHOR_NAME:-ariel25181}"
fi
if [ -z "$(git config user.email || true)" ]; then
  git config user.email "${GIT_AUTHOR_EMAIL:-ariel.najlis@gmail.com}"
fi

# 2. Configurar remote 'origin'
CURRENT_REMOTE="$(git remote get-url origin 2>/dev/null || true)"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

if [ -n "$TOKEN" ]; then
  TARGET_REMOTE="https://${TOKEN}@github.com/ariel25181/DeGira.git"
else
  TARGET_REMOTE="$REPO_DEFAULT"
fi

if [ -z "$CURRENT_REMOTE" ]; then
  echo "🔗 Conectando con el repositorio remoto: $REPO_DEFAULT"
  git remote add origin "$TARGET_REMOTE"
else
  if [ -n "$TOKEN" ] && [[ "$CURRENT_REMOTE" != *"$TOKEN"* ]]; then
    git remote set-url origin "$TARGET_REMOTE"
  fi
fi

# Si es un repositorio recién inicializado, traer el historial remoto para evitar conflictos
if ! git rev-parse HEAD >/dev/null 2>&1; then
  echo "📥 Sincronizando historial previo con origin/$BRANCH..."
  git fetch origin "$BRANCH" --depth=1 2>/dev/null || true
  if git rev-parse "origin/$BRANCH" >/dev/null 2>&1; then
    git reset origin/"$BRANCH" >/dev/null 2>&1 || true
  fi
fi

# 3. Verificación previa de tipos y compilación (a menos que use --no-verify)
if [ "$NO_VERIFY" -eq 0 ]; then
  echo "🔍 Verificando tipos con TypeScript..."
  npm run lint

  echo "🔨 Compilando aplicación de prueba..."
  npm run build
fi

# 4. Preparar commit
git add -A

HAS_CHANGES=0
if ! git diff --cached --quiet; then
  HAS_CHANGES=1
fi

if [ "$HAS_CHANGES" -eq 1 ]; then
  echo "💾 Creando commit con los cambios..."
  git commit -m "$MSG"
else
  echo "ℹ️  No hay cambios pendientes sin commitear."
fi

COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'local')"

# 5. Push a GitHub
echo "📤 Subiendo commits a GitHub (origin $BRANCH)..."
PUSH_FLAGS=()
if [ "$FORCE_PUSH" -eq 1 ]; then
  PUSH_FLAGS+=("--force-with-lease")
fi

if git push -u origin "$BRANCH" "${PUSH_FLAGS[@]}"; then
  echo "✅ Push a GitHub completado con éxito."
else
  echo "⚠️ El push directo falló. Intentando traer cambios remotos con rebase..."
  git fetch origin "$BRANCH" || true
  git rebase "origin/$BRANCH" || git rebase --abort || true
  git push -u origin "$BRANCH" "${PUSH_FLAGS[@]}"
  echo "✅ Push completado tras sincronización."
fi

# 6. Deploy opcional a GitHub Pages si se solicitó con --pages
if [ "$DEPLOY_PAGES" -eq 1 ]; then
  echo "🌐 Publicando en la rama gh-pages (GitHub Pages)..."
  bash scripts/publicar-gh-pages.sh
fi

echo "============================================================"
echo "🎉 ¡Fixes publicados exitosamente!"
echo "📌 Commit:        $COMMIT_SHA"
echo "📂 Repositorio:   $REPO_WEB"
echo "⚙️ CI / Actions:  $REPO_WEB/actions"
echo "🌐 GitHub Pages:  $PAGES_WEB"
echo "============================================================"
