-- 0011 — Seed: espaços de programação dos concelhos do Médio Tejo.
--
-- Notas sobre o critério:
--  * O que a lista de arranque trazia como *evento* ou *ciclo* (180 Creative
--    Camp, Materiais Diversos, Pomonas Camonianas, Feira do Tejo, Festfado,
--    Feira de São Brás, Semana Santa, Bons Sons) não entra aqui — vai para
--    `series` na migração 0012. Um festival não é um sítio.
--  * `status = 'provisional'` marca o que entrou sem confirmação no terreno:
--    aparece no site, mas o backoffice sabe que falta verificar.
--  * `is_association = true` marca a cauda longa — filarmónicas, ranchos,
--    coletividades, cineclubes. É o que esta agenda existe para mostrar.
--  * As coordenadas em falta ficam nulas de propósito: um ponto errado no
--    mapa é pior do que um ponto ausente.

insert into public.venues (
  id, name, municipality_id, parish, kind, status, is_association,
  latitude, longitude, website_url, wheelchair_accessible, notes
) values

-- ------------------------------- Tomar -------------------------------------
  ('cine-teatro-paraiso', 'Cine-Teatro Paraíso', 'tomar', null, 'theatre', 'active', false,
   39.6042, -8.4136, 'https://cineteatro.cm-tomar.pt', true, null),
  ('ceft-casa-dos-cubos', 'CEFT — Casa dos Cubos', 'tomar', null, 'cultural_centre', 'active', false,
   39.6029, -8.4118, null, null, 'Centro de Estudos e Formação de Tomar.'),
  ('convento-de-cristo', 'Convento de Cristo', 'tomar', null, 'heritage', 'active', false,
   39.6041, -8.4184, null, null, 'Património Mundial UNESCO.'),
  ('igreja-da-misericordia-tomar', 'Igreja da Misericórdia', 'tomar', null, 'religious', 'active', false,
   null, null, null, null, 'Usada para concertos de música sacra e coral.'),
  ('mercado-municipal-tomar', 'Mercado Municipal de Tomar', 'tomar', null, 'market', 'active', false,
   null, null, null, null, null),
  ('museu-dos-fosforos', 'Museu dos Fósforos', 'tomar', null, 'museum', 'active', false,
   null, null, null, null, null),
  ('sinagoga-museu-luso-hebraico', 'Sinagoga / Museu Luso-Hebraico Abraão Zacuto', 'tomar', null, 'museum', 'active', false,
   39.6028, -8.4147, null, null, null),
  ('biblioteca-municipal-tomar', 'Biblioteca Municipal de Tomar', 'tomar', null, 'library', 'active', false,
   null, null, null, null, null),
  ('ipt', 'Instituto Politécnico de Tomar', 'tomar', null, 'education', 'active', false,
   39.6033, -8.3969, null, null, null),
  ('scocs-cem-soldos', 'SCOCS — Sociedade Cultural e Recreativa de Cem Soldos', 'tomar', 'Cem Soldos', 'association', 'active', true,
   null, null, null, null, 'Casa do Festival Bons Sons.'),
  ('coreto-varzea-pequena', 'Coreto da Várzea Pequena', 'tomar', 'Várzea Pequena', 'bandstand', 'active', false,
   null, null, null, null, 'Coreto de 1897, arquitetura do ferro. Palco do «Verão no Coreto».'),

