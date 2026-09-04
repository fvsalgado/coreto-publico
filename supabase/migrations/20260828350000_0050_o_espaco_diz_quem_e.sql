-- 0050 — O espaço diz quem é.
--
-- Metade do catálogo de espaços era um nome e uma morada. Um cine-teatro de
-- 1947 com a fachada original, uma filarmónica de 1900, um museu aberto há
-- dois anos e um coreto de ferro fundido chegavam todos à página com a mesma
-- linha: o nome, a freguesia, o concelho. Quem procurava ficava a saber onde
-- é, e não ficava a saber o que é.
--
-- Esta migração faz quatro coisas.
--
-- 1. Arruma o que já lá estava. Doze códigos postais traziam a localidade
--    colada («2490-496 Ourém»), o que os torna inúteis para comparar,
--    ordenar ou passar a um mapa. Trinta e dois telefones estavam sem
--    indicativo, e a página constrói o `tel:` a partir do que aqui está: sem
--    +351, o link só serve a quem já está em Portugal. Três endereços tinham
--    https a responder e continuavam em http.
--
-- 2. Escreve a apresentação de vinte e oito espaços, toda de fonte primária
--    — o sítio do município, o do próprio espaço, o inventário do
--    património. O que não se confirmou não se escreve: um espaço sem
--    descrição continua sem descrição, e é preferível ao texto de brochura
--    que serve para qualquer sítio e não diz nada de nenhum.
--
-- 3. Dá aos sete coretos confirmados que também são espaços a descrição que
--    a 0047 já lhes tinha escrito na tabela dos coretos. Era a mesma pedra
--    descrita duas vezes, e uma das vezes em branco.
--
-- 4. Passa a `provisional` os três coretos-espaço cuja existência não está
--    confirmada. Uma ficha de espaço afirma que o espaço existe; enquanto
--    não se souber, o registo fica marcado como o que é. Não desaparece: a
--    página dos coretos continua a listá-lo com a dúvida à vista, que é
--    como se corrige um levantamento.
--
-- Sobre os endereços que respondem 503 a partir daqui — a biblioteca de
-- Abrantes, a da Barquinha, o turismo de Abrantes: ficam como estão. Deste
-- lado da rede não se distingue um sítio desligado de um sítio que nos
-- recusa a entrada, e já uma vez se deu por morto um sítio que estava vivo.
-- Só se troca um endereço com prova de que o novo é o certo.

-- ---------------------------------------------------------------------------
-- 1. Higiene
-- ---------------------------------------------------------------------------

-- O código postal é `NNNN-NNN` e mais nada. A localidade tem coluna própria
-- e repeti-la aqui só serve para a comparação falhar.
update public.venues
   set postal_code = substring(postal_code from '^[0-9]{4}-[0-9]{3}'),
       updated_at = now()
 where postal_code ~ '^[0-9]{4}-[0-9]{3}[^0-9]';

-- Todo o telefone leva indicativo de país. A expressão apanha o número no
-- princípio da cadeia e cada número que venha depois de uma barra, e deixa
-- em paz o que já está feito e o sufixo da extensão.
update public.venues
   set phone = regexp_replace(phone, '(^|/ )([0-9]{3} [0-9]{3} [0-9]{3})', '\1+351 \2', 'g'),
       updated_at = now()
 where phone is not null
   and phone !~ '\+351';

-- Três endereços com https a responder 200, verificado um a um.
update public.venues
   set website_url = replace(website_url, 'http://', 'https://'),
       updated_at = now()
 where id in ('cineclube-torres-novas', 'convento-de-cristo', 'sf-euterpe-meiaviense')
   and website_url like 'http://%';

-- O turismo de Abrantes mudou de casa: `turismo.cm-abrantes.pt` responde 503
-- em http, mas em https devolve 301 para `visitabrantes.pt`, que é o sítio
-- oficial do turismo do município. Estava dado como morto no caderno desta
-- casa por se ter olhado só para o http; está vivo, e mudou-se.
update public.venues
   set website_url = 'https://visitabrantes.pt',
       updated_at = now()
 where id = 'aquapolis-abrantes'
   and website_url = 'http://turismo.cm-abrantes.pt';

