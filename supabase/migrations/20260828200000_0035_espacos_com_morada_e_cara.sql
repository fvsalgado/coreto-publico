-- 0035 — Os espaços deixam de ser nomes soltos: moradas, coordenadas,
-- contactos, nomes próprios e fachadas.
--
-- O catálogo tinha 77 espaços com ZERO moradas, zero códigos postais, zero
-- telefones e zero fotografias — uma lista de nomes bonitos. Este é o
-- resultado do levantamento de 2026-08-28, feito espaço a espaço contra
-- fontes verificáveis: páginas municipais, sites dos próprios equipamentos,
-- a folha oficial da Rede Nacional de Bibliotecas Públicas (DGLAB),
-- OSM/Nominatim para coordenadas (© OpenStreetMap contributors, ODbL) e o
-- Wikimedia Commons para fachadas com licença livre — cada fotografia leva o
-- crédito de autor e licença em `image_credit`, como as licenças CC exigem.
-- A regra do levantamento foi a da casa: o que não se confirmou ficou vazio.
--
-- As correções de identidade que o levantamento obrigou a fazer:
--
--   * As bibliotecas ganham o nome próprio: Dr. Carlos Nunes Ferreira
--     (Alcanena), Alexandre O'Neill (Constância), António Cartaxo da Fonseca
--     (Tomar). Os nomes antigos ficam como alias para a recolha continuar a
--     resolver.
--   * O Museu D. Lopo de Almeida foi extinto em 2021: o espaço é hoje o
--     Panteão dos Almeida, na Igreja de Santa Maria do Castelo, e o acervo
--     migrou para o MIAA.
--   * CAORG é «Centro», não «Casa», de Artes e Ofícios Roque Gameiro.
--   * SCOCS é o Sport Club Operário de Cem Soldos; SMUT é a Sociedade
--     Musical União e Trabalho (Lapas, 1920); a Lealdade União Ribeirense é
--     da Ribeira Ruiva, não de Riachos.
--
-- Este ficheiro cobre os grupos A (Abrantes–Entroncamento) e C
-- (Tomar–Barquinha) do levantamento; os concelhos do grupo B (FZ, Mação,
-- Ourém, Sardoal) seguem na migração seguinte quando a verificação fechar.
-- Cada bloco é um espaço; os aliases no fim de cada bloco existem quando o
-- nome mudou, para nada deixar de casar.

-- aquapolis-abrantes
update public.venues set
  name = 'Aquapolis — Parque Urbano e Ribeirinho de Abrantes',
  parish = 'Abrantes (São Vicente e São João) e Alferrarede (margem norte) / São Miguel do Rio Torto e Rossio ao Sul do Tejo (margem sul)',
  address = 'Margens norte e sul do rio Tejo, entre as duas pontes',
  postal_code = '2200-366',
  latitude = 39.4494628,
  longitude = -8.1910852,
  website_url = 'http://turismo.cm-abrantes.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Aquapolis_-_Abrantes_-_Portugal_(3557193789).jpg?width=1600',
  image_credit = 'Vitor Oliveira (Torres Vedras), CC BY-SA 2.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Parque inaugurado em 2007; abrange as duas margens do Tejo (Parque Norte e Parque Sul); sem contacto telefónico próprio publicado — contactos via CM Abrantes (241 330 100).',
  updated_at = now()
where id = 'aquapolis-abrantes';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Aquapolis'), 'aquapolis-abrantes')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Aquapolis — Parque Urbano e Ribeirinho de Abrantes'), 'aquapolis-abrantes')
  on conflict (alias) do nothing;

-- biblioteca-antonio-botto
update public.venues set
  parish = 'Abrantes (São Vicente e São João) e Alferrarede',
  address = 'Convento de S. Domingos (ala do antigo convento; entrada pelo Jardim da República)',
  postal_code = '2200-343',
  latitude = 39.4608847,
  longitude = -8.1975089,
  phone = '241 330 100',
  email = 'biblioteca@cm-abrantes.pt',
  website_url = 'http://www.bmab.cm-abrantes.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Entrada_para_Antigo_Convento_de_S%C3%A3o_Domingos_e_para_Biblioteca_Municipal_Ant%C3%B3nio_Botto.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Continua numa ala do Convento de S. Domingos, edifício que desde 12/2021 partilha com o MIAA; o site oficial bmab.cm-abrantes.pt respondeu com erro 503 durante a verificação.',
  updated_at = now()
where id = 'biblioteca-antonio-botto';

-- cine-teatro-sao-pedro-abrantes
update public.venues set
  name = 'Cineteatro São Pedro',
  parish = 'Abrantes (São Vicente e São João) e Alferrarede',
  address = 'Largo de São Pedro',
  postal_code = '2200-351',
  latitude = 39.464111,
  longitude = -8.198011,
  email = 'cine.teatro@cm-abrantes.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Cine-Teatro_S%C3%A3o_Pedro_01.jpg?width=1600',
  image_credit = 'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Inaugurado em 1949 (arq. Ruy Jervis d''Athouguia); comprado pelo município em 2020; em requalificação profunda (~2,6 M€) desde 2023, com reabertura anunciada para o final de 2025 e novo auditório de 386 lugares — reabertura efetiva não confirmada à data (08/2026), confirmar estado antes de publicar.',
  updated_at = now()
where id = 'cine-teatro-sao-pedro-abrantes';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Cine-Teatro São Pedro'), 'cine-teatro-sao-pedro-abrantes')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Cineteatro São Pedro'), 'cine-teatro-sao-pedro-abrantes')
  on conflict (alias) do nothing;

-- coreto-jardim-do-castelo
update public.venues set
  parish = 'Abrantes (São Vicente e São João) e Alferrarede',
  address = 'Jardim do Castelo (interior da fortaleza do Castelo de Abrantes)',
  postal_code = '2200-344',
  latitude = 39.4631469,
  longitude = -8.1945807,
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Jardim_do_Castelo_de_Abrantes_04.jpg?width=1600',
  image_credit = 'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Coreto octogonal de ferro, provavelmente de 1894/95, originalmente na Praça da República e depois transferido para o Jardim do Castelo (fonte allaboutportugal/coisasdeabrantes — blogues/diretórios); a foto indicada mostra claramente o coreto.',
  updated_at = now()
where id = 'coreto-jardim-do-castelo';

-- coreto-rossio-ao-sul-do-tejo
update public.venues set
  parish = 'São Miguel do Rio Torto e Rossio ao Sul do Tejo',
  address = 'Largo D.ª Joana Godinho Soares Mendes, Rossio ao Sul do Tejo',
  latitude = 39.4480949,
  longitude = -8.1922338,
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Coreto de 1915 (data indicada pelo diretório igogo), base de pedra e estrutura de ferro octogonal; considerado o mais bonito do concelho.',
  updated_at = now()
where id = 'coreto-rossio-ao-sul-do-tejo';

-- espalhafitas-cineclube
update public.venues set
  name = 'Espalhafitas — Cineclube de Abrantes',
  parish = 'Abrantes (São Vicente e São João) e Alferrarede',
  address = 'Sr. Chiado, Praça Raimundo Soares, n.º 20 (local das sessões regulares)',
  postal_code = '2200-366',
  latitude = 39.4629202,
  longitude = -8.1976251,
  phone = '241 372 515',
  email = 'espalhafitas@gmail.com',
  website_url = 'https://espalhafitas.wixsite.com/cineclubedeabrantes',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Secção de cinema da Palha de Abrantes — Associação de Desenvolvimento Cultural (sede: Edifício Carneiro, Rua de S. Pedro, 2200-398 Abrantes); sessões às quartas-feiras no Sr. Chiado e, no Sardoal, no CC Gil Vicente; «Cinema na Aldeia» no verão.',
  updated_at = now()
