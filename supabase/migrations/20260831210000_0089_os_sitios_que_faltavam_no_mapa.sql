-- 0089 — Os sítios que faltavam no mapa.
--
-- A pergunta do dono foi directa: os espaços têm todos morada? E os eventos,
-- porque é que não estão todos no mapa? Nenhuma das duas respostas era a que
-- eu teria dado de cor, e a medição corrigiu-me nas duas.
--
-- ## Primeiro, o que estava errado no que eu dizia
--
-- **Os espaços não têm todos morada.** Noventa e dois dos cento e seis têm;
-- catorze não. E oitenta e seis têm coordenada, ou seja, vinte não têm.
--
-- **E os eventos estão todos no mapa.** O que falta não é a marca, é a
-- pontaria. O `agruparEmLugares` já resolveu isso há muito e está escrito lá:
-- «quem tem espaço vai para o espaço, quem não tem vai para o centro do
-- concelho — e o mapa mostra a diferença, em vez de a apagar». Um ponto
-- exacto é um sítio; um ponto de concelho é «algures neste concelho», e é
-- desenhado de outra maneira. Dos cento e quarenta e oito publicados, oitenta
-- e oito sabiam onde eram ao metro e sessenta caíam no centro do concelho.
--
-- ## O que se pode inferir, e o que não se pode
--
-- Dos sessenta sem ponto exacto, sete estavam num espaço do catálogo **que
-- não tinha coordenada** — esses resolvem-se pelo espaço. Os outros cinquenta
-- e três não têm espaço nenhum, e dividem-se em dois grupos que não se tratam
-- da mesma maneira:
--
--   · **Vinte e seis nomeiam um sítio.** «Praça Barão da Batalha», «Jardim da
--     República», «Largo do Chão da Eira — Concavada», «Parque Urbano de São
--     Lourenço». Um sítio com nome e concelho geocodifica-se, e é o que se faz
--     aqui.
--   · **Vinte e sete não.** Quinze dizem «Torres Novas» e mais nada — são os
--     que entraram pelos instantâneos, e a fonte nunca disse a sala. Outros
--     são de propósito espalhados: o Art'InRua é «ruas e praças de Tomar»
--     porque acontece na cidade toda, o torneio de Abrantes é em cinco campos
--     de cinco freguesias, o «Vamos Somar Km's» é nas sedes das associações do
--     concelho. Dar-lhes um ponto era escolher um dos sítios e chamar-lhe o
--     sítio. Ficam no centro do concelho, que é a verdade sobre eles.
--
-- ## Como se geocodificou, e o que se recusou
--
-- Nominatim, com o cabeçalho da casa e um segundo e dois entre chamadas. Cada
-- resposta passou por duas guardas antes de entrar: a hierarquia devolvida
-- tem de nomear o concelho certo, e o ponto tem de ficar a menos de vinte e
-- cinco quilómetros do centro dele. Quarenta e quatro consultas, e o que
-- passou as guardas ainda foi lido um a um — porque as guardas apanham o
-- ponto no concelho errado, não o ponto errado dentro do concelho certo.
--
-- **Recusou-se mais do que se aceitou, e é isso que interessa contar:**
--
--   · **O centróide da aldeia disfarçado de sítio.** O «Coreto de Penhascoso»
--     devolveu a fronteira administrativa de Penhascoso, a 4,3 km do centro de
--     Mação; o «Recinto do Desportivo de Igreja Nova do Sobral» devolveu a
--     fronteira de Igreja Nova do Sobral. Nenhum dos dois é um edifício. Pôr
--     lá o ponto era dizer «é aqui» sobre uma aldeia inteira.
--   · **O sítio errado com o nome certo por perto.** O «Jardim Municipal de
--     Torres Novas» devolveu uma estação de bicicletas numa avenida diferente
--     da que a ficha tem escrita.
--   · **A identidade não provada.** «Praça da Vila», em Ferreira do Zêzere,
--     devolve «Praça Dias Ferreira». Podem ser a mesma praça e a pesquisa não
--     o confirmou; enquanto não confirmar, não entra. E a «Escola Adães
--     Bermudes» de Montalvo devolve «Centro Escolar de Montalvo» — provável,
--     por ser uma aldeia com uma escola, mas provável não é confirmado.
--
-- E a asserção do bloqueio, na primeira versão, exigia-o em **todo** o evento
-- com ponto próprio. Rebentou com quatro que estavam certos: são de Ourém,
-- cuja API dá coordenadas por evento — com onze casas decimais, que não é
-- coisa que alguém escreva à mão. Trancá-los seria congelar um valor que é da
-- fonte. Serve de aferição, aliás: o «Largo da Feira, Caxarias» que a API de
-- Ourém dá fica a **setenta e oito metros** do que esta migração
-- geocodificou pelo nome, por vias completamente independentes.
--
-- **Dois entram como aproximados, e ficam declarados como tal:** o Centro
-- Cultural Alfredo Keil e o Cine-Teatro São Pedro de Alcanena não existem no
-- OSM como edifício, e o que entrou foi o centróide da rua que a própria
-- ficha já tinha na morada. É o mesmo que a 0035 fez uma vez e anotou. Numa
-- vila, o centróide da rua da morada põe a pessoa à porta certa; numa cidade
-- não poria, e por isso a nota fica escrita na ficha.

