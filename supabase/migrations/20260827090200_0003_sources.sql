-- 0003 — Fontes de recolha e registo de execuções.
--
-- Uma fonte é tudo o que produz candidatos a evento sem intervenção humana:
-- o site de uma câmara, o de um equipamento, um PDF de agenda mensal, um
-- feed. Cada uma tem um adaptador (o módulo de recolha) e um estado próprio,
-- para que uma fonte partida nunca leve as outras atrás.

create table public.sources (
  id                    text primary key,  -- slug: 'cm-tomar', 'teatro-virginia'
  name                  text not null,
  kind                  public.source_kind not null default 'municipal_site',
  municipality_id       text references public.municipalities(id) on delete set null,
  venue_id              text references public.venues(id) on delete set null,
  url                   text not null,
  -- Identificador do adaptador em `packages/ingest`. Vários sites municipais
  -- partilham o mesmo CMS, logo o mesmo adaptador com configuração diferente.
  adapter               text not null,
  config                jsonb not null default '{}'::jsonb,
  is_enabled            boolean not null default true,
  schedule              text not null default '0 4 * * *',

  -- Saúde da fonte
  last_run_at           timestamptz,
  last_success_at       timestamptz,
  last_error            text,
  consecutive_failures  integer not null default 0,
  -- Disjuntor: ao fim de N falhas seguidas a fonte deixa de ser tentada até
  -- esta hora. Impede que um site em baixo consuma a janela de recolha toda
  -- e enterre os erros das outras fontes no ruído.
  circuit_open_until    timestamptz,

  -- Deteção de alteração de layout: guardamos quantos eventos a fonte costuma
  -- dar. Uma recolha que devolva muito menos do que isto não é uma agenda
  -- vazia — é quase sempre um seletor que deixou de casar.
  baseline_item_count   integer,
  min_expected_items    integer not null default 0,

  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index sources_enabled_idx on public.sources (is_enabled) where is_enabled = true;
create index sources_municipality_idx on public.sources (municipality_id);

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

create table public.source_runs (
  id                uuid primary key default gen_random_uuid(),
  source_id         text not null references public.sources(id) on delete cascade,
  status            public.run_status not null default 'running',
  triggered_by      text not null default 'cron',
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  duration_ms       integer,

  items_found       integer not null default 0,
  items_new         integer not null default 0,
  items_updated     integer not null default 0,
  items_unchanged   integer not null default 0,
  items_rejected    integer not null default 0,

  -- Pedidos que chegaram a ter resposta e pedidos que nem isso (DNS, TLS,
  -- timeout). A diferença distingue uma agenda vazia de um site inalcançável.
  http_responses    integer not null default 0,
  http_failures     integer not null default 0,

  -- Verdadeiro quando a contagem caiu muito abaixo da linha de base: sinal
  -- de que o site mudou de layout, não de que ficou sem programação.
  layout_drift      boolean not null default false,
  error             text,
  warnings          jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

create index source_runs_source_started_idx
  on public.source_runs (source_id, started_at desc);
create index source_runs_status_idx on public.source_runs (status, started_at desc);

comment on table public.source_runs is
  'Uma linha por execução de cada fonte. É daqui que sai o painel de saúde da '
  'recolha no backoffice e o alerta de fonte parada.';
