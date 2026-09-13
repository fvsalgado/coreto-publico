-- 0010 — Seed: concelhos e catálogo de categorias.
--
-- Coordenadas: sede de concelho, aproximadas ao centro da vila/cidade.
-- `dico_code`: código INE (distrito 14 = Santarém).
--
-- ÂMBITO: esta migração semeia os onze concelhos do distrito de Santarém. Os
-- outros dois da CIM do Médio Tejo — a Sertã e Vila de Rei, de Castelo Branco
-- — entram na migração 0016, que é onde a correção está explicada.
--
-- Este seed é a definição operacional do âmbito: mexer nele muda os feeds, o
-- mapa, o widget e o sitemap ao mesmo tempo.

insert into public.municipalities (id, name, dico_code, latitude, longitude, website_url, sort_order) values
  ('abrantes',              'Abrantes',                '1401', 39.4644, -8.1979, 'https://www.cm-abrantes.pt',        1),
  ('alcanena',              'Alcanena',                '1402', 39.4592, -8.6714, 'https://www.cm-alcanena.pt',        2),
  ('constancia',            'Constância',              '1408', 39.4783, -8.3378, 'https://www.cm-constancia.pt',      3),
  ('entroncamento',         'Entroncamento',           '1410', 39.4667, -8.4667, 'https://www.cm-entroncamento.pt',   4),
  ('ferreira-do-zezere',    'Ferreira do Zêzere',      '1411', 39.7000, -8.2903, 'https://www.cm-ferreiradozezere.pt', 5),
  ('macao',                 'Mação',                   '1413', 39.5533, -7.9944, 'https://www.cm-macao.pt',           6),
  ('ourem',                 'Ourém',                   '1421', 39.6533, -8.5836, 'https://www.ourem.pt',              7),
  ('sardoal',               'Sardoal',                 '1417', 39.5378, -8.1594, 'https://www.cm-sardoal.pt',         8),
  ('tomar',                 'Tomar',                   '1418', 39.6039, -8.4103, 'https://www.cm-tomar.pt',           9),
  ('torres-novas',          'Torres Novas',            '1419', 39.4803, -8.5400, 'https://www.cm-torresnovas.pt',    10),
  ('vila-nova-da-barquinha','Vila Nova da Barquinha',  '1420', 39.4592, -8.4342, 'https://www.cm-vnbarquinha.pt',    11)
on conflict (id) do update set
  name = excluded.name,
  dico_code = excluded.dico_code,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  website_url = excluded.website_url,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Categorias — catálogo fechado.
--
-- Deliberadamente diferente de uma agenda urbana: `festas-populares`,
-- `comunidade` e `feiras-mercados` existem porque é aí que vive metade da
-- programação destes concelhos. Sem elas, a cauda longa associativa
-- entrava toda em «Outros» e desaparecia dos filtros.
-- ---------------------------------------------------------------------------

insert into public.categories (slug, name, description, sort_order) values
  ('musica',            'Música',                  'Concertos, recitais, bandas filarmónicas, coros e ranchos.', 1),
  ('teatro',            'Teatro',                  'Teatro, teatro de rua, marionetas e novo circo.', 2),
  ('danca',             'Dança',                   'Espetáculos de dança e ranchos folclóricos em palco.', 3),
  ('cinema',            'Cinema',                  'Sessões de cinema, cineclubes e mostras de cinema.', 4),
  ('exposicoes',        'Exposições',              'Artes visuais, fotografia, museus e galerias.', 5),
  ('literatura',        'Literatura e ideias',     'Apresentações de livros, conversas, conferências e poesia.', 6),
  ('patrimonio',        'Património e visitas',    'Visitas guiadas, monumentos, arqueologia e roteiros.', 7),
  ('festas-populares',  'Festas e romarias',       'Festas de terra, romarias, arraiais e marchas.', 8),
  ('feiras-mercados',   'Feiras e mercados',       'Feiras temáticas, mercados, mostras de gastronomia e artesanato.', 9),
  ('infantil',          'Infantil e família',      'Programação para crianças e para ver em família.', 10),
  ('formacao',          'Formação e oficinas',     'Oficinas, cursos, residências e ateliês.', 11),
  ('desporto-natureza', 'Desporto e natureza',     'Passeios, provas, percursos pedestres e desporto ao ar livre.', 12),
  ('comunidade',        'Comunidade',              'Associativismo, convívios, encontros e iniciativas de bairro.', 13),
  ('outros',            'Outros',                  'O que não cabe nas restantes categorias.', 99)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Aliases das etiquetas das fontes.
