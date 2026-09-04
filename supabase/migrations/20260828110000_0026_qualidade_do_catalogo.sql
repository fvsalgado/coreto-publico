-- 0026 — A qualidade mede o catálogo, e não só a parte dele que já foi aprovada.
--
-- As vistas da 0025 contam `status = 'published'`. Na primeira recolha a sério
-- isso deu treze linhas a zero, com sessenta e sete eventos gravados: tudo o
-- que a recolha escreve nasce em `draft` — está no `harmonize`, é de propósito,
-- e nada entra no sítio sem uma pessoa aprovar.
--
-- Para a vista por concelho isso ainda se defende: mede o que o público vê.
-- Para a **vista por fonte** não se defende de todo. Foi escrita, com estas
-- palavras, para ser «onde se vê qual adaptador está a deixar por trazer um
-- campo que a página do lado de lá tem» — e um adaptador não publica nada. A
-- percentagem de eventos com hora de uma fonte não tem relação nenhuma com o
-- que um moderador aprovou; medi-la sobre os publicados mede as escolhas de
-- quem modera, não o que o adaptador trouxe.
--
-- Passam as duas a medir o catálogo — publicados **e** por publicar — e a
-- contar os dois estados em colunas separadas, para que nada fique escondido
-- atrás de um total. Quem quiser só o publicado tem a coluna lá.
--
-- Os outros estados ficam de fora de propósito: `hidden`, `cancelled`,
-- `postponed` e `archived` são decisões humanas sobre um evento, não defeitos
-- de recolha, e contá-las como qualidade em falta seria culpar o adaptador do
-- que uma pessoa escolheu.

-- `create or replace view` não sabe meter colunas no meio da lista — só as
-- acrescenta ao fim. Como as duas contagens novas pertencem ao pé da que já lá
-- estava, larga-se e recria-se. Sem `cascade`, de propósito: se alguma coisa
-- passar a depender destas vistas, isto tem de rebentar aqui e não apagar essa
-- coisa em silêncio.
drop view if exists public.event_quality_by_municipality;
drop view if exists public.event_quality_by_source;

create view public.event_quality_by_municipality
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
  count(e.id) filter (where e.latitude is not null)               as with_coordinates
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
group by m.id, m.name;

comment on view public.event_quality_by_municipality is
  'Uma linha por concelho, sempre as treze: quantos eventos estão no catálogo, '
  'quantos já publicados e quantos à espera, e quantos deles dizem a que horas, '
  'onde, com que imagem. É o número que responde a «a agenda está a melhorar ou '
  'só a crescer?». As percentagens são sobre o catálogo, porque é isso que a '
  'recolha produz — o que está publicado é uma escolha posterior, e tem coluna '
  'própria.';

create view public.event_quality_by_source
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
  count(e.id) filter (where e.description is not null)            as with_description,
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

comment on view public.event_quality_by_source is
  'Uma linha por fonte: o que cada adaptador está a conseguir trazer da página '
  'do lado de lá. Mede o catálogo e não só o publicado — um adaptador não '
  'aprova nada, e medi-lo sobre o que um moderador deixou passar media a '
  'moderação e não a recolha.';

-- As vistas herdam as permissões de quem as cria, não as da 0025. Repor.
revoke all on public.event_quality_by_municipality from public, anon, authenticated;
revoke all on public.event_quality_by_source from public, anon, authenticated;

do $$
declare
  linhas int;
  catalogo int;
begin
  -- As treze continuam a ter de estar lá, mesmo a zero: um concelho que
  -- desaparece do painel por não ter eventos é o que este projeto existe para
  -- não deixar acontecer.
  select count(*) into linhas from public.event_quality_by_municipality;
  if linhas <> 13 then
    raise exception 'a vista de qualidade tem de ter uma linha por concelho, e são treze — tem %', linhas;
  end if;

  -- E a razão de ser desta migração, dita como asserção: se o catálogo tem
  -- eventos, a vista tem de os ver. Antes disto via zero com sessenta e sete
  -- gravados.
  select coalesce(sum(in_catalogue), 0) into catalogo from public.event_quality_by_municipality;
  if catalogo <> (
    select count(*) from public.events
    where status in ('published', 'draft') and is_canonical
  ) then
    raise exception 'a vista não está a ver o catálogo inteiro';
  end if;
end
$$;
