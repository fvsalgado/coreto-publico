-- 0115 — Uma política de leitura só, e índices onde as chaves estrangeiras
-- não os tinham.
--
-- ## A política
--
-- O público lia `events` por duas políticas somadas com «ou»: a
-- `events_public_read` (0007), que deixa passar o que está publicado, e a
-- `events_past_series_read` (0064), que abre a parte do arquivo que é um
-- registo e não um engano — a edição passada de um ciclo, arquivada por ter
-- acontecido, com nome de ciclo e canónica. O Postgres avalia as duas em cada
-- leitura pública, e o linter do Supabase assinala-o («multiple permissive
-- policies», o único aviso da base). Passam a uma só, com o `using` das duas
-- unido por `or`: quem lia ontem lê exatamente o mesmo hoje. A razão da 0064
-- não se perde — fica no comentário da política, que é onde quem abrir a base
-- a vai ler.
--
-- `alter policy` e não `drop` + `create`: a política que fica é a de sempre,
-- com o mesmo nome, e nunca houve um instante sem ela.
--
-- ## Os índices
--
-- Treze chaves estrangeiras sem índice, apontadas pelo mesmo linter. Sem
-- índice, apagar ou alterar a linha apontada obriga a varrer a tabela que
-- aponta, e as junções por essa coluna também. Um índice por chave, com o
-- nome da casa (`<tabela>_<coluna>_idx`, como `coretos_municipality_idx`), e
-- `if not exists` para a migração ser inofensiva numa base que já os tenha.
--
-- Os índices que o linter diz nunca terem sido usados ficam: a base tem uma
-- semana de tráfego, e um índice que ainda não serviu não é um índice a mais.

alter policy events_public_read on public.events
  using (
    status = 'published'
    or (
      status = 'archived'
      and archived_reason = 'passado'
      and series_id is not null
      and is_canonical
    )
  );

comment on policy events_public_read on public.events is
  'O que está publicado, e a edição passada de um ciclo — arquivada por ter '
  'acontecido, com ciclo e canónica — que é um registo público. O resto do '
  'arquivo não.';

drop policy if exists events_past_series_read on public.events;

create index if not exists coretos_venue_idx
  on public.coretos (venue_id);
create index if not exists municipalities_region_idx
  on public.municipalities (region_id);
create index if not exists region_domain_aliases_region_idx
  on public.region_domain_aliases (region_id);
create index if not exists region_licenses_region_idx
  on public.region_licenses (region_id);
create index if not exists series_municipality_idx
  on public.series (municipality_id);
create index if not exists series_region_idx
  on public.series (region_id);
create index if not exists sources_region_idx
  on public.sources (region_id);
create index if not exists sources_venue_idx
  on public.sources (venue_id);
create index if not exists submissions_duplicate_of_event_idx
  on public.submissions (duplicate_of_event_id);
create index if not exists submissions_region_idx
  on public.submissions (region_id);
create index if not exists submissions_source_idx
  on public.submissions (source_id);
create index if not exists submissions_venue_idx
  on public.submissions (venue_id);
create index if not exists unresolved_venues_municipality_idx
  on public.unresolved_venues (municipality_id);