-- --------------------------- I. Os espaços -----------------------------------

update public.venues v set latitude = d.lat, longitude = d.lon, updated_at = now(),
  notes = coalesce(v.notes || ' ', '') || d.nota
from (values
  ('museu-rios-artes-maritimas', 39.476437, -8.338718,
   'Levantamento 2026-08-31: coordenada do OSM, que tem o museu marcado pelo nome (tourism/museum, «Museu dos Rios e das Artes Marítimas», Rua Doutor Ramiro Guedes). O OSM dá esta rua e a ficha tem a EN 3 — o museu fica no cruzamento das duas, e o nome é a prova.'),
  ('cine-teatro-macao', 39.556802, -7.995552,
   'Levantamento 2026-08-31: coordenada do OSM (amenity/theatre, «Cine-teatro», Largo dos Combatentes, Mação). A morada do largo entra com ela.'),
  ('choral-phydellius', 39.479853, -8.537236,
   'Levantamento 2026-08-31: coordenada do OSM (amenity/music_school, «Conservatório de Música do Choral Phydellius»), no número 147 da Rua Alexandre Herculano — o mesmo número que a ficha já tinha.'),
  ('sf-euterpe-meiaviense', 39.473318, -8.501722,
   'Levantamento 2026-08-31: coordenada do OSM (amenity/music_school, nome exacto). O OSM dá Rua da Tuna e a ficha dá Rua Professor Matos Branco; o nome do edifício é que decidiu.'),
  ('mercado-municipal-ferreira-do-zezere', 39.693861, -8.292202,
   'Levantamento 2026-08-31: coordenada do OSM (amenity/marketplace, «Mercado Municipal», Rua do Depósito de Água).'),
  ('centro-cultural-alfredo-keil', 39.695663, -8.286893,
   'Levantamento 2026-08-31: GPS APROXIMADO — centróide da Rua Ferreira do Alentejo, que é a morada da ficha. O edifício não está no OSM. Numa vila desta dimensão o centróide da rua põe a pessoa à porta certa; a coordenada exacta fica por levantar.'),
  ('cine-teatro-sao-pedro-alcanena', 39.457084, -8.669318,
   'Levantamento 2026-08-31: GPS APROXIMADO — centróide da Avenida 25 de Abril, que é a morada da ficha. O edifício não está no OSM. A coordenada exacta fica por levantar.')
) as d(id, lat, lon, nota)
where v.id = d.id and v.latitude is null;

-- A morada que faltava a dois deles, e que a geocodificação confirmou.
update public.venues set address = 'Largo dos Combatentes', updated_at = now()
where id = 'cine-teatro-macao' and address is null;

