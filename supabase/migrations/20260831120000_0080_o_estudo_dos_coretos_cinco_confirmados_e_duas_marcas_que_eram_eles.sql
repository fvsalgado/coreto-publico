-- 0080 — O estudo dos coretos: onze confirmados de uma vez, e duas marcas
-- que afinal eram os próprios coretos.
--
-- O dono entregou um estudo de gabinete (31/08/2026) sobre os quinze coretos
-- por confirmar, cruzando o inventário nacional «Reanimar os Coretos em
-- Portugal» (José Matos, desde 2012), o arquivo InfoPortugal (All About
-- Portugal, iGoGo), o Wikimedia Commons, a imprensa regional e os sítios de
-- memória local. Esta migração escreve o que o estudo provou — e o que a
-- verificação das fontes, feita uma a uma antes de escrever, corrigiu ao
-- próprio estudo. Cada fotografia foi verificada a responder (HTTP 200) e
-- leva o crédito de quem a fez, como o dono pediu.
--
-- ## I — Cinco que passam a confirmados, com fotografia datada
--
--   · **Fonte de Dom João** (Tomar · Junceira). José Matos, 28/11/2010;
--     duas fotografias InfoPortugal com morada.
--   · **Poço Redondo** (Tomar). José Matos, 28/11/2010; InfoPortugal.
--     O inventário escreve «Freguesia de Junceira», mas o lugar do Poço
--     Redondo cai em Olalhas no OSM/CAOP e a divisória passa mesmo ali —
--     fica Olalhas, com o conflito anotado para a ida ao terreno.
--   · **Zibreira** (Torres Novas). José Matos, 28/11/2010; InfoPortugal
--     com a morada exata da Praça Eng.º Luís Tavares Simão.
--   · **Espite** (Ourém). José Matos, 17/08/2012, três ângulos; grupo
--     «Amigos de Ourém». No adro da igreja — coordenadas da Rua da Igreja
--     de Espite (OSM/Nominatim), com a proveniência anotada.
--   · **Chancelaria** (Torres Novas) — ver II.
--
-- ## II — As duas marcas que eram os próprios coretos
--
-- O estudo deixava duas pontas soltas: a marca da «Maçaroca» na EM 557
-- (segunda estrutura ou erro de leitura?) e as marcas de Castelo Novo e
-- Bugarrel na Serra (qual delas seria o coreto documentado no «Adro»?).
-- A verificação no OSM fechou as duas:
--
--   · A **Igreja Paroquial da Chancelaria está na EM 557, no lugar da
--     Maçaroca**, a 57 metros da marca. O «Largo da Igreja» da fotografia
--     de José Matos e a marca da Maçaroca são o mesmo sítio. A linha
--     renomeia-se «Coreto da Chancelaria» e confirma-se — uma estrutura,
--     não duas.
--   · O nó de lugar «Serra» do OSM está a 60 metros da marca do Bugarrel,
--     e o «Café do Adro» (EM 530, código postal 2300-251 — o mesmo que o
--     arquivo dá ao coreto) a 40 metros. O «Adro, 2300-251» do arquivo é
--     este largo. A linha do Bugarrel renomeia-se «Coreto da Serra» e
--     confirma-se, com as duas fotografias InfoPortugal. Castelo Novo, a
--     1,3 km, continua por confirmar.
--
-- ## III — Cinco que faltavam no levantamento, todos com fotografia datada
--
-- Paialvo (José Matos, 05/02/2012 — o largo chama-se Largo do Coreto),
-- Fátima (José Matos, 05/02/2012 — frente à igreja matriz, estrutura
-- distinta da marca da Ortiga), Gondemaria (João Barbosa, 30/11/2015),
-- Vilar dos Prazeres (José Matos, 05/02/2012) e Cercal (José Matos,
-- 06/12/2015). Coordenadas do largo ou da rua documentada quando o OSM os
-- tem (Fátima, Gondemaria), do nó da povoação quando não tem (Paialvo,
-- Vilar dos Prazeres, Cercal) — a proveniência fica em cada nota.
--
-- ## IV — O que a verificação corrigiu ao estudo
--
-- O estudo lia no inventário «uma entrada Alcanena só com duas fotografias
-- e sem texto» e propunha um coreto por localizar na vila. As duas imagens
-- desse post são **o brasão e o mapa do concelho** — é um separador da
-- secção «Concelhos» do blogue, não um registo de coreto. Não se escreve
-- nenhum «Coreto de Alcanena»: não há uma única prova.
--
-- ## V — Fotografias para quatro confirmados que não tinham
--
-- Penhascoso (Inês Santos), Jardim da Aranha no Entroncamento (José Matos,
-- 07/11/2010), Rossio ao Sul do Tejo (José Matos, 11/2010) e Jardim
-- Ribeirinho da Barquinha (Inês Santos, 04/04/2012) — todas do inventário.
-- Nossa Senhora do Tojo e Souto continuam sem fotografia em nenhuma fonte:
-- ficam vazios, que é o que um campo sem prova fica.
--
-- ## VI — A memória e o auditório
--
-- O Sardoal ganha a sua história em vez do vazio: a imprensa de 1900–1920
-- fala de coretos de festa — palanques, provavelmente — e não há vestígio
-- de estrutura fixa. E no Jardim Municipal de Torres Novas o que os
-- diretórios registam é o Auditório do Jardim das Rosas: fica anotado, e a
-- decisão de retirar ou reclassificar é de quem manda, com a Câmara.

