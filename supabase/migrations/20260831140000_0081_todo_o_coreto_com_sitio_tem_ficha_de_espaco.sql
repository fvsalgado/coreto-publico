-- 0081 — Todo o coreto com sítio tem ficha de espaço.
--
-- O dono perguntou porque é que uns coretos estão nos espaços e outros não,
-- e a resposta honesta é: por acaso. Os espaços dos coretos nasceram por
-- vagas — uns no semeio inicial, outros quando um evento os provou, os desta
-- manhã porque o estudo os pedia — e ninguém escreveu a regra. O resultado
-- era indefensável: o Coreto de Alvega, confirmado, com fotografia e
-- coordenadas, não tinha ficha; o Coreto do Carril, sem uma única fonte que
-- o documente, tinha.
--
-- A regra passa a ser esta, e fica escrita aqui e no `lib/coreto.ts`, onde o
-- selo da dúvida já vivia:
--
--   **Um coreto do levantamento tem ficha própria de espaço quando alguma
--   fonte lhe dá um sítio.** Confirmado → ficha ativa. Por confirmar mas com
--   sítio documentado (uma marca no OSM é fonte secundária com lugar) →
--   ficha provisória, com o selo «por confirmar» que a lista já sabe pôr.
--   Sem sítio documentado — Sardoal (memória de palanques), Constância
--   (nenhum fio), Carril (fama musical não é coreto) — não há morada para
--   pôr numa ficha: a pergunta vive só no levantamento. E quando a marca
--   vive dentro de um espaço que já tem ficha (o coreto por confirmar do
--   Jardim Municipal de Torres Novas), a ligação é a esse espaço — a dúvida
--   é sobre o coreto, não sobre o jardim.
--
-- O que muda:
--
--   · **Sete confirmados ganham a ficha ativa que já mereciam**: Alvega,
--     Nossa Senhora do Tojo, Rio de Moinhos, Souto, Fonte de Dom João,
--     Poço Redondo e Chancelaria. Descrição, fotografia e coordenadas vêm
--     da linha do levantamento — uma fonte só, sem cópias divergentes.
--   · **Cinco por confirmar com marca no OSM ganham ficha provisória**:
--     Casais de Revelhos, Várzea do Bispo, Nossa Senhora da Ortiga, Brasões
--     e Castelo Novo. A descrição diz a dúvida, como a de Espite dizia
--     antes de haver prova.
--   · **O Carril perde a ficha de espaço** — zero eventos ligados, nenhuma
--     fonte, e a sua história (a primeira orquestração de «A Portuguesa»)
--     já está contada na linha do levantamento, que continua pública na
--     página dos coretos.

-- ---------------------------------------------------------------------------
-- I · Sete confirmados, ficha ativa
-- ---------------------------------------------------------------------------

insert into public.venues (id, name, municipality_id, parish, kind, status, is_association, address, latitude, longitude, image_url, image_credit, description)
select
  dados.venue_id,
  c.name,
  c.municipality_id,
  c.parish,
  'bandstand',
  'active',
  false,
  dados.morada,
  c.latitude,
  c.longitude,
  c.photo_url,
  c.photo_credit,
  c.description
from (values
  ('coreto-alvega',                 'coreto-alvega',              'Praça da República, Alvega (adro da Igreja de São Pedro)'),
  ('coreto-nossa-senhora-do-tojo',  'coreto-nossa-senhora-do-tojo','Recinto do Santuário de Nossa Senhora do Tojo, Quintã'),
  ('coreto-rio-de-moinhos',         'coreto-rio-de-moinhos',      'Largo 5 de Outubro, Rio de Moinhos'),
  ('coreto-souto-praca-luis-de-camoes', 'coreto-souto',           'Praça Luís de Camões, Souto'),
  ('coreto-fonte-de-dom-joao',      'coreto-fonte-de-dom-joao',   'Terreiro de São Simão, 2300-035 Fonte de Dom João'),
  ('coreto-poco-redondo',           'coreto-poco-redondo',        'Largo do Espírito Santo, 2300-035 Poço Redondo'),
  ('coreto-chancelaria-macaroca',   'coreto-chancelaria',         'Largo da Igreja (EM 557, lugar da Maçaroca), 2350-073 Chancelaria')
) as dados(coreto_id, venue_id, morada)
join public.coretos c on c.id = dados.coreto_id
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- II · Cinco por confirmar com marca no OSM, ficha provisória
--
-- O nome da ficha é o nome limpo; a linha do levantamento pode carregar o
-- parêntesis de desambiguação («Castelo Novo (Serra)»), a ficha não precisa.
-- ---------------------------------------------------------------------------

insert into public.venues (id, name, municipality_id, parish, kind, status, is_association, address, latitude, longitude, description)
select
  dados.venue_id,
  dados.nome,
  c.municipality_id,
  c.parish,
  'bandstand',
  'provisional',
  false,
  dados.morada,
  c.latitude,
  c.longitude,
  c.description
