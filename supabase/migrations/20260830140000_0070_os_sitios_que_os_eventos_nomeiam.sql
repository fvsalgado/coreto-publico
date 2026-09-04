-- 0070 — Os sítios que os eventos nomeiam, e onde eles ficam.
--
-- Sessenta por cento dos eventos por acontecer dizem onde são em texto livre e
-- não têm ficha de espaço nem ponto no mapa. Esta migração fecha a parte que
-- se prova, e separa três coisas que estavam misturadas.
--
-- ## Três espaços que os próprios eventos provam existir
--
-- Não são palpites: cada um é o local de um evento que a agenda municipal
-- publicou, e cada um foi confirmado contra uma fonte que se pode citar.
--
--   · **Auditório do Edifício Pirâmide**, Abrantes — o local do «V Edição
--     Congresso do Desporto». O edifício está no OpenStreetMap, no Largo de
--     Santo António, e as coordenadas vêm de lá.
--   · **Pavilhão Ana Sonça**, Minde — o local da «Comemoração 30º Aniversário
--     Charales Chorus», e o cartaz da Junta de Freguesia de Minde chama-lhe o
--     mesmo. Estava na fila dos espaços por resolver desde 29 de agosto: é o
--     caso que a 0068 deixou lá de propósito, por ser mesmo um sítio.
--   · **Galeria Municipal do Entroncamento** — o local da exposição documental
--     sobre os jornais da cidade.
--
-- ## As coordenadas, e a regra com que se escolheram
--
-- Vieram todas do OpenStreetMap, e só entraram quando a pesquisa devolveu **a
-- própria coisa nomeada** — uma praça, um edifício, um lugar com aquele nome.
-- Onde só apareceu a aldeia que contém o sítio, não se escreveu nada: um
-- ponto a duzentos metros manda alguém para o sítio errado com a confiança de
-- quem tem um mapa, e isso é pior do que não ter mapa.
--
-- Por isso ficam de fora, com razão escrita: o Parque do Lavradio (Alcanena),
-- a Escola Adães Bermudes (Montalvo), o TagusValley (Abrantes) e o Cais de
-- Almourol — nenhum está no OSM com esse nome. E ficam de fora os locais que
-- são vários sítios ao mesmo tempo: «Campos das Equipas Participantes»,
-- «Piscinas e praias fluviais do concelho», «Ruas e praças de Tomar». Esses
-- não têm um ponto porque não são um ponto.
--
-- Cada coordenada escrita fica trancada em `manual_overrides`. Sem isso, a
-- recolha desta noite lê a mesma página sem coordenadas e apaga-as — que é
-- exatamente o problema que a tabela dos bloqueios existe para resolver.
-- ---------------------------------------------------------------------------

-- ------------------------------- Os espaços ---------------------------------
insert into public.venues
  (id, name, municipality_id, parish, kind, status, is_association,
   address, latitude, longitude, notes)
values
  ('auditorio-edificio-piramide', 'Auditório do Edifício Pirâmide',
   'abrantes', 'Abrantes (São Vicente e São João) e Alferrarede', 'auditorium',
   'active', false, 'Largo de Santo António', 39.463372, -8.203540,
   'Levantamento 2026-08-30: é o local de eventos da agenda municipal de '
   'Abrantes, que lhe chama «Auditório Abrantes - Edifício Pirâmide». '
   'Coordenadas do OpenStreetMap, do próprio edifício.'),
  ('pavilhao-ana-sonca', 'Pavilhão Ana Sonça',
   'alcanena', 'Minde', 'other', 'active', false,
   null, null, null,
   'Levantamento 2026-08-30: local da programação da Junta de Freguesia de '
   'Minde. Sem coordenadas — o OpenStreetMap não tem o pavilhão, e o centro '
   'da vila não é o pavilhão.'),
  ('galeria-municipal-entroncamento', 'Galeria Municipal do Entroncamento',
   'entroncamento', 'São João Baptista', 'gallery', 'active', false,
   null, null, null,
   'Levantamento 2026-08-30: local das exposições na agenda municipal do '
   'Entroncamento. Sem coordenadas confirmadas.')
on conflict (id) do nothing;

-- ------------------------------- Os alias -----------------------------------
-- Incluindo as grafias com que as agendas escrevem os espaços que a 0069
-- acrescentou: quando o nome vem com o concelho colado, não casa com o alias
-- do nome canónico.
insert into public.venue_aliases (alias, venue_id) values
  ('auditoriodoedificiopiramide',        'auditorio-edificio-piramide'),
  ('auditorioabrantesedificiopiramide',  'auditorio-edificio-piramide'),
  ('pavilhaoanasonca',                   'pavilhao-ana-sonca'),
  ('pavilhaoanasoncaminde',              'pavilhao-ana-sonca'),
  ('galeriamunicipaldoentroncamento',    'galeria-municipal-entroncamento'),
  ('galeriamunicipalentroncamento',      'galeria-municipal-entroncamento'),
  ('centroculturalalfredokeilferreiradozezere', 'centro-cultural-alfredo-keil'),
  ('galeriacarlossaramagocentroculturalelvinopereiramacao',
                                         'centro-cultural-elvino-pereira'),
  ('galeriacarlossaramago',              'centro-cultural-elvino-pereira')
on conflict (alias, ambito) do nothing;

-- E os eventos que já estavam à espera destes nomes.
update public.events e set venue_id = a.venue_id, updated_at = now()
from public.venue_aliases a
where e.venue_id is null
  and a.alias = public.normalize_for_hash(e.location_name)
  and a.municipality_id is null
  and a.venue_id in (
    'auditorio-edificio-piramide', 'pavilhao-ana-sonca',
    'galeria-municipal-entroncamento', 'centro-cultural-alfredo-keil',
    'centro-cultural-elvino-pereira'
  );