-- ---------------------------------------------------------------------------
-- I · Os cinco que passam a confirmados
-- ---------------------------------------------------------------------------

update public.coretos set
  is_confirmed = true,
  photo_url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh9Ci0WwK_N13ejASC2COK9usNaFNdS9TlhGSOyHTnLa2l9yw5ru7Ixu8MgqcA_4YG2NuPGI5Ww1qAIvD_pQorYATuU7AfEhF6V4EQjmgJuLyO9hQVX2OOxNtwhB6XJ90GEIfkReKHfeSLZ/s1600/167087_182583215093427_6204160_n.jpg',
  photo_credit = 'José Matos, «Reanimar os Coretos em Portugal»',
  description = 'Plataforma alta em alvenaria, com escadas laterais e um piso fechado por baixo, coberta por uma estrutura metálica de traço moderno — um coreto de meados do século XX, feito para uma banda e para um largo de festas.',
  notes = 'Confirmado pelo estudo de 31/08/2026: fotografado por José Matos a 28/11/2010 (reanimar-coretos-portugal.blogspot.com/2013/06/coreto-da-fonte-de-d-joao.html, «Lugar da Fonte de D. João, Freguesia da Junceira»); duas fotografias no arquivo InfoPortugal (All About Portugal) com a morada Terreiro de São Simão, 2300-035. O OSM confirma o lugar «Fonte Dom João, Junceira». Falta fotografia própria em CC BY-SA.',
  updated_at = now()
where id = 'coreto-fonte-de-dom-joao';

update public.coretos set
  is_confirmed = true,
  photo_url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjz62Hdk_X272WvEIBd6yx-yeN-cm8H6u55rYtcBHrhALP4lGYvvXLzdlO-LWGaSfeDgZa6vKOfiKhiLKuL-0sdQeyXj6TWh3dE26lE6Ga2UqdubwRh8HumbVfDdH-j2w2jKPPTPZof1IeM/s1600/163067_183105128374569_1811579_n.jpg',
  photo_credit = 'José Matos, «Reanimar os Coretos em Portugal»',
  description = 'Coreto branco de planta octogonal, telhado com pináculo, assente numa base elevada com uma sala fechada por baixo e escada de acesso — ao lado da sede das festas do Poço Redondo, que continuam a fazer-se.',
  notes = 'Confirmado pelo estudo de 31/08/2026: fotografado por José Matos a 28/11/2010 (reanimar-coretos-portugal.blogspot.com/2013/06/coreto-do-poco-redondo.html); duas fotografias InfoPortugal com a morada Largo do Espírito Santo, 2300-035. Conflito de freguesia anotado: o inventário escreve «Freguesia de Junceira», mas o lugar do Poço Redondo cai em Olalhas no OSM/CAOP (39.62796,-8.32065) e a divisória passa ali ao lado — verificar na ida ao terreno. Falta fotografia própria em CC BY-SA.',
  updated_at = now()
where id = 'coreto-poco-redondo';

update public.coretos set
  is_confirmed = true,
  photo_url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgN2BImzYMbDh5f6YMZRM4fm_WHWpt8HDQ5F5JtMLsJpp22WDSjJ4_spyD8fpc5E7Rs0GJa_h59LCdT2wxIfySizFZN8RnOp7ZXHWObjCY6tZ448V8A_tqhjlIs7Ai9Wj0U-jTtEih0qM4N/s1600/223319_211661502185598_3165549_n.jpg',
  photo_credit = 'José Matos, «Reanimar os Coretos em Portugal»',
  description = 'Colunas azuis e cobertura vermelha com beirado rendilhado, sobre base branca com escadas, num relvado com bancos — o palco das filarmónicas nos dias de festa.',
  notes = 'Confirmado pelo estudo de 31/08/2026: fotografado por José Matos a 28/11/2010 (reanimar-coretos-portugal.blogspot.com/2013/05/coreto-de-zibreira.html); duas fotografias InfoPortugal com a morada exata da Praça Eng.º Luís Tavares Simão. Falta fotografia própria em CC BY-SA; pedir à Junta de Freguesia de Zibreira as datas das festas.',
  updated_at = now()
where id = 'coreto-zibreira';

