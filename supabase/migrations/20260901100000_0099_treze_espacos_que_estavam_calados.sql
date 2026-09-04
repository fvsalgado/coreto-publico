-- 0099 — Treze espaços que estavam calados.
--
-- São os únicos do catálogo que tinham caderneta de levantamento e não tinham
-- descrição: a ficha abria com o nome, a morada e nada que dissesse o que
-- aquilo é. Alguns são os maiores espaços da região — o Convento de Cristo, o
-- MIAA, o Cine-Teatro Paraíso.
--
-- O texto sai do que as respetivas `notes` já guardavam de público: a data de
-- inauguração, o que lá está, onde é. Fica de fora, como sempre, tudo o que é
-- proveniência («confirmado em cm-abrantes.pt a 30/08»), tudo o que é caminho
-- por andar («por confirmar», «perguntar à junta») e todo o estado que ninguém
-- verificou — o Cine-Teatro São Pedro de Abrantes leva a data de inauguração e
-- a obra em curso, e não leva um «está aberto» que nenhuma fonte sustenta; o
-- Rogério Venâncio leva a história e não leva a reabertura que o sítio da Casa
-- do Povo anuncia sem data.
--
-- São descrições curtas e de primeira demão, ao lado das que a 0050 e a 0069
-- escreveram com fonte primária. Ficam por melhorar; ficam melhores do que o
-- silêncio.
--
-- A guarda `where description is null` é a mesma da 0069, e pela mesma razão:
-- se entretanto alguém escrever uma descrição melhor, esta migração não a
-- pisa.

update public.venues as alvo
   set description = novo.description,
       updated_at = now()
  from (values
    ('biblioteca-municipal-sardoal',
     'Nasceu do espólio da Biblioteca Fixa n.º 176 da Fundação Calouste Gulbenkian, doado em 2002. Reabriu em 2025 no antigo Externato Rainha Santa Isabel, requalificado.'),
    ('castelo-de-almourol',
     'Monumento Nacional numa ilhota do Tejo, com visita por barco a partir do Cais de Almourol. O centro de interpretação, o CITA, fica em terra, no Centro Cultural da vila.'),
    ('centro-cultural-gil-vicente',
     'Inaugurado em 2004, com auditório de 200 lugares. O nome evoca a ligação de Gil Vicente ao Sardoal. Integra a Rede de Teatros e Cineteatros Portugueses desde 2021.'),
    ('cine-teatro-macao',
     'Cine-teatro municipal, no Largo dos Combatentes. Integra a Rede de Teatros e Cineteatros Portugueses.'),
    ('cine-teatro-paraiso',
     'Reinaugurado em 2002 e gerido pela Câmara Municipal de Tomar. «Infantaria 15» é o nome da rua, do Regimento de Infantaria n.º 15.'),
    ('cine-teatro-rogerio-venancio',
     'Inaugurado em 1952, com 277 lugares, propriedade da Casa do Povo de Minde. O nome homenageia Rogério Venâncio (1919-2018).'),
    ('cine-teatro-sao-pedro-abrantes',
     'Inaugurado em 1949, com projeto de Ruy Jervis d''Athouguia. Comprado pelo município em 2020 e em requalificação profunda desde 2023.'),
    ('cira-alcolobre',
     'Centro de interpretação instalado na antiga escola primária do Crucifixo.'),
    ('complexo-cultural-levada-tomar',
     'Conjunto patrimonial junto ao Nabão, com seis espaços: Fábrica das Artes, Fundição Tomarense, Centro Interpretativo Tomar Templário, Central Elétrica e as moagens A Nabantina e A Portuguesa.'),
    ('convento-de-cristo',
     'Património Mundial da UNESCO, sob tutela dos Museus e Monumentos de Portugal.'),
    ('miaa',
     'Museu Ibérico de Arqueologia e Arte, inaugurado em 2021 no antigo Convento de S. Domingos. Museu do Ano nos prémios APOM de 2023.'),
    ('museu-rios-artes-maritimas',
     'Museu dos Rios e das Artes Marítimas, em Constância.'),
    ('quartel-galeria-abrantes',
     'Galeria municipal de arte, num antigo quartel — o nome oficial faz o trocadilho «quARTel».')
  ) as novo(id, description)
 where alvo.id = novo.id
   and (alvo.description is null or btrim(alvo.description) = '');
