-- 0005 — Fila de submissões e moderação.
--
-- Os três canais de entrada (recolha automática, email, formulário público)
-- desaguam todos aqui. Nada é publicado sem passar por esta fila: o canal de
-- email, em particular, NUNCA escreve diretamente em `events`.

create table public.submissions (
  id                    uuid primary key default gen_random_uuid(),
  channel               public.submission_channel not null,
  status                public.submission_status not null default 'pending',

  -- Candidato a evento, já normalizado e validado por schema. É o que o
  -- backoffice mostra e edita antes de aprovar.
  payload               jsonb not null default '{}'::jsonb,

  -- O material em bruto, guardado sempre. Se a extração falhar, o email fica
  -- cá na mesma e alguém consegue tratá-lo à mão — a degradação é graciosa,
  -- não é perda.
  raw_text              text,
  raw_subject           text,
  raw_headers           jsonb,

  -- Remetente (só o mínimo: identificar quem submeteu e poder responder).
  sender_email          text,
  sender_name           text,
  sender_organisation   text,
  -- Nunca guardamos o IP em claro: só um hash com sal, para limitar abuso.
  ip_hash               text,
  user_agent            text,

  -- Pistas resolvidas na normalização
  municipality_id       text references public.municipalities(id) on delete set null,
  venue_id              text references public.venues(id) on delete set null,
  source_id             text references public.sources(id) on delete set null,
  fingerprint           text,
  confidence            numeric(4, 3),

  -- Extração automática (texto, PDF, cartaz)
  extraction_status     public.extraction_status not null default 'pending',
  extraction_error      text,
  extraction_model      text,
  extraction_cost_micros bigint not null default 0,
  extraction_attempts   integer not null default 0,
  next_attempt_at       timestamptz,

  -- Resolução
  duplicate_of_event_id uuid references public.events(id) on delete set null,
  resulting_event_id    uuid references public.events(id) on delete set null,
  review_notes          text,
  reviewed_at           timestamptz,
  reviewed_by           text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint submissions_confidence_range check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index submissions_status_created_idx
  on public.submissions (status, created_at desc);
create index submissions_channel_idx on public.submissions (channel, created_at desc);
create index submissions_fingerprint_idx on public.submissions (fingerprint)
  where fingerprint is not null;
-- Fila de re-tentativa da extração.
create index submissions_retry_idx on public.submissions (next_attempt_at)
  where extraction_status = 'failed' and next_attempt_at is not null;
create index submissions_sender_idx on public.submissions (sender_email, created_at desc)
  where sender_email is not null;

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

alter table public.events
  add constraint events_submission_fk
  foreign key (submission_id) references public.submissions(id) on delete set null;

create index events_submission_idx on public.events (submission_id)
  where submission_id is not null;

-- ---------------------------------------------------------------------------
-- Anexos: PDFs de agenda e cartazes
-- ---------------------------------------------------------------------------
create table public.submission_attachments (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions(id) on delete cascade,
  kind           public.attachment_kind not null default 'other',
  storage_path   text not null,
  filename       text,
  -- Tipo real, apurado pela assinatura do ficheiro — não pelo que o
  -- remetente diz que enviou.
  mime_type      text not null,
  size_bytes     bigint not null,
  checksum       text,
  ocr_text       text,
  ocr_status     public.extraction_status not null default 'pending',
  created_at     timestamptz not null default now(),

  constraint submission_attachments_size check (size_bytes > 0 and size_bytes <= 10485760)
);

create index submission_attachments_submission_idx
  on public.submission_attachments (submission_id);

-- ---------------------------------------------------------------------------
-- Quota por remetente — trava de custo na extração automática
-- ---------------------------------------------------------------------------
create table public.sender_quotas (
  sender_email   text primary key,
  day            date not null default current_date,
  submissions    integer not null default 0,
  extractions    integer not null default 0,
  cost_micros    bigint not null default 0,
  is_blocked     boolean not null default false,
  block_reason   text,
  updated_at     timestamptz not null default now()
);

comment on table public.sender_quotas is
  'Quota diária por remetente. Esgotada a quota, a submissão continua a ser '
  'aceite e guardada em bruto — só não passa pela extração automática.';

-- ---------------------------------------------------------------------------
-- Limitação de tráfego por IP/rota, com estado em Postgres
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket       text not null,              -- '<rota>:<hash do IP>'
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);

-- Incrementa e devolve o número de pedidos na janela corrente. Uma só ida à
-- base de dados por pedido; a janela é fixa, não deslizante, o que é
-- suficiente para travar abuso sem guardar histórico de ninguém.
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_window_seconds integer,
  p_limit integer
)
returns table (allowed boolean, hits integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as rl (bucket, window_start, hits)
  values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start)
  do update set hits = rl.hits + 1
  returning rl.hits into v_hits;

  return query select v_hits <= p_limit, v_hits,
                      v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

-- Limpeza das janelas antigas: chamada pelo cron de manutenção.
create or replace function public.prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.rate_limits where window_start < now() - interval '2 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
