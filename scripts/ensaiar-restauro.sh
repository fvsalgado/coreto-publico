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
# `anon` para ler eventos e não ver uma linha da fila de moderação. Essa última faltou
# durante meses, e era a que separava «a cópia está inteira» de «a cópia
# funciona»: com `--no-privileges` dos dois lados, a base saía daqui sem uma
# única concessão e o ensaio dava verde na mesma. Esse flag saiu dos dois
# lados a 15 de setembro de 2026; a cópia leva hoje o modelo de permissões
# dentro, e este ensaio exige que ele venha.
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
trap 'rm --force coreto.dump frase.txt indice-sem-mobilia.txt' EXIT

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
# 3. O que a cópia não traz, porque vive fora de `public`.
#
# A cópia é `pg_dump --schema=public`. Tudo o que o produto precisa e que mora
# noutro esquema fica de fora, e tem de ser reposto aqui para que o que se
# verifica a seguir seja um sistema e não meia base:
#
#   - os papéis e esquemas que um projeto Supabase tem de fábrica
#     (`scripts/supabase-prelude.sql`);
#   - as três extensões da migração 0001, que vivem em `extensions`;
#   - **a configuração do `storage`** — os baldes `media` e `intake` e a
#     política que só deixa ler o tratado.
#
# O terceiro só se descobriu a 15 de setembro de 2026, e só porque o ensaio
# chegou pela primeira vez às `schema-checks` com a base já restaurada: a
# asserção dos prazos de conservação tenta pôr um anexo no balde `intake` e
# rebentou com `Key (bucket_id)=(intake) is not present in table "buckets"`.
# A cópia tinha os dados todos e a base restaurada não tinha onde guardar um
# cartaz. **É isto que um restauro a sério tem de fazer também**, e está
# escrito em docs/BACKUPS.md.
#
# Descoberto, não escrito à mão. Aqui esteve a lição mais cara desta casa: uma
# asserção que vigiava o nome `0128_as_concessoes_de_leitura_escritas.sql` deu
# verde durante uma semana a um passo partido. Por isso não se nomeia migração
# nenhuma — procuram-se as instruções que escrevem no `storage`, ancoradas na
# coluna zero como todas as outras, e a próxima migração que crie um balde
# entra sozinha.
# ---------------------------------------------------------------------------
"${PSQL[@]}" -f "$ROOT/scripts/supabase-prelude.sql"
"${PSQL[@]}" <<'SQL'
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
SQL

