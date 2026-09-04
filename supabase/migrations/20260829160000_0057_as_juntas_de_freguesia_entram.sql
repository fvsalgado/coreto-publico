-- 0057 — as juntas de freguesia entram
--
-- Vinte e cinco juntas de freguesia do Médio Tejo correm o mesmo CMS — o
-- «Portal da Freguesia», da GESAutarquia — e por isso ligam-se todas ao
-- adaptador `portal-freguesia`, que Minde estreou na 0056. Não há código novo
-- nesta vaga: só linhas.
--
-- Cada uma destas foi confirmada viva a 2026-08-29, uma a uma e com pausa: a
-- rota `/freguesia/agenda` respondeu 200, com a marca do CMS no HTML e com a
-- mobília da agenda (as ligações para «todos» e «concluídos»). Três
-- instalações do mesmo produto ficaram de fora porque redirecionam para a
-- entrada — têm o produto sem o módulo de agenda: Serra de Santo António
-- (Alcanena), Casal dos Bernardos e Urqueira (Ourém). Entram quando as juntas
-- o ligarem.
--
-- **`min_expected_items` a zero**, como em Minde: uma agenda de freguesia está
-- legitimamente vazia semanas a fio, e quem distingue «vazia» de «partida» é o
-- adaptador, que confirma a mobília da página antes de aceitar zero. Dezassete
-- destas estão a zero hoje — fim de agosto é entressafra.
--
-- **`locationName` e `parish`**: a agenda de uma junta é a agenda daquela
-- freguesia, e isso sabe-se por construção da fonte. É o chão do que se sabe;
-- um espaço do catálogo ganha-lhe sempre. Nas uniões usa-se o nome da união
-- sem o prefixo, para não escolher uma das freguesias em nome da outra — a
-- excepção é a união de Tomar, onde as duas freguesias são a mesma cidade.

begin;

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-fontes',
  'Junta de Freguesia de Fontes',
  'venue_site',
  'abrantes',
  null,
  'https://www.freguesiadefontes.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Fontes', 'parish', 'Fontes'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 1 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-martinchel',
  'Junta de Freguesia de Martinchel',
  'venue_site',
  'abrantes',
  null,
  'https://www.jf-martinchel.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Martinchel', 'parish', 'Martinchel'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 5 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-aldeia-do-mato-e-souto',
  'União das Freguesias de Aldeia do Mato e Souto',
  'venue_site',
  'abrantes',
  null,
  'https://www.uf-aldeiadomatoesouto.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Aldeia do Mato e Souto', 'parish', 'União das Freguesias de Aldeia do Mato e Souto'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-bugalhos',
  'Junta de Freguesia de Bugalhos',
  'venue_site',
  'alcanena',
  null,
  'https://www.freguesiadebugalhos.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Bugalhos', 'parish', 'Bugalhos'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-constancia',
  'Junta de Freguesia de Constância',
  'venue_site',
  'constancia',
  null,
  'https://www.jf-constancia.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Constância', 'parish', 'Constância'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 9 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-montalvo',
  'Junta de Freguesia de Montalvo',
  'venue_site',
  'constancia',
  null,
  'https://www.jf-montalvo.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Montalvo', 'parish', 'Montalvo'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 12 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-santa-margarida-da-coutada',
  'Junta de Freguesia de Santa Margarida da Coutada',
  'venue_site',
  'constancia',
  null,
  'https://www.jf-santamargaridacoutada.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Santa Margarida da Coutada', 'parish', 'Santa Margarida da Coutada'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-macao-penhascoso-e-aboboreira',
  'União das Freguesias de Mação, Penhascoso e Aboboreira',
  'venue_site',
  'macao',
  null,
  'https://www.uf-macao.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Mação, Penhascoso e Aboboreira', 'parish', 'União das Freguesias de Mação, Penhascoso e Aboboreira'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-atouguia',
  'Junta de Freguesia de Atouguia',
  'venue_site',
  'ourem',
  null,
  'https://www.jf-atouguia.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Atouguia', 'parish', 'Atouguia'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-caxarias',
  'Junta de Freguesia de Caxarias',
  'venue_site',
  'ourem',
  null,
  'https://www.freguesiadecaxarias.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Caxarias', 'parish', 'Caxarias'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-cercal',
  'Junta de Freguesia de Cercal',
  'venue_site',
  'ourem',
  null,
  'https://www.jf-cercal.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Cercal', 'parish', 'Cercal'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-espite',
  'Junta de Freguesia de Espite',
  'venue_site',
  'ourem',
  null,
  'https://www.espite.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Espite', 'parish', 'Espite'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-gondemaria',
  'Junta de Freguesia de Gondemaria',
  'venue_site',
  'ourem',
  null,
  'https://www.jf-gondemaria.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Gondemaria', 'parish', 'Gondemaria'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-matas',
  'Junta de Freguesia de Matas',
  'venue_site',
  'ourem',
  null,
  'https://www.jf-matas.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Matas', 'parish', 'Matas'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-nossa-senhora-da-piedade',
  'Junta de Freguesia de Nossa Senhora da Piedade',
  'venue_site',
  'ourem',
  null,
  'https://www.jf-nspiedade.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Nossa Senhora da Piedade', 'parish', 'Nossa Senhora da Piedade'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-olival',
  'Junta de Freguesia de Olival',
  'venue_site',
  'ourem',
  null,
  'https://www.jf-olival.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Olival', 'parish', 'Olival'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-rio-de-couros',
  'Junta de Freguesia de Rio de Couros',
  'venue_site',
  'ourem',
  null,
  'https://www.jf-riodecouros.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Rio de Couros', 'parish', 'Rio de Couros'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-seica',
  'Junta de Freguesia de Seiça',
  'venue_site',
  'ourem',
  null,
  'https://www.jf-seica.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Seiça', 'parish', 'Seiça'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-valhascos',
  'Junta de Freguesia de Valhascos',
  'venue_site',
  'sardoal',
  null,
  'https://www.jf-valhascos.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Valhascos', 'parish', 'Valhascos'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-junceira',
  'Junta de Freguesia de Junceira',
  'venue_site',
  'tomar',
  null,
  'https://www.jf-junceira.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Junceira', 'parish', 'Junceira'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-paialvo',
  'Junta de Freguesia de Paialvo',
  'venue_site',
  'tomar',
  null,
  'https://www.freguesiadepaialvo.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Paialvo', 'parish', 'Paialvo'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-serra',
  'Junta de Freguesia de Serra',
  'venue_site',
  'tomar',
  null,
  'https://www.jf-serra.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Serra', 'parish', 'Serra'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 1 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-tomar',
  'União das Freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  'venue_site',
  'tomar',
  null,
  'https://www.freg-sjoaosmaria-tomar.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Tomar', 'parish', 'União das Freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 2 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-assentiz',
  'Junta de Freguesia de Assentiz',
  'venue_site',
  'torres-novas',
  null,
  'https://www.jf-assentiz.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Assentiz', 'parish', 'Assentiz'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 1 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   min_expected_items, public_note, notes)
