-- 0006 — Moderação: auditoria e as ações que publicam.
--
-- Toda a ação de moderação passa por uma função `security definer` que
-- escreve o antes e o depois em `admin_actions`. Não há caminho para publicar
-- que não deixe rasto.

create table public.admin_actions (
  id           bigint generated always as identity primary key,
  actor        text not null,
  action       text not null,              -- 'submission.approve', 'event.hide', ...
  entity_type  text not null,
  entity_id    text not null,
  before       jsonb,
  after        jsonb,
  ip_hash      text,
  created_at   timestamptz not null default now()
);

create index admin_actions_entity_idx on public.admin_actions (entity_type, entity_id, created_at desc);
create index admin_actions_created_idx on public.admin_actions (created_at desc);

create or replace function public.log_admin_action(
  p_actor text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_ip_hash text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after, ip_hash)
  values (p_actor, p_action, p_entity_type, p_entity_id, p_before, p_after, p_ip_hash)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aprovar uma submissão: cria (ou atualiza) o evento e fecha a submissão
-- ---------------------------------------------------------------------------
create or replace function public.approve_submission(
  p_submission_id uuid,
  p_actor text,
  p_event jsonb,
  p_sessions jsonb default '[]'::jsonb,
  p_ip_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
  v_event_id uuid;
  v_slug text;
  v_session jsonb;
  v_before jsonb;
begin
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submissão % não existe', p_submission_id;
  end if;
  if v_sub.status <> 'pending' and v_sub.status <> 'needs_info' then
    raise exception 'submissão % já foi resolvida (%)', p_submission_id, v_sub.status;
  end if;

  v_event_id := coalesce((p_event ->> 'id')::uuid, gen_random_uuid());
  v_slug := coalesce(
    nullif(p_event ->> 'slug', ''),
    public.slugify(p_event ->> 'title') || '-' || substr(v_event_id::text, 1, 6)
  );

  select to_jsonb(e) into v_before from public.events e where e.id = v_event_id;

  insert into public.events (
    id, slug, title, title_raw, subtitle, description, description_short,
    municipality_id, venue_id, location_name, location_address, parish,
    latitude, longitude, how_to_arrive, series_id, category_slug, tags,
    audience, min_age, is_ongoing, recurrence, duration_minutes,
    is_free, price_min, price_max, price_display, price_raw, ticketing_url,
    wheelchair_accessible, has_sign_language, has_audio_description,
    has_subtitles, is_relaxed_performance, accessibility_notes,
    image_url, image_credit, image_alt,
    status, origin, confidence, fingerprint, submission_id, source_url,
    published_at, last_seen_at
  )
  select
    v_event_id, v_slug,
    p_event ->> 'title',
    p_event ->> 'title_raw',
    p_event ->> 'subtitle',
    p_event ->> 'description',
    p_event ->> 'description_short',
    p_event ->> 'municipality_id',
    nullif(p_event ->> 'venue_id', ''),
    nullif(p_event ->> 'location_name', ''),
    nullif(p_event ->> 'location_address', ''),
    nullif(p_event ->> 'parish', ''),
    (p_event ->> 'latitude')::double precision,
    (p_event ->> 'longitude')::double precision,
    nullif(p_event ->> 'how_to_arrive', ''),
    nullif(p_event ->> 'series_id', ''),
    nullif(p_event ->> 'category_slug', ''),
    coalesce((select array_agg(value #>> '{}') from jsonb_array_elements(p_event -> 'tags')), '{}'),
    nullif(p_event ->> 'audience', '')::public.event_audience,
    (p_event ->> 'min_age')::smallint,
    coalesce((p_event ->> 'is_ongoing')::boolean, false),
    p_event -> 'recurrence',
    (p_event ->> 'duration_minutes')::integer,
    coalesce((p_event ->> 'is_free')::boolean, false),
    (p_event ->> 'price_min')::numeric,
    (p_event ->> 'price_max')::numeric,
    nullif(p_event ->> 'price_display', ''),
    nullif(p_event ->> 'price_raw', ''),
    nullif(p_event ->> 'ticketing_url', ''),
    (p_event ->> 'wheelchair_accessible')::boolean,
    coalesce((p_event ->> 'has_sign_language')::boolean, false),
    coalesce((p_event ->> 'has_audio_description')::boolean, false),
    coalesce((p_event ->> 'has_subtitles')::boolean, false),
    coalesce((p_event ->> 'is_relaxed_performance')::boolean, false),
    nullif(p_event ->> 'accessibility_notes', ''),
    nullif(p_event ->> 'image_url', ''),
    nullif(p_event ->> 'image_credit', ''),
    nullif(p_event ->> 'image_alt', ''),
    'published'::public.event_status,
    coalesce(nullif(p_event ->> 'origin', ''), v_sub.channel::text)::public.event_origin,
    coalesce((p_event ->> 'confidence')::numeric, v_sub.confidence, 0.9),
    coalesce(
      nullif(p_event ->> 'fingerprint', ''),
      public.event_fingerprint(
        p_event ->> 'title',
        (p_event ->> 'date_start')::date,
        p_event ->> 'municipality_id'
      )
    ),
    p_submission_id,
    nullif(p_event ->> 'source_url', ''),
    now(), now()
  on conflict (id) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    municipality_id = excluded.municipality_id,
    venue_id = excluded.venue_id,
    location_name = excluded.location_name,
    category_slug = excluded.category_slug,
    is_free = excluded.is_free,
    price_min = excluded.price_min,
    price_max = excluded.price_max,
    ticketing_url = excluded.ticketing_url,
    image_url = excluded.image_url,
    status = 'published',
    confidence = excluded.confidence,
    submission_id = excluded.submission_id,
    updated_at = now();

  -- Sessões: substituídas por inteiro, porque o editor viu a lista completa.
  delete from public.event_sessions where event_id = v_event_id;
  for v_session in select * from jsonb_array_elements(p_sessions)
  loop
    insert into public.event_sessions (event_id, session_date, start_time, end_time, venue_id, location_override, notes)
    values (
      v_event_id,
      (v_session ->> 'session_date')::date,
      nullif(v_session ->> 'start_time', '')::time,
      nullif(v_session ->> 'end_time', '')::time,
      nullif(v_session ->> 'venue_id', ''),
      nullif(v_session ->> 'location_override', ''),
      nullif(v_session ->> 'notes', '')
    )
    on conflict do nothing;
  end loop;

  update public.submissions
     set status = 'approved',
         resulting_event_id = v_event_id,
         reviewed_at = now(),
         reviewed_by = p_actor
   where id = p_submission_id;

  perform public.log_admin_action(
    p_actor, 'submission.approve', 'submission', p_submission_id::text,
    v_before, jsonb_build_object('event_id', v_event_id), p_ip_hash
  );

  return v_event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rejeitar / marcar como duplicada
-- ---------------------------------------------------------------------------
create or replace function public.reject_submission(
  p_submission_id uuid,
  p_actor text,
  p_status public.submission_status,
  p_notes text default null,
  p_duplicate_of uuid default null,
  p_ip_hash text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if p_status not in ('rejected', 'duplicate', 'needs_info') then
    raise exception 'estado inválido para rejeição: %', p_status;
  end if;

  select to_jsonb(s) into v_before from public.submissions s where s.id = p_submission_id;
  if v_before is null then
    raise exception 'submissão % não existe', p_submission_id;
  end if;

  update public.submissions
     set status = p_status,
         review_notes = p_notes,
         duplicate_of_event_id = p_duplicate_of,
         reviewed_at = now(),
         reviewed_by = p_actor
   where id = p_submission_id;

  perform public.log_admin_action(
    p_actor, 'submission.' || p_status::text, 'submission', p_submission_id::text,
    v_before, jsonb_build_object('status', p_status, 'notes', p_notes), p_ip_hash
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Fundir dois eventos quase-iguais
-- ---------------------------------------------------------------------------
create or replace function public.merge_events(
  p_canonical_id uuid,
  p_duplicate_id uuid,
  p_actor text,
  p_ip_hash text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if p_canonical_id = p_duplicate_id then
    raise exception 'não se funde um evento consigo próprio';
  end if;

  select to_jsonb(e) into v_before from public.events e where e.id = p_duplicate_id;
  if v_before is null then
    raise exception 'evento % não existe', p_duplicate_id;
  end if;

  -- As sessões do duplicado passam para o canónico; as que já lá estão
  -- (mesma data e hora) são descartadas pelo índice único.
  insert into public.event_sessions (event_id, session_date, start_time, end_time, venue_id, location_override, notes)
  select p_canonical_id, session_date, start_time, end_time, venue_id, location_override, notes
    from public.event_sessions
   where event_id = p_duplicate_id
  on conflict do nothing;

  update public.events
     set status = 'archived',
         is_canonical = false,
         duplicate_group_id = coalesce(duplicate_group_id, p_canonical_id)
   where id = p_duplicate_id;

  perform public.refresh_event_dates(p_canonical_id);

  perform public.log_admin_action(
    p_actor, 'event.merge', 'event', p_duplicate_id::text,
    v_before, jsonb_build_object('canonical_id', p_canonical_id), p_ip_hash
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Candidatos a duplicado: os «quase iguais» que esperam decisão humana
-- ---------------------------------------------------------------------------
create or replace function public.find_duplicate_candidates(
  p_title text,
  p_date date,
  p_municipality_id text,
  p_threshold real default 0.55
)
returns table (
  event_id uuid,
  title text,
  date_start date,
  similarity real,
  exact_fingerprint boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id,
         e.title,
         e.date_start,
         extensions.similarity(
           public.normalize_for_hash(e.title),
           public.normalize_for_hash(p_title)
         ) as similarity,
         e.fingerprint = public.event_fingerprint(p_title, p_date, p_municipality_id)
    from public.events e
   where e.municipality_id = p_municipality_id
     and e.status <> 'archived'
     -- Uma janela de três dias apanha o mesmo espetáculo anunciado com a data
     -- trocada por um dia sem apanhar a reposição do mês seguinte.
     and (p_date is null or e.date_start between p_date - 3 and p_date + 3)
     and extensions.similarity(
           public.normalize_for_hash(e.title),
           public.normalize_for_hash(p_title)
         ) >= p_threshold
   order by similarity desc
   limit 20;
$$;