where id = 'espalhafitas-cineclube';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Espalhafitas Cineclube'), 'espalhafitas-cineclube')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Espalhafitas — Cineclube de Abrantes'), 'espalhafitas-cineclube')
  on conflict (alias) do nothing;

-- miaa
update public.venues set
  name = 'MIAA — Museu Ibérico de Arqueologia e Arte (Abrantes)',
  parish = 'Abrantes (São Vicente e São João) e Alferrarede',
  address = 'Jardim da República, 25 (antigo Convento de S. Domingos)',
  postal_code = '2200-343',
  latitude = 39.460722,
  longitude = -8.197417,
  phone = '241 330 103',
  email = 'museusdeabrantes@cm-abrantes.pt',
  website_url = 'https://www.museusdeabrantes.pt/miaa/miaa.html',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/MIAA_-_Museu_Ib%C3%A9rico_de_Arqueologia_e_Arte_de_Abrantes_02.jpg?width=1600',
  image_credit = 'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Inaugurado a 8/12/2021 no antigo Convento de S. Domingos; Prémio APOM Museu do Ano 2023; horário 3.ª–dom. 10:00–12:30/14:00–17:30; integra a rede Museus de Abrantes.',
  updated_at = now()
where id = 'miaa';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('MIAA — Museu Ibérico de Arqueologia e Arte'), 'miaa')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('MIAA — Museu Ibérico de Arqueologia e Arte (Abrantes)'), 'miaa')
  on conflict (alias) do nothing;

-- museu-dom-lopo-de-almeida
update public.venues set
  name = 'Panteão dos Almeida',
  parish = 'Abrantes (São Vicente e São João) e Alferrarede',
  address = 'Castelo/Fortaleza de Abrantes, Praça Dom Francisco de Almeida',
  latitude = 39.4647751,
  longitude = -8.1950103,
  phone = '241 371 724',
  email = 'museusdeabrantes@cm-abrantes.pt',
  website_url = 'https://www.museusdeabrantes.pt/panteao/panteao.html',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Igreja_de_Santa_Maria_do_Castelo_(Abrantes)_01.jpg?width=1600',
  image_credit = 'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: IMPORTANTE — o Museu D. Lopo de Almeida (criado em 1921) foi substituído em 2021 pela nova musealização «Panteão dos Almeida», aberta a 15/06/2021 na Igreja de Santa Maria do Castelo; o acervo móvel migrou em grande parte para o MIAA; atualizar o nome na base de dados.',
  updated_at = now()
where id = 'museu-dom-lopo-de-almeida';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Museu D. Lopo de Almeida'), 'museu-dom-lopo-de-almeida')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Panteão dos Almeida'), 'museu-dom-lopo-de-almeida')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Igreja de Santa Maria do Castelo'), 'museu-dom-lopo-de-almeida')
  on conflict (alias) do nothing;

-- biblioteca-municipal-alcanena
update public.venues set
  name = 'Biblioteca Municipal Dr. Carlos Nunes Ferreira',
  parish = 'Alcanena e Vila Moreira',
  address = 'Rua 25 de Abril, n.º 286',
  postal_code = '2380-042',
  latitude = 39.4572135,
  longitude = -8.668374,
  phone = '249 891 207',
  website_url = 'https://cm-alcanena.pt/index.php/viver/cultura-e-lazer/biblioteca-municipal',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Nome próprio confirmado — patrono Dr. Carlos Nunes Ferreira; inaugurada a 28/09/2002; horário 2.ª–6.ª 10:00–13:00/14:00–18:00; catálogo online em biblioteca-catalogo.m-alcanena.pt.',
  updated_at = now()
where id = 'biblioteca-municipal-alcanena';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Biblioteca Municipal de Alcanena'), 'biblioteca-municipal-alcanena')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Biblioteca Municipal Dr. Carlos Nunes Ferreira'), 'biblioteca-municipal-alcanena')
  on conflict (alias) do nothing;

-- caorg-minde
update public.venues set
  name = 'CAORG — Centro de Artes e Ofícios Roque Gameiro',
  parish = 'Minde',
  address = 'Rua Monsenhor Michel, n.º 54 — Apartado 35',
  postal_code = '2395-201',
  latitude = 39.5154236,
  longitude = -8.6890168,
  phone = '249 840 022',
  email = 'info@caorg.pt',
  website_url = 'http://caorg.pt',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: O nome oficial é «Centro de Artes e Ofícios Roque Gameiro» (não «Casa»); associação criada em 1986; pólos: MARG, Conservatório de Música Jaime Chavinha, ateliers de tecelagem/restauro/desenho/dança, Charales Chorus, Piação dos Xarales.',
  updated_at = now()
where id = 'caorg-minde';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('CAORG — Casa de Artes e Ofícios Roque Gameiro'), 'caorg-minde')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('CAORG — Centro de Artes e Ofícios Roque Gameiro'), 'caorg-minde')
  on conflict (alias) do nothing;

-- casa-da-cultura-pateo
update public.venues set
  name = 'Casa da Cultura de Alcanena (Casa Municipal da Cultura) e Páteo',
  parish = 'Alcanena e Vila Moreira',
  address = 'Praça 8 de Maio (edifício com frente para a Rua do Bairro Mota)',
  postal_code = '2380-037',
  latitude = 39.4603106,
  longitude = -8.6672729,
  phone = '249 889 114',
  email = 'cultura@cm-alcanena.pt',
  website_url = 'https://cm-alcanena.pt/index.php/viver/cultura-e-lazer',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_distante_para_Casa_da_Cultura_de_Alcanena,_junto_%C3%A0_Pra%C3%A7a_8_de_Maio.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Casa anterior a 1937 (mandada construir por Manuel dos Santos Moita Júnior), doada ao município; alberga a Galeria Maria Lucília Moita e serviços de Cultura; o «Páteo (da) Casa da Cultura» é o espaço exterior usado em festivais (p. ex. Festival Materiais Diversos).',
  updated_at = now()
where id = 'casa-da-cultura-pateo';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Casa da Cultura / Páteo'), 'casa-da-cultura-pateo')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Casa da Cultura de Alcanena (Casa Municipal da Cultura) e Páteo'), 'casa-da-cultura-pateo')
  on conflict (alias) do nothing;

-- casa-da-memoria-minde
update public.venues set
  name = 'Casa da Memória Prof. Abílio Madeira Martins',
  parish = 'Minde',
  address = 'Rua Dr. António A. Ferreira Totta, 14',
  postal_code = '2395-157',
  phone = '249 840 457',
  email = 'geral@jf-minde.pt',
  website_url = 'https://www.jf-minde.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Casa_da_Mem%C3%B3ria_Prof._Ab%C3%ADlio_Madeira_Martins.jpg?width=1600',
  image_credit = 'Jotamartins, CC0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Arquivo/centro de memória inaugurado a 20/01/2019, na esfera patrimonial da Junta de Freguesia de Minde; telefone/email indicados são os da JF (gestora) — a casa não tem contactos próprios publicados.',
  updated_at = now()
where id = 'casa-da-memoria-minde';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Casa da Memória de Minde'), 'casa-da-memoria-minde')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Casa da Memória Prof. Abílio Madeira Martins'), 'casa-da-memoria-minde')
  on conflict (alias) do nothing;

