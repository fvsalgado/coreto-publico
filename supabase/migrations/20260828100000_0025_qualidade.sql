-- 0025 — Medir a agenda, e não só enchê-la.
--
-- Até aqui o projeto sabia responder a «quantos eventos há?». Não sabia
-- responder a «quantos deles dizem a que horas?», «quantos apontam para um
-- espaço do catálogo em vez de texto solto?», «quantos têm imagem?».
--
-- Sem isso não se sabe se a agenda está a melhorar ou só a crescer — e é a
-- diferença entre uma montra e um depósito. É também o número que se mostra à
-- CIM, que é quem tem de justificar o investimento.

-- ---------------------------------------------------------------------------
-- A fila dos espaços por resolver.
--
-- O harmonizador já sabia quando não conseguia resolver o nome de um espaço:
-- devolvia `unresolvedVenueName` e ninguém o guardava. O nome ficava em
-- `location_name`, o evento aparecia no sítio com o local em texto solto, e a
-- informação de que faltava um alias perdia-se.
--
-- É o mesmo padrão de `unknown_tags`, e pela mesma razão: cada nome resolvido
-- à mão uma vez melhora **todas** as recolhas seguintes, porque o alias fica.
-- O concelho vem junto porque «Casa da Cultura» sem concelho não se resolve —
-- há-as em Ferreira do Zêzere e em Alcanena, e são espaços diferentes.
-- ---------------------------------------------------------------------------
create table public.unresolved_venues (
  -- A chave é o nome normalizado, não o nome cru: «Cine-Teatro São Pedro» e
  -- «CINE TEATRO SAO PEDRO» são o mesmo problema uma vez, não duas.
  normalized      text primary key,
  -- O nome tal como a fonte o escreveu, para quem decide o ver como é.
  name            text not null,
  municipality_id text references public.municipalities(id) on delete cascade,
  hits            integer not null default 1,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  example_url     text,
  -- Marcado quando alguém decidiu que este nome não é um espaço — «Vários
  -- locais», «A anunciar», o nome de um concelho. Sem isto, a fila enche-se
  -- de linhas que voltam todas as noites e ninguém volta a olhar para ela.
  dismissed       boolean not null default false
);

create index unresolved_venues_pendentes_idx
  on public.unresolved_venues (hits desc, last_seen desc)
  where not dismissed;

comment on table public.unresolved_venues is
  'Nomes de espaço que a recolha não conseguiu resolver para o catálogo. Cada '
  'um resolvido à mão vira um alias e melhora todas as recolhas seguintes.';

alter table public.unresolved_venues enable row level security;

-- Sem policy nenhuma, de propósito: esta tabela é da moderação e do processo
-- de recolha, que entram pela chave de serviço. A ausência de policy é a
-- política, e está escrita aqui para quem auditar não a confundir com
-- esquecimento — a mesma convenção das outras onze tabelas.

