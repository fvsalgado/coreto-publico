-- 0036 — Ferreira do Zêzere, Mação, Ourém e Sardoal: os espaços que faltavam.
--
-- A 0035 deu morada, coordenadas, contactos e fachada aos espaços de sete
-- concelhos. Este é o levantamento dos quatro que ficaram — feito à mesma
-- regra: só entra o que foi confirmado em fonte (câmaras, RNBP, RTCP, DGPC,
-- OSM/Nominatim, Wikimedia Commons), campo vazio fica vazio, e o que ficou
-- por confirmar fica escrito em `notes`, não inventado numa coluna.
--
-- Dois achados que valem mais do que os números:
--
--   * A Biblioteca Municipal de Ferreira do Zêzere tem patrono — é a
--     **Biblioteca Municipal Dr. António Baião**. As de Mação, Ourém e
--     Sardoal não têm patrono no nome oficial, e por isso ficam como estão:
--     acrescentar-lhes um seria fabricar.
--   * «Casa da Cultura» de Ferreira do Zêzere: não se encontrou equipamento
--     com este nome em nenhuma fonte oficial — os espaços documentados são o
--     Cine-Teatro Ivone Silva e o Centro Cultural Alfredo Keil. Fica
--     assinalado para verificação editorial em vez de apagado: o nome veio
--     de algum lado, e apagar sem confirmar é o erro simétrico de inventar.
--
-- As fotografias são da Wikimedia Commons, com autor e licença no crédito,
-- serve-se o ficheiro por Special:FilePath como nas 0034/0035.

-- biblioteca-municipal-ferreira-do-zezere
update public.venues set
  name = 'Biblioteca Municipal Dr. António Baião',
  parish = 'Ferreira do Zêzere',
  address = 'Rua João da Costa, n.º 16',
  postal_code = '2240-356 Ferreira do Zêzere',
  latitude = 39.6946031,
  longitude = -8.2898035,
  phone = '249 360 152',
  website_url = 'https://cm-ferreiradozezere.pt/viver/biblioteca/horarios-e-contactos',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Patrono confirmado (Dr. António Baião) no site da CM e no OSM; coordenadas do nó OSM da biblioteca (o OSM situa a entrada pela Rua da Fonte de Ferreira, esquina com a morada oficial).',
  updated_at = now()
where id = 'biblioteca-municipal-ferreira-do-zezere';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Biblioteca Municipal de Ferreira do Zêzere'), 'biblioteca-municipal-ferreira-do-zezere')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Biblioteca Municipal Dr. António Baião'), 'biblioteca-municipal-ferreira-do-zezere')
  on conflict (alias) do nothing;

-- casa-da-cultura-ferreira-do-zezere
update public.venues set
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Não foi possível confirmar equipamento com este nome em fontes oficiais; os espaços municipais documentados são o Cine-Teatro Ivone Silva e o Centro Cultural Alfredo Keil (contacto municipal 249 360 150) — verificar se o registo se refere a um deles.',
  updated_at = now()
where id = 'casa-da-cultura-ferreira-do-zezere';

-- dornes
update public.venues set
  parish = 'Nossa Senhora do Pranto',
  latitude = 39.770769,
  longitude = -8.2692354,
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Dornes_e_Vale_do_Rio_Z%C3%AAzere_-_Portugal_%F0%9F%87%B5%F0%9F%87%B9_(54248822811).jpg?width=1600',
  image_credit = 'Vitor Oliveira (Torres Vedras, Portugal), CC BY-SA 2.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Aldeia histórica em península do rio Zêzere, com torre pentagonal de origem templária; freguesia e coordenadas confirmadas via OSM/Nominatim.',
  updated_at = now()
where id = 'dornes';

-- lago-azul
update public.venues set
  latitude = 39.674932,
  longitude = -8.2306067,
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Praia_fluvial_da_Castanheira_-_Ferreira_do_Z%C3%AAzere.JPG?width=1600',
  image_credit = 'Paulo Juntas, CC BY-SA 3.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Plano de água da albufeira de Castelo do Bode junto à localidade de Castanheira; coordenadas da Praia Fluvial da Castanheira (OSM); freguesia não confirmada nas fontes consultadas.',
  updated_at = now()
