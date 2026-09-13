-- 0077 — As festas da terra, e as sinopses que estavam a uma página de
-- distância.
--
-- Duas correcções que a auditoria dos cinquenta eventos sem categoria e dos
-- trinta e seis sem descrição destapou. São independentes uma da outra e vêm
-- juntas porque foram encontradas na mesma passagem.
--
-- ## I — «Festa de Águas Belas» é uma festa popular
--
-- As regras de título reconheciam `romaria`, `arraial`, `magusto` e «Festa …
-- em honra de». Não reconheciam a forma mais seca, que é a que as juntas de
-- freguesia mais usam: **«Festa de ‹lugar›»**, sem santo declarado. Ficavam
-- de fora seis eventos verdadeiros — Águas Belas, Cem Soldos, Igreja Nova, a
-- Portela com o Colmeal e a Cabeça Ruiva, o Verão de S. Miguel e a procissão
-- de Almogadel.
--
-- A regra nova está em `packages/core/src/taxonomy.ts` e ancora no princípio
-- do título. É a âncora que a torna segura: «Acordeão em Festa!» continua a
-- ser música, e «Festival da Saúde» e «Festival ao Alto» continuam sem
-- categoria, porque um festival é programado por alguém e uma festa da terra
-- acontece porque é aquela semana do ano. Medida contra os 140 títulos
-- publicados: apanha seis, todos certos, e nenhum a mais.
--
-- Esta migração aplica aos eventos já guardados o que a regra passa a
-- decidir. Sem ela, a correcção só chegava à agenda na noite em que a recolha
-- voltasse a correr — e a recolha está parada por falta de executores no
-- GitHub Actions desde as 08:49 de hoje.
--
-- ## II — Oito sinopses que estavam a uma página de distância
--
-- Dos trinta e seis eventos publicados sem descrição, **oito eram defeito
-- nosso**: os do Centro Cultural Gil Vicente. A listagem de `/programacao/`
-- dá título, data e cartaz e mais nada; a sinopse — entre 850 e 1 600
-- caracteres — está só na página de cada espetáculo, e o `generic-html`
-- nunca lá ia.
--
-- O adaptador passa a saber seguir a ligação, com o mesmo ciclo que o
-- `municipal-cms` já usava (agora partilhado em `adapters/detalhe.ts`) e com
-- os seletores declarados pela fonte. **Declarados, e não adivinhados**: o
-- CCGV serve `og:description` a dizer «10/outubro | 21h30» — a data — e um
-- palpite genérico guardá-la-ia como se fosse a sinopse. Um campo com ar de
-- preenchido não volta a ser revisto por ninguém.
--
-- O texto que a seguir se escreve foi extraído pelo próprio adaptador, com
-- esta configuração, contra o sítio a sério, a 30 de agosto de 2026. Não é
-- escrito à mão nem resumido: é o que o Centro Cultural publica.
--
-- ## E os outros vinte e oito, que ficam vazios
--
-- Verificados um a um, e não por amostragem:
--
--   · **Abrantes, 23.** A API — cuja recolha a câmara autorizou — responde
--     com `payload` vazio a vinte deles e com `descricao` em branco aos
--     outros três. Não há texto do lado de lá. Ficam vazios, que é a resposta
--     honesta: nunca se fabrica.
--   · **Minde, Montalvo (duas turmas de yoga) e Serra, 4.** A página da junta
--     repete o título e não diz mais nada.
--   · **Entroncamento, 1.** Este tem descrição na página e o seletor
--     `.eb-description` lê-a hoje (2 813 caracteres). Não é defeito de
--     código: repara-se sozinho na próxima recolha, porque a descrição entra
--     no `content_hash` e a linha vai ser reescrita.
-- ---------------------------------------------------------------------------

-- ------------------------- I. As festas da terra ----------------------------
--
-- A condição espelha a regra do código, para que uma leia como a outra. Se um
-- dia divergirem, é aqui que se vê.
update public.events set
  category_slug = 'festas-populares',
  updated_at = now()
where status = 'published'
  and category_slug is null
  and (
    lower(extensions.unaccent('extensions.unaccent', title)) ~ '\mprocissao\M'
    or lower(extensions.unaccent('extensions.unaccent', title)) ~ '^ ?festas? d[eoa]s? (?!livros?\M|cinema\M|musica\M|teatro\M|danca\M|poesia\M|ciencia\M)'
  );

