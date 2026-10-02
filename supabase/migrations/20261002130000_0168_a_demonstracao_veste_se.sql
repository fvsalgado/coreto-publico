-- 0168 — A demonstração veste-se: um promotor, uma cor, cartazes, e o fim
-- de semana sempre cheio.
--
-- O Vale do Coreto é o que se manda a quem decide «para mexer à vontade», e
-- mostrava o caso-limite do produto em vez do caso normal (C1-025, C4-007,
-- C4-008, C2-045): nem uma imagem — trinta capas tipográficas iguais —, o
-- promotor «Equipa do Coreto» em texto, a ligar ao sítio de quem faz o
-- software, o vermelho da página do produto em vez de uma cor de região, e um
-- fim de semana ao acaso — a renovação empurrava as datas em múltiplos de 60
-- dias, e 60 não é múltiplo de 7: o dia da semana de cada evento rodava, e o
-- sábado tanto calhava cheio como vazio. No dia da auditoria eram três
-- exposições e um filme.
--
-- O que muda, e tudo continua inventado de propósito:
--
-- **Um promotor com marca própria.** A «Comunidade Intermunicipal do Vale do
-- Coreto», com logótipo desenhado para isto (`public/logos/vale-do-coreto/`),
-- e a ligação dela para as «Informações» da própria demonstração, que dizem o
-- que ela é — e não para o sítio de quem faz o produto. É a co-marca a
-- funcionar: o nome e a cor de quem promove, o produto a assinar ao lado.
--
-- **Uma cor que não é a do produto**: o verde-garrafa `#1f5c4a`, com o branco
-- por cima a 7,4:1. Prova que a cor muda e o produto fica (0167).
--
-- **Cartazes, desenhados por código e servidos pelo sítio** — a rota
-- `/cartaz-ilustrado/<slug>`, que só existe numa região de demonstração. Vinte
-- e quatro dos trinta eventos levam um; seis ficam sem, para a capa
-- tipográfica aparecer como o que é: o recurso de quem não tem imagem. O
-- endereço compõe-se do domínio da região, para não se cravar nenhum.
--
-- **O fim de semana sempre cheio.** O programa passa a ser escrito por
-- semanas, ancorado na sexta-feira desta semana: em cada uma das nove semanas
-- do ciclo há um ou dois eventos de sexta a domingo, mais a visita guiada à
-- torre e a hora do conto, que passam a ser todos os sábados, e duas ou três
-- exposições sempre em cartaz. E a renovação passa a saltar em múltiplos de 63
-- dias — nove semanas —, que mantêm o dia da semana: um concerto de sábado
-- continua a ser de sábado depois de cada volta.

begin;

-- ---------------------------------------------------------------------------
-- O promotor, a cor e o texto
-- ---------------------------------------------------------------------------

update public.regions set
  cim_name = 'Comunidade Intermunicipal do Vale do Coreto',
  cim_url = 'https://' || domain || '/informacoes',
  brand_color = '#1f5c4a',
  logo_on_graphite_path = '/logos/vale-do-coreto/promotor-branco.svg',
  logo_on_brand_path = '/logos/vale-do-coreto/promotor-branco.svg',
  logo_width = 248,
  logo_height = 40,
  about_intro =
    'O Vale do Coreto não existe no mapa, e a Comunidade Intermunicipal do Vale do Coreto também '
    || 'não: é a região de demonstração do Coreto, com dois concelhos, um promotor e uma programação '
    || 'inventados de propósito. Serve para mostrar como fica a agenda cultural de uma região '
    || 'verdadeira — com o nome, a cor e o logótipo de quem a promove.',
  about_story =
    'O Coreto é um software de agenda cultural por regiões: uma instalação, várias comunidades '
    || 'intermunicipais, cada uma no seu domínio, com os seus concelhos, as suas fontes e a sua '
    || 'identidade. Esta demonstração mostra o produto sem pedir nada emprestado a ninguém — os '
    || 'eventos, os espaços e os cartazes foram inventados e desenhados para ela, porque a regra da '
    || 'casa é não recolher de terceiros. Uma região nova nasce por configuração, nunca por um fork. '
    || 'O Coreto — o nome, o código e o desenho — é desenvolvido e é propriedade de Fábio Salgado.',
  updated_at = now()
 where id = 'vale-do-coreto';