-- ---------------------------- Torres Novas ---------------------------------
  ('teatro-virginia', 'Teatro Virgínia', 'torres-novas', null, 'theatre', 'active', false,
   39.4805, -8.5388, 'https://www.teatrovirginia.pt', true, null),
  ('museu-carlos-reis', 'Museu Municipal Carlos Reis', 'torres-novas', null, 'museum', 'active', false,
   null, null, null, null, null),
  ('biblioteca-gustavo-pinto-lopes', 'Biblioteca Municipal Gustavo Pinto Lopes', 'torres-novas', null, 'library', 'active', false,
   null, null, null, null, null),
  ('castelo-torres-novas', 'Castelo de Torres Novas', 'torres-novas', null, 'heritage', 'active', false,
   39.4818, -8.5378, null, null, null),
  ('cineclube-torres-novas', 'Cineclube de Torres Novas', 'torres-novas', null, 'association', 'active', true,
   null, null, null, null, null),
  ('choral-phydellius', 'Choral Phydellius', 'torres-novas', null, 'association', 'active', true,
   null, null, null, null, null),
  ('sf-lealdade-uniao-ribeirense', 'Sociedade Filarmónica Lealdade União Ribeirense', 'torres-novas', 'Riachos', 'association', 'active', true,
   null, null, null, null, null),
  ('sf-euterpe-meiaviense', 'Sociedade Filarmónica Euterpe Meiaviense', 'torres-novas', 'Meia Via', 'association', 'active', true,
   null, null, null, null, null),
  ('smut-lapas', 'SMUT — Lapas', 'torres-novas', 'Lapas', 'association', 'provisional', true,
   null, null, null, null, 'Sigla por confirmar antes de publicar o nome por extenso.'),
  ('jardim-municipal-torres-novas', 'Jardim Municipal de Torres Novas', 'torres-novas', null, 'outdoor', 'active', false,
   null, null, null, null, null),
  ('coreto-zibreira', 'Coreto de Zibreira', 'torres-novas', 'Zibreira', 'bandstand', 'active', false,
   null, null, null, null, null),

-- ------------------------------ Abrantes -----------------------------------
  ('miaa', 'MIAA — Museu Ibérico de Arqueologia e Arte', 'abrantes', null, 'museum', 'active', false,
   39.4636, -8.1975, null, true, null),
  ('biblioteca-antonio-botto', 'Biblioteca Municipal António Botto', 'abrantes', null, 'library', 'active', false,
   null, null, null, null, null),
  ('museu-dom-lopo-de-almeida', 'Museu D. Lopo de Almeida', 'abrantes', null, 'museum', 'active', false,
   null, null, null, null, null),
  ('cine-teatro-sao-pedro-abrantes', 'Cine-Teatro São Pedro', 'abrantes', null, 'theatre', 'provisional', false,
   null, null, null, null, 'Estado de funcionamento por confirmar.'),
  ('espalhafitas-cineclube', 'Espalhafitas Cineclube', 'abrantes', null, 'association', 'active', true,
   null, null, null, null, null),
  ('aquapolis-abrantes', 'Aquapolis', 'abrantes', null, 'outdoor', 'active', false,
   null, null, null, null, null),
  ('coreto-jardim-do-castelo', 'Coreto do Jardim do Castelo', 'abrantes', null, 'bandstand', 'active', false,
   null, null, null, null, null),
  ('coreto-rossio-ao-sul-do-tejo', 'Coreto do Rossio ao Sul do Tejo', 'abrantes', 'Rossio ao Sul do Tejo', 'bandstand', 'active', false,
   null, null, null, null, null),

