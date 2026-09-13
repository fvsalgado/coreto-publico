-- 0143 — A percentagem e a lista passam a contar o mesmo.
--
-- `/admin/qualidade` mede «Descrição» em percentagem; `/admin/eventos?falta=
-- descricao` abre a lista dos que não a têm. São o mesmo facto visto de dois
-- lados, e a partir da vaga 7 a percentagem passa a ser uma ligação para a
-- lista — o que só se pode fazer se as duas contarem a mesma população.
--
-- Não contavam. A vista conta `description is not null`; o filtro do painel
-- conta `is null` **ou vazia**, porque uma descrição vazia não é uma
-- descrição. Uma cadeia vazia entrava nos dois lados com sinais contrários:
-- somava a «com descrição» na percentagem e aparecia na lista de trabalho.
-- Quem clicasse via um número e abria outro.
--
-- **Hoje a diferença é de zero linhas** — medido antes de escrever isto, e
-- reconfirmado pela asserção lá em baixo — e é por isso que esta migração
-- pode existir sem mexer em nenhuma percentagem publicada. Não é um remendo
-- a um número errado: é fechar a porta antes de o primeiro adaptador gravar
-- `''` em vez de `null` e o painel passar a dizer 100% com trabalho por
-- fazer à vista na lista do lado.
--
-- O lado que cede é a vista, e não o filtro, por uma razão e não por
-- comodidade: entre «tem uma descrição vazia» e «não tem descrição», a
-- segunda é a verdade sobre a ficha que o público lê.
--
-- As colunas não mudam de nome, de tipo nem de ordem, e por isso o
-- `create or replace view` chega — e as concessões da 0026 e da 0103 ficam
-- de pé, que é o que interessa: estas vistas não são para a chave pública.

create or replace view public.event_quality_by_municipality
with (security_invoker = true) as
select
  m.id   as municipality_id,
  m.name as municipality_name,
  count(e.id) filter (where e.status = 'published')               as published,
  count(e.id) filter (where e.status = 'draft')                   as pending,
  count(e.id)                                                     as in_catalogue,
  count(e.id) filter (where s.com_hora)                           as with_time,
  count(e.id) filter (where e.venue_id is not null)               as with_venue,
  count(e.id) filter (where e.image_url is not null)              as with_image,
  count(e.id) filter (where e.description is not null
                        and e.description <> '')                  as with_description,
  count(e.id) filter (where e.is_free or e.price_min is not null) as with_price,
  count(e.id) filter (where e.latitude is not null)               as with_coordinates,
  m.region_id                                                     as region_id
from public.municipalities m
left join public.events e
  on e.municipality_id = m.id
 and e.status in ('published', 'draft')
 and e.is_canonical
left join lateral (
  select bool_or(es.start_time is not null) as com_hora
  from public.event_sessions es
  where es.event_id = e.id
) s on true
group by m.id, m.name, m.region_id;

create or replace view public.event_quality_by_source
with (security_invoker = true) as
select
  src.id   as source_id,
  src.name as source_name,
  src.is_enabled,
  count(e.id) filter (where e.status = 'published')               as published,
  count(e.id) filter (where e.status = 'draft')                   as pending,
  count(e.id)                                                     as in_catalogue,
  count(e.id) filter (where s.com_hora)                           as with_time,
  count(e.id) filter (where e.venue_id is not null)               as with_venue,
  count(e.id) filter (where e.image_url is not null)              as with_image,
  count(e.id) filter (where e.description is not null
                        and e.description <> '')                  as with_description,
  count(e.id) filter (where e.is_free or e.price_min is not null) as with_price,
  count(e.id) filter (where e.latitude is not null)               as with_coordinates
from public.sources src
left join public.events e
  on e.source_id = src.id
 and e.status in ('published', 'draft')
 and e.is_canonical
left join lateral (
  select bool_or(es.start_time is not null) as com_hora
  from public.event_sessions es
  where es.event_id = e.id
) s on true
group by src.id, src.name, src.is_enabled;

-- ---------------------------------------------------------------------------
do $$
declare
  v_vazias   integer;
  v_vista    bigint;
  v_contadas bigint;
begin
  select count(*) into v_vazias
    from public.events
   where is_canonical and status in ('published', 'draft') and description = '';

  -- Se um dia isto não for zero, a migração ainda está certa e o número
  -- publicado vai mexer. Fica dito em vez de acontecer em silêncio.
  if v_vazias > 0 then
    raise notice
      'a qualidade perde % eventos em «com descrição»: tinham a cadeia vazia, que não é uma descrição',
      v_vazias;
  end if;

  -- O que esta migração existe para garantir: a soma da vista e a contagem
  -- que a lista de trabalho abre são a mesma. Por concelho e por fonte, cada
  -- evento conta uma vez em cada, e o total tem de bater nas duas.
  select coalesce(sum(with_description), 0) into v_vista
    from public.event_quality_by_municipality;
  select count(*) into v_contadas
    from public.events
   where is_canonical and status in ('published', 'draft')
     and description is not null and description <> '';
  if v_vista <> v_contadas then
    raise exception 'por concelho a vista diz % com descrição e a lista conta %', v_vista, v_contadas;
  end if;

  -- Por fonte é a mesma conta, menos os eventos sem fonte — que existem: a
  -- submissão por formulário não tem adaptador nenhum por trás.
  select coalesce(sum(with_description), 0) into v_vista
    from public.event_quality_by_source;
  select count(*) into v_contadas
    from public.events
   where is_canonical and status in ('published', 'draft')
     and description is not null and description <> ''
     and source_id is not null;
  if v_vista <> v_contadas then
    raise exception 'por fonte a vista diz % com descrição e a lista conta %', v_vista, v_contadas;
  end if;
end
$$;
