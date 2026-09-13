-- 0136 — As juntas passam a contar-se, e ganham denominador.
--
-- A frase que a CIM quer dizer no relatório anual é «26 das 84 juntas do Médio
-- Tejo já publicam na agenda regional». Hoje não se calcula: o numerador só sai
-- casando prefixos de id (`jf-`, `uf-`), e o denominador **não existe em lado
-- nenhum da base** — está num documento, `docs/regioes/medio-tejo/FREGUESIAS.md`,
-- e um número que só vive num documento é um número que envelhece sozinho.
--
-- Um numerador sem denominador é a coisa que esta casa não publica. Por isso as
-- duas metades vêm na mesma migração: separá-las era pôr em produção metade de
-- uma fração.
--
-- ---------------------------------------------------------------------------
-- O numerador
-- ---------------------------------------------------------------------------
-- O prefixo do id é usado UMA vez, aqui, para escrever a coluna que passa a ser
-- a verdade. A asserção lá em baixo continua a olhar para o prefixo, e é de
-- propósito: é a guarda para o dia em que alguém acrescentar uma junta nova
-- como `venue_site` — o prefixo deixa de ser o cálculo e passa a ser o alarme.
update public.sources
   set kind = 'parish_site'
 where id like 'jf-%' or id like 'uf-%';

-- ---------------------------------------------------------------------------
-- O denominador
-- ---------------------------------------------------------------------------
alter table public.municipalities
  add column if not exists parish_count integer;

alter table public.municipalities
  drop constraint if exists municipalities_parish_count_positivo;
alter table public.municipalities
  add constraint municipalities_parish_count_positivo
  check (parish_count is null or parish_count > 0);

comment on column public.municipalities.parish_count is
  'Quantas freguesias tem o concelho. Fica a nulo enquanto ninguém a tiver '
  'contado — «não consegui saber» não é zero. No Médio Tejo vem do levantamento '
  'de 29 de agosto de 2026 (docs/regioes/medio-tejo/FREGUESIAS.md), já com a '
  'Lei n.º 25-A/2025, de 13 de março, que repôs freguesias em Ourém e Tomar: '
  'quem contar pela lista pós-2013 fica com 80 no total da região, e são 84.';

update public.municipalities as m
   set parish_count = v.n
  from (values
    ('abrantes', 13),
    ('alcanena', 7),
    ('constancia', 3),
    ('entroncamento', 2),
    ('ferreira-do-zezere', 7),
    ('macao', 6),
    ('ourem', 16),
    ('sardoal', 4),
    ('tomar', 12),
    ('torres-novas', 10),
    ('vila-nova-da-barquinha', 4)
  ) as v(id, n)
 where m.id = v.id;

-- ---------------------------------------------------------------------------
-- As provas
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  v_lista text;
begin
  -- Nenhuma junta ficou por mudar, e nenhuma junta nova entrará como sala.
  select count(*), string_agg(id, ', ' order by id) into n, v_lista
    from public.sources
   where (id like 'jf-%' or id like 'uf-%')
     and kind is distinct from 'parish_site';
  assert n = 0, format('fontes com id de junta que não são parish_site: %s', v_lista);

  -- E nenhuma fonte que não é junta ficou marcada como tal por engano.
  select count(*), string_agg(id, ', ' order by id) into n, v_lista
    from public.sources
   where kind = 'parish_site'
     and id not like 'jf-%' and id not like 'uf-%';
  assert n = 0, format('fontes marcadas como junta sem o id de uma: %s', v_lista);

  -- Uma região a sério que se declara completa tem o denominador de todos os
  -- seus concelhos. `expected_municipality_count` é onde essa declaração está
  -- escrita desde a 0121: uma região com os concelhos todos e um denominador a
  -- meio publica uma fração que mente por omissão.
  --
  -- A montra fica de fora, e não é comodismo. Ponte do Bombo e Vila da
  -- Charamela não existem (0110); contar-lhes freguesias era inventar um
  -- denominador para um sítio inventado, e nulo é a resposta certa — «não
  -- consegui saber» para um concelho que não há. O que a montra tem inventado
  -- está marcado como tal; um número com ar de estatística não estaria.
  select count(*), string_agg(m.id, ', ' order by m.id) into n, v_lista
    from public.municipalities m
    join public.regions r on r.id = m.region_id
   where m.parish_count is null
     and r.kind <> 'montra'
     and r.expected_municipality_count =
         (select count(*) from public.municipalities x where x.region_id = r.id);
  assert n = 0, format('concelhos sem freguesias contadas numa região completa: %s', v_lista);

  select coalesce(sum(parish_count), 0) into n
    from public.municipalities where region_id = 'medio-tejo';
  assert n = 84,
    format('o Médio Tejo tem 84 freguesias e a base soma %s — se der 80, alguém repôs a lista pré-2025', n);
end $$;