-- ccv-alviela-carsoscopio
update public.venues set
  name = 'Centro Ciência Viva do Alviela — Carsoscópio',
  parish = 'Malhou, Louriceira e Espinheiro (Louriceira)',
  address = 'Praia Fluvial dos Olhos d''Água do Alviela, Rua dos Olhos d''Água, Louriceira',
  postal_code = '2380-450',
  latitude = 39.4454903,
  longitude = -8.7098929,
  phone = '249 881 805',
  email = 'info@alviela.cienciaviva.pt',
  website_url = 'https://alviela.cienciaviva.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Centro_Ci%C3%AAncia_Viva_do_Alviela_01.jpg?width=1600',
  image_credit = 'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Aberto desde 15/12/2007, requalificado; junto à nascente do Alviela, no PN Serras de Aire e Candeeiros; encerra à 2.ª feira; dispõe de centro de alojamento próprio (tel. 249 881 805).',
  updated_at = now()
where id = 'ccv-alviela-carsoscopio';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('CCV Alviela — Carsoscópio'), 'ccv-alviela-carsoscopio')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Centro Ciência Viva do Alviela — Carsoscópio'), 'ccv-alviela-carsoscopio')
  on conflict (alias) do nothing;

-- cine-teatro-rogerio-venancio
update public.venues set
  name = 'Cine-Teatro Rogério Venâncio (Cine-Teatro de Minde)',
  parish = 'Minde',
  address = 'Avenida José António de Carvalho (EN 243)',
  postal_code = '2395-163',
  phone = '249 849 123',
  email = 'cpminde@gmail.com',
  website_url = 'https://cpminde.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_pr%C3%B3xima_para_Cine-Teatro_de_Minde.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Inaugurado em 1952, 277 lugares, propriedade da Casa do Povo de Minde; segundo cpminde.pt está «em processo de reabertura após encerramento prolongado» — confirmar estado antes de publicar; nome homenageia Rogério Venâncio (1919–2018); diretórios indicam também «Rua das Escolas 10» (entrada da Casa do Povo).',
  updated_at = now()
where id = 'cine-teatro-rogerio-venancio';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Cine-Teatro Rogério Venâncio'), 'cine-teatro-rogerio-venancio')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Cine-Teatro Rogério Venâncio (Cine-Teatro de Minde)'), 'cine-teatro-rogerio-venancio')
  on conflict (alias) do nothing;

-- cine-teatro-sao-pedro-alcanena
update public.venues set
  parish = 'Alcanena e Vila Moreira',
  address = 'Avenida 25 de Abril (junto aos Paços do Concelho)',
  postal_code = '2380-042',
  phone = '939 091 303',
  email = 'cultura@cm-alcanena.pt',
  website_url = 'https://cm-alcanena.pt/index.php/viver/cultura-e-lazer/cine-teatro-sao-pedro',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Fachada_principal_do_Cine-Teatro_S%C3%A3o_Pedro_de_Alcanena.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Reconstrução que manteve só a fachada do antigo cine-teatro; reaberto em 2008; auditório de 300 lugares, galeria e café-concerto; integra a RTCP (equipamento apoiado 2022-2025; dir. artística André Conceição).',
  updated_at = now()
where id = 'cine-teatro-sao-pedro-alcanena';

-- coreto-minde
update public.venues set
  parish = 'Minde',
  address = 'Largo Justino Guedes (junto à Capela de Santo António e à Casa dos Açores/MARG)',
  postal_code = '2395-126',
  latitude = 39.5131628,
  longitude = -8.6876764,
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Coreto_de_Minde_em_2024.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Usado como palco em festivais (p. ex. Festival Materiais Diversos 2021); há fotos alternativas CC BY-SA 2.0 de Vitor Oliveira no Commons.',
  updated_at = now()
where id = 'coreto-minde';

-- espaco-jazz-minde
update public.venues set
  name = 'Espaço Jazz (Minde)',
  parish = 'Minde',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Espaço usado como venue do Festival Materiais Diversos (2021) e em eventos ligados à Casa do Povo de Minde/JazzMinde; morada, contactos e gestão não publicados em fontes verificáveis — recomenda-se confirmação junto da Casa do Povo de Minde (cpminde@gmail.com).',
  updated_at = now()
where id = 'espaco-jazz-minde';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Espaço Jazz'), 'espaco-jazz-minde')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Espaço Jazz (Minde)'), 'espaco-jazz-minde')
  on conflict (alias) do nothing;

-- estudio-de-danca-alcanena
update public.venues set
  name = 'Estúdio de Dança de Alcanena',
  parish = 'Alcanena e Vila Moreira',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Escola de dança ativa desde 2014 (ballet, moderna, contemporânea), apoiada pelo Município e parceira da associação O Corpo da Dança; morada física não publicada — só redes sociais.',
  updated_at = now()
where id = 'estudio-de-danca-alcanena';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Estúdio de Dança'), 'estudio-de-danca-alcanena')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Estúdio de Dança de Alcanena'), 'estudio-de-danca-alcanena')
  on conflict (alias) do nothing;

-- fabrica-de-cultura-minde
update public.venues set
  name = 'Fábrica de Cultura (Minde)',
  parish = 'Minde',
  address = 'Rua das Escolas Novas, 10',
  postal_code = '2395-158',
  latitude = 39.515025,
  longitude = -8.686881,
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Antiga unidade têxtil convertida em polo cultural/criativo (recebe o festival JazzMinde); empreitada de requalificação «Fase 1» (~3 M€) lançada em 03/2025 — confirmar se está aberta ou em obras antes de publicar eventos.',
  updated_at = now()
where id = 'fabrica-de-cultura-minde';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Fábrica de Cultura'), 'fabrica-de-cultura-minde')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Fábrica de Cultura (Minde)'), 'fabrica-de-cultura-minde')
  on conflict (alias) do nothing;

-- marg-minde
update public.venues set
  name = 'MARG — Museu de Aguarela Roque Gameiro',
  parish = 'Minde',
  address = 'Largo Justino Guedes, 2 — Apartado 35 (Casa dos Açores)',
  postal_code = '2395-131',
  latitude = 39.5130079,
  longitude = -8.6876211,
  phone = '249 841 292',
  email = 'museuaguarela@caorg.pt',
  website_url = 'http://caorg.pt/polos/museu-de-aguarela-roque-gameiro/',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Fachada_principal_da_Casa_dos_A%C3%A7ores_de_Minde,_atual_Museu_de_Aguarela_Roque_Gameiro.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Único museu português dedicado à aguarela, na «Casa dos Açores»; gerido pelo CAORG; encerra 2.ª feira e feriados; na lista da base de dados figura «Museu Aguarela Roque Gameiro» — a grafia corrente do CAORG é «Museu de Aguarela Roque Gameiro».',
  updated_at = now()
where id = 'marg-minde';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('MARG — Museu Aguarela Roque Gameiro'), 'marg-minde')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('MARG — Museu de Aguarela Roque Gameiro'), 'marg-minde')
  on conflict (alias) do nothing;

-- mercado-municipal-alcanena
update public.venues set
  name = 'Mercado Municipal de Alcanena António Galveias Dias',
  parish = 'Alcanena e Vila Moreira',
  address = 'Rua Professora Margarida Adelaide Gonçalves Louro',
  latitude = 39.4566999,
  longitude = -8.6688192,
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Edifício de 1985, requalificado (≈1,6 M€) e reaberto a 7/10/2020 com o nome do patrono António Galveias Dias; inclui espaço multiusos para atividades culturais — relevante para agenda.',
  updated_at = now()
where id = 'mercado-municipal-alcanena';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Mercado Municipal de Alcanena'), 'mercado-municipal-alcanena')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Mercado Municipal de Alcanena António Galveias Dias'), 'mercado-municipal-alcanena')
  on conflict (alias) do nothing;