-- Os quatro que ficam em http, e porquê. Um cadeado partido é pior do que
-- endereço nenhum, por isso nenhum destes sobe a https às cegas:
--
--   caorg-minde, marg-minde   o certificado de https não serve o domínio
--                             `caorg.pt`; em http responde 200.
--   biblioteca-antonio-botto  responde 503 em http e o certificado de https
--   biblioteca-municipal-     não serve o domínio (a da Barquinha nem sequer
--     barquinha               aceita a ligação). Não se distingue daqui um
--                             sítio desligado de um sítio que nos barra, e
--                             já se deu por morto um que estava vivo — como
--                             agora se viu no turismo de Abrantes. Ficam
--                             como estão até haver prova do endereço certo.

-- ---------------------------------------------------------------------------
-- 2. A apresentação de cada espaço
--
-- Uma lista, e não vinte e oito comandos: assim lê-se de uma vez o que
-- entrou, e o `updated_at` fica certo sem ser preciso repeti-lo em cada
-- linha.
-- ---------------------------------------------------------------------------

update public.venues v
   set description = novo.description,
       updated_at = now()
  from (values
    -- Abrantes
    ('espalhafitas-cineclube',
     'Secção de cinema da Palha de Abrantes, formada em março de 2002; a primeira sessão pública foi em maio desse ano, no Cineteatro São Pedro. As sessões de quarta-feira nunca pararam desde então — mudaram de casa em 2014, quando acabou a cedência do cineteatro.'),

    -- Alcanena
    ('biblioteca-municipal-alcanena',
     'Aberta a 28 de setembro de 2002 num palheiro de 1903 da casa agrícola de Joaquim Carlos Reis e Silva, adaptado a biblioteca. Tem empréstimo domiciliário, multimédia, internet, cinema e uma bebeteca para os que ainda não fizeram quatro anos.'),
    ('caorg-minde',
     'Fundado em 1986 para guardar e mostrar o saber-fazer de Minde. Trabalha por polos — o Museu de Aguarela Roque Gameiro é um deles.'),
    ('marg-minde',
     'Dedicado a Alfredo Roque Gameiro (1864-1935), o aguarelista nascido em Minde. Está na Casa dos Açores, recuperada para o receber, desde 2009. Entrada 3 €, gratuita até aos dez anos; encerra à segunda-feira.'),
    ('cine-teatro-sao-pedro-alcanena',
     'Trezentos e quarenta e dois lugares na Avenida 25 de Abril. A reconstrução de 1947 manteve a fachada original e distribuiu por quatro pisos as salas de exposição que hoje acompanham a sala de espetáculos.'),
    ('museu-municipal-alcanena',
     'Aberto a 4 de outubro de 2024 no edifício do antigo Museu do Curtume, encerrado desde 2008. Conta quarenta e cinco mil anos de ocupação humana no concelho: arqueologia do paleolítico, o ofício dos curtumes e a etnografia da serra. Entrada gratuita.'),
    ('sociedade-musical-mindense',
     'Fundada a 25 de outubro de 1915, é a associação mais antiga do concelho. Começou com vinte e seis músicos e instrumentos oferecidos por Justino Guedes; hoje tem banda e escola de música, e a medalha de ouro do município.'),
    ('fabrica-de-cultura-minde',
     'Antiga fábrica têxtil de Minde recuperada para a cultura: incubação de projetos, investigação, formação e criação artística, com programação regular e residências de artistas.'),
    ('espaco-jazz-minde',
     'No Edifício António Alves Raposo. É uma das casas do JazzMinde e da Materiais Diversos.'),

    -- Entroncamento
    ('biblioteca-municipal-entroncamento',
     'Inaugurada a 29 de maio de 1965. É a biblioteca municipal do Entroncamento e tem programação própria — encontros com autores, feira do livro, concursos literários.'),

    -- Ferreira do Zêzere
    ('dornes',
     'Aldeia debruçada sobre o Zêzere, com a torre pentagonal templária e a Igreja de Nossa Senhora do Pranto. À noite, a partir das oito, a torre recebe um espetáculo de videomapeamento com as lendas do lugar.'),
    ('lago-azul',
     'Praia fluvial na albufeira de Castelo do Bode, na Castanheira, com piscina flutuante e atividades náuticas.'),

    -- Ourém
    ('casa-do-povo-de-fatima',
     'Fundada em 1969 e constituída em março de 1970. Começou pelo social — um curso de escolaridade para adultos, a primeira telescola da freguesia — e cedo lhe juntou o cultural: primeiro o grupo de teatro, depois o Rancho Folclórico, de 1977, que ainda hoje é o seu porta-estandarte. Cerca de quinhentos sócios.'),
    ('ourearte',
     'Escola de música e artes sem fins lucrativos, nascida em 2002 de um acordo entre a câmara e as filarmónicas do concelho: dar aos músicos das bandas um sítio onde estudar.'),
    ('centro-municipal-exposicoes-ourem',
     'O espaço municipal das grandes feiras e exposições de Ourém, na Rua Melvin Jones, junto ao Parque da Cidade.'),

    -- Tomar
    ('museu-dos-fosforos',
     'No antigo Convento de São Francisco desde 1989. A coleção é de Aquiles da Mota Lima, que a começou em 1953 e a ofereceu ao município em 1980: dezenas de milhares de caixas de mais de cem países, a maior do género na Europa. Entrada gratuita.'),
    ('sinagoga-museu-luso-hebraico',
     'Do século XV, o único templo hebraico proto-renascentista que resta em Portugal. Fechou em 1496 com a expulsão dos judeus e foi depois prisão, ermida e armazém. Samuel Schwarz comprou-a em 1923 e ofereceu-a ao Estado em 1939, para nela ficar o Museu Luso-Hebraico Abraão Zacuto. Monumento nacional desde 1921.'),
    ('ceft-casa-dos-cubos',
     'O Centro de Estudos em Fotografia de Tomar, criado em 2018 na Casa dos Cubos, à beira do Nabão. O edifício era armazém, e os cubos são os alqueires com que se media o que entrava. Preserva e estuda acervos fotográficos e dá formação em conservação e em processos históricos.'),
    ('scocs-cem-soldos',
     'O clube da aldeia de Cem Soldos — oitocentos habitantes e mais de mil sócios. É dele o festival Bons Sons, criado em 2006, que faz da aldeia inteira o recinto: as ruas, os largos, os quintais e as casas de quem lá vive.'),

    -- Torres Novas
    ('museu-carlos-reis',
     'Fundado em 1933 por Gustavo Pinto Lopes e aberto a 20 de junho de 1937, tomou em 1942 o nome do pintor Carlos Reis (1863-1940), de quem guarda cerca de três dezenas de obras. Está na Casa Mogo de Melo desde 1993, com salas de pré-história, romanização, Idade Média e arte sacra.'),
    ('castelo-torres-novas',
     'Monumento nacional desde 1910. Do século XII, tomado por D. Afonso Henriques em 1148 e definitivamente por D. Sancho I em 1190. Tem onze torres e a casa do alcaide, do século XIV; quatro torres caíram no terramoto de 1755. Lá dentro há um jardim, e a entrada é livre.'),
    ('choral-phydellius',
     'Fundado a 17 de maio de 1957 como coro masculino de música sacra e coro misto desde 1961. Tem escola de música desde 1975, oficialmente reconhecida em 1993 e hoje Conservatório de Música do Choral Phydellius.'),
    ('sf-lealdade-uniao-ribeirense',
     'A filarmónica da Ribeira Branca, fundada a 12 de agosto de 1900. Retomou banda e escola de música em 2009.'),

    -- Vila Nova da Barquinha
    ('biblioteca-municipal-barquinha',
     'Tem o nome de Carlos Matos Gomes — militar de Abril, escritor e investigador do concelho. Fica no Centro Cultural e dá acesso a mais de sete mil livros. Voltou à Rede Nacional de Bibliotecas Públicas a 25 de junho de 2026, sete anos depois de dela ter saído.'),
    ('parque-escultura-almourol',
     'Sete hectares à beira do Tejo, abertos a 2 de julho de 2005 e prémio nacional de arquitetura paisagista em 2007. O parque de escultura foi inaugurado a 6 de julho de 2012 e junta obras de Alberto Carneiro, Ângela Ferreira, Carlos Nogueira, Cristina Ataíde, Fernanda Fragateiro, Joana Vasconcelos, José Pedro Croft, Pedro Cabrita Reis, Rui Chafes, Xana e Zulmiro de Carvalho.'),

    -- Os três coretos por confirmar. A ficha diz o que se sabe e o que não
    -- se sabe, sem a linguagem do caderno de pesquisa: quem lê aqui não veio
    -- ver o processo, veio ver se há coreto na sua terra.
    ('coreto-carril',
     'O Carril é terra de música: foi ali que «A Portuguesa» teve, em 1890, a sua primeira orquestração, pela Filarmónica Carrilense. Do coreto em si não há prova documental — está no levantamento à espera de quem o veja.'),
    ('coreto-espite',
     'Um coreto em Espite entrou no levantamento sem prova que o sustente. Quem passa por lá todos os dias sabe melhor do que qualquer mapa.'),
    ('coreto-zibreira',
     'Um coreto na Praça Engenheiro Luís Tavares Simão, junto à Igreja de São Sebastião, listado num diretório turístico sem fontes citadas. É a Zibreira de Torres Novas, e é pouco para dar por certo.')
  ) as novo(id, description)
 where v.id = novo.id;

