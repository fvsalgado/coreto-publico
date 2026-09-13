-- 0090 — Quatro espaços passam a dizer como se entra.
--
-- A pergunta do dono foi «0 % em 148, dá para melhorar?». A resposta curta é
-- sim, mas não por onde eu procurei primeiro.
--
-- ## Onde não está
--
-- **Não está no texto dos eventos.** Procurei nas descrições dos 148
-- publicados por acesso, mobilidade reduzida, cadeira de rodas, língua
-- gestual, audiodescrição, sessão relaxada e legendagem. Três aparências, e as
-- três são falsas amigas: «uma experiência acessível», «oferta cultural mais
-- acessível», «um percurso acessível a todas as idades». Nenhuma é uma
-- declaração de acessibilidade. O extractor está certo em não as apanhar — é o
-- mesmo cuidado que o classificador tem com a palavra «concerto».
--
-- **Não está no OpenStreetMap.** A etiqueta `wheelchair` não existe em nenhum
-- dos quatro equipamentos melhor mapeados da região (Museu dos Rios,
-- Cine-Teatro de Mação, Convento de Cristo, Museu Nacional Ferroviário).
--
-- ## Onde está
--
-- No **TUR4all**, a plataforma portuguesa de turismo acessível, que avalia
-- edifícios ao pormenor — largura de porta, inclinação de rampa, barras de
-- apoio, espaço de manobra. Quatro espaços do catálogo lá estão, e são todos
-- de quem programa: o Teatro Virgínia, a Biblioteca Gustavo Pinto Lopes, o
-- Museu Nacional Ferroviário e o Convento de Cristo.
--
-- ## O que muda, e porque é que a nota importa mais do que o booleano
--
-- Cinco espaços já tinham `wheelchair_accessible` a `true` — e nenhum tinha
-- uma linha a explicar o quê. «Tem acesso a cadeiras de rodas» é uma frase
-- que manda alguém sair de casa, e há maneiras muito diferentes de ser
-- verdade:
--
--   · **No Teatro Virgínia entra-se por rampa que pode exigir ajuda de outra
--     pessoa.** Quem lá chegue sozinho e conte com a frase, fica à porta. Esta
--     é a linha que justifica a migração inteira.
--   · **No Convento de Cristo a circulação é parcial**: o conjunto tem pisos
--     ligados por escadas de mais de três degraus. Fica a `true` porque há
--     entrada acessível, casa de banho adaptada e cadeira de rodas de
--     empréstimo — mas quem for tem de saber que não chega a tudo.
--   · **A Biblioteca Gustavo Pinto Lopes não tinha resposta nenhuma** e passa
--     a ter: circulação total, balcão à altura certa, e fundo em braille com
--     audiolivros e impressora.
--
-- O booleano não sabe dizer «parcial», e não se inventa aqui um estado novo
-- para o esquema. O que se faz é o que a ficha já previa: a nota leva a
-- ressalva, e a página mostra as duas juntas.
--
-- **O TUR4all não data as avaliações**, e isso fica escrito em todas as
-- quatro. Uma rampa muda com obras, e uma avaliação sem data é uma afirmação
-- sobre um momento que não se sabe qual é. Quem for continua a fazer bem em
-- telefonar — e a ficha continua a dizê-lo.
--
-- ## O que não se faz aqui
--
-- Não se toca nos eventos. A acessibilidade de um espetáculo — língua
-- gestual, audiodescrição, sessão relaxada — é do espetáculo e não da casa,
-- e nenhuma fonte da região a publica. Continua a 0 em 148, e a página
-- continua a dizer que não sabe em vez de dizer que não há.

update public.venues v set
  wheelchair_accessible = d.acessivel,
  accessibility_notes = d.nota,
  updated_at = now()
from (values
  ('teatro-virginia', true,
   'Avaliado pelo TUR4all. Entra-se por rampa com corrimão, mas a rampa pode exigir ajuda de '
   'outra pessoa. Lá dentro a circulação em cadeira de rodas é total, há lugares reservados na '
   'sala e casa de banho adaptada com barras dos dois lados. Estacionamento para pessoas com '
   'mobilidade reduzida junto ao teatro, mal sinalizado. A iluminação interior está assinalada '
   'como inadequada. O TUR4all não data a avaliação.'),
  ('biblioteca-gustavo-pinto-lopes', true,
   'Avaliada pelo TUR4all. Circulação em cadeira de rodas total, balcão de atendimento à altura '
   'certa e casa de banho adaptada com espaço de manobra de 150 cm. A sinalética tem texto em '
   'contraste de cor e não há obstáculos para quem tem baixa visão. Tem fundo em braille, '
   'audiolivros e impressora braille. Estacionamento reservado junto à biblioteca, mas mal '
   'sinalizado e sem as dimensões adequadas. O TUR4all não data a avaliação.'),
  ('museu-nacional-ferroviario', true,
   'Avaliado pelo TUR4all. Rampa de entrada com inclinação que permite subir sozinho, circulação '
   'interior total e elevador amplo com informação áudio e visual e botões em braille. Casa de '
   'banho adaptada com 150 cm de espaço de manobra. Estacionamento reservado bem sinalizado. Tem '
   'vídeos legendados, audioguias, guia do museu em linguagem simples, cadeira de rodas para '
   'empréstimo e pessoal com formação em atendimento a pessoas com deficiência. Não tem língua '
   'gestual nem audiodescrição. O TUR4all não data a avaliação.'),
  ('convento-de-cristo', true,
   'Avaliado pelo TUR4all, e a ressalva é a que interessa: a circulação em cadeira de rodas é '
   'PARCIAL — o conjunto tem vários pisos ligados por escadas de mais de três degraus. Entra-se '
   'pela porta alternativa da Sala Multiusos. Há casa de banho adaptada, estacionamento '
   'reservado, cadeira de rodas para empréstimo e pessoal com formação em atendimento. Não há '
   'ninguém com conhecimento de língua gestual. O TUR4all não data a avaliação.')
) as d(id, acessivel, nota)
where v.id = d.id;

-- ---------------------------------------------------------------------------
do $$
declare
  sem_nota    integer;
  com_nota    integer;
  sem_ressalva integer;
begin
  -- Postcondições sobre estas quatro linhas: numa base vazia passam caladas.
  select count(*) into sem_nota
  from public.venues
  where id in ('teatro-virginia','biblioteca-gustavo-pinto-lopes',
               'museu-nacional-ferroviario','convento-de-cristo')
    and (accessibility_notes is null or wheelchair_accessible is null);

  if sem_nota > 0 then
    raise exception '% dos quatro espaços do TUR4all ficaram sem nota ou sem resposta', sem_nota;
  end if;

  -- As duas ressalvas que não podem desaparecer numa reescrita distraída: são
  -- elas que impedem alguém de sair de casa a contar com o que não há.
  select count(*) into sem_ressalva
  from public.venues
  where (id = 'teatro-virginia' and accessibility_notes !~* 'ajuda de outra pessoa')
     or (id = 'convento-de-cristo' and accessibility_notes !~* 'parcial');

  if sem_ressalva > 0 then
    raise exception
      'a ressalva da rampa do Teatro Virgínia ou da circulação parcial do Convento de Cristo saiu da nota';
  end if;

  select count(*) into com_nota from public.venues where accessibility_notes is not null;
  raise notice '% espaços passam a dizer como se entra', com_nota;
end
$$;
