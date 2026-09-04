# Migrações

Uma migração por ficheiro, aplicadas por ordem de nome. O padrão é
`YYYYMMDDHHMMSS_NNNN_descricao.sql` — o carimbo temporal ordena, o número
sequencial dá um nome curto para se falar dela («a 0011»).

Regras:

- **Nunca se edita uma migração já aplicada.** Corrige-se com uma nova.
- Seeds são idempotentes (`on conflict do update`): correr duas vezes não
  duplica nada.
- Alterações de esquema são aditivas sempre que possível. Uma coluna que
  desaparece parte a recolha noturna antes de partir o site.
- Acrescentar um valor a um tipo enumerado é uma migração de uma linha
  (`alter type public.venue_kind add value if not exists 'praca';`). Desde o
  PostgreSQL 12 corre dentro de transação, desde que o valor novo não seja
  usado na mesma. Não é preciso trocar os enums por `text` + `check`.
- `supabase migration new <nome>` cria.

## Como se aplica em produção — e porque é que não é `supabase db push`

**Não corra `supabase db push` contra a produção.** As migrações desta base são
aplicadas uma a uma pela API (`apply_migration`), que carimba a versão com a
hora a que a aplicou, e não com a hora que está no nome do ficheiro. Cada
aplicação abre, por isso, uma divergência nova entre o livro de bordo da
produção (`supabase_migrations.schema_migrations`) e este directório: o ficheiro
diz `20260903120000_0125_…`, o livro ficou com `20260903130844`.

Um `db push` lê essa diferença como «nenhuma destas migrações foi aplicada» e
tenta correr as cento e vinte e quatro de uma vez. Não são idempotentes — a
primeira `create table` rebenta, e o que ficar a meio fica a meio.

**O livro está conciliado a 2026-09-03:** as cento e vinte e quatro linhas têm
o carimbo e a etiqueta do seu ficheiro, sem linhas a mais nem ficheiros sem
linha. Foi assim que a divergência que chegou até à `0126` se fechou. O que a
volta a abrir é a próxima aplicação pela API — e é essa a razão da regra
abaixo, não uma dívida antiga por pagar.

O que vale:

- **A produção aplica-se migração a migração**, pela API, na ordem do nome, **e
  concilia-se logo a seguir.** É um passo do procedimento, não uma arrumação
  para depois: entre a aplicação e a conciliação, o livro está a mentir.
- **O repositório é a verdade para uma base nova.** `scripts/verify-migrations.sh`
  corre-as por ordem contra um Postgres criado de raiz, com as asserções
  todas — é isso que a CI verifica, e é isso que garante que este directório
  continua a construir a base que a produção tem.
- **Os dois livros alinham-se com `scripts/conciliar-registo.sh`**, que
  casa cada linha do livro de bordo com o seu ficheiro e, com `--escrever`,
  lhe põe o carimbo e a etiqueta do ficheiro. O CI ensaia-o a cada corrida.
  Ver `docs/INFRAESTRUTURA.md`. Com o livro alinhado, um `db push` já não veria
  migrações por aplicar — mas a regra fica: uma a uma, pela API, e a
  conciliação a seguir.
- **A sequência salta o `0009`.** O número foi reservado e o que lá ia
  acabou dentro da `0010`; nenhuma migração se perdeu. Fica escrito porque
  quem contar de `0001` a `0021` encontra vinte ficheiros e merece saber
  porquê sem ter de escavar o histórico.

## Cópias de segurança

Ver `docs/BACKUPS.md`.