-- ---------------------------------------------------------------------------
-- O programa, por semanas
-- ---------------------------------------------------------------------------
--
-- `semana` conta a partir da sexta-feira desta semana (a de hoje, se hoje for
-- sexta; a última, se for sábado ou domingo — o fim de semana em curso tem de
-- ter o que mostrar). `dia` é o desvio dentro da semana: 0 sexta, 1 sábado,
-- 2 domingo, e negativos para os dias úteis antes dela (−3 terça).

create temporary table programa_da_demonstracao (
  event_id uuid,
  semana   integer,
  dia      integer,
  inicio   time,
  fim      time
) on commit drop;

insert into programa_da_demonstracao (event_id, semana, dia, inicio, fim) values
  -- Semana 0
  ('ff8798a6-1f4f-491c-9a11-4e089e0e629d', 0, 0, '21:30', null),  -- Cineclube: O Rio que Sobe
  ('7e1526b9-0c2f-4c9f-a7d2-213add60efe1', 0, 1, '17:00', null),  -- Bandas no Coreto: Filarmónica da Ponte
  ('8878a5b7-1e99-4e36-80c1-d556e1d468ea', 0, 2, '09:00', null),  -- Caminhada dos Três Coretos
  -- Semana 1
  ('2288bf15-5849-4153-be42-6b4f5b14b8e5', 1, 0, '21:30', null),  -- A Charamela Perdida
  ('22990480-a439-47d8-93a3-0d2899742ad7', 1, 1, '16:00', null),  -- Tarde de Folclore
  ('5c4a3bc8-3c17-40b8-9c6d-e5c5b3edd88e', 1, 2, '15:00', null),  -- A Feira dos Sons
  -- Semana 2
  ('12675d3e-4598-4ccf-87a0-1a53efb5aded', 2, 0, '21:30', null),  -- Noite de Fados na Filarmónica
  ('b639db70-6715-4668-85d3-b5c521e8daca', 2, 1, '17:00', null),  -- Bandas no Coreto: Orquestra Ligeira
  ('8e31d4e9-264c-41f3-8f10-4f65087f8721', 2, 2, '09:00', '17:00'), -- Feira do Instrumento Usado
  -- Semana 3: o Festival do Bombo, de sexta a domingo
  ('01650257-7f1e-473a-86eb-3bf28c16ecdf', 3, 0, '18:00', null),  -- Desfile de Abertura
  ('7f1fae47-5eae-41ef-80ad-96b26414bc69', 3, 1, '10:30', '12:30'), -- Oficina de Bombos para Famílias
  ('2d165f02-d4e3-4b02-9410-d380ec219b24', 3, 1, '16:00', null),  -- Encontro de Grupos
  ('d74d414c-7c7b-4c2a-8d9f-645683eb930a', 3, 2, '18:00', null),  -- Baile de Encerramento
  -- Semana 4
  ('cd9b63f5-5eba-4289-8452-e2950aef261f', 4, 0, '21:30', null),  -- Cineclube: Curtas do Vale
  ('66c33953-aba9-417f-93ef-4fede580d4de', 4, 1, '21:30', null),  -- Mapa para Corpos Perdidos
  -- Semana 5
  ('194daeb0-a354-4da6-8b06-7641f74024a5', 5, 0, '21:30', null),  -- Recital de Piano
  ('79f8748a-90c0-4d0a-aa19-8b73c4848114', 5, 1, '17:00', null),  -- Bandas no Coreto: Banda Juvenil
  ('8d29d0c8-bdd4-42b6-b070-09166dccaa61', 5, -3, '18:00', '20:00'), -- Curso de Iniciação à Charamela
  ('8d29d0c8-bdd4-42b6-b070-09166dccaa61', 6, -3, '18:00', '20:00'),
  -- Semana 6
  ('6eec7501-b6e5-48c8-bb5d-2bdcf8a1c842', 6, 0, '21:30', null),  -- Cineclube: Verão na Aldeia dos Tambores
  ('ddc8c026-93c7-4845-9dcb-8845f5c77c02', 6, 1, '18:00', null),  -- Apresentação do livro
  -- Semana 7
  ('17569f6b-10ab-4286-a784-86373313ccf9', 7, 0, '18:30', null),  -- A Vila que Não Existe
  ('7309943e-8569-4cf4-acbe-390696b97ede', 7, 1, '17:00', null),  -- Bandas no Coreto: Grupo de Bombos
  ('96787788-36f2-4daa-b16b-1a906f2dd291', 7, 2, '21:00', null),  -- Cineclube: Sessão ao Ar Livre
  -- Semana 8
  ('26adb6f2-247e-499f-905e-3ac8853fa858', 8, 1, '18:30', null),  -- Para que serve um coreto?
  ('e1515846-fc07-41c3-a8d2-edd48d9d092c', 8, 2, '13:00', null);  -- Almoço de Sócios da Filarmónica

