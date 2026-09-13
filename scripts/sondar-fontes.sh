#!/usr/bin/env bash
# Sonda os endereços de `scripts/fontes-candidatas.tsv` e guarda o que veio.
#
# Existe porque a recolha nunca correu e ninguém sabe, com prova, o que estes
# sites servem ao executor do GitHub Actions. Uma sondagem feita de uma máquina
# de desenvolvimento não responde à mesma pergunta: há sites atrás de um WAF
# que decidem pela reputação do endereço de origem, e um plano construído sobre
# um falso defeito faz perder semanas.
#
# Não precisa de segredo nenhum: só faz pedidos de leitura a páginas públicas.
#
# O que produz, em `sondagem/`:
#   <id>.head    cabeçalhos e código de resposta
#   <id>.body    o corpo, truncado — é isto que vira fixture
#   resumo.tsv   uma linha por endereço, para se ler de relance
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LISTA="${1:-$ROOT/scripts/fontes-candidatas.tsv}"
SAIDA="${SAIDA:-$ROOT/sondagem}"

# Um agente que se identifica e diz para onde escrever. Um servidor municipal
# que queira bloquear-nos deve conseguir saber a quem se dirigir — e um que
# queira ajudar também.
AGENTE='Coreto/1.0 (+https://github.com/fvsalgado/coreto; agenda cultural do Medio Tejo)'

# Chega para apanhar a listagem e a marcação que interessa sem guardar o site
# inteiro de terceiros no repositório.
MAX_BYTES="${MAX_BYTES:-300000}"

# Um pedido de cada vez, com uma pausa entre eles. A sondagem não tem pressa e
# não é dela que estes servidores precisam de se defender.
PAUSA="${PAUSA:-2}"

mkdir -p "$SAIDA"
RESUMO="$SAIDA/resumo.tsv"
printf 'id\ttipo\tcodigo\tbytes\ttipo_conteudo\tservidor\tendereco_final\n' > "$RESUMO"

sondar() {
  local id="$1" tipo="$2" endereco="$3"
  local head="$SAIDA/$id.head" body="$SAIDA/$id.body"

  # `--max-time` para uma fonte pendurada não gastar a janela das outras;
  # `--location` porque metade destes endereços redireciona.
  local codigo final
  codigo=$(curl --silent --show-error --location --max-time 45 \
    --user-agent "$AGENTE" \
    --header 'Accept-Language: pt-PT,pt;q=0.9' \
    --dump-header "$head" \
    --write-out '%{http_code}' \
    --output "$body.completo" \
    "$endereco" 2>"$SAIDA/$id.erro") || codigo='000'

  final=$(curl --silent --location --max-time 45 --output /dev/null \
    --user-agent "$AGENTE" --write-out '%{url_effective}' "$endereco" 2>/dev/null) || final=''

  local bytes=0
  if [ -f "$body.completo" ]; then
    bytes=$(wc -c < "$body.completo" | tr -d ' ')
    head --bytes="$MAX_BYTES" "$body.completo" > "$body"
    rm -f "$body.completo"
  fi

  local ctype servidor
  ctype=$(grep -i '^content-type:' "$head" 2>/dev/null | tail -1 | tr -d '\r' | cut -d' ' -f2- || true)
  servidor=$(grep -i '^server:' "$head" 2>/dev/null | tail -1 | tr -d '\r' | cut -d' ' -f2- || true)

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$id" "$tipo" "$codigo" "$bytes" "${ctype:-—}" "${servidor:-—}" "${final:-—}" >> "$RESUMO"

  # Uma pista imediata no registo, para quem estiver a ver a execução correr.
  local pista=''
  if [ -f "$body" ]; then
    case "$tipo" in
      html) pista="eb-event-wrapper: $(grep -c 'eb-event-wrapper' "$body" 2>/dev/null || echo 0)" ;;
      rss)  pista="<item>: $(grep -c '<item>' "$body" 2>/dev/null || echo 0)" ;;
      json) pista="$(head --bytes=120 "$body" 2>/dev/null | tr -d '\n')" ;;
    esac
  fi
  printf '  %-28s %-4s %8s bytes   %s\n' "$id" "$codigo" "$bytes" "$pista"

  sleep "$PAUSA"
}

echo "→ a sondar a partir de $(curl --silent --max-time 20 https://api.ipify.org 2>/dev/null || echo 'endereço desconhecido')"
echo

while IFS=$'\t' read -r id tipo endereco; do
  case "$id" in ''|\#*) continue ;; esac
  [ -z "${endereco:-}" ] && continue
  sondar "$id" "$tipo" "$endereco"
done < "$LISTA"

echo
echo "✓ sondagem escrita em $SAIDA"
column -t -s$'\t' "$RESUMO" 2>/dev/null || cat "$RESUMO"
