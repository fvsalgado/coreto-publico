-- 0013 — Seed: as fontes de recolha.
--
-- A maioria dos sites municipais do Médio Tejo partilha o mesmo CMS, por isso
-- partilha o mesmo adaptador (`municipal-cms`) com configuração diferente. Um
-- adaptador `generic-html` fica disponível para os que fujam ao molde: a
-- configuração leva os seletores, e um site que muda de tema resolve-se por
-- SQL, sem deploy.
--
-- `min_expected_items` é a rede de segurança contra alterações de layout: uma
-- recolha que devolva menos do que isto é marcada com `layout_drift` e não
-- apaga nada. Começa a zero e é calibrada com a linha de base das primeiras
-- semanas — pôr um número inventado agora só produzia alarmes falsos.

insert into public.sources (
  id, name, kind, municipality_id, venue_id, url, adapter, config, schedule, notes
) values
  ('cm-abrantes', 'Câmara Municipal de Abrantes', 'municipal_site', 'abrantes', null,
   'https://www.cm-abrantes.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '0 4 * * *', null),
  ('cm-alcanena', 'Câmara Municipal de Alcanena', 'municipal_site', 'alcanena', null,
   'https://www.cm-alcanena.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '5 4 * * *', null),
  ('cm-constancia', 'Câmara Municipal de Constância', 'municipal_site', 'constancia', null,
   'https://www.cm-constancia.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '10 4 * * *', null),
  ('cm-entroncamento', 'Câmara Municipal do Entroncamento', 'municipal_site', 'entroncamento', null,
   'https://www.cm-entroncamento.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '15 4 * * *', null),
  ('cm-ferreiradozezere', 'Câmara Municipal de Ferreira do Zêzere', 'municipal_site', 'ferreira-do-zezere', null,
   'https://www.cm-ferreiradozezere.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '20 4 * * *', null),
  ('cm-macao', 'Câmara Municipal de Mação', 'municipal_site', 'macao', null,
   'https://www.cm-macao.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '25 4 * * *', null),
  ('cm-ourem', 'Câmara Municipal de Ourém', 'municipal_site', 'ourem', null,
   'https://servicos.cm-ourem.pt/eventos', 'generic-html', '{}'::jsonb, '30 4 * * *',
   'A agenda vive num subdomínio de serviços, fora do CMS do site principal.'),
  ('cm-sardoal', 'Câmara Municipal do Sardoal', 'municipal_site', 'sardoal', null,
   'https://www.cm-sardoal.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '35 4 * * *', null),
  ('cm-tomar', 'Câmara Municipal de Tomar', 'municipal_site', 'tomar', null,
   'https://www.cm-tomar.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '40 4 * * *', null),
  ('cm-torresnovas', 'Câmara Municipal de Torres Novas', 'municipal_site', 'torres-novas', null,
   'https://www.cm-torresnovas.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '45 4 * * *', null),
  ('cm-vnbarquinha', 'Câmara Municipal de Vila Nova da Barquinha', 'municipal_site', 'vila-nova-da-barquinha', null,
   'https://www.cm-vnbarquinha.pt/pt/agenda', 'municipal-cms', '{}'::jsonb, '50 4 * * *', null),

  -- Fontes complementares: equipamentos que publicam a sua própria agenda.
  ('teatro-virginia', 'Teatro Virgínia', 'venue_site', 'torres-novas', 'teatro-virginia',
   'https://www.teatrovirginia.pt/agenda', 'generic-html', '{}'::jsonb, '0 5 * * *', null),
  ('cine-teatro-paraiso', 'Cine-Teatro Paraíso', 'venue_site', 'tomar', 'cine-teatro-paraiso',
   'https://cineteatro.cm-tomar.pt', 'generic-html', '{}'::jsonb, '10 5 * * *', null)
on conflict (id) do update set
  name = excluded.name,
  kind = excluded.kind,
  municipality_id = excluded.municipality_id,
  venue_id = excluded.venue_id,
  url = excluded.url,
  adapter = excluded.adapter,
  schedule = excluded.schedule,
  notes = excluded.notes;

-- As agendas em PDF (mensais e quadrimestrais, algumas alojadas no Issuu)
-- entram como fontes desligadas: existem no registo, com o adaptador certo,
-- mas só passam a correr quando cada URL estiver confirmado. Uma fonte
-- ligada a apontar para o sítio errado é pior do que uma fonte por ligar.
insert into public.sources (
  id, name, kind, municipality_id, url, adapter, is_enabled, schedule, notes
) values
  ('agendas-pdf-medio-tejo', 'Agendas em PDF — Médio Tejo', 'pdf_agenda', null,
   'https://issuu.com', 'pdf-agenda', false, '0 6 1 * *',
   'Agendas mensais e quadrimestrais dos municípios. Cada URL é confirmado antes de ligar.')
on conflict (id) do update set
  name = excluded.name,
  notes = excluded.notes;
