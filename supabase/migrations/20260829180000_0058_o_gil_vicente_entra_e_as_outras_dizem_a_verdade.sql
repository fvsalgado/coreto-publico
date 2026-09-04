-- 0058 — O Gil Vicente entra, e as outras nove passam a dizer a verdade
--
-- Sondagem de 2026-08-29 às dez fontes de espaço que estavam registadas e
-- desligadas. Todas responderam 200. Só uma tem programação datada para ler.
--
--   Centro Cultural Gil Vicente  9 posts, 8 com dia e hora   →  LIGA
--   Santuário de Fátima          4 itens, metade é ofício    →  decisão editorial
--   Ourearte                     data-events="[]"            →  calendário vazio
--   Visit Barquinha              3 fichas de turismo         →  não é agenda
--   Casa do Povo de Minde        «não foram encontrados»     →  bilheteira vazia
--   Espalhafitas                 Wix, zero datas no HTML     →  montado no browser
--   Museu Nacional Ferroviário   prosa sobre o Festival Vapor→  sem lista datada
--   CCV do Alviela               morada, horário, contactos  →  sem atividades
--   Univ. Politécnica de Tomar   zero blocos com data        →  agenda vazia
--   Cineclube de Torres Novas    última entrada em 2011      →  blogue parado
--
-- As `public_note` das nove são reescritas. As que lá estavam descreviam o que
-- se esperava encontrar — «a loja não abre os dados sem credenciais», «são
-- poucos por ano e nem sempre com data fechada» — e nenhuma dessas frases
-- sobreviveu ao contacto com a página. Uma página pública que promete uma fonte
-- que não existe é pior do que uma que diz que não há nada: manda quem lê à
-- procura de programação que ninguém publicou.

begin;

-- ---------------------------------------------------------------------------
-- A que entra.
-- ---------------------------------------------------------------------------
--
-- O tema WordPress do Gil Vicente põe DUAS datas em cada cartão: `.date_label`
-- diz quando o post foi escrito («27 de Julho, 2026») e `.post-excerpt` diz
-- quando o espetáculo é («10/outubro | 21h30»). Ler o cartão inteiro trazia a
-- primeira — sempre uma data válida, e sempre a errada, que é como o feed de
-- Minde publicou vinte e um eventos já passados. Daí `dateOnlyFromSelector`:
-- sem `.post-excerpt`, o item fica sem data e vai à moderação, onde uma pessoa
-- abre a página e decide. É o caso do nono post da listagem, que é o programa
-- de cinema do mês e não um espetáculo com dia.
--
-- `venueName` casa com `centro-cultural-gil-vicente` no catálogo, que já sabe
-- que a casa é no Sardoal. A página não diz onde é porque é toda de uma casa só.
update public.sources
   set url = 'https://ccgv.sardoal.pt/programacao/',
       adapter = 'generic-html',
       kind = 'venue_site',
       config = jsonb_build_object(
         'listSelector', jsonb_build_array('article.post-item'),
         'titleSelector', jsonb_build_array('h3.entry-title'),
         'linkSelector', jsonb_build_array('h3.entry-title a'),
         'dateSelector', jsonb_build_array('.post-excerpt'),
         'timeSelector', jsonb_build_array('.post-excerpt'),
         'imageSelector', jsonb_build_array('img.wp-post-image'),
         'dateOnlyFromSelector', true,
         'venueName', 'Centro Cultural Gil Vicente'
       ),
       -- A listagem é a temporada inteira, não a semana: em agosto de 2026
       -- mostrava de outubro a dezembro. Um mínimo de 1 é honesto — se a
       -- página esvaziar, ou é fim de temporada ou o tema mudou, e nos dois
       -- casos alguém tem de ir ver.
       min_expected_items = 1,
       baseline_item_count = null,
       is_enabled = true,
       public_note = 'A programação do Centro Cultural Gil Vicente, lida do sítio da própria casa. A sala escreve as datas como «10/outubro | 21h30» e não põe o ano — quem recolhe assume o ano que põe a data no futuro próximo, que é o que uma agenda quer dizer.',
       notes = 'Ligada a 2026-08-29. O tema mostra duas datas por cartão: `.date_label` é a publicação do post e `.post-excerpt` é o espetáculo. `dateOnlyFromSelector` impede que a primeira seja lida como se fosse a segunda; um cartão sem excerpt fica sem data e vai à fila. Calibrado contra a fixture `ccgv-sardoal.html` em `packages/ingest/src/__fixtures__`.',
       updated_at = now()
 where id = 'ccgv-sardoal';

