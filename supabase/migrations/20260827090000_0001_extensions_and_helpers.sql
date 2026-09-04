-- 0001 — Extensões, tipos e funções auxiliares partilhadas.
--
-- Convenção de nomes: identificadores em inglês; conteúdo (rótulos, textos
-- visíveis) em português. Todas as tabelas têm `created_at`/`updated_at` em
-- `timestamptz`, mantidos pelo trigger `set_updated_at()`.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------

create type public.venue_kind as enum (
  'theatre',
  'cinema',
  'museum',
  'library',
  'gallery',
  'cultural_centre',
  'auditorium',
  'bandstand',
  'heritage',
  'religious',
  'association',
  'market',
  'outdoor',
  'education',
  'other'
);

-- `provisional` marca os espaços que entraram no seed a partir de fontes
-- secundárias e ainda não foram confirmados no terreno. Aparecem no site,
-- mas o backoffice sabe distingui-los.
create type public.venue_status as enum ('active', 'provisional', 'seasonal', 'closed');

create type public.series_kind as enum ('festival', 'cycle', 'network_programme');

create type public.event_status as enum (
  'draft',
  'published',
  'hidden',
  'cancelled',
  'postponed',
  'archived'
);

create type public.event_origin as enum ('scraper', 'email', 'form', 'manual');

create type public.event_audience as enum (
  'all_ages',
  'family',
  'children',
  'youth',
  'adults',
  'seniors',
  'schools',
  'professionals'
);

create type public.source_kind as enum (
  'municipal_site',
  'venue_site',
  'pdf_agenda',
  'feed',
  'manual'
);

create type public.run_status as enum ('running', 'success', 'partial', 'failed');

create type public.submission_channel as enum ('scraper', 'email', 'form');

create type public.submission_status as enum (
  'pending',
  'approved',
  'rejected',
  'merged',
  'duplicate',
  'needs_info'
);

create type public.extraction_status as enum ('pending', 'ok', 'failed', 'skipped');

create type public.attachment_kind as enum ('pdf', 'image', 'other');

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------

-- Slug ASCII, minúsculas, separado por hífenes. `immutable` para poder ser
-- usado em índices e colunas geradas.
create or replace function public.slugify(input text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select trim(
    both '-' from regexp_replace(
      lower(extensions.unaccent('extensions.unaccent', input)),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
$$;

-- Normalização apertada para efeitos de comparação/impressão digital: perde
-- acentos, pontuação e espaços. Duas grafias que só diferem numa vírgula ou
-- num apóstrofo tipográfico produzem a mesma chave.
create or replace function public.normalize_for_hash(input text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(
    lower(extensions.unaccent('extensions.unaccent', coalesce(input, ''))),
    '[^a-z0-9]',
    '',
    'g'
  );
$$;

-- Impressão digital de deduplicação: título normalizado + primeira data +
-- concelho. É a chave com que a recolha reconhece um evento que já cá está —
-- mudar esta fórmula reescreve a chave de todo o catálogo e faz entrar tudo
-- outra vez como novo. Se um dia for preciso outro critério, escreve-se uma
-- função nova ao lado.
create or replace function public.event_fingerprint(
  title text,
  event_date date,
  municipality_id text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(
      public.normalize_for_hash(title)
        || '|' || coalesce(event_date::text, '')
        || '|' || coalesce(municipality_id, ''),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
