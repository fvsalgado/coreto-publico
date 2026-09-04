-- 0007 — RLS.
--
-- Postura: o público lê o que está publicado e nada mais. Não há contas nem
-- área reservada — a única escrita vem do servidor, com a chave de serviço,
-- que ignora RLS por definição. Por isso não existe uma única policy de
-- escrita: se um dia aparecer uma, é sinal de que algo correu mal.

alter table public.municipalities        enable row level security;
alter table public.categories            enable row level security;
alter table public.category_aliases      enable row level security;
alter table public.unknown_tags          enable row level security;
alter table public.venues                enable row level security;
alter table public.venue_aliases         enable row level security;
alter table public.series                enable row level security;
alter table public.coretos               enable row level security;
alter table public.sources               enable row level security;
alter table public.source_runs           enable row level security;
alter table public.events                enable row level security;
alter table public.event_sessions        enable row level security;
alter table public.submissions           enable row level security;
alter table public.submission_attachments enable row level security;
alter table public.sender_quotas         enable row level security;
alter table public.rate_limits           enable row level security;
alter table public.admin_actions         enable row level security;

-- ---------------------------------------------------------------------------
-- Leitura pública
-- ---------------------------------------------------------------------------

create policy municipalities_public_read on public.municipalities
  for select to anon, authenticated using (true);

create policy categories_public_read on public.categories
  for select to anon, authenticated using (true);

create policy series_public_read on public.series
  for select to anon, authenticated using (true);

create policy coretos_public_read on public.coretos
  for select to anon, authenticated using (true);

create policy venues_public_read on public.venues
  for select to anon, authenticated using (status <> 'closed');

create policy events_public_read on public.events
  for select to anon, authenticated using (status = 'published');

create policy event_sessions_public_read on public.event_sessions
  for select to anon, authenticated using (
    exists (
      select 1 from public.events e
       where e.id = event_sessions.event_id
         and e.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------
-- Sem policies: category_aliases, unknown_tags, venue_aliases, sources,
-- source_runs, submissions, submission_attachments, sender_quotas,
-- rate_limits, admin_actions.
--
-- RLS ligado sem policy = ninguém lê nem escreve, exceto a chave de serviço.
-- É exatamente o pretendido: a fila de moderação, os endereços de quem
-- submete e o registo de auditoria não são dados públicos.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Funções: nada de `security definer` exposto ao público
-- ---------------------------------------------------------------------------

revoke execute on function public.approve_submission(uuid, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.reject_submission(uuid, text, public.submission_status, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.merge_events(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.log_admin_action(text, text, text, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.find_duplicate_candidates(text, date, text, real) from public, anon, authenticated;
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.prune_rate_limits() from public, anon, authenticated;
revoke execute on function public.refresh_event_dates(uuid) from public, anon, authenticated;

grant execute on function public.approve_submission(uuid, text, jsonb, jsonb, text) to service_role;
grant execute on function public.reject_submission(uuid, text, public.submission_status, text, uuid, text) to service_role;
grant execute on function public.merge_events(uuid, uuid, text, text) to service_role;
grant execute on function public.log_admin_action(text, text, text, text, jsonb, jsonb, text) to service_role;
grant execute on function public.find_duplicate_candidates(text, date, text, real) to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.prune_rate_limits() to service_role;
grant execute on function public.refresh_event_dates(uuid) to service_role;

-- As funções puras de normalização não tocam em dados e são úteis em queries.
grant execute on function public.slugify(text) to anon, authenticated, service_role;
grant execute on function public.normalize_for_hash(text) to anon, authenticated, service_role;
grant execute on function public.event_fingerprint(text, date, text) to anon, authenticated, service_role;
