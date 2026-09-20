#!/usr/bin/env bash
# O que o avisar.sh faz sem canal, por prioridade — e com canal, o que envia.
#
# Corre sem rede: o `curl` é substituído por um guião no PATH que grava os
# argumentos com que foi chamado. Sai a 1 à primeira asserção que falhe.
#
#   ./scripts/avisar.test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

falhas=0
ok() { echo "  ✓ $1"; }
ko() { echo "  ✗ $1"; falhas=$((falhas + 1)); }

# Um curl fingido, que anota e responde bem.
mkdir -p "$TMP/bin"
cat > "$TMP/bin/curl" <<'FALSO'
#!/usr/bin/env bash
printf '%s\n' "$@" > "${CURL_REGISTO:?}"
exit 0
FALSO
chmod +x "$TMP/bin/curl"

echo "sem NTFY_URL:"
for prioridade in low default; do
  if (unset NTFY_URL; "$ROOT/scripts/avisar.sh" 'Teste' "$prioridade" >/dev/null); then
    ok "prioridade ${prioridade} sai a zero, como sempre"
  else
    ko "prioridade ${prioridade} devia sair a zero"
  fi
done
for prioridade in high urgent; do
  if (unset NTFY_URL; "$ROOT/scripts/avisar.sh" 'Teste' "$prioridade" >/dev/null 2>&1); then
    ko "prioridade ${prioridade} devia sair a 1 — falhou e ninguém foi avisado"
  else
    ok "prioridade ${prioridade} sai a 1 e di-lo"
  fi
done
saida="$( (unset NTFY_URL; "$ROOT/scripts/avisar.sh" 'Teste' urgent 2>&1) || true)"
if grep -q 'Ninguém foi avisado' <<<"$saida"; then
  ok "a mensagem de erro diz que ninguém foi avisado"
else
  ko "a mensagem de erro não diz que ninguém foi avisado: ${saida}"
fi

echo "com NTFY_URL:"
printf 'corpo do aviso' > "$TMP/corpo.md"
registo="$TMP/curl.txt"
if (export PATH="$TMP/bin:$PATH" CURL_REGISTO="$registo" NTFY_URL='https://ntfy.example/topico' NTFY_TOKEN='tk_x'; \
    "$ROOT/scripts/avisar.sh" 'O sítio não responde' urgent "$TMP/corpo.md" >/dev/null); then
  ok "sai a zero"
else
  ko "devia sair a zero"
fi
if grep -q '^https://ntfy.example/topico$' "$registo"; then ok "bate no tópico"; else ko "não bateu no tópico"; fi
if grep -q '^Priority: urgent$' "$registo"; then ok "leva a prioridade"; else ko "não leva a prioridade"; fi
if grep -q '^Authorization: Bearer tk_x$' "$registo"; then ok "leva o token"; else ko "não leva o token"; fi
if grep -q '^Title: =?UTF-8?B?' "$registo"; then ok "o título vai codificado (RFC 2047)"; else ko "o título não vai codificado"; fi
if grep -q '^corpo do aviso$' "$registo"; then ok "leva o corpo"; else ko "não leva o corpo"; fi

echo
if [ "$falhas" -gt 0 ]; then
  echo "${falhas} asserção(ões) a falhar."
  exit 1
fi
echo "avisar.sh: tudo como prometido."