update public.coretos set
  is_confirmed = true,
  latitude = 39.78363,
  longitude = -8.64721,
  photo_url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjl6Ad0vQM38qwU43CjjbztR1ZIzVFoDwGZpxqjULREvaa-EUlfcYR5wNPRyT-KE9XHAzH3JhE35sBPb7tsXjsNATVR22rk33TAIPX4mSzvpqQGy6wB7gLq03MzH1zQzuknCfLQ4Qq2xg0N/s1600/HPIM6453+-+Espite.JPG',
  photo_credit = 'José Matos, «Reanimar os Coretos em Portugal»',
  description = 'No adro da igreja de Espite, recordado pelos de lá como «um dos coretos da coleção».',
  notes = 'Confirmado pelo estudo de 31/08/2026: fotografado por José Matos a 17/08/2012, de três ângulos (reanimar-coretos-portugal.blogspot.com/2012/08/coreto-de-espite.html, «Adro da Igreja de Espite»); publicação no grupo de Facebook «Amigos de Ourém». Coordenadas da Rua da Igreja de Espite (OSM/Nominatim, 39.78363,-8.64721) — o adro é contíguo; acertar ao metro na ida ao terreno. A Junta de Freguesia de Espite confirma morada e estado atual.',
  updated_at = now()
where id = 'coreto-espite';

-- ---------------------------------------------------------------------------
-- II · As duas marcas que eram os próprios coretos
-- ---------------------------------------------------------------------------

update public.coretos set
  name = 'Coreto da Chancelaria',
  is_confirmed = true,
  photo_url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjtOSDWRoqTWCL6ZO3B7UCCmnJmhE-SDhFATcAofNx3QN0MakvjR8nQhbE0Hlb3f93gvsw0Z4uGI9WN8z8yaB3q7eouaiQNYNQfXAPMhi5f7sQQ3eIGUV6cXSFS4kxmaSel8F6TZ6aGVwqx/s1600/163090_176164602401955_100000252487830_557791_861806_n.jpg',
  photo_credit = 'José Matos, «Reanimar os Coretos em Portugal»',
  description = 'Cúpula circular em chapa, corpo branco com frisos amarelos sobre base cinzenta, no largo da igreja, com bancos e árvores à volta — o coreto clássico de freguesia, na sua forma mais reconhecível.',
  notes = 'Era a marca «Maçaroca» do OSM, junto à EM 557, e o estudo de 31/08/2026 perguntava se seria uma segunda estrutura ou um erro de leitura. Não é nem uma coisa nem outra: a Igreja Paroquial da Chancelaria está na EM 557, no lugar da Maçaroca, a 57 m desta marca (OSM/Nominatim) — o «Largo da Igreja, 2350-073» da fotografia de José Matos (novembro de 2010, reanimar-coretos-portugal.blogspot.com/2012/01/coreto-da-chancelaria.html) e a marca são o mesmo sítio. Duas fotografias InfoPortugal (TRN1311, TRN1312) com a mesma morada. Falta fotografia própria em CC BY-SA.',
  updated_at = now()
where id = 'coreto-chancelaria-macaroca';

update public.coretos set
  name = 'Coreto da Serra',
  is_confirmed = true,
  photo_url = 'https://cms.infoportugal.info/media/fotos/final/Tomar/TOM9276.jpg',
  photo_credit = 'InfoPortugal / All About Portugal',
  description = 'Coreto alto, amarelo e branco, com um piso inferior fechado e o palco em cima, telhado octogonal com pináculo, num largo de palmeiras e plátanos — o Adro da Serra.',
  notes = 'Era a marca «Bugarrel» do OSM, e o estudo de 31/08/2026 documentava um «Coreto da Serra» no «Adro, 2300-251» (duas fotografias InfoPortugal; entrada iGoGo) sem saber a qual das marcas da freguesia corresponderia. A verificação fechou-o: o nó de lugar «Serra» do OSM está a 60 m desta marca, e o «Café do Adro» (EM 530, código postal 2300-251 — o mesmo que o arquivo dá ao coreto) a 40 m. O «Adro» é este largo. Castelo Novo, a 1,3 km, continua por confirmar. Falta fotografia própria em CC BY-SA; confirmar a freguesia atual (União das Freguesias da Serra e Junceira).',
  updated_at = now()
where id = 'coreto-serra-bugarrel';

update public.coretos set
  notes = 'Mapeado no OpenStreetMap no lugar de Castelo Novo, freguesia da Serra; nenhuma fonte externa o documenta. O estudo de 31/08/2026 e a verificação de fontes resolveram a marca vizinha do Bugarrel — é o Coreto da Serra, no Adro, documentado pelo arquivo InfoPortugal — mas esta continua sem prova: ou é uma segunda estrutura, ou a marca sobra. Verificação de terreno numa só ida: Serra (Adro), Castelo Novo, Poço Redondo e Fonte de Dom João ficam a minutos uns dos outros.',
  updated_at = now()