-- Contactos publicados pelas próprias entidades e que faltavam à ficha.
update public.venues set email = 'turismo@cm-tomar.pt', updated_at = now()
  where id = 'museu-dos-fosforos' and email is null;

update public.venues
   set address = 'Edifício António Alves Raposo, Rua Emídio da Silva Raposo, n.º 178',
       updated_at = now()
  where id = 'espaco-jazz-minde' and address is null;

-- ---------------------------------------------------------------------------
-- 3. O coreto confirmado herda a descrição que já lhe tinham escrito
--
-- A 0047 escreveu a apresentação pública de cada coreto. Onde o coreto
-- também é espaço do catálogo, a ficha do espaço estava muda sobre a mesma
-- pedra. Copia-se, e só onde falta: uma descrição escrita à mão para o
-- espaço tem sempre precedência.
--
-- Só os confirmados. A descrição de um coreto por confirmar foi escrita
-- para a página dos coretos, onde vive debaixo do título «Por confirmar»
-- que lhe dá o contexto; sozinha, numa ficha de espaço, seria outra coisa.
-- Esses três estão acima, com texto próprio.
-- ---------------------------------------------------------------------------

update public.venues v
   set description = c.description,
       updated_at = now()
  from public.coretos c
 where c.venue_id = v.id
   and c.is_confirmed
   and c.description is not null
   and v.kind = 'bandstand'
   and v.description is null;

