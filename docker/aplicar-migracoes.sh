#!/bin/sh
# Aplica as migrations do painel depois que o GoTrue criou o schema auth.
set -eu

export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL="psql -h banco -U postgres -d postgres -v ON_ERROR_STOP=1"

echo "Aguardando Postgres..."
until pg_isready -h banco -U postgres -d postgres >/dev/null 2>&1; do
  sleep 2
done

echo "Aguardando tabela auth.users..."
i=0
while [ "$i" -lt 90 ]; do
  if $PSQL -c "SELECT 1 FROM auth.users LIMIT 1" >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if ! $PSQL -c "SELECT 1 FROM auth.users LIMIT 1" >/dev/null 2>&1; then
  echo "auth.users não apareceu a tempo." >&2
  exit 1
fi

$PSQL <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  arquivo text PRIMARY KEY,
  aplicado_em timestamptz NOT NULL DEFAULT now()
);
SQL

for arquivo in /migrations/*.sql; do
  nome=$(basename "$arquivo")
  ja=$($PSQL -tAc "SELECT 1 FROM public.schema_migrations WHERE arquivo = '$nome'")
  if [ "$ja" = "1" ]; then
    echo "Já aplicada: $nome"
    continue
  fi
  echo "Aplicando $nome"
  $PSQL -f "$arquivo"
  $PSQL -c "INSERT INTO public.schema_migrations (arquivo) VALUES ('$nome')"
done

$PSQL <<'SQL'
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role, postgres;
SQL

echo "Migrations concluídas."
