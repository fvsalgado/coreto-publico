#!/usr/bin/env bash
# Ensaio de `conciliar-registo.sh` sobre uma base com as migrações aplicadas.
#
# Corre no job Migrações do CI, a seguir a `verify-migrations.sh`, sobre a
# mesma base. Semeia um registo torto com os mesmos defeitos que o de produção
# tinha a 2 de setembro de 2026 — carimbo trocado, nome sem número, nome com
# o carimbo à frente, migração renumerada, linha repetida, linha órfã e
# migrações sem linha — e prova que o script os vê, os endireita quando se
# pede, e não toca no que não é dele.
#
# Não é um teste de migrações: a base já está migrada quando isto corre, e o
# que se testa é a lista.
set -euo pipefail

PSQL_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PGOPTIONS='--client-min-messages=warning'
PSQL=(psql "$PSQL_URL" -X -v ON_ERROR_STOP=1 -q -tA)

# A etiqueta e o carimbo de uma migração pelo número: «0004» → «0004_events»,
# «20260827090300». As primeiras nunca mudam de nome — são história.
etiqueta() {
  basename "$(ls "$ROOT"/supabase/migrations/*_"$1"_*.sql)" .sql | cut -d_ -f2-
}
carimbo() {
  basename "$(ls "$ROOT"/supabase/migrations/*_"$1"_*.sql)" .sql | cut -d_ -f1
}
texto() {
  etiqueta "$1" | cut -d_ -f2-
}

falhas=0
afirmar() {
  if [ "$1" = "$2" ]; then
    echo "✓ $3"
  else
    echo "✗ $3"
    echo "    esperava: $2"
    echo "    obteve:   $1"
    falhas=$((falhas + 1))
  fi
}

# ---------------------------------------------------------------------------
# O registo torto.
# ---------------------------------------------------------------------------
"${PSQL[@]}" <<SQL
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
delete from supabase_migrations.schema_migrations;
insert into supabase_migrations.schema_migrations (version, name) values
  ('$(carimbo 0001)', '$(etiqueta 0001)'),                      -- certa
  ('20990101000001', '$(etiqueta 0002)'),                       -- carimbo diferente
  ('20990101000002', '$(carimbo 0003)_$(etiqueta 0003)'),       -- nome com carimbo
  ('20990101000003', '$(texto 0004)'),                          -- nome sem número
  ('20990101000004', '9999_$(texto 0005)'),                     -- renumerada
  ('$(carimbo 0006)', '$(etiqueta 0006)'),                      -- certa…
  ('20990101000005', '$(etiqueta 0006)'),                       -- …e repetida
  ('$(carimbo 0007)', '$(etiqueta 0008)'),                      -- a 0008 com o carimbo da 0007…
  ('20990101000007', '$(etiqueta 0007)'),                       -- …e a 0007 à espera dele (colisão)
  ('20990101000006', 'uma_migracao_que_nunca_existiu');         -- órfã
SQL

# ---------------------------------------------------------------------------
# 1. Só o relatório: diz o que está torto e sai com 1.
# ---------------------------------------------------------------------------
set +e
relatorio="$(DATABASE_URL="$PSQL_URL" "$ROOT/scripts/conciliar-registo.sh" 2>&1)"
codigo=$?
set -e
afirmar "$codigo" "1" "com o registo torto, o relatório sai com 1"
# `<<<` e não `printf … | grep`, e não é estilo.
#
# O `grep -q` sai no primeiro acerto e fecha o cano. Se o relatório for maior
# do que o buffer do cano (64 KB no Linux) e o padrão aparecer cedo, o `printf`
# fica com metade por escrever e leva EPIPE — «write error: Broken pipe». Com
# `set -o pipefail`, esse erro passa a ser o estado do pipeline inteiro, e a
# asserção dá **falso negativo**: diz que o relatório não nomeia um caso que
# nomeia. Medido: com o cano, 40 falsos negativos em 40; com a herestring, 0.
#
# Ficou latente enquanto o relatório coube no buffer — e o relatório cresce com
# cada migração que entra no repositório. Este ficheiro é um teste, e um teste
# que falha por causa de si próprio custa mais do que o que verifica.
for caso in 'carimbo diferente' 'nome com carimbo' 'nome sem número' 'renumerada' 'repetida' 'órfã' 'sem linha'; do
  if grep -q "$caso" <<< "$relatorio"; then
    echo "✓ o relatório nomeia o caso «$caso»"
  else
    echo "✗ o relatório não nomeia o caso «$caso»"
    falhas=$((falhas + 1))
  fi