-- Todos os sábados das nove semanas: a visita à torre e a hora do conto.
insert into programa_da_demonstracao (event_id, semana, dia, inicio, fim)
select v.event_id, semana, 1, v.inicio, v.fim
  from generate_series(0, 8) as semana,
       (values ('4b59eb6e-4c3c-424b-8a11-46d64444eabd'::uuid, '10:00'::time, '11:00'::time),
               ('83cc95af-f38c-4f16-bbba-ed2b2dfd6e8b'::uuid, '11:30'::time, null::time)) as v(event_id, inicio, fim);

-- As três exposições, cada uma com cerca de oito semanas em cartaz e
-- desencontradas, para haver sempre pelo menos duas: os extremos e mais nada,
-- como a 0114 manda para o que está em cartaz.
insert into programa_da_demonstracao (event_id, semana, dia, inicio, fim) values
  ('c4acad98-7e94-4c3a-a1c5-a3752790cf40', -2, 0, null, null),  -- Cartazes de Festa: de há duas semanas…
  ('c4acad98-7e94-4c3a-a1c5-a3752790cf40', 5, 6, null, null),   -- …até daqui a quase sete
  ('79e83b4f-df48-498f-b435-e03a116de85f', 0, -2, null, null),  -- Retratos do Vale
  ('79e83b4f-df48-498f-b435-e03a116de85f', 7, 4, null, null),
  ('a0464996-0fd2-4588-a693-15b6863c1a6f', -5, 0, null, null),  -- O Bombo e a Vila
  ('a0464996-0fd2-4588-a693-15b6863c1a6f', 2, 6, null, null);

-- As sessões antigas saem e entram as novas. O trigger da 0004 refaz
-- `date_start` e `date_end` a cada linha.
delete from public.event_sessions s
 using public.events e, public.municipalities m
 where s.event_id = e.id and m.id = e.municipality_id and m.region_id = 'vale-do-coreto'
   and e.id in (select event_id from programa_da_demonstracao);

insert into public.event_sessions (event_id, session_date, start_time, end_time)
select p.event_id,
       (current_date - ((extract(isodow from current_date)::integer - 5 + 7) % 7))
         + 7 * p.semana + p.dia,
       p.inicio, p.fim
  from programa_da_demonstracao p;

-- A impressão digital acompanha a primeira data nova, como na renovação.
update public.events e
   set fingerprint = public.event_fingerprint(e.title, e.date_start, e.municipality_id)
  from public.municipalities m
 where m.id = e.municipality_id and m.region_id = 'vale-do-coreto';

-- ---------------------------------------------------------------------------
-- Os cartazes
-- ---------------------------------------------------------------------------
--
-- Seis ficam sem cartaz de propósito: a capa tipográfica é o que um evento sem
-- imagem recebe em qualquer agenda, e a demonstração mostra-a também.

update public.events e set
  image_url = 'https://' || r.domain || '/cartaz-ilustrado/' || e.slug,
  image_width = 900,
  image_height = 1200,
  image_alt = 'Cartaz ilustrado de «' || e.title || '», desenhado para a demonstração.',
  updated_at = now()
  from public.municipalities m
  join public.regions r on r.id = m.region_id
 where m.id = e.municipality_id
   and r.id = 'vale-do-coreto'
   and e.image_url is null
   -- Só os do programa: um evento que alguém tenha acrescentado à
   -- demonstração no painel não ganha um cartaz que ninguém lhe desenhou.
   and e.id in (select event_id from programa_da_demonstracao)
   and e.id not in (
     'e1515846-fc07-41c3-a8d2-edd48d9d092c',  -- Almoço de Sócios
     '8d29d0c8-bdd4-42b6-b070-09166dccaa61',  -- Curso de Iniciação à Charamela
     '8e31d4e9-264c-41f3-8f10-4f65087f8721',  -- Feira do Instrumento Usado
     '26adb6f2-247e-499f-905e-3ac8853fa858',  -- Para que serve um coreto?
     '17569f6b-10ab-4286-a784-86373313ccf9',  -- A Vila que Não Existe
     'ddc8c026-93c7-4845-9dcb-8845f5c77c02'   -- Apresentação do livro
   );

