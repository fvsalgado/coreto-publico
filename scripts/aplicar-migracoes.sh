#!/usr/bin/env bash
# Aplica as migrações que ainda faltam a uma base que já tem as anteriores.
#
# O `provision-supabase.sh` serve para um projeto novo e recusa-se a correr
# sobre uma base com tabelas — o que está certo, porque apontar a cadeia de
# ligação ao projeto errado com um comando que aplica dezenas de migrações
# custa caro. Mas deixava um buraco: não havia maneira de aplicar as **novas**
# ao projeto que já existe, e a alternativa era correr os ficheiros à mão e não
# esquecer nenhum.
#
# Uso:
#   DATABASE_URL='postgresql://…' ./scripts/aplicar-migracoes.sh
#
# Não é preciso dizer até onde a base já está: o registo é o mesmo que o
# Supabase mantém (`supabase_migrations.schema_migrations`), por isso o script,
# o CLI do Supabase e o painel concordam sempre sobre o que correu. Um registo
# próprio, paralelo a esse, seria uma segunda verdade à espera de discordar da
# primeira.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL. Ver o cabeçalho deste ficheiro." >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)

# ---------------------------------------------------------------------------
# O registo.
#
# Num projeto Supabase já existe e já está preenchido. Num Postgres nu — o do
# CI, o de quem corre isto localmente — é criado aqui, com a mesma forma, para
# que o script se comporte igual nos dois sítios.
#
# A tabela dos resumos é à parte, e de propósito. A do Supabase responde a «que
# migrações correram»; esta responde a «o ficheiro ainda é o que correu». São
# perguntas diferentes, e misturá-las numa coluna que já tem outro significado
# seria pedir que alguém a interpretasse mal daqui a um ano.
# ---------------------------------------------------------------------------
"${PSQL[@]}" <<'SQL'
create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

create table if not exists public.migration_checksums (
  -- O nome estável da migração (`0023_ourem_api`), não o carimbo de tempo: é
  -- o carimbo que difere entre o repositório e quem a aplicou.
  version  text primary key,
  checksum text not null,
  seen_at  timestamptz not null default now()
);

comment on table public.migration_checksums is
  'O resumo de cada ficheiro de migração no momento em que foi aplicado. As '
  'migrações são história e não se reescrevem: uma linha aqui a discordar do '
  'ficheiro quer dizer que alguém o editou depois de aplicado.';

-- Esta tabela nasce aqui e não numa migração, e por isso escapou durante muito
-- tempo à regra das outras tabelas de serviço: ficou no esquema `public` — que
-- é o que o PostgREST serve — sem RLS e com `select` concedido ao `anon`. A
-- 0134 endireitou-a na base que já existe; isto endireita-a no minuto zero de
-- uma base nova, que é antes de a 0134 sequer correr.
alter table public.migration_checksums enable row level security;
revoke all on table public.migration_checksums from anon, authenticated;
SQL

soma() {
  sha256sum "$1" | cut -d' ' -f1
}

aplicadas=0
saltadas=0

for file in "$ROOT"/supabase/migrations/*.sql; do
  nome="$(basename "$file" .sql)"
  # `20260828080000_0023_ourem_api` → versão `20260828080000`, nome `0023_ourem_api`
  versao="${nome%%_*}"
  etiqueta="${nome#*_}"
  atual="$(soma "$file")"

  # ---------------------------------------------------------------------
  # A identidade de uma migração é o **nome**, não o carimbo de tempo.
  #
  # Quem aplicou estas em produção não foi este script: foi a API do Supabase,
  # que gera o seu próprio `version` no momento em que corre. Em produção a
  # `0020` está registada como `20260827153036` e no repositório o ficheiro
  # chama-se `20260827092000_0020_…` — o mesmo trabalho, dois carimbos.
  #
  # Casar pelo carimbo dava uma reaplicação de tudo o que já lá está, que é o
  # pior resultado possível para um script cujo trabalho é não repetir nada.
  # O `0020_anotar_intencao_e_limpar_avisos` é igual dos dois lados.
  # ---------------------------------------------------------------------
  corrida="$("${PSQL[@]}" -tAc \
    "select 1 from supabase_migrations.schema_migrations
      where name = '$etiqueta' or version = '$versao' limit 1;")"

  if [ -n "$corrida" ]; then
    registado="$("${PSQL[@]}" -tAc \
      "select checksum from public.migration_checksums where version = '$etiqueta';")"

    if [ -n "$registado" ] && [ "$registado" != "$atual" ]; then
      echo "✗ $nome.sql foi editada depois de aplicada." >&2
      echo "  As migrações são história e não se reescrevem: o que está na base" >&2
      echo "  e o que está no repositório deixaram de ser a mesma coisa." >&2
      echo "  Corrige com uma migração nova, não editando esta." >&2
      exit 1
    fi

    # Migração aplicada antes de este script existir: fica com resumo a partir
    # de agora, para que a verificação valha da próxima vez.
    if [ -z "$registado" ]; then
      "${PSQL[@]}" -c "insert into public.migration_checksums (version, checksum)
                       values ('$etiqueta', '$atual') on conflict (version) do nothing;"
    fi

    saltadas=$((saltadas + 1))
    continue
  fi

  echo "→ $nome.sql"
  # Cada migração numa transação só: uma que rebente a meio não deixa metade do
  # esquema aplicado e a outra metade por aplicar. Nenhuma das que existem usa
  # comandos que não possam correr dentro de uma transação — foi verificado.
  "${PSQL[@]}" --single-transaction \
    -f "$file" \
    -c "insert into supabase_migrations.schema_migrations (version, name)
        values ('$versao', '$etiqueta') on conflict (version) do nothing;" \
    -c "insert into public.migration_checksums (version, checksum)
        values ('$etiqueta', '$atual') on conflict (version) do update set checksum = excluded.checksum;"
  aplicadas=$((aplicadas + 1))
done

echo
echo "→ asserções sobre o esquema e os seeds"
"${PSQL[@]}" -f "$ROOT/scripts/schema-checks.sql"

echo
echo "✓ $aplicadas aplicadas, $saltadas já lá estavam"
