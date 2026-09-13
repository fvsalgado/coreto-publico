-- 0004 — Eventos e sessões.
--
-- Um evento = uma peça de programação. As datas vivem em `event_sessions`
-- (uma linha por ocorrência), e `date_start`/`date_end` são derivados por
-- trigger para que as listagens filtrem e ordenem sem juntar tabelas.
-- Recorrências são descritas em `recurrence` e expandidas em sessões pelo
-- pipeline: a base de dados guarda ocorrências, não regras por resolver.

create table public.events (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,

  -- Identidade editorial
  title                   text not null,
  title_raw               text,            -- forma original da fonte
  subtitle                text,
  description             text,
  description_short       text,

  -- Onde
  municipality_id         text not null references public.municipalities(id) on delete restrict,
  venue_id                text references public.venues(id) on delete set null,
  location_name           text,            -- local livre, quando não há venue
  location_address        text,
  parish                  text,
  latitude                double precision,
  longitude               double precision,
  how_to_arrive           text,

  -- Programação
  series_id               text references public.series(id) on delete set null,
  category_slug           text references public.categories(slug) on delete set null,
  category_confidence     numeric(4, 3),
  categories_raw          text[] not null default '{}',
  tags                    text[] not null default '{}',
  audience                public.event_audience,
  min_age                 smallint,

  -- Datas (derivadas de event_sessions pelo trigger `events_refresh_dates`)
  date_start              date,
  date_end                date,
  is_ongoing              boolean not null default false,
  recurrence              jsonb,
  duration_minutes        integer,

  -- Preço
  is_free                 boolean not null default false,
  price_min               numeric(8, 2),
  price_max               numeric(8, 2),
  price_display           text,
  price_raw               text,
  ticketing_url           text,

  -- Acessibilidade
  wheelchair_accessible   boolean,
  has_sign_language       boolean not null default false,
  has_audio_description   boolean not null default false,
  has_subtitles           boolean not null default false,
  is_relaxed_performance  boolean not null default false,
  accessibility_notes     text,

  -- Imagem
  image_url               text,
  image_credit            text,
  image_alt               text,

  -- Estado e proveniência
  status                  public.event_status not null default 'draft',
  origin                  public.event_origin not null default 'scraper',
  -- Score de confiança [0,1]: quão fiável é este registo. Sobe com fonte
  -- oficial, campos completos e revisão humana; desce com extração
  -- automática e campos em falta.
  confidence              numeric(4, 3) not null default 0.5,

  source_id               text references public.sources(id) on delete set null,
  source_key              text,            -- id do evento na fonte
  source_url              text,
  submission_id           uuid,            -- FK adiada para 0005 (submissions)

  -- Deduplicação
  fingerprint             text not null,
  -- Quando dois registos são «quase iguais», ficam ligados por este grupo e
  -- esperam decisão humana em vez de serem fundidos às cegas.
  duplicate_group_id      uuid,
  is_canonical            boolean not null default true,
  content_hash            text,            -- deteção de alteração na fonte

  raw                     jsonb,
  published_at            timestamptz,
  last_seen_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint events_confidence_range check (confidence >= 0 and confidence <= 1),
  constraint events_price_order check (
    price_min is null or price_max is null or price_max >= price_min
  ),
  constraint events_date_order check (
    date_start is null or date_end is null or date_end >= date_start
  ),
  -- Um evento tem de dizer onde é: ou um espaço do catálogo, ou um local livre.
  constraint events_has_location check (
    venue_id is not null or location_name is not null
  )
);

create table public.event_sessions (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events(id) on delete cascade,
  session_date       date not null,
  start_time         time,
  end_time           time,
  -- Sessões de um mesmo evento podem mudar de sítio (itinerâncias da rede
  -- CAMINHOS/VOLver fazem exatamente isto).
  venue_id           text references public.venues(id) on delete set null,
  location_override  text,
  is_cancelled       boolean not null default false,
  notes              text,
  created_at         timestamptz not null default now()
);

-- Uma sessão é única por (evento, data, hora). `coalesce` porque NULL não
-- colide consigo próprio num índice único.
create unique index event_sessions_unique_idx
  on public.event_sessions (event_id, session_date, coalesce(start_time, '00:00'::time));

create index event_sessions_event_idx on public.event_sessions (event_id);
create index event_sessions_date_idx on public.event_sessions (session_date)
  where is_cancelled = false;

-- ---------------------------------------------------------------------------
-- Índices de leitura: data, concelho, categoria — os três eixos do site
-- ---------------------------------------------------------------------------

-- O índice que serve a esmagadora maioria das listagens públicas.
create index events_published_date_idx
  on public.events (date_start, date_end)
  where status = 'published' and is_canonical = true;

create index events_municipality_date_idx
  on public.events (municipality_id, date_start)
  where status = 'published' and is_canonical = true;

create index events_category_date_idx
  on public.events (category_slug, date_start)
  where status = 'published' and is_canonical = true;

create index events_venue_date_idx
  on public.events (venue_id, date_start)
  where status = 'published' and is_canonical = true;

create index events_series_idx on public.events (series_id)
  where series_id is not null;

create index events_free_idx on public.events (date_start)
  where status = 'published' and is_canonical = true and is_free = true;

create index events_accessible_idx on public.events (date_start)
  where status = 'published' and is_canonical = true and wheelchair_accessible = true;

create index events_status_idx on public.events (status);
create index events_fingerprint_idx on public.events (fingerprint);
create index events_duplicate_group_idx on public.events (duplicate_group_id)
  where duplicate_group_id is not null;
create index events_title_trgm_idx on public.events using gin (title extensions.gin_trgm_ops);

-- Idempotência da recolha: uma fonte não pode publicar o mesmo id duas vezes.
create unique index events_source_key_idx
  on public.events (source_id, source_key)
  where source_id is not null and source_key is not null;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Datas derivadas
-- ---------------------------------------------------------------------------

create or replace function public.refresh_event_dates(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.events e
     set date_start = s.first_date,
         date_end   = s.last_date
    from (
      select min(session_date) as first_date,
             max(session_date) as last_date
        from public.event_sessions
       where event_id = target
         and is_cancelled = false
    ) s
   where e.id = target
     and (e.date_start is distinct from s.first_date
       or e.date_end   is distinct from s.last_date);
$$;

create or replace function public.event_sessions_sync_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_event_dates(coalesce(new.event_id, old.event_id));
  return null;
end;
$$;

create trigger event_sessions_sync_dates_trg
  after insert or update or delete on public.event_sessions
  for each row execute function public.event_sessions_sync_dates();
