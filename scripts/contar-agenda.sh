#!/usr/bin/env bash
# Conta o que cada concelho tem marcado, de fora, uma vez por semana.
#
# A vigilância de hora a hora responde a «o sítio serve alguma coisa?»: basta
# um evento em toda a região para ela passar. A pergunta que ficava sem
# resposta era a seguinte, e é a que uma CIM faz — **e o meu concelho?**
#
# Há disjuntores por fonte e há um painel com a saúde de cada uma, mas uma
# fonte pode ser lida todas as noites com sucesso e trazer zero eventos porque
# a página da câmara mudou de forma: os erros ficam a zero, o disjuntor nunca
# abre, e o concelho desaparece da agenda sem um único sinal. A `/estado`
# mostra isso a quem lá for; isto é o que vai bater à porta sem ninguém
# perguntar.
#
# **De fora e pela API pública**, como o resto da vigilância: os números que
# saem daqui são os que quem integra a agenda vê, e não os que a base tem. Um
# concelho a zero por causa de uma cache envenenada é um concelho a zero para
# quem visita, e tem de aparecer aqui na mesma.
#
# Os concelhos vêm do mapa do sítio de cada região, e não de uma lista escrita
# aqui: um concelho novo entra neste relatório sem se tocar neste ficheiro — e,
# mais importante, um concelho que desapareça do mapa do sítio nunca fica a ser
# contado por engano a partir de uma lista velha.
#
# Sai 1 quando algum concelho está a zero. Semanal e não horário de propósito:
# a agenda de um concelho pequeno enche-se ao ritmo de dias, e um alarme diário
# sobre isto ensinava-se a ignorar em duas semanas.
set -euo pipefail

PLATAFORMA="${PLATAFORMA:?falta o endereço da plataforma (PLATAFORMA)}"
RELATORIO="${RELATORIO:-relatorio.md}"
zeros=0
: > "${RELATORIO}"

pedir() {
  curl --silent --location --max-time 20 \
    --user-agent 'Coreto (vigilancia; +https://coreto.org)' \
    --output corpo.tmp --write-out '%{http_code}' "$1" || echo 000
}

# insistir <url> — três tentativas, com pausa a crescer. Devolve o código.
#
# **Não é zelo, é uma falha medida.** A correr isto contra produção à mão, um
# dos treze pedidos veio `000` — nem chegou a ligar — e os dois seguintes ao
# mesmo endereço vieram 200 com o mesmo número. Sem repetir, aquele soluço de
# rede publicava «Tomar sem nada marcado» num relatório que alguém lê ao
# domingo. Um alarme semanal que mente uma vez por mês é um alarme que se
# aprende a ignorar, e depois não serve quando for verdade.
insistir() {
  local url=$1 codigo=000 tentativa
  for tentativa in 1 2 3; do
    codigo=$(pedir "${url}")
    [ "${codigo}" = 200 ] && break
    # Sem pausa depois da última: não há quarta tentativa à espera dela, e
    # onze concelhos a dormir em vão são minutos de execução por nada.
    [ "${tentativa}" -lt 3 ] && sleep $((tentativa * 5))
  done
  echo "${codigo}"
}

# quantos <origem> <concelho> — o total do concelho, ou vazio se não deu.
#
# `limit=1` porque não se quer a lista: quer-se o `total`, que a API devolve
# no mesmo envelope. Uma resposta por concelho, com o número exato, em vez de
# percorrer a paginação toda para contar linhas.
quantos() {
  local origem=$1 concelho=$2 codigo
  codigo=$(insistir "${origem}/api/events?municipality=${concelho}&limit=1")
  [ "${codigo}" = 200 ] || return 1
  jq --exit-status --raw-output '.total | numbers' corpo.tmp 2> /dev/null
}

codigo=$(insistir "${PLATAFORMA}/api/regioes")
if [ "${codigo}" != 200 ] || ! jq --exit-status 'type == "array"' corpo.tmp > /dev/null 2>&1; then
  echo "✗ ${PLATAFORMA}/api/regioes respondeu ${codigo} ou não trouxe uma lista"
  echo "- O mapa das regiões não respondeu: não há relatório esta semana." >> "${RELATORIO}"
  exit 1
fi
cp corpo.tmp mapa.json

while IFS=$'\t' read -r id dominio; do
  origem="https://${dominio}"
  echo "→ ${id} (${origem})"

  codigo=$(insistir "${origem}/sitemap.xml")
  if [ "${codigo}" != 200 ]; then
    echo "✗ ${id} — o mapa do sítio respondeu ${codigo}"
    echo "- **${id}**: o mapa do sítio respondeu ${codigo}; concelhos por contar." >> "${RELATORIO}"
    zeros=$((zeros + 1))
    continue
  fi

  # Os identificadores dos concelhos, do mapa do sítio e por ordem alfabética.
  concelhos=$(grep --only-matching '/concelho/[^<]*' corpo.tmp | sed 's|/concelho/||' | sort --unique)
  if [ -z "${concelhos}" ]; then
    echo "✗ ${id} — o mapa do sítio não traz um único concelho"
    echo "- **${id}**: o mapa do sítio não traz concelho nenhum." >> "${RELATORIO}"
    zeros=$((zeros + 1))
    continue
  fi

  total_da_regiao=0
  vazios=''
  linhas=''
  for concelho in ${concelhos}; do
    if ! quantidade=$(quantos "${origem}" "${concelho}"); then
      echo "  ✗ ${concelho} — a API não respondeu"
      linhas="${linhas}| ${concelho} | (sem resposta) |"$'\n'
      zeros=$((zeros + 1))
      continue
    fi
    echo "  ${concelho}: ${quantidade}"
    linhas="${linhas}| ${concelho} | ${quantidade} |"$'\n'
    total_da_regiao=$((total_da_regiao + quantidade))
    if [ "${quantidade}" -eq 0 ]; then
      vazios="${vazios}${vazios:+, }${concelho}"
      zeros=$((zeros + 1))
    fi
  done

  {
    echo "### ${id} — ${total_da_regiao} eventos por vir"
    echo
    if [ -n "${vazios}" ]; then
      echo "**Sem nada marcado: ${vazios}.**"
      echo
    fi
    echo '| Concelho | Por vir |'
    echo '| --- | ---: |'
    printf '%s' "${linhas}"
    echo
  } >> "${RELATORIO}"
done < <(jq --raw-output '.[] | [.id, .domain] | @tsv' mapa.json)

rm --force corpo.tmp mapa.json

echo
if [ "${zeros}" -gt 0 ]; then
  echo "${zeros} concelho(s) a zero ou por contar."
  exit 1
fi
echo 'Todos os concelhos com programação.'
