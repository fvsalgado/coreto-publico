#!/usr/bin/env bash
# Vigia o sítio de fora, como quem o visita.
#
# Cinco perguntas, por esta ordem:
#
#   1. A plataforma responde? É o endereço que a Vercel dá ao deploy, sem DNS
#      nosso pelo meio. Se este cair, caiu tudo, e as perguntas seguintes não
#      acrescentam nada.
#   2. Cada região responde no seu domínio? A lista vem do próprio sítio
#      (`/api/regioes`, o mesmo mapa que o middleware usa), por isso uma região
#      nova entra na vigilância sem se tocar aqui. A entrada tem de vir 200 e
#      trazer a sua própria origem no corpo — os dados estruturados escrevem-na
#      — que é o que distingue «a região a servir» de «um anfitrião
#      desconhecido a mostrar a página do produto», que também é um 200.
#   3. **Cada região tem eventos?** Esta é nova, e é a que faltava. As
#      perguntas de cima passam com a base de dados morta: os dados
#      estruturados escrevem a origem em qualquer página, catálogo vazio
#      incluído, e uma agenda a servir zero eventos respondia 200 e passava na
#      vigilância. O que se pergunta agora é `/api/events?limit=1`, e exige-se
#      pelo menos uma entrada. Um sítio que serve páginas e não serve agenda
#      nenhuma está em baixo para quem o visita, mesmo que responda a tudo.
#   4. **A recolha de cada região está viva?** É a pergunta que as três de
#      cima não fazem, e a que uma agenda cheia esconde: as fontes de um
#      concelho podem estar paradas há duas semanas com a agenda ainda cheia
#      do que se recolheu antes, e o sítio responde a tudo. A resposta vem de
#      `/estado.json` — o mesmo veredito que a página /estado mostra, num
#      corpo que é contrato e não redação. Um `grau` de «mau» é uma falha; o
#      de «atenção» fica escrito no relatório e não abre issue, porque uma
#      fonte que falhou duas rondas resolve-se sozinha na maior parte das
#      noites.
#   5. O certificado de cada domínio ainda dura? Renova-se sozinho na Vercel —
#      e é por isso mesmo que ninguém repara quando deixa de renovar. Avisa a
#      menos de `DIAS_DE_CERTIFICADO` do fim.
#   6. Cada alias manda para o canónico? Um 308 com o `Location` certo.
#
# Cada pedido tem três tentativas com pausa a crescer, para um soluço de rede
# não abrir um issue. Sai 1 se alguma pergunta ficar sem a resposta certa; o
# relatório fica em `relatorio.md`, que o workflow cola no issue.
set -euo pipefail

# Dias de folga antes de o certificado expirar. Vinte e um porque a renovação
# automática tenta muito antes disso: quando faltam três semanas e ainda não
# renovou, deixou de ser automática e passou a ser um problema.
DIAS_DE_CERTIFICADO="${DIAS_DE_CERTIFICADO:-21}"

PLATAFORMA="${PLATAFORMA:?falta o endereço da plataforma (PLATAFORMA)}"
RELATORIO="${RELATORIO:-relatorio.md}"
falhas=0
: > "${RELATORIO}"

falhou() {
  falhas=$((falhas + 1))
  echo "✗ $1"
  echo "- $1" >> "${RELATORIO}"
}

# Pede uma página: o corpo fica em corpo.tmp, o código HTTP sai no stdout —
# 000 quando nem chegou a ligar.
pedir() {
  curl --silent --location --max-time 20 \
    --user-agent 'Coreto (vigilancia; +https://coreto.org)' \
    --output corpo.tmp --write-out '%{http_code}' "$1" || echo 000
}

# pagina <nome> <url> <texto que o corpo tem de trazer>
pagina() {
  local nome=$1 url=$2 esperado=$3 codigo=000 tentativa
  for tentativa in 1 2 3; do
    codigo=$(pedir "${url}")
    if [ "${codigo}" = 200 ] && grep --quiet --fixed-strings -- "${esperado}" corpo.tmp; then
      echo "✓ ${nome} — ${url}"
      return 0
    fi
    sleep $((tentativa * 10))
  done
  if [ "${codigo}" = 200 ]; then
    falhou "${nome} — ${url} respondeu 200 mas sem «${esperado}» no corpo: está a servir outra coisa"
  else
    falhou "${nome} — ${url} respondeu ${codigo}"
  fi
}

# agenda_tem_eventos <nome> <origem>
#
# A pergunta que separa «o sítio responde» de «o sítio serve». Lê-se a API
# pública, que é a mesma fonte que os feeds e as páginas usam: se ela traz uma
# entrada, há base de dados, há leitura e há agenda.
#
# Uma região legitimamente sem eventos — uma CIM que acabou de nascer, agosto
# num concelho pequeno — dispararia isto sem nada estar avariado. É por isso
# que o aviso é o mesmo issue das outras perguntas e não um alarme à parte:
# quem o ler decide, e a alternativa (não perguntar) é a que já custou não
# saber.
agenda_tem_eventos() {
  local nome=$1 origem=$2 codigo=000 tentativa
  for tentativa in 1 2 3; do
    codigo=$(pedir "${origem}/api/events?limit=1")
    if [ "${codigo}" = 200 ] && jq --exit-status '.events | length > 0' corpo.tmp > /dev/null 2>&1; then
      echo "✓ ${nome} — a agenda tem eventos"
      return 0
    fi
    sleep $((tentativa * 10))
  done
  if [ "${codigo}" = 200 ]; then
    falhou "${nome} — ${origem}/api/events respondeu 200 sem um único evento: a base não está a ser lida, ou a agenda esvaziou"
  else
    falhou "${nome} — ${origem}/api/events respondeu ${codigo}"
  fi
}