-- museu-municipal-alcanena
update public.venues set
  parish = 'Alcanena e Vila Moreira',
  address = 'Rua A',
  postal_code = '2380-011',
  latitude = 39.4577378,
  longitude = -8.6626787,
  phone = '249 101 442',
  email = 'museu.municipal@cm-alcanena.pt',
  website_url = 'https://cm-alcanena.pt/index.php/visitar/o-que-visitar/museus',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Inaugurado a 4/10/2024 no edifício projetado para Museu do Curtume; horário 3.ª–6.ª 10:00–13:00/14:00–18:00; GPS aproximado (centróide da rua).',
  updated_at = now()
where id = 'museu-municipal-alcanena';

-- sociedade-musical-mindense
update public.venues set
  name = 'Sociedade Musical Mindense («Banda de Minde»)',
  parish = 'Minde',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Fundada a 25/10/1915, associação mais antiga do concelho, utilidade pública, com sede própria em Minde (morada exata não publicada; existe a «Rua da Sociedade Musical Mindense», 2395-189, junto à qual a sede provavelmente se situa — não confirmado); 110 anos celebrados em 2025 com o festival «riTmos ouTonais».',
  updated_at = now()
where id = 'sociedade-musical-mindense';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Sociedade Musical Mindense'), 'sociedade-musical-mindense')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Sociedade Musical Mindense («Banda de Minde»)'), 'sociedade-musical-mindense')
  on conflict (alias) do nothing;

-- biblioteca-municipal-constancia
update public.venues set
  name = 'Biblioteca Municipal Alexandre O''Neill',
  parish = 'Constância',
  address = 'Estrada Nacional 3, n.º 13',
  postal_code = '2250-028',
  latitude = 39.4770051,
  longitude = -8.3371985,
  phone = '249 739 367',
  email = 'biblioteca@cm-constancia.pt',
  website_url = 'https://bibliotecas.constancia.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_frontal_para_Biblioteca_Municipal_Alexandre_O%27Neill_em_Const%C3%A2ncia.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Nome próprio confirmado — patrono o poeta Alexandre O''Neill, cujo espólio bibliográfico (3400+ títulos) ali está depositado; horário oficial 2.ª–6.ª 9:00–17:00.',
  updated_at = now()
where id = 'biblioteca-municipal-constancia';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Biblioteca Municipal de Constância'), 'biblioteca-municipal-constancia')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Biblioteca Municipal Alexandre O''Neill'), 'biblioteca-municipal-constancia')
  on conflict (alias) do nothing;

-- casa-memoria-de-camoes
update public.venues set
  parish = 'Constância',
  address = 'Rua do Tejo (sítio das ruínas atribuídas à residência do poeta)',
  postal_code = '2250-058',
  latitude = 39.4749439,
  longitude = -8.3377155,
  phone = '249 730 052',
  email = 'camoes.constancia@gmail.com',
  website_url = 'https://camoesconstancia.wixsite.com/casa-memoria-camoes',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Casa-Mem%C3%B3ria_de_Cam%C3%B5es,_Const%C3%A2ncia_01.jpg?width=1600',
  image_credit = 'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Erguida sobre ruínas quinhentistas classificadas (IIP, 1983; obras a partir de 1991, projeto da FA-Lisboa); gerida pela Associação da Casa-Memória de Camões (morada associativa: Rua da Barca, 1, 2250-046), que também dinamiza o Jardim-Horto de Camões; aberta ao público sáb./dom./feriados 14:00–18:00 (fonte: turismo municipal).',
  updated_at = now()
where id = 'casa-memoria-de-camoes';

-- ccv-constancia
update public.venues set
  parish = 'Constância',
  address = 'Alto de St.ª Bárbara, Via Galileu Galilei, n.º 817',
  postal_code = '2250-100',
  latitude = 39.4949483,
  longitude = -8.32628,
  phone = '249 739 066',
  email = 'info@constancia.cienciaviva.pt',
  website_url = 'https://constancia.cienciaviva.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Centro_Ci%C3%AAncia_Viva_de_Const%C3%A2ncia,_Munic%C3%ADpio_de_Const%C3%A2ncia_02.jpg?width=1600',
  image_credit = 'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Parque temático de astronomia ao ar livre no Alto de Santa Bárbara.',
  updated_at = now()
where id = 'ccv-constancia';

-- biblioteca-municipal-entroncamento
update public.venues set
  parish = 'São João Baptista',
  address = 'Rua da Junta de Freguesia, n.º 1',
  postal_code = '2330-114',
  latitude = 39.4646156,
  longitude = -8.4672948,
  phone = '249 720 419',
  email = 'biblioteca@cm-entroncamento.pt',
  website_url = 'https://bibliotecaentroncamento.wordpress.com',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Sem nome de patrono encontrado (designação oficial: Biblioteca Municipal do Entroncamento); horário 2.ª–6.ª 9:30–18:00, sáb. 9:30–13:00; o site municipal cm-entroncamento.pt devolveu erro 500 durante toda a verificação.',
  updated_at = now()
where id = 'biblioteca-municipal-entroncamento';

-- centro-cultural-entroncamento
update public.venues set
  parish = 'São João Baptista',
  address = 'Rua 5 de Outubro',
  postal_code = '2330-092',
  latitude = 39.4646517,
  longitude = -8.4684249,
  phone = '249 720 400',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Aberto em 1991; auditório com cerca de 400 lugares; morada/telefone provêm de diretórios porque o site municipal (cm-entroncamento.pt e cultura.cm-entroncamento.pt) esteve em baixo (erros 500/502) durante a verificação — revalidar quando o portal voltar.',
  updated_at = now()
where id = 'centro-cultural-entroncamento';

-- coreto-jardim-da-aranha
update public.venues set
  name = 'Coreto do Jardim-Parque Dr. José Pereira Caldas (Jardim da Aranha)',
  parish = 'São João Baptista',
  address = 'Jardim-Parque Dr. José Pereira Caldas («Jardim da Aranha»)',
  latitude = 39.4663422,
  longitude = -8.4653689,
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Fonte_de_%C3%A1gua_por_baixo_do_coreto_-_Jardim_Parque_Dr._Pereira_Caldas.jpg?width=1600',
  image_credit = 'Protectportugal, CC0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Confirmado — o nome oficial do jardim é «Jardim-Parque Dr. José Pereira Caldas», construído em 1934 pela Junta de Freguesia; o coreto assenta sobre a estufa (com a aranha de ferro no teto que dá nome popular ao jardim); requalificado em 2012-2013; há foto geral do jardim (CC0) em File:Jardim Parque Dr. Pereira Caldas (Jardim da Aranha).jpg.',
  updated_at = now()
where id = 'coreto-jardim-da-aranha';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Coreto do Jardim da Aranha'), 'coreto-jardim-da-aranha')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Coreto do Jardim-Parque Dr. José Pereira Caldas (Jardim da Aranha)'), 'coreto-jardim-da-aranha')
  on conflict (alias) do nothing;

-- museu-nacional-ferroviario
update public.venues set
  name = 'Museu Nacional Ferroviário (Fundação Museu Nacional Ferroviário Armando Ginestal Machado)',
  parish = 'Nossa Senhora de Fátima',
  address = 'Rua Eng.º Ferreira de Mesquita, n.º 1 A — Complexo Ferroviário do Entroncamento',
  postal_code = '2330-152',
  latitude = 39.4641198,
  longitude = -8.4742574,
  phone = '249 130 382',
  email = 'museu@fmnf.pt',
  website_url = 'https://www.fmnf.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/A_entrada_para_o_Museu_Nacional_Ferrovi%C3%A1rio_01.jpg?width=1600',
  image_credit = 'Joehawkins, CC0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Gerido pela Fundação Museu Nacional Ferroviário; horário 3.ª–dom. 10:30–17:30; no Commons há também «Entroncamento Rotunda.jpg» (CC BY 3.0, Andreas Nagel) com a rotunda de locomotivas do complexo.',
  updated_at = now()
