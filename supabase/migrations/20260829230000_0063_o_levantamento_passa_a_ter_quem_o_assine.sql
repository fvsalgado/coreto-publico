-- 0063 — O levantamento passa a ter quem o assine
--
-- Na 0062 escreveram-se oito das vinte e três moradas que o levantamento de
-- fora propunha. As outras quinze ficaram de fora por uma razão só: vinham de
-- cartazes que este lado não consegue reler, e escrever o que não se pode
-- confirmar é o que esta casa não faz.
--
-- Entretanto o dono do projeto disse o que faltava dizer: que as moradas foram
-- lidas nas descrições e nos cartazes, e que estão certas. Isso muda a
-- natureza do que ali está. Deixa de ser uma proposta anónima e passa a ser
-- uma leitura assinada por quem responde pela agenda — que é, afinal, a mesma
-- coisa que acontece quando um editor corrige uma data à mão. Não é a fonte a
-- dizê-lo; é uma pessoa a assinar o que leu. E é isso que fica registado no
-- `actor` e na nota de cada bloqueio, para quem um dia queira saber de onde
-- veio cada linha.
--
-- **Três coisas se escrevem, e cada uma no seu campo.**
--
--   * `location_name` leva o nome do sítio, e só o nome. É o que aparece no
--     «Onde» e no mapa.
--   * `location_address` leva a morada por baixo do nome — e leva-a só quando
--     é mesmo uma morada. Este campo alimenta a pesquisa do Google Maps para
--     os eventos sem coordenadas: enfiar-lhe uma lista de oito palcos era
--     estragar a única ligação que leva alguém ao sítio.
--   * `how_to_arrive` leva a prosa — a lista dos oito palcos do Art'InRua, os
--     seis lugares do «Somar Km's», onde é a parte religiosa e onde são as
--     inscrições. É texto livre, aparece por cima da morada no «Como chegar»,
--     e não entra em pesquisa nenhuma.
--
-- Um programa que acontece em oito sítios não tem morada. Tem uma frase que
-- diz quais são os oito, e um nome honesto para a linha do «Onde». Escolher um
-- dos oito para o `location_name` seria escolher mal; dizer só «Mação» é o que
-- estava lá e não ajudava ninguém.
--
-- **E três eventos deixam de ser um nome de concelho e passam a ser um espaço
-- do catálogo.** Os dois cinemas do Sardoal e o «AL Guitar Duo» diziam
-- «Sardoal» e «Vila Nova da Barquinha»; o levantamento nomeou o Centro
-- Cultural Gil Vicente e o Centro Cultural de Vila Nova da Barquinha, que
-- estão os dois no catálogo com morada e coordenadas. Com o `venue_id` posto,
-- os três ganham de uma vez a ficha do espaço, a fotografia, a morada e o
-- ponto no mapa — e o espaço ganha a programação que era dele e andava solta.

begin;

do $$
declare
  r record;
  v_id uuid;
  v_campos text[];