where id = 'lago-azul';

-- biblioteca-municipal-macao
update public.venues set
  parish = 'Mação, Penhascoso e Aboboreira',
  address = 'Rua Sacadura Cabral (Centro Cultural Elvino Pereira)',
  latitude = 39.55315,
  longitude = -7.99535,
  phone = '241 577 200 (ext. 249)',
  website_url = 'https://www.cm-macao.pt',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Sem patrono no nome oficial; integrada no Centro Cultural Elvino Pereira (com ludoteca); RNBP e Rede de Bibliotecas do Médio Tejo; CP divergente nas fontes (6120-722 directório RNBP vs 6120-753 OSM) — ficou por confirmar.',
  updated_at = now()
where id = 'biblioteca-municipal-macao';

-- museu-arte-pre-historica-macao
update public.venues set
  parish = 'Mação, Penhascoso e Aboboreira',
  address = 'Largo Infante D. Henrique',
  postal_code = '6120-750 Mação',
  latitude = 39.5570087,
  longitude = -7.9936512,
  phone = '241 571 477',
  email = 'museu@cm-macao.pt',
  website_url = 'https://www.cm-macao.pt/index.php/servicos/servicos-municipais/museu',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Museu_Arte_-_Ma%C3%A7%C3%A3o.jpg?width=1600',
  image_credit = 'Hipersyl, CC BY 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: A DGPC/Rede Portuguesa de Museus grafa «... e do Sagrado no Vale do Tejo»; coordenadas do nó OSM do museu (OSM grafa o arruamento como Alameda Infante Dom Henrique).',
  updated_at = now()
where id = 'museu-arte-pre-historica-macao';

-- biblioteca-municipal-ourem
update public.venues set
  parish = 'Nossa Senhora da Piedade',
  address = 'Largo Prof. Egas Moniz, n.º 12',
  postal_code = '2490-496 Ourém',
  latitude = 39.6560039,
  longitude = -8.5768756,
  phone = '249 540 900 (ext. 6841/6842)',
  email = 'biblioteca@mail.cm-ourem.pt',
  website_url = 'https://biblioteca.ourem.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Entrada_da_Biblioteca_Municipal_de_Our%C3%A9m_em_2023.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Sem patrono identificado nas fontes consultadas; morada/contactos confirmados pela página oficial da própria biblioteca (Facebook) e directórios.',
  updated_at = now()
where id = 'biblioteca-municipal-ourem';

-- casa-do-povo-de-fatima
update public.venues set
  parish = 'Fátima',
  address = 'Rua da Escola, n.º 9, Aljustrel',
  postal_code = '2495-555 Fátima',
  latitude = 39.620712,
  longitude = -8.6567866,
  phone = '249 531 396',
  email = 'casapovofatima@sapo.pt',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Fundada em 1969, c. 500 sócios (CPCCRD/O Mirante); sede em Aljustrel, a aldeia dos Pastorinhos (localização confirmada no OSM).',
  updated_at = now()
where id = 'casa-do-povo-de-fatima';

-- castelo-vila-medieval-ourem
update public.venues set
  name = 'Castelo de Ourém / Paço dos Condes de Ourém',
  parish = 'Nossa Senhora das Misericórdias',
  latitude = 39.6406868,
  longitude = -8.5916346,
  phone = '964 169 726',
  email = 'museu@mail.cm-ourem.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/The_castle_of_Our%C3%A9m_(41792172482).jpg?width=1600',
  image_credit = 'Pedro (Maia, Portugal), CC BY 2.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Conjunto na Antiga Vila de Ourém; visitas (livres e guiadas) geridas pelo Museu Municipal — contactos indicados pelo Turismo do Centro.',
  updated_at = now()
where id = 'castelo-vila-medieval-ourem';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Castelo e Vila Medieval de Ourém'), 'castelo-vila-medieval-ourem')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Castelo de Ourém / Paço dos Condes de Ourém'), 'castelo-vila-medieval-ourem')
  on conflict (alias) do nothing;

