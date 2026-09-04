#!/usr/bin/env bash
# Aplica o esquema do Coreto a um projeto Supabase novo, de uma vez.
#
# Uso:
#   DATABASE_URL='postgresql://postgres.<ref>:<palavra-passe>@<host>:6543/postgres' \
#     ./scripts/provision-supabase.sh
#
# A cadeia de ligação está em Supabase → Project Settings → Database →
# Connection string → URI. Usa a do *pooler* (porta 6543) ou a direta (5432);
# ambas servem, a direta é mais fiável para migrações longas.
#
# O que isto faz, por esta ordem:
#   1. confirma que a base está vazia (recusa-se a correr sobre uma base com
#      dados, para não haver enganos com o projeto errado);
#   2. aplica todas as migrações por ordem;
#   3. corre as asserções de `schema-checks.sql`.
#
# É idempotente do lado dos seeds (todos com `on conflict do update`), mas as
# migrações de esquema não são — daí a verificação do passo 1.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL. Ver o cabeçalho deste ficheiro." >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "→ a confirmar que a base está vazia"
EXISTING=$(psql "$DATABASE_URL" -tAc \
  "select count(*) from information_schema.tables where table_schema = 'public';")
if [ "$EXISTING" -gt 0 ] && [ "${FORCE:-}" != "1" ]; then
  echo "A base já tem $EXISTING tabelas em 'public'." >&2
  echo "Se for mesmo o projeto certo e quiseres continuar, corre com FORCE=1." >&2
  exit 1
fi

# O Supabase já traz os papéis (anon, authenticated, service_role), os esquemas
# `extensions` e `storage`, e as tabelas do Storage. O prelúdio existe para o
# Postgres do CI, que não os tem — aqui é saltado.
echo "→ migrações"
for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$file")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done

echo "→ asserções"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/schema-checks.sql"

echo
echo "✓ esquema aplicado e verificado"
echo
echo "Falta configurar no Vercel (Project Settings → Environment Variables):"
echo "  NEXT_PUBLIC_SUPABASE_URL       https://<ref>.supabase.co"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY  (Project Settings → API → anon public)"
echo "  SUPABASE_SERVICE_ROLE_KEY      (Project Settings → API → service_role) — só no servidor"
echo
echo "E os segredos que se geram aqui:"
echo "  ADMIN_SESSION_SECRET  $(node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))" 2>/dev/null || echo '<node -e ...>')"
echo "  IP_HASH_SALT          $(node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))" 2>/dev/null || echo '<node -e ...>')"
echo "  REVALIDATE_SECRET     $(node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))" 2>/dev/null || echo '<node -e ...>')"
echo "  INBOUND_MAIL_SECRET   $(node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))" 2>/dev/null || echo '<node -e ...>')"
echo "  ADMIN_PASSWORD_HASH   gerar com: pnpm dlx tsx scripts/hash-password.ts"
echo
echo "Estes valores aparecem uma vez, aqui. Não ficam guardados em lado nenhum."
