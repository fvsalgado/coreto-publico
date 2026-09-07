#!/usr/bin/env bash
# Ensaio de restauro de uma cópia de segurança.
#
# «Uma cópia que nunca foi restaurada não é uma cópia de segurança: é uma
# esperança» — docs/BACKUPS.md. Isto tira a esperança do meio. Vai buscar a
# cópia mais recente ao balde, decifra-a, restaura-a num Postgres limpo e faz
# as quatro verificações do manual: o esquema e os seeds estão inteiros (as
# schema-checks), as tabelas que importam têm linhas, a cópia é fresca — a de
# hoje ou a de ontem, com eventos vistos pela recolha há poucos dias — e a
# base restaurada **serve-se como o sítio se serve**, ligando-se pelo papel
# `anon` para ler eventos e ser recusada em `submissions`. Essa última faltou
# durante meses, e era a que separava «a cópia está inteira» de «a cópia
# funciona»: com `--no-privileges` dos dois lados, a base saía daqui sem uma
# única concessão e o ensaio dava verde na mesma.
#
# No fim escreve `relatorio.md`: a data, a cópia, quanto pesou, quanto tempo
# demorou. O tempo interessa: é a resposta a «quanto tempo estamos em baixo»
# no dia em que a pergunta for a sério.
#
# Corre todos os meses em `.github/workflows/restauro.yml`, num Postgres da
# versão do servidor, e à mão:
#
#   DATABASE_URL='postgresql://…um Postgres VAZIO…' \
#   BACKUP_S3_BUCKET=… BACKUP_S3_ENDPOINT=… \
#   AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… BACKUP_PASSPHRASE=… \
#   ./scripts/ensaiar-restauro.sh
#
#   COPIA=diarias/coreto-20260901.dump.gpg   escolhe a cópia; a omissão é a mais recente de diarias/
#   COPIA_LOCAL=/caminho/coreto-20260901.dump.gpg   salta o balde: um ficheiro já descarregado
#
# Nunca aponta à base de produção. Recusa-se a restaurar numa base que já
# tenha tabelas: é um ensaio, e um ensaio que apaga o que quer que seja
# deixou de o ser.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELATORIO="${RELATORIO:-relatorio.md}"
inicio=$SECONDS

{
  echo "## Ensaio de restauro — $(date --utc --iso-8601=minutes)"
  echo
} > "$RELATORIO"

anotar() {
  echo "· $1"
  echo "- $1" >> "$RELATORIO"
}

falhar() {
  echo "✗ $1" >&2
  echo "- ✗ **$1**" >> "$RELATORIO"
  exit 1
}

# O dump decifrado nunca fica na máquina, corra isto bem ou mal.
trap 'rm --force coreto.dump frase.txt' EXIT

[ -n "${DATABASE_URL:-}" ] || falhar 'Falta DATABASE_URL: o Postgres vazio onde restaurar.'
PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -q)

# ---------------------------------------------------------------------------
# A base tem de estar vazia. Não é conforto: é o que impede que uma cadeia de
# ligação trocada faça deste ensaio um restauro por cima de produção.
# ---------------------------------------------------------------------------
tabelas="$("${PSQL[@]}" -tAc "select count(*) from pg_tables where schemaname = 'public';")"
[ "$tabelas" = "0" ] \
  || falhar "A base em DATABASE_URL já tem ${tabelas} tabelas em public. Um ensaio restaura numa base vazia, nunca por cima de nada."

# ---------------------------------------------------------------------------
# 1. A cópia.
# ---------------------------------------------------------------------------
escolhida_pelo_script=false
if [ -n "${COPIA_LOCAL:-}" ]; then
  ficheiro="$COPIA_LOCAL"
  origem="ficheiro local $(basename "$ficheiro")"
else
  em_falta=''
  for nome in BACKUP_S3_BUCKET BACKUP_S3_ENDPOINT AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY BACKUP_PASSPHRASE; do
    [ -n "${!nome:-}" ] || em_falta="${em_falta} ${nome}"
  done
  [ -z "$em_falta" ] || falhar "Falta configurar:${em_falta} — ver docs/BACKUPS.md."

  if [ -z "${COPIA:-}" ]; then
    # A mais recente de diarias/: os nomes levam a data, e a data ordena.
    ultima="$(aws s3 ls "s3://${BACKUP_S3_BUCKET}/diarias/" --endpoint-url "$BACKUP_S3_ENDPOINT" \
      | awk '{print $4}' | grep -E '^coreto-[0-9]{8}\.dump\.gpg$' | sort | tail -1 || true)"
    [ -n "$ultima" ] || falhar 'Não há nenhuma cópia em diarias/. A cópia diária nunca correu, ou o balde não é este.'
    COPIA="diarias/${ultima}"
    escolhida_pelo_script=true
  fi
  ficheiro="$(basename "$COPIA")"
  aws s3 cp "s3://${BACKUP_S3_BUCKET}/${COPIA}" "$ficheiro" --endpoint-url "$BACKUP_S3_ENDPOINT" --quiet
  origem="s3://${BACKUP_S3_BUCKET}/${COPIA}"