-- --------------------------- II. Os eventos ----------------------------------

update public.events e set latitude = d.lat, longitude = d.lon, updated_at = now()
from (values
  ('abrantes',           'Estádio Municipal',                                  39.458779, -8.215395),
  ('abrantes',           'Jardim da República',                                39.461261, -8.197863),
  ('abrantes',           'Largo do Chão da Eira - Concavada',                  39.452836, -8.067328),
  ('abrantes',           'Parque Urbano de São Lourenço',                      39.475135, -8.216260),
  ('abrantes',           'Pista de Atletismo',                                 39.458821, -8.215411),
  ('abrantes',           'Praça Barão da Batalha',                             39.461573, -8.198320),
  ('entroncamento',      'Praça Salgueiro Maia, Entroncamento',                39.462501, -8.470332),
  ('entroncamento',      'Rua Luís Falcão de Sommer, Entroncamento',           39.463139, -8.469029),
  ('ourem',              'Largo da Feira, Caxarias',                           39.707946, -8.526849),
  ('ourem',              'Praça da República, Ourém',                          39.655313, -8.577456),
  ('torres-novas',       'Praça 5 de Outubro e Praça dos Claras, Torres Novas', 39.479073, -8.539730),
  ('torres-novas',       'Rua da Capela, Barroca',                             39.496677, -8.466267),
  ('torres-novas',       'Centro Escolar da Serra d''Aire, Pedrógão',          39.521406, -8.592544),
  ('ferreira-do-zezere', 'Capela de Almogadel',                                39.720200, -8.402358)
) as d(concelho, local, lat, lon)
where e.municipality_id = d.concelho
  and public.normalize_for_hash(e.location_name) = public.normalize_for_hash(d.local)
  and e.latitude is null;

-- O bloqueio, pela mesma razão da 0070: a coordenada não veio da fonte, e sem
-- ele a próxima recolha escreve por cima do que aqui se levantou.
insert into public.manual_overrides (event_id, field, value, actor, note)
select e.id, campo.nome,
       case campo.nome when 'latitude' then to_jsonb(e.latitude) else to_jsonb(e.longitude) end,
       'levantamento de locais 2026-08-31',
       'Coordenada do OSM para «' || e.location_name || '», geocodificada pelo nome do sítio e '
       'verificada contra o concelho do evento. A fonte não dá coordenadas.'
from public.events e
cross join (values ('latitude'), ('longitude')) as campo(nome)
where e.latitude is not null
  and e.location_name is not null
  and e.venue_id is null
  -- Ourém fica de fora: a API dela dá coordenadas por evento, e é dela que
  -- elas são. Trancá-las era impedi-la de corrigir o que publicou.
  and e.source_id is distinct from 'cm-ourem'
  and (e.municipality_id, public.normalize_for_hash(e.location_name)) in (
    select d.concelho, public.normalize_for_hash(d.local) from (values
      ('abrantes','Estádio Municipal'), ('abrantes','Jardim da República'),
      ('abrantes','Largo do Chão da Eira - Concavada'), ('abrantes','Parque Urbano de São Lourenço'),
      ('abrantes','Pista de Atletismo'), ('abrantes','Praça Barão da Batalha'),
      ('entroncamento','Praça Salgueiro Maia, Entroncamento'),
      ('entroncamento','Rua Luís Falcão de Sommer, Entroncamento'),
      ('torres-novas','Praça 5 de Outubro e Praça dos Claras, Torres Novas'),
      ('torres-novas','Rua da Capela, Barroca'),
      ('torres-novas','Centro Escolar da Serra d''Aire, Pedrógão'),
      ('ferreira-do-zezere','Capela de Almogadel')
    ) as d(concelho, local)
  )
on conflict (event_id, field) do nothing;

update public.events e set has_manual_overrides = true
where exists (select 1 from public.manual_overrides o where o.event_id = e.id)
  and not e.has_manual_overrides;

-- ---------------------------------------------------------------------------
do $$
declare
  fora_do_concelho integer;
  sem_bloqueio     integer;
  exactos          integer;
  publicados       integer;
