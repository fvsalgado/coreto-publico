-- 0096 — Quatro espaços de Tomar que faltavam, e cinco nomes que passam a
-- resolver.
--
-- ## O levantamento
--
-- O Roteiro Museológico de Tomar (`museus.cm-tomar.pt`) lista **dezasseis**
-- espaços museológicos do município. O catálogo tinha quatro: o Museu dos
-- Fósforos, a Sinagoga, o CEFT e o Complexo Cultural da Levada.
--
-- Dos doze que faltavam:
--
--   · **Três são igrejas e uma é capela** — Santa Maria do Olival, São João
--     Batista, Capela de Santa Iria. Não entram: a 0083 tirou os espaços
--     religiosos do catálogo e essa decisão mantém-se.
--   · **Cinco são núcleos dentro da Levada** — a Fundição Tomarense, a
--     Central Elétrica, as moagens A Portuguesa e A Nabantina, e o Centro
--     Interpretativo Tomar Templários. Partilham morada (Rua Carlos Everard),
--     telefone e email com o complexo, e a descrição da ficha da Levada já os
--     nomeia aos seis. Não são fichas novas: são **alias**, para que um evento
--     que diga «Fundição Tomarense» caia na Levada em vez de ir para a fila
--     dos espaços por resolver. É o que a casa já fazia com a Sala Multiusos
--     e com o NAC.2.
--   · **Quatro são espaços a sério e entram aqui.**
--
-- ## Os quatro
--
--   · **NAC — Núcleo de Arte Contemporânea.** O que mais falta fazia: tem
--     casa própria na Rua Gil de Avô, sítio próprio, dois telefones, horário
--     de inverno e de verão publicados, e uma coleção de arte portuguesa de
--     mais de cinquenta artistas entre 1930 e 2010. Está no OpenStreetMap
--     pelo nome, o que dá ponto exacto.
--   · **Casa-Memória Lopes-Graça**, a casa onde nasceu o compositor, também
--     no OpenStreetMap pelo nome.
--   · **Centro de Interpretação e Sensibilização Ambiental**, na Mata
--     Nacional dos Sete Montes.
--   · **Exposição Permanente da Festa dos Tabuleiros**, no Convento de São
--     Francisco.
--
-- ## Duas decisões que se explicam
--
-- **A Festa dos Tabuleiros fica com a coordenada do Museu dos Fósforos**, ao
-- metro, porque partilham o mesmo convento. São dois alfinetes na mesma porta
-- — e é a verdade: são duas coleções diferentes, e quem quer ver os
-- tabuleiros não quer ver caixas de fósforos. As duas descrições dizem que
-- partilham a casa.
--
-- **A Casa-Memória Lopes-Graça entra sem horário.** Há um horário publicado
-- num portal de turismo (terça a sábado), e há uma notícia do Médio Tejo, de
-- janeiro de 2016, a dizer que a casa estava fechada desde agosto de 2015 por
-- falta de pessoal, com visitas «asseguradas sempre que há solicitação».
-- Dez anos depois não sei qual das duas é a de hoje, e **entre publicar um
-- horário que pode mandar alguém a uma porta fechada e não publicar nenhum,
-- não se publica nenhum**. A descrição diz que convém telefonar.
--
-- ## O que não se preencheu
--
-- **O código postal do Centro de Interpretação Ambiental.** Uma fonte diz
-- 2300-551, o Nominatim diz 2300-600 para a mesma praça. Fica vazio.

-- ---------------------------------------------------------------------------
-- I. Os quatro espaços.
-- ---------------------------------------------------------------------------