where id = 'coreto-serra-castelo-novo';

-- ---------------------------------------------------------------------------
-- III · Os cinco que faltavam
-- ---------------------------------------------------------------------------

insert into public.coretos (id, name, parish, municipality_id, latitude, longitude, is_confirmed, photo_url, photo_credit, description, notes) values
  (
    'coreto-paialvo',
    'Coreto de Paialvo',
    'Paialvo',
    'tomar',
    39.56279, -8.46735,
    true,
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjAaGxhSM0XEvH4LU85x_uWVDvrAQWebkK4DrkxHEidt_U4NQzVZXTGkTZ_lR6qNfSrADsKfreeRLAVT7_-2MNhUmPgSyOApNFMh-U3cefUOUSP6aFazK07GCAxJOr7WEj5RrkoBCwi35Ja/s1600/401309_356406734377740_100000252487830_1415013_850469434_n.jpg',
    'José Matos, «Reanimar os Coretos em Portugal»',
    'No Largo do Coreto — o largo tem o nome dele, que é a prova toponímica mais forte que se pode ter.',
    'Do estudo de 31/08/2026: não constava do levantamento. Fotografado por José Matos a 05/02/2012 (reanimar-coretos-portugal.blogspot.com/2012/02/coreto-de-paialvo.html, «Largo do Coreto, Freguesia de Paialvo»). O Largo do Coreto não está no OSM: coordenadas do nó da povoação de Paialvo (39.56279,-8.46735) — acertar ao metro na ida ao terreno. Pedir fotografia à Junta de Freguesia de Paialvo.'
  ),
  (
    'coreto-fatima',
    'Coreto de Fátima',
    'Fátima',
    'ourem',
    39.61756, -8.65230,
    true,
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgE4mj5guSDXkTnvjmtxssxyOwsiPP4O8XBMrsZhngsr5kGIaD-Bd2oB3IIdcL4uNjy62fIwHQ4phlrtEtkAEzXo6QrmjCwyeRb_h6ee5Mu8WJyBGhszbXFmnISkghJj2_8jvJxV16MUCf7/s1600/.+1634.jpg',
    'José Matos, «Reanimar os Coretos em Portugal»',
    'Na vila de Fátima, em frente à igreja paroquial — a dois quilómetros do santuário da Ortiga, e uma estrutura diferente da que o levantamento marcou junto ao santuário.',
    'Do estudo de 31/08/2026: não constava do levantamento. Fotografado por José Matos a 05/02/2012, duas fotografias (reanimar-coretos-portugal.blogspot.com/2012/02/coreto-de-fatima.html, «Rua Padre Manuel António Henriques, frente à igreja matriz»). Coordenadas da própria rua (OSM/Nominatim, 2495-557). Fátima tem a maior procura turística da região: merece ficha completa e fotografia própria.'
  ),
  (
    'coreto-gondemaria',
    'Coreto de Gondemaria',
    'União das freguesias de Gondemaria e Olival',
    'ourem',
    39.68756, -8.62213,
    true,
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh6VnyUztGlWjlkENDYU36xK5JQtfh2pBZT9FCAxcm_Hb2rGyPfJ4lfETUfXNyFVFL9JXcP-njExck07Dsq_OGDGdtdOn8iUDy4R6pKNW_z-aX25ApiQOqdsWHpeBwH1csgymk2A72LUMl5/s1600/12274694_1098236590188616_901520364182694011_n.jpg',
    'João Barbosa, «Reanimar os Coretos em Portugal»',
    'No Largo Frei Luís de Sousa, o largo principal da freguesia.',
    'Do estudo de 31/08/2026: não constava do levantamento. Fotografado por João Barbosa a 30/11/2015, três ângulos (reanimar-coretos-portugal.blogspot.com/2015/12/coreto-de-gondemaria-ourem.html, «Largo Frei Luis de Sousa»). Coordenadas do próprio largo (OSM/Nominatim, lugar do Cidral, 2490-130). Contacto natural: Junta da União de Freguesias de Gondemaria e Olival.'
  ),
  (
    'coreto-vilar-dos-prazeres',
    'Coreto de Vilar dos Prazeres',
    'Nossa Senhora das Misericórdias',
    'ourem',
    39.63056, -8.56964,
    true,
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgJQ3O98E1NhZZj_Fc7vdsbFbE7vvagFsLoHOkt4JQVVfuVf6VvknRtNb4ohlxnooXA3N3hGVk-BoijjTb_FQn8VM7CUNEF7JIHcjqTTcJkpDdemv9LXq_9SIJAGSVg1f2k64XGiF7WBtOI/s1600/396243_356423637709383_100000252487830_1415036_1188587723_n.jpg',
    'José Matos, «Reanimar os Coretos em Portugal»',
    'Coreto de aldeia na freguesia sede do concelho, na Rua dos Castelos de Ourém.',
    'Do estudo de 31/08/2026: não constava do levantamento. Fotografado por José Matos a 05/02/2012 (reanimar-coretos-portugal.blogspot.com/2012/02/coreto-de-vilar-dos-prazeres.html, «Rua dos Castelos de Ourém, Freguesia de Nossa Senhora da Misericórdia»). A rua não está no OSM: coordenadas do nó da povoação de Vilar dos Prazeres (39.63056,-8.56964, 2490-761) — acertar ao metro na ida ao terreno. Contacto: Junta de Freguesia de Nossa Senhora das Misericórdias.'
  ),
  (
    'coreto-cercal',
    'Coreto do Cercal',
    'União das freguesias de Matas e Cercal',
    'ourem',
    39.70768, -8.65931,
    true,
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgL1kbR3Cj0lQVlJYIAUkotbQ_SVhywO_zbN0CHit0SCM26Bz14_u5FLAmTztamBkk7cHyANzSF02lJlVz8A_0Dla0wPrKwZe-raDHNJOUXcH6JywWFYKbeNPNL6aCu80yL2OF-eMxmH6FZ/s1600/025.jpg',
    'José Matos, «Reanimar os Coretos em Portugal»',
    'Coreto de freguesia na Rua Nossa Senhora do Rosário.',
    'Do estudo de 31/08/2026: não constava do levantamento. Fotografado por José Matos a 06/12/2015, três ângulos (reanimar-coretos-portugal.blogspot.com/2015/12/coreto-do-cercal-ourem.html, «Rua Nossa Senhora do Rosário, Freguesia do Cercal»). A rua não está no OSM: coordenadas do nó da povoação do Cercal (39.70768,-8.65931, 2490-107) — acertar ao metro na ida ao terreno. Contacto: Junta da União de Freguesias de Matas e Cercal.'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- V · Fotografias para quatro confirmados que não tinham
-- ---------------------------------------------------------------------------

update public.coretos set
  photo_url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh4axoR-6sxhjD7mw0xvhcPx1iOUEHJcJCk0uL5lCmNW2f9G3kl8k0doCZrXPy_Zj9Kbu-TPT3hwiQGIXfscglKzozOFsExtsNtiHHRD-af7qSuFWpIhQ9U7ILLGK9fznF65hYxI0OfDHuH/s1600/532472_328875910510424_100001640536402_948290_1592564740_n.jpg',
  photo_credit = 'Inês Santos, «Reanimar os Coretos em Portugal»',
  notes = coalesce(notes, '') || ' Fotografia de Inês Santos no inventário nacional (04/04/2012, reanimar-coretos-portugal.blogspot.com/2012/04/coreto-de-penhascoso.html), que o situa na Rua da Igreja.',
  updated_at = now()
where id = 'coreto-penhascoso' and photo_url is null;

update public.coretos set
  photo_url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg-ZPGjnLhpRh9kcM0VyxTOAach6fGXAfEZ3fvN7R2I5_t2ElL3_tAmyRnoFUCvX29sUG7SJC6HEjyzZCN-leme54g8ckIreyEKL7auqHfelDCwT889hgrwSTR8s-GEe9-wjAfr1a0g6GOv/s1600/.+246.jpg',
  photo_credit = 'José Matos, «Reanimar os Coretos em Portugal»',
  notes = coalesce(notes, '') || ' Fotografia de José Matos no inventário nacional (07/11/2010, reanimar-coretos-portugal.blogspot.com/2014/09/coreto-do-entroncamento.html, «Rua do Infante de Sagres, Parque José P. Caldas»).',
  updated_at = now()
where id = 'coreto-jardim-da-aranha' and photo_url is null;

update public.coretos set
  photo_url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEimG9TACVNFQ4UCCEeuP2iA5eTaI_e8R79kusUdDMnl6C0_E9D7kcdYKqs2oOB89ZPidMl8p1q9BB1u2QGMb5MW1aGi9GIeiWnMBJkCVl9GlAgHjkdW6KV1wBeVKR-aBBw7iq43cUOK0nr4/s1600/149590_168404446511304_100000252487830_507216_6618133_n.jpg',
  photo_credit = 'José Matos, «Reanimar os Coretos em Portugal»',
  notes = coalesce(notes, '') || ' Fotografia de José Matos no inventário nacional (novembro de 2010, reanimar-coretos-portugal.blogspot.com/2012/01/coreto-do-rossio-ao-sul-do-tejo.html).',
  updated_at = now()
where id = 'coreto-rossio-ao-sul-do-tejo' and photo_url is null;

update public.coretos set
  photo_url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhnpRJDb7h5jfqi-_owZfoUmaXltVUZnggolm2SpiCCm3QyhvfYsOPxyD3PnMmKjqzGD3xAqOUJ0I510Q5WJfs0b0t7y8Pz8ivNOOS3ksnDta8AM7nxSxQASWG_rAt4IGArLy1CV6nhV3uf/s1600/526420_328255120572503_100001640536402_946747_1909811911_n.jpg',
  photo_credit = 'Inês Santos, «Reanimar os Coretos em Portugal»',
  notes = coalesce(notes, '') || ' Fotografia de Inês Santos no inventário nacional (04/04/2012, reanimar-coretos-portugal.blogspot.com/2012/04/coreto-de-vila-nova-da-barquinha.html).',
  updated_at = now()
where id = 'coreto-jardim-ribeirinho' and photo_url is null;

-- ---------------------------------------------------------------------------
-- VI · A memória do Sardoal, o auditório de Torres Novas, e as notas do estudo
-- ---------------------------------------------------------------------------

update public.coretos set
  description = 'Não há vestígio de coreto fixo, mas há memória escrita: a imprensa regional de 1900–1920 fala do «coreto da música» nas festas do Espírito Santo e de um «vistoso coreto» erguido em frente ao palácio dos Mouras e Mendonças — coretos de festa, provavelmente palanques desmontáveis. A Filarmónica União Sardoalense, de 1862, é a mais antiga coletividade do concelho.',
  notes = coalesce(notes, '') || ' Estudo de 31/08/2026: memória histórica documentada (Sardoal com Memória — Memórias das Festas e FUS; Memórias Sardoalenses), sem vestígio de estrutura permanente. Em Andreus, «a música no coreto» nas festas da Senhora. Perguntar à Filarmónica e aos autores do «Sardoal com Memória» se alguma vez houve coreto fixo, e onde — se não houve, fecha-se a pergunta com a história em vez do vazio.',
  updated_at = now()
where id = 'coreto-sardoal';

update public.coretos set
  notes = coalesce(notes, '') || ' Estudo de 31/08/2026: o que os diretórios registam no jardim é o Auditório do Jardim das Rosas (Avenida Dr. João Martins de Azevedo), um pequeno auditório ao ar livre — nenhuma fonte fala de coreto, e é provável que a marca venha dessa confusão. Confirmar com a Câmara de Torres Novas; decidir então se esta entrada sai ou passa a auditório.',
  updated_at = now()
where id = 'coreto-jardim-municipal-torres-novas';

update public.coretos set
  notes = coalesce(notes, '') || ' Estudo de 31/08/2026: nenhuma fonte externa o documenta. ' ||
    case id
      when 'coreto-casais-de-revelhos' then 'A aldeia tem vida associativa forte (Sociedade Recreativa Pró-Casais de Revelhos e Rancho Folclórico, ambos na rua das coletividades) — uma mensagem à Sociedade Recreativa resolve: ou há coreto, ou o que se viu de cima é o palco da sede.'
      when 'coreto-carril' then 'Muita fonte sobre a tradição musical (a primeira orquestração de «A Portuguesa», 1890, Sociedade Filarmónica Carrilense), nenhuma sobre a estrutura. Perguntar à Junta de Freguesia de Dornes ou à Filarmónica Carrilense: existe, onde, e desde quando.'
      when 'coreto-ortiga-fatima' then 'O santuário tem romaria no primeiro domingo de julho, com refeição comunitária — contexto de coreto —, mas as fotografias do santuário no Wikimedia Commons não mostram nenhum e a marca veio de fotografia aérea. A Paróquia de Fátima, que gere o santuário, sabe se há coreto fixo ou palco de festa.'
      when 'coreto-freixianda-varzea-do-bispo' then 'Sem qualquer menção em diretórios, inventário ou imprensa. Perguntar à Junta da Freixianda, Ribeira do Fárrio e Formigais.'
      when 'coreto-brasoes' then 'Brasões é um lugar pequeno junto a Carregueiros e a marca é junto à capela; nenhuma fonte fala de coreto. Perguntar à Junta de Freguesia de Carregueiros.'
      when 'coreto-constancia' then 'Nem diretório, nem inventário, nem imprensa. A pergunta continua em aberto, sem nenhum fio por onde puxar — Câmara de Constância ou a Casa-Memória de Camões, que guarda a história local.'
    end,
  updated_at = now()
where id in ('coreto-casais-de-revelhos','coreto-carril','coreto-ortiga-fatima','coreto-freixianda-varzea-do-bispo','coreto-brasoes','coreto-constancia');

-- ---------------------------------------------------------------------------
-- VII · O registo de espaços: os confirmados com página própria
--
-- O estudo pede que os novos entrem «no registo de espaços do Coreto, com
-- página própria, como os outros». Os dois que já lá estavam a título
-- provisório (Espite, Zibreira) passam a ativos, com a descrição reescrita —
-- a que tinham dizia que não havia prova, e agora há.
-- ---------------------------------------------------------------------------

update public.venues set
  status = 'active',
  latitude = coalesce(latitude, 39.78363),
  longitude = coalesce(longitude, -8.64721),
  address = coalesce(address, 'Adro da Igreja de Espite'),
  image_url = coalesce(image_url, 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjl6Ad0vQM38qwU43CjjbztR1ZIzVFoDwGZpxqjULREvaa-EUlfcYR5wNPRyT-KE9XHAzH3JhE35sBPb7tsXjsNATVR22rk33TAIPX4mSzvpqQGy6wB7gLq03MzH1zQzuknCfLQ4Qq2xg0N/s1600/HPIM6453+-+Espite.JPG'),
  image_credit = coalesce(image_credit, 'José Matos, «Reanimar os Coretos em Portugal»'),
  description = 'No adro da igreja de Espite. O inventário nacional dos coretos fotografou-o em 2012, e os «Amigos de Ourém» recordam-no como «um dos coretos da coleção».',
  updated_at = now()
where id = 'coreto-espite';

update public.venues set
  status = 'active',
  latitude = coalesce(latitude, 39.48440),
  longitude = coalesce(longitude, -8.61100),
  image_url = coalesce(image_url, 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgN2BImzYMbDh5f6YMZRM4fm_WHWpt8HDQ5F5JtMLsJpp22WDSjJ4_spyD8fpc5E7Rs0GJa_h59LCdT2wxIfySizFZN8RnOp7ZXHWObjCY6tZ448V8A_tqhjlIs7Ai9Wj0U-jTtEih0qM4N/s1600/223319_211661502185598_3165549_n.jpg'),
  image_credit = coalesce(image_credit, 'José Matos, «Reanimar os Coretos em Portugal»'),
  description = 'Na Praça Engenheiro Luís Tavares Simão: colunas azuis, cobertura vermelha com beirado rendilhado, base branca com escadas. O palco das filarmónicas nos dias de festa.',
  updated_at = now()
where id = 'coreto-zibreira';

insert into public.venues (id, name, municipality_id, parish, kind, status, is_association, address, latitude, longitude, image_url, image_credit, description) values
  (
    'coreto-serra',
    'Coreto da Serra',
    'tomar',
    'União das freguesias de Serra e Junceira',
    'bandstand', 'active', false,
    'Adro, 2300-251 Serra',
    39.59986, -8.30132,
    'https://cms.infoportugal.info/media/fotos/final/Tomar/TOM9276.jpg',
    'InfoPortugal / All About Portugal',
    'Coreto alto, amarelo e branco, com um piso inferior fechado e o palco em cima, num largo de palmeiras e plátanos — o Adro da Serra.'
  ),
  (
    'coreto-paialvo',
    'Coreto de Paialvo',
    'tomar',
    'Paialvo',
    'bandstand', 'active', false,
    'Largo do Coreto, Paialvo',
    39.56279, -8.46735,
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjAaGxhSM0XEvH4LU85x_uWVDvrAQWebkK4DrkxHEidt_U4NQzVZXTGkTZ_lR6qNfSrADsKfreeRLAVT7_-2MNhUmPgSyOApNFMh-U3cefUOUSP6aFazK07GCAxJOr7WEj5RrkoBCwi35Ja/s1600/401309_356406734377740_100000252487830_1415013_850469434_n.jpg',
    'José Matos, «Reanimar os Coretos em Portugal»',
    'No Largo do Coreto — o largo tem o nome dele, que é a prova toponímica mais forte que se pode ter.'
  ),
  (
    'coreto-fatima',
    'Coreto de Fátima',
    'ourem',
    'Fátima',
    'bandstand', 'active', false,
    'Rua Padre Manuel António Henriques, frente à igreja paroquial',
    39.61756, -8.65230,
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgE4mj5guSDXkTnvjmtxssxyOwsiPP4O8XBMrsZhngsr5kGIaD-Bd2oB3IIdcL4uNjy62fIwHQ4phlrtEtkAEzXo6QrmjCwyeRb_h6ee5Mu8WJyBGhszbXFmnISkghJj2_8jvJxV16MUCf7/s1600/.+1634.jpg',
    'José Matos, «Reanimar os Coretos em Portugal»',
    'Na vila de Fátima, em frente à igreja paroquial — a dois quilómetros do santuário da Ortiga.'
  ),
  (
    'coreto-gondemaria',
    'Coreto de Gondemaria',
    'ourem',
    'União das freguesias de Gondemaria e Olival',
    'bandstand', 'active', false,
    'Largo Frei Luís de Sousa, Gondemaria',
    39.68756, -8.62213,
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh6VnyUztGlWjlkENDYU36xK5JQtfh2pBZT9FCAxcm_Hb2rGyPfJ4lfETUfXNyFVFL9JXcP-njExck07Dsq_OGDGdtdOn8iUDy4R6pKNW_z-aX25ApiQOqdsWHpeBwH1csgymk2A72LUMl5/s1600/12274694_1098236590188616_901520364182694011_n.jpg',
    'João Barbosa, «Reanimar os Coretos em Portugal»',
    'No Largo Frei Luís de Sousa, o largo principal da freguesia.'
  ),
  (
    'coreto-vilar-dos-prazeres',
    'Coreto de Vilar dos Prazeres',
    'ourem',
    'Nossa Senhora das Misericórdias',
    'bandstand', 'active', false,
    'Rua dos Castelos de Ourém, Vilar dos Prazeres',
    39.63056, -8.56964,
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgJQ3O98E1NhZZj_Fc7vdsbFbE7vvagFsLoHOkt4JQVVfuVf6VvknRtNb4ohlxnooXA3N3hGVk-BoijjTb_FQn8VM7CUNEF7JIHcjqTTcJkpDdemv9LXq_9SIJAGSVg1f2k64XGiF7WBtOI/s1600/396243_356423637709383_100000252487830_1415036_1188587723_n.jpg',
    'José Matos, «Reanimar os Coretos em Portugal»',
    'Coreto de aldeia na freguesia sede do concelho, na Rua dos Castelos de Ourém.'
  ),
  (
    'coreto-cercal',
    'Coreto do Cercal',
    'ourem',
    'União das freguesias de Matas e Cercal',
    'bandstand', 'active', false,
    'Rua Nossa Senhora do Rosário, Cercal',
    39.70768, -8.65931,
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgL1kbR3Cj0lQVlJYIAUkotbQ_SVhywO_zbN0CHit0SCM26Bz14_u5FLAmTztamBkk7cHyANzSF02lJlVz8A_0Dla0wPrKwZe-raDHNJOUXcH6JywWFYKbeNPNL6aCu80yL2OF-eMxmH6FZ/s1600/025.jpg',
    'José Matos, «Reanimar os Coretos em Portugal»',
    'Coreto de freguesia na Rua Nossa Senhora do Rosário.'
  )
on conflict (id) do nothing;

-- As ligações coreto → espaço, e os nomes como alias de si próprios — a mesma
-- regra do resto do catálogo: o que a recolha lê tem de casar com o que existe.

update public.coretos set venue_id = 'coreto-serra', updated_at = now()
  where id = 'coreto-serra-bugarrel' and venue_id is null;
update public.coretos set venue_id = id, updated_at = now()
  where id in ('coreto-paialvo','coreto-fatima','coreto-gondemaria','coreto-vilar-dos-prazeres','coreto-cercal')
    and venue_id is null;

insert into public.venue_aliases (alias, venue_id)
select public.normalize_for_hash(v.name), v.id
from public.venues v
where v.id in ('coreto-serra','coreto-paialvo','coreto-fatima','coreto-gondemaria','coreto-vilar-dos-prazeres','coreto-cercal')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- As asserções: o que esta migração promete
-- ---------------------------------------------------------------------------

do $$
declare
  total       integer;
  confirmados integer;
  duvidosos   integer;
  sem_credito integer;
  sem_geo     integer;
  soltos      integer;
begin
  select count(*),
         count(*) filter (where is_confirmed),
         count(*) filter (where not is_confirmed)
    into total, confirmados, duvidosos
  from public.coretos;

  if total <> 31 or confirmados <> 22 or duvidosos <> 9 then
    raise exception 'o levantamento devia ficar 31 = 22 confirmados + 9 por confirmar; está % = % + %', total, confirmados, duvidosos;
  end if;

  -- Uma fotografia sem crédito é uma fotografia mal usada.
  select count(*) into sem_credito
  from public.coretos
  where photo_url is not null and (photo_credit is null or photo_credit = '');

  if sem_credito <> 0 then
    raise exception '% fotografias de coreto sem crédito', sem_credito;
  end if;

  -- Todo o confirmado tem coordenadas: sem sítio no mapa não há confirmação.
  select count(*) into sem_geo
  from public.coretos
  where is_confirmed and (latitude is null or longitude is null);

  if sem_geo <> 0 then
    raise exception '% coretos confirmados sem coordenadas', sem_geo;
  end if;

  -- Cada venue_id aponta para um espaço que existe e é um coreto.
  select count(*) into soltos
  from public.coretos c
  left join public.venues v on v.id = c.venue_id
  where c.venue_id is not null and (v.id is null or v.kind <> 'bandstand')
    and c.id <> 'coreto-jardim-municipal-torres-novas';  -- aponta ao jardim, de propósito

  if soltos <> 0 then
    raise exception '% coretos apontam a espaços que não existem ou não são coretos', soltos;
  end if;

  raise notice 'levantamento: % coretos, % confirmados (% com fotografia), % por confirmar',
    total, confirmados,
    (select count(*) from public.coretos where is_confirmed and photo_url is not null),
    duvidosos;
end
$$;