fi

data_da_copia="$(basename "$ficheiro" | sed -n 's/^coreto-\([0-9]\{8\}\)\.dump\.gpg$/\1/p')"
[ -n "$data_da_copia" ] || falhar "O nome da cópia não é coreto-AAAAMMDD.dump.gpg: $(basename "$ficheiro")."
dia_da_copia="${data_da_copia:0:4}-${data_da_copia:4:2}-${data_da_copia:6:2}"
anotar "Cópia: ${origem}, de ${dia_da_copia}, com $(du -h "$ficheiro" | cut -f1)."

# A mais recente tem de ser de hoje ou de ontem. Se não é, a cópia diária
# parou de correr — e uma cópia que parou passa em todas as outras
# verificações, porque o que se restaura está inteiro; só é velho.
if [ "$escolhida_pelo_script" = true ]; then
  hoje="$(date --utc +%Y-%m-%d)"
  idade=$(( ( $(date --utc -d "$hoje" +%s) - $(date --utc -d "$dia_da_copia" +%s) ) / 86400 ))
  [ "$idade" -le 2 ] \
    || falhar "A cópia mais recente tem ${idade} dias. A cópia diária parou de correr: ver .github/workflows/backup.yml."
  anotar "A cópia mais recente tem ${idade} dia(s): a cópia diária está a correr."
fi

# ---------------------------------------------------------------------------
# 2. Decifrar.
# ---------------------------------------------------------------------------
[ -n "${BACKUP_PASSPHRASE:-}" ] || falhar 'Falta BACKUP_PASSPHRASE.'
printf '%s' "$BACKUP_PASSPHRASE" > frase.txt
gpg --batch --quiet --decrypt --passphrase-file frase.txt --output coreto.dump "$ficheiro" \
  || falhar 'Não decifrou. A frase não é a que cifrou esta cópia — e uma cópia que não se decifra não é cópia nenhuma.'
shred --remove frase.txt
anotar 'Decifrada.'

# ---------------------------------------------------------------------------
# 3. O que a cópia não traz: os papéis e esquemas que o Supabase tem de
#    fábrica, e as extensões, que vivem fora de `public` e por isso ficam de
#    fora de um dump só desse esquema. As três são as da migração 0001.
# ---------------------------------------------------------------------------
"${PSQL[@]}" -f "$ROOT/scripts/supabase-prelude.sql"
"${PSQL[@]}" <<'SQL'
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
SQL

# ---------------------------------------------------------------------------
# 4. Restaurar. `--exit-on-error`: um restauro a meio, com erros pelo meio,
#    é a pior notícia possível disfarçada de sucesso.
# ---------------------------------------------------------------------------
pg_restore --dbname "$DATABASE_URL" --no-owner --no-privileges --schema=public --exit-on-error coreto.dump \
  || falhar 'O pg_restore parou num erro (ver acima).'
anotar "Restaurada em $((SECONDS - inicio)) s."

# ---------------------------------------------------------------------------
# 4b. As concessões, que a cópia não traz e sem as quais o sítio não serve
#     uma linha.
#
# O `pg_dump` da cópia corre com `--no-privileges` e este restauro também: a
# base que sai daqui tem os dados todos e **zero** concessões a `anon`. Este
# ensaio passava por cima disso durante meses, porque tudo o que verificava —
# o esquema, as linhas, a frescura — estava certo. No dia do restauro a sério,
# a agenda estava toda lá e o sítio respondia vazio a tudo.
#
# A migração 0128 é o que repõe as concessões, e é reaplicável de propósito.
# Corrê-la aqui é ensaiar o restauro inteiro, e não meio: a cópia mais o passo
# que a torna servível. Se ela desaparecer ou deixar de conceder, as duas
# verificações a seguir reprovam.
# ---------------------------------------------------------------------------
CONCESSOES="$ROOT/supabase/migrations/20260907120000_0128_as_concessoes_de_leitura_escritas.sql"
[ -f "$CONCESSOES" ] \
  || falhar 'Falta a migração das concessões (0128). Sem ela, uma base restaurada não serve o sítio.'
"${PSQL[@]}" -f "$CONCESSOES" >/dev/null \
  || falhar 'A migração das concessões não aplicou sobre a base restaurada.'
anotar 'As concessões de leitura repostas (migração 0128).'