done
# Sem --escrever nada muda.
n="$("${PSQL[@]}" -c "select count(*) from supabase_migrations.schema_migrations where version like '2099%';")"
afirmar "$n" "7" "sem --escrever, as sete linhas tortas continuam lá"

# ---------------------------------------------------------------------------
# 2. Escrever, e dizer que até à 0007 está tudo aplicado.
# ---------------------------------------------------------------------------
set +e
DATABASE_URL="$PSQL_URL" "$ROOT/scripts/conciliar-registo.sh" --escrever --aplicadas-ate 0007 >/dev/null 2>&1
codigo=$?
set -e
afirmar "$codigo" "0" "--escrever sai com 0"

esperado="$(for numero in 0001 0002 0003 0004 0005 0006 0007 0008; do
  printf '%s|%s\n' "$(carimbo "$numero")" "$(etiqueta "$numero")"
done)"
obtido="$("${PSQL[@]}" -c "select version || '|' || name from supabase_migrations.schema_migrations where name !~ 'nunca_existiu' order by version;")"
afirmar "$obtido" "$esperado" "depois de escrever, as oito primeiras têm o carimbo e a etiqueta do ficheiro, uma linha cada — a colisão resolvida na segunda passagem"

n="$("${PSQL[@]}" -c "select count(*) from supabase_migrations.schema_migrations where name = 'uma_migracao_que_nunca_existiu';")"
afirmar "$n" "1" "a linha órfã fica: apagá-la é decisão de uma pessoa"

n="$("${PSQL[@]}" -c "select count(*) from supabase_migrations.schema_migrations where name = '$(etiqueta 0010)';")"
afirmar "$n" "0" "acima de --aplicadas-ate, uma migração sem linha não ganha linha"

# ---------------------------------------------------------------------------
# 3. Apagada a órfã à mão, como o relatório manda, o registo está direito.
# ---------------------------------------------------------------------------
"${PSQL[@]}" -c "delete from supabase_migrations.schema_migrations where name = 'uma_migracao_que_nunca_existiu';"
set +e
DATABASE_URL="$PSQL_URL" "$ROOT/scripts/conciliar-registo.sh" >/dev/null 2>&1
codigo=$?
set -e
afirmar "$codigo" "0" "com o registo direito, o relatório sai com 0 (as migrações sem linha só se assinalam)"

# ---------------------------------------------------------------------------
# 4. Correr duas vezes não muda nada.
# ---------------------------------------------------------------------------
antes="$("${PSQL[@]}" -c "select string_agg(version || '|' || coalesce(name, ''), ',' order by version) from supabase_migrations.schema_migrations;")"
DATABASE_URL="$PSQL_URL" "$ROOT/scripts/conciliar-registo.sh" --escrever --aplicadas-ate 0007 >/dev/null 2>&1
depois="$("${PSQL[@]}" -c "select string_agg(version || '|' || coalesce(name, ''), ',' order by version) from supabase_migrations.schema_migrations;")"
afirmar "$depois" "$antes" "escrever outra vez é um não-acontecimento"

# ---------------------------------------------------------------------------
# 5. --sql imprime o SQL inteiro, com o relatório no fim, e não toca na base.
# ---------------------------------------------------------------------------
sql="$("$ROOT/scripts/conciliar-registo.sh" --sql --escrever --aplicadas-ate 0007)"
# Pela mesma razão da herestring lá em cima: o cano dava falso negativo.
if grep -q "select caso, versao, nome, ficheiro, acao from conciliacao_relatorio" <<< "$sql"; then
  echo "✓ --sql termina no relatório"
else
  echo "✗ --sql não termina no relatório"
  falhas=$((falhas + 1))
fi

# Deixar a base como estava: o registo não é deste ensaio.
"${PSQL[@]}" -c "delete from supabase_migrations.schema_migrations;"

if [ "$falhas" -gt 0 ]; then
  echo
  echo "✗ $falhas asserção(ões) falhada(s) no ensaio da conciliação do registo."
  exit 1
fi
echo
echo "✓ a conciliação do registo endireita o que estava torto e deixa o resto em paz"