where id = 'museu-nacional-ferroviario';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Museu Nacional Ferroviário'), 'museu-nacional-ferroviario')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Museu Nacional Ferroviário (Fundação Museu Nacional Ferroviário Armando Ginestal Machado)'), 'museu-nacional-ferroviario')
  on conflict (alias) do nothing;

-- biblioteca-municipal-tomar
update public.venues set
  name = 'Biblioteca Municipal de Tomar António Cartaxo da Fonseca',
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  address = 'Alameda dos Templários',
  postal_code = '2300-303',
  latitude = 39.603283,
  longitude = -8.405333,
  phone = '+351 249 329 874',
  email = 'biblioteca@cm-tomar.pt',
  website_url = 'https://www.cm-tomar.pt/viver/educacao-e-biblioteca',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Entrada_da_Biblioteca_Municipal_Ant%C3%B3nio_Cartaxo_da_Fonseca.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Patrono confirmado — António Cartaxo da Fonseca (tomarense que doou c. 50 000 volumes); inaugurada a 15-11-1997. Foto verificada visualmente (fachada/entrada). Segundo telefone no site municipal 249 324 141.',
  updated_at = now()
where id = 'biblioteca-municipal-tomar';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Biblioteca Municipal de Tomar'), 'biblioteca-municipal-tomar')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Biblioteca Municipal de Tomar António Cartaxo da Fonseca'), 'biblioteca-municipal-tomar')
  on conflict (alias) do nothing;

-- ceft-casa-dos-cubos
update public.venues set
  name = 'Centro de Estudos em Fotografia de Tomar (CEFT) — Casa dos Cubos',
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  address = 'Praceta Alves Redol',
  postal_code = '2300-552',
  latitude = 39.6025331,
  longitude = -8.4119075,
  phone = '+351 249 156 680',
  email = 'ceft-casacubos@ipt.pt',
  website_url = 'https://ceft.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Enquadramento_da_Casa_dos_Cubos,_em_Tomar.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Antigo armazém agrícola («cubos» = medidas de capacidade); parceria Município de Tomar/IPT. Instagram @casacubosceft. Foto verificada (exterior); a foto «House of Cubes» de Jaimrsilva é interior.',
  updated_at = now()
where id = 'ceft-casa-dos-cubos';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('CEFT — Casa dos Cubos'), 'ceft-casa-dos-cubos')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Centro de Estudos em Fotografia de Tomar (CEFT) — Casa dos Cubos'), 'ceft-casa-dos-cubos')
  on conflict (alias) do nothing;

-- cine-teatro-paraiso
update public.venues set
  name = 'Cine-Teatro Paraíso — Sala de Espetáculos de Tomar',
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  address = 'Rua Infantaria 15',
  postal_code = '2300-583',
  latitude = 39.6013,
  longitude = -8.4144,
  phone = '+351 249 329 190',
  email = 'cineteatro@cm-tomar.pt',
  website_url = 'https://cineteatro.cm-tomar.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_aproximada_para_fachada_principal_do_Cine-Teatro_Para%C3%ADso,_em_Tomar.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: «Infantaria 15» é o NOME da rua (Regimento de Infantaria n.º 15), não número de porta. Reinaugurado em 2002; gerido pela CM Tomar. Foto de fachada verificada visualmente.',
  updated_at = now()
where id = 'cine-teatro-paraiso';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Cine-Teatro Paraíso'), 'cine-teatro-paraiso')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Cine-Teatro Paraíso — Sala de Espetáculos de Tomar'), 'cine-teatro-paraiso')
  on conflict (alias) do nothing;

-- convento-de-cristo
update public.venues set
  name = 'Convento de Cristo (Castelo Templário e Convento de Cristo)',
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  address = 'Convento de Cristo',
  postal_code = '2300-000',
  latitude = 39.6035941,
  longitude = -8.4199276,
  phone = '+351 249 313 481',
  email = 'geral.ccristo@museusemonumentos.pt',
  website_url = 'http://www.conventocristo.gov.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Convento_de_Cristo_-_South_Facade.jpg?width=1600',
  image_credit = 'Ingo Mehling, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Património Mundial UNESCO; tutela Museus e Monumentos de Portugal, diretora Andreia Galvão; 2.º telefone 249 315 089; Instagram @convento_de_cristo.oficial.',
  updated_at = now()
where id = 'convento-de-cristo';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Convento de Cristo'), 'convento-de-cristo')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Convento de Cristo (Castelo Templário e Convento de Cristo)'), 'convento-de-cristo')
  on conflict (alias) do nothing;

-- coreto-varzea-pequena
update public.venues set
  name = 'Coreto da Várzea Pequena (Coreto de Tomar)',
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  address = 'Jardim da Várzea Pequena, Largo Cândido dos Reis',
  postal_code = '2300-593',
  latitude = 39.6061091,
  longitude = -8.4143946,
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_aproximada_para_Coreto_de_Tomar_em_2023.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Resposta à dúvida «(Mouchão?)» — NÃO fica no Parque do Mouchão (ilhota no Nabão, a nascente); fica no Jardim da Várzea Pequena, Largo Cândido dos Reis. Coreto de ferro de 1897, das obras de arquitetura do ferro mais bem conservadas de Tomar. Foto verificada.',
  updated_at = now()
where id = 'coreto-varzea-pequena';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Coreto da Várzea Pequena'), 'coreto-varzea-pequena')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Coreto da Várzea Pequena (Coreto de Tomar)'), 'coreto-varzea-pequena')
  on conflict (alias) do nothing;

-- igreja-da-misericordia-tomar
update public.venues set
  name = 'Igreja da Misericórdia de Tomar',
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  address = 'Avenida Dr. Cândido Madureira',
  postal_code = '2300-351',
  latitude = 39.6016,
  longitude = -8.4141,
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Igreja_da_Miseric%C3%B3rdia_de_Tomar.JPG?width=1600',
  image_credit = 'Paulo Juntas, CC BY-SA 2.5, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Fundação manuelina (Misericórdia criada em 1510); associada ao antigo Hospital de N.ª S.ª da Graça; pertence à Santa Casa da Misericórdia de Tomar (sede: Rua Infantaria 15, 9E, tel. 249 312 326 — diretórios, não confirmado oficialmente). Página municipal indicava «temporariamente encerrada». GPS aproximado. Foto de fachada verificada visualmente.',
  updated_at = now()
where id = 'igreja-da-misericordia-tomar';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Igreja da Misericórdia'), 'igreja-da-misericordia-tomar')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Igreja da Misericórdia de Tomar'), 'igreja-da-misericordia-tomar')
  on conflict (alias) do nothing;

-- ipt
update public.venues set
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  address = 'Quinta do Contador, Estrada da Serra',
  postal_code = '2300-313',
  latitude = 39.600889,
  longitude = -8.391472,
  phone = '+351 249 328 100',
  email = 'geral@ipt.pt',
  website_url = 'https://www.ipt.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Campus_do_IPT_em_2019.jpg?width=1600',
  image_credit = 'Joaopaulopedro, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Foto = edifícios do campus junto ao lago (não há foto de «fachada» única no Commons); verificada visualmente.',
  updated_at = now()
where id = 'ipt';

