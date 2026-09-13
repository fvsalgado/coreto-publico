-- 0087 — A recolha de 31 de agosto, feita à mão porque a automática não corre.
--
-- A recolha noturna não corre desde 30 de agosto às 07:39: os executores do
-- GitHub Actions estão em baixo à conta, e os trabalhos morrem em três
-- segundos sem que lhes seja atribuída máquina. A agenda ficou parada.
--
-- Esta migração desfaz esse dia e meio. **As quarenta fontes foram lidas** —
-- pelos adaptadores verdadeiros, com o cliente HTTP da casa —, e as quarenta
-- responderam: 151 itens no total, contra 152 na última corrida verdadeira. O
-- que se segue é o que dessas leituras é novo.
--
-- ## O que foi lido, e o que entra
--
-- Dos 151 itens, 138 já estavam no catálogo pela chave da fonte. **Treze são
-- novos**, e três desses não entram:
--
--   · «Reunião Câmara» (Sardoal) — a exclusão `excludeTitles` da fonte já o
--     salta, e é a prova de que ela funciona;
--   · «ADIAMENTO DA 2.ª SEMANA DE CINEMA AO AR LIVRE» (Mação) — é o aviso de
--     um adiamento, não um evento; já tinha sido recusado a 30 de agosto;
--   · «Cinema setembro/ 2026» (Gil Vicente) — sem data nenhuma, iria para a
--     fila de moderação, que é onde o pipeline o poria.
--
-- Ficam **dez**. Não foram escritos à mão: passaram pelo `harmonizeEvent`
-- verdadeiro, com os alias de categoria e de espaço lidos da base, e o que
-- está aqui em baixo é o `EventRow` que ele devolveu — o mesmo id
-- determinístico, a mesma impressão digital, o mesmo `content_hash`. Quando os
-- executores voltarem, a recolha encontra-os pela chave da fonte e actualiza
-- em vez de duplicar.
--
-- ## Dois espaços de Tomar, e uma etiqueta
--
-- Ler os dez trouxe três coisas que faltavam ao catálogo, e as três entram
-- antes dos eventos porque é delas que os eventos dependem.
--
-- **A Casa Manuel Guimarães** é o segundo caso do dia em que um evento prova
-- um espaço: «Do olhar à pintura» dá-a como local, e ela não estava no
-- catálogo. É um departamento de cultura do município de Tomar, instalado
-- numa casa quinhentista da Rua Alexandre Herculano — a casa onde viveu João
-- de Castilho enquanto dirigia as obras do Convento de Cristo —, e o que lá
-- se faz são exposições temporárias. Coordenada do OSM, que a tem marcada
-- pelo nome.
--
-- **A etiqueta `infantojuvenil`**, de Tomar, não estava mapeada. A tabela já
-- mapeava `infanciaejuventude` para `infantil`; é a mesma palavra escrita de
-- outra maneira, e mapeá-la faz o «Clube de Fotografia — ATL de Verão»
-- classificar-se sozinho, agora e sempre. Fica no primeiro degrau do
-- classificador, a 0.95, que é onde as etiquetas da própria fonte pertencem.
--
-- Restam duas etiquetas por mapear, ambas de Ferreira do Zêzere e ambas
-- inúteis: «Outros Eventos» e `outros-eventos`. Não se mapeiam — «outros» não
-- é uma categoria, é a ausência de uma.
--
-- ## Seis que o classificador não alcança
--
-- Quatro dos dez classificam-se sozinhos pela etiqueta da fonte, a 0.95:
-- música, cinema, literatura e infantil. Os outros seis vão por leitura, com
-- a prova guardada no `note` do bloqueio, como na 0084:
--
--   · **«Festival Z — Luana do Bem e Tiago Almeida»** é stand-up: a sinopse
--     diz «o seu primeiro solo, Crente», de Luana do Bem, e que Tiago Almeida
--     «trocou o Direito pelo humor». Vai para `teatro` pela mesma regra que
--     pôs lá «O Primogénito» — é a única prateleira de espetáculo de palco, e
--     continua a ser uma escolha e não uma leitura.
--   · **«A Arte do Calafate»**, três vezes, e **«Sorrisos entre Letras»**,
--     duas. A junta de Constância publica uma entrada por data, e o catálogo
--     já tinha a primeira de cada. As sessões novas herdam a categoria e o
--     espaço da irmã que já lá está — é literalmente o mesmo evento noutro
--     dia, e dar-lhe outra resposta seria dar duas respostas à mesma pergunta.
--
-- O bloqueio serve para o mesmo de sempre: sem ele, o degrau da omissão por
-- tipo de espaço punha os dois «Sorrisos entre Letras» a 0.4 na primeira noite
-- em que a recolha voltasse a correr.

-- ------------------------- I. O que os eventos precisam ---------------------