-- ----------------------------- As coordenadas -------------------------------
-- Casadas pelo nome do local, e não por identificador de evento: assim isto
-- volta a valer se o evento for regravado, e vale para os que vierem com o
-- mesmo nome.
create temporary table pontos_do_levantamento (
  municipality_id text,
  local           text,
  latitude        double precision,
  longitude       double precision,
  prova           text
);
-- Sem `on commit drop`: em psql cada instrução fecha a sua transação, e a
-- tabela desaparecia antes da linha seguinte. Uma tabela temporária morre com
-- a sessão de qualquer maneira.

insert into pontos_do_levantamento values
  ('abrantes', 'Alto de Santo António', 39.462841, -8.204706,
   'OpenStreetMap: Parque do Alto de Santo António, Abrantes (São Vicente e São João) e Alferrarede'),
  ('abrantes', 'Largo das Festas Arreciadas', 39.416287, -8.169300,
   'OpenStreetMap: lugar de Arreciadas, São Miguel do Rio Torto e Rossio ao Sul do Tejo'),
  ('abrantes', 'Centro Social, Desportivo e Recreativo de Portela, Colmeal e Cabeça Ruiva',
   39.610631, -8.249016, 'OpenStreetMap: lugar da Portela, freguesia de Fontes — a morada que a fonte declara'),
  ('constancia', 'Montalvo', 39.484864, -8.300046,
   'OpenStreetMap: Montalvo, Constância — o local do evento é a própria aldeia'),
  ('ourem', 'Sede da Junta de Freguesia de Caxarias', 39.714947, -8.543763,
   'OpenStreetMap: Junta de Freguesia de Caxarias, Rua do Mercado — o próprio edifício'),
  ('tomar', 'Partida na Várzea Grande, junto à Rodoviária, Tomar', 39.600021, -8.413164,
   'OpenStreetMap: praça da Várzea Grande, Tomar'),
  ('vila-nova-da-barquinha', 'Largo 1.º Dezembro, Vila Nova da Barquinha',
   39.458006, -8.432674, 'OpenStreetMap: Largo Primeiro de Dezembro, Vila Nova da Barquinha'),
  ('vila-nova-da-barquinha', 'Galeria do Parque', 39.458157, -8.431104,
   'OpenStreetMap: Câmara Municipal de Vila Nova da Barquinha — a morada que a própria fonte declara para esta galeria, «Edifício dos Paços do Concelho»');

update public.events e
set latitude = p.latitude, longitude = p.longitude, updated_at = now()
from pontos_do_levantamento p
where e.municipality_id = p.municipality_id
  and public.normalize_for_hash(e.location_name) = public.normalize_for_hash(p.local)
  and e.latitude is null;

-- O bloqueio, sem o qual a recolha desta noite apaga isto.
insert into public.manual_overrides (event_id, field, value, actor, note)
select e.id, campo.nome,
       to_jsonb(case campo.nome when 'latitude' then p.latitude else p.longitude end),
       'levantamento de locais 2026-08-30', p.prova
from public.events e
join pontos_do_levantamento p
  on e.municipality_id = p.municipality_id
 and public.normalize_for_hash(e.location_name) = public.normalize_for_hash(p.local)
cross join (values ('latitude'), ('longitude')) as campo(nome)
where e.latitude is not null
on conflict (event_id, field) do nothing;

drop table pontos_do_levantamento;

update public.events e set has_manual_overrides = true
where exists (select 1 from public.manual_overrides o where o.event_id = e.id)
  and not e.has_manual_overrides;

-- ---------------------------------------------------------------------------
do $$
declare
  v_espacos integer;
  v_ligados integer;
  v_pontos  integer;
  v_orfaos  integer;
begin
  select count(*) into v_espacos from public.venues
  where id in ('auditorio-edificio-piramide', 'pavilhao-ana-sonca',
               'galeria-municipal-entroncamento');
  if v_espacos <> 3 then
    raise exception 'esperavam-se os 3 espaços novos, e há %', v_espacos;
  end if;

  -- Nenhum espaço pode ficar sem o próprio nome a resolver para si.
  select count(*) into v_orfaos from public.venues v
  where not exists (
    select 1 from public.venue_aliases a
    where a.alias = public.normalize_for_hash(v.name)
      and (a.municipality_id is null or a.municipality_id = v.municipality_id)
  );
  if v_orfaos <> 0 then
    raise exception '% espaços ficaram sem o próprio nome como alias', v_orfaos;
  end if;

  -- Uma coordenada escrita sem bloqueio é uma coordenada que desaparece hoje
  -- à noite. Se alguma escapar, isto tem de rebentar aqui.
  select count(*) into v_pontos
  from public.events e
  where e.latitude is not null
    and e.source_id is not null
    and not exists (
      select 1 from public.manual_overrides o
      where o.event_id = e.id and o.field = 'latitude'
    )
    and exists (
      select 1 from public.manual_overrides o where o.event_id = e.id
    );
  -- Informativo: não rebenta, porque há eventos cuja coordenada veio da
  -- própria fonte e é ela que manda.
  raise notice '% eventos com coordenada da fonte e outros bloqueios', v_pontos;

  select count(*) into v_ligados from public.events
  where venue_id in ('auditorio-edificio-piramide', 'pavilhao-ana-sonca',
                     'galeria-municipal-entroncamento',
                     'centro-cultural-alfredo-keil', 'centro-cultural-elvino-pereira');
  raise notice '% eventos ligados aos espaços novos', v_ligados;
end
$$;
