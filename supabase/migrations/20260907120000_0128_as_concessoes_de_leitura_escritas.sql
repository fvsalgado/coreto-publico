-- 0128 — As concessões de leitura deixam de ser herdadas e passam a estar escritas.
--
-- **O que estava errado.** Nenhuma migração deste repositório concedia a
-- `anon` o direito de ler `events`, `municipalities`, `venues` ou qualquer
-- outra tabela da agenda. O sítio funcionava porque um projeto Supabase novo
-- traz `alter default privileges … grant all on tables to anon, authenticated,
-- service_role` de fábrica: as tabelas nasciam legíveis por herança, e a
-- herança nunca chegou a ser escrita em lado nenhum.
--
-- Isso não é uma imprecisão de arrumação. É o buraco da cópia de segurança.
-- O `pg_dump` da cópia corre com `--no-privileges` (`.github/workflows/
-- backup.yml`), e o restauro com ele: a base restaurada fica com **zero**
-- concessões a `anon`. O ensaio mensal — `scripts/ensaiar-restauro.sh` —
-- passava sobre essa base, porque as verificações que fazia eram sobre o
-- esquema, as linhas e a frescura da cópia, todas coisas que estavam certas.
-- No dia do restauro a sério, a agenda estava toda lá e o sítio não lia uma
-- linha.
--
-- **O que esta migração faz.** Escreve as concessões que hoje se herdam.
-- Em produção não muda nada de efetivo — `anon` já lê estas tabelas — e é de
-- propósito que assim é: a correção não é conceder mais nada, é passar a
-- haver um sítio onde está escrito o que tem de existir. Numa base restaurada
-- (ou numa instalação nova sem os privilégios por omissão do Supabase),
-- aplicar as migrações passa a bastar para o sítio servir.
--
-- **A lista é fechada, e a ausência é tão deliberada como a presença.** Só
-- entram as tabelas que a chave pública lê. Não entram:
--
-- - `sources` — a 0049 revogou a tabela inteira e abriu coluna a coluna, e é
--   isso que impede o `config` (o cabeçalho combinado com Abrantes), o
--   `notes` e o `last_error` de irem para a rua. Um `grant select` à tabela
--   desfazia essa decisão numa linha. As colunas novas entram uma a uma,
--   como a `region_id` entrou na 0107 e a `last_run_at` entra aqui.
-- - `submissions`, `submission_attachments`, `admin_actions`, `rate_limits`,
--   `sender_quotas`, `source_runs`, `event_stats`, `event_stats_snapshots`,
--   `manual_overrides`, `venue_aliases`, `unresolved_venues` — a fila de
--   moderação, a auditoria e os contadores. Entram pela chave de serviço.
--
-- Só `select`. A 0021 tirou a escrita ao público e continua a valer: o que
-- aqui se concede é leitura, e as `schema-checks` contam as concessões de
-- escrita a zero em cada corrida do CI.
--
-- Reaplicável de propósito: `grant` é idempotente, e esta migração existe
-- precisamente para ser corrida por cima de uma base restaurada.

-- ---------------------------------------------------------------------------
-- 1. As tabelas que a agenda pública lê.
-- ---------------------------------------------------------------------------
grant select on public.categories to anon, authenticated;
grant select on public.coretos to anon, authenticated;
grant select on public.event_sessions to anon, authenticated;
grant select on public.events to anon, authenticated;
grant select on public.municipalities to anon, authenticated;
grant select on public.region_domain_aliases to anon, authenticated;
grant select on public.regions to anon, authenticated;
grant select on public.series to anon, authenticated;
grant select on public.site_sections to anon, authenticated;
grant select on public.venues to anon, authenticated;

-- O que separa quem lê de quem escreve continua a ser a RLS, e não isto: as
-- policies dizem que só se veem eventos `published` e `is_canonical`, e a
-- concessão de leitura é a condição prévia, não a decisão.

-- ---------------------------------------------------------------------------
-- 2. Quando a fonte foi lida pela última vez — não só quando correu bem.
-- ---------------------------------------------------------------------------
--
-- A página /fontes só via `last_success_at`, e com ela só sabia dizer «lida
-- com sucesso a 2 de setembro» ou nada. Faltava-lhe distinguir os dois casos
-- que mais interessam a quem desconfia: a fonte que ninguém tentou ler há
-- cinco dias, e a fonte que é lida todas as noites e não traz nada desde
-- então. É a diferença entre um cron parado e uma câmara que mudou de tema, e
-- a resposta é uma data.
--
-- Um instante não é o caderno da recolha: não diz o que correu mal nem por
-- onde. O texto do erro — `last_error` — continua fechado, e é onde estava.
grant select (last_run_at) on public.sources to anon, authenticated;

-- ---------------------------------------------------------------------------
do $$
declare
  v_publicas integer;
  v_proibidas integer;
  v_leitura integer;
  v_escrita integer;
  v_esperadas constant text[] := array[
    'categories', 'coretos', 'event_sessions', 'events', 'municipalities',
    'region_domain_aliases', 'regions', 'series', 'site_sections', 'venues'
  ];
begin
  -- As dez da 0107 mais a `last_run_at`.
  select count(*) into v_publicas
    from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'sources'
      and grantee = 'anon' and privilege_type = 'SELECT';
  if v_publicas <> 11 then
    raise exception 'esperavam-se 11 colunas públicas nas fontes, há %', v_publicas;
  end if;

  -- A garantia da 0049 continua de pé.
  select count(*) into v_proibidas
    from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'sources'
      and grantee = 'anon' and privilege_type = 'SELECT'
      and column_name in ('config', 'notes', 'last_error', 'circuit_open_until',
                          'consecutive_failures', 'baseline_item_count', 'min_expected_items');
  if v_proibidas > 0 then
    raise exception 'a chave anónima ganhou acesso a % colunas internas das fontes', v_proibidas;
  end if;

  -- E a tabela inteira continua fechada: um `grant select on public.sources`
  -- feito de passagem apagava as duas asserções de cima sem as fazer falhar,
  -- porque um privilégio de tabela não aparece em `column_privileges` com
  -- nomes de coluna a mais — aparece como o direito de ler todas.
  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'sources'
       and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
  ) then
    raise exception 'a tabela sources voltou a ser legível por inteiro pelo público';
  end if;

  -- As dez que o sítio precisa de ler, contadas uma a uma. É o piso que
  -- faltava: até aqui, todas as asserções desta casa contavam concessões a
  -- MAIS, e uma base sem concessão nenhuma passava em todas.
  select count(*) into v_leitura
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'
      and privilege_type = 'SELECT' and table_name = any(v_esperadas);
  if v_leitura <> array_length(v_esperadas, 1) then
    raise exception 'faltam concessões de leitura ao público: esperavam-se %, há %',
      array_length(v_esperadas, 1), v_leitura;
  end if;

  -- E nenhuma delas ganhou escrita pelo caminho.
  select count(*) into v_escrita
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if v_escrita > 0 then
    raise exception '% concessões de escrita ao público em public', v_escrita;
  end if;
end
$$;
