#!/usr/bin/env bash
#
# Reconstrói o espelho público a partir deste repositório.
#
#   ./scripts/espelho/sincronizar.sh                  # ensaia e não empurra
#   ./scripts/espelho/sincronizar.sh --empurrar       # empurra se a auditoria passar
#
# O espelho é um repositório **à parte** (`fvsalgado/coreto-publico`), e não um
# ramo deste. A razão é a que decidiu tudo o resto: um `push --force` tira as
# referências mas não apaga os objetos — no GitHub, o que já lá esteve continua
# a poder ser puxado pelo SHA. Reescrever a história deste repositório para o
# abrir deixaria o material retirado ao alcance de quem soubesse um SHA. Um
# repositório novo nasce com uma história que nunca o conteve.
#
# Por isso mesmo, isto reconstrói do zero de cada vez, e nunca acrescenta um
# commit ao que lá está. O espelho é uma função deste repositório; se alguém lhe
# escrever por cima à mão, a sincronização seguinte apaga-o — e é o que se quer.
#
# O que cada peça faz:
#
#   remover.txt       os caminhos que saem, de TODOS os commits (git filter-repo)
#   mailmap           reescreve o autor dos commits
#   substituir.txt    reescreve o CONTEÚDO dos ficheiros ao longo da história —
#                     o mailmap sozinho não chega, e isto quase escapou: as
#                     versões antigas do AUTORIA.md continuavam com o endereço
#                     pessoal, visível num `git log -p`
#   apresentavel.patch  o que muda por o repositório passar a ser público
#   apagar.txt        os guiões que liam documentos que já não vão
#
# **O que NÃO está aqui, e é de propósito:** as guardas dos guiões de
# verificação vivem no próprio `verificar-afirmacoes.mjs` e no
# `verificar-proveniencia.mjs`, que leem a marca `.espelho-publico`. Já
# estiveram neste patch, e eram metade dele — num ficheiro de 2700 linhas que
# muda todas as semanas, um patch dessa dimensão entra em conflito à terceira
# sincronização. Uma condição no sítio certo não entra em conflito nunca.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RECEITA="${RAIZ}/scripts/espelho"
ESPELHO_URL="${ESPELHO_URL:-https://github.com/fvsalgado/coreto-publico.git}"
MARCA='.espelho-publico'
EMPURRAR=0
[ "${1:-}" = "--empurrar" ] && EMPURRAR=1

passo() { printf '\n\033[1m── %s\033[0m\n' "$1"; }
morrer() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

command -v git >/dev/null || morrer 'falta o git'
python3 -c 'import git_filter_repo' 2>/dev/null \
  || morrer 'falta o git-filter-repo: pip install git-filter-repo'

# O ramo de onde se parte. Nunca um ramo de trabalho: o espelho publica o que
# já foi revisto e fundido.
RAMO="${RAMO:-main}"
git -C "$RAIZ" rev-parse --verify --quiet "$RAMO" >/dev/null \
  || morrer "não encontrei o ramo ${RAMO}"

TRABALHO="$(mktemp -d)"
trap 'rm -rf "$TRABALHO"' EXIT
CLONE="${TRABALHO}/espelho"

passo "A clonar ${RAMO}"
git clone --quiet --no-local "$RAIZ" "$CLONE"
git -C "$CLONE" checkout --quiet "$RAMO"
echo "   base: $(git -C "$CLONE" log --oneline -1)"

passo 'A retirar o que não é público, de toda a história'
# O `cd` é dentro de um subshell e não é decoração: o `git filter-repo` corre
# sobre o diretório onde está, e sem isto reescrevia a história DESTE
# repositório em vez da do clone. Escrito sem o `cd`, uma vez, e apanhado antes
# de correr — a nota fica para não voltar a acontecer.
(
  cd "$CLONE"
  python3 -m git_filter_repo --force \
    --invert-paths --paths-from-file "${RECEITA}/remover.txt" \
    --mailmap "${RECEITA}/mailmap" \
    --replace-text "${RECEITA}/substituir.txt" \
    --quiet
)
echo "   $(git -C "$CLONE" rev-list --count HEAD) commits depois do filtro"

passo 'A aplicar o que muda por ser público'
git -C "$CLONE" apply -3 --whitespace=nowarn "${RECEITA}/apresentavel.patch" \
  || morrer 'o apresentavel.patch já não aplica — regenera-o (ver o README desta pasta)'
(cd "$CLONE" && xargs git rm --quiet < "${RECEITA}/apagar.txt")

# A marca. É o que faz os guiões de verificação dizerem «não se mediu» em vez
# de reprovarem — e, por ser um ficheiro e não uma dedução, um documento
# apagado por engano NESTE repositório continua a reprovar, como deve.
cat > "${CLONE}/${MARCA}" <<'MARCA_FIM'
Este repositório é o espelho público do Coreto.

O desenvolvimento faz-se num repositório privado, que é o que serve o sítio e
o que tem os segredos. Aqui está o código todo; de fora ficou o que não é
código — o dossiê comercial, os manuais de operação, o levantamento das fontes
de uma região, e as automações que precisam de segredos para correr.

Os guiões de verificação leem este ficheiro: onde ele existe, as afirmações que
precisam do que vive no privado dizem «não se mediu» em vez de reprovarem.

Reconstrói-se com scripts/espelho/sincronizar.sh, e nunca à mão.
MARCA_FIM