-- -------------------------------- Ourém ------------------------------------
  ('teatro-municipal-ourem', 'Teatro Municipal de Ourém', 'ourem', null, 'theatre', 'active', false,
   null, null, null, true, null),
  ('museu-municipal-ourem', 'Museu Municipal de Ourém', 'ourem', null, 'museum', 'active', false,
   null, null, null, null, null),
  ('biblioteca-municipal-ourem', 'Biblioteca Municipal de Ourém', 'ourem', null, 'library', 'active', false,
   null, null, null, null, null),
  ('castelo-vila-medieval-ourem', 'Castelo e Vila Medieval de Ourém', 'ourem', null, 'heritage', 'active', false,
   39.6567, -8.5811, null, null, null),
  ('centro-municipal-exposicoes-ourem', 'Centro Municipal de Exposições', 'ourem', null, 'gallery', 'active', false,
   null, null, null, null, null),
  ('ourearte', 'Ourearte', 'ourem', null, 'cultural_centre', 'active', false,
   null, null, null, null, null),
  ('casa-do-povo-de-fatima', 'Casa do Povo de Fátima', 'ourem', 'Fátima', 'association', 'active', true,
   null, null, null, null, null),
  ('santuario-de-fatima', 'Santuário de Fátima', 'ourem', 'Fátima', 'religious', 'active', false,
   39.6317, -8.6725, null, true, null),
  ('centro-pastoral-paulo-vi', 'Centro Pastoral Paulo VI', 'ourem', 'Fátima', 'auditorium', 'active', false,
   null, null, null, null, null),
  ('coreto-espite', 'Coreto de Espite', 'ourem', 'Espite', 'bandstand', 'active', false,
   null, null, null, null, null),

-- ------------------------------ Alcanena -----------------------------------
  ('cine-teatro-sao-pedro-alcanena', 'Cine-Teatro São Pedro de Alcanena', 'alcanena', null, 'theatre', 'active', false,
   null, null, null, null, null),
  ('casa-da-cultura-pateo', 'Casa da Cultura / Páteo', 'alcanena', null, 'cultural_centre', 'active', false,
   null, null, null, null, null),
  ('museu-municipal-alcanena', 'Museu Municipal de Alcanena', 'alcanena', null, 'museum', 'active', false,
   null, null, null, null, null),
  ('mercado-municipal-alcanena', 'Mercado Municipal de Alcanena', 'alcanena', null, 'market', 'active', false,
   null, null, null, null, null),
  ('ccv-alviela-carsoscopio', 'CCV Alviela — Carsoscópio', 'alcanena', null, 'museum', 'active', false,
   39.4478, -8.6011, null, null, 'Centro Ciência Viva do Alviela.'),
  ('estudio-de-danca-alcanena', 'Estúdio de Dança', 'alcanena', null, 'education', 'provisional', false,
   null, null, null, null, 'Designação oficial por confirmar.'),
  ('biblioteca-municipal-alcanena', 'Biblioteca Municipal de Alcanena', 'alcanena', null, 'library', 'provisional', false,
   null, null, null, null, 'Acrescentada para completar a rede das 11 bibliotecas municipais; designação por confirmar.'),

-- ------------------------- Minde (Alcanena) --------------------------------
  ('fabrica-de-cultura-minde', 'Fábrica de Cultura', 'alcanena', 'Minde', 'cultural_centre', 'active', false,
   null, null, null, null, null),
  ('cine-teatro-rogerio-venancio', 'Cine-Teatro Rogério Venâncio', 'alcanena', 'Minde', 'theatre', 'active', false,
   null, null, null, null, null),
  ('marg-minde', 'MARG — Museu Aguarela Roque Gameiro', 'alcanena', 'Minde', 'museum', 'active', false,
   null, null, null, null, null),
  ('caorg-minde', 'CAORG — Casa de Artes e Ofícios Roque Gameiro', 'alcanena', 'Minde', 'cultural_centre', 'provisional', false,
   null, null, null, null, 'Nome por extenso por confirmar.'),
  ('casa-da-memoria-minde', 'Casa da Memória de Minde', 'alcanena', 'Minde', 'museum', 'active', false,
   null, null, null, null, null),
  ('espaco-jazz-minde', 'Espaço Jazz', 'alcanena', 'Minde', 'cultural_centre', 'active', false,
   null, null, null, null, null),
  ('sociedade-musical-mindense', 'Sociedade Musical Mindense', 'alcanena', 'Minde', 'association', 'active', true,
   null, null, null, null, null),
  ('coreto-minde', 'Coreto de Minde', 'alcanena', 'Minde', 'bandstand', 'active', false,
   null, null, null, null, 'Reconhecido como património cultural da vila.'),