-- ---------------------------------------------------------------------------
-- As nove que ficam de fora, cada uma com o que a sondagem encontrou.
-- ---------------------------------------------------------------------------

-- Não é impedimento técnico: o adaptador lê esta página hoje. É que metade do
-- que ela traz é ofício diário, e o Coreto é uma agenda cultural.
update public.sources
   set public_note = 'O santuário publica em `/pt/events` uma lista curta e bem estruturada. Metade do que lá está são celebrações do dia — «Celebrações e Grupos no dia 29 de agosto», o rosário na Capelinha — que se repetem todos os dias do ano. Ligar isto enchia a agenda de Ourém com um ofício por dia e afogava a programação que se procura aqui. Fica por ligar por escolha, não por falta de meio.',
       notes = 'Sondagem 2026-08-29: 4 itens em div.event, com data («28 ago» + «2026»), título em h3 e ligação própria — tecnicamente ligável com generic-html a qualquer momento. 2 dos 4 eram horário litúrgico diário. A decisão de não ligar é editorial e é de quem manda no projeto, não do recoletor.',
       updated_at = now()
 where id = 'fatima-eventos';

update public.sources
   set public_note = 'A escola tem um calendário de eventos no sítio, e a 29 de agosto de 2026 estava vazio — sem um único evento marcado. Volta a ver-se quando houver programação publicada.',
       notes = 'Sondagem 2026-08-29: o calendário é o widget Elementor «EAEL Event Calendar» e serve data-events="[]". Os eventos entrariam por esse atributo, o que dá um adaptador simples de escrever — quando houver eventos.',
       updated_at = now()
 where id = 'ourearte-eventos';

update public.sources
   set public_note = 'A categoria «eventos» do turismo do município não é uma agenda: são três fichas do género «o que fazer», que ficam no sítio depois de a edição passar. A 29 de agosto de 2026 a primeira anunciava uma mostra «de 15 de março a 19 de abril». O que a Barquinha marca continua a entrar pela agenda da câmara.',
       notes = 'Sondagem 2026-08-29: 3 posts do tipo o_que_fazer (grelha Divi, div.dp-dfg-item), sem ano nas datas e com conteúdo desatualizado — a ficha diz «III Mostra de Peixe do Rio» e a alcunha do endereço ainda diz ii-mostra-de-peixe-do-rio. Recolher isto punha eventos de março a aparecer em agosto.',
       updated_at = now()
 where id = 'visitbarquinha-eventos';

update public.sources
   set public_note = 'A bilheteira da Casa do Povo estava sem nada à venda a 29 de agosto de 2026. Não é uma questão de acesso — a loja é pública e responde; está mesmo vazia. Volta a ver-se quando houver bilhetes.',
       notes = 'Sondagem 2026-08-29: loja WooCommerce que responde «Não foram encontrados produtos correspondentes à sua pesquisa», zero li.product. A nota anterior dizia que a loja não abria os dados sem credenciais, e isso era falso.',
       updated_at = now()
 where id = 'cpminde-bilheteira';

update public.sources
   set public_note = 'O cineclube publica a programação num sítio que a monta no browser: o que o servidor entrega não tem uma única data. Quem recolhe lê o que o servidor entrega, e aqui não há nada para ler. A alternativa é o cineclube enviar a programação por email.',
       notes = 'Sondagem 2026-08-29: sítio Wix; zero ocorrências de data em português nos 213 kB de HTML servido. A programação é montada por JavaScript e o recoletor não executa JavaScript, por desenho — um recoletor com browser é outra ordem de custo e de intrusão.',
       updated_at = now()
 where id = 'espalhafitas-programacao';