-- mercado-municipal-tomar
update public.venues set
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  latitude = 39.6023295,
  longitude = -8.4096067,
  website_url = 'https://www.cm-tomar.pt/index.php/viver/mercado-municipal',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Edifício no quarteirão entre a Av. General Norton de Matos e a Rua Santa Iria (OSM associa-o à Rua Santa Iria; guias indicam Av. Norton de Matos) — morada e CP deixados vazios por falta de fonte oficial inequívoca. Contacto só via CM Tomar (249 329 800).',
  updated_at = now()
where id = 'mercado-municipal-tomar';

-- museu-dos-fosforos
update public.venues set
  name = 'Museu dos Fósforos Aquiles da Mota Lima',
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  address = 'Convento de São Francisco, Avenida General Bernardo Faria',
  postal_code = '2300-535',
  latitude = 39.5998439,
  longitude = -8.4144434,
  phone = '+351 249 329 823',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Convento_de_S%C3%A3o_Francisco_-_Tomar_-_Portugal_(52906118828).jpg?width=1600',
  image_credit = 'Vitor Oliveira from Torres Vedras, PORTUGAL, CC BY-SA 2.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Instalado no Convento de S. Francisco desde 1989; coleção iniciada por Aquiles da Mota Lima (1953), doada ao município em 1980; maior coleção de caixas de fósforos da Europa. Foto = fachada do Convento de S. Francisco (edifício que o alberga).',
  updated_at = now()
where id = 'museu-dos-fosforos';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Museu dos Fósforos'), 'museu-dos-fosforos')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Museu dos Fósforos Aquiles da Mota Lima'), 'museu-dos-fosforos')
  on conflict (alias) do nothing;

-- scocs-cem-soldos
update public.venues set
  name = 'SCOCS — Sport Club Operário de Cem Soldos',
  parish = 'União das freguesias de Madalena e Beselga',
  address = 'Largo de S. Pedro, 58 A/B, Cem Soldos',
  latitude = 39.5869538,
  longitude = -8.4517258,
  phone = '+351 249 345 232',
  email = 'geral@scocs.pt',
  website_url = 'https://www.scocs.pt',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: CORREÇÃO ao catálogo — a sigla NÃO é «Sociedade Cultural e Recreativa»: é Sport Club Operário de Cem Soldos (fundado em 1981; NIF 501270841 regista «Sport Club Operário…»). Organiza o festival Bons Sons. Telemóvel 913 765 386. GPS aproximado (centro da aldeia); site scocs.pt indisponível à data da verificação. Só existe vídeo Lusa no Commons, sem foto de fachada.',
  updated_at = now()
where id = 'scocs-cem-soldos';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('SCOCS — Sociedade Cultural e Recreativa de Cem Soldos'), 'scocs-cem-soldos')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('SCOCS — Sport Club Operário de Cem Soldos'), 'scocs-cem-soldos')
  on conflict (alias) do nothing;

-- sinagoga-museu-luso-hebraico
update public.venues set
  name = 'Sinagoga de Tomar — Núcleo Interpretativo da Sinagoga de Tomar (Museu Luso-Hebraico Abraão Zacuto)',
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  address = 'Rua Dr. Joaquim Jacinto, 73',
  postal_code = '2300-577',
  latitude = 39.6032017,
  longitude = -8.4137871,
  phone = '+351 249 329 823',
  email = 'turismo@cm-tomar.pt',
  website_url = 'https://www.cm-tomar.pt/index.php/visitar/o-que-visitar/sinagoga',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Fachada_principal_da_Sinagoga_de_Tomar_em_2023.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Sinagoga do séc. XV (único templo hebraico proto-renascentista do país); desde as obras de 2019 o espaço museológico é o «Núcleo Interpretativo», herdeiro do Museu Luso-Hebraico Abraão Zacuto (fundado por si em 1939). Foto de fachada (Categoria Commons «Sinagoga de Tomar»).',
  updated_at = now()
where id = 'sinagoga-museu-luso-hebraico';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Sinagoga / Museu Luso-Hebraico Abraão Zacuto'), 'sinagoga-museu-luso-hebraico')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Sinagoga de Tomar — Núcleo Interpretativo da Sinagoga de Tomar (Museu Luso-Hebraico Abraão Zacuto)'), 'sinagoga-museu-luso-hebraico')
  on conflict (alias) do nothing;

-- biblioteca-gustavo-pinto-lopes
update public.venues set
  parish = 'União das freguesias de Torres Novas (São Pedro), Lapas e Ribeira Branca',
  address = 'Jardim das Rosas (Rua da Fontinha)',
  postal_code = '2350-444',
  latitude = 39.4808482,
  longitude = -8.5398182,
  phone = '+351 249 810 310',
  email = 'biblioteca@cm-torresnovas.pt',
  website_url = 'https://rbtn.torresnovas.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Audit%C3%B3rio_e_Biblioteca_Municipal_Gustavo_Pinto_Lopes,_Torres_Novas_01.jpg?width=1600',
  image_credit = 'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Junto ao Jardim das Rosas e às Piscinas Municipais Fernando Cunha; inclui Auditório. Patrono: Gustavo Pinto Lopes (retratado por Carlos Reis em 1936). Foto de exterior verificada. Instagram @bmgpl_.',
  updated_at = now()
where id = 'biblioteca-gustavo-pinto-lopes';

-- castelo-torres-novas
update public.venues set
  parish = 'União das freguesias de Torres Novas (São Pedro), Lapas e Ribeira Branca',
  address = 'Rua General António César de Vasconcelos Correia',
  postal_code = '2350-421',
  latitude = 39.479982,
  longitude = -8.5405777,
  phone = '+351 249 839 430',
  website_url = 'https://visit.torresnovas.pt/pt/interesses/castelo-de-torres-novas',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Castelo_de_Torres_Novas_-_Portugal_(1555022500).jpg?width=1600',
  image_credit = 'Vitor Oliveira from Torres Vedras, PORTUGAL, CC BY-SA 2.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Monumento Nacional (1910), conquistado por D. Sancho I em 1190; 11 torres. Informações/reservas: Museu Municipal Carlos Reis, 249 812 535. Foto (muralhas e torre) verificada visualmente.',
  updated_at = now()
where id = 'castelo-torres-novas';

-- choral-phydellius
update public.venues set
  parish = 'União das freguesias de Torres Novas (Santa Maria, Salvador e Santiago)',
  address = 'Rua Alexandre Herculano, 147 — Quinta da Lezíria, Ap. 44',
  postal_code = '2354-909',
  phone = '+351 249 826 129',
  email = 'geral@choralphydellius.pt',
  website_url = 'https://www.choralphydellius.pt',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Coro fundado em 1957; escola de música desde 1975 e Conservatório de Música reconhecido pelo ME em 1993. Telemóveis 967 090 101 / 918 986 263. GPS não atribuído (rua com vários segmentos; número 147 não localizável com rigor no OSM). No Commons existe apenas o símbolo/logotipo (File:Phydellius.jpg), não fachada.',
  updated_at = now()
where id = 'choral-phydellius';

-- cineclube-torres-novas
update public.venues set
  parish = 'União das freguesias de Torres Novas (Santa Maria, Salvador e Santiago)',
  address = 'Rua Artur Gonçalves, n.º 20',
  postal_code = '2350-429',
  latitude = 39.4785944,
  longitude = -8.5394106,
  email = 'cineclube.torresnovas@gmail.com',
  website_url = 'http://cctorresnovas.blogspot.com',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Sessões regulares («Cinema às quartas», 21h30) decorrem no Teatro Virgínia, não na sede. Fundado há mais de 65 anos. GPS aproximado (arruamento).',
  updated_at = now()
where id = 'cineclube-torres-novas';

