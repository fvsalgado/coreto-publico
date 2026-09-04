-- 0060 — Onde é que isto é, afinal
--
-- Sessenta e três dos noventa e sete eventos por acontecer não diziam onde
-- eram: tinham o nome do concelho em `location_name` e mais nada. No mapa
-- ficavam todos empilhados no centro do concelho; na agenda, quem lia não
-- sabia para onde ir.
--
-- O que estava à vista, e ninguém tinha lido: **a descrição que a própria
-- fonte publica quase sempre diz o sítio.** «A programação continua com três
-- concertos na Praça da Vila». «A Capela de Almogadel recebe as celebrações».
-- «Cais de Almourol». «no Parque do Lavradio, em Alcanena». Não foi preciso
-- ler um cartaz: estava no texto, e o recoletor guardou-o.
--
-- Daqui saem três coisas, por ordem de quanto se sabe:
--
--   1. Três eventos acontecem num espaço que já está no catálogo. Ganham
--      `venue_id`, e com ele a ficha do espaço, a morada e o «como chegar».
--   2. Dezassete ganham coordenadas próprias, geocodificadas uma a uma no
--      Nominatim do OpenStreetMap e **confirmadas concelho a concelho** antes
--      de entrarem. Uma foi recusada: «Albufeira de Ortiga» devolveu a
--      Albufeira de Belver, em Nisa, distrito de Portalegre — fora da região.
--      Ficou o ponto da Praia Fluvial de Ortiga, que é em Mação e é onde a
--      prova se faz.
--   3. Os restantes ganham o nome do sítio em vez do nome do concelho.
--      «Igreja Nova do Sobral» não tem coordenadas aqui, mas é infinitamente
--      mais útil do que «Ferreira do Zêzere» a quem quer lá ir.
--
-- Dados de geocodificação © contribuidores do OpenStreetMap, ODbL 1.0.
--
-- TUDO O QUE AQUI SE ESCREVE FICA BLOQUEADO. É a razão de a migração existir
-- em vez de um `update` à mão: `lock_event_fields` grava o campo em
-- `manual_overrides`, e o pipeline aplica `applyManualLocks` a cada recolha.
-- Sem isso, a recolha desta noite lia outra vez «Ferreira do Zêzere» e escrevia
-- por cima — e à terceira vez ninguém corrigia mais nada.

begin;