insert into public.venues (
  id, name, municipality_id, parish, kind, status, is_association,
  address, postal_code, latitude, longitude,
  website_url, phone, email,
  opening_hours, opening_hours_checked_on,
  description, notes
) values

  ('nac-tomar',
   'NAC — Núcleo de Arte Contemporânea de Tomar',
   'tomar',
   'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
   'museum', 'active', false,
   'Rua Gil de Avô', '2300-580', 39.604729, -8.413727,
   'https://nac.cm-tomar.pt/',
   '+351 249 322 373 / +351 249 146 512',
   'museologia@cm-tomar.pt',
   'Inverno (16 de setembro a 14 de junho): terça a sexta, das 14h00 às 17h00; sábados e '
   'domingos, das 10h00 às 12h00 e das 14h00 às 17h00. Verão (15 de junho a 15 de setembro): '
   'terça a domingo, das 10h00 às 13h00 e das 14h00 às 18h00.',
   date '2026-09-01',
   'O museu de arte contemporânea do município, aberto em 2004 a partir da doação de uma coleção '
   'particular à cidade. Dezenas de pinturas, desenhos, esculturas e gravuras de mais de '
   'cinquenta artistas, entre as vanguardas modernistas e o início deste século, e uma '
   'programação anual de exposições temporárias ao lado da mostra permanente.',
   'Criado pela 0096. Nome, morada, telefones, horário e coleção confirmados em nac.cm-tomar.pt a '
   '01/09/2026; ponto do OpenStreetMap, que tem o museu pelo nome («Museu Municipal — Núcleo de '
   'Arte Contemporânea, Rua Gil Avô»). O email diverge entre as duas fontes municipais: o índice '
   'do roteiro dá nac@cm-tomar.pt e o sítio do próprio núcleo dá museologia@cm-tomar.pt — fica o '
   'do próprio. O NAC.2, na Levada, é outro espaço e já tem alias para lá.'),

  ('casa-memoria-lopes-graca',
   'Casa-Memória Lopes-Graça',
   'tomar',
   'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
   'museum', 'active', false,
   'Rua Dr. Joaquim Jacinto, 25', '2300-577', 39.603606, -8.412399,
   'https://museus.cm-tomar.pt/',
   '+351 249 329 823',
   'turismo@cm-tomar.pt',
   null, null,
   'A casa onde nasceu Fernando Lopes-Graça, no centro histórico. Guarda o centro documental e '
   'artístico do compositor — certidões, partituras, recortes de imprensa, livros, fotografias e '
   'gravações. É pequena e nem sempre tem quem a abra: vale a pena telefonar antes de ir.',
   'Criado pela 0096. Morada e contactos do Roteiro Museológico de Tomar; ponto do OpenStreetMap, '
   'que tem a casa pelo nome («Casa - Museu Lopes-Graça», nº 25). Fica a 120 m da Sinagoga, na '
   'mesma rua. SEM HORÁRIO DE PROPÓSITO: o turismodocentro.pt publica «terça a sábado, 10h–13h e '
   '14h–18h», mas o Médio Tejo noticiou a 28/01/2016 que a casa estava encerrada desde agosto de '
   '2015 por falta de recursos humanos, com visitas asseguradas por solicitação. Dez anos depois '
   'não há como saber qual é a de hoje, e um horário errado manda alguém a uma porta fechada.'),

  ('centro-interpretacao-ambiental-tomar',
   'CISA — Centro de Interpretação e Sensibilização Ambiental',
   'tomar',
   'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
   'museum', 'active', false,
   'Mata Nacional dos Sete Montes, Praça do Infante D. Henrique', null, 39.601443, -8.415989,
   'https://museus.cm-tomar.pt/',
   '+351 914 915 986',
   'centroambiental@cm-tomar.pt',
   'Segunda a sexta, das 14h00 às 17h00. Encerra ao fim de semana e nos feriados.',
   date '2026-09-01',
   'O centro ambiental do município, dentro da Mata Nacional dos Sete Montes — a antiga cerca do '
   'Convento de Cristo. Recebe visitas de escolas e ações de sensibilização, e é o ponto de '
   'partida de quem quer perceber a mata antes de a percorrer.',
   'Criado pela 0096. Contactos do Roteiro Museológico de Tomar; horário publicado pela Ecoteca. '
   'O ponto é o centróide da Praça do Infante D. Henrique (Nominatim), não o da porta. Código '
   'postal por confirmar: uma fonte dá 2300-551 e o Nominatim dá 2300-600 para a mesma praça.'),

  ('exposicao-festa-dos-tabuleiros',
   'Exposição Permanente da Festa dos Tabuleiros',
   'tomar',
   'União das freguesias de Tomar (São João Baptista) e Santa Maria dos Olivais',
   'museum', 'active', false,
   'Convento de São Francisco, Avenida General Bernardo Faria', '2300-535', 39.599844, -8.414443,
   'https://museus.cm-tomar.pt/',
   '+351 249 329 823',
   'turismo@cm-tomar.pt',
   null, null,
   'A mostra permanente da maior festa de Tomar, instalada no Convento de São Francisco — a mesma '
   'casa do Museu dos Fósforos, e não a mesma coleção. Conta como se fazem os tabuleiros, quem os '
   'leva e o que a cidade faz de quatro em quatro anos.',
   'Criado pela 0096. Morada e contactos do Roteiro Museológico de Tomar. Partilha o Convento de '
   'São Francisco com o Museu dos Fósforos e por isso partilha a coordenada, ao metro: são duas '
   'coleções distintas na mesma porta. Sem horário publicado pelo município.')

on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- II. Os cinco núcleos da Levada passam a resolver para o complexo.
--
-- A descrição da ficha da Levada já os nomeia aos seis. O que faltava era a
-- recolha saber que «Fundição Tomarense» é ali — sem isto, um evento com esse
-- nome ia para a fila dos espaços por resolver, e a Levada perdia-o.
-- ---------------------------------------------------------------------------

