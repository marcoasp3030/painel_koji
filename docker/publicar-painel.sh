#!/bin/sh
# Publica o painel somente com a árvore commitada e grava o commit na imagem.
set -eu
cd "$(dirname "$0")/.."

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "Build recusado: há alteração não commitada." >&2
  git status --porcelain >&2
  exit 1
fi

COMMIT=$(git rev-parse --verify HEAD)
case "$COMMIT" in
  *[!0-9a-f]* | "")
    echo "Build recusado: commit inválido." >&2
    exit 1
    ;;
esac

if docker inspect painel_koji-painel-1 >/dev/null 2>&1; then
  ATUAL=$(docker inspect painel_koji-painel-1 --format '{{.Image}}')
  docker tag "$ATUAL" "painel:volta-$(date -u +%Y%m%dT%H%M%SZ)"
fi

export GIT_COMMIT="$COMMIT"
docker compose build painel

ROTULO=$(docker image inspect painel_koji-painel:latest --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
if [ "$ROTULO" != "$COMMIT" ]; then
  echo "Build recusado: a imagem não gravou o commit." >&2
  exit 1
fi

docker tag painel_koji-painel:latest "painel:${COMMIT}"
echo "Imagem marcada como painel:${COMMIT}"
