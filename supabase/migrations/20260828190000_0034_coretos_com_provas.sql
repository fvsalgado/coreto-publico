-- 0034 — O levantamento dos coretos, agora com provas.
--
-- O editor avisou: «temos identificados coretos que não existem». Tinha
-- razão, e a verificação — OSM (Overpass), Wikimedia Commons, Wikidata/SIPA,
-- imprensa regional e a pesquisa interna dos próprios sites municipais —
-- disse exatamente quais. O detalhe, fonte a fonte, está em
-- `docs/CORETOS.md`.
--
-- O que esta migração faz:
--
--   1. **Três «confirmados» caem para «por confirmar»**: Carril, Espite e
--      Jardim Municipal de Torres Novas. Nenhuma fonte os documenta — nem o
--      OSM, nem o Commons, nem os sites das juntas, nem a imprensa. O do
--      Carril tem explicação provável: o lugar é um dos berços d'«A
--      Portuguesa» (a Filarmónica Carrilense fez a primeira orquestração em
--      1890) — fama musical não é coreto.
--   2. **Constância e Sardoal**, que já estavam por confirmar, ficam com a
--      prova negativa escrita: até a pesquisa interna dos sites municipais
--      devolve zero.
--   3. **Os oito reais ganham corpo**: coordenadas, ano, freguesia e — onde o
--      Commons tem fotografia livre — a fotografia com o crédito devido.
--   4. **Onze coretos novos entram**: três com prova forte (Alvega 1981, Rio
--      de Moinhos com a rara planta quadrada, N.ª Sr.ª do Tojo 1956), um
--      documental (Souto — Praça Luís de Camões) e sete mapeados no OSM à
--      espera de confirmação no terreno. Um levantamento que assume as
--      lacunas é o que convida quem sabe a corrigi-lo.
--
-- Ficam ainda para a memória do projeto, sem linha na tabela porque já não
-- existem: o coreto da Praça da República de Abrantes (1910, demolido em
-- 1939) e o do Tramagal (1922, desmantelado; as peças estavam guardadas em
-- 2008).
--
-- O «Verão no Coreto» de Tomar é no coreto do Jardim da Várzea Pequena
-- (Largo Cândido dos Reis) — o Mouchão não tem coreto documentado.

-- 1 + 2 — os cinco sem prova, com a prova da ausência escrita.
update public.coretos set
  is_confirmed = false,
  notes = 'Sem qualquer prova encontrada (OSM, Wikimedia Commons, imprensa, sites municipais). '
       || 'Explicação provável da confusão: o Carril é um dos berços d''«A Portuguesa» — a 1.ª '
       || 'orquestração fez-se em 1890 com a Filarmónica Carrilense. Fama musical não é coreto. '
       || 'A confirmar no terreno antes de voltar a «confirmado».',
  updated_at = now()
where id = 'coreto-carril';

update public.coretos set
  is_confirmed = false,
  notes = 'Sem prova encontrada: nada no OSM, no Commons nem no site da Junta de Espite. '
       || 'O único indício é um post de grupo de Facebook sobre «um dos coretos da coleção» — '
       || 'possivelmente miniaturas. A confirmar junto da Junta.',
  updated_at = now()
where id = 'coreto-espite';

update public.coretos set
  is_confirmed = false,
  notes = 'O Jardim Municipal existe; um coreto nele não aparece em nenhuma fonte — nem no OSM, '
       || 'nem no Commons, nem na ficha detalhada do próprio jardim. Se houver memória local de '
       || 'um coreto antigo, precisa de fonte própria.',
  updated_at = now()
where id = 'coreto-jardim-municipal-torres-novas';

update public.coretos set
  notes = 'Procurado em OSM, Commons, imprensa e na pesquisa interna do site municipal e do de '
       || 'turismo: zero resultados em todo o concelho. Provavelmente não existe.',
  updated_at = now()
where id = 'coreto-constancia';

update public.coretos set
  notes = 'Procurado em OSM, Commons, imprensa e na pesquisa interna do site municipal e do de '
       || 'turismo: zero resultados no concelho (vila, Alcaravela, Santiago de Montalegre e '
       || 'Valhascos). Provavelmente não existe.',
  updated_at = now()
where id = 'coreto-sardoal';