-- ---------------------------------------------------------------------------
-- Registar um nome por resolver.
--
-- Uma função em vez de um `insert` do lado do cliente para que a soma de
-- `hits` seja atómica: duas fontes do mesmo concelho a correr na mesma noite
-- não podem perder uma contagem uma da outra.
-- ---------------------------------------------------------------------------
create or replace function public.record_unresolved_venue(
  p_name text,
  p_municipality_id text default null,
  p_example_url text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  chave text;
begin
  chave := public.normalize_for_hash(coalesce(p_name, ''));
  if chave = '' then return; end if;

  insert into public.unresolved_venues as uv (
    normalized, name, municipality_id, example_url
  ) values (
    chave, left(trim(p_name), 200), p_municipality_id, p_example_url
  )
  on conflict (normalized) do update set
    hits = uv.hits + 1,
    last_seen = now(),
    -- O concelho e o exemplo só se preenchem se estavam vazios: a primeira
    -- vez que se soube é a que interessa, e reescrever a cada noite fazia a
    -- fila parecer sempre nova.
    municipality_id = coalesce(uv.municipality_id, excluded.municipality_id),
    example_url = coalesce(uv.example_url, excluded.example_url);
end;
$$;

revoke all on function public.record_unresolved_venue(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A vista de qualidade.
--
-- Uma linha por concelho, com o que está preenchido no que está publicado.
-- Só conta eventos publicados e canónicos: o que está na fila de moderação
-- ainda não é a agenda, e um duplicado por decidir contava duas vezes.
--
-- Percentagens em inteiro. Uma casa decimal aqui é falsa precisão — a decisão
-- que estes números informam é «onde é que vale a pena mexer», e para isso
-- 62 e 62,4 dizem exatamente o mesmo.
--
-- São as primeiras vistas deste esquema, por isso fixam a convenção:
-- `security_invoker = true`. Sem isso, uma vista corre com os direitos de quem
-- a criou, e não com os de quem a lê — o que faz dela um buraco por onde a RLS
-- das tabelas por baixo deixa de se aplicar. É um dos enganos mais fáceis de
-- cometer no Supabase, e o mais difícil de ver depois de cometido.
-- ---------------------------------------------------------------------------
create or replace view public.event_quality_by_municipality
with (security_invoker = true) as
select
  m.id   as municipality_id,
  m.name as municipality_name,
  count(e.id)                                                    as published,
  count(e.id) filter (where s.com_hora)                          as with_time,
  count(e.id) filter (where e.venue_id is not null)              as with_venue,
  count(e.id) filter (where e.image_url is not null)             as with_image,
  count(e.id) filter (where e.description is not null)           as with_description,
  count(e.id) filter (where e.is_free or e.price_min is not null) as with_price,
  count(e.id) filter (where e.latitude is not null)              as with_coordinates
from public.municipalities m
left join public.events e
  on e.municipality_id = m.id
 and e.status = 'published'
 and e.is_canonical
left join lateral (
  select bool_or(es.start_time is not null) as com_hora
  from public.event_sessions es
  where es.event_id = e.id
) s on true
group by m.id, m.name;

comment on view public.event_quality_by_municipality is
  'Uma linha por concelho: quantos eventos publicados e quantos deles dizem a '
  'que horas, onde, com que imagem. É o número que responde a «a agenda está a '
  'melhorar ou só a crescer?».';

create or replace view public.event_quality_by_source
with (security_invoker = true) as
select
  src.id   as source_id,
  src.name as source_name,
  src.is_enabled,
  count(e.id)                                                    as published,
  count(e.id) filter (where s.com_hora)                          as with_time,
  count(e.id) filter (where e.venue_id is not null)              as with_venue,
  count(e.id) filter (where e.image_url is not null)             as with_image,
  count(e.id) filter (where e.description is not null)           as with_description,
  count(e.id) filter (where e.is_free or e.price_min is not null) as with_price,
  count(e.id) filter (where e.latitude is not null)              as with_coordinates
from public.sources src
left join public.events e
  on e.source_id = src.id
 and e.status = 'published'
 and e.is_canonical
left join lateral (
  select bool_or(es.start_time is not null) as com_hora
  from public.event_sessions es
  where es.event_id = e.id
) s on true
group by src.id, src.name, src.is_enabled;

comment on view public.event_quality_by_source is
  'A mesma medida por fonte. É por aqui que se vê qual adaptador está a deixar '
  'campos por trazer que a página do lado de lá tem.';

-- As vistas herdam a RLS das tabelas que leem, mas as concessões são suas.
-- Ninguém as lê sem chave de serviço: são números agregados de um catálogo
-- público, mas a fila de moderação e as fontes desligadas aparecem lá, e isso
-- é do backoffice.
revoke all on public.event_quality_by_municipality from public, anon, authenticated;
revoke all on public.event_quality_by_source from public, anon, authenticated;

do $$
begin
  perform 1 from public.event_quality_by_municipality;
  perform 1 from public.event_quality_by_source;

  if (select count(*) from public.event_quality_by_municipality) <> 13 then
    raise exception 'a vista de qualidade tem de ter uma linha por concelho, e são treze';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- A linha de base que ainda não se pode escrever.
--
-- `baseline_item_count` está a `null` em todas as fontes, e é assim que tem de
-- estar: o plano de dados escolheu não inventar um número antes de haver
-- noites. Mas quando as houver, alguém tem de saber qual é — e a alternativa a
-- esta vista é abrir o registo de execuções e contar à mão.
--
-- Devolve a mediana, não a média: uma noite em que o site esteve meio em baixo
-- puxa a média para baixo e não diz nada sobre o que a fonte costuma trazer.
-- E só conta execuções bem sucedidas, pela mesma razão.
--
-- Escrever a linha de base continua a ser uma migração, não um botão. O que
-- isto dá é o número para lá pôr.
-- ---------------------------------------------------------------------------
create or replace view public.source_baseline_proposals
with (security_invoker = true) as
select
  src.id                                as source_id,
  src.name                              as source_name,
  src.baseline_item_count               as baseline_atual,
  count(r.id)                           as execucoes_boas,
  min(r.items_found)                    as minimo,
  round(percentile_cont(0.5) within group (order by r.items_found))::int as mediana,
  max(r.items_found)                    as maximo
from public.sources src
left join public.source_runs r
  on r.source_id = src.id
 and r.status = 'success'
 and r.started_at > now() - interval '30 days'
group by src.id, src.name, src.baseline_item_count;

comment on view public.source_baseline_proposals is
  'O que cada fonte costuma trazer, para calibrar `baseline_item_count` com '
  'dados em vez de com um palpite. Mediana e não média: uma noite com o site '
  'meio em baixo não diz nada sobre o normal.';

revoke all on public.source_baseline_proposals from public, anon, authenticated;