-- ---------------------------------------------------------------------------
-- 1) Os que acontecem num espaço que o catálogo já conhece.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_id uuid;
begin
  for r in select * from (values
    ('jf-constancia',    'Sorrisos entre Letras',            'biblioteca-municipal-constancia'),
    ('cm-tomar',         'RAMOT - António da Costa Cabral',  'ceft-casa-dos-cubos'),
    ('cm-entroncamento', 'XXIX Grande Prémio Museu Nacional Ferroviário – Atletismo 11ª Caminhada José Canelo',
                                                             'museu-nacional-ferroviario')
  ) as t(fonte, titulo, espaco)
  loop
    update public.events
       set venue_id = r.espaco, updated_at = now()
     where source_id = r.fonte and title = r.titulo and status = 'published'
    returning id into v_id;

    -- Numa base sem dados — a verificação de migrações — não há eventos, e
    -- não há nada para bloquear. `lock_event_fields` rebentaria com «evento
    -- não existe», que é o comportamento certo dele e o errado aqui.
    if v_id is not null then
      perform public.lock_event_fields(
        v_id, array['venue_id'], 'levantamento manual 2026-08-29',
        'O espaço vem da descrição publicada pela própria fonte.'
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Os que ganham coordenadas próprias.
-- ---------------------------------------------------------------------------
--
-- As coordenadas ficam no evento e não num espaço novo, de propósito: uma
-- praça, uma praia fluvial ou uma rua não são equipamentos culturais e não têm
-- ficha para abrir. O catálogo de espaços é de casas com programação; enchê-lo
-- de largos tornava-o outra coisa.
do $$
declare
  r record;
  v_id uuid;
begin
  for r in select * from (values
    ('cm-abrantes',        'FIF Abrantes',                                  'Praça Barão da Batalha, Abrantes',            39.4615727, -8.1983196),
    ('cm-abrantes',        'Trail Abrantes 100',                            'Partida na Praça Barão da Batalha, Abrantes', 39.4615727, -8.1983196),
    ('cm-abrantes',        'Um Rio de Memórias',                            'Praia Fluvial de Aldeia do Mato',             39.5452997, -8.2775407),
    ('jf-martinchel',      'Festa de Verão em Hora de S. Miguel',           'Martinchel',                                  39.5370725, -8.3127578),
    ('jf-martinchel',      'Almoço dos Idosos',                             'Martinchel',                                  39.5370725, -8.3127578),
    ('jf-martinchel',      'Festa de Verão em Honra de S. Sebastião',       'Martinchel',                                  39.5370725, -8.3127578),
    ('jf-constancia',      'Constância Kayak Trail',                        'Praia Fluvial de Constância',                 39.4755950, -8.3418222),
    ('cm-entroncamento',   'Noites de Verão 2026 animam a Praça Salgueiro Maia', 'Praça Salgueiro Maia, Entroncamento',    39.4625013, -8.4703324),
    ('cm-entroncamento',   '3º Edição Feira para todos',                    'Rua Luís Falcão de Sommer, Entroncamento',    39.4614364, -8.4695076),
    ('cm-entroncamento',   '18ª Edição da Feirinha de Setembro',            'Rua Luís Falcão de Sommer, Entroncamento',    39.4614364, -8.4695076),
    ('cm-ferreiradozezere','Festa de Águas Belas',                          'Águas Belas, Ferreira do Zêzere',             39.7120234, -8.3030732),
    ('cm-macao',           'III Aquatlo Município de Mação',                'Albufeira de Ortiga (Praia Fluvial de Ortiga)', 39.4830676, -8.0020775),
    ('cm-ourem',           'Mercados Ecorurais',                            'Praça da República, Ourém',                   39.6553133, -8.5774564),
    ('cm-ourem',           'Noite de Fados',                                'Sede da Associação, Rua da Escola 155, Pinhel', 39.6526672, -8.6154871),
    ('cm-ourem',           'Magusto',                                       'Sede da Associação, Rua da Escola 155, Pinhel', 39.6526672, -8.6154871),
    ('cm-tomar',           'Festa em honra de Nossa Senhora da Piedade',    'Capela das Serras, Serra',                    39.6005894, -8.3013450),
    ('cm-tomar',           'Sons na Adega®',                                'Adega da Gaveta — Margaval Vinhos, Casa Nova (Serra)', 39.6005894, -8.3013450)
  ) as t(fonte, titulo, sitio, lat, lon)
  loop
    update public.events
       set location_name = r.sitio, latitude = r.lat, longitude = r.lon, updated_at = now()
     where source_id = r.fonte and title = r.titulo and status = 'published'
    returning id into v_id;

    if v_id is not null then
      perform public.lock_event_fields(
        v_id, array['location_name', 'latitude', 'longitude'],
        'levantamento manual 2026-08-29',
        'Sítio lido da descrição da fonte; coordenadas do Nominatim (OpenStreetMap, ODbL), confirmadas no concelho certo.'
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Os que passam a dizer o sítio, sem coordenadas.
-- ---------------------------------------------------------------------------
--
-- Não se inventou um ponto para nenhum destes. «Igreja Nova do Sobral» é o que
-- a fonte diz, e é o que fica; onde é ao certo, a fonte não disse e nós não
-- sabemos. No mapa continuam no centro do concelho, tracejados — que é a
-- verdade — mas quem lê a agenda passa a saber para onde perguntar.
do $$
declare
  r record;
  v_id uuid;
begin
  for r in select * from (values
    ('cm-alcanena',        'Cerimónia “Regenerar Alcanena” 2026',           'Parque do Lavradio, Alcanena'),
    ('jf-minde',           'Comemoração 30º Aniversário Charales Chorus - Caorg, Minde', 'Pavilhão Ana Sonça, Minde'),
    ('cm-ferreiradozezere','Verão Ferreira do Zêzere - Agosto',             'Praça da Vila, Ferreira do Zêzere'),
    ('cm-ferreiradozezere','Procissão na capela de Almogadel',              'Capela de Almogadel'),
    ('cm-ferreiradozezere','Festa do Desportivo de Igreja Nova',            'Igreja Nova do Sobral'),
    ('cm-entroncamento',   'Exposição Documental "O Entroncamento de outros tempos…nas páginas dos jornais O Entroncamento e Notícias do Entroncamento”',
                                                                            'Galeria Municipal do Entroncamento'),
    ('cm-vnbarquinha',     'Feira de artesanato, produtos locais, velharias e livro usado', 'Largo 1.º Dezembro, Vila Nova da Barquinha'),
    ('cm-vnbarquinha',     'Barquinha Night Run',                           'Largo 1.º Dezembro, Vila Nova da Barquinha'),
    ('cm-vnbarquinha',     'Insufláveis no parque',                         'Parque Ribeirinho de Vila Nova da Barquinha'),
    ('cm-vnbarquinha',     'Almourol Templário - O assalto',                'Cais de Almourol'),
    ('cm-vnbarquinha',     'Exposição “ESCULTURA. TRANSMUTAÇÃO”, Coleção de Arte Fundação EDP', 'Galeria do Parque, Vila Nova da Barquinha'),
    ('jf-constancia',      'A Arte do Calafate',                            'Estaleiro do Rio Tejo, Constância'),
    ('jf-montalvo',        'Raízes de Montalvo',                            'Escola Adães Bermudes, Montalvo'),
    ('jf-fontes',          'Festas da Portela, Colmeal e Cabeça Ruiva 2026', 'Portela, Fontes'),
    ('cm-ourem',           'Feira de S.bartolomeu',                         'Largo da Feira, Caxarias')
  ) as t(fonte, titulo, sitio)
  loop
    update public.events
       set location_name = r.sitio, updated_at = now()
     where source_id = r.fonte and title = r.titulo and status = 'published'
    returning id into v_id;

    if v_id is not null then
      perform public.lock_event_fields(
        v_id, array['location_name'], 'levantamento manual 2026-08-29',
        'Sítio lido da descrição publicada pela própria fonte.'
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- O que tem de continuar verdade.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  -- Numa base sem eventos não há nada a verificar.
  select count(*) into n from public.events;
  if n = 0 then return; end if;

  -- Cada campo que esta migração escreveu tem de ficar bloqueado. Um campo
  -- escrito à mão e não bloqueado é um campo que a recolha desta noite apaga —
  -- é o defeito que esta migração existe para não ter.
  --
  -- Três eventos × 1 campo, mais dezassete × 3, mais quinze × 1.
  select count(*) into n
    from public.manual_overrides
   where actor = 'levantamento manual 2026-08-29';
  assert n = 69, format('%s bloqueios escritos, esperavam-se 69 — algum título deixou de casar', n);

  -- A asserção larga («toda a coordenada tem de estar bloqueada») seria falsa:
  -- a API de Ourém publica as coordenadas de cada evento, e essas vêm da fonte
  -- e continuam a vir. Bloquear o que a fonte dá bem seria congelar a agenda
  -- contra correções de quem a publica.
  select count(*) into n
    from public.events e
   where e.latitude is not null
     and e.source_id <> 'cm-ourem'
     and not exists (
       select 1 from public.manual_overrides o
        where o.event_id = e.id and o.field = 'latitude'
     );
  assert n = 0, format('%s eventos com coordenadas de origem desconhecida e sem bloqueio', n);
end $$;

commit;
