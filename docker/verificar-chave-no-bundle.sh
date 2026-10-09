#!/bin/sh
# Confere, sem exibir o valor, que a chave do gateway não está no build.
# Uso (na raiz do projeto, depois de "docker compose build painel"):
#   sh docker/verificar-chave-no-bundle.sh
set -eu

docker run --rm --env-file .env --entrypoint sh painel_koji-painel -c '
set -eu
K="$GATEWAY_PANEL_KEY"
[ ${#K} -ge 20 ] || { echo "GATEWAY_PANEL_KEY não carregada do .env"; exit 2; }
valor=$(grep -rlF -- "$K" /app/.output | wc -l)
front=$(grep -rlE "GATEWAY_PANEL_KEY|GATEWAY_ADMIN_URL|luxbrain-gateway|clienteGatewayPadrao" /app/.output/public | wc -l)
servidor=$(grep -rlF GATEWAY_PANEL_KEY /app/.output/server | wc -l)
echo "valor da chave em .output: $valor arquivo(s)"
echo "referências ao gateway no front: $front arquivo(s)"
echo "servidor lê GATEWAY_PANEL_KEY: $servidor arquivo(s)"
[ "$valor" -eq 0 ] && [ "$front" -eq 0 ] || { echo "FALHOU"; exit 1; }
echo "OK"
'