insert into public.venue_aliases (alias, venue_id, municipality_id) values
  (public.normalize_for_hash('Fundição Tomarense'),                    'complexo-cultural-levada-tomar', 'tomar'),
  (public.normalize_for_hash('Fundição Tomarense — Núcleo Museológico'),'complexo-cultural-levada-tomar', 'tomar'),
  (public.normalize_for_hash('Central Elétrica de Tomar'),             'complexo-cultural-levada-tomar', 'tomar'),
  (public.normalize_for_hash('Central Elétrica de Tomar — Núcleo Museológico'), 'complexo-cultural-levada-tomar', 'tomar'),
  (public.normalize_for_hash('Centro Interpretativo Tomar Templários'), 'complexo-cultural-levada-tomar', 'tomar'),
  (public.normalize_for_hash('Centro Interpretativo Tomar Templário'),  'complexo-cultural-levada-tomar', 'tomar'),
  (public.normalize_for_hash('Moagem A Portuguesa'),                    'complexo-cultural-levada-tomar', 'tomar'),
  (public.normalize_for_hash('Moagem A Nabantina'),                     'complexo-cultural-levada-tomar', 'tomar'),
  (public.normalize_for_hash('Fábrica das Artes'),                      'complexo-cultural-levada-tomar', 'tomar')
on conflict do nothing;

-- E os nomes dos quatro novos, para a recolha os apanhar.
insert into public.venue_aliases (alias, venue_id, municipality_id) values
  (public.normalize_for_hash('NAC — Núcleo de Arte Contemporânea de Tomar'), 'nac-tomar', 'tomar'),
  (public.normalize_for_hash('Núcleo de Arte Contemporânea'),                'nac-tomar', 'tomar'),
  (public.normalize_for_hash('Casa-Memória Lopes-Graça'),                    'casa-memoria-lopes-graca', 'tomar'),
  (public.normalize_for_hash('Casa Memória Lopes Graça'),                    'casa-memoria-lopes-graca', 'tomar'),
  (public.normalize_for_hash('CISA — Centro de Interpretação e Sensibilização Ambiental'),
                                                                             'centro-interpretacao-ambiental-tomar', 'tomar'),
  (public.normalize_for_hash('Centro de Interpretação e Sensibilização Ambiental'),
                                                                             'centro-interpretacao-ambiental-tomar', 'tomar'),
  (public.normalize_for_hash('Exposição Permanente da Festa dos Tabuleiros'),
                                                                             'exposicao-festa-dos-tabuleiros', 'tomar'),
  (public.normalize_for_hash('Exposição Permanente A Festa dos Tabuleiros'),
                                                                             'exposicao-festa-dos-tabuleiros', 'tomar')
on conflict do nothing;

-- ---------------------------------------------------------------------------
do $$
declare
  n        integer;
  distante integer;
  novos    constant text[] := array['nac-tomar','casa-memoria-lopes-graca',
                                    'centro-interpretacao-ambiental-tomar',
                                    'exposicao-festa-dos-tabuleiros'];
begin
  -- Postcondições sobre as linhas desta migração. Numa base vazia contam zero.

  -- 1. Os quatro entram com o mínimo que uma ficha precisa para existir.
  select count(*) into n
  from public.venues
  where id = any(novos)
    and (latitude is null or longitude is null or description is null or address is null);

  if n > 0 then
    raise exception '% dos quatro espaços novos ficaram sem ponto, morada ou descrição', n;
  end if;

  -- 2. Nenhum deles cai fora de Tomar. O centro do concelho anda pelos
  --    39,60 N / -8,41 O; 15 km é folgado para um concelho e apertado que
  --    chegue para apanhar um erro de sinal ou de dígito.
  select count(*) into distante
  from public.venues
  where id = any(novos)
    and 111.32 * sqrt(power(latitude - 39.6045, 2)
                    + power((longitude + 8.4140) * cos(radians(latitude)), 2)) > 15;

  if distante > 0 then
    raise exception '% dos espaços novos ficaram a mais de 15 km do centro de Tomar', distante;
  end if;

  -- 3. A Casa-Memória entra sem horário de propósito, e isso é a decisão
  --    desta migração — não um esquecimento. Se alguém lhe puser um horário
  --    sem tirar esta asserção, é porque o confirmou.
  select count(*) into n
  from public.venues
  where id = 'casa-memoria-lopes-graca' and opening_hours is not null;

  if n > 0 then
    raise exception
      'a Casa-Memória Lopes-Graça ganhou horário — confirme que a casa abre antes de tirar esta asserção';
  end if;

  -- 4. Os cinco núcleos da Levada resolvem todos para o complexo.
  select count(*) into n
  from (values ('Fundição Tomarense'), ('Central Elétrica de Tomar'),
               ('Centro Interpretativo Tomar Templários'), ('Moagem A Portuguesa'),
               ('Moagem A Nabantina')) as nucleo(nome)
  where not exists (
    select 1 from public.venue_aliases a
    where a.alias = public.normalize_for_hash(nucleo.nome)
      and a.venue_id = 'complexo-cultural-levada-tomar');

  if n > 0 then
    raise exception '% núcleos da Levada continuam sem alias para o complexo', n;
  end if;

  select count(*) into n from public.venues;
  raise notice 'o catálogo passa a ter % espaços', n;
  select count(*) into n from public.venues where municipality_id = 'tomar';
  raise notice 'Tomar passa a ter % espaços', n;
end
$$;
