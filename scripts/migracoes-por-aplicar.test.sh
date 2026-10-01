#!/usr/bin/env bash
# Ensaio de `migracoes-por-aplicar.sh`: os códigos de saída, um a um.
#
# Corre no job Migrações do CI, a seguir à conciliação. O que se testa é o que
# o `deploy.yml` lê — e foi isso que esteve trocado: o deploy tomava o 2 por
# «falta aplicar» e o 1 por erro, quando o guião dizia o contrário, e com
# migrações por aplicar o deploy parava em vez de as aplicar. Um código de
# saída é um contrato entre dois ficheiros, e um contrato que só um dos lados
# lê acaba trocado.
#
# Cria uma base de ensaio própria, com um registo semeado à mão, e apaga-a no
# fim. Não toca na base que o job migrou.
set -euo pipefail

PSQL_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PGOPTIONS='--client-min-messages=warning'
PSQL=(psql "$PSQL_URL" -X -v ON_ERROR_STOP=1 -q -tA)

BASE=ensaio_por_aplicar
ENSAIO="${PSQL_URL%/*}/${BASE}"
"${PSQL[@]}" -c "drop database if exists ${BASE}" -c "create database ${BASE}"
trap '"${PSQL[@]}" -c "drop database if exists ${BASE}" >/dev/null 2>&1 || true' EXIT
NO_ENSAIO=(psql "$ENSAIO" -X -v ON_ERROR_STOP=1 -q -tA)

falhas=0
codigo_de() {
  local codigo=0
  DATABASE_URL="$1" "$ROOT/scripts/migracoes-por-aplicar.sh" >/dev/null 2>&1 || codigo=$?
  echo "$codigo"
}
afirmar() {
  if [ "$1" = "$2" ]; then
    echo "✓ $3"
  else
    echo "✗ $3 — esperava $2, saiu $1"
    falhas=$((falhas + 1))
  fi
}

# Sem registo: não se consegue responder.
afirmar "$(codigo_de "$ENSAIO")" 1 "uma base sem registo de migrações sai 1"

"${NO_ENSAIO[@]}" -c "create schema supabase_migrations" \
  -c "create table supabase_migrations.schema_migrations (version text, name text)"
for ficheiro in "$ROOT"/supabase/migrations/*.sql; do
  nome="$(basename "$ficheiro" .sql)"
  "${NO_ENSAIO[@]}" -c "insert into supabase_migrations.schema_migrations values ('${nome%%_*}', '${nome#*_}')"
done
afirmar "$(codigo_de "$ENSAIO")" 0 "com o registo completo, a base está em dia: sai 0"

ultima="$(basename "$(ls "$ROOT"/supabase/migrations/*.sql | tail -1)" .sql)"
"${NO_ENSAIO[@]}" -c "delete from supabase_migrations.schema_migrations where name = '${ultima#*_}'"
afirmar "$(codigo_de "$ENSAIO")" 10 "falta a última: o repositório vai à frente, sai 10"

"${NO_ENSAIO[@]}" -c "insert into supabase_migrations.schema_migrations values ('99990101000000', 'aplicada_a_mao')"
afirmar "$(codigo_de "$ENSAIO")" 11 "uma linha que o repositório não tem: a base vai à frente, sai 11"

afirmar "$(codigo_de "")" 1 "sem DATABASE_URL sai 1"
afirmar "$(codigo_de "${PSQL_URL%/*}/base_que_nao_existe")" 1 "uma base que não responde sai 1, e não um código do psql"

if [ "$falhas" -gt 0 ]; then
  echo "✗ ${falhas} falha(s)"
  exit 1
fi
echo "✓ os códigos de saída são os que o deploy lê"