update public.sources
   set url = 'https://www.fmnf.pt/pt/servico-ao-cliente/programacao-e-eventos-especiais/',
       public_note = 'A página de programação do museu é um texto corrido sobre o Festival Vapor, e não uma lista de datas. O museu tem programação; o sítio não a publica de forma que se possa ler automaticamente.',
       notes = 'Sondagem 2026-08-29: encontrado o endereço verdadeiro da programação (o registado antes era a raiz do sítio) e fica corrigido aqui. A página é prosa: nenhum bloco repetido, nenhuma data listada. Não há listagem para um adaptador ler.',
       updated_at = now()
 where id = 'mnf-agenda';

update public.sources
   set url = 'https://alviela.cienciaviva.pt/25/Atividades',
       public_note = 'A página de atividades do Carsoscópio traz a morada, o horário e os contactos — e nenhuma atividade com data. O que o centro faz não está publicado dia a dia.',
       notes = 'Sondagem 2026-08-29: endereço da secção de atividades corrigido (o registado antes era a raiz). A página tem 1 159 caracteres visíveis, todos de mobília do sítio. Sem atividades datadas não há nada a recolher.',
       updated_at = now()
 where id = 'ccv-alviela-agenda';

update public.sources
   set public_note = 'A agenda do politécnico responde, mas estava vazia a 29 de agosto de 2026 — que é o que se espera de agosto. Volta a ver-se com o ano letivo a andar.',
       notes = 'Sondagem 2026-08-29: /pt/agenda responde 200 sem um único bloco com data, e as catorze categorias (/pt/agenda/exposicoes, /pt/agenda/conferencias, …) devolvem a mesma página com o mesmo tamanho. As duas datas do documento são do rodapé. Ligar seletores contra uma página vazia é adivinhar — revisitar em setembro e calibrar contra eventos verdadeiros.',
       updated_at = now()
 where id = 'ipt-agenda';

update public.sources
   set public_note = 'O blogue do cineclube está parado: a última entrada é de dezembro de 2011. As sessões de Torres Novas continuam a entrar pelo Teatro Virgínia, que as publica com hora.',
       notes = 'Sondagem 2026-08-29: o feed Atom tem 25 entradas e a mais recente é de 2011-12-15. Quinze anos parado não é uma fonte à espera de adaptador. A nota anterior discutia se a data da entrada era a da sessão — discussão sem objeto.',
       updated_at = now()
 where id = 'cineclube-torres-novas-blog';

-- ---------------------------------------------------------------------------
-- O que tem de continuar verdade.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  cfg jsonb;
begin
  select config into cfg from public.sources where id = 'ccgv-sardoal';
  assert cfg is not null, 'ccgv-sardoal desapareceu';

  -- Sem isto o adaptador lê `.date_label` — a data de publicação do post — e
  -- publica espetáculos de julho que já aconteceram. É a asserção que impede
  -- que um `update` de configuração em SQL deite a guarda abaixo sem passar
  -- pelo teste que a prova (`generic-html.test.ts`).
  assert cfg -> 'dateOnlyFromSelector' = 'true'::jsonb,
    'ccgv-sardoal sem dateOnlyFromSelector: leria a data de publicação do post';
  assert cfg -> 'dateSelector' = '[".post-excerpt"]'::jsonb,
    'ccgv-sardoal com outro seletor de data — recalibrar contra a fixture antes de mudar';
  assert cfg ->> 'venueName' = 'Centro Cultural Gil Vicente',
    'ccgv-sardoal sem o nome do espaço: os eventos ficavam sem casa e sem concelho';

  select count(*) into n from public.sources where id = 'ccgv-sardoal' and is_enabled;
  assert n = 1, 'ccgv-sardoal devia ficar ligada';

  -- Todas as dez foram sondadas e todas ficam com o que se encontrou escrito.
  -- Uma fonte desligada sem razão é uma fonte que ninguém sabe se ainda faz
  -- sentido: daqui a um ano, quem a olhar não tem de repetir a sondagem.
  select count(*) into n from public.sources
   where id in ('fatima-eventos', 'ourearte-eventos', 'visitbarquinha-eventos',
                'cpminde-bilheteira', 'espalhafitas-programacao', 'mnf-agenda',
                'ccv-alviela-agenda', 'ipt-agenda', 'cineclube-torres-novas-blog')
     and (is_enabled or notes not like 'Sondagem 2026-08-29%');
  assert n = 0, format('%s das nove fontes sondadas sem a razão escrita, ou ligada por engano', n);
end $$;

commit;
