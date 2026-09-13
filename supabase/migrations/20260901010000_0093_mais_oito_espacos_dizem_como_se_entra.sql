-- 0093 — Mais oito espaços dizem como se entra.
--
-- A 0090 trouxe quatro fichas do TUR4all. Tinha procurado mal: procurei os
-- nomes que já conhecia. Desta vez varri a plataforma por concelho, e havia lá
-- mais oito espaços do catálogo — em Mação, Tomar, Ourém, Entroncamento,
-- Alcanena, Sardoal e Ferreira do Zêzere (dois).
--
-- Com estes, doze das 106 fichas passam a dizer como se entra, e são as doze
-- que mais importam: são todas de espaços que programam ou que recebem
-- programação.
--
-- ## As ressalvas, que são o que justifica escrever isto
--
-- Nenhuma destas oito é «sim» e mais nada. A cada uma corresponde uma coisa
-- que quem lá vai precisa de saber antes de sair de casa:
--
--   · **Museu de Arte Pré-Histórica (Mação): a circulação é PARCIAL**, e as
--     visitas estão por marcação por causa de obras na envolvente. Fica a
--     `true` porque há elevador amplo com botões em braille, maquetes tácteis
--     e informação em braille — mas quem for não chega a tudo, e tem de
--     telefonar antes.
--   · **Museu Municipal de Ourém: a casa de banho adaptada tem um desnível no
--     acesso.** A ficha do TUR4all diz «Access without changes in floor level:
--     No». Uma casa de banho adaptada a que não se chega não é uma casa de
--     banho adaptada, e isso escreve-se.
--   · **Centro Cultural Gil Vicente (Sardoal): entre pisos só há escada.** O
--     piso de entrada é acessível por rampa e a circulação nele é total, mas
--     não há elevador. Quem programa no auditório e quem programa na galeria
--     têm de saber que não é o mesmo caso.
--   · **Biblioteca de Ferreira do Zêzere: a porta da casa de banho adaptada
--     tem menos de 78 cm.** É estreita para uma cadeira de rodas, e a ficha
--     diz que sim à casa de banho — as duas coisas ao mesmo tempo, que é
--     precisamente porque a nota existe.
--
-- E há uma boa notícia que também não cabe num booleano: **o Cineteatro São
-- João, no Entroncamento, tem lugares reservados para cadeira de rodas na
-- sala e estacionamento reservado à porta com as dimensões certas.** Isso é
-- mais do que «acessível»; é uma casa preparada.
--
-- **O TUR4all continua a não datar as avaliações**, e continua a ficar escrito
-- em todas. Uma rampa muda com obras. A ficha continua a dizer que na dúvida
-- vale a pena telefonar, e continua a ter razão.
--
-- ## O que não muda
--
-- Continua a não haver acessibilidade nenhuma declarada nos eventos: 0 em
-- 148. Língua gestual, audiodescrição e sessão relaxada são do espetáculo e
-- não da casa, e nenhuma fonte da região as publica. A página continua a
-- dizer que não sabe, em vez de dizer que não há.

update public.venues v set
  wheelchair_accessible = d.acessivel,
  accessibility_notes = d.nota,
  updated_at = now()