-- --------------- II. O adaptador passa a ir à página do evento --------------
update public.sources set
  config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
    'followLinks', true,
    'detailDescriptionSelector', jsonb_build_array('.column_attr')
  ),
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: a listagem não traz sinopse nenhuma — está só na '
    'página de cada espetáculo, em `.column_attr`. Passa a ser lida com '
    '`followLinks`. O seletor é declarado e não adivinhado porque o '
    '`og:description` desta casa é a data («10/outubro | 21h30»), e um '
    'palpite genérico guardava-a como se fosse a descrição.',
  updated_at = now()
where id = 'ccgv-sardoal';

-- ------------------- III. E as oito sinopses, já extraídas ------------------
update public.events e set
  description = f.descricao,
  updated_at = now()
from (values
  ('https://ccgv.sardoal.pt/celebratorium-luis-de-freitas-branco/', 'No ano em que se assinala o 136.º aniversário de Luís de Freitas Branco , o Celebratorium presta homenagem a um dos mais importantes compositores portugueses do século XX, numa experiência que alia a excelência da interpretação musical à partilha de conhecimento.

Interpretado pela Camerata de Estudantes do Instituto Superior Técnico e comentado por Sara Maia , este concerto convida o público a descobrir a vida, a obra e o legado de Luís de Freitas Branco, figura incontornável da modernização da música portuguesa. Integrado num ciclo de concertos comentados dedicado aos grandes nomes da música nacional, o espetáculo procura aproximar a música erudita de todos os públicos, revelando o contexto, as histórias e as emoções que dão vida às obras interpretadas.

Mais do que um concerto, Celebratorium é um convite à celebração do património musical português, onde a palavra e a música se encontram para proporcionar uma experiência acessível, envolvente e inspiradora.'),
  ('https://ccgv.sardoal.pt/acordeao-em-festa/', 'Depois do sucesso da primeira edição, o Acordeão em Festa regressa ao Centro Cultural Gil Vicente para celebrar um dos instrumentos mais versáteis e emblemáticos da música popular. Reunindo alguns dos mais talentosos acordeonistas da nova geração e intérpretes de reconhecido mérito, o espetáculo convida o público a embarcar numa viagem musical que cruza tradição, virtuosismo e inovação.

Ao longo de cerca de duas horas, o acordeão revela toda a sua riqueza sonora através de interpretações a solo, em duo e em ensemble, percorrendo um repertório que vai da música tradicional ao repertório clássico e varieté. Cada atuação evidencia não só a elevada qualidade técnica dos músicos, como também a expressividade e a capacidade do acordeão para emocionar públicos de todas as idades.

Uma verdadeira celebração da música e do talento nacional, culminando num emocionante momento final em que todos os intérpretes partilham o palco num grande ensemble.'),
  ('https://ccgv.sardoal.pt/palavra-puxa-palavra/', 'Há palavras que nos mudam. Há outras que despertam memórias, convocam canções, abrem caminho a poemas e nos levam a refletir sobre quem somos. É desse encontro entre a palavra, a música e a emoção que nasce "Palavra Puxa Palavra" , um espetáculo único protagonizado pelo cantautor Rogério Charraz e pelo médico, psiquiatra e comunicador Júlio Machado Vaz .

Num diálogo vivo e imprevisível, a voz falada encontra a voz cantada. As histórias e reflexões de Júlio Machado Vaz entrelaçam-se com as canções de Rogério Charraz, criando uma viagem intimista onde a literatura, a poesia e a música se cruzam com as vivências de cada um. O público é também convidado a participar, sugerindo palavras que ajudam a construir o percurso de cada sessão, tornando cada espetáculo diferente e irrepetível.

Mais do que um concerto ou uma conversa, "Palavra Puxa Palavra" é um convite para escutar, recordar e sentir. Um encontro profundamente humano, onde cada palavra pode ser o início de uma nova história.'),
  ('https://ccgv.sardoal.pt/o-primogenito-stand-up-comedy/', 'No seu quarto solo de stand-up comedy, "O Primogénito" , Dário Guerreiro transforma a própria vida em matéria-prima para um espetáculo de humor inteligente, irreverente e sem filtros. Partindo da experiência de ser o filho mais velho de uma família tudo menos convencional, o comediante algarvio revisita memórias, relações familiares, pequenas tragédias do quotidiano e as grandes absurdidades da vida adulta, com a ironia mordaz e o estilo que conquistaram milhares de seguidores.

Entre histórias pessoais, observações certeiras e um olhar impiedosamente divertido sobre a sociedade, "O Primogénito" confirma Dário Guerreiro como uma das vozes mais originais da nova geração do humor português. Um espetáculo onde cada gargalhada nasce do reconhecimento de que, no fundo, todas as famílias têm os seus segredos… e todas as pessoas têm as suas manias.'),
  ('https://ccgv.sardoal.pt/arte/', 'Três amigos de longa data. Um quadro de arte contemporânea. Uma compra aparentemente banal que desencadeia um confronto tão inesperado quanto hilariante. Em "ARTE" , a premiada dramaturga Yasmina Reza parte de uma situação simples para explorar, com inteligência e um humor mordaz, temas como a amizade, o ego, o gosto, o preconceito e a necessidade humana de ter razão.

Quando um dos amigos adquire uma tela branca por uma quantia avultada, instala-se um debate que rapidamente ultrapassa os limites da arte e expõe as fragilidades, as convicções e as contradições de cada um. Entre discussões acesas, momentos de grande comicidade e reflexões profundamente humanas, o espetáculo revela como os pequenos desacordos podem colocar à prova relações construídas ao longo de uma vida.

Com encenação de António Pires e interpretações de Rui Melo , Cristóvão Campos e Nuno Lopes , ARTE é uma das comédias mais marcantes do teatro contemporâneo. Traduzida para dezenas de idiomas e representada em todo o mundo, continua a conquistar o público pela forma brilhante como nos faz rir de nós próprios, questionando, afinal, o verdadeiro valor da arte... e da amizade.'),
  ('https://ccgv.sardoal.pt/coro-dos-comuns-projeto-caminhos/', 'Integrado no projeto Caminhos , da Comunidade Intermunicipal do Médio Tejo, o Coro dos Comuns é uma celebração da música como espaço de encontro, participação e identidade coletiva. Sob direção do maestro Vítor Ferreira , o projeto reúne vozes de diferentes concelhos da região, promovendo o canto coral como expressão artística, mas também como instrumento de coesão social e valorização do território.

Mais do que um concerto, Coro dos Comuns é um processo de criação partilhada, onde cada participante contribui para a construção de uma sonoridade comum, demonstrando que a diversidade de experiências, idades e percursos se transforma numa força coletiva. O repertório convida o público a uma viagem emocional através de diferentes universos musicais, revelando o poder da voz humana enquanto elemento de comunicação, memória e pertença.

A apresentação no Centro Cultural Gil Vicente integra a estratégia de programação em rede desenvolvida pelos equipamentos culturais do Médio Tejo, reforçando a importância da colaboração, quer entre os membros da Rede de Teatros e Cineteatros Portugueses (RTCP), quer entre os municípios do território do Médio Tejo. Esta parceria permite a circulação de projetos artísticos, aproxima criadores e públicos e contribui para uma oferta cultural mais diversificada, acessível e enraizada no território.

Através da música, o Coro dos Comuns lembra-nos que as vozes individuais ganham uma dimensão maior quando se unem em torno de um propósito comum: cantar, partilhar e construir comunidade.'),
  ('https://ccgv.sardoal.pt/catarinas-por-teatro-maior-de-idade/', 'Uma família reúne-se, tradicionalmente, uma vez por ano para matar fascistas.

Um grupo de pessoas reúne-se, uma vez por semana, para fazer teatro: pensam o mundo de hoje, discutem-no, reinventam-no e ensaiam novas possibilidades de resistência. Fazer uma adaptação deste texto é, portanto, ensaiar a dúvida, levantar perguntas, cozinhar hipóteses e resistir.

Catarinas é uma adaptação da aclamada peça Catarina e a Beleza de Matar Fascistas , de Tiago Rodrigues, que coloca o público perante uma inquietante reflexão sobre os limites da democracia, da liberdade e da resistência.

Nesta versão, apresentada pelo Teatro Maior de Idade , a tradição de uma família confronta-se com a dúvida e o conflito quando uma das suas gerações questiona os valores herdados e a forma como estes devem ser defendidos. Entre a ficção e a realidade, o espetáculo transforma-se num espaço de diálogo sobre o mundo contemporâneo, onde as certezas dão lugar às perguntas e o teatro se afirma como um lugar privilegiado para pensar o presente.

Integrado no projeto Teatro em Formação do Teatro Virgínia , em Torres Novas, Catarinas resulta de um processo de criação que valoriza a participação, a aprendizagem e o envolvimento da comunidade através das artes performativas. A apresentação no Centro Cultural Gil Vicente reforça a importância das parcerias entre equipamentos da Rede de Teatros e Cineteatros Portugueses (RTCP) , promovendo a circulação de projetos artísticos, a partilha de boas práticas e o fortalecimento de uma programação cultural em rede, ao serviço dos territórios e dos seus públicos.'),
  ('https://ccgv.sardoal.pt/focus-sax-quartet/', 'Vencedor do Prémio Jovens Músicos 2023 e distinguido em prestigiados concursos internacionais, o FOCUS Sax Quartet afirma-se como um dos mais promissores ensembles portugueses da nova geração. Formado na Universidade de Évora, o quarteto tem vindo a conquistar o público e a crítica através da qualidade das suas interpretações, da versatilidade do seu repertório e de uma sonoridade que revela todas as potencialidades do saxofone enquanto instrumento de música de câmara.

No concerto LIMIAR , o FOCUS Sax Quartet propõe uma viagem musical por algumas das mais marcantes obras do repertório contemporâneo para quarteto de saxofones. O programa reúne composições de Guillermo Lago , David Maslanka e Philippe Geiss , explorando diferentes linguagens, atmosferas e influências culturais, numa experiência artística que combina virtuosismo, sensibilidade e inovação.

Constituído por Gonçalo Baião (saxofone soprano), Miguel Maia (saxofone alto), Margarida Ferreira (saxofone tenor) e Miguel Jesus (saxofone barítono), o quarteto já atuou em salas de referência como a Casa da Música , o Panteão Nacional e o Museu dos Coches , tendo lançado, em 2024, o seu primeiro álbum, Limiar . O concerto oferece ao público uma oportunidade única para descobrir um ensemble que alia rigor técnico, expressividade e uma abordagem contemporânea da música de câmara.')
) as f(source_url, descricao)
where e.source_id = 'ccgv-sardoal'
  and e.source_url = f.source_url
  and coalesce(e.description, '') = '';

-- ---------------------------------------------------------------------------
do $$
declare
  v_festas    integer;
  v_ccgv_sem  integer;
  v_ccgv_com  integer;
  v_config    jsonb;
  v_enganos   integer;
begin
  -- As duas que já lá estavam mais as seis desta migração. Numa base vazia
  -- não há eventos nenhuns e a asserção passa por não haver o que contar —
  -- por isso conta-se contra zero também.
  select count(*) into v_festas
  from public.events where status = 'published' and category_slug = 'festas-populares';
  if v_festas not in (0, 8) then
    raise exception 'esperavam-se 8 festas populares publicadas e há %', v_festas;
  end if;

  -- E, sobretudo, que a regra não tenha apanhado um festival. Este é o erro
  -- que se teme: uma categoria errada desvia o evento do filtro onde as
  -- pessoas o procuram, e é pior do que nenhuma.
  select count(*) into v_enganos
  from public.events
  where category_slug = 'festas-populares'
    and lower(extensions.unaccent('extensions.unaccent', title)) ~ '\mfestival\M';
  if v_enganos <> 0 then
    raise exception '% festivais foram classificados como festa popular', v_enganos;
  end if;

  -- O CCGV: nenhum espetáculo sem sinopse, salvo o programa de cinema do mês,
  -- que não tem página com texto e por isso nunca chegou a ser publicado.
  select count(*) into v_ccgv_sem
  from public.events
  where source_id = 'ccgv-sardoal' and status = 'published'
    and coalesce(description, '') = '';
  if v_ccgv_sem <> 0 then
    raise exception '% eventos do Gil Vicente continuam sem descrição', v_ccgv_sem;
  end if;

  select count(*) into v_ccgv_com
  from public.events
  where source_id = 'ccgv-sardoal' and status = 'published' and length(description) > 200;
  if v_ccgv_com not in (0, 8) then
    raise exception 'esperavam-se 8 sinopses do Gil Vicente e há %', v_ccgv_com;
  end if;

  -- A configuração que o teste de `generic-html` duplica: se alguém a mudar
  -- aqui sem passar por lá, é este bloco que apanha.
  select config into v_config from public.sources where id = 'ccgv-sardoal';
  if v_config is not null then
    if coalesce((v_config->>'followLinks')::boolean, false) is not true then
      raise exception 'ccgv-sardoal sem followLinks: a sinopse fica na página e não chega cá';
    end if;
    if v_config->'detailDescriptionSelector'->>0 is distinct from '.column_attr' then
      raise exception 'ccgv-sardoal sem o seletor da sinopse na página do evento';
    end if;
  end if;
end
$$;
