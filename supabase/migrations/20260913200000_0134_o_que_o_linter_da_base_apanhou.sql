-- 0134 — Três funções `security definer` ao alcance de quem não tem sessão, e
-- uma tabela sem RLS no esquema exposto.
--
-- Não vêm de uma leitura minha: vêm do linter de segurança da própria Supabase,
-- que corre sobre esta base e que ninguém tinha lido. É o defeito desta casa na
-- forma de sempre — o instrumento existe, funciona, e está verde por não ser
-- olhado. Duas das três funções nasceram na 0129 e a terceira na 0130, ou seja
-- em migrações escritas há seis dias.
--
-- **O que está mal.** A 0007 escreveu a regra numa linha: «nada de
-- `security definer` exposto ao público», e revogou uma a uma as oito funções
-- que existiam nesse dia. A regra ficou escrita e não ficou verificada: as
-- funções de gatilho da 0129 e da 0130 nasceram `security definer` — que é o
-- que têm de ser, porque escrevem em `events` a partir de um gatilho em
-- `venues` — e nasceram com o `execute` que o Postgres dá a PUBLIC por
-- omissão. Medido: `proacl` traz `=X/postgres` nas três, e
-- `has_function_privilege('anon', …, 'execute')` é verdadeiro.
--
-- **O que isto NÃO é.** Não é um buraco aberto. As três devolvem `trigger`, e
-- o Postgres recusa-se a chamar uma função de gatilho diretamente; o PostgREST
-- nem sequer publica `returns trigger` como rota. Não há hoje pedido nenhum que
-- as alcance, e por isso não há nada para corrigir na base a não ser a
-- concessão. O que se corrige aqui é a distância entre a regra que este
-- projeto escreveu para si e o que a base tem — porque a próxima função
-- `security definer` pode devolver uma tabela, e aí a omissão do Postgres é
-- uma rota pública.
--
-- **A tabela.** A `public.migration_checksums` é criada pelo
-- `scripts/aplicar-migracoes.sh` e nunca por uma migração, e por isso nunca
-- passou por aqui: ficou no esquema `public` — que é o que o PostgREST serve —
-- sem RLS e com `select` concedido a `anon`. O que lá está são etiquetas de
-- migração e resumos SHA-256, não segredos; mas é a lista do que este projeto
-- fez à sua base, servida a quem tiver a chave anónima. É a única linha de
-- nível ERRO do linter. Passa a ser criada aqui, com a mesma regra das outras
-- treze tabelas de serviço: RLS ligado e sem policy nenhuma — ninguém lê nem
-- escreve, exceto a chave de serviço.

revoke execute on function public.events_sync_acesso() from public, anon, authenticated;
revoke execute on function public.venues_sync_acesso() from public, anon, authenticated;
revoke execute on function public.eventos_espaco_do_mesmo_concelho() from public, anon, authenticated;

-- `if not exists` porque em produção ela já existe, criada pelo aplicador; em
-- CI nunca existiu, porque o `verify-migrations.sh` corre as migrações
-- diretamente. A definição é a mesma que o guião escreve, à letra.
create table if not exists public.migration_checksums (
  -- O nome estável da migração (`0023_ourem_api`), não o carimbo de tempo: é
  -- o carimbo que difere entre o repositório e quem a aplicou.
  version  text primary key,
  checksum text not null,
  seen_at  timestamptz not null default now()
);

comment on table public.migration_checksums is
  'O resumo de cada ficheiro de migração no momento em que foi aplicado. As '
  'migrações são história e não se reescrevem: uma linha aqui a discordar do '
  'ficheiro quer dizer que alguém o editou depois de aplicado.';

alter table public.migration_checksums enable row level security;
revoke all on table public.migration_checksums from anon, authenticated;

-- ---------------------------------------------------------------------------
-- A prova, e é ela que torna esta migração diferente de uma limpeza.
-- ---------------------------------------------------------------------------
do $$
declare
  v_ao_alcance text;
begin
  select string_agg(p.proname || '() → ' || pg_get_function_result(p.oid), ', ' order by p.proname)
    into v_ao_alcance
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'));

  assert v_ao_alcance is null,
    format('funções security definer ao alcance de quem não é a chave de serviço: %s', v_ao_alcance);

  assert (select relrowsecurity from pg_class
           where oid = 'public.migration_checksums'::regclass),
    'a tabela dos resumos das migrações está no esquema exposto sem RLS';

  assert not has_table_privilege('anon', 'public.migration_checksums', 'select'),
    'o anon continua a ler a lista de migrações aplicadas';
end $$;