from (values
  ('coreto-casais-de-revelhos',        'coreto-casais-de-revelhos',      'Coreto de Casais de Revelhos',      'Rua da Escola, Casais de Revelhos'),
  ('coreto-freixianda-varzea-do-bispo','coreto-varzea-do-bispo',         'Coreto da Várzea do Bispo',         'Junto à ER 356, Várzea do Bispo (Freixianda)'),
  ('coreto-ortiga-fatima',             'coreto-nossa-senhora-da-ortiga', 'Coreto de Nossa Senhora da Ortiga', 'Estrada de Nossa Senhora da Ortiga, Fátima'),
  ('coreto-brasoes',                   'coreto-brasoes',                 'Coreto de Brasões',                 'Rua da Capela, Brasões (Carregueiros)'),
  ('coreto-serra-castelo-novo',        'coreto-castelo-novo',            'Coreto de Castelo Novo',            'Castelo Novo, Serra')
) as dados(coreto_id, venue_id, nome, morada)
join public.coretos c on c.id = dados.coreto_id
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- III · As ligações e os nomes como alias de si próprios
-- ---------------------------------------------------------------------------

update public.coretos set venue_id = 'coreto-souto', updated_at = now()
  where id = 'coreto-souto-praca-luis-de-camoes' and venue_id is null;
update public.coretos set venue_id = 'coreto-chancelaria', updated_at = now()
  where id = 'coreto-chancelaria-macaroca' and venue_id is null;
update public.coretos set venue_id = 'coreto-varzea-do-bispo', updated_at = now()
  where id = 'coreto-freixianda-varzea-do-bispo' and venue_id is null;
update public.coretos set venue_id = 'coreto-nossa-senhora-da-ortiga', updated_at = now()
  where id = 'coreto-ortiga-fatima' and venue_id is null;
update public.coretos set venue_id = 'coreto-castelo-novo', updated_at = now()
  where id = 'coreto-serra-castelo-novo' and venue_id is null;
update public.coretos set venue_id = id, updated_at = now()
  where id in ('coreto-alvega','coreto-nossa-senhora-do-tojo','coreto-rio-de-moinhos',
               'coreto-fonte-de-dom-joao','coreto-poco-redondo','coreto-casais-de-revelhos',
               'coreto-brasoes')
    and venue_id is null;

insert into public.venue_aliases (alias, venue_id)
select public.normalize_for_hash(v.name), v.id
from public.venues v
where v.id in ('coreto-alvega','coreto-nossa-senhora-do-tojo','coreto-rio-de-moinhos',
               'coreto-souto','coreto-fonte-de-dom-joao','coreto-poco-redondo',
               'coreto-chancelaria','coreto-casais-de-revelhos','coreto-varzea-do-bispo',
               'coreto-nossa-senhora-da-ortiga','coreto-brasoes','coreto-castelo-novo')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- IV · O Carril sai do catálogo de espaços
--
-- A remoção é guardada: se entretanto algum evento se tiver ligado à ficha,
-- nada se apaga e a asserção final rebenta — apagar um espaço com programação
-- seria apagar programação.
-- ---------------------------------------------------------------------------

update public.coretos set venue_id = null, updated_at = now()
  where id = 'coreto-carril'
    and not exists (select 1 from public.events where venue_id = 'coreto-carril');

delete from public.venue_aliases
  where venue_id = 'coreto-carril'
    and not exists (select 1 from public.events where venue_id = 'coreto-carril');

delete from public.venues
  where id = 'coreto-carril'
    and not exists (select 1 from public.events where venue_id = 'coreto-carril');

-- ---------------------------------------------------------------------------
-- As asserções: a regra, executável
-- ---------------------------------------------------------------------------

do $$
declare
  confirmados_mal integer;
  duvidosos_mal   integer;
  sem_sitio_mal   integer;
  carril          integer;
begin
  -- Confirmado → ficha ativa de coreto. Sem exceções.
  select count(*) into confirmados_mal
  from public.coretos c
  left join public.venues v on v.id = c.venue_id
  where c.is_confirmed
    and (c.venue_id is null or v.kind <> 'bandstand' or v.status <> 'active');

  if confirmados_mal <> 0 then
    raise exception '% coretos confirmados sem ficha ativa de espaço', confirmados_mal;
  end if;

  -- Por confirmar com sítio → ficha provisória de coreto, ou a ficha do
  -- espaço que o alberga (o caso do Jardim Municipal).
  select count(*) into duvidosos_mal
  from public.coretos c
  left join public.venues v on v.id = c.venue_id
  where not c.is_confirmed
    and c.latitude is not null
    and (c.venue_id is null or (v.kind = 'bandstand' and v.status <> 'provisional'));

  if duvidosos_mal <> 0 then
    raise exception '% coretos por confirmar com sítio mas sem ficha provisória', duvidosos_mal;
  end if;

  -- Sem sítio → sem ficha própria de coreto. (A ficha de outro espaço, como
  -- o jardim municipal, é permitida: a dúvida é do coreto, não do lugar.)
  select count(*) into sem_sitio_mal
  from public.coretos c
  join public.venues v on v.id = c.venue_id
  where not c.is_confirmed
    and c.latitude is null
    and v.kind = 'bandstand';

  if sem_sitio_mal <> 0 then
    raise exception '% coretos sem sítio documentado com ficha própria de espaço', sem_sitio_mal;
  end if;

  select count(*) into carril from public.venues where id = 'coreto-carril';
  if carril <> 0 then
    raise exception 'a ficha do Carril devia ter saído e não saiu — há eventos ligados?';
  end if;

  raise notice 'fichas de coreto: % ativas, % provisórias; % coretos sem ficha própria (sem sítio documentado)',
    (select count(*) from public.venues where kind = 'bandstand' and status = 'active'),
    (select count(*) from public.venues where kind = 'bandstand' and status = 'provisional'),
    (select count(*) from public.coretos c
      where c.venue_id is null
         or exists (select 1 from public.venues v where v.id = c.venue_id and v.kind <> 'bandstand'));
end
$$;
