#!/usr/bin/env bash
# O resumo diário do que está por rever, por região.
#
# O painel responde a tudo isto, e responde bem. O problema é que responde a
# quem lá vai. Uma submissão de um evento que acontece amanhã fica na fila
# exatamente igual a uma de um evento de dezembro, e a diferença entre as duas
# é que uma delas deixa de valer alguma coisa depois de amanhã.
#
# **Não envia nada quando não há nada a fazer.** É a regra que a
# `agenda-semanal.yml` argumenta para si própria ao ser semanal: um aviso
# diário sobre uma fila vazia aprende-se a ignorar em duas semanas, e aí deixa
# de servir também nos dias em que havia alguma coisa. A saída a zero e o
# silêncio são o caso normal.
#
# Sem `NTFY_URL` configurada escreve na saída e sai a zero, como o
# `avisar.sh` — e pela mesma razão: um passo que faz falhar a execução por não
# estar configurado ensina toda a gente a ignorar o vermelho.
#
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   obrigatórias
#   REGIOES             lista separada por espaços (omissão: medio-tejo)
#   DIAS_NA_FILA        a partir de quantos dias uma submissão é «parada» (3)
#   DIAS_DE_PRAZO       antecedência do aviso das licenças, em dias (30)
set -euo pipefail

REGIOES="${REGIOES:-medio-tejo}"
DIAS_NA_FILA="${DIAS_NA_FILA:-3}"
DIAS_DE_PRAZO="${DIAS_DE_PRAZO:-30}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "::notice::Sem credenciais da base — resumo saltado."
  exit 0
fi

# Um ficheiro por região, para o caso de haver várias e uma delas falhar: uma
# região sem resposta não pode calar o resumo das outras.
falhas=0
enviados=0

for regiao in ${REGIOES}; do
  resposta="$(curl --silent --show-error --fail --max-time 30 \
    --request POST "${SUPABASE_URL}/rest/v1/rpc/daily_digest" \
    --header "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    --header 'Content-Type: application/json' \
    --data "{\"p_region\":\"${regiao}\",\"p_dias_na_fila\":${DIAS_NA_FILA},\"p_dias_de_prazo\":${DIAS_DE_PRAZO}}" \
    )" || {
      echo "::warning::Não deu para ler o resumo de ${regiao}."
      falhas=$((falhas + 1))
      continue
    }

  echo "${resposta}" > "resumo-${regiao}.json"

  # O corpo é montado em `node` e não em `jq`: o `jq` não está garantido no
  # executor, e o `node` está — é o que corre a recolha inteira.
  #
  # O `|| { … continue; }` não é zelo a mais: uma resposta ilegível faz o
  # `.mjs` sair a um, e com `set -e` isso matava o resumo das outras regiões.
  # «Não consegui ler» é uma falha, e conta-se como tal — não é «não há nada».
  corpo="$(printf '%s' "${resposta}" | node "${RAIZ}/scripts/resumo-diario.mjs")" || {
    echo "::warning::Resposta ilegível da base para ${regiao}."
    falhas=$((falhas + 1))
    continue
  }

  if [ -z "${corpo}" ]; then
    echo "${regiao}: nada por fazer, nada enviado."
    continue
  fi

  echo "${regiao}:"
  echo "${corpo}"
  enviados=$((enviados + 1))

  if [ -z "${NTFY_URL:-}" ]; then
    echo "::notice::Sem NTFY_URL configurada: o resumo fica só aqui."
    continue
  fi

  printf '%s' "${corpo}" > "corpo-${regiao}.txt"
  # Prioridade baixa de propósito: isto é uma lista de trabalho, não uma
  # avaria. O `avisar.sh` marca-a com `rotating_light` e prioridade `high` para
  # o que se parte; um resumo do que está por rever com o mesmo peso de um
  # alarme de sítio em baixo faz os dois valerem o mesmo.
  NTFY_URL="${NTFY_URL}" NTFY_TOKEN="${NTFY_TOKEN:-}" \
    bash "${RAIZ}/scripts/avisar.sh" "Coreto · ${regiao}: por rever" low "corpo-${regiao}.txt"
done

echo "Regiões com trabalho por fazer: ${enviados}. Falhas de leitura: ${falhas}."
# Uma falha de leitura é uma avaria de verdade: quer dizer que hoje ninguém
# sabe o que está na fila. O resumo vazio, esse, sai a zero.
[ "${falhas}" -eq 0 ]
