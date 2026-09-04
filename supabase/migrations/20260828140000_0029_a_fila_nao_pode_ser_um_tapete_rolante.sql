-- 0029 — Aprovar um candidato da recolha tem de querer dizer alguma coisa.
--
-- `approve_submission` insere quarenta e tal colunas e não inseria duas:
-- `source_id` e `source_key`. Para quem chega por email não faz diferença —
-- não tem fonte. Para quem chega pela recolha é o que liga o evento à linha da
-- fonte que o trouxe, e sem isso a recolha da noite seguinte não o reconhece:
-- procura por (source_id, source_key), não encontra nada, trata-o como novo, vê
-- que continua sem sítio e **põe-no na fila outra vez**.
--
-- Foi o que aconteceu, e está medido. Cinco eventos de Ourém aprovados de
-- manhã, com o sítio escrito à mão a partir da descrição, estavam à tarde outra
-- vez na fila — publicados e enfileirados ao mesmo tempo. Quem modera faria o
-- mesmo trabalho todas as noites, e a fila nunca esvaziaria.
--
-- Três recolhas seguidas da mesma fonte, com as duas correções pelo meio:
--
--     lidos  iguais  para a fila
--       12       7        5      antes de tudo
--       10       5        5      depois da deduplicação
--       10      10        0      depois desta
--
-- As duas colunas passam a vir da própria submissão, que é o registo
-- autoritativo, e não do formulário: o formulário só envia os quinze campos
-- editáveis e nenhum deles é a chave da fonte.

create or replace function public.approve_submission(
  p_submission_id uuid,
  p_actor text,
  p_event jsonb,
  p_sessions jsonb default '[]'::jsonb,
  p_ip_hash text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sub public.submissions;
  v_event_id uuid;
  v_slug text;
  v_session jsonb;
  v_source_key text;
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

  -- A chave da fonte, por ordem de confiança: o que vier no evento, depois o
  -- que a recolha guardou no payload harmonizado, depois o do bruto.
  v_source_key := coalesce(
    nullif(p_event ->> 'source_key', ''),
    nullif(v_sub.payload -> 'event' ->> 'source_key', ''),
    nullif(v_sub.payload -> 'raw' ->> 'sourceKey', '')
  );

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
    source_id, source_key,
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
    v_sub.source_id,
    v_source_key,
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
    status = excluded.status,
    submission_id = excluded.submission_id,
    -- Nunca se apaga a ligação à fonte com um nulo: quem aprova pode não a
    -- trazer, e o que já lá estava é bom.
    source_id = coalesce(excluded.source_id, public.events.source_id),
    source_key = coalesce(excluded.source_key, public.events.source_key),
    published_at = coalesce(public.events.published_at, excluded.published_at),
    last_seen_at = excluded.last_seen_at,
    updated_at = now();

  delete from public.event_sessions where event_id = v_event_id;
  for v_session in select * from jsonb_array_elements(p_sessions) loop
    insert into public.event_sessions (event_id, session_date, start_time, end_time)
    values (
      v_event_id,
      (v_session ->> 'session_date')::date,
      nullif(v_session ->> 'start_time', '')::time,
      nullif(v_session ->> 'end_time', '')::time
    );
  end loop;

  update public.submissions set
    status = 'approved',
    resulting_event_id = v_event_id,
    reviewed_at = now(),
    reviewed_by = p_actor,
    updated_at = now()
  where id = p_submission_id;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after, ip_hash)
  values (p_actor, 'approve', 'submission', p_submission_id::text, null,
          jsonb_build_object('event_id', v_event_id), p_ip_hash);

  return v_event_id;
end;
$function$;

comment on function public.approve_submission(uuid, text, jsonb, jsonb, text) is
  'Aprova uma submissão e publica o evento. Leva `source_id` e `source_key` da '
  'própria submissão: sem eles a recolha seguinte não reconhece o evento e '
  'volta a pô-lo na fila, todas as noites.';

-- ---------------------------------------------------------------------------
-- E os que já foram aprovados sem a ligação ficam ligados agora, a partir da
-- submissão que lhes deu origem.
-- ---------------------------------------------------------------------------
update public.events e set
  source_id  = s.source_id,
  source_key = coalesce(s.payload -> 'event' ->> 'source_key', s.payload -> 'raw' ->> 'sourceKey'),
  updated_at = now()
from public.submissions s
where s.resulting_event_id = e.id
  and s.source_id is not null
  and e.source_id is null;

do $$
declare
  v_orfaos integer;
begin
  select count(*) into v_orfaos
  from public.events e
  join public.submissions s on s.resulting_event_id = e.id
  where s.source_id is not null and (e.source_id is null or e.source_key is null);

  if v_orfaos > 0 then
    raise exception '% eventos aprovados continuam sem ligação à fonte', v_orfaos;
  end if;
end
$$;
