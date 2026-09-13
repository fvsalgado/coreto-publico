-- 0062 — O sítio estava na descrição, outra vez
--
-- O dono trouxe um levantamento de moradas feito por fora: noventa e sete
-- eventos, com o sítio que cada um tem no Coreto e o sítio que quem levantou
-- conseguiu recuperar. Vinte e três traziam morada nova.
--
-- **Não se escreveram as vinte e três.** Um levantamento de fora é uma pista,
-- não uma fonte: metade delas veio de cartazes que este lado não consegue ler,
-- e escrever o que não se pode confirmar é exactamente o que esta casa não faz.
-- O que se fez foi outra coisa — pegar em cada morada proposta e procurá-la na
-- **descrição que a própria fonte publica e que já está guardada aqui**. Oito
-- estavam lá, à letra. Essas oito entram, e cada uma leva a frase que a prova.
--
-- As outras quinze ficam de fora, e vale a pena dizer porquê, porque não é
-- todas pela mesma razão:
--
--   * Sete vieram de cartaz e a descrição não as confirma. Podem estar certas;
--     não são verificáveis daqui. Ficam no levantamento para quando alguém as
--     puder confirmar à mão.
--   * Cinco são programas com muitos sítios — «Acontece em Mação... em Agosto»
--     tem oito lugares, o «Somar Km's» leva a actividade «à sua terra» de cada
--     associação. Escolher um sítio para estes era escolher mal; o concelho é
--     a resposta verdadeira.
--   * Duas já tinham o sítio certo e o levantamento propunha acrescentar-lhe
--     morada de rua que a fonte não dá.
--   * Uma é uma discordância a registar e não a resolver: o cartaz diz «Salão
--     Ana Sonça» e a fonte diz «Pavilhão Ana Sonça». Fica o que a fonte diz,
--     porque é a fonte que assinamos.
--
-- Como sempre: o que se escreve fica bloqueado, senão a recolha desta noite
-- devolve o nome do concelho ao lugar do sítio.

begin;

do $$
declare
  r record;
  v_id uuid;
begin
  for r in select * from (values
    -- «Ferreira do Zêzere recebe […] o Congresso do Desporto […]
    --  Centro Cultural Alfredo Keil. 15h00 | Abertura da sessão»
    ('congresso-do-desporto-5f018a',
     'Centro Cultural Alfredo Keil, Ferreira do Zêzere'),

    -- «A inauguração terá lugar no dia 15 de julho, pelas 18h30 na Galeria
    --  Carlos Saramago, do Centro Cultural Elvino Pereira.»
    ('exposicao-na-paisagem-do-medio-tejo-a-fotografia-como-mediacao-cultural-d8e4a1',
     'Galeria Carlos Saramago, Centro Cultural Elvino Pereira, Mação'),

    -- «Saída: 07h30, da Várzea Grande (junto à Rodoviária)» — o passeio é a
    -- Alpiarça e a Almeirim, fora da região; o que interessa a quem vai é
    -- onde se apanha o autocarro.
    ('passeio-anual-do-idoso-2026-c934cf',
     'Partida na Várzea Grande, junto à Rodoviária, Tomar'),

    -- «todos os sábados – Jardim Zona Verde às 19h30h e domingos às 10h00m,
    --  no jardim em frente às Piscinas Municipais.»
    ('verao-ativo-2026-yoga-234c67',
     'Jardim Zona Verde e jardim das Piscinas Municipais, Entroncamento'),

    -- «Em parceria com os ginásios Bless Fitness e Entre-Linhas» — e o
    -- programa da própria descrição lista as aulas debaixo de cada um.
    ('municipio-promove-desporto-ao-ar-livre-em-julho-e-agosto-verao-ativo-ginasios-18a07a',
     'Ginásios Bless Fitness e Entre-Linhas, Entroncamento'),

    -- «transforma as ruas, praças e recantos da cidade — do Convento de
    --  Cristo ao Jardim do Mouchão — num grande palco a céu aberto.»
    -- Fica «ruas e praças» e não a lista dos oito palcos: um festival de rua
    -- não tem morada, tem cidade, e é isso que a fonte diz.
    ('art-in-rua-2026-a6c144',
     'Ruas e praças de Tomar'),

    -- «Realiza-se nos dias 18 e 19 de setembro a Festa no desportivo da
    --  Igreja Nova do Sobral.» Já dizia «Igreja Nova do Sobral» desde a 0060;
    -- passa a dizer qual é o sítio dentro da terra.
    ('festa-do-desportivo-de-igreja-nova-e30421',
     'Desportivo de Igreja Nova do Sobral'),

    -- «A PARÓQUIA DE MARTINCHEL […] ANDORES COM BOLOS […] QUE DEPOIS SERÃO
    --  LEILOADOS NO RECINTO DE FESTAS.» As coordenadas de Martinchel ficam:
    -- são as da terra, e o recinto é lá.
    ('festa-de-verao-em-honra-de-s-sebastiao-bca7b9',
     'Recinto de festas de Martinchel')
  ) as t(evento, sitio)
  loop
    update public.events
       set location_name = r.sitio, updated_at = now()
     where slug = r.evento and status = 'published'
    returning id into v_id;

    -- Numa base sem dados — a verificação de migrações — não há eventos, e não
    -- há nada para bloquear.
    if v_id is not null then
      perform public.lock_event_fields(
        v_id, array['location_name'], 'levantamento de moradas 2026-08-29',
        'Sítio lido da descrição que a própria fonte publica e que já estava guardada aqui. Proposto por um levantamento externo e confirmado contra essa descrição — o que o levantamento propunha e a descrição não dizia ficou de fora.'
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
begin
  -- A conta é «quantos destes oito existem nesta base», e não «oito».
  --
  -- Numa base acabada de construir — a verificação de migrações — os eventos da
  -- recolha não existem, e a asserção fixa em oito reprovava uma migração que
  -- está certa. Em produção existem os oito, e a conta continua a apanhar um
  -- slug que deixe de casar, que é o defeito que interessa apanhar.
  select count(*) into esperados
    from public.events
   where status = 'published'
     and slug in (
       'congresso-do-desporto-5f018a',
       'exposicao-na-paisagem-do-medio-tejo-a-fotografia-como-mediacao-cultural-d8e4a1',
       'passeio-anual-do-idoso-2026-c934cf',
       'verao-ativo-2026-yoga-234c67',
       'municipio-promove-desporto-ao-ar-livre-em-julho-e-agosto-verao-ativo-ginasios-18a07a',
       'art-in-rua-2026-a6c144',
       'festa-do-desportivo-de-igreja-nova-e30421',
       'festa-de-verao-em-honra-de-s-sebastiao-bca7b9'
     );

  select count(*) into n
    from public.manual_overrides
   where actor = 'levantamento de moradas 2026-08-29';
  assert n = esperados,
    format('%s bloqueios escritos para %s eventos presentes — algum slug deixou de casar', n, esperados);

  -- Nenhum destes oito pode ter ficado a dizer só o nome do concelho: era
  -- disso mesmo que se estava a sair.
  select count(*) into n
    from public.events e
    join public.manual_overrides o on o.event_id = e.id and o.field = 'location_name'
   where o.actor = 'levantamento de moradas 2026-08-29'
     and e.location_name in (select name from public.municipalities);
  assert n = 0, format('%s eventos continuam a dizer só o nome do concelho', n);
end $$;

commit;
