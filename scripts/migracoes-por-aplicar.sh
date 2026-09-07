#!/usr/bin/env bash
# O que o repositório traz e a base ainda não tem.
#
# **A pergunta que ninguém fazia, e o dia em que custou.** A 7 de setembro de
# 2026, duas vagas seguidas ficaram por publicar: o `main` levava as migrações
# 0128 e 0129, a base de produção estava no 0127, e o `next build` da Vercel
# rebentava a pré-gerar as páginas — «column events.wheelchair_accessible_
# resolved does not exist». O sítio nunca chegou a estar em baixo (a Vercel
# mantém o último build bom), e é isso que faz deste modo de falha um dos
# piores que há: **tudo continua a responder e nada é publicado**, durante o
# tempo que ninguém levar a olhar para a consola dos deploys.
#
# Nenhum dos portões podia ver isto, e vale a pena perceber porquê:
#
# - O trabalho «Migrações» do CI aplica **todas** as migrações a uma base
#   limpa. Uma base limpa está sempre em dia por construção, e por isso o
#   verde dele não diz nada sobre a base real.
# - O build de pré-visualização passa porque o anfitrião de pré-visualização
#   não é de região nenhuma: serve a montra, e a montra não pede a agenda.
# - A sonda externa (`vigiar-sitio.sh`) pergunta se o sítio responde, e o
#   sítio responde — com o build de antes.
#
# Faltava a pergunta simples: **a base tem o que o código vai pedir?** É esta.
#
# Corre contra qualquer base — a de produção pelo segredo da cópia de
# segurança, ou uma local. Não escreve nada e não lê uma única linha de dados:
# só a lista de migrações.
#
#   DATABASE_URL='postgresql://…' ./scripts/migracoes-por-aplicar.sh
#
# Sai 0 quando a base está em dia, 1 quando o repositório vai à frente, e 2
# quando a base vai à frente do repositório — que é outro problema e não o
# mesmo: quer dizer que alguém aplicou à mão o que não está aqui.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL — sem base para comparar." >&2
  echo "Ver docs/INFRAESTRUTURA.md, «Projeto que já existe, migrações novas»." >&2
  exit 1
fi

PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -tAq)

# Sem o registo não há pergunta a fazer, e a resposta certa não é o erro cru
# do Postgres — é dizer o que se está a olhar. Uma base sem
# `supabase_migrations` ou é um Postgres que nunca foi um projeto Supabase (a
# cadeia de ligação está trocada), ou é um projeto novo onde nada correu
# ainda, e as duas resolvem-se em sítios diferentes.
tem_registo="$("${PSQL[@]}" -c "select to_regclass('supabase_migrations.schema_migrations') is not null;")"
if [ "$tem_registo" != "t" ]; then
  echo "Esta base não tem registo de migrações (supabase_migrations.schema_migrations)." >&2
  echo >&2
  echo "Ou a cadeia de ligação não é a do projeto que se julga, ou é um projeto" >&2
  echo "novo onde nunca correu nada — e aí o que se corre é o provisionamento:" >&2
  echo >&2
  echo "  DATABASE_URL='postgresql://…' ./scripts/provision-supabase.sh" >&2
  exit 1
fi

# A identidade de uma migração é a **etiqueta** e não o carimbo de tempo: em
# produção há linhas cujo carimbo é o da hora a que correram, porque foram
# aplicadas pela API do Supabase. É a mesma regra de `aplicar-migracoes.sh`,
# e a razão está lá escrita por extenso.
registadas="$("${PSQL[@]}" -c "select name from supabase_migrations.schema_migrations where name is not null;" | sort)"

ficheiros=''
for file in "$ROOT"/supabase/migrations/*.sql; do
  nome="$(basename "$file" .sql)"
  ficheiros="${ficheiros}${nome#*_}"$'\n'
done
ficheiros="$(printf '%s' "$ficheiros" | sort)"

por_aplicar="$(comm -23 <(printf '%s\n' "$ficheiros") <(printf '%s\n' "$registadas") | grep -v '^$' || true)"
a_mais="$(comm -13 <(printf '%s\n' "$ficheiros") <(printf '%s\n' "$registadas") | grep -v '^$' || true)"

if [ -n "$a_mais" ]; then
  echo "A base tem migrações que o repositório não tem:"
  printf '  · %s\n' $a_mais
  echo
  echo "Alguém aplicou à mão o que não está aqui, ou o registo está torto."
  echo "Ver scripts/conciliar-registo.sh."
  exit 2
fi

if [ -z "$por_aplicar" ]; then
  echo "✓ a base está em dia com o repositório ($(printf '%s\n' "$ficheiros" | grep -c . ) migrações)"
  exit 0
fi

quantas="$(printf '%s\n' "$por_aplicar" | grep -c .)"
echo "✗ ${quantas} migração(ões) no repositório que a base não tem:"
printf '  · %s\n' $por_aplicar
echo
echo "Enquanto isto durar, um deploy do código que as pede rebenta a pré-gerar"
echo "as páginas — e o sítio fica a servir o build anterior sem ninguém dar por"
echo "isso. Aplica antes de fundir:"
echo
echo "  DATABASE_URL='postgresql://…' ./scripts/aplicar-migracoes.sh"
exit 1