begin
  -- A guarda que interessa: nenhum ponto escrito aqui pode cair longe do
  -- centro do concelho a que o evento diz pertencer. Vinte e cinco
  -- quilómetros é o raio dos concelhos maiores da região; acima disso é
  -- geocodificação enganada, e é assim que ela se apanha.
  select count(*) into fora_do_concelho
  from public.events e
  join public.municipalities m on m.id = e.municipality_id
  where e.latitude is not null and m.latitude is not null
    and 111.32 * sqrt(power(e.latitude - m.latitude, 2) +
                      power((e.longitude - m.longitude) * cos(radians(e.latitude)), 2)) > 25;

  if fora_do_concelho > 0 then
    raise exception '% eventos ficaram com um ponto a mais de 25 km do centro do seu concelho', fora_do_concelho;
  end if;

  -- O mesmo para os espaços.
  select count(*) into fora_do_concelho
  from public.venues v
  join public.municipalities m on m.id = v.municipality_id
  where v.latitude is not null and m.latitude is not null
    and 111.32 * sqrt(power(v.latitude - m.latitude, 2) +
                      power((v.longitude - m.longitude) * cos(radians(v.latitude)), 2)) > 25;

  if fora_do_concelho > 0 then
    raise exception '% espaços ficaram com um ponto a mais de 25 km do centro do seu concelho', fora_do_concelho;
  end if;

  -- Um ponto levantado à mão sem bloqueio dura até à recolha seguinte — mas
  -- só os levantados **aqui**, e a primeira versão desta asserção não fazia a
  -- distinção. Ela exigia bloqueio em todo o evento com ponto próprio, e
  -- rebentou com quatro que estavam certos: são de Ourém, cuja API dá
  -- coordenadas por evento (com onze casas decimais, que não é coisa que
  -- alguém escreva à mão). Trancá-los seria congelar um valor que é da fonte
  -- e que ela tem todo o direito de corrigir. A prova de que são boas: o
  -- «Largo da Feira, Caxarias» que a API de Ourém dá fica a 78 metros do que
  -- esta migração geocodificou pelo nome, por vias independentes.
  select count(*) into sem_bloqueio
  from public.events e
  where e.latitude is not null
    and e.location_name is not null
    and e.venue_id is null
    and e.source_id is distinct from 'cm-ourem'
    and (e.municipality_id, public.normalize_for_hash(e.location_name)) in (
      select d.concelho, public.normalize_for_hash(d.local) from (values
        ('abrantes','Estádio Municipal'), ('abrantes','Jardim da República'),
        ('abrantes','Largo do Chão da Eira - Concavada'), ('abrantes','Parque Urbano de São Lourenço'),
        ('abrantes','Pista de Atletismo'), ('abrantes','Praça Barão da Batalha'),
        ('entroncamento','Praça Salgueiro Maia, Entroncamento'),
        ('entroncamento','Rua Luís Falcão de Sommer, Entroncamento'),
        ('torres-novas','Praça 5 de Outubro e Praça dos Claras, Torres Novas'),
        ('torres-novas','Rua da Capela, Barroca'),
        ('torres-novas','Centro Escolar da Serra d''Aire, Pedrógão'),
        ('ferreira-do-zezere','Capela de Almogadel')
      ) as d(concelho, local)
    )
    and not exists (
      select 1 from public.manual_overrides o where o.event_id = e.id and o.field = 'latitude'
    );

  if sem_bloqueio > 0 then
    raise exception
      '% eventos desta migração ficaram com ponto sem bloqueio — a recolha apaga-os', sem_bloqueio;
  end if;

  select count(*) filter (where e.latitude is not null or v.latitude is not null), count(*)
    into exactos, publicados
  from public.events e left join public.venues v on v.id = e.venue_id
  where e.status = 'published';

  if publicados > 0 then
    raise notice 'pontaria: % de % eventos publicados sabem onde são ao metro', exactos, publicados;
  end if;
end
$$;
