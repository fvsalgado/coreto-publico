#!/usr/bin/env bash
# Liga os hooks do repositório, uma vez por clone.
#
# `core.hooksPath` é uma opção do próprio git: aponta-se a uma pasta versionada
# e todos os hooks lá dentro passam a correr. Não há husky, não há pacote novo,
# não há passo de instalação escondido num `postinstall` — que é a razão por
# que isto é um comando que se corre de propósito e não um automatismo: um
# `postinstall` que mexe na configuração do git de quem instala é o género de
# coisa que se faz sem avisar, e aqui avisa-se.
#
#   ./scripts/instalar-hooks.sh
#
# Para desligar: `git config --unset core.hooksPath`.
set -euo pipefail

raiz="$(git rev-parse --show-toplevel)"
cd "${raiz}"

chmod +x scripts/hooks/*

git config core.hooksPath scripts/hooks

echo "Hooks ligados: $(git config core.hooksPath)"
echo
for hook in scripts/hooks/*; do
  echo "  $(basename "${hook}")"
done
echo
if command -v gitleaks > /dev/null 2>&1; then
  echo "gitleaks: $(gitleaks version 2> /dev/null || echo instalado)"
else
  echo "Sem gitleaks instalado — o pre-commit avisa e deixa passar."
  echo "O CI varre à mesma; instalar aqui é o que evita commitar o segredo."
fi