-- coreto-zibreira
update public.venues set
  parish = 'Zibreira',
  address = 'Praça Engenheiro Luís Tavares Simão, Zibreira',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Coreto onde atuam bandas filarmónicas em dias de festa. Morada de fonte não oficial (diretório) — confirmar junto da Junta de Freguesia de Zibreira. Sem GPS fiável (praça não mapeada no OSM/Nominatim).',
  updated_at = now()
where id = 'coreto-zibreira';

-- jardim-municipal-torres-novas
update public.venues set
  parish = 'União das freguesias de Torres Novas (São Pedro), Lapas e Ribeira Branca',
  address = 'Avenida Doutor João Martins de Azevedo',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Jardim_Municipal_de_Torres_Novas,_Torres_Novas_05.jpg?width=1600',
  image_credit = 'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Resposta à dúvida «(Jardim das Rosas?)» — NÃO são o mesmo: o Jardim Municipal fica no sopé do castelo, na margem oposta do Almonda, ligado ao Jardim das Rosas (inaugurado em 2003, recinto das Festas do Almonda) por pontes pedonais (Ponte da Fontinha). Foto verificada (pérgula do jardim com o castelo por cima). GPS omitido — jardim não mapeado como polígono nomeado no OSM.',
  updated_at = now()
where id = 'jardim-municipal-torres-novas';

-- museu-carlos-reis
update public.venues set
  parish = 'União das freguesias de Torres Novas (Santa Maria, Salvador e Santiago)',
  address = 'Rua do Salvador, 10',
  postal_code = '2350-416',
  latitude = 39.4793067,
  longitude = -8.5384825,
  phone = '+351 249 812 535',
  email = 'museu.municipal@cm-torresnovas.pt',
  website_url = 'https://museu.cm-torresnovas.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Museu_Municipal_Carlos_Reis_em_Torres_Novas.jpg?width=1600',
  image_credit = 'Paulo Juntas, CC BY-SA 3.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Coleções de arqueologia, arte sacra, pintura (Carlos Reis) e etnografia. Foto de fachada com portal barroco verificada visualmente.',
  updated_at = now()
where id = 'museu-carlos-reis';

-- smut-lapas
update public.venues set
  name = 'SMUT — Sociedade Musical União e Trabalho (Lapas)',
  parish = 'União das freguesias de Torres Novas (São Pedro), Lapas e Ribeira Branca',
  address = 'Rua Frei António Nogueira, 25, Lapas',
  postal_code = '2350-122',
  latitude = 39.4937201,
  longitude = -8.5532436,
  phone = '+351 960 043 471',
  email = 'smutlapas@sapo.pt',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: CORREÇÃO ao catálogo — SMUT = Sociedade Musical União e TRABALHO (não «União Torrejana»); fundada em 1920, banda filarmónica + escola de música + rancho; sede inclui a «Casa da Cultura Luís António Trincão» (2014). GPS aproximado (arruamento). No Commons só há fotos das Grutas das Lapas.',
  updated_at = now()
where id = 'smut-lapas';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('SMUT — Lapas'), 'smut-lapas')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('SMUT — Sociedade Musical União e Trabalho (Lapas)'), 'smut-lapas')
  on conflict (alias) do nothing;

-- sf-euterpe-meiaviense
update public.venues set
  parish = 'Meia Via',
  address = 'Rua Professor Matos Branco, 52, Meia Via',
  postal_code = '2350-642',
  website_url = 'http://filarmonicameiaviense.blogspot.com',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Sociedade_Filarm%C3%B3nica_Euterpe_Meiaviense.JPG?width=1600',
  image_credit = 'Meiaviense, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Fundada em 1896 (uma das filarmónicas mais antigas do concelho); escola de música desde 1976. Telefone/email não confirmados em fonte fiável — pedir à associação. Rua não mapeada no OSM → sem GPS.',
  updated_at = now()
where id = 'sf-euterpe-meiaviense';

-- sf-lealdade-uniao-ribeirense
update public.venues set
  parish = 'União das freguesias de Torres Novas (São Pedro), Lapas e Ribeira Branca',
  address = 'Largo do Anjo da Guarda, Ribeira Ruiva',
  postal_code = '2350-397',
  latitude = 39.4946059,
  longitude = -8.5745535,
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Resposta à dúvida «Riachos?» — NÃO é de Riachos: a sede é em RIBEIRA RUIVA (localidade da antiga freguesia de Ribeira Branca). Fundada em 1900, reativou banda e escola de música em 2009. GPS aproximado (largo).',
  updated_at = now()
where id = 'sf-lealdade-uniao-ribeirense';

-- teatro-virginia
update public.venues set
  parish = 'União das freguesias de Torres Novas (Santa Maria, Salvador e Santiago)',
  address = 'Largo José Lopes dos Santos',
  postal_code = '2350-686',
  latitude = 39.4796207,
  longitude = -8.5356182,
  phone = '+351 249 839 300',
  email = 'producao.teatrovirginia@cm-torresnovas.pt',
  website_url = 'https://www.teatrovirginia.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Teatro_Virg%C3%ADnia.jpg?width=1600',
  image_credit = 'Fabiomgc, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Bilheteira 249 839 309; nome homenageia a atriz torrejana Virgínia (Cine-Teatro Virgínia antigo). Foto de fachada com letreiro verificada visualmente.',
  updated_at = now()
where id = 'teatro-virginia';

-- biblioteca-municipal-barquinha
update public.venues set
  parish = 'Vila Nova da Barquinha',
  address = 'Centro Cultural de Vila Nova da Barquinha, Largo 1.º de Dezembro',
  postal_code = '2260-403',
  latitude = 39.457788,
  longitude = -8.432549,
  phone = '+351 249 720 358',
  email = 'biblioteca.barquinha@cm-vnbarquinha.pt',
  website_url = 'http://rbe.cm-vnbarquinha.pt',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Funciona dentro do Centro Cultural (mesmo edifício do Posto de Turismo e do CITA); dias úteis 9h–12h30/14h–17h30. Email de diretório — confirmar com o município.',
  updated_at = now()
where id = 'biblioteca-municipal-barquinha';

-- castelo-de-almourol
update public.venues set
  name = 'Castelo de Almourol / CITA — Centro de Interpretação Templário de Almourol',
  parish = 'Praia do Ribatejo',
  address = 'Ilha de Almourol, Rio Tejo (embarque no Cais de Almourol ou Cais d''El Rei, Tancos)',
  latitude = 39.461979,
  longitude = -8.383972,
  phone = '+351 249 720 358',
  email = 'cita@cm-vnbarquinha.pt',
  website_url = 'https://visitbarquinha.pt/o-que-fazer/castelo-de-almourol/',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Praia_do_Ribatejo_-_Castelo_de_Almourol_-_20200308170250.jpg?width=1600',
  image_credit = 'FenandoLBMaria, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Monumento Nacional em ilhota no Tejo; visita por barco (Cais de Almourol, sem reserva; grupos >20 no Cais d''El Rei em Tancos, c/ marcação: JF Tancos 249 712 094). O CITA (inaugurado em 2018) fica no Centro Cultural da vila, não na ilha. Foto verificada (castelo na ilha).',
  updated_at = now()
where id = 'castelo-de-almourol';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Castelo de Almourol / CITA'), 'castelo-de-almourol')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Castelo de Almourol / CITA — Centro de Interpretação Templário de Almourol'), 'castelo-de-almourol')
  on conflict (alias) do nothing;

-- centro-cultural-barquinha
update public.venues set
  parish = 'Vila Nova da Barquinha',
  address = 'Largo 1.º de Dezembro',
  postal_code = '2260-403',
  latitude = 39.457788,
  longitude = -8.432549,
  phone = '+351 249 720 353',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Alberga a Biblioteca Municipal, o Posto de Turismo (turismo@cm-vnbarquinha.pt) e o CITA; programação de música, exposições e Barquinha Jazz. Email próprio não confirmado — usar contactos do posto de turismo/CITA.',
  updated_at = now()