# recolha_esta_viva <nome> <origem>
#
# Lê `/estado.json` e não a página: o corpo é contrato, e o texto da página é
# redação. Vigiar por texto amarra o alarme às palavras — mudar «Em ordem»
# para «Está tudo bem» partia isto sem partir teste nenhum, e um alarme
# partido descobre-se no dia em que devia tocar.
#
# O 503 é resposta e não silêncio: a rota devolve-o de propósito quando não
# consegue ler a base, e é aí que esta pergunta ganha o seu valor — as três de
# cima podem passar com metade das fontes paradas.
recolha_esta_viva() {
  local nome=$1 origem=$2 codigo=000 grau='' resumo='' tentativa
  for tentativa in 1 2 3; do
    codigo=$(pedir "${origem}/estado.json")
    if [ "${codigo}" = 200 ]; then
      grau=$(jq --raw-output '.grau // ""' corpo.tmp 2> /dev/null || echo '')
      resumo=$(jq --raw-output '.resumo // ""' corpo.tmp 2> /dev/null || echo '')
      break
    fi
    sleep $((tentativa * 10))
  done

  if [ "${codigo}" != 200 ]; then
    falhou "${nome} — ${origem}/estado.json respondeu ${codigo}"
    return 0
  fi

  case "${grau}" in
    bom)
      echo "✓ ${nome} — a recolha está em dia"
      ;;
    atencao)
      # Não abre issue: uma fonte que falhou duas rondas resolve-se sozinha na
      # maior parte das noites, e um alarme que toca por isso é um alarme que
      # se aprende a ignorar. Fica escrito para quem ler o relatório.
      echo "· ${nome} — atenção: ${resumo}"
      echo "- · ${nome} — ${resumo}" >> "${RELATORIO}"
      ;;
    *)
      falhou "${nome} — ${resumo:-o estado não trouxe veredito nenhum (grau «${grau}»)}"
      ;;
  esac
}

# certificado_dura <domínio>
#
# Sem tentativas repetidas: um certificado não fica bom à terceira. Se o
# `openssl` não estiver lá ou a ligação não abrir, não se inventa um veredito —
# as perguntas de cima já dizem se o domínio responde.
certificado_dura() {
  local dominio=$1 fim segundos dias
  fim=$(echo \
    | openssl s_client -servername "${dominio}" -connect "${dominio}:443" 2> /dev/null \
    | openssl x509 -noout -enddate 2> /dev/null \
    | cut -d= -f2) || fim=''

  if [ -z "${fim}" ]; then
    echo "· ${dominio} — não deu para ler o certificado (ignorado)"
    return 0
  fi

  segundos=$(($(date --date="${fim}" +%s) - $(date +%s)))
  dias=$((segundos / 86400))

  if [ "${dias}" -lt "${DIAS_DE_CERTIFICADO}" ]; then
    falhou "certificado de ${dominio} — expira em ${dias} dia(s), a ${fim}"
    return 0
  fi
  echo "✓ certificado ${dominio} — ${dias} dias"
}

# alias_redireciona <alias> <origem canónica>
alias_redireciona() {
  local alias=$1 canonico=$2 resposta='000 ' tentativa
  for tentativa in 1 2 3; do
    resposta=$(curl --silent --max-time 20 --output /dev/null \
      --write-out '%{http_code} %{redirect_url}' "https://${alias}/" || echo '000 ')
    if [ "${resposta}" = "308 ${canonico}/" ]; then
      echo "✓ alias ${alias} → ${canonico}/"
      return 0
    fi
    sleep $((tentativa * 10))
  done
  falhou "alias ${alias} — esperava 308 para ${canonico}/, veio «${resposta}»"
}

# 1. A plataforma.
pagina 'plataforma' "${PLATAFORMA}/" 'Coreto'

# 2-5. Cada região pelo mapa do próprio sítio: a página, a agenda, a recolha e
# o certificado. 6. Os alias de cada uma.
codigo=$(pedir "${PLATAFORMA}/api/regioes")
if [ "${codigo}" != 200 ] || ! jq --exit-status 'type == "array"' corpo.tmp > /dev/null 2>&1; then
  falhou "mapa das regiões — ${PLATAFORMA}/api/regioes respondeu ${codigo} ou não trouxe uma lista"
else
  cp corpo.tmp mapa.json
  while IFS=$'\t' read -r id dominio; do
    pagina "região ${id}" "https://${dominio}/" "https://${dominio}"
    agenda_tem_eventos "região ${id}" "https://${dominio}"
    recolha_esta_viva "região ${id}" "https://${dominio}"
    certificado_dura "${dominio}"
  done < <(jq --raw-output '.[] | [.id, .domain] | @tsv' mapa.json)
  while IFS=$'\t' read -r dominio alias; do
    alias_redireciona "${alias}" "https://${dominio}"
  done < <(jq --raw-output '.[] | .domain as $d | .aliases[] | [$d, .] | @tsv' mapa.json)
fi

rm --force corpo.tmp mapa.json

echo
if [ "${falhas}" -gt 0 ]; then
  echo "${falhas} pergunta(s) sem a resposta certa."
  exit 1
fi
echo 'Tudo a responder.'