begin
  for r in select * from (values
    -- ---------------------------------------------------------------------
    -- Um lugar, um nome. O concelho estava no sítio do nome do sítio.
    -- ---------------------------------------------------------------------
    ('festas-da-portela-colmeal-e-cabeca-ruiva-2026-e64f47',
     'Centro Social, Desportivo e Recreativo de Portela, Colmeal e Cabeça Ruiva',
     'Portela, Fontes', null, null),

    ('almoco-dos-idosos-ce86d4',
     'Recinto de festas da Paróquia de Martinchel', null, null, null),

    -- Já dizia «Recinto de festas de Martinchel» desde a 0062. O cartaz é mais
    -- preciso do que isso, e é a paróquia que o organiza.
    ('festa-de-verao-em-honra-de-s-sebastiao-bca7b9',
     'Recinto de festas da Paróquia de Martinchel', null, null, null),

    ('ii-prova-de-resistencia-terrantez-trail-team-fce9f1',
     'Polje de Mira–Minde', 'Minde', null, null),

    ('torneio-de-tiro-ao-alvo-nucleo-do-scp-de-minde-7553fa',
     'Pátio do Núcleo do SCP de Minde', 'Minde', null, null),

    ('aniversario-moto-clube-3bf74c',
     'Sede do Moto Clube de Ferreira do Zêzere', null, null, null),

    -- Idem: dizia «Desportivo de Igreja Nova do Sobral» e o recinto é o sítio.
    ('festa-do-desportivo-de-igreja-nova-e30421',
     'Recinto do Desportivo de Igreja Nova do Sobral', null, null, null),

    ('exposicao-escultura-transmutacao-colecao-de-arte-fundacao-edp-f2f4c9',
     'Galeria do Parque', 'Edifício dos Paços do Concelho', null, null),

    -- Uma correção de gramática e não de sítio: é o auditório *do* Paço.
    ('workshop-de-dancas-com-dulce-mauricio-05c5a3',
     'Auditório do Paço dos Condes', null, null, null),

    -- ---------------------------------------------------------------------
    -- O sítio é um espaço do catálogo. Com o `venue_id` vêm a morada, as
    -- coordenadas, a fotografia e a ficha — nada disto se copia à mão.
    -- ---------------------------------------------------------------------
    ('cinema-homem-aranha-um-novo-dia-d66564',
     'Centro Cultural Gil Vicente', null, null, 'centro-cultural-gil-vicente'),

    ('cinema-a-odisseia-b160cb',
     'Centro Cultural Gil Vicente', null, null, 'centro-cultural-gil-vicente'),

    ('al-guitar-duo-96fb3d',
     'Centro Cultural de Vila Nova da Barquinha', null, null, 'centro-cultural-barquinha'),

    -- ---------------------------------------------------------------------
    -- Muitos lugares. O nome resume, a prosa enumera, a morada fica vazia
    -- porque não há nenhuma que seja verdade.
    -- ---------------------------------------------------------------------
    ('vamos-somar-km-s-em-2026-ec706c',
     'Sedes das associações do concelho de Mação', null,
     'A caminhada vai à terra de cada associação: A.R. Chão de Codes, A.C.G.R. Aboboreira, Associação D.R. e Cultural São Miguel, Centro Recreativo de Vales, Castelo e A.D.R. Chão Lopes.',
     null),

    ('epoca-balnear-no-concelho-de-macao-2026-7866b3',
     'Piscinas e praias fluviais do concelho de Mação', null,
     'São as Piscinas Municipais Descobertas de Mação, a Piscina Municipal de Amêndoa e as praias fluviais de Cardigos, do Carvoeiro e de Ortiga.',
     null),

    ('acontece-em-macao-em-agosto-10bff2',
     'Vários lugares do concelho de Mação', null,
     'O programa passa por oito lugares: Largo dos Combatentes, Auditório do Centro Cultural Elvino Pereira, Piscinas Municipais Descobertas de Mação, Piscina Municipal de Amêndoa, praias fluviais de Cardigos e do Carvoeiro, A.C.R. Rosmaninhal e Praças do Pinhal.',
     null),

    -- O «Onde» continua a mostrar o Castelo de Ourém, que é o espaço ligado e
    -- é de onde vêm as coordenadas. A prosa diz que a vila medieval é maior
    -- do que o castelo.
    ('fins-de-tarde-na-vila-medieval-26-61ca7e',
     'Vila Medieval de Ourém', null,
     'Dentro da vila medieval os concertos andam por quatro sítios: Praça do Pelourinho, Escadinhas da Sociedade Filarmónica, Anfiteatro dos Torreões e Castelo de Ourém.',
     null),

    -- O nome já estava certo desde a 0062 — «Ruas e praças de Tomar». O que
    -- faltava era dizer quais.
    ('art-in-rua-2026-a6c144', null, null,
     'Os palcos são oito: Convento de Cristo, Várzea Pequena (o Pátio Art''InRua), Centro Histórico, Praça da República, Rua Serpa Pinto, Jardim do Mouchão, A Moagem e Várzea Grande.',
     null),

    -- ---------------------------------------------------------------------
    -- O nome do sítio já estava certo. O que o levantamento traz é o resto.
    -- ---------------------------------------------------------------------
    ('passeio-anual-do-idoso-2026-c934cf', null, null,
     'A partida é na Várzea Grande, junto à Rodoviária. As inscrições fazem-se no Edifício de São João Baptista, na Rua Alexandre Herculano, n.º 20.',
     null),

    -- A fonte diz «Pavilhão» e o cartaz diz «Salão» — fica o que a fonte diz,
    -- porque é a fonte que assinamos, e diz-se que há uma discordância. O que
    -- o cartaz acrescenta a sério é que a parte religiosa é noutro sítio.
    ('comemoracao-30-aniversario-charales-chorus-caorg-minde-3e51ab', null, null,
     'A parte religiosa é na Igreja Paroquial de Minde; o resto é no Pavilhão Ana Sonça, que o cartaz trata por Salão.',
     null)
  ) as t(evento, nome, morada, caminho, espaco)
  loop
    -- Sem isto, um slug que deixasse de casar herdava o `id` da volta anterior
    -- e escrevia o bloqueio no evento errado.
    v_id := null;

    update public.events
       set location_name    = coalesce(r.nome, location_name),
           location_address = coalesce(r.morada, location_address),
           how_to_arrive    = coalesce(r.caminho, how_to_arrive),
           venue_id         = coalesce(r.espaco, venue_id),
           updated_at       = now()
     where slug = r.evento and status = 'published'
    returning id into v_id;

    -- Numa base sem dados — a verificação de migrações — não há eventos, e não
    -- há nada para bloquear.
    if v_id is not null then
      -- Bloqueia-se o que se escreveu, e só isso. Congelar um campo que esta
      -- migração não tocou seria proteger o que a fonte ainda tem direito a
      -- corrigir.
      v_campos := array_remove(array[
        case when r.nome    is not null then 'location_name'    end,
        case when r.morada  is not null then 'location_address' end,
        case when r.caminho is not null then 'how_to_arrive'    end,
        case when r.espaco  is not null then 'venue_id'         end
      ], null);

      perform public.lock_event_fields(
        v_id, v_campos, 'levantamento de moradas 2026-08-29, atestado pelo dono',
        'Lido nas descrições e nos cartazes por quem fez o levantamento, e atestado pelo dono do projeto. Não é a fonte a dizê-lo em texto que este lado consiga reler: é uma pessoa a assinar o que leu.'
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
  esperados integer;
  slugs text[] := array[
    'festas-da-portela-colmeal-e-cabeca-ruiva-2026-e64f47',
    'almoco-dos-idosos-ce86d4',
    'festa-de-verao-em-honra-de-s-sebastiao-bca7b9',
    'ii-prova-de-resistencia-terrantez-trail-team-fce9f1',
    'torneio-de-tiro-ao-alvo-nucleo-do-scp-de-minde-7553fa',
    'aniversario-moto-clube-3bf74c',
    'festa-do-desportivo-de-igreja-nova-e30421',
    'exposicao-escultura-transmutacao-colecao-de-arte-fundacao-edp-f2f4c9',
    'workshop-de-dancas-com-dulce-mauricio-05c5a3',
    'cinema-homem-aranha-um-novo-dia-d66564',
    'cinema-a-odisseia-b160cb',
    'al-guitar-duo-96fb3d',
    'vamos-somar-km-s-em-2026-ec706c',
    'epoca-balnear-no-concelho-de-macao-2026-7866b3',
    'acontece-em-macao-em-agosto-10bff2',
    'fins-de-tarde-na-vila-medieval-26-61ca7e',
    'art-in-rua-2026-a6c144',
    'passeio-anual-do-idoso-2026-c934cf',
    'comemoracao-30-aniversario-charales-chorus-caorg-minde-3e51ab'
  ];
begin
  -- A conta é «quantos destes dezanove existem nesta base», e não «dezanove»:
  -- numa base acabada de construir não existe nenhum, e uma asserção fixa
  -- reprovava uma migração que está certa.
  select count(*) into esperados
    from public.events where status = 'published' and slug = any(slugs);

  select count(distinct event_id) into n
    from public.manual_overrides
   where actor = 'levantamento de moradas 2026-08-29, atestado pelo dono';
  assert n = esperados,
    format('%s eventos bloqueados para %s presentes — algum slug deixou de casar', n, esperados);

  -- Nenhum dos dezanove pode ter ficado a dizer só o nome do concelho: era
  -- disso mesmo que se estava a sair.
  select count(*) into n
    from public.events e
   where e.slug = any(slugs)
     and e.location_name in (select name from public.municipalities);
  assert n = 0, format('%s eventos continuam a dizer só o nome do concelho', n);

  -- Os três que ganharam espaço têm de ter ganho espaço.
  select count(*) into n
    from public.events
   where slug in ('cinema-homem-aranha-um-novo-dia-d66564', 'cinema-a-odisseia-b160cb',
                  'al-guitar-duo-96fb3d')
     and venue_id is not null;
  assert n = (select count(*) from public.events
               where slug in ('cinema-homem-aranha-um-novo-dia-d66564', 'cinema-a-odisseia-b160cb',
                              'al-guitar-duo-96fb3d')),
    format('%s dos cinemas e do duo continuam sem espaço', n);

  -- E o `location_address` não pode ter ficado com uma lista lá dentro: é ele
  -- que alimenta a pesquisa no mapa para quem não tem coordenadas.
  select count(*) into n
    from public.events
   where slug = any(slugs) and location_address like '%;%';
  assert n = 0, format('%s eventos têm uma lista no campo da morada', n);
end $$;

commit;