-- ---------------------------------------------------------------------------
-- A renovação mantém o dia da semana
-- ---------------------------------------------------------------------------

create or replace function public.renovar_montra()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento  record;
  v_salto   integer;
  v_movidos integer := 0;
begin
  for v_evento in
    select e.id, e.date_end
      from public.events e
      join public.municipalities m on m.id = e.municipality_id
      join public.regions r on r.id = m.region_id
     where r.kind = 'montra'
       and e.status = 'published'
       and e.date_end < current_date
     order by e.date_end
  loop
    -- Nove semanas, e não sessenta dias: um múltiplo de sete devolve cada
    -- evento ao mesmo dia da semana, e o programa da 0168 é escrito por
    -- semanas — o concerto de sábado volta a ser de sábado.
    v_salto := 63 * ceil((current_date - v_evento.date_end)::numeric / 63);

    update public.event_sessions
       set session_date = session_date + v_salto
     where event_id = v_evento.id;

    update public.events
       set fingerprint = public.event_fingerprint(title, date_start, municipality_id)
     where id = v_evento.id;

    v_movidos := v_movidos + 1;
  end loop;

  return v_movidos;
end;
$$;

comment on function public.renovar_montra() is
  'Empurra para o futuro, em saltos de 63 dias (nove semanas), os eventos publicados de uma região '
  '«montra» que já acabaram — todas as sessões de cada um, para o espaçamento e o dia da semana não '
  'mudarem. O programa da demonstração é inventado de propósito e nunca envelhece. Devolve quantos '
  'eventos moveu. Ver a 0119 e a 0168.';

revoke execute on function public.renovar_montra() from public, anon, authenticated;
grant execute on function public.renovar_montra() to service_role;

-- ---------------------------------------------------------------------------
-- O que tem de continuar verdade
-- ---------------------------------------------------------------------------
do $$
declare
  n          integer;
  -- A janela de `janelaDoFimDeSemana` (`packages/core/src/dates.ts`): de
  -- sexta a domingo desta semana, e nunca a começar no passado.
  v_dia      integer := extract(isodow from current_date)::integer;
  v_desde    date := greatest(current_date + (5 - v_dia), current_date);
  v_domingo  date := current_date + (7 - v_dia);
begin
  -- Só onde a demonstração existe: a migração corre também em bases sem ela.
  if not exists (select 1 from public.regions where id = 'vale-do-coreto') then
    return;
  end if;

  -- O fim de semana em curso — a janela que a agenda chama «este fim de
  -- semana» — tem programa: pelo menos quatro eventos, contando os sábados
  -- fixos e as exposições.
  select count(distinct e.id) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
    join public.event_sessions s on s.event_id = e.id
   where m.region_id = 'vale-do-coreto' and e.status = 'published'
     and (s.session_date between v_desde and v_domingo
          or (e.is_ongoing and e.date_start <= v_domingo and e.date_end >= v_desde));
  assert n >= 4, format('o fim de semana da demonstração tem %s eventos, esperavam-se pelo menos 4', n);

  -- Os cartazes: vinte e quatro, todos servidos pelo sítio, com as medidas.
  select count(*) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto'
     and e.id in (select event_id from programa_da_demonstracao)
     and e.image_url like 'https://%/cartaz-ilustrado/' || e.slug
     and e.image_width = 900 and e.image_height = 1200;
  assert n = 24, format('%s cartazes ilustrados na demonstração, esperavam-se 24', n);

  -- E a demonstração continua a não ler ninguém.
  select count(*) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto' and e.source_id is not null;
  assert n = 0, 'um evento da demonstração ganhou uma fonte';

  -- A impressão digital é a da primeira data nova.
  select count(*) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto'
     and e.fingerprint <> public.event_fingerprint(e.title, e.date_start, e.municipality_id);
  assert n = 0, format('%s eventos da demonstração com a impressão digital fora da fórmula', n);
end
$$;

commit;