-- ---------------------------------------------------------------------------
-- 4. O que não está confirmado não se apresenta como certo
-- ---------------------------------------------------------------------------

update public.venues v
   set status = 'provisional',
       updated_at = now()
  from public.coretos c
 where c.venue_id = v.id
   and not c.is_confirmed
   and v.kind = 'bandstand'
   and v.status = 'active';

-- ---------------------------------------------------------------------------
-- As garantias.
--
-- Cada uma corresponde a um erro que já esteve nesta tabela: o código postal
-- com a localidade colada, o telefone sem indicativo que gera um `tel:` que
-- não liga, e o texto de trabalho a escapar-se para a página pública.
-- ---------------------------------------------------------------------------
do $$
declare
  v_cp integer;
  v_tel integer;
  v_http integer;
  v_caderno integer;
  v_vazia integer;
begin
  select count(*) into v_cp from public.venues
    where postal_code is not null and postal_code !~ '^[0-9]{4}-[0-9]{3}$';
  if v_cp > 0 then
    raise exception '% códigos postais fora do formato NNNN-NNN', v_cp;
  end if;

  -- Um número; os que vierem a seguir separados por barra; a extensão no fim
  -- se a houver. Tudo o resto é um `tel:` partido à espera de acontecer.
  select count(*) into v_tel from public.venues
    where phone is not null
      and phone !~ '^\+351 [0-9]{3} [0-9]{3} [0-9]{3}( / \+351 [0-9]{3} [0-9]{3} [0-9]{3})*( \(ext\. [0-9/]+\))?$';
  if v_tel > 0 then
    raise exception '% telefones fora do formato +351 NNN NNN NNN', v_tel;
  end if;

  -- Só os quatro documentados acima podem ficar em http. Qualquer outro é um
  -- endereço que ninguém verificou.
  select count(*) into v_http from public.venues
    where website_url like 'http://%'
      and id not in ('caorg-minde', 'marg-minde',
                     'biblioteca-antonio-botto', 'biblioteca-municipal-barquinha');
  if v_http > 0 then
    raise exception '% endereços em http sem a exceção documentada', v_http;
  end if;

  -- O caderno de pesquisa não sai da moderação. As marcas são as que a 0047
  -- caçou nos coretos, mais as que os coretos por confirmar trariam consigo.
  select count(*) into v_caderno from public.venues
    where description ~* '(por confirmar no terreno|ATENÇÃO|coerência de critério|nenhum resultado|a confirmar junto|não encontrámos|falta quem confirme)';
  if v_caderno > 0 then
    raise exception '% descrições de espaço com linguagem de caderno de pesquisa', v_caderno;
  end if;

  -- Uma descrição existe ou não existe. Vazia é pior: ocupa o lugar e cala.
  select count(*) into v_vazia from public.venues
    where description is not null and btrim(description) = '';
  if v_vazia > 0 then
    raise exception '% descrições de espaço vazias', v_vazia;
  end if;
end
$$;