# ---------------------------------------------------------------------------
# 5. As verificações do manual.
# ---------------------------------------------------------------------------
# (a) O esquema e os seeds estão inteiros: as mesmas asserções que o CI faz a
#     uma base construída do repositório, agora sobre a que veio da cópia.
"${PSQL[@]}" -f "$ROOT/scripts/schema-checks.sql" >/dev/null \
  || falhar 'As schema-checks reprovaram a base restaurada.'
anotar 'As schema-checks passaram sobre a base restaurada.'

# (b) As tabelas que importam têm linhas. As contagens vão para o relatório,
#     para se compararem com a base real à mão; aqui só se exige que o que
#     nunca pode estar vazio não esteja.
contagens="$("${PSQL[@]}" -tA -F '|' <<'SQL'
select 'regions', count(*) from public.regions
union all select 'municipalities', count(*) from public.municipalities
union all select 'venues', count(*) from public.venues
union all select 'coretos', count(*) from public.coretos
union all select 'series', count(*) from public.series
union all select 'sources', count(*) from public.sources
union all select 'events', count(*) from public.events
union all select 'event_sessions', count(*) from public.event_sessions
union all select 'submissions', count(*) from public.submissions
union all select 'manual_overrides', count(*) from public.manual_overrides
union all select 'admin_actions', count(*) from public.admin_actions;
SQL
)"
{
  echo
  echo '| Tabela | Linhas |'
  echo '| --- | ---: |'
  printf '%s\n' "$contagens" | awk -F '|' '{ printf "| `%s` | %s |\n", $1, $2 }'
  echo
} >> "$RELATORIO"
printf '%s\n' "$contagens" | awk -F '|' '{ printf "  %-18s %s\n", $1, $2 }'
for tabela in regions municipalities venues sources events; do
  n="$(printf '%s\n' "$contagens" | awk -F '|' -v t="$tabela" '$1 == t { print $2 }')"
  [ "${n:-0}" -gt 0 ] || falhar "A tabela ${tabela} veio vazia da cópia."
done
anotar 'As tabelas que nunca podem estar vazias têm linhas.'

# (c) A cópia é de uma base viva: o evento visto mais recentemente pela
#     recolha é de poucos dias antes da cópia. Uma base cuja recolha morreu
#     há um mês restaura-se na perfeição — e é isso que aqui se apanha.
ultimo="$("${PSQL[@]}" -tAc "select coalesce(greatest(max(last_seen_at), max(updated_at))::date::text, '') from public.events;")"
[ -n "$ultimo" ] || falhar 'Nenhum evento tem data de última leitura.'
folga=$(( ( $(date --utc -d "$dia_da_copia" +%s) - $(date --utc -d "$ultimo" +%s) ) / 86400 ))
[ "$folga" -le 3 ] \
  || falhar "O evento visto mais recentemente é de ${ultimo}, ${folga} dias antes da cópia: a recolha tinha parado quando a cópia foi tirada."
anotar "O evento visto mais recentemente é de ${ultimo}, ${folga} dia(s) antes da cópia."

# (d) A cópia restaurada serve o sítio.
#
# As três de cima olham para os dados; esta liga-se como o sítio se liga. É a
# diferença entre «a cópia está inteira» e «a cópia funciona», e era esta que
# faltava: durante meses o ensaio deu verde sobre uma base onde o papel `anon`
# não conseguia contar um evento.
#
# Duas perguntas, e as duas têm de dar a resposta certa. Ler os eventos como
# `anon` prova que as concessões estão lá; ser recusado em `submissions` prova
# que a reposição das concessões não abriu a fila de moderação ao público de
# passagem — que seria a forma óbvia de fazer a primeira passar.
"${PSQL[@]}" <<'SQL' >/dev/null || falhar 'A base restaurada não tem os papéis do Supabase (ver o prelúdio).'
select 1 from pg_roles where rolname = 'anon';
SQL

eventos_como_anon="$("${PSQL[@]}" -tAc "
  set local role anon;
  select count(*) from public.events;
")" || falhar 'Como anon, a leitura de eventos foi recusada: a cópia restaurada não serviria o sítio.'
[ "${eventos_como_anon:-0}" -gt 0 ] \
  || falhar "Como anon, a base restaurada devolve ${eventos_como_anon:-0} eventos. Com a RLS a valer e as concessões repostas, o sítio serviria uma agenda vazia."
anotar "Como \`anon\`, a base restaurada devolve ${eventos_como_anon} eventos publicados."

if "${PSQL[@]}" -tAc "set local role anon; select count(*) from public.submissions;" >/dev/null 2>&1; then
  falhar 'Como anon, a fila de moderação é legível. As concessões repostas abriram o que devia continuar fechado.'
fi
anotar 'Como `anon`, a fila de moderação continua recusada.'

duracao=$((SECONDS - inicio))
anotar "**Restaurada e verificada em ${duracao} s.**"
echo
echo "✓ a cópia restaura, serve-se como anon e passa nas quatro verificações (${duracao} s)"
