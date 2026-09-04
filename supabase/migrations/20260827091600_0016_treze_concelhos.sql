-- 0016 — A CIM do Médio Tejo são treze concelhos, não onze.
--
-- A definição inicial de âmbito ficou em onze. Está errada: a Comunidade
-- Intermunicipal do Médio Tejo, que é também a NUTS III com o mesmo nome,
-- integra treze municípios. Faltavam a Sertã e Vila de Rei — os dois únicos
-- do distrito de Castelo Branco, e por isso os dois que uma lista feita a
-- partir do distrito de Santarém deixa de fora sem ninguém dar por isso.
--
-- Corrigir isto não é acrescentar duas linhas: este seed é a definição
-- operacional do âmbito do produto. Mexe nos feeds, no mapa, no widget, no
-- sitemap e na página dos concelhos ao mesmo tempo. Daí a migração própria,
-- com as fontes e os espaços que faltavam.
--
-- Sobre os espaços destes dois concelhos: entram poucos e todos marcados como
-- `provisional`. Não há levantamento feito no terreno, e inventar equipamentos
-- para a lista não parecer curta seria pior do que a lista curta — a agenda
-- passaria a mandar pessoas a sítios que talvez não existam. O backoffice
-- distingue-os, e completam-se à medida que forem confirmados.

insert into public.municipalities (id, name, district, dico_code, latitude, longitude, website_url, sort_order) values
  ('serta',        'Sertã',        'Castelo Branco', '0509', 39.8069, -8.0975, 'https://www.cm-serta.pt',     12),
  ('vila-de-rei',  'Vila de Rei',  'Castelo Branco', '0510', 39.6725, -8.1428, 'https://www.cm-viladerei.pt', 13)
on conflict (id) do update set
  name = excluded.name,
  district = excluded.district,
  dico_code = excluded.dico_code,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  website_url = excluded.website_url,
  sort_order = excluded.sort_order;

-- A ordem alfabética é a que a página dos concelhos usa, e passa a incluir os
-- dois novos no sítio certo.
--
-- Ordena-se pelo slug e não pelo nome com `collate`: a collation `pt-PT` não
-- existe em todas as instalações do Postgres, e uma migração que corre no
-- Supabase mas rebenta no Postgres do CI é uma migração que ninguém consegue
-- verificar. O slug já é ASCII sem acentos, que é exatamente a ordem
-- pretendida: «Mação» antes de «Ourém», «Sardoal» antes de «Sertã».
update public.municipalities set sort_order = novo.posicao
from (
  select id, row_number() over (order by public.slugify(name)) as posicao
    from public.municipalities
) as novo
where public.municipalities.id = novo.id;

insert into public.venues (
  id, name, municipality_id, parish, kind, status, is_association,
  latitude, longitude, website_url, wheelchair_accessible, notes
) values
  ('biblioteca-municipal-serta', 'Biblioteca Municipal da Sertã', 'serta', null, 'library', 'provisional', false,
   null, null, null, null, 'Designação e morada por confirmar.'),
  ('cineteatro-municipal-serta', 'Cineteatro Municipal da Sertã', 'serta', null, 'theatre', 'provisional', false,
   null, null, null, null, 'Existência e estado de funcionamento por confirmar.'),
  ('biblioteca-municipal-vila-de-rei', 'Biblioteca Municipal de Vila de Rei', 'vila-de-rei', null, 'library', 'provisional', false,
   null, null, null, null, 'Designação e morada por confirmar.'),
  ('centro-geodesico-portugal', 'Centro Geodésico de Portugal — Picoto da Milriça', 'vila-de-rei', null, 'outdoor', 'provisional', false,
   39.6714, -8.1372, null, null, 'Marco geodésico e miradouro; usado para iniciativas ao ar livre.')
on conflict (id) do update set
  name = excluded.name,
  municipality_id = excluded.municipality_id,
  kind = excluded.kind,
  status = excluded.status,
  notes = excluded.notes;

insert into public.sources (
  id, name, kind, municipality_id, venue_id, url, adapter, config, schedule, notes
) values
  ('cm-serta', 'Câmara Municipal da Sertã', 'municipal_site', 'serta', null,
   'https://www.cm-serta.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '55 4 * * *',
   'Seletores por calibrar na primeira execução.'),
  ('cm-viladerei', 'Câmara Municipal de Vila de Rei', 'municipal_site', 'vila-de-rei', null,
   'https://www.cm-viladerei.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '58 4 * * *',
   'Seletores por calibrar na primeira execução.')
on conflict (id) do update set
  name = excluded.name,
  municipality_id = excluded.municipality_id,
  url = excluded.url,
  adapter = excluded.adapter,
  schedule = excluded.schedule,
  notes = excluded.notes;

-- Coretos: não se acrescenta nenhum.
--
-- Não há levantamento feito para a Sertã nem para Vila de Rei, e um coreto
-- inventado no mapa é pior do que um mapa que assume o que lhe falta. A
-- página `/coretos` passa a dizer quais são os concelhos sem levantamento e a
-- convidar a corrigir — que é como um levantamento destes se completa.

comment on table public.municipalities is
  'Os 13 concelhos da Comunidade Intermunicipal do Médio Tejo. Onze do '
  'distrito de Santarém, mais a Sertã e Vila de Rei, de Castelo Branco. '
  'O `id` é o slug usado nos URLs.';