insert into public.venues (
  id, name, municipality_id, parish, kind, address, postal_code,
  latitude, longitude, website_url, description, notes
) values (
  'casa-manuel-guimaraes',
  'Casa Manuel Guimarães',
  'tomar',
  'Tomar (São João Baptista) e Santa Maria dos Olivais',
  'gallery',
  'Rua Alexandre Herculano',
  '2300-592',
  39.604272,
  -8.414944,
  'https://www.cm-tomar.pt/',
  'Casa quinhentista da Rua Alexandre Herculano, onde viveu João de Castilho '
  'enquanto dirigia as obras do Convento de Cristo. Hoje é espaço de '
  'exposições do município, com mostras temporárias de artistas da região e '
  'de fora dela.',
  'Levantamento 2026-08-31: entrou pelo evento «Do olhar à pintura», da '
  'recolha de 4 de setembro, que a agenda municipal dá com o local «Casa '
  'Manuel Guimarães» e que não casava com o catálogo. Coordenada do OSM, que '
  'tem o edifício marcado pelo nome (39.604272,-8.414944, Rua Alexandre '
  'Herculano, 2300-592). Classificada como galeria e não museu: o que lá '
  'acontece são exposições temporárias, não uma coleção permanente. Falta '
  'endereço próprio — o município não lhe dá página, e a ficha fica com a do '
  'município.'
)
on conflict (id) do nothing;

insert into public.venue_aliases (alias, venue_id, municipality_id) values
  (public.normalize_for_hash('Casa Manuel Guimarães'), 'casa-manuel-guimaraes', 'tomar')
on conflict do nothing;

-- «Infantojuvenil» é a mesma palavra que «infância e juventude», que já estava
-- mapeada. Sem esta linha, o ATL de Verão de Tomar nascia sem categoria.
insert into public.category_aliases (alias, category_slug) values
  ('infantojuvenil', 'infantil')
on conflict (alias) do nothing;

-- ------------------------------ II. Os dez -----------------------------------