-- centro-municipal-exposicoes-ourem
update public.venues set
  name = 'Centro Municipal de Exposições de Ourém',
  parish = 'Nossa Senhora da Piedade',
  address = 'Rua Melvin Jones',
  postal_code = '2490-545 Ourém',
  latitude = 39.6539763,
  longitude = -8.5750376,
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Antigo Centro de Negócios de Ourém; acolhe FeirOurém, Feira de Santa Iria e serviços municipais.',
  updated_at = now()
where id = 'centro-municipal-exposicoes-ourem';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Centro Municipal de Exposições'), 'centro-municipal-exposicoes-ourem')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Centro Municipal de Exposições de Ourém'), 'centro-municipal-exposicoes-ourem')
  on conflict (alias) do nothing;

-- centro-pastoral-paulo-vi
update public.venues set
  parish = 'Fátima',
  address = 'Avenida D. José Alves Correia da Silva',
  latitude = 39.6279153,
  longitude = -8.67781,
  phone = '249 539 600',
  website_url = 'https://www.fatima.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Centro_Pastoral_Paulo_VI_-_F%C3%A1tima_-_Portugal_(17979655573).jpg?width=1600',
  image_credit = 'Vitor Oliveira (Torres Vedras, Portugal), CC BY-SA 2.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Equipamento do Santuário de Fátima, inaugurado em 1982 (renovado em 2012); telefone geral do Santuário; CP divergente nas fontes (2495-401/2495-402) — ficou por confirmar.',
  updated_at = now()
where id = 'centro-pastoral-paulo-vi';

-- museu-municipal-ourem
update public.venues set
  name = 'Museu Municipal de Ourém – Casa do Administrador',
  parish = 'Nossa Senhora da Piedade',
  address = 'Largo Dr. Vitorino de Carvalho, n.º 14',
  postal_code = '2490-497 Ourém',
  latitude = 39.6564495,
  longitude = -8.5762875,
  phone = '249 540 900 / 919 585 003',
  email = 'museu@mail.cm-ourem.pt',
  website_url = 'https://museu.cm-ourem.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Frente_da_Casa_do_Administrador_de_Our%C3%A9m.jpg?width=1600',
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Núcleo principal na Casa do Administrador, onde os três Pastorinhos foram interrogados em agosto de 1917.',
  updated_at = now()
where id = 'museu-municipal-ourem';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Museu Municipal de Ourém'), 'museu-municipal-ourem')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Museu Municipal de Ourém – Casa do Administrador'), 'museu-municipal-ourem')
  on conflict (alias) do nothing;

-- ourearte
update public.venues set
  name = 'Ourearte – Escola de Música e Artes de Ourém',
  parish = 'Nossa Senhora da Piedade',
  address = 'Praça Mouzinho de Albuquerque, n.º 11',
  postal_code = '2490-045 Ourém',
  latitude = 39.6564074,
  longitude = -8.576977,
  phone = '249 541 539',
  email = 'ourearte@sapo.pt',
  website_url = 'https://ourearte.pt',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: CP segundo o site oficial da escola (ourearte.pt); outras fontes indicam 2490-501; email alternativo ourearte@escolas.min-edu.pt.',
  updated_at = now()
where id = 'ourearte';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Ourearte'), 'ourearte')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Ourearte – Escola de Música e Artes de Ourém'), 'ourearte')
  on conflict (alias) do nothing;

-- santuario-de-fatima
update public.venues set
  name = 'Santuário de Nossa Senhora do Rosário de Fátima',
  parish = 'Fátima',
  address = 'Rua de Santa Isabel, 360 (Cova da Iria)',
  postal_code = '2495-424 Fátima',
  latitude = 39.6300079,
  longitude = -8.6746971,
  phone = '+351 249 539 600',
  email = 'info@fatima.pt',
  website_url = 'https://www.fatima.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Bas%C3%ADlica_de_Nossa_Senhora_do_Ros%C3%A1rio_de_F%C3%A1tima_-_05.jpg?width=1600',
  image_credit = 'Reis Quarteu, CC BY-SA 4.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Contactos oficiais confirmados no documento de contactos do próprio Santuário (fatima.pt).',
  updated_at = now()
