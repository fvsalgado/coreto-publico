-- 0039 — Os espaços apresentam-se: a descrição pública, escrita dos factos.
--
-- A 0032 criou `venues.description` — o texto que o sítio mostra — e deixou-o
-- vazio à espera de conteúdo editorial. Este é esse conteúdo, para os espaços
-- com eventos no catálogo e para os emblemáticos de cada concelho: duas ou
-- três frases por espaço, escritas **só** a partir do que os levantamentos de
-- 2026-08-28 confirmaram em fonte (e que ficou registado em `notes`). Nada de
-- brochura: o que não se confirmou não se escreve.

update public.venues set description =
  'A sala de espetáculos municipal de Tomar, na rua da Infantaria 15, reinaugurada em 2002. '
  || 'É das casas com programação mais regular do Médio Tejo — teatro, música, cinema e as rubricas da própria casa.',
  updated_at = now()
where id = 'cine-teatro-paraiso';

update public.venues set description =
  'Conjunto patrimonial junto ao rio Nabão, com origem nos moinhos e lagares d''El Rei (séculos XII–XIII), '
  || 'que reúne seis espaços: a Fábrica das Artes, a Fundição Tomarense, o Centro Interpretativo Tomar Templário, '
  || 'a Central Elétrica e as moagens A Nabantina e A Portuguesa.',
  updated_at = now()
where id = 'complexo-cultural-levada-tomar';

update public.venues set description =
  'A biblioteca municipal de Abrantes, com o nome do poeta António Botto, numa ala do antigo Convento de São Domingos — '
  || 'edifício que desde 2021 partilha com o MIAA. Além da leitura, recebe horas do conto, oficinas e ciclos para famílias.',
  updated_at = now()
where id = 'biblioteca-antonio-botto';

update public.venues set description =
  'Museu inaugurado em dezembro de 2021 no antigo Convento de São Domingos, Prémio APOM Museu do Ano 2023. '
  || 'Arqueologia e arte no coração do centro histórico de Abrantes.',
  updated_at = now()
where id = 'miaa';

update public.venues set description =
  'A musealização aberta em 2021 na Igreja de Santa Maria do Castelo, dentro do Castelo de Abrantes, '
  || 'em torno dos túmulos da família Almeida. Sucede ao antigo Museu D. Lopo de Almeida, criado em 1921.',
  updated_at = now()
where id = 'museu-dom-lopo-de-almeida';

update public.venues set description =
  'Sala de 1949 com traço do arquiteto Ruy Jervis d''Athouguia, comprada pelo município em 2020 '
  || 'e em requalificação profunda para voltar a abrir com um auditório de 386 lugares.',
  updated_at = now()
where id = 'cine-teatro-sao-pedro-abrantes';

update public.venues set description =
  'A biblioteca municipal de Ourém, no Largo Prof. Egas Moniz, no centro da cidade — '
  || 'leitura, estudo e uma programação regular de encontros e atividades para todas as idades.',
  updated_at = now()
where id = 'biblioteca-municipal-ourem';

update public.venues set description =
  'O conjunto monumental da Antiga Vila de Ourém: o castelo e o Paço dos Condes, com visitas livres e guiadas '
  || 'organizadas pelo Museu Municipal.',
  updated_at = now()
where id = 'castelo-vila-medieval-ourem';

update public.venues set description =
  'O museu municipal, com núcleo principal na Casa do Administrador — a casa onde os três Pastorinhos '
  || 'foram interrogados em agosto de 1917.',
  updated_at = now()
where id = 'museu-municipal-ourem';

update public.venues set description =
  'O teatro municipal de Ourém, membro da Rede de Teatros e Cineteatros Portugueses, '
  || 'com sala principal e sala-estúdio para a programação profissional e o trabalho com a comunidade.',
  updated_at = now()
where id = 'teatro-municipal-ourem';

update public.venues set description =
  'O mercado municipal de Ferreira do Zêzere, com o nome de António Teixeira Antunes, '
  || 'que além do mercado acolhe feiras e iniciativas culturais da vila.',
  updated_at = now()
where id = 'mercado-municipal-ferreira-do-zezere';

update public.venues set description =
  'A principal sala de espetáculos de Torres Novas, com o nome da atriz torrejana Virgínia. '
  || 'Programação de teatro, música, dança e cinema, e um serviço educativo próprio, o Lab Criativo.',
  updated_at = now()
where id = 'teatro-virginia';