insert into public.events (
  id, slug, title, title_raw, subtitle, description, description_short, municipality_id, venue_id, location_name, location_address, parish, latitude, longitude, how_to_arrive, series_id, category_slug, category_confidence, categories_raw, tags, audience, min_age, date_start, date_end, is_ongoing, duration_minutes, is_free, price_min, price_max, price_display, price_raw, ticketing_url, wheelchair_accessible, has_sign_language, has_audio_description, has_subtitles, is_relaxed_performance, accessibility_notes, image_url, image_credit, image_alt, status, origin, confidence, source_id, source_key, source_url, fingerprint, content_hash, published_at, last_seen_at
) values
  ('b8ef6451-33cf-4ae5-a037-8b5ce32d5dad', 'luis-trigacheiro-tour-ela-b8ef64', 'Luís Trigacheiro – Tour ELA', null, null, '24 outubro| Cineteatro São João
O Cineteatro São João recebe no dia 24 de outubro, sábado, pelas 21h30m, o cantor Luís Trigacheiro – Tour ELA.
Luís Trigacheiro continua a trilhar um caminho de autenticidade e, o seu segundo álbum, é mais um passo firme na sua carreira, mostrando a sua voz ímpar, a sua capacidade interpretativa única e a capacidade de comunicar profundamente com o público.
"Ela" foi produzido por Luisa Sobral e reflete a profundidade artística do cantor alentejano, com um conjunto de canções maravilhosas em parceria com alguns dos nomes mais importantes da música portuguesa.
Ao vivo, Luís Trigacheiro apresenta-se com a sua habitual banda: Bernardo Viana na viola e direção musical, João Ferreira na bateria e percussões, Diogo Costa no baixo e Pedro Viana na guitarra portuguesa.
Bilhetes a 20€, à venda no Posto de Turismo, Piscvinas Municipais, Serviço de Águas da Câmara Municipal, em www.bol.pt, Worten, Fnac, CTT e na bilheteira do Cineteatro São João no dia do espetáculo uma hora antes (caso não esgotem anteriormente).', '24 outubro| Cineteatro São João
O Cineteatro São João recebe no dia 24 de outubro, sábado, pelas 21h30m, o cantor Luís Trigacheiro – Tour ELA.
Luís Trigacheiro continua a trilhar um caminho de autenticidade e, o seu segundo álbum, é mais um passo firme na sua carreira, mostrando a sua voz ímpar, a sua capacidade interpretativa única e a capacidade de comunicar profundamente com o público.
"Ela"…', 'entroncamento', null, 'Entroncamento', null, null, null, null, null, null, 'musica', 0.95, array['musica'], '{}', null, null, '2026-10-24', '2026-10-24', false, null, false, 20, 20, '20 €', '€20.00', null, null, false, false, false, false, null, 'https://www.cm-entroncamento.pt/images/com_eventbooking/Agenda_Cultural/2026/3_trimestre/icon_luis_trigacheiro_830x_257.jpg', null, 'Luís Trigacheiro – Tour ELA', 'published', 'scraper', 0.85, 'cm-entroncamento', 'eb-252', 'https://www.cm-entroncamento.pt/index.php/agenda/musica/luis-trigacheiro-tour-ela', '8066e1a3dd0b5cba4400ee2d4a03e5a4adc9a6d72ebcd82061951f58786b4e0d', '4bde36e60d849e528f33496577ba059cb53c446f3e7183c04ae110824027590a', '2026-08-31T16:30:00.000Z', '2026-08-31T16:30:00.000Z'),
  ('b9d26bf0-eb18-4d53-9a5a-063710811afb', 'festival-z-luana-do-bem-e-tiago-almeida-b9d26b', 'Festival Z - Luana do Bem e Tiago Almeida', null, null, 'No dia 19 de setembro, Luana do Bem e Tiago Almeida encontram-se no Centro Cultural
Alfredo Keil em Ferreira do Zêzere, pelas 21h30, para a última noite desta edição do Festival Z.
Luana do Bem chega depois de uma digressão com mais de 40 salas esgotadas com o seu
primeiro solo, Crente. Tiago Almeida trocou o Direito pelo humor e tem vindo a construir o
seu caminho entre palcos, podcasts e diferentes formatos de comédia.
Entrada Gratuita* com reserva ou levantamento obrigatório. Bilhetes disponíveis a partir
de 1 de setembro.
Sujeito à lotação da sala. * Levantamento do bilhete no Posto de Turismo de Ferreira do
Zêzere (todos os dias, das 10h00 às 13h00 e das 14h00 às 18h00). Reservas feitas por telefone,
através do 916 796 409 (todos os dias, das 10h00 às 13h00 e das 14h00 às 18h00).
Os bilhetes reservados ficam disponíveis para levantamento no local do espetáculo até 30
minutos antes do seu início. Os bilhetes remanescentes ficarão disponíveis para levantamento,
30 minutos antes do início do espetáculo. Limite de 2 bilhetes por pessoa, mediante
apresentação do Cartão de Cidadão no ato do levantamento. Espetáculo para M/16 anos', 'No dia 19 de setembro, Luana do Bem e Tiago Almeida encontram-se no Centro Cultural
Alfredo Keil em Ferreira do Zêzere, pelas 21h30, para a última noite desta edição do Festival Z.
Luana do Bem chega depois de uma digressão com mais de 40 salas esgotadas com o seu
primeiro solo, Crente. Tiago Almeida trocou o Direito pelo humor e tem vindo a construir o
seu caminho entre palcos, podcasts e…', 'ferreira-do-zezere', 'centro-cultural-alfredo-keil', null, null, null, null, null, null, null, null, null, array['Outros Eventos','outros-eventos'], '{}', 'all_ages', 16, '2026-09-19', '2026-09-19', false, 600, true, 0, null, 'Entrada livre', null, null, null, false, false, false, false, null, null, null, null, 'published', 'scraper', 0.85, 'cm-ferreiradozezere', 'eb-490', 'https://cm-ferreiradozezere.pt/comunicacao/agenda/outros-eventos/490-festival-z-luana-do-bem-e-tiago-almeida', '34dbc2580337acb869f0c06ff2671a68282b42d4872be846fcbbdcd1550e7ca3', 'f6a2f1606d601c55e3e6d1f4624f33f79f0022face5fec0b02bd4479ae16a1af', '2026-08-31T16:30:00.000Z', '2026-08-31T16:30:00.000Z'),
  ('c6a10ca6-4201-4fdb-86c9-03c847359588', 'clube-de-fotografia-atl-de-verao-c6a10c', 'Clube de Fotografia - ATL de Verão', null, null, '1 a 4 Setembro, 10h00 – 12h00 e 14h30 – 17h00
Descobrir o mundo da fotografia através da animação em stop-motion. Durante quatro dias, em parceria com a Mini Kinos, os participantes vão aprender a criar uma história baseada na exposição RAMOT - António Costa Cabral, patente no CEFT, explorando a fotografia, a animação e a criatividade de uma forma divertida e prática.
Inscrições gratuitas até 31 de agosto para Este endereço de email está protegido contra piratas. Necessita ativar o JavaScript para o visualizar.
Vagas limitadas a 12 participantes
Público alvo: 10 a 14 anos
Organização: Centro de Estudos em Fotografia de Tomar
Mais Informações', '1 a 4 Setembro, 10h00 – 12h00 e 14h30 – 17h00
Descobrir o mundo da fotografia através da animação em stop-motion. Durante quatro dias, em parceria com a Mini Kinos, os participantes vão aprender a criar uma história baseada na exposição RAMOT - António Costa Cabral, patente no CEFT, explorando a fotografia, a animação e a criatividade de uma forma divertida e prática.
Inscrições gratuitas até 31…', 'tomar', 'ceft-casa-dos-cubos', null, null, null, null, null, null, null, 'infantil', 0.95, array['infantojuvenil'], '{}', null, null, '2026-09-01', '2026-09-04', false, 600, true, 0, null, 'Entrada livre', null, null, null, false, false, false, false, null, 'https://www.cm-tomar.pt/images/com_eventbooking/anexo_1_blur.jpg', null, 'Clube de Fotografia - ATL de Verão', 'published', 'scraper', 0.95, 'cm-tomar', 'eb-2481', 'https://www.cm-tomar.pt/comunicacao/agenda/infantojuvenil/clube-de-fotografia-atl-de-verao', 'a333c1809d037c302e619c7a3d8021329310b429b2e4251a1e2ecb0532479cad', 'cb86a7dbf8516b4078e09736aff0c3b18fbbc6588d55c4fb43062566f134615e', '2026-08-31T16:30:00.000Z', '2026-08-31T16:30:00.000Z'),
  ('71ab7be8-5fc5-445e-b3c3-5c4f0472e038', 'broken-english-71ab7b', 'Broken English', null, null, 'Exibição de "Broken English", de Jane Pollard e Iain Forsyth, último filme previsto para o ciclo de Sessões de Cinema ao Ar Livre, que foi adiado devido ao mau tempo.
M/14
Entradas: 4 € (normal), 2 € (sócios, maiores 65 e menores 12 anos)
Organização: Plano Extraordinário - Cineclube de Tomar
Mais Informações
Data
02/09/2026 21:30
Local do Evento
Cine-Teatro Paraíso
Município
Tomar
VOLTAR ATRÁS', 'Exibição de "Broken English", de Jane Pollard e Iain Forsyth, último filme previsto para o ciclo de Sessões de Cinema ao Ar Livre, que foi adiado devido ao mau tempo.
M/14
Entradas: 4 € (normal), 2 € (sócios, maiores 65 e menores 12 anos)
Organização: Plano Extraordinário - Cineclube de Tomar
Mais Informações
Data
02/09/2026 21:30
Local do Evento
Cine-Teatro Paraíso
Município
Tomar
VOLTAR ATRÁS', 'tomar', 'cine-teatro-paraiso', null, null, null, null, null, null, null, 'cinema', 0.95, array['cinema'], '{}', null, 14, '2026-09-02', '2026-09-02', false, null, false, 2, 4, '2 € – 4 €', null, null, null, false, false, false, false, null, 'https://www.cm-tomar.pt/images/com_eventbooking/Broken_English.png', null, 'Broken English', 'published', 'scraper', 1, 'cm-tomar', 'eb-2455', 'https://www.cm-tomar.pt/comunicacao/agenda/cinema/broken-english', '51d0b1388ade2b31bdc21bf1d536a276a999ed4a7c339bb860b3ead1ee0ee7c2', '7f08f69140a3949249d7676b1d93bafcf013fbe621d73bd68dfecaea80e751d8', '2026-08-31T16:30:00.000Z', '2026-08-31T16:30:00.000Z'),
  ('a392cb44-10cd-4fa1-8b5c-1dc4d3305df5', 'do-olhar-a-pintura-a392cb', 'Do olhar à pintura', null, null, 'Exposição de alunos do atelier de pintura de Sílvia Marieta, reúne trabalhos desenvolvidos nas aulas do Núcleo 3 da Fábrica das Artes. As aulas iniciaram-se em 2024, tendo como público-alvo adultos e, mais recentemente, idades mais jovens, com vários níveis de experiência e provenientes de diferentes áreas profissionais, tendo como mote a paixão pela arte.
Inauguração: 4 setembro, 18h00
Patente até 27 setembro
Horários: quarta a sexta 14h – 18h, sábado e domingo 10h – 13h e 14h – 18h
Organização: Município de Tomar
Evento
Data
Do olhar à pintura
04/09/2026
Do olhar à pintura
05/09/2026
Do olhar à pintura
06/09/2026
Do olhar à pintura
07/09/2026
Do olhar à pintura
08/09/2026
Do olhar à pintura
09/09/2026
Do olhar à pintura
10/09/2026
Do olhar à pintura
11/09/2026
Do olhar à pintura
12/09/2026
Do olhar à pintura
13/09/2026
Do olhar à pintura
14/09/2026
Do olhar à pintura
15/09/2026
Do olhar à pintura
16/09/2026
Do olhar à pintura
17/09/2026
Do olhar à pintura
18/09/2026
Do olhar à pintura
19/09/2026
Do olhar à pintura
20/09/2026
Do olhar à pintura
21/09/2026
Do olhar à pintura
22/09/2026
Do olhar à pintura
23/09/2026
Do olhar à pintura
24/09/2026
Do olhar à pintura
25/09/2026
Do olhar à pintura
26/09/2026
Do olhar à pintura
27/09/2026
VOLTAR ATRÁS', 'Exposição de alunos do atelier de pintura de Sílvia Marieta, reúne trabalhos desenvolvidos nas aulas do Núcleo 3 da Fábrica das Artes. As aulas iniciaram-se em 2024, tendo como público-alvo adultos e, mais recentemente, idades mais jovens, com vários níveis de experiência e provenientes de diferentes áreas profissionais, tendo como mote a paixão pela arte.
Inauguração: 4 setembro, 18h00
Patente…', 'tomar', 'casa-manuel-guimaraes', null, null, null, null, null, null, null, 'literatura', 0.95, array['eventos-literarios'], '{}', null, null, '2026-09-04', '2026-09-04', false, 600, false, null, null, null, null, null, null, false, false, false, false, null, 'https://www.cm-tomar.pt/images/com_eventbooking/Do_Olhar_%C3%A0_Pintura_-_4_set.jpg', null, 'Do olhar à pintura', 'published', 'scraper', 0.95, 'cm-tomar', 'eb-2457', 'https://www.cm-tomar.pt/comunicacao/agenda/eventos-literarios/do-olhar-a-pintura', 'be8ca8f025f194d4f91590e7dece633e0ed48ef525a6c6f1128a6143ca891ad1', '8dab9eb9ffb91481688fde5b4250ac9127826815bb154ada70a256dc0c4232a7', '2026-08-31T16:30:00.000Z', '2026-08-31T16:30:00.000Z'),
  ('c2bbe397-284d-4bf6-b688-2434162d27d3', 'a-arte-do-calafate-c2bbe3', 'A Arte do Calafate', null, null, ', o ensinamento da construção e reparação naval, nos dias 3, 10, 17 e 24 de Setembro, das 9h00 às 11h00, no Estaleiro do Rio Tejo, com Sérgio Silva.

Participação gratuita, mas com inscrição obrigatória no Museu dos Rios e Artes Marítimas.', ', o ensinamento da construção e reparação naval, nos dias 3, 10, 17 e 24 de Setembro, das 9h00 às 11h00, no Estaleiro do Rio Tejo, com Sérgio Silva.

Participação gratuita, mas com inscrição obrigatória no Museu dos Rios e Artes Marítimas.', 'constancia', null, 'Constância', null, 'Constância', null, null, null, null, null, null, '{}', '{}', null, null, '2026-09-10', '2026-09-10', false, 540, true, 0, null, 'Entrada livre', null, null, null, false, false, false, false, null, 'https://www.jf-constancia.pt/images/freguesia/eventos/39/imagem_39.jpg', null, 'A Arte do Calafate', 'published', 'scraper', 0.75, 'jf-constancia', 'evento-39', 'https://www.jf-constancia.pt/freguesia/agenda/10-09-2026/39-a_arte_do_calafate', '5274d585781e1224c508b5a002c2a09ac9a075148d02feae5a508597cc121bea', '2674a1f2e2c70f059f282603e36fdf57707474ed40740c0c1562201741877149', '2026-08-31T16:30:00.000Z', '2026-08-31T16:30:00.000Z'),
  ('f5462fe2-e5bc-4233-b9db-6735581c3e88', 'sorrisos-entre-letras-f5462f', 'Sorrisos entre Letras', null, null, ', às 14h00, na Sala Polivalente da Biblioteca Municipal Alexandre O''Neill.', ', às 14h00, na Sala Polivalente da Biblioteca Municipal Alexandre O''Neill.', 'constancia', null, 'Constância', null, 'Constância', null, null, null, null, null, null, '{}', '{}', null, null, '2026-09-15', '2026-09-15', false, null, false, null, null, null, null, null, null, false, false, false, false, null, 'https://www.jf-constancia.pt/images/freguesia/eventos/35/imagem_35.jpg', null, 'Sorrisos entre Letras', 'published', 'scraper', 0.65, 'jf-constancia', 'evento-35', 'https://www.jf-constancia.pt/freguesia/agenda/15-09-2026/35-sorrisos_entre_letras', '062440e3ebc7e47a222043e12d2c6d12091c3ab7131023159aa7b7e3ca78c61a', 'eec03a7db67aa26257ee63270f8c2b542eb5d134fbffb3926a3325077bb18c70', '2026-08-31T16:30:00.000Z', '2026-08-31T16:30:00.000Z'),
  ('64d95d7d-5c43-4914-a4c6-57d253c9c468', 'a-arte-do-calafate-64d95d', 'A Arte do Calafate', null, null, ', o ensinamento da construção e reparação naval, nos dias 3, 10, 17 e 24 de Setembro, das 9h00 às 11h00, no Estaleiro do Rio Tejo, com Sérgio Silva.

Participação gratuita, mas com inscrição obrigatória no Museu dos Rios e Artes Marítimas.', ', o ensinamento da construção e reparação naval, nos dias 3, 10, 17 e 24 de Setembro, das 9h00 às 11h00, no Estaleiro do Rio Tejo, com Sérgio Silva.

Participação gratuita, mas com inscrição obrigatória no Museu dos Rios e Artes Marítimas.', 'constancia', null, 'Constância', null, 'Constância', null, null, null, null, null, null, '{}', '{}', null, null, '2026-09-17', '2026-09-17', false, 540, true, 0, null, 'Entrada livre', null, null, null, false, false, false, false, null, 'https://www.jf-constancia.pt/images/freguesia/eventos/40/imagem_40.jpg', null, 'A Arte do Calafate', 'published', 'scraper', 0.75, 'jf-constancia', 'evento-40', 'https://www.jf-constancia.pt/freguesia/agenda/17-09-2026/40-a_arte_do_calafate', 'b47e5143746ba2ec774c799ba537f7e788a5919090cb70ced238078b6683db2b', '321e3e4ed293afb0d2c9ea6bbd0cc3c765009a78c3521d31cf1821ccda86929d', '2026-08-31T16:30:00.000Z', '2026-08-31T16:30:00.000Z'),
  ('6b9345e9-27df-43ac-bffa-e88a215774d7', 'a-arte-do-calafate-6b9345', 'A Arte do Calafate', null, null, ', o ensinamento da construção e reparação naval, nos dias 3, 10, 17 e 24 de Setembro, das 9h00 às 11h00, no Estaleiro do Rio Tejo, com Sérgio Silva.

Participação gratuita, mas com inscrição obrigatória no Museu dos Rios e Artes Marítimas.', ', o ensinamento da construção e reparação naval, nos dias 3, 10, 17 e 24 de Setembro, das 9h00 às 11h00, no Estaleiro do Rio Tejo, com Sérgio Silva.

Participação gratuita, mas com inscrição obrigatória no Museu dos Rios e Artes Marítimas.', 'constancia', null, 'Constância', null, 'Constância', null, null, null, null, null, null, '{}', '{}', null, null, '2026-09-24', '2026-09-24', false, 540, true, 0, null, 'Entrada livre', null, null, null, false, false, false, false, null, 'https://www.jf-constancia.pt/images/freguesia/eventos/41/imagem_41.jpg', null, 'A Arte do Calafate', 'published', 'scraper', 0.75, 'jf-constancia', 'evento-41', 'https://www.jf-constancia.pt/freguesia/agenda/24-09-2026/41-a_arte_do_calafate', 'fbc959071ba0451a1f3305a1b6d4c00cdf222934b7ef977401937712d65b63a6', '03ea5de8868210c674159d758c2b6dd13da0178842b772203c4af09ddd6cf60a', '2026-08-31T16:30:00.000Z', '2026-08-31T16:30:00.000Z'),
  ('42960db8-e781-4150-9f51-73f211556fa7', 'sorrisos-entre-letras-42960d', 'Sorrisos entre Letras', null, null, ', às 14h00, na Sala Polivalente da Biblioteca Municipal Alexandre O''Neill.', ', às 14h00, na Sala Polivalente da Biblioteca Municipal Alexandre O''Neill.', 'constancia', null, 'Constância', null, 'Constância', null, null, null, null, null, null, '{}', '{}', null, null, '2026-09-29', '2026-09-29', false, null, false, null, null, null, null, null, null, false, false, false, false, null, 'https://www.jf-constancia.pt/images/freguesia/eventos/36/imagem_36.jpg', null, 'Sorrisos entre Letras', 'published', 'scraper', 0.65, 'jf-constancia', 'evento-36', 'https://www.jf-constancia.pt/freguesia/agenda/29-09-2026/36-sorrisos_entre_letras', 'a77a163f14efd0214facc2e16d5c1a46bd77c12fc4b4eccfe417983c5330b09a', 'f029a9931e19385d42e046714aef5e6a1c3342b586c8d434a63f23609abb159c', '2026-08-31T16:30:00.000Z', '2026-08-31T16:30:00.000Z')
on conflict (id) do nothing;

insert into public.event_sessions (
  event_id, session_date, start_time, end_time, venue_id, location_override, is_cancelled, notes
) values
  ('b8ef6451-33cf-4ae5-a037-8b5ce32d5dad', '2026-10-24', '21:30', null, null, null, false, null),
  ('b9d26bf0-eb18-4d53-9a5a-063710811afb', '2026-09-19', '21:30', null, null, null, false, null),
  ('c6a10ca6-4201-4fdb-86c9-03c847359588', '2026-09-01', null, null, null, null, false, null),
  ('c6a10ca6-4201-4fdb-86c9-03c847359588', '2026-09-04', null, null, null, null, false, null),
  ('71ab7be8-5fc5-445e-b3c3-5c4f0472e038', '2026-09-02', '21:30', null, null, null, false, null),
  ('a392cb44-10cd-4fa1-8b5c-1dc4d3305df5', '2026-09-04', null, null, null, null, false, null),
  ('c2bbe397-284d-4bf6-b688-2434162d27d3', '2026-09-10', '09:00', '11:00', null, null, false, null),
  ('f5462fe2-e5bc-4233-b9db-6735581c3e88', '2026-09-15', null, null, null, null, false, null),
  ('64d95d7d-5c43-4914-a4c6-57d253c9c468', '2026-09-17', '09:00', '11:00', null, null, false, null),
  ('6b9345e9-27df-43ac-bffa-e88a215774d7', '2026-09-24', '09:00', '11:00', null, null, false, null),
  ('42960db8-e781-4150-9f51-73f211556fa7', '2026-09-29', null, null, null, null, false, null);

-- ------------------- III. Os seis que a leitura decidiu ----------------------

update public.events e set
  category_slug = d.slug,
  category_confidence = 1,
  venue_id = coalesce(d.espaco, e.venue_id),
  updated_at = now()
from (values
  ('cm-ferreiradozezere', 'eb-490',     'teatro',     null),
  ('jf-constancia',       'evento-39',  'formacao',   null),
  ('jf-constancia',       'evento-40',  'formacao',   null),
  ('jf-constancia',       'evento-41',  'formacao',   null),
  ('jf-constancia',       'evento-35',  'literatura', 'biblioteca-municipal-constancia'),
  ('jf-constancia',       'evento-36',  'literatura', 'biblioteca-municipal-constancia')
) as d(fonte, chave, slug, espaco)
where e.source_id = d.fonte and e.source_key = d.chave and e.category_slug is null;

insert into public.manual_overrides (event_id, field, value, actor, note)
select e.id, 'category_slug', to_jsonb(e.category_slug),
       'recolha à mão 2026-08-31', d.prova
from public.events e
join (values
  ('cm-ferreiradozezere', 'eb-490',
   'Stand-up comedy: a sinopse dá «o seu primeiro solo, Crente» a Luana do Bem e diz que Tiago Almeida '
   '«trocou o Direito pelo humor». Mesma regra que «O Primogénito» — teatro é a única prateleira de '
   'espetáculo de palco, e é escolha e não leitura.'),
  ('jf-constancia', 'evento-39',
   'Outra sessão de «A Arte do Calafate», que a junta publica uma por data. Herda a categoria da sessão '
   'de 3 de setembro, já no catálogo: «o ensinamento da construção e reparação naval», com inscrição.'),
  ('jf-constancia', 'evento-40',
   'Outra sessão de «A Arte do Calafate», que a junta publica uma por data. Herda a categoria da sessão '
   'de 3 de setembro, já no catálogo: «o ensinamento da construção e reparação naval», com inscrição.'),
  ('jf-constancia', 'evento-41',
   'Outra sessão de «A Arte do Calafate», que a junta publica uma por data. Herda a categoria da sessão '
   'de 3 de setembro, já no catálogo: «o ensinamento da construção e reparação naval», com inscrição.'),
  ('jf-constancia', 'evento-35',
   'Outra sessão de «Sorrisos entre Letras», na Sala Polivalente da Biblioteca Municipal Alexandre '
   'O''Neill. Herda a categoria e o espaço da sessão de 1 de setembro, já no catálogo. Sem o bloqueio, a '
   'omissão por tipo de espaço (biblioteca) reescrevia-a a 0.4.'),
  ('jf-constancia', 'evento-36',
   'Outra sessão de «Sorrisos entre Letras», na Sala Polivalente da Biblioteca Municipal Alexandre '
   'O''Neill. Herda a categoria e o espaço da sessão de 1 de setembro, já no catálogo. Sem o bloqueio, a '
   'omissão por tipo de espaço (biblioteca) reescrevia-a a 0.4.')
) as d(fonte, chave, prova) on e.source_id = d.fonte and e.source_key = d.chave
where e.category_slug is not null
on conflict (event_id, field) do nothing;

-- --------- III.b — Duas que a leitura corrigiu ao próprio classificador -----
--
-- **«Do olhar à pintura» não é literatura.** É «uma exposição de alunos do
-- atelier de pintura de Sílvia Marieta», e o classificador pô-la em
-- `literatura` a 0.95 porque a agenda de Tomar a publica no caminho
-- `/eventos-literarios/`. Essa etiqueta é o segmento do endereço, não uma
-- afirmação sobre o evento — e em Tomar já falhou duas vezes em duas: a outra
-- é o «Sons na Adega®», que é uma roda de samba e teve de ser corrigido à mão
-- na 0084. Fica escrito, com dois casos em dois, para quem decidir se o alias
-- `eventosliterarios` vale a pena. Aqui corrige-se o evento, não a regra.
--
-- **E não acaba a 4 de setembro.** A descrição diz «Patente até 27 setembro»
-- e lista as vinte e quatro datas uma a uma; o adaptador só trouxe a
-- primeira, porque é a que a listagem dá. Sem isto, a agenda mostrava uma
-- exposição de três semanas como se fosse uma tarde. O `date_end` fica
-- trancado, que a próxima recolha traz outra vez o dia único.

update public.events set
  category_slug = 'exposicoes',
  category_confidence = 1,
  date_end = '2026-09-27',
  updated_at = now()
where source_id = 'cm-tomar' and source_key = 'eb-2457';

-- O Festival Z é M/16, e é o que a descrição diz à letra: «Espetáculo para
-- M/16 anos». O `all_ages` que ali estava veio de um «todos os dias» no meio
-- das instruções de levantamento do bilhete — o defeito que a 0088 corrige na
-- regra. Aqui fica o valor certo neste evento.
update public.events set audience = 'adults', updated_at = now()
where source_id = 'cm-ferreiradozezere' and source_key = 'eb-490';

insert into public.manual_overrides (event_id, field, value, actor, note)
select e.id, campo.nome,
       case campo.nome when 'category_slug' then to_jsonb(e.category_slug)
                       else to_jsonb(e.date_end) end,
       'recolha à mão 2026-08-31',
       case campo.nome
         when 'category_slug' then
           'É uma exposição de pintura, e a etiqueta «eventos-literarios» é o segmento do endereço '
           'na agenda de Tomar, não uma afirmação sobre o evento. Em Tomar já falhou em dois de dois '
           '— o outro é o «Sons na Adega®», uma roda de samba.'
         else
           'A descrição diz «Patente até 27 setembro» e lista as 24 datas. O adaptador só traz a '
           'primeira, porque é a que a listagem dá; sem este bloqueio a recolha voltava a encurtar '
           'a exposição a um dia.'
       end
from public.events e
cross join (values ('category_slug'), ('date_end')) as campo(nome)
where e.source_id = 'cm-tomar' and e.source_key = 'eb-2457'
on conflict (event_id, field) do nothing;

update public.events e set has_manual_overrides = true
where exists (select 1 from public.manual_overrides o where o.event_id = e.id)
  and not e.has_manual_overrides;

-- ---------------------------------------------------------------------------
do $$
declare
  sem_categoria integer;
  quais         text;
  sem_sessao    integer;
  espaco        integer;
begin
  -- Postcondições sobre estas linhas, e não contagens do dia: numa base vazia
  -- passam em silêncio, que é o que têm de fazer.
  select count(*), string_agg(title, ' · ' order by title) into sem_categoria, quais
  from public.events
  where source_id in ('cm-entroncamento','cm-ferreiradozezere','cm-tomar','jf-constancia')
    and source_key in ('eb-252','eb-490','eb-2455','eb-2457','eb-2481',
                       'evento-35','evento-36','evento-39','evento-40','evento-41')
    and category_slug is null;

  if sem_categoria > 0 then
    raise exception '% dos eventos desta recolha ficaram sem categoria: %', sem_categoria, quais;
  end if;

  -- Um evento sem sessão não aparece em lado nenhum que leia por dia.
  select count(*) into sem_sessao
  from public.events e
  where e.source_key in ('eb-252','eb-490','eb-2455','eb-2457','eb-2481',
                         'evento-35','evento-36','evento-39','evento-40','evento-41')
    and e.source_id in ('cm-entroncamento','cm-ferreiradozezere','cm-tomar','jf-constancia')
    and not exists (select 1 from public.event_sessions s where s.event_id = e.id);

  if sem_sessao > 0 then
    raise exception '% eventos desta recolha ficaram sem sessão', sem_sessao;
  end if;

  -- O espaço que o evento provou existir tem de ficar ligado a ele.
  select count(*) into espaco
  from public.events
  where source_id = 'cm-tomar' and source_key = 'eb-2457'
    and venue_id = 'casa-manuel-guimaraes';

  if espaco <> (select count(*) from public.events where source_id='cm-tomar' and source_key='eb-2457') then
    raise exception '«Do olhar à pintura» não ficou na Casa Manuel Guimarães';
  end if;

  -- A exposição de pintura não pode voltar a ser literatura por distração.
  if exists (select 1 from public.events
              where source_id='cm-tomar' and source_key='eb-2457'
                and (category_slug <> 'exposicoes' or date_end <> date '2026-09-27')) then
    raise exception '«Do olhar à pintura» não ficou como exposição até 27 de setembro';
  end if;

  raise notice 'recolha de 31/08 aplicada à mão';
end
$$;
