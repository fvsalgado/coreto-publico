-- 0103 — As vistas e os contadores por concelho dizem de que região são.
--
-- `event_quality_by_municipality` e `event_stats_by_municipality()` agregam
-- por concelho. Com uma região, «todas as linhas» e «as linhas da região»
-- eram a mesma coisa; com duas, quem consome isto — o painel de qualidade,
-- as estatísticas, as verificações de esquema — precisa de poder recortar.
--
-- A coluna nova vai NO FIM, de propósito: acrescentar uma coluna à cauda de
-- uma vista é a única alteração que o `create or replace view` aceita, e não
-- parte nenhum consumidor que leia por nome. A função é outra conversa — o
-- tipo de retorno muda, e mudar o retorno obriga a largar e recriar, com as
-- concessões refeitas (a 0017 tirou-lhe o execute a toda a gente que não a
-- chave de serviço, e isso não pode perder-se pelo caminho).

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
  count(e.id) filter (where e.description is not null)            as with_description,
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

comment on view public.event_quality_by_municipality is
  'Uma linha por concelho, sempre todos os da sua região: quantos eventos '
  'estão no catálogo, quantos já publicados e quantos à espera, e quantos '
  'deles dizem a que horas, onde, com que imagem. É o número que responde a '
  '«a agenda está a melhorar ou só a crescer?». As percentagens são sobre o '
  'catálogo, porque é isso que a recolha produz — o que está publicado é uma '
  'escolha posterior, e tem coluna própria.';

drop function if exists public.event_stats_by_municipality();

create function public.event_stats_by_municipality()
returns table (
  municipality_id   text,
  municipality_name text,
  events_counted    bigint,
  views             bigint,
  ticket_clicks     bigint,
  ical_downloads    bigint,
  shares            bigint,
  clicks            bigint,
  region_id         text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,
         m.name,
         count(s.event_id),
         coalesce(sum(s.views), 0),
         coalesce(sum(s.ticket_clicks), 0),
         coalesce(sum(s.ical_downloads), 0),
         coalesce(sum(s.shares), 0),
         coalesce(sum(s.clicks), 0),
         m.region_id
    from public.municipalities m
    left join public.events e
      on e.municipality_id = m.id
    left join public.event_stats s
      on s.event_id = e.id
   group by m.id, m.name, m.region_id
   order by m.sort_order;
$$;

revoke execute on function public.event_stats_by_municipality() from public, anon, authenticated;
grant execute on function public.event_stats_by_municipality() to service_role;

-- ---------------------------------------------------------------------------
do $$
declare
  v_n integer;
begin
  select count(*) into v_n
  from public.event_quality_by_municipality
  where region_id is null;
  if v_n <> 0 then
    raise exception '% linhas da vista de qualidade sem região', v_n;
  end if;
end $$;
