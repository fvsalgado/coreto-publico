#!/usr/bin/env bash
# Manda um aviso para o telemóvel de quem está de serviço.
#
# Até aqui, o único canal de alerta eram issues do GitHub: a vigilância abria
# um, a recolha abria outro, e as cópias de segurança não abriam nada — falhavam
# caladas, que é a pior maneira de uma cópia de segurança falhar. Um issue é bom
# registo e péssimo alarme: fica à espera de que alguém abra o separador, e às
# três da manhã ninguém abre.
#
# O issue continua a ser aberto onde já era — é ele que guarda o histórico e se
# fecha sozinho quando as coisas voltam ao sítio. Isto é a campainha por cima.
#
#   avisar.sh <título> <prioridade> [ficheiro com o corpo]
#
# Sem `NTFY_URL` configurada não faz nada e sai a zero, de propósito: um passo
# de aviso que faz falhar a execução por não estar configurado transforma «a
# cópia correu bem» em «a cópia falhou», e ensina toda a gente a ignorar o
# vermelho.
#
# `NTFY_URL` é o endereço completo, tópico incluído — `https://ntfy.sh/<tópico>`
# ou um servidor próprio.
#
# **Uma correção ao que aqui estava escrito.** Dizia «com o tópico com leitura
# protegida», como se fosse um interruptor por ligar. Não é: reservar um tópico
# no ntfy.sh **é funcionalidade paga**. No plano grátis, quem souber o nome do
# tópico lê o que lá passa — a defesa é o nome ser longo e aleatório, e é essa
# a que está em uso (ver `docs/INFRAESTRUTURA.md`). O que passa por aqui são
# títulos de avaria e contagens de eventos, não credenciais nem dados de
# ninguém; o pior caso é alguém saber que o sítio esteve em baixo e por quanto
# tempo.
set -euo pipefail

TITULO="${1:?falta o título do aviso}"
PRIORIDADE="${2:-default}"
CORPO_FICHEIRO="${3:-}"

if [ -z "${NTFY_URL:-}" ]; then
  echo "::notice::Sem NTFY_URL configurada: o aviso fica só no issue."
  exit 0
fi

corpo=''
if [ -n "${CORPO_FICHEIRO}" ] && [ -f "${CORPO_FICHEIRO}" ]; then
  # Um aviso de telemóvel que precisa de rolar não é um aviso. O detalhe está
  # no issue e na execução; aqui vai o que cabe num ecrã bloqueado.
  corpo=$(head -c 900 "${CORPO_FICHEIRO}")
fi
if [ -z "${corpo}" ]; then
  corpo="Sem detalhe. Ver a execução no GitHub."
fi

if [ -n "${GITHUB_SERVER_URL:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ] && [ -n "${GITHUB_RUN_ID:-}" ]; then
  execucao="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
else
  execucao=''
fi

# O título vai codificado, e tem de ir.
#
# Um cabeçalho HTTP é Latin-1 por especificação, e «o sítio não responde» com
# acentos chega ao telemóvel como «o sÃ­tio nÃ£o responde» — foi medido, não
# presumido. O corpo não tem o problema (é o corpo, é UTF-8); o título tem. A
# RFC 2047 é a forma normalizada de meter UTF-8 num cabeçalho, e o ntfy
# entende-a. Uma linha, e o alarme fica legível.
titulo_codificado="=?UTF-8?B?$(printf '%s' "${TITULO}" | base64 --wrap=0)?="

cabecalhos=(
  -H "Title: ${titulo_codificado}"
  -H "Priority: ${PRIORIDADE}"
  -H "Tags: rotating_light"
)
[ -n "${NTFY_TOKEN:-}" ] && cabecalhos+=(-H "Authorization: Bearer ${NTFY_TOKEN}")
# O rótulo da ação fica em ASCII de propósito: a sintaxe do cabeçalho `Actions`
# usa vírgulas como separador, e codificá-lo em RFC 2047 partia-a.
[ -n "${execucao}" ] && cabecalhos+=(-H "Actions: view, Ver no GitHub, ${execucao}")

# `|| true` e não `set -e`: um coletor de avisos em baixo não pode ser a razão
# por que uma execução aparece a vermelho. O que falhou já falhou; isto é o
# telefonema.
if curl --silent --show-error --fail --max-time 15 \
  "${cabecalhos[@]}" \
  --data "${corpo}" \
  "${NTFY_URL}" > /dev/null; then
  echo "Aviso enviado: ${TITULO}"
else
  echo "::warning::Não deu para enviar o aviso por ntfy. O issue fica na mesma."
fi