-- 3 — os oito reais, com o que a verificação apurou.
update public.coretos set
  parish = 'União das freguesias de Abrantes e Alferrarede',
  latitude = 39.46295, longitude = -8.19440, year_built = 1894,
  photo_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Abrantes_-_Portugal_(7226943630).jpg?width=1600',
  photo_credit = 'Vitor Oliveira, CC BY-SA 2.0, via Wikimedia Commons',
  notes = 'O primeiro coreto de Abrantes (1894), de ferro sobre base de pedra, no jardim '
       || 'romântico que ocupa o antigo fosso do castelo. Acolhia os concertos dominicais.',
  updated_at = now()
where id = 'coreto-jardim-do-castelo';

update public.coretos set
  latitude = 39.44809, longitude = -8.19223, year_built = 1915,
  notes = 'Inaugurado a 20 de setembro de 1915 no Largo D. Joana Godinho Soares Mendes. O '
       || 'levantamento local de 2008 dá-o como «o mais bonito» dos coretos do concelho. '
       || 'Sem fotografia livre no Commons — boa candidata a sessão fotográfica.',
  updated_at = now()
where id = 'coreto-rossio-ao-sul-do-tejo';

update public.coretos set
  latitude = 39.51322, longitude = -8.68773,
  photo_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Coreto_de_Minde_em_2024.jpg?width=1600',
  photo_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = 'Inventário SIPA n.º 31124: base octogonal com painéis de azulejos que retratam os '
       || 'ofícios têxteis de Minde, colunas de ferro fundido e cobertura de oito águas com '
       || 'lambrequim. No Largo Justino Guedes, frente ao MARG.',
  updated_at = now()
where id = 'coreto-minde';

update public.coretos set
  parish = 'São João Baptista',
  latitude = 39.46636, longitude = -8.46540, year_built = 1934,
  notes = 'No Jardim-Parque Dr. José Pereira Caldas (1934). Por baixo do coreto fica a estufa '
       || 'com a aranha de ferro no teto que dá a alcunha ao jardim — e uma fonte de água. A '
       || 'requalificação de 2012/13 manteve o coreto e a torre.',
  updated_at = now()
where id = 'coreto-jardim-da-aranha';

update public.coretos set
  latitude = 39.5441, longitude = -8.0399,
  notes = 'No centro da aldeia, na zona do jardim do Fundão; integra o percurso pedestre PR9 '
       || '«Rota do Penhascoso». Coordenada aproximada (centro da aldeia) — afinar no terreno.',
  updated_at = now()
where id = 'coreto-penhascoso';

update public.coretos set
  parish = 'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
  latitude = 39.60611, longitude = -8.41439, year_built = 1897,
  photo_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_aproximada_para_Coreto_de_Tomar_a_partir_de_norte.jpg?width=1600',
  photo_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  notes = 'Inaugurado em 1897 e restaurado em 1997; das melhores obras da arquitetura do ferro '
       || 'de Tomar, com dupla cobertura e lanternim. É AQUI, no Jardim da Várzea Pequena '
       || '(Largo Cândido dos Reis), que a câmara programa o «Verão no Coreto».',
  updated_at = now()
where id = 'coreto-varzea-pequena';

update public.coretos set
  latitude = 39.4844, longitude = -8.6110,
  notes = 'Na Praça Engenheiro Luís Tavares Simão; palco das filarmónicas nos dias de festa. '
       || 'Coordenada aproximada (centro da freguesia) — afinar no terreno.',
  updated_at = now()
where id = 'coreto-zibreira';

update public.coretos set
  latitude = 39.45753, longitude = -8.43278,
  notes = 'No Barquinha Parque, junto ao Largo 1.º de Dezembro e ao Centro Cultural. Estrutura '
       || 'recente do parque ribeirinho inaugurado em 2005 — não um coreto oitocentista, e nem '
       || 'por isso menos palco.',
  updated_at = now()
where id = 'coreto-jardim-ribeirinho';