update public.venues set description =
  'A biblioteca municipal de Torres Novas, junto ao Jardim das Rosas, com auditório próprio. '
  || 'O patrono, Gustavo Pinto Lopes, foi retratado por Carlos Reis em 1936 — o pintor que dá nome ao museu da cidade.',
  updated_at = now()
where id = 'biblioteca-gustavo-pinto-lopes';

update public.venues set description =
  'Inaugurado a 17 de setembro de 2004, com um auditório de 200 lugares, e membro da Rede de Teatros '
  || 'e Cineteatros Portugueses desde 2021. O nome evoca a ligação de Gil Vicente ao Sardoal.',
  updated_at = now()
where id = 'centro-cultural-gil-vicente';

update public.venues set description =
  'Reaberta a 21 de março de 2025 no requalificado antigo Externato Rainha Santa Isabel. '
  || 'Nasceu do espólio da Biblioteca Fixa n.º 176 da Fundação Calouste Gulbenkian, doado ao município em 2002.',
  updated_at = now()
where id = 'biblioteca-municipal-sardoal';

update public.venues set description =
  'O museu de Mação dedicado à arte pré-histórica do vale do Tejo — a Rede Portuguesa de Museus '
  || 'grafa-o «Museu de Arte Pré-Histórica e do Sagrado no Vale do Tejo». No Largo Infante D. Henrique.',
  updated_at = now()
where id = 'museu-arte-pre-historica-macao';

update public.venues set description =
  'O museu do caminho de ferro português, gerido pela Fundação Museu Nacional Ferroviário, '
  || 'no complexo ferroviário do Entroncamento. Aberto de terça a domingo.',
  updated_at = now()
where id = 'museu-nacional-ferroviario';

update public.venues set description =
  'Aberto em 1991, com um auditório de cerca de 400 lugares — a principal sala de espetáculos do Entroncamento.',
  updated_at = now()
where id = 'centro-cultural-entroncamento';

update public.venues set description =
  'Erguida sobre ruínas quinhentistas classificadas, é gerida pela Associação da Casa-Memória de Camões, '
  || 'que também dinamiza o Jardim-Horto de Camões. Aberta ao público aos fins de semana e feriados à tarde.',
  updated_at = now()
where id = 'casa-memoria-de-camoes';

update public.venues set description =
  'Parque temático de astronomia ao ar livre, no Alto de Santa Bárbara, do Centro Ciência Viva de Constância.',
  updated_at = now()
where id = 'ccv-constancia';

update public.venues set description =
  'Monumento Nacional numa ilhota do Tejo, visitável por barco a partir do Cais de Almourol. '
  || 'O CITA — Centro de Interpretação Templário de Almourol fica no Centro Cultural de Vila Nova da Barquinha.',
  updated_at = now()
where id = 'castelo-de-almourol';

update public.venues set description =
  'A casa da cultura de Vila Nova da Barquinha: alberga a Biblioteca Municipal, o Posto de Turismo e o CITA, '
  || 'e recebe música e exposições — incluindo o Barquinha Jazz.',
  updated_at = now()
where id = 'centro-cultural-barquinha';

update public.venues set description =
  'Centro Ciência Viva junto à nascente do rio Alviela, no Parque Natural das Serras de Aire e Candeeiros, '
  || 'aberto desde 2007. Encerra à segunda-feira.',
  updated_at = now()
where id = 'ccv-alviela-carsoscopio';

update public.venues set description =
  'Casa anterior a 1937, doada ao município, que alberga a Galeria Maria Lucília Moita e os serviços de Cultura. '
  || 'O Páteo é o espaço exterior, palco habitual de festivais.',
  updated_at = now()
where id = 'casa-da-cultura-pateo';

update public.venues set description =
  'Sala de 1952 com 277 lugares, propriedade da Casa do Povo de Minde, com reabertura em curso. '
  || 'O nome homenageia Rogério Venâncio (1919–2018).',
  updated_at = now()
where id = 'cine-teatro-rogerio-venancio';

update public.venues set description =
  'Património Mundial da UNESCO: o convento da Ordem de Cristo e o castelo templário de Tomar, '
  || 'sob tutela da Museus e Monumentos de Portugal.',
  updated_at = now()
where id = 'convento-de-cristo';

-- ---------------------------------------------------------------------------
do $$
declare
  v_com_descricao integer;
begin
  select count(description) into v_com_descricao from public.venues;
  if v_com_descricao < 25 then
    raise exception 'esperavam-se pelo menos 25 espaços com descrição pública, e há %', v_com_descricao;
  end if;
end
$$;