mobilia="$(
  cat "$ROOT"/supabase/migrations/*.sql \
    | perl -0777 -ne 'while (/^((?:insert\s+into\s+storage\.|create\s+policy\b[^;]*?\bon\s+storage\.)[^;]*;)/gmi) { print "$1\n" }'
)"
n_mobilia="$(printf '%s' "$mobilia" | grep -c ';' || true)"
[ "${n_mobilia:-0}" -gt 0 ] \
  || falhar 'Não se encontrou uma única instrução que configure o storage. O extrator deixou de casar, e a base restaurada ficaria sem baldes.'
printf '%s\n' "$mobilia" | "${PSQL[@]}" >/dev/null \
  || falhar 'A configuração do storage não aplicou sobre a base restaurada.'
anotar "Reposto o que vive fora de \`public\`: papéis, extensões e a configuração do storage (${n_mobilia} instruções)."

# ---------------------------------------------------------------------------
# 4. Restaurar — com os privilégios, e sem a mobília do Supabase.
#
# `--exit-on-error`: um restauro a meio, com erros pelo meio, é a pior notícia
# possível disfarçada de sucesso.
#
# **A cópia traz agora o modelo de permissões**, e este restauro repõe-no. Até
# 15 de setembro de 2026 os dois lados corriam com `--no-privileges`, e a base
# que saía daqui tinha os dados todos e zero concessões: inteira e inútil, com
# o papel `anon` sem conseguir contar um evento. Tentou-se compensar aqui,
# reexecutando as instruções `grant` e `revoke` das migrações, e não há maneira
# de o fazer: a 0102 revoga numa `set_site_section` de quatro argumentos, a
# 0109 redefiniu-a com cinco, e a história refere-se aos objetos como eles
# eram, não como estão. Corrigiu-se onde era, que é no `pg_dump`.
#
# **E filtra-se a mobília.** Um `pg_dump --schema=public` de um projeto
# Supabase leva lá dentro os privilégios por omissão do próprio Supabase:
#
#     ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public …
#
# Não são nossos, não dizem respeito a nenhum objeto restaurado — os
# privilégios por omissão só valem para o que se criar **depois** — e um
# projeto Supabase novo já os tem de fábrica. Trazê-los custa caro das duas
# maneiras: aqui, obrigava a inventar um papel `supabase_admin` que este
# Postgres não tem; e no dia do restauro a sério, obrigava a ser
# superutilizador. Medido em produção: o papel `postgres` do Supabase não é
# superutilizador nem membro de `supabase_admin`, e reproduzido em local o erro
# é `permission denied to change default privileges`. Filtradas, o restauro
# passa feito por um papel comum — que é quem o vai fazer.
#
# O índice é o do próprio ficheiro: `pg_restore --list` escreve-o, tira-se-lhe
# as linhas cujo tipo é `DEFAULT ACL`, e `--use-list` restaura o resto. O
# padrão está ancorado no formato do índice — `id; oid oid TIPO …` — para que
# um objeto que por acaso se chame assim não desapareça com ele.
# ---------------------------------------------------------------------------
pg_restore --list coreto.dump \
  | grep -vE '^[0-9]+; [0-9]+ [0-9]+ DEFAULT ACL ' > indice-sem-mobilia.txt

pg_restore --dbname "$DATABASE_URL" --no-owner --schema=public --exit-on-error \
  --use-list indice-sem-mobilia.txt coreto.dump \
  || falhar 'O pg_restore parou num erro (ver acima).'
anotar "Restaurada em $((SECONDS - inicio)) s."

# ---------------------------------------------------------------------------
# 4b. A cópia trouxe as concessões?
#
# Se veio uma cópia tirada antes de 15 de setembro de 2026, ou se alguém puser
# outra vez o `--no-privileges` no `backup.yml`, o que se restaura aqui tem os
# dados e não tem permissões. A verificação (d) apanharia isso na mesma — o
# `anon` não leria uma linha —, mas diria «a cópia restaurada não serviria o
# sítio», que é o sintoma. Aqui diz-se a causa, que é o que falta saber às
# três da manhã.
#
# As revogações não se contam aqui: quem as apanha são as `schema-checks`, que
# reprovam com «funções security definer ao alcance do anon» se a base
# restaurada ficar mais aberta do que a de produção. Foi assim que se apanhou,
# na segunda tentativa, uma reposição que só trouxe metade dos privilégios.
# ---------------------------------------------------------------------------
concessoes="$("${PSQL[@]}" -tAc "
  select count(*) from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated');
")"
[ "${concessoes:-0}" -gt 0 ] \
  || falhar "A cópia de ${dia_da_copia} veio sem uma única concessão a anon ou authenticated: foi tirada com --no-privileges. Uma cópia sem o modelo de permissões repõe os dados numa base que o sítio não consegue ler. Ver .github/workflows/backup.yml."
anotar "A cópia trouxe o modelo de permissões (${concessoes} concessões a \`anon\`/\`authenticated\`)."

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
# `anon` prova que as concessões vieram na cópia; não ver uma linha da fila de
# moderação prova que o que veio não abriu o que devia continuar fechado — que
# seria a forma óbvia de fazer a primeira passar.
"${PSQL[@]}" <<'SQL' >/dev/null || falhar 'A base restaurada não tem os papéis do Supabase (ver o prelúdio).'
select 1 from pg_roles where rolname = 'anon';
SQL

eventos_como_anon="$("${PSQL[@]}" -tAc "
  set local role anon;
  select count(*) from public.events;
")" || falhar 'Como anon, a leitura de eventos foi recusada: a cópia restaurada não serviria o sítio.'
[ "${eventos_como_anon:-0}" -gt 0 ] \
  || falhar "Como anon, a base restaurada devolve ${eventos_como_anon:-0} eventos. Com a RLS a valer e as concessões que vieram na cópia, o sítio serviria uma agenda vazia."
anotar "Como \`anon\`, a base restaurada devolve ${eventos_como_anon} eventos publicados."

# E a segunda pergunta é sobre LINHAS, não sobre permissão.
#
# Aqui esteve escrito que a leitura de `submissions` como `anon` tinha de ser
# **recusada**, e que se não fosse era porque a reposição das concessões tinha
# aberto o que devia continuar fechado. Estava errado, e esteve verde meses
# porque a base contra a qual corria tinha os privilégios mal repostos — o
# `anon` não tinha lá a concessão de leitura porque a reposição não a punha, e
# não porque a produção não a tenha.
#
# A produção tem-na. É mobília do Supabase: o privilégio por omissão do projeto
# concede `select` a `anon` em todas as tabelas novas criadas pelo `postgres` em
# `public`, e `submissions` nasceu com ele. **O que fecha a fila de moderação
# não é a falta da concessão; é a RLS**, ligada e sem uma única política — e é
# exatamente assim que as `schema-checks` a vigiam, contando políticas que
# exponham as tabelas internas ao público, não concessões.
#
# Medido em produção a 15 de setembro de 2026, com o papel `anon`:
# `submissions` 0 linhas, `submission_attachments` 0, `admin_actions` 0,
# `events` 222.
#
# Por isso pergunta-se o que interessa: **quantas linhas vê quem passa.** Zero,
# venha isso de uma recusa à entrada ou de a RLS negar todas. Assim apanha-se o
# que a versão antiga não apanhava — alguém desligar a RLS de `submissions`, ou
# acrescentar-lhe uma política permissiva —, que é quando os endereços e os
# hashes de IP de quem submeteu ficam à vista. Provado num Postgres local sobre
# a tabela verdadeira: com a RLS ligada vem 0, desligada vem a linha, e sem a
# concessão vem a recusa.
fila_como_anon="$("${PSQL[@]}" -tAc "set local role anon; select count(*) from public.submissions;" 2>/dev/null)" \
  || fila_como_anon='recusado'
if [ "$fila_como_anon" = 'recusado' ]; then
  anotar 'Como `anon`, a fila de moderação é recusada à entrada: nem a concessão de leitura existe.'
else
  [ "$fila_como_anon" = '0' ] \
    || falhar "Como anon, a fila de moderação devolveu ${fila_como_anon} linhas. A RLS de public.submissions deixou de negar — desligada, ou com uma política permissiva. É a fila inteira, com os endereços e os hashes de IP de quem submeteu."
  anotar 'Como `anon`, a fila de moderação devolve zero linhas: a RLS nega todas.'
fi

duracao=$((SECONDS - inicio))
anotar "**Restaurada e verificada em ${duracao} s.**"
echo
echo "✓ a cópia restaura, serve-se como anon e passa nas quatro verificações (${duracao} s)"