where id = 'santuario-de-fatima';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Santuário de Fátima'), 'santuario-de-fatima')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Santuário de Nossa Senhora do Rosário de Fátima'), 'santuario-de-fatima')
  on conflict (alias) do nothing;

-- teatro-municipal-ourem
update public.venues set
  name = 'Teatro Municipal de Ourém (TMO)',
  parish = 'Nossa Senhora da Piedade',
  address = 'Rua Dr. Francisco Sá Carneiro, n.º 121',
  postal_code = '2490-548 Ourém',
  latitude = 39.6543447,
  longitude = -8.5770082,
  phone = '916 591 231',
  email = 'geral.tmo@cm-ourem.pt',
  website_url = 'https://teatromunicipal.ourem.pt',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Integra a Rede de Teatros e Cineteatros Portugueses (RTCP); morada/CP segundo a ficha RTCP; coordenadas do nó OSM do teatro.',
  updated_at = now()
where id = 'teatro-municipal-ourem';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Teatro Municipal de Ourém'), 'teatro-municipal-ourem')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Teatro Municipal de Ourém (TMO)'), 'teatro-municipal-ourem')
  on conflict (alias) do nothing;

-- biblioteca-municipal-sardoal
update public.venues set
  name = 'Biblioteca Municipal de Sardoal',
  parish = 'Sardoal',
  address = 'Avenida Tapada da Torre, n.º 2A',
  postal_code = '2230-161 Sardoal',
  latitude = 39.5408693,
  longitude = -8.1607876,
  phone = '241 851 169',
  email = 'biblioteca@cm-sardoal.pt',
  website_url = 'https://www.cm-sardoal.pt/viver/cultura/biblioteca',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Sem patrono no nome oficial; nasceu do espólio da Biblioteca Fixa n.º 176 da Fundação Calouste Gulbenkian (doado em 2002); reabriu a 21/03/2025 no requalificado antigo Externato Rainha Santa Isabel; coordenadas ao nível do arruamento (OSM).',
  updated_at = now()
where id = 'biblioteca-municipal-sardoal';
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Biblioteca Municipal do Sardoal'), 'biblioteca-municipal-sardoal')
  on conflict (alias) do nothing;
insert into public.venue_aliases (alias, venue_id)
  values (public.normalize_for_hash('Biblioteca Municipal de Sardoal'), 'biblioteca-municipal-sardoal')
  on conflict (alias) do nothing;

-- centro-cultural-gil-vicente
update public.venues set
  parish = 'Sardoal',
  address = 'Avenida Dom João III',
  postal_code = '2230-135 Sardoal',
  latitude = 39.5384601,
  longitude = -8.1612326,
  phone = '241 855 194',
  email = 'ccgilvicente@cm-sardoal.pt',
  website_url = 'https://ccgv.sardoal.pt',
  image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Centro_Cultural_Gil_Vicente_-_Sardoal_-_Portugal_(3576300169).jpg?width=1600',
  image_credit = 'Vitor Oliveira (Torres Vedras, Portugal), CC BY-SA 2.0, via Wikimedia Commons',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: Inaugurado a 17/09/2004 (nome evoca a ligação de Gil Vicente ao Sardoal); auditório de 200 lugares; integra a RTCP desde 2021.',
  updated_at = now()
where id = 'centro-cultural-gil-vicente';


-- ---------------------------------------------------------------------------
-- Depois dos quatro concelhos, o catálogo tem de estar mais completo do que
-- estava. Os mínimos são os da 0035 mais o que este levantamento confirmou.
do $$
declare
  v_com_morada integer;
  v_com_gps integer;
  v_com_foto integer;
begin
  select count(address), count(latitude), count(image_url)
    into v_com_morada, v_com_gps, v_com_foto
    from public.venues;
  if v_com_morada < 55 then
    raise exception 'esperavam-se pelo menos 55 espaços com morada, e há %', v_com_morada;
  end if;
  if v_com_gps < 55 then
    raise exception 'esperavam-se pelo menos 55 espaços com coordenadas, e há %', v_com_gps;
  end if;
  if v_com_foto < 38 then
    raise exception 'esperavam-se pelo menos 38 espaços com fotografia, e há %', v_com_foto;
  end if;
end
$$;
