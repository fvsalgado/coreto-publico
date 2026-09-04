-- 0012 — Seed: os coretos e os ciclos/festivais.

-- ---------------------------------------------------------------------------
-- coretos — o palco popular que dá nome ao projeto.
--
-- `is_confirmed = false` nos dois que faltam verificar (Constância e
-- Sardoal): entram como registo aberto, não como facto. A página /coretos
-- mostra-os como tal e convida a corrigir — é assim que se completa um
-- levantamento destes.
-- ---------------------------------------------------------------------------

insert into public.coretos (
  id, name, parish, municipality_id, year_built, is_confirmed, venue_id, notes
) values
  ('coreto-varzea-pequena', 'Coreto da Várzea Pequena', 'Várzea Pequena', 'tomar', 1897, true,
   'coreto-varzea-pequena',
   'Arquitetura do ferro. A Câmara de Tomar programa ali o «Verão no Coreto».'),
  ('coreto-jardim-municipal-torres-novas', 'Coreto do Jardim Municipal', null, 'torres-novas', null, true,
   'jardim-municipal-torres-novas', null),
  ('coreto-zibreira', 'Coreto de Zibreira', 'Zibreira', 'torres-novas', null, true,
   'coreto-zibreira', null),
  ('coreto-jardim-do-castelo', 'Coreto do Jardim do Castelo', null, 'abrantes', null, true,
   'coreto-jardim-do-castelo', null),
  ('coreto-rossio-ao-sul-do-tejo', 'Coreto do Rossio ao Sul do Tejo', 'Rossio ao Sul do Tejo', 'abrantes', null, true,
   'coreto-rossio-ao-sul-do-tejo', null),
  ('coreto-minde', 'Coreto de Minde', 'Minde', 'alcanena', null, true,
   'coreto-minde', 'Reconhecido como património cultural da vila.'),
  ('coreto-jardim-da-aranha', 'Coreto do Jardim da Aranha', null, 'entroncamento', 1934, true,
   'coreto-jardim-da-aranha', 'Tem uma estufa por baixo.'),
  ('coreto-espite', 'Coreto de Espite', 'Espite', 'ourem', null, true,
   'coreto-espite', null),
  ('coreto-carril', 'Coreto do Carril', null, 'ferreira-do-zezere', null, true,
   'coreto-carril', null),
  ('coreto-jardim-ribeirinho', 'Coreto do Jardim Ribeirinho', null, 'vila-nova-da-barquinha', null, true,
   'coreto-jardim-ribeirinho', null),
  ('coreto-penhascoso', 'Coreto de Penhascoso', 'Penhascoso', 'macao', null, true,
   'coreto-penhascoso', null),
  ('coreto-constancia', 'Coreto de Constância', null, 'constancia', null, false,
   null, 'Existência e localização por confirmar.'),
  ('coreto-sardoal', 'Coreto do Sardoal', null, 'sardoal', null, false,
   null, 'Existência e localização por confirmar.')
on conflict (id) do update set
  name = excluded.name,
  parish = excluded.parish,
  municipality_id = excluded.municipality_id,
  year_built = excluded.year_built,
  is_confirmed = excluded.is_confirmed,
  venue_id = excluded.venue_id,
  notes = excluded.notes;

-- ---------------------------------------------------------------------------
-- series — festivais, ciclos e programação em rede.
--
-- Os projetos da CIMT (CAMINHOS, VOLver) entram como `network_programme` e
-- `is_regional`: atravessam concelhos, e é essa a razão de a tabela existir.
-- ---------------------------------------------------------------------------

insert into public.series (id, name, kind, municipality_id, is_regional, description) values
  ('caminhos', 'CAMINHOS', 'network_programme', null, true,
   'Programação cultural em rede da Comunidade Intermunicipal do Médio Tejo.'),
  ('volver', 'VOLver', 'network_programme', null, true,
   'Programação cultural em rede da Comunidade Intermunicipal do Médio Tejo.'),
  ('bons-sons', 'Festival Bons Sons', 'festival', 'tomar', false,
   'Festival de música portuguesa em Cem Soldos.'),
  ('180-creative-camp', '180 Creative Camp', 'festival', 'abrantes', false,
   'Encontro internacional de criação em Abrantes.'),
  ('materiais-diversos', 'Festival Materiais Diversos', 'festival', 'alcanena', false,
   'Festival de dança e artes performativas com base em Minde.'),
  ('pomonas-camonianas', 'Pomonas Camonianas', 'festival', 'constancia', false,
   'Celebração camoniana anual em Constância.'),
  ('feira-do-tejo', 'Feira do Tejo', 'festival', 'vila-nova-da-barquinha', false, null),
  ('festfado', 'Festfado', 'cycle', 'vila-nova-da-barquinha', false, null),
  ('feira-sao-bras', 'Feira de São Brás / Mostra da Tigelada', 'festival', 'ferreira-do-zezere', false, null),
  ('semana-santa-sardoal', 'Semana Santa do Sardoal', 'cycle', 'sardoal', false, null),
  ('verao-no-coreto', 'Verão no Coreto', 'cycle', 'tomar', false,
   'Programação de verão no Coreto da Várzea Pequena.')
on conflict (id) do update set
  name = excluded.name,
  kind = excluded.kind,
  municipality_id = excluded.municipality_id,
  is_regional = excluded.is_regional,
  description = excluded.description;
