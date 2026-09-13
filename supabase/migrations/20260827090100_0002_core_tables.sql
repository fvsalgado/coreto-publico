-- 0002 — Núcleo do domínio: concelhos, espaços, ciclos, coretos e taxonomia.

-- ---------------------------------------------------------------------------
-- municipalities — os concelhos da CIM do Médio Tejo (13; ver migração 0016)
-- ---------------------------------------------------------------------------
create table public.municipalities (
  id            text primary key,          -- slug: 'tomar', 'torres-novas', ...
  name          text not null,
  district      text not null default 'Santarém',
  dico_code     text unique,               -- código INE (distrito+concelho)
  latitude      double precision,
  longitude     double precision,
  website_url   text,
  agenda_url    text,                      -- agenda municipal de origem
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.municipalities is
  'Os concelhos servidos pelo Coreto. O `id` é o slug usado nos URLs.';

create trigger municipalities_set_updated_at
  before update on public.municipalities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories — catálogo fechado, com aliases para mapear as etiquetas das fontes
-- ---------------------------------------------------------------------------
create table public.categories (
  slug        text primary key,
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table public.category_aliases (
  alias         text primary key,          -- já normalizado por normalize_for_hash
  category_slug text not null references public.categories(slug) on delete cascade,
  created_at    timestamptz not null default now()
);

create index category_aliases_category_idx on public.category_aliases (category_slug);

comment on table public.category_aliases is
  'Mapa das etiquetas das fontes para o catálogo fechado. Uma etiqueta sem '
  'correspondência é registada em `unknown_tags` para revisão, nunca inventada.';

create table public.unknown_tags (
  tag         text primary key,
  hits        integer not null default 1,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  example_url text
);

-- ---------------------------------------------------------------------------
-- venues — equipamentos, coletividades e locais de programação
-- ---------------------------------------------------------------------------
create table public.venues (
  id                    text primary key,  -- slug estável: 'cine-teatro-paraiso'
  name                  text not null,
  short_name            text,
  municipality_id       text not null references public.municipalities(id) on delete restrict,
  parish                text,              -- freguesia
  kind                  public.venue_kind not null default 'other',
  status                public.venue_status not null default 'active',
  -- A cauda longa associativa (filarmónicas, ranchos, coletividades,
  -- cineclubes) é o que distingue esta agenda de um portal de equipamentos.
  -- A flag existe para lhe poder dar palco explicitamente.
  is_association        boolean not null default false,
  address               text,
  postal_code           text,
  latitude              double precision,
  longitude             double precision,
  -- «Como chegar»: texto livre hoje, ponto de ligação à mobilidade da CIMT
  -- (serviço LINK, transporte a pedido) quando essa integração existir.
  how_to_arrive         text,
  website_url           text,
  ticketing_url         text,
  phone                 text,
  email                 text,
  wheelchair_accessible boolean,
  accessibility_notes   text,
  image_url             text,
  image_credit          text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index venues_municipality_idx on public.venues (municipality_id);
create index venues_status_idx on public.venues (status);
create index venues_name_trgm_idx on public.venues using gin (name extensions.gin_trgm_ops);

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

-- Aliases de espaços: o nome que a fonte escreve raramente é o nome canónico
-- ('Cine-Teatro Paraíso', 'Cineteatro Paraiso', 'CT Paraíso'). Resolver por
-- alias antes de cair na comparação difusa evita criar espaços fantasma.
create table public.venue_aliases (
  alias      text primary key,             -- normalizado por normalize_for_hash
  venue_id   text not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index venue_aliases_venue_idx on public.venue_aliases (venue_id);

-- ---------------------------------------------------------------------------
-- series — festivais, ciclos e programação em rede (CAMINHOS, VOLver)
-- ---------------------------------------------------------------------------
create table public.series (
  id              text primary key,
  name            text not null,
  kind            public.series_kind not null default 'festival',
  municipality_id text references public.municipalities(id) on delete set null,
  description     text,
  website_url     text,
  image_url       text,
  is_regional     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.series is
  'Festivais, ciclos e programação em rede. `is_regional` marca o que atravessa '
  'concelhos — os projetos da CIMT (CAMINHOS, VOLver) vivem aqui.';

create trigger series_set_updated_at
  before update on public.series
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- coretos — a identidade da marca, e um mapa a sério
-- ---------------------------------------------------------------------------
create table public.coretos (
  id              text primary key,
  name            text not null,
  parish          text,
  municipality_id text not null references public.municipalities(id) on delete restrict,
  latitude        double precision,
  longitude       double precision,
  year_built      integer,
  is_confirmed    boolean not null default true,
  venue_id        text references public.venues(id) on delete set null,
  photo_url       text,
  photo_credit    text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.coretos is
  'Os coretos reais da região — o palco popular que dá nome ao projeto. '
  '`is_confirmed` a falso marca os que ainda faltam verificar no terreno.';

create index coretos_municipality_idx on public.coretos (municipality_id);

create trigger coretos_set_updated_at
  before update on public.coretos
  for each row execute function public.set_updated_at();