where id = 'centro-cultural-barquinha';

-- coreto-jardim-ribeirinho
update public.venues set
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: NÃO CONFIRMADO — nenhuma fonte oficial ou cartográfica localiza um «Coreto do Jardim Ribeirinho» em VN Barquinha (não mapeado no OSM; sem referências na agenda municipal; sem fotos livres). O parque ribeirinho municipal é o «Barquinha Parque» (junto ao Tejo) e Tancos tem um «Jardim Ribeirinho» próprio — confirmar com o município (249 720 350) qual o coreto pretendido antes de publicar.',
  updated_at = now()
where id = 'coreto-jardim-ribeirinho';

-- parque-escultura-almourol
update public.venues set
  name = 'Parque de Escultura Contemporânea Almourol (Barquinha Parque)',
  parish = 'Vila Nova da Barquinha',
  address = 'Barquinha Parque — Parque Ribeirinho de Vila Nova da Barquinha, Largo 1.º de Dezembro',
  latitude = 39.456842,
  longitude = -8.430856,
  phone = '+351 249 720 353',
  email = 'turismo@cm-vnbarquinha.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Joana_Vasconcelos_Trianons_2012_2855.JPG?width=1600',
  image_credit = 'Manuelvbotelho, CC BY-SA 3.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Único parque de escultura contemporânea ao ar livre do país à data da inauguração (2012), no Barquinha Parque (Prémio Nacional de Arquitetura Paisagista 2007). Website histórico www.barquinhaearte.pt (não verificado se ativo). Foto = escultura «Trianons» de Joana Vasconcelos no parque (não há «fachada»; obra em espaço público, coberta pela liberdade de panorama).',
  updated_at = now()
where id = 'parque-escultura-almourol';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Parque de Escultura Contemporânea de Almourol'), 'parque-escultura-almourol')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Parque de Escultura Contemporânea Almourol (Barquinha Parque)'), 'parque-escultura-almourol')
  on conflict (alias) do nothing;

-- ---------------------------------------------------------------------------
-- Entradas novas e amarrações que o levantamento obriga a fazer.
-- ---------------------------------------------------------------------------

-- O Complexo Cultural da Levada de Tomar não estava no catálogo — e a fila de
-- espaços por resolver estava cheia dos seus nomes (5 ocorrências cada). É
-- onde a agenda de Tomar põe boa parte da programação.
insert into public.venues
  (id, name, short_name, municipality_id, parish, kind, status, address, postal_code,
   latitude, longitude, phone, email, website_url, image_url, image_credit, notes)
values
  ('complexo-cultural-levada-tomar',
   'CCLT — Complexo Cultural da Levada de Tomar',
   'Complexo Cultural da Levada',
   'tomar',
   'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
   'cultural_centre', 'active',
   'Rua Carlos Everard', '2300-561',
   39.6037, -8.4118,
   '+351 249 329 814', 'museologia@cm-tomar.pt',
   'https://levada.cm-tomar.pt',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Central_da_Levada_em_Tomar_by_Juntas_1.jpg?width=1600',
   'Juntas, CC BY-SA 4.0, via Wikimedia Commons',
   'Levantamento 2026-08-28: conjunto patrimonial junto ao Nabão com seis espaços — Fábrica das '
   || 'Artes, Fundição Tomarense, Centro Interpretativo Tomar Templário, Central Elétrica, Moagem '
   || 'A Nabantina e Moagem A Portuguesa. GPS aproximado (arruamento).')
on conflict (id) do nothing;

insert into public.venue_aliases (alias, venue_id) values
  (public.normalize_for_hash('Complexo Cultural da Levada de Tomar'), 'complexo-cultural-levada-tomar'),
  (public.normalize_for_hash('Complexo Cultural da Levada'), 'complexo-cultural-levada-tomar'),
  (public.normalize_for_hash('NAC.2 - Complexo Cultural da Levada'), 'complexo-cultural-levada-tomar'),
  (public.normalize_for_hash('Complexo Cultural da Levada de Tomar - Sala Multiusos'), 'complexo-cultural-levada-tomar'),
  (public.normalize_for_hash('CCLT'), 'complexo-cultural-levada-tomar')
on conflict (alias) do nothing;

-- O mercado de Ferreira do Zêzere aparecia na fila por resolver (4 ocorrências)
-- com o nome próprio completo. Entra com o que a fonte lhe chama.
insert into public.venues (id, name, short_name, municipality_id, kind, status)
values
  ('mercado-municipal-ferreira-do-zezere',
   'Mercado Municipal António Teixeira Antunes',
   'Mercado Municipal',
   'ferreira-do-zezere', 'market', 'active')
on conflict (id) do nothing;

insert into public.venue_aliases (alias, venue_id) values
  (public.normalize_for_hash('Mercado Municipal António Teixeira Antunes'), 'mercado-municipal-ferreira-do-zezere'),
  (public.normalize_for_hash('Mercado Municipal de Ferreira do Zêzere'), 'mercado-municipal-ferreira-do-zezere')
on conflict (alias) do nothing;

-- Todo o espaço passa a resolver pelo próprio nome (e pelo nome curto) —
-- mas SÓ quando o nome é inequívoco no catálogo inteiro. A fila tinha
-- «Biblioteca Municipal de Ourém» por resolver com o catálogo a ter um
-- espaço exatamente com esse nome: a resolução é só por alias, e o alias
-- canónico nunca tinha sido semeado. A restrição do inequívoco é porque a
-- resolução não conhece o concelho: «Casa da Cultura» existe em Alcanena e
-- em Ferreira do Zêzere, e semeá-la mandava os eventos de uma para a outra.
-- (Dar concelho aos aliases é trabalho para outra migração — fica anotado.)
insert into public.venue_aliases (alias, venue_id)
select alias, max(venue_id)
  from (
    select public.normalize_for_hash(name) as alias, id as venue_id
      from public.venues
     where name is not null
  ) candidatos
 group by alias
having count(*) = 1
on conflict (alias) do nothing;

insert into public.venue_aliases (alias, venue_id)
select alias, max(venue_id)
  from (
    select public.normalize_for_hash(short_name) as alias, id as venue_id
      from public.venues
     where short_name is not null and length(short_name) >= 6
  ) candidatos
 group by alias
having count(*) = 1
on conflict (alias) do nothing;

-- Três espaços «provisórios» que o levantamento confirmou com morada e fontes.
update public.venues set status = 'active', updated_at = now()
 where id in ('biblioteca-municipal-alcanena', 'caorg-minde', 'smut-lapas')
   and status = 'provisional';

do $$
declare
  v_com_morada integer;
  v_com_gps integer;
  v_com_foto integer;
  v_aliases integer;
begin
  select count(address), count(latitude), count(image_url) into v_com_morada, v_com_gps, v_com_foto
    from public.venues;
  select count(*) into v_aliases from public.venue_aliases;

  if v_com_morada < 50 then
    raise exception 'esperavam-se pelo menos 50 espaços com morada, e há %', v_com_morada;
  end if;
  if v_com_gps < 45 then
    raise exception 'esperavam-se pelo menos 45 espaços com coordenadas, e há %', v_com_gps;
  end if;
  if v_com_foto < 30 then
    raise exception 'esperavam-se pelo menos 30 espaços com fotografia, e há %', v_com_foto;
  end if;
  if v_aliases < 100 then
    raise exception 'esperavam-se pelo menos 100 aliases de espaço, e há %', v_aliases;
  end if;
end
$$;
