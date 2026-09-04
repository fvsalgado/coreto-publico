-- 0098 — Quatro fichas ganham fotografia, e a busca por texto dá lugar à
-- busca por distância.
--
-- ## Como se procurou, e porque é que da primeira vez não deu
--
-- A busca por texto no Wikimedia Commons devolve lixo para nomes como
-- «Biblioteca Municipal de Mação»: vieram PDFs de anais brasileiros, crónicas
-- de D. Fernando e relatórios do IBGE. O motor procura em todo o texto de
-- todos os ficheiros, e um nome genérico casa com tudo.
--
-- **A busca que serve é geográfica.** O Commons sabe onde é que cada
-- fotografia foi tirada, e nós sabemos onde é que cada espaço está. Pedir
-- «tudo o que foi fotografado a menos de 150 m deste ponto» devolve o
-- edifício e a rua dele, e nada de Goiás.
--
-- Foi assim que se acharam estas quatro, e é assim que se acham as próximas.
--
-- ## As quatro, e a distância que as prova
--
--   · **quARTel de Abrantes** — a fotografia está a **40 m** do ponto que o
--     próprio museu publica, e a legenda diz «galeria de arte em Abrantes, na
--     antiga sede dos Bombeiros Municipais». É o edifício.
--   · **Casa Manuel Guimarães, Tomar** — a **9 m**. Aqui há uma coisa a
--     registar: o ficheiro chama-se «Casa Manuel Guimarães» mas a legenda
--     descreve «a fachada quinhentista do prédio da Rua Direita da Várzea
--     Pequena, esquina da Rua dos Oleiros», e a nossa ficha diz Rua Alexandre
--     Herculano. Nove metros não deixam dúvida de que é o mesmo prédio — o
--     que fica por saber é qual das três ruas é a da porta.
--   · **Exposição da Festa dos Tabuleiros** — a **23 m**: é o Convento de São
--     Francisco, que a alberga. O Museu dos Fósforos já usa outra fotografia
--     do mesmo convento, do mesmo autor. Duas casas na mesma casa, duas
--     fotografias diferentes dela.
--   · **Galeria do Parque, Barquinha** — a **24 m**: são os Paços do
--     Concelho, que é a morada da galeria.
--
-- ## O que isto não é
--
-- **Não é a fotografia do interior de nenhum destes espaços** — é a do
-- edifício onde estão. Para o Museu dos Fósforos a casa já tinha decidido
-- assim, e é a decisão certa: quem chega precisa de reconhecer a porta.
--
-- ## Onde não havia nada
--
-- Doze dos dezasseis espaços sem fotografia não têm **uma única imagem
-- geolocalizada a 150 m** no Commons: o museu e o mercado de Alcanena, o
-- CAORG de Minde, o Museu dos Rios, o centro cultural do Entroncamento, o
-- cine-teatro e o centro cultural de Mação, o centro cultural da Barquinha.
-- Não é falha da procura — é que ninguém os fotografou e publicou com
-- licença livre. Resolve-se com uma máquina fotográfica, não com pesquisa.

update public.venues v set
  image_url = d.url,
  image_credit = d.credito,
  notes = coalesce(v.notes || ' ', '') || d.nota,
  updated_at = now()
from (values

  ('quartel-galeria-abrantes',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Quartel_da_Arte_Contempor%C3%A2nea_de_Abrantes.jpg?width=1600',
   'GualdimG, CC BY-SA 4.0, via Wikimedia Commons',
   'Levantamento 2026-09-01: fotografia do Commons, achada por busca geográfica — está a 40 m do '
   'ponto que o museu publica, e a legenda descreve a galeria na antiga sede dos Bombeiros '
   'Municipais.'),

  ('casa-manuel-guimaraes',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Casa_Manuel_Guimar%C3%A3es_Tomar.jpg?width=1600',
   'Jfilipemo, CC BY-SA 4.0, via Wikimedia Commons',
   'Levantamento 2026-09-01: fotografia do Commons a 9 m do nosso ponto. O ficheiro chama-se '
   '«Casa Manuel Guimarães Tomar» mas a legenda descreve «a fachada quinhentista do prédio da Rua '
   'Direita da Várzea Pequena, esquina da Rua dos Oleiros» — e a nossa ficha diz Rua Alexandre '
   'Herculano. À distância que estão é o mesmo prédio; a rua da porta é que fica por confirmar.'),

  ('exposicao-festa-dos-tabuleiros',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Convento_de_S%C3%A3o_Francisco_-_Tomar_-_Portugal_(52906118808).jpg?width=1600',
   'Vitor Oliveira from Torres Vedras, PORTUGAL, CC BY-SA 2.0, via Wikimedia Commons',
   'Levantamento 2026-09-01: fotografia do Convento de São Francisco, que alberga a exposição, a '
   '23 m do ponto. É outra imagem do mesmo convento e do mesmo autor que a do Museu dos Fósforos '
   '— as duas coleções estão na mesma casa.'),

  ('galeria-do-parque',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Enquadramento_da_C%C3%A2mara_Municipal_de_Vila_Nova_da_Barquinha.jpg?width=1600',
   'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
   'Levantamento 2026-09-01: fotografia dos Paços do Concelho, que é a morada da galeria, a 24 m '
   'do ponto. É o edifício e não a sala.')

) as d(id, url, credito, nota)
where v.id = d.id;

-- ---------------------------------------------------------------------------
do $$
declare
  n      integer;
  quatro constant text[] := array['quartel-galeria-abrantes','casa-manuel-guimaraes',
                                  'exposicao-festa-dos-tabuleiros','galeria-do-parque'];
begin
  -- Postcondições sobre estas quatro linhas. Numa base vazia contam zero.

  -- 1. Nenhuma fotografia entra sem crédito. É a licença que o exige, e é o
  --    que separa usar de tirar.
  select count(*) into n
  from public.venues
  where image_url is not null and image_credit is null;

  if n > 0 then
    raise exception '% fotografia(s) sem crédito de autor e licença', n;
  end if;

  -- 2. As quatro ficaram mesmo com imagem.
  select count(*) into n
  from public.venues where id = any(quatro) and image_url is null;

  if n > 0 then
    raise exception '% das quatro fichas continuam sem fotografia', n;
  end if;

  -- 3. Todo o crédito do Commons diz de onde vem. Sem essa linha a ficha
  --    mostra a fotografia de alguém sem dizer de quem é.
  select count(*) into n
  from public.venues
  where image_url like '%commons.wikimedia.org%'
    and image_credit !~ 'via Wikimedia Commons';

  if n > 0 then
    raise exception '% crédito(s) de fotografia do Commons não dizem que vêm de lá', n;
  end if;

  select count(*) into n from public.venues where image_url is not null;
  raise notice '% espaços com fotografia', n;
end
$$;