--
-- As chaves estão já normalizadas por `normalize_for_hash` (minúsculas, sem
-- acentos, sem espaços nem pontuação), que é como o resolvedor as procura.
-- Uma etiqueta sem correspondência vai para `unknown_tags` — nunca é
-- adivinhada uma categoria.
-- ---------------------------------------------------------------------------

insert into public.category_aliases (alias, category_slug)
-- `distinct on`: variantes acentuadas e não acentuadas da mesma etiqueta
-- («música» e «musica») colapsam na mesma chave normalizada, e o Postgres
-- recusa dois `on conflict` para a mesma linha no mesmo comando.
select distinct on (1) public.normalize_for_hash(alias), category_slug
from (values
  ('música', 'musica'), ('musica', 'musica'), ('concerto', 'musica'),
  ('concertos', 'musica'), ('espetáculo musical', 'musica'), ('fado', 'musica'),
  ('jazz', 'musica'), ('música clássica', 'musica'), ('banda filarmónica', 'musica'),
  ('filarmónica', 'musica'), ('coro', 'musica'), ('recital', 'musica'),
  ('teatro', 'teatro'), ('artes performativas', 'teatro'), ('artes de palco', 'teatro'),
  ('marionetas', 'teatro'), ('circo', 'teatro'), ('teatro de rua', 'teatro'),
  ('dança', 'danca'), ('danca', 'danca'), ('bailado', 'danca'),
  ('folclore', 'danca'), ('rancho folclórico', 'danca'),
  ('cinema', 'cinema'), ('filme', 'cinema'), ('sessão de cinema', 'cinema'),
  ('cineclube', 'cinema'), ('documentário', 'cinema'),
  ('exposição', 'exposicoes'), ('exposicoes', 'exposicoes'), ('exposições', 'exposicoes'),
  ('artes visuais', 'exposicoes'), ('fotografia', 'exposicoes'), ('pintura', 'exposicoes'),
  ('museu', 'exposicoes'), ('galeria', 'exposicoes'),
  ('literatura', 'literatura'), ('livro', 'literatura'), ('apresentação de livro', 'literatura'),
  ('conferência', 'literatura'), ('palestra', 'literatura'), ('conversa', 'literatura'),
  ('poesia', 'literatura'), ('tertúlia', 'literatura'), ('hora do conto', 'literatura'),
  ('biblioteca', 'literatura'), ('debate', 'literatura'),
  ('património', 'patrimonio'), ('patrimonio', 'patrimonio'), ('visita guiada', 'patrimonio'),
  ('visitas', 'patrimonio'), ('roteiro', 'patrimonio'), ('arqueologia', 'patrimonio'),
  ('monumento', 'patrimonio'), ('história', 'patrimonio'),
  ('festas', 'festas-populares'), ('festa', 'festas-populares'),
  ('festas populares', 'festas-populares'), ('romaria', 'festas-populares'),
  ('arraial', 'festas-populares'), ('marchas', 'festas-populares'),
  ('festas do concelho', 'festas-populares'), ('carnaval', 'festas-populares'),
  ('semana santa', 'festas-populares'), ('procissão', 'festas-populares'),
  ('feira', 'feiras-mercados'), ('feiras', 'feiras-mercados'), ('mercado', 'feiras-mercados'),
  ('artesanato', 'feiras-mercados'), ('gastronomia', 'feiras-mercados'),
  ('mostra', 'feiras-mercados'),
  ('infantil', 'infantil'), ('família', 'infantil'), ('familia', 'infantil'),
  ('crianças', 'infantil'), ('público infantil', 'infantil'), ('serviço educativo', 'infantil'),
  ('oficina', 'formacao'), ('oficinas', 'formacao'), ('workshop', 'formacao'),
  ('atelier', 'formacao'), ('ateliê', 'formacao'), ('curso', 'formacao'),
  ('formação', 'formacao'), ('residência artística', 'formacao'),
  ('desporto', 'desporto-natureza'), ('natureza', 'desporto-natureza'),
  ('caminhada', 'desporto-natureza'), ('passeio', 'desporto-natureza'),
  ('percurso pedestre', 'desporto-natureza'), ('btt', 'desporto-natureza'),
  ('ambiente', 'desporto-natureza'),
  ('comunidade', 'comunidade'), ('associativismo', 'comunidade'),
  ('convívio', 'comunidade'), ('encontro', 'comunidade'), ('solidariedade', 'comunidade'),
  ('outros', 'outros'), ('diversos', 'outros'), ('geral', 'outros')
) as t(alias, category_slug)
order by 1
on conflict (alias) do update set category_slug = excluded.category_slug;
