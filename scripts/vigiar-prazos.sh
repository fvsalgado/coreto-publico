#!/usr/bin/env bash
# Vigia o que expira num calendário e não numa avaria.
#
# A vigilância horária (`vigiar-sitio.sh`) pergunta se o sítio responde, e
# apanha tudo o que se parte. Não apanha o que **caduca**: o registo de um
# domínio não avaria, chega ao fim. No dia seguinte o DNS deixa de resolver, o
# sítio inteiro desaparece, e a vigilância horária diz «não responde» quando já
# não há nada a fazer senão pagar — se ainda houver período de graça, e se o
# nome ainda lá estiver.
#
# O certificado TLS não vem aqui de propósito: renova-se sozinho na Vercel e já
# é perguntado de hora a hora em `vigiar-sitio.sh`. O que se pergunta aqui
# renova-se com um cartão, uma vez por ano, e é por isso que se pergunta com
# semanas de antecedência em vez de horas.
#
# A lista é explícita e não sai do mapa de regiões, ao contrário do resto da
# vigilância. É deliberado: os subdomínios de uma região vivem debaixo de um
# registo que já está aqui, e o domínio próprio de um cliente é registado por
# ele. Vigiá-lo é uma escolha — útil, porque se caducar somos nós que levamos
# com o telefonema —, e uma escolha escreve-se, não se herda.
#
#   DOMINIOS            lista separada por espaços (omissão: coreto.org)
#   DIAS_DE_DOMINIO     avisa a menos de tantos dias do fim (omissão: 45)
set -euo pipefail

DOMINIOS="${DOMINIOS:-coreto.org}"
DIAS_DE_DOMINIO="${DIAS_DE_DOMINIO:-45}"

falhas=0
: > relatorio.md

# O RDAP substituiu o whois e responde JSON sobre HTTPS, o que o torna
# utilizável a partir de um runner sem ferramentas extra. O `rdap.org` é um
# encaminhador: redireciona para o registo de cada extensão — daí o `-L`, sem o
# qual vem um corpo vazio e um 301 que o `jq` não sabe ler.
for dominio in ${DOMINIOS}; do
  if ! resposta="$(curl --silent --location --fail --max-time 30 \
      --header 'Accept: application/rdap+json' \
      "https://rdap.org/domain/${dominio}" 2>/dev/null)"; then
    echo "✗ ${dominio} — o RDAP não respondeu"
    echo "- \`${dominio}\` — o RDAP não respondeu; não se sabe quando expira" >> relatorio.md
    falhas=$((falhas + 1))
    continue
  fi

  fim="$(printf '%s' "${resposta}" \
    | jq --raw-output '[.events[]? | select(.eventAction == "expiration") | .eventDate] | .[0] // empty')"

  if [ -z "${fim}" ]; then
    echo "✗ ${dominio} — o RDAP respondeu sem data de expiração"
    echo "- \`${dominio}\` — o RDAP respondeu sem data de expiração" >> relatorio.md
    falhas=$((falhas + 1))
    continue
  fi

  dias=$(( ( $(date --utc --date="${fim}" +%s) - $(date --utc +%s) ) / 86400 ))

  if [ "${dias}" -lt "${DIAS_DE_DOMINIO}" ]; then
    echo "✗ ${dominio} — expira em ${dias} dia(s), a ${fim%%T*}"
    echo "- \`${dominio}\` — **expira em ${dias} dia(s)**, a ${fim%%T*}" >> relatorio.md
    falhas=$((falhas + 1))
  else
    echo "✓ ${dominio} — ${dias} dias, até ${fim%%T*}"
  fi
done

echo
if [ "${falhas}" -gt 0 ]; then
  echo "${falhas} registo(s) por renovar a tempo."
  exit 1
fi
echo 'Todos os registos com folga.'