from (values
  ('museu-arte-pre-historica-macao', true,
   'Avaliado pelo TUR4all, e a ressalva vem primeiro: a circulação em cadeira de rodas é PARCIAL, '
   'e as visitas estão por marcação por causa de obras na envolvente — convém telefonar antes de '
   'ir. Entra-se por porta alternativa com 78 cm ou mais. Há elevador amplo, com informação '
   'visual e botões em braille em relevo à altura de quem vai sentado. As escadas interiores têm '
   'mais de três degraus, com corrimão. Tem maquetes tácteis, informação em braille, visitas '
   'adaptadas e pessoal de atendimento. A iluminação das zonas de circulação está assinalada como '
   'inadequada. O TUR4all não data a avaliação.'),

  ('museu-dos-fosforos', true,
   'Avaliado pelo TUR4all, com distintivo de acessibilidade. Circulação em cadeira de rodas '
   'total, porta de entrada com 78 cm ou mais, iluminação adequada e nenhum obstáculo para quem '
   'tem baixa visão. O mobiliário permite a aproximação de quem vai em cadeira de rodas, e há '
   'pessoal de atendimento e documentação sobre a visita. A ficha não avalia casa de banho '
   'adaptada. O TUR4all não data a avaliação.'),

  ('museu-municipal-ourem', true,
   'Avaliado pelo TUR4all, e há uma ressalva que conta: a casa de banho é adaptada — porta larga, '
   '150 cm de espaço de manobra, barras rebatíveis dos dois lados — mas o acesso a ela tem um '
   'desnível. Fora isso, a circulação em cadeira de rodas é total, com elevador amplo de botões '
   'em braille e cor contrastada. As escadas têm mais de três degraus, com corrimão. Cães de '
   'assistência são permitidos, há informação em braille e pessoal preparado para apoiar quem '
   'precisa. O TUR4all não data a avaliação.'),

  ('cine-teatro-sao-joao-entroncamento', true,
   'Avaliado pelo TUR4all, com distintivo de acessibilidade, e é dos mais bem preparados da '
   'região: circulação em cadeira de rodas total, lugares reservados na sala para cadeira de '
   'rodas e para pessoas com mobilidade reduzida, casa de banho adaptada sem desnível no acesso, '
   'com 150 cm de manobra e barras dos dois lados, e estacionamento reservado à porta com as '
   'dimensões certas. A sinalética tem texto ampliado. Entra-se por porta alternativa com 78 cm '
   'ou mais. A ressalva é lá fora: o pavimento do passeio não é uniforme nem antiderrapante. '
   'O TUR4all não data a avaliação.'),

  ('mercado-municipal-alcanena', true,
   'Avaliado pelo TUR4all. Entrada sem degraus, com porta de 78 cm ou mais; circulação em cadeira '
   'de rodas total, iluminação adequada e sinalética com texto ampliado e em relevo. Casa de '
   'banho adaptada sem desnível no acesso, com sanita alta e barras dos dois lados. Há '
   'estacionamento reservado junto ao mercado, mas sem as dimensões adequadas, e o pavimento '
   'exterior é de calçada, não uniforme. O TUR4all não data a avaliação.'),

  ('centro-cultural-gil-vicente', true,
   'Avaliado pelo TUR4all, com uma ressalva que decide a ida: entre pisos só há escada, sem '
   'elevador. No piso de entrada, entra-se por rampa com corrimão e a circulação em cadeira de '
   'rodas é total, com lugares reservados na sala. A casa de banho adaptada não tem desnível no '
   'acesso e tem barra de apoio do lado direito, mas não tem os 150 cm de espaço de manobra. O '
   'estacionamento reservado não é junto ao edifício, e a iluminação está assinalada como '
   'inadequada. O TUR4all não data a avaliação.'),

  ('biblioteca-municipal-ferreira-do-zezere', true,
   'Avaliada pelo TUR4all, com distintivo de acessibilidade. Circulação em cadeira de rodas '
   'total, iluminação adequada e sinalética visual; cães de assistência permitidos. A casa de '
   'banho é adaptada e sem desnível no acesso, com barras dos dois lados e espaço livre para a '
   'transferência — mas a porta tem menos de 78 cm e não há os 150 cm de manobra, o que a torna '
   'apertada para muitas cadeiras. A porta de entrada é de vidro sem marcação visual, e o '
   'passeio é de calçada, não uniforme. O TUR4all não data a avaliação.'),

  ('mercado-municipal-ferreira-do-zezere', true,
   'Avaliado pelo TUR4all, com distintivo de acessibilidade. Entrada por rampa com corrimão e '
   'aviso visual e táctil; circulação em cadeira de rodas total, com sinalética em cor '
   'contrastada e caracteres ampliados. Tem vários pisos, servidos por elevador amplo com '
   'informação visual e botões em braille à altura de quem vai sentado. Casa de banho adaptada '
   'sem desnível, com 150 cm de manobra e barras dos dois lados. O estacionamento reservado é '
   'junto ao mercado, mas sem as dimensões adequadas. O TUR4all não data a avaliação.')
) as d(id, acessivel, nota)
where v.id = d.id;

-- ---------------------------------------------------------------------------
do $$
declare
  sem_nota     integer;
  sem_ressalva integer;
  sem_data     integer;
  n            integer;
begin
  -- Postcondições sobre estas oito linhas: numa base vazia passam caladas.

  select count(*) into sem_nota
  from public.venues
  where id in ('museu-arte-pre-historica-macao','museu-dos-fosforos','museu-municipal-ourem',
               'cine-teatro-sao-joao-entroncamento','mercado-municipal-alcanena',
               'centro-cultural-gil-vicente','biblioteca-municipal-ferreira-do-zezere',
               'mercado-municipal-ferreira-do-zezere')
    and (accessibility_notes is null or wheelchair_accessible is null);

  if sem_nota > 0 then
    raise exception '% dos oito espaços do TUR4all ficaram sem nota ou sem resposta', sem_nota;
  end if;

  -- As quatro ressalvas que não podem desaparecer numa reescrita distraída:
  -- são elas que impedem alguém de sair de casa a contar com o que não há.
  select count(*) into sem_ressalva
  from public.venues
  where (id = 'museu-arte-pre-historica-macao'        and accessibility_notes !~* 'parcial')
     or (id = 'museu-municipal-ourem'                 and accessibility_notes !~* 'desnível')
     or (id = 'centro-cultural-gil-vicente'           and accessibility_notes !~* 'entre pisos só há escada')
     or (id = 'biblioteca-municipal-ferreira-do-zezere' and accessibility_notes !~* 'menos de 78 cm');

  if sem_ressalva > 0 then
    raise exception
      'saiu da nota uma das quatro ressalvas que decidem a ida (Mação parcial, Ourém desnível, '
      'Sardoal escada, Ferreira porta estreita)';
  end if;

  -- Toda a nota que vem do TUR4all diz que o TUR4all não data a avaliação.
  -- Sem essa linha, a ficha afirma sobre hoje o que foi visto num dia que não
  -- se sabe qual é.
  select count(*) into sem_data
  from public.venues
  where accessibility_notes ~* 'TUR4all'
    and accessibility_notes !~* 'não data a avaliação';

  if sem_data > 0 then
    raise exception '% nota(s) do TUR4all deixaram de dizer que a avaliação não tem data', sem_data;
  end if;

  select count(*) into n from public.venues where accessibility_notes is not null;
  raise notice '% espaços dizem como se entra', n;
end
$$;