values (
  'jf-chancelaria',
  'Junta de Freguesia de Chancelaria',
  'venue_site',
  'torres-novas',
  null,
  'https://www.freguesiadechancelaria.pt/freguesia/agenda',
  'portal-freguesia',
  jsonb_build_object('locationName', 'Chancelaria', 'parish', 'Chancelaria'),
  true,
  0,
  'A agenda da junta de freguesia. O que uma junta publica quase nunca passa pela agenda do município.',
  'Portal da Freguesia (GESAutarquia). Confirmada viva a 2026-08-29: 200, marca do CMS e mobília da agenda. Tinha 0 evento(s) por acontecer nesse dia.'
)
on conflict (id) do update
   set name = excluded.name,
       kind = excluded.kind,
       municipality_id = excluded.municipality_id,
       url = excluded.url,
       adapter = excluded.adapter,
       config = excluded.config,
       is_enabled = excluded.is_enabled,
       min_expected_items = excluded.min_expected_items,
       public_note = excluded.public_note,
       notes = excluded.notes,
       updated_at = now();

do $$
declare
  n int;
  m int;
begin
  select count(*) into n
    from public.sources
   where adapter = 'portal-freguesia' and is_enabled;
  if n <> 26 then
    raise exception 'esperavam-se %s fontes do Portal da Freguesia ligadas, há %s', 26, n;
  end if;

  -- Todas têm de declarar onde é, senão cada evento sem espaço ia à fila de
  -- moderação e a fila enchia-se de coisas que ninguém pode resolver.
  select count(*) into m
    from public.sources
   where adapter = 'portal-freguesia' and is_enabled
     and (config->>'locationName' is null or config->>'parish' is null);
  if m <> 0 then
    raise exception '%s fontes de freguesia sem local nem freguesia declarados', m;
  end if;

  -- A rota é a do produto. Uma que aponte para outro sítio é um engano de
  -- copiar e colar, e só se vê quando a recolha falha.
  select count(*) into m
    from public.sources
   where adapter = 'portal-freguesia' and url not like '%/freguesia/agenda';
  if m <> 0 then
    raise exception '%s fontes do Portal da Freguesia a apontar para fora de /freguesia/agenda', m;
  end if;
end $$;

commit;