-- --------------------------- Entroncamento ---------------------------------
  ('museu-nacional-ferroviario', 'Museu Nacional Ferroviário', 'entroncamento', null, 'museum', 'active', false,
   39.4645, -8.4718, null, true, null),
  ('centro-cultural-entroncamento', 'Centro Cultural do Entroncamento', 'entroncamento', null, 'cultural_centre', 'active', false,
   null, null, null, null, null),
  ('biblioteca-municipal-entroncamento', 'Biblioteca Municipal do Entroncamento', 'entroncamento', null, 'library', 'active', false,
   null, null, null, null, null),
  ('coreto-jardim-da-aranha', 'Coreto do Jardim da Aranha', 'entroncamento', null, 'bandstand', 'active', false,
   null, null, null, null, 'Coreto de 1934, com estufa por baixo.'),

-- ----------------------------- Constância ----------------------------------
  ('casa-memoria-de-camoes', 'Casa-Memória de Camões', 'constancia', null, 'museum', 'active', false,
   null, null, null, null, null),
  ('ccv-constancia', 'Centro Ciência Viva de Constância — Parque de Astronomia', 'constancia', null, 'museum', 'active', false,
   39.4742, -8.3364, null, null, null),
  ('biblioteca-municipal-constancia', 'Biblioteca Municipal de Constância', 'constancia', null, 'library', 'active', false,
   null, null, null, null, null),

-- ---------------------- Vila Nova da Barquinha -----------------------------
  ('centro-cultural-barquinha', 'Centro Cultural de Vila Nova da Barquinha', 'vila-nova-da-barquinha', null, 'cultural_centre', 'active', false,
   null, null, null, null, null),
  ('parque-escultura-almourol', 'Parque de Escultura Contemporânea de Almourol', 'vila-nova-da-barquinha', null, 'outdoor', 'active', false,
   null, null, null, null, null),
  ('castelo-de-almourol', 'Castelo de Almourol / CITA', 'vila-nova-da-barquinha', null, 'heritage', 'active', false,
   39.4611, -8.3811, null, false, 'Acesso por barco; CITA é o centro de interpretação em terra.'),
  ('coreto-jardim-ribeirinho', 'Coreto do Jardim Ribeirinho', 'vila-nova-da-barquinha', null, 'bandstand', 'active', false,
   null, null, null, null, null),
  ('biblioteca-municipal-barquinha', 'Biblioteca Municipal de Vila Nova da Barquinha', 'vila-nova-da-barquinha', null, 'library', 'provisional', false,
   null, null, null, null, 'Acrescentada para completar a rede das 11 bibliotecas municipais; designação por confirmar.'),

-- ------------------------ Ferreira do Zêzere --------------------------------
  ('casa-da-cultura-ferreira-do-zezere', 'Casa da Cultura', 'ferreira-do-zezere', null, 'cultural_centre', 'provisional', false,
   null, null, null, null, 'Estado de funcionamento por confirmar.'),
  ('dornes', 'Dornes', 'ferreira-do-zezere', 'Dornes', 'heritage', 'active', false,
   39.7228, -8.2647, null, null, 'Aldeia e torre templária sobre a albufeira.'),
  ('lago-azul', 'Lago Azul', 'ferreira-do-zezere', null, 'outdoor', 'active', false,
   null, null, null, null, null),
  ('coreto-carril', 'Coreto do Carril', 'ferreira-do-zezere', null, 'bandstand', 'active', false,
   null, null, null, null, null),
  ('biblioteca-municipal-ferreira-do-zezere', 'Biblioteca Municipal de Ferreira do Zêzere', 'ferreira-do-zezere', null, 'library', 'provisional', false,
   null, null, null, null, 'Acrescentada para completar a rede das 11 bibliotecas municipais; designação por confirmar.'),

