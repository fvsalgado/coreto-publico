-- 0126 — Os cartazes passam a ter medidas.
--
-- A ficha de evento reserva uma vitrine de altura fixa para o cartaz porque
-- não sabe as medidas de nenhum: a moldura não tem altura até a imagem chegar,
-- e quem está a ler o título vê-o fugir meio ecrã para baixo a meio da frase.
-- O comentário em `app/[regiao]/evento/[slug]/page.tsx` já dizia porquê —
-- «não se declara a altura porque ninguém a sabe».
--
-- Passa a saber-se. A recolha lê o cabeçalho de cada cartaz novo (`medidasDaImagem`
-- em `@coreto/core`, um pedido parcial de 32 KB) e guarda-as aqui; a página
-- declara-as no `<img>` e o navegador reserva a caixa certa antes de a imagem
-- existir.
--
-- **Nulo é a resposta normal, não uma falha.** Um cartaz num formato que não se
-- lê (SVG, AVIF), um servidor que respondeu 503 nessa noite, um JPEG com um
-- EXIF grande de mais — todos ficam sem medidas, e a página reserva a vitrine
-- como sempre reservou. É por isso que as colunas são nullable e não têm
-- omissão: um zero aqui seria uma medida, e uma medida errada é pior do que
-- medida nenhuma.

alter table public.events
  add column if not exists image_width  integer,
  add column if not exists image_height integer;

comment on column public.events.image_width is
  'Largura do cartaz em píxeis, lida do cabeçalho na recolha. Nulo quando não se soube.';
comment on column public.events.image_height is
  'Altura do cartaz em píxeis, lida do cabeçalho na recolha. Nulo quando não se soube.';

-- Os mesmos limites do leitor (`MINIMO`/`MAXIMO` em `packages/core/src/imagem.ts`).
-- Um cabeçalho corrompido consegue declarar mil milhões de píxeis, e esse número
-- ia parar a um atributo `height` que reserva um quilómetro de página — pior do
-- que o salto que isto veio resolver. O leitor já o filtra; a base não confia
-- nele para isso, porque quem escreve aqui pode um dia não ser ele.
alter table public.events
  drop constraint if exists events_image_size_plausivel;
alter table public.events
  add constraint events_image_size_plausivel check (
    (image_width is null or (image_width between 1 and 30000)) and
    (image_height is null or (image_height between 1 and 30000))
  );

/*
 * A `approve_submission` não mede nada — e é por isso que tem de esquecer.
 *
 * É a função que a moderação usa para publicar uma submissão, e a moderação
 * deixa editar o `image_url` à mão (ver `EDITABLE_FIELDS`, em
 * `src/lib/admin/fields.ts`). Ela grava o endereço novo sem saber medir seja o
 * que for; as medidas do cartaz antigo ficavam lá.
 *
 * O corpo abaixo é a definição da 0029 **letra por letra**, com duas linhas a
 * mais no `on conflict`. Foi extraído do ficheiro e não reescrito à mão, que é
 * a única forma de garantir que a segunda cópia de uma função de cem linhas não
 * traz uma diferença que ninguém pediu. A alternativa — um `ALTER` que só
 * mexesse no `on conflict` — não existe em Postgres.
 */
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
    -- As duas linhas novas: cartaz diferente, medidas esquecidas.
    --
    -- Esta função não mede nada — quem mede é a recolha — e a moderação deixa
    -- editar o `image_url` à mão. Sem isto, trocar o cartaz de um evento já
    -- medido deixava lá as medidas do cartaz ANTIGO, e o navegador reservava a
    -- caixa de uma imagem para receber outra: exactamente o salto que estas
    -- colunas vieram resolver, agora com um número a garantir que está certo.
    image_width = case
      when excluded.image_url is distinct from public.events.image_url then null
      else public.events.image_width
    end,
    image_height = case
      when excluded.image_url is distinct from public.events.image_url then null
      else public.events.image_height
    end,
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

do $$
declare
  v_definicao text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events'
      and column_name in ('image_width', 'image_height')
    having count(*) = 2
  ) then
    raise exception 'as colunas das medidas não ficaram criadas';
  end if;

  /*
   * A guarda existe e diz o que se quis dizer.
   *
   * É uma asserção sobre a **definição** e não sobre o comportamento: que o
   * Postgres cumpre um `check` não é coisa que valha a pena provar aqui, e a
   * alternativa — inserir uma linha absurda para ver se rebenta — obrigava a
   * inventar um evento inteiro (concelho com chave estrangeira, impressão
   * digital, sítio) e a apanhar exceções que tanto podiam ser a guarda a
   * funcionar como a montagem do teste a falhar. Um teste que passa por engano
   * é pior do que teste nenhum.
   */
  select pg_get_constraintdef(oid) into v_definicao
    from pg_constraint
   where conname = 'events_image_size_plausivel'
     and conrelid = 'public.events'::regclass;

  if v_definicao is null then
    raise exception 'a restrição events_image_size_plausivel não ficou criada';
  end if;
  if v_definicao not like '%30000%' then
    raise exception 'a restrição não traz o limite superior: %', v_definicao;
  end if;

  -- E a `approve_submission` sabe esquecer as medidas quando o cartaz muda.
  if (
    select prosrc from pg_proc
     where proname = 'approve_submission' and pronamespace = 'public'::regnamespace
  ) not like '%image_width = case%' then
    raise exception 'a approve_submission não esquece as medidas ao trocar de cartaz';
  end if;
end
$$;