-- 4 — os onze que o levantamento encontrou.
insert into public.coretos (id, name, parish, municipality_id, latitude, longitude, year_built, is_confirmed, photo_url, photo_credit, notes) values
  ('coreto-alvega', 'Coreto de Alvega', 'União das freguesias de Alvega e Concavada', 'abrantes',
   39.46490, -8.04539, 1981, true,
   'https://commons.wikimedia.org/wiki/Special:FilePath/Coreto_no_adro_da_Igreja_Paroquial_de_Alvega,_Alvega,_Munic%C3%ADpio_de_Abrantes_03.jpg?width=1600',
   'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
   'No adro da Igreja de São Pedro, na Praça da República de Alvega. Construído em 1981.'),
  ('coreto-rio-de-moinhos', 'Coreto de Rio de Moinhos', 'Rio de Moinhos', 'abrantes',
   39.4756, -8.2434, null, true,
   'https://commons.wikimedia.org/wiki/Special:FilePath/Coreto_Rio_de_Moinhos_(Abrantes)_07.jpg?width=1600',
   'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
   'Raridade tipológica: planta QUADRADA, única no concelho. Dos primeiros anos do século XX, '
   || 'junto à Igreja Matriz. Coordenada aproximada — afinar no terreno.'),
  ('coreto-nossa-senhora-do-tojo', 'Coreto de Nossa Senhora do Tojo', 'União das freguesias de Aldeia do Mato e Souto', 'abrantes',
   39.56939, -8.22547, 1956, true, null, null,
   'No recinto do Santuário de Nossa Senhora do Tojo, na Quintã (Souto). Construído em 1956; '
   || 'mapeado no OSM exatamente na morada do santuário.'),
  ('coreto-souto-praca-luis-de-camoes', 'Coreto do Souto', 'União das freguesias de Aldeia do Mato e Souto', 'abrantes',
   39.57600, -8.23482, null, false, null, null,
   'O segundo coreto do Souto, na Praça Luís de Camões — dado como existente pelo levantamento '
   || 'local de 2008. Fonte única: revalidar no terreno.'),
  ('coreto-casais-de-revelhos', 'Coreto de Casais de Revelhos', 'União das freguesias de Abrantes e Alferrarede', 'abrantes',
   39.50327, -8.18036, null, false, null, null,
   'Mapeado no OpenStreetMap (Rua da Escola); por confirmar no terreno.'),
  ('coreto-serra-castelo-novo', 'Coreto de Castelo Novo (Serra)', 'União das freguesias de Serra e Junceira', 'tomar',
   39.59212, -8.31614, null, false, null, null,
   'Mapeado no OpenStreetMap com o nome «Coreto», no lugar de Castelo Novo; por confirmar no terreno.'),
  ('coreto-serra-bugarrel', 'Coreto do Bugarrel (Serra)', 'União das freguesias de Serra e Junceira', 'tomar',
   39.59986, -8.30132, null, false, null, null,
   'Mapeado no OpenStreetMap junto à EM 530; por confirmar no terreno.'),
  ('coreto-brasoes', 'Coreto de Brasões', 'Carregueiros', 'tomar',
   39.61381, -8.45281, null, false, null, null,
   'Mapeado no OpenStreetMap na Rua da Capela, junto à capela do lugar; por confirmar no terreno.'),
  ('coreto-ortiga-fatima', 'Coreto de Nossa Senhora da Ortiga', 'Fátima', 'ourem',
   39.60542, -8.62591, null, false, null, null,
   'Mapeado no OpenStreetMap no recinto do Santuário de N.ª Sr.ª da Ortiga, onde decorre a '
   || 'festa anual no 1.º domingo de julho. Não confundir com a Ortiga de Mação. Por confirmar.'),
  ('coreto-freixianda-varzea-do-bispo', 'Coreto da Várzea do Bispo', 'União das freguesias de Freixianda, Ribeira do Fárrio e Formigais', 'ourem',
   39.76256, -8.45996, null, false, null, null,
   'Mapeado no OpenStreetMap junto à ER 356, na Freixianda; por confirmar no terreno.'),
  ('coreto-chancelaria-macaroca', 'Coreto da Maçaroca (Chancelaria)', 'Chancelaria', 'torres-novas',
   39.55314, -8.55348, null, false, null, null,
   'Mapeado no OpenStreetMap junto à EM 557 — o único coreto do concelho de Torres Novas no '
   || 'OSM. Por confirmar no terreno.')
on conflict (id) do nothing;

do $$
declare
  v_total integer;
  v_confirmados integer;
  v_com_gps integer;
begin
  select count(*), count(*) filter (where is_confirmed), count(latitude)
    into v_total, v_confirmados, v_com_gps
    from public.coretos;

  if v_total < 24 then
    raise exception 'esperavam-se pelo menos 24 coretos levantados, e há %', v_total;
  end if;
  if v_confirmados <> 11 then
    raise exception 'esperavam-se 11 coretos confirmados (8 antigos + 3 novos), e há %', v_confirmados;
  end if;
  if v_com_gps < 19 then
    raise exception 'esperavam-se pelo menos 19 coretos com coordenadas, e há %', v_com_gps;
  end if;
  if exists (select 1 from public.coretos where is_confirmed and id in
    ('coreto-carril','coreto-espite','coreto-jardim-municipal-torres-novas')) then
    raise exception 'um coreto sem prova voltou a ficar confirmado';
  end if;
end
$$;