-- -------------------------------- Mação ------------------------------------
  ('museu-arte-pre-historica-macao', 'Museu de Arte Pré-Histórica e do Sagrado do Vale do Tejo', 'macao', null, 'museum', 'active', false,
   null, null, null, null, null),
  ('biblioteca-municipal-macao', 'Biblioteca Municipal de Mação', 'macao', null, 'library', 'active', false,
   null, null, null, null, null),
  ('coreto-penhascoso', 'Coreto de Penhascoso', 'macao', 'Penhascoso', 'bandstand', 'active', false,
   null, null, null, null, null),

-- ------------------------------- Sardoal -----------------------------------
  ('centro-cultural-gil-vicente', 'Centro Cultural Gil Vicente', 'sardoal', null, 'cultural_centre', 'active', false,
   null, null, null, null, null),
  ('biblioteca-municipal-sardoal', 'Biblioteca Municipal do Sardoal', 'sardoal', null, 'library', 'active', false,
   null, null, null, null, null)

on conflict (id) do update set
  name = excluded.name,
  municipality_id = excluded.municipality_id,
  parish = excluded.parish,
  kind = excluded.kind,
  status = excluded.status,
  is_association = excluded.is_association,
  latitude = coalesce(excluded.latitude, public.venues.latitude),
  longitude = coalesce(excluded.longitude, public.venues.longitude),
  website_url = coalesce(excluded.website_url, public.venues.website_url),
  notes = coalesce(excluded.notes, public.venues.notes);

-- ---------------------------------------------------------------------------
-- Aliases: as grafias com que as fontes escrevem estes espaços.
-- ---------------------------------------------------------------------------
insert into public.venue_aliases (alias, venue_id)
select distinct on (1) public.normalize_for_hash(alias), venue_id
from (values
  ('Cineteatro Paraíso', 'cine-teatro-paraiso'),
  ('Cine Teatro Paraíso', 'cine-teatro-paraiso'),
  ('CT Paraíso', 'cine-teatro-paraiso'),
  ('Casa dos Cubos', 'ceft-casa-dos-cubos'),
  ('CEFT', 'ceft-casa-dos-cubos'),
  ('Teatro Virgínia', 'teatro-virginia'),
  ('TV Torres Novas', 'teatro-virginia'),
  ('Museu Carlos Reis', 'museu-carlos-reis'),
  ('Biblioteca Gustavo Pinto Lopes', 'biblioteca-gustavo-pinto-lopes'),
  ('Museu Ibérico de Arqueologia e Arte', 'miaa'),
  ('Museu Ibérico', 'miaa'),
  ('Carsoscópio', 'ccv-alviela-carsoscopio'),
  ('Centro Ciência Viva do Alviela', 'ccv-alviela-carsoscopio'),
  ('Museu Ferroviário', 'museu-nacional-ferroviario'),
  ('Museu Nacional Ferroviário do Entroncamento', 'museu-nacional-ferroviario'),
  ('Parque de Astronomia', 'ccv-constancia'),
  ('Centro Ciência Viva de Constância', 'ccv-constancia'),
  ('Castelo de Almourol', 'castelo-de-almourol'),
  ('CITA', 'castelo-de-almourol'),
  ('Convento de Cristo', 'convento-de-cristo'),
  ('Sinagoga de Tomar', 'sinagoga-museu-luso-hebraico'),
  ('Museu Luso-Hebraico Abraão Zacuto', 'sinagoga-museu-luso-hebraico'),
  ('Cem Soldos', 'scocs-cem-soldos'),
  ('SCOCS', 'scocs-cem-soldos'),
  ('Museu Roque Gameiro', 'marg-minde'),
  ('Sociedade Filarmónica Euterpe Meiaviense', 'sf-euterpe-meiaviense'),
  ('Euterpe Meiaviense', 'sf-euterpe-meiaviense'),
  ('Lealdade União Ribeirense', 'sf-lealdade-uniao-ribeirense')
) as t(alias, venue_id)
order by 1
on conflict (alias) do update set venue_id = excluded.venue_id;