passo 'A instalar e a correr a bateria'
(cd "$CLONE" && pnpm install --frozen-lockfile >/dev/null) || morrer 'o pnpm install falhou'
(cd "$CLONE" && npx vitest run >/dev/null 2>&1) || morrer 'os testes falharam'
(cd "$CLONE" && node scripts/verificar-afirmacoes.mjs >/dev/null) || morrer 'as afirmações falharam'
(cd "$CLONE" && node scripts/verificar-proveniencia.mjs >/dev/null) || morrer 'a proveniência falhou'
(cd "$CLONE" && npx prettier --check --log-level warn . >/dev/null) || morrer 'a formatação falhou'
(cd "$CLONE" && npx tsc --noEmit -p apps/web) || morrer 'os tipos falharam'
echo '   bateria verde'

passo 'A comprometer'
(cd "$CLONE" && git add -A && git commit --quiet -F "${RECEITA}/mensagem.txt")

# ---------------------------------------------------------------------------
# A auditoria. Corre SEMPRE, e o que ela recusa não se empurra.
#
# Não é cerimónia: cada uma destas linhas apanhou alguma coisa a sério. Os
# symlinks de node_modules entraram num commit porque o .gitignore diz
# `node_modules/` com barra e uma barra só casa com diretórios. O endereço
# pessoal sobreviveu ao mailmap dentro de ficheiros antigos. E a lista dos
# caminhos retirados verifica-se contra TODOS os commits, não contra a ponta,
# porque é a ponta que engana.
# ---------------------------------------------------------------------------
passo 'Auditoria'
cd "$CLONE"
problemas=0
conferir() { # nome, contagem esperada (0), contagem obtida
  if [ "$3" -eq 0 ]; then printf '   ✓ %s\n' "$1"
  else printf '   ✗ %s: %s\n' "$1" "$3"; problemas=$((problemas + 1)); fi
}

# O conteúdo de todos os blobs da história, **menos os desta receita**.
#
# A exclusão não é comodismo: este guião traz os padrões que procura escritos
# dentro de si, e sem ela encontrava-se a si próprio — deu duas falhas na
# primeira corrida, uma por `gmail` e outra por `github_pat_`, as duas vindas
# destas linhas. Um detetor que se acusa a si mesmo ensina-se a ignorar.
blobs() {
  git rev-list --objects --all \
    | awk 'NF == 2 && $2 !~ /^scripts\/espelho\// { print $1 }' \
    | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize)' 2>/dev/null \
    | awk '$1 == "blob" && $3 < 400000 { print $2 }' \
    | git cat-file --batch 2>/dev/null
}

# Os endereços a procurar saem do próprio `mailmap`, em vez de escritos aqui.
#
# Escrever «gmail» era o atalho errado por duas razões. Apanhava o que não
# devia — a migração 0035 traz os contactos públicos de coletividades, que são
# endereços institucionais das próprias e que a agenda já publica. E não
# apanhava o que devia no dia em que o `mailmap` ganhasse uma linha nova.
PESSOAIS="$(sed -n 's/.*<\([^>]*\)>[[:space:]]*<\([^>]*\)>.*/\2/p' "${RECEITA}/mailmap" | sort -u)"

contar_pessoais() {
  local total=0 endereco
  for endereco in $PESSOAIS; do
    total=$((total + $("$@" | grep -acF "$endereco" || true)))
  done
  echo "$total"
}

conferir 'nenhum endereço pessoal nos metadados dos commits' 0 \
  "$(contar_pessoais git log --all --format='%ae|%ce|%an|%cn')"
conferir 'nenhum endereço pessoal no conteúdo de nenhum blob' 0 \
  "$(contar_pessoais blobs)"
conferir 'nenhum segredo em nenhum blob' 0 \
  "$(blobs | grep -aEc 'sk-ant-[A-Za-z0-9-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-|AKIA[0-9A-Z]{16}' || true)"
conferir 'nenhum node_modules em commit nenhum' 0 \
  "$(git log --all --pretty=format: --name-only | sort -u | grep -c 'node_modules' || true)"

# Os caminhos retirados, contra a história inteira. As duas fixtures reduzidas
# são a exceção conhecida: saem no filtro e voltam pelo patch, pequenas.
todos="${TRABALHO}/todos.txt"
git log --all --pretty=format: --name-only | sort -u > "$todos"
sobreviventes=0
while read -r caminho; do
  [ -z "$caminho" ] && continue
  case "$caminho" in packages/ingest/src/__fixtures__/jf-minde-*) continue;; esac
  if grep -qxF "$caminho" "$todos" || grep -q "^${caminho%/}/" "$todos"; then
    printf '   ✗ ainda na história: %s\n' "$caminho"
    sobreviventes=$((sobreviventes + 1))
  fi
done < "${RECEITA}/remover.txt"
conferir 'nenhum caminho retirado sobrevive em commit nenhum' 0 "$sobreviventes"

# Nenhuma workflow agendada: no espelho não há segredos, e uma que corresse
# falhava todas as noites — que é como se ensina alguém a ignorar um alarme.
conferir 'nenhuma workflow com cron' 0 \
  "$(grep -rl 'cron:' .github/workflows/ 2>/dev/null | grep -vc 'codeql.yml' || true)"

[ "$problemas" -eq 0 ] || morrer "a auditoria encontrou ${problemas} problema(s) — não empurro"

if [ "$EMPURRAR" -eq 0 ]; then
  passo 'Ensaio'
  echo "   Está tudo verde e NADA foi empurrado."
  echo "   A árvore ficou em ${CLONE} até este guião sair."
  echo "   Corre outra vez com --empurrar para publicar."
  trap - EXIT
  echo
  echo "   (a pasta fica: ${TRABALHO})"
  exit 0
fi

passo "A empurrar para ${ESPELHO_URL}"
git remote add publico "$ESPELHO_URL"
git fetch --quiet publico main 2>/dev/null || true
git push --force-with-lease publico main:main
printf '\n\033[32m✓ espelho sincronizado\033[0m\n'
