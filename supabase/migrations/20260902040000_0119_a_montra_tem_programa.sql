-- 0119 — A montra tem programa.
--
-- O Vale do Coreto (0110) é o que um comprador vê quando carrega em «Ver a
-- montra a funcionar»: dois concelhos, dois espaços, um coreto, um ciclo — e
-- ZERO eventos. A demonstração demonstrava uma agenda vazia, que é o
-- contrário do que se quer mostrar.
--
-- ## O que entra
--
-- Um catálogo de vila: biblioteca, museu, auditório, galeria, um largo e o
-- coreto do jardim como espaços; dois coretos mais no levantamento; um
-- festival e um ciclo ao lado da programação em rede que já cá estava. E
-- trinta eventos, espalhados pelos dois concelhos e por treze categorias
-- (todas menos «Outros») — música, teatro, cinema, exposições em cartaz,
-- dança, folclore, feiras, oficinas, hora do conto —, uns de entrada livre,
-- outros com preço, alguns com o acesso em cadeira de rodas dito, vários
-- dentro dos ciclos.
--
-- **Tudo isto é INVENTADO de propósito.** Nomes de espaços, companhias,
-- grupos, autores, filmes: nenhum existe. A regra da casa é não recolher
-- nada de terceiros, e uma montra com dados verdadeiros de alguém seria
-- exatamente isso. Os eventos entram por `origin = 'manual'` e sem
-- `source_id`: a montra não lê fonte nenhuma, e as schema-checks passam a
-- garanti-lo. Nenhum tem cartaz (`image_url` a nulo): a capa tipográfica é
-- o que se quer mostrar.
--
-- ## As datas são relativas, e a montra renova-se sozinha
--
-- Um seed com datas fixas era uma demonstração com prazo: dois meses depois
-- a agenda estava outra vez vazia, desta vez com um arquivo. As sessões
-- escrevem-se como `current_date + N`, com N de 1 a 60, por isso a montra
-- nasce fresca em qualquer base em que esta migração corra — na produção,
-- e no CI a cada corrida.
--
-- E fica fresca: `public.renovar_montra()` procura os eventos publicados de
-- uma região `montra` que já acabaram e empurra-lhes TODAS as sessões para a
-- frente, no menor múltiplo de 60 dias que os devolva ao futuro. O trigger
-- da 0004 refaz `date_start`/`date_end`, o espaçamento entre sessões
-- mantém-se, e a impressão digital acompanha a data nova. A recolha noturna
-- chama-a pelo PostgREST depois de recolher, como faz à `prune_rate_limits`
-- (0005). É chamada uma vez no fim desta migração — sem nada para mover, mas
-- a função fica exercitada no mesmo dia em que nasce.
--
-- Idempotente: `on conflict (id) do nothing` no catálogo e nos eventos, `on
-- conflict do nothing` nas sessões e nos alias. Correr duas vezes não
-- duplica nada nem empurra data nenhuma.

begin;

-- ---------------------------------------------------------------------------
-- Os espaços. Coordenadas dentro da caixa da região (lat 41,20–41,70;
-- lon −7,40–−6,90), a poucas centenas de metros dos centros dos concelhos.
-- `description` é o que o sítio mostra; `notes` é o caderno, e diz a verdade.
-- ---------------------------------------------------------------------------
insert into public.venues
  (id, name, municipality_id, parish, kind, status, is_association,
   address, latitude, longitude, wheelchair_accessible, description, notes)
values
  ('biblioteca-municipal-da-charamela', 'Biblioteca Municipal da Charamela',
   'vila-da-charamela', 'Vila da Charamela', 'library', 'active', false,
   'Rua da Fonte Velha, 12', 41.4535, -7.1975, true,
   'A biblioteca da vila, numa casa apalaçada do século XIX com a sala de leitura virada ao jardim. '
   'Tem a hora do conto ao fim da manhã e um arquivo de cartazes de festas que ninguém mais tem.',
   'Montra (0119): espaço inventado de propósito. Não existe.'),
  ('museu-do-bombo', 'Museu do Bombo',
   'ponte-do-bombo', 'Ponte do Bombo', 'museum', 'active', false,
   'Largo da Ponte, 1', 41.3225, -7.0485, true,
   'O museu da vila que dá nome ao instrumento — ou o contrário: cem anos de bombos, oficinas de '
   'construção e um pequeno auditório para conversas e concertos de câmara.',
   'Montra (0119): espaço inventado de propósito. Não existe.'),
  ('auditorio-municipal-da-ponte', 'Auditório Municipal da Ponte do Bombo',
   'ponte-do-bombo', 'Ponte do Bombo', 'auditorium', 'active', false,
   'Avenida do Rio, 40', 41.3185, -7.0530, true,
   'Duzentos lugares, palco à italiana e uma acústica pensada para música de câmara e teatro para '
   'a infância. É a sala grande do concelho.',
   'Montra (0119): espaço inventado de propósito. Não existe.'),
  ('galeria-do-relogio', 'Galeria do Relógio',
   'vila-da-charamela', 'Vila da Charamela', 'gallery', 'active', false,
   'Largo do Relógio', 41.4490, -7.2030, false,
   'Uma galeria de exposições no rés-do-chão da torre do relógio da vila, com a máquina de 1887 '
   'ainda a trabalhar lá em cima. Sobe-se à torre em visitas guiadas; não há elevador.',
   'Montra (0119): espaço inventado de propósito. Não existe.'),
  ('largo-da-ponte', 'Largo da Ponte',
   'ponte-do-bombo', 'Ponte do Bombo', 'outdoor', 'active', false,
   'Largo da Ponte', 41.3200, -7.0500, true,
   'O largo à cabeça da ponte, com o coreto ao meio e a Filarmónica de um lado: é onde a vila faz '
   'a feira, o arraial e o festival.',
   'Montra (0119): espaço inventado de propósito. Não existe.'),
  ('coreto-do-jardim-da-charamela', 'Coreto do Jardim da Charamela',
   'vila-da-charamela', 'Vila da Charamela', 'bandstand', 'active', false,
   'Jardim Municipal', 41.4520, -7.2020, true,
   'O coreto de ferro do jardim da vila, de 1912, onde tocam as bandas do ciclo ao fim da tarde. '
   'Os bancos do jardim são a plateia.',
   'Montra (0119): espaço inventado de propósito. Não existe.')
on conflict (id) do nothing;

-- Os dois espaços da 0110 nasceram sem apresentação; ganham uma, se ainda
-- não tiverem.
update public.venues set
  description = 'A sala de espetáculos da vila, de 1948, com trezentos lugares e a cabine de projeção '
             || 'original. É a casa do cineclube e do teatro que passa pelo vale.',
  updated_at = now()
 where id = 'cine-teatro-da-charamela' and description is null;

update public.venues set
  description = 'A coletividade mais antiga da Ponte do Bombo: a banda, a escola de música, o salão de '
             || 'baile e uma cozinha que abre nas noites de fado.',
  updated_at = now()
 where id = 'sociedade-filarmonica-da-ponte' and description is null;

-- ---------------------------------------------------------------------------
-- Os coretos: dois mais no levantamento, e o do jardim ligado ao espaço com
-- o mesmo nome, como os de Tomar e de Ourém na 0080.
-- ---------------------------------------------------------------------------
insert into public.coretos
  (id, name, parish, municipality_id, latitude, longitude, is_confirmed, venue_id, description, notes)
values
  ('coreto-do-largo-da-ponte', 'Coreto do Largo da Ponte', 'Ponte do Bombo', 'ponte-do-bombo',
   41.3202, -7.0498, true, 'largo-da-ponte',
   'O coreto de alvenaria do largo, de planta octogonal, à cabeça da ponte. É à volta dele — e não '
   'em cima — que tocam os grupos de bombos.',
   'Montra (0119): coreto inventado de propósito. Não existe.'),
  ('coreto-da-fonte-do-tamboril', 'Coreto da Fonte do Tamboril', 'Fonte do Tamboril', 'vila-da-charamela',
   41.4810, -7.2380, true, null,
   'O coreto da aldeia mais alta do concelho, de madeira sobre base de pedra, ao lado da fonte que '
   'lhe dá o nome. Toca-se nele uma vez por ano, na festa da aldeia, e no fim da Caminhada dos Três Coretos.',
   'Montra (0119): coreto inventado de propósito. Não existe.')
on conflict (id) do nothing;

update public.coretos set venue_id = 'coreto-do-jardim-da-charamela', updated_at = now()
 where id = 'coreto-do-jardim-da-charamela' and venue_id is null;

update public.coretos set
  description = 'O coreto de ferro do jardim da vila, de 1912. É o palco do ciclo Bandas no Coreto, '
             || 'ao fim da tarde, com os bancos do jardim por plateia.',
  updated_at = now()
 where id = 'coreto-do-jardim-da-charamela' and description is null;

-- ---------------------------------------------------------------------------
-- Cada espaço tem o próprio nome como alias (0066/0070) — os dois da 0110
-- não o tinham. Preso ao concelho, que é o âmbito que desfaz homónimos.
-- ---------------------------------------------------------------------------
insert into public.venue_aliases (alias, venue_id, municipality_id)
select public.normalize_for_hash(v.name), v.id, v.municipality_id
  from public.venues v
  join public.municipalities m on m.id = v.municipality_id
 where m.region_id = 'vale-do-coreto'
on conflict (alias, ambito) do nothing;

-- ---------------------------------------------------------------------------
-- Um festival e um ciclo, ao lado da programação em rede da 0110. Cada um
-- de um concelho, para a página dos ciclos mostrar as duas formas.
-- ---------------------------------------------------------------------------
insert into public.series (id, name, kind, region_id, is_regional, municipality_id, description) values
  ('festival-do-bombo', 'Festival do Bombo', 'festival', 'vale-do-coreto', false, 'ponte-do-bombo',
   'Três dias de percussão, bandas e arraial na Ponte do Bombo, no largo e na sede da Filarmónica. '
   'Abre com um desfile pela ponte e fecha com um baile.'),
  ('cineclube-da-charamela', 'Cineclube da Charamela', 'cycle', 'vale-do-coreto', false, 'vila-da-charamela',
   'Um filme de quinze em quinze dias no Cine-Teatro da Charamela, escolhido pelo cineclube, com '
   'conversa no fim. A última sessão da temporada é ao ar livre, no jardim.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- O programa: trinta eventos. `dia` é o desvio da PRIMEIRA sessão em relação
-- a hoje — é com ele que se calcula a impressão digital, e as sessões lá em
-- baixo têm de começar nesse mesmo dia (a asserção no fim confirma-o).
-- ---------------------------------------------------------------------------
insert into public.events (
  id, slug, title, subtitle, description, description_short,
  municipality_id, venue_id, series_id, category_slug, category_confidence,
  audience, min_age, is_ongoing, duration_minutes,
  is_free, price_min, price_max, price_display, wheelchair_accessible,
  image_url, status, origin, is_canonical, confidence, source_id, fingerprint,
  published_at, last_seen_at
)
select
  p.id::uuid,
  public.slugify(p.title) || '-' || substr(p.id, 1, 6),
  p.title, p.subtitle, p.description, p.description_short,
  p.municipality_id, p.venue_id, p.series_id, p.category_slug, 1,
  p.audience::public.event_audience, p.min_age::smallint, p.is_ongoing, p.duration_minutes::integer,
  p.is_free, p.price_min::numeric, p.price_max::numeric, p.price_display, p.wheelchair_accessible,
  null::text, 'published'::public.event_status, 'manual'::public.event_origin, true, 0.9, null::text,
  public.event_fingerprint(p.title, current_date + p.dia, p.municipality_id),
  now(), now()
from (values
  -- ---- Vila da Charamela ----
  ('2288bf15-5849-4153-be42-6b4f5b14b8e5', 5,
   'A Charamela Perdida', 'Companhia do Alpendre',
   'Na véspera da festa, a banda da vila dá pela falta do instrumento mais antigo que tem — e ninguém se lembra de o ter visto sair. Uma comédia da Companhia do Alpendre, em oitenta minutos sem intervalo.',
   'Comédia da Companhia do Alpendre: a banda da vila perde o instrumento mais antigo que tem na véspera da festa.',
   'vila-da-charamela', 'cine-teatro-da-charamela', null, 'teatro',
   null, null, false, 80, false, 7.50, 7.50, '7,50 €', true),
  ('7e1526b9-0c2f-4c9f-a7d2-213add60efe1', 6,
   'Bandas no Coreto: Banda da Sociedade Filarmónica da Ponte', null,
   'A banda da Ponte do Bombo abre a temporada no coreto do jardim da Charamela, com marchas, valsas e o repertório que toca nas festas do vale. Traga cadeira, que os bancos do jardim são poucos.',
   'A Banda da Sociedade Filarmónica da Ponte abre a temporada do ciclo no coreto do jardim.',
   'vila-da-charamela', 'coreto-do-jardim-da-charamela', 'bandas-no-coreto', 'musica',
   'all_ages', null, false, 90, true, null, null, 'Entrada livre', true),
  ('b639db70-6715-4668-85d3-b5c521e8daca', 20,
   'Bandas no Coreto: Orquestra Ligeira do Vale', null,
   'Doze músicos dos dois concelhos, um repertório de bailes de outro tempo e um coreto ao fim da tarde. A Orquestra Ligeira do Vale toca à hora a que o jardim se enche.',
   'A Orquestra Ligeira do Vale, ao fim da tarde, no coreto do jardim.',
   'vila-da-charamela', 'coreto-do-jardim-da-charamela', 'bandas-no-coreto', 'musica',
   'all_ages', null, false, 90, true, null, null, 'Entrada livre', true),
  ('ff8798a6-1f4f-491c-9a11-4e089e0e629d', 4,
   'Cineclube: O Rio que Sobe', null,
   'Um documentário sobre as cheias de um vale e sobre as pessoas que ficaram a ver a água subir. No fim, conversa com a realizadora, que passou dois invernos a filmar o rio.',
   'Documentário sobre as cheias de um vale, seguido de conversa com a realizadora.',
   'vila-da-charamela', 'cine-teatro-da-charamela', 'cineclube-da-charamela', 'cinema',
   null, null, false, 95, false, 3, 3, '3 €', true),
  ('cd9b63f5-5eba-4289-8452-e2950aef261f', 18,
   'Cineclube: Curtas do Vale', null,
   'Sete curtas-metragens filmadas nos dois concelhos por quem cá vive, escolhidas pelo cineclube. Dez minutos cada, e no fim votam-se as três que seguem para a mostra de inverno.',
   'Sete curtas filmadas nos dois concelhos, escolhidas pelo cineclube; o público vota as três finalistas.',
   'vila-da-charamela', 'cine-teatro-da-charamela', 'cineclube-da-charamela', 'cinema',
   null, null, false, 90, false, 3, 3, '3 €', true),
  ('6eec7501-b6e5-48c8-bb5d-2bdcf8a1c842', 32,
   'Cineclube: Verão na Aldeia dos Tambores', null,
   'Uma comédia sobre uma aldeia que só tem um instrumento e uma festa por ano, e sobre o verão em que o instrumento se parte. A sessão mais cheia do ciclo todos os anos: convém chegar cedo.',
   'Comédia sobre uma aldeia com um só instrumento e o verão em que ele se parte.',
   'vila-da-charamela', 'cine-teatro-da-charamela', 'cineclube-da-charamela', 'cinema',
   null, null, false, 105, false, 3, 3, '3 €', true),
  ('96787788-36f2-4daa-b16b-1a906f2dd291', 46,
   'Cineclube: Sessão ao Ar Livre no Jardim', null,
   'A última sessão do ciclo sai do Cine-Teatro para o jardim: uma tela em frente ao coreto, um filme de animação para toda a família e a noite a fazer de sala. Se chover, a sessão passa para a sala.',
   'A última sessão do ciclo, ao ar livre em frente ao coreto, com um filme de animação para toda a família.',
   'vila-da-charamela', 'coreto-do-jardim-da-charamela', 'cineclube-da-charamela', 'cinema',
   'family', null, false, 85, true, null, null, 'Entrada livre', true),
  ('22990480-a439-47d8-93a3-0d2899742ad7', 13,
   'Tarde de Folclore com As Charameleiras', null,
   'O rancho folclórico da vila dança no jardim com o traje de domingo e os cantares que recolheu nas aldeias do vale. No fim há bolo e vinho para quem ficar.',
   'O rancho folclórico As Charameleiras dança no jardim, com os cantares recolhidos nas aldeias do vale.',
   'vila-da-charamela', 'coreto-do-jardim-da-charamela', null, 'danca',
   'all_ages', null, false, 75, true, null, null, 'Entrada livre', true),
  ('79e83b4f-df48-498f-b435-e03a116de85f', 8,
   'Retratos do Vale', 'Fotografia de Tomás Perdigão',
   'Quarenta retratos a preto e branco de quem vive nos dois concelhos, feitos ao longo de um ano à porta de casa de cada um. Entrada pela galeria, ao fundo da torre.',
   'Quarenta retratos a preto e branco de quem vive no vale, feitos à porta de casa de cada um.',
   'vila-da-charamela', 'galeria-do-relogio', null, 'exposicoes',
   null, null, true, null, true, null, null, 'Entrada livre', false),
  ('c4acad98-7e94-4c3a-a1c5-a3752790cf40', 2,
   'Cartazes de Festa, 1950–1990', null,
   'Quarenta anos de cartazes das festas dos dois concelhos, do arquivo da biblioteca: tipografia de chumbo, bandas anunciadas em letras grandes e preços em escudos. Na sala de leitura, durante o horário da biblioteca.',
   'Quarenta anos de cartazes das festas do vale, do arquivo da biblioteca.',
   'vila-da-charamela', 'biblioteca-municipal-da-charamela', null, 'exposicoes',
   null, null, true, null, true, null, null, 'Entrada livre', true),
  ('ddc8c026-93c7-4845-9dcb-8845f5c77c02', 9,
   'Apresentação do livro «A Última Charamela»', 'de Rita Alcobia',
   'O primeiro romance de Rita Alcobia passa-se numa vila que tem uma banda e não tem música. A autora conversa com o bibliotecário e assina livros no fim.',
   'Rita Alcobia apresenta o seu primeiro romance, passado numa vila que tem uma banda e não tem música.',
   'vila-da-charamela', 'biblioteca-municipal-da-charamela', null, 'literatura',
   null, null, false, 60, true, null, null, 'Entrada livre', true),
  ('83cc95af-f38c-4f16-bbba-ed2b2dfd6e8b', 11,
   'Hora do Conto: O Tambor que Não Queria Tocar', null,
   'Uma história para os mais pequenos sobre um tambor tímido, contada com um tambor a sério. Dos três aos seis anos, com quem os acompanha.',
   'Uma história sobre um tambor tímido, contada com um tambor a sério. Dos três aos seis anos.',
   'vila-da-charamela', 'biblioteca-municipal-da-charamela', null, 'infantil',
   'children', 3, false, 45, true, null, null, 'Entrada livre', true),
  ('4b59eb6e-4c3c-424b-8a11-46d64444eabd', 14,
   'Visita Guiada à Torre do Relógio', null,
   'Subir à torre, ver a máquina do relógio de 1887 a trabalhar e ouvir dar as onze lá de cima. A visita começa na galeria e sobe cem degraus; não há elevador.',
   'Subir à torre e ver a máquina do relógio de 1887 a trabalhar. Cem degraus, sem elevador.',
   'vila-da-charamela', 'galeria-do-relogio', null, 'patrimonio',
   null, null, false, 60, false, 2, 2, '2 €', false),
  ('8878a5b7-1e99-4e36-80c1-d556e1d468ea', 41,
   'Caminhada dos Três Coretos', null,
   'Doze quilómetros entre os três coretos do vale — o do jardim, o do largo da Ponte e o da Fonte do Tamboril —, com paragem para café a meio e uma banda à espera no fim. Partida do coreto do jardim.',
   'Doze quilómetros entre os três coretos do vale, com café a meio e uma banda à espera no fim.',
   'vila-da-charamela', 'coreto-do-jardim-da-charamela', null, 'desporto-natureza',
   'all_ages', null, false, 240, true, null, null, 'Entrada livre, com inscrição', null),
  ('8d29d0c8-bdd4-42b6-b070-09166dccaa61', 19,
   'Curso de Iniciação à Charamela', null,
   'Duas sessões para pegar numa charamela pela primeira vez, com os instrumentos da banda emprestados e um músico da Filarmónica a ensinar. Sem conhecimentos de música; máximo de dez inscritos.',
   'Duas sessões para pegar numa charamela pela primeira vez, com instrumentos emprestados. Máximo de dez inscritos.',
   'vila-da-charamela', 'cine-teatro-da-charamela', null, 'formacao',
   'adults', null, false, 120, false, 15, 15, '15 € (duas sessões)', true),
  ('17569f6b-10ab-4286-a784-86373313ccf9', 50,
   'A Vila que Não Existe', 'Conversa sobre lugares inventados',
   'Três escritores conversam sobre as vilas que inventaram para os seus livros e sobre o que um lugar imaginado diz dos verdadeiros. A biblioteca fica aberta até ao fim da conversa.',
   'Três escritores conversam sobre as vilas que inventaram e sobre o que um lugar imaginado diz dos verdadeiros.',
   'vila-da-charamela', 'biblioteca-municipal-da-charamela', null, 'literatura',
   null, null, false, 90, true, null, null, 'Entrada livre', true),
  -- ---- Ponte do Bombo ----
  ('12675d3e-4598-4ccf-87a0-1a53efb5aded', 3,
   'Noite de Fados na Filarmónica', 'Trio Corda Solta',
   'O Trio Corda Solta — guitarra portuguesa, viola e voz — traz uma noite de fados à sede da Sociedade Filarmónica, com a cozinha aberta. Lugares limitados; o bilhete compra-se à porta.',
   'Uma noite de fados com o Trio Corda Solta na sede da Sociedade Filarmónica, com a cozinha aberta.',
   'ponte-do-bombo', 'sociedade-filarmonica-da-ponte', null, 'musica',
   null, null, false, null, false, 5, 5, '5 €', null),
  ('79f8748a-90c0-4d0a-aa19-8b73c4848114', 34,
   'Bandas no Coreto: Banda Juvenil da Ponte', null,
   'Os mais novos da escola de música da Filarmónica sobem ao coreto do largo com o programa que prepararam durante o ano. É o concerto em que os pais se sentam na primeira fila.',
   'A Banda Juvenil da Ponte no coreto do largo, com o programa que preparou durante o ano.',
   'ponte-do-bombo', 'largo-da-ponte', 'bandas-no-coreto', 'musica',
   'all_ages', null, false, 60, true, null, null, 'Entrada livre', true),
  ('7309943e-8569-4cf4-acbe-390696b97ede', 48,
   'Bandas no Coreto: Grupo de Bombos da Ponte', null,
   'Fecha a temporada do ciclo o grupo que dá nome à vila: bombos, caixas e ferrinhos, tocados à volta do coreto e não em cima dele, que o coreto não os aguenta todos.',
   'O Grupo de Bombos da Ponte fecha a temporada do ciclo, à volta do coreto do largo.',
   'ponte-do-bombo', 'largo-da-ponte', 'bandas-no-coreto', 'musica',
   'all_ages', null, false, 60, true, null, null, 'Entrada livre', true),
  ('01650257-7f1e-473a-86eb-3bf28c16ecdf', 22,
   'Festival do Bombo: Desfile de Abertura', null,
   'O festival abre como sempre: os grupos de bombos dos dois concelhos entram na vila pela ponte e sobem ao largo, onde a Filarmónica os espera. Três dias de percussão, bandas e arraial.',
   'Os grupos de bombos entram na vila pela ponte e sobem ao largo: abre o festival.',
   'ponte-do-bombo', 'largo-da-ponte', 'festival-do-bombo', 'festas-populares',
   'family', null, false, 90, true, null, null, 'Entrada livre', true),
  ('2d165f02-d4e3-4b02-9410-d380ec219b24', 23,
   'Festival do Bombo: Encontro de Grupos', null,
   'Nove grupos de bombos, cada um com meia hora no largo, e um toque final em conjunto que se ouve do outro lado do rio. A tarde grande do festival.',
   'Nove grupos de bombos no largo, meia hora cada, e um toque final em conjunto.',
   'ponte-do-bombo', 'largo-da-ponte', 'festival-do-bombo', 'musica',
   'all_ages', null, false, 300, true, null, null, 'Entrada livre', true),
  ('d74d414c-7c7b-4c2a-8d9f-645683eb930a', 24,
   'Festival do Bombo: Baile de Encerramento', null,
   'O festival fecha com baile na sede da Filarmónica, ao som da Orquestra Ligeira do Vale, até a banda se cansar. O bilhete paga a limpeza do salão no dia seguinte.',
   'O baile que fecha o festival, na sede da Filarmónica, com a Orquestra Ligeira do Vale.',
   'ponte-do-bombo', 'sociedade-filarmonica-da-ponte', 'festival-do-bombo', 'festas-populares',
   null, null, false, null, false, 2, 2, '2 €', null),
  ('7f1fae47-5eae-41ef-80ad-96b26414bc69', 23,
   'Oficina de Bombos para Famílias', null,
   'Construir um bombo pequeno com os artesãos da vila, aprender três toques e levá-lo para casa. Para maiores de seis anos, acompanhados por um adulto; a inscrição faz-se no museu.',
   'Construir um bombo pequeno com os artesãos da vila e aprender três toques. Maiores de seis anos, acompanhados.',
   'ponte-do-bombo', 'museu-do-bombo', 'festival-do-bombo', 'formacao',
   'family', 6, false, 120, false, 4, 4, '4 € por participante', true),
  ('66c33953-aba9-417f-93ef-4fede580d4de', 27,
   'Mapa para Corpos Perdidos', 'Companhia de Dança Passo Torto',
   'Quatro bailarinos e um mapa que não corresponde a lugar nenhum: a nova criação da Companhia de Dança Passo Torto, sobre perder-se de propósito. Sessenta minutos, para maiores de doze anos.',
   'A nova criação da Companhia de Dança Passo Torto, sobre perder-se de propósito.',
   'ponte-do-bombo', 'auditorio-municipal-da-ponte', null, 'danca',
   null, 12, false, 60, false, 6, 6, '6 €', true),
  ('a0464996-0fd2-4588-a693-15b6863c1a6f', 1,
   'O Bombo e a Vila: Cem Anos de Percussão', null,
   'Cem anos de bombos da Ponte, das peles de cabra às caixas de alumínio, com os instrumentos dos grupos que já não existem e as fotografias das festas em que tocaram. Visitas guiadas ao fim de semana.',
   'Cem anos de bombos da Ponte, com os instrumentos dos grupos que já não existem e as fotografias das festas.',
   'ponte-do-bombo', 'museu-do-bombo', null, 'exposicoes',
   null, null, true, null, true, null, null, 'Entrada livre', true),
  ('5c4a3bc8-3c17-40b8-9c6d-e5c5b3edd88e', 16,
   'A Feira dos Sons', 'Teatro de Marionetas do Vale',
   'Uma feira onde se vendem sons em vez de coisas, e uma marioneta que não tem dinheiro para comprar nenhum. Cinquenta minutos, para maiores de quatro anos.',
   'O Teatro de Marionetas do Vale numa feira onde se vendem sons em vez de coisas. Maiores de quatro anos.',
   'ponte-do-bombo', 'auditorio-municipal-da-ponte', null, 'infantil',
   'children', 4, false, 50, false, 3, 3, '3 €', true),
  ('26adb6f2-247e-499f-905e-3ac8853fa858', 29,
   'Para que serve um coreto?', null,
   'Uma conversa sobre o coreto como palco popular — quem o construiu, quem o abandonou, quem voltou a tocar nele — com quem os estuda e com quem toca neles. No auditório do museu.',
   'Uma conversa sobre o coreto como palco popular, com quem os estuda e com quem toca neles.',
   'ponte-do-bombo', 'museu-do-bombo', null, 'literatura',
   null, null, false, 90, true, null, null, 'Entrada livre', true),
  ('8e31d4e9-264c-41f3-8f10-4f65087f8721', 37,
   'Feira do Instrumento Usado', null,
   'Instrumentos em segunda mão, partituras, peles de bombo e conselhos de quem os afina, todo o dia no largo. Quem quiser vender inscreve a banca na Filarmónica até à véspera.',
   'Instrumentos em segunda mão, partituras e peles de bombo, todo o dia no largo.',
   'ponte-do-bombo', 'largo-da-ponte', null, 'feiras-mercados',
   null, null, false, 480, true, null, null, 'Entrada livre', true),
  ('194daeb0-a354-4da6-8b06-7641f74024a5', 52,
   'Recital de Piano', 'Lídia Forjaz',
   'Lídia Forjaz toca peças de compositores que escreveram para bandas e nunca ouviram as suas obras ao piano, num programa que ela própria transcreveu. Setenta e cinco minutos, sem intervalo.',
   'Lídia Forjaz ao piano, com um programa de música escrita para bandas que ela própria transcreveu.',
   'ponte-do-bombo', 'auditorio-municipal-da-ponte', null, 'musica',
   null, null, false, 75, false, 6, 8, '6 € a 8 €', true),
  ('e1515846-fc07-41c3-a8d2-edd48d9d092c', 55,
   'Almoço de Sócios da Filarmónica', null,
   'O almoço anual dos sócios da Sociedade Filarmónica da Ponte, com a banda a tocar entre o prato e a sobremesa e as contas do ano lidas antes do café. Inscrições na sede até à semana anterior.',
   'O almoço anual dos sócios, com a banda a tocar entre o prato e a sobremesa.',
   'ponte-do-bombo', 'sociedade-filarmonica-da-ponte', null, 'comunidade',
   null, null, false, 180, false, 12, 12, '12 €, com inscrição', null)
) as p (id, dia, title, subtitle, description, description_short,
        municipality_id, venue_id, series_id, category_slug,
        audience, min_age, is_ongoing, duration_minutes,
        is_free, price_min, price_max, price_display, wheelchair_accessible)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- As sessões. Uma data relativa por ocorrência; as exposições em cartaz
-- levam os dois extremos e mais nada (a regra da 0114); o curso leva as
-- suas duas sessões, que são mesmo duas. O trigger da 0004 escreve
-- `date_start`/`date_end` a partir daqui.
-- ---------------------------------------------------------------------------
insert into public.event_sessions (event_id, session_date, start_time, end_time) values
  -- Vila da Charamela
  ('2288bf15-5849-4153-be42-6b4f5b14b8e5', current_date + 5,  '21:30', null),
  ('7e1526b9-0c2f-4c9f-a7d2-213add60efe1', current_date + 6,  '17:00', null),
  ('b639db70-6715-4668-85d3-b5c521e8daca', current_date + 20, '17:00', null),
  ('ff8798a6-1f4f-491c-9a11-4e089e0e629d', current_date + 4,  '21:30', null),
  ('cd9b63f5-5eba-4289-8452-e2950aef261f', current_date + 18, '21:30', null),
  ('6eec7501-b6e5-48c8-bb5d-2bdcf8a1c842', current_date + 32, '21:30', null),
  ('96787788-36f2-4daa-b16b-1a906f2dd291', current_date + 46, '21:30', null),
  ('22990480-a439-47d8-93a3-0d2899742ad7', current_date + 13, '16:00', null),
  ('79e83b4f-df48-498f-b435-e03a116de85f', current_date + 8,  null,    null),
  ('79e83b4f-df48-498f-b435-e03a116de85f', current_date + 60, null,    null),
  ('c4acad98-7e94-4c3a-a1c5-a3752790cf40', current_date + 2,  null,    null),
  ('c4acad98-7e94-4c3a-a1c5-a3752790cf40', current_date + 30, null,    null),
  ('ddc8c026-93c7-4845-9dcb-8845f5c77c02', current_date + 9,  '18:00', null),
  ('83cc95af-f38c-4f16-bbba-ed2b2dfd6e8b', current_date + 11, '10:30', null),
  ('4b59eb6e-4c3c-424b-8a11-46d64444eabd', current_date + 14, '10:00', '11:00'),
  ('8878a5b7-1e99-4e36-80c1-d556e1d468ea', current_date + 41, '09:00', null),
  ('8d29d0c8-bdd4-42b6-b070-09166dccaa61', current_date + 19, '18:00', '20:00'),
  ('8d29d0c8-bdd4-42b6-b070-09166dccaa61', current_date + 26, '18:00', '20:00'),
  ('17569f6b-10ab-4286-a784-86373313ccf9', current_date + 50, '18:30', null),
  -- Ponte do Bombo
  ('12675d3e-4598-4ccf-87a0-1a53efb5aded', current_date + 3,  '21:30', null),
  ('79f8748a-90c0-4d0a-aa19-8b73c4848114', current_date + 34, '17:00', null),
  ('7309943e-8569-4cf4-acbe-390696b97ede', current_date + 48, '17:00', null),
  ('01650257-7f1e-473a-86eb-3bf28c16ecdf', current_date + 22, '18:00', null),
  ('2d165f02-d4e3-4b02-9410-d380ec219b24', current_date + 23, '16:00', null),
  ('d74d414c-7c7b-4c2a-8d9f-645683eb930a', current_date + 24, '22:00', null),
  ('7f1fae47-5eae-41ef-80ad-96b26414bc69', current_date + 23, '10:30', '12:30'),
  ('66c33953-aba9-417f-93ef-4fede580d4de', current_date + 27, '21:30', null),
  ('a0464996-0fd2-4588-a693-15b6863c1a6f', current_date + 1,  null,    null),
  ('a0464996-0fd2-4588-a693-15b6863c1a6f', current_date + 45, null,    null),
  ('5c4a3bc8-3c17-40b8-9c6d-e5c5b3edd88e', current_date + 16, '15:00', null),
  ('26adb6f2-247e-499f-905e-3ac8853fa858', current_date + 29, '18:30', null),
  ('8e31d4e9-264c-41f3-8f10-4f65087f8721', current_date + 37, '09:00', '17:00'),
  ('194daeb0-a354-4da6-8b06-7641f74024a5', current_date + 52, '21:30', null),
  ('e1515846-fc07-41c3-a8d2-edd48d9d092c', current_date + 55, '13:00', null)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- A montra renova-se sozinha.
--
-- Para cada evento publicado de uma região `montra` que já acabou, o menor
-- múltiplo de 60 dias que o devolve ao futuro — e TODAS as sessões saltam
-- esse tanto, canceladas incluídas, para o espaçamento entre elas não mudar.
-- O trigger `event_sessions_sync_dates_trg` (0004) refaz `date_start` e
-- `date_end` a cada linha; a impressão digital volta a ser calculada com a
-- data nova, para a promessa «fingerprint = título + primeira data +
-- concelho» continuar verdade depois de cada renovação.
--
-- Devolve quantos eventos moveu. Sem nada para mover, devolve zero e não
-- toca em linha nenhuma — é assim que a chamada no fim desta migração corre.
-- Só a `service_role` a chama: é a recolha noturna, pelo PostgREST, como faz
-- à `prune_rate_limits`.
-- ---------------------------------------------------------------------------
create or replace function public.renovar_montra()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento  record;
  v_salto   integer;
  v_movidos integer := 0;
begin
  for v_evento in
    select e.id, e.date_end
      from public.events e
      join public.municipalities m on m.id = e.municipality_id
      join public.regions r on r.id = m.region_id
     where r.kind = 'montra'
       and e.status = 'published'
       and e.date_end < current_date
     order by e.date_end
  loop
    v_salto := 60 * ceil((current_date - v_evento.date_end)::numeric / 60);

    update public.event_sessions
       set session_date = session_date + v_salto
     where event_id = v_evento.id;

    update public.events
       set fingerprint = public.event_fingerprint(title, date_start, municipality_id)
     where id = v_evento.id;

    v_movidos := v_movidos + 1;
  end loop;

  return v_movidos;
end;
$$;

comment on function public.renovar_montra() is
  'Empurra para o futuro, em saltos de 60 dias, os eventos publicados de uma região «montra» que já '
  'acabaram — todas as sessões de cada um, para o espaçamento não mudar. O programa da montra é '
  'inventado de propósito e nunca envelhece. Devolve quantos eventos moveu.';

revoke execute on function public.renovar_montra() from public, anon, authenticated;
grant execute on function public.renovar_montra() to service_role;

-- ---------------------------------------------------------------------------
-- O que tem de continuar verdade.
-- ---------------------------------------------------------------------------
do $$
declare
  n       integer;
  movidos integer;
begin
  -- Trinta eventos, todos publicados, canónicos, manuais, sem fonte, sem
  -- cartaz e com espaço do catálogo.
  select count(*) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto';
  assert n = 30, format('%s eventos na montra, esperavam-se 30', n);

  select count(*) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto'
     and not (e.status = 'published' and e.is_canonical and e.origin = 'manual'
              and e.source_id is null and e.image_url is null and e.venue_id is not null);
  assert n = 0, format('%s eventos da montra fora da forma prometida', n);

  -- A impressão digital e o slug são os que a casa calcula, com a PRIMEIRA
  -- data — é isto que apanha um `dia` que não bata com as sessões.
  select count(*) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto'
     and (e.fingerprint <> public.event_fingerprint(e.title, e.date_start, e.municipality_id)
       or e.slug <> public.slugify(e.title) || '-' || substr(e.id::text, 1, 6));
  assert n = 0, format('%s eventos da montra com impressão digital ou slug fora da fórmula', n);

  -- Tudo por acontecer, dentro dos sessenta dias.
  select count(*) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto'
     and (e.date_start < current_date + 1 or e.date_end > current_date + 60);
  assert n = 0, format('%s eventos da montra fora da janela de sessenta dias', n);

  -- Trinta e quatro sessões; as três exposições em cartaz com os dois
  -- extremos e mais nada.
  select count(*) into n
    from public.event_sessions s
    join public.events e on e.id = s.event_id
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto';
  assert n = 34, format('%s sessões na montra, esperavam-se 34', n);

  select count(*) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto' and e.is_ongoing
     and (select count(*) from public.event_sessions s where s.event_id = e.id) = 2;
  assert n = 3, format('%s exposições em cartaz com dois extremos, esperavam-se 3', n);

  -- Os dois concelhos com programa, treze categorias (todas menos «Outros»),
  -- três ciclos com pelo menos três datas cada.
  select count(distinct e.municipality_id) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto';
  assert n = 2, 'um dos concelhos da montra ficou sem programa';

  select count(distinct e.category_slug) into n
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
   where m.region_id = 'vale-do-coreto';
  assert n = 13, format('%s categorias na montra, esperavam-se 13', n);

  select count(*) into n
    from public.series s
   where s.region_id = 'vale-do-coreto'
     and (select count(*) from public.events e where e.series_id = s.id) < 3;
  assert n = 0, format('%s ciclos da montra com menos de três datas', n);

  -- Oito espaços e três coretos, dentro da caixa da região, e cada espaço
  -- com o próprio nome como alias, preso ao seu concelho.
  select count(*) into n
    from public.venues v
    join public.municipalities m on m.id = v.municipality_id
    join public.regions r on r.id = m.region_id
   where r.id = 'vale-do-coreto'
     and (v.latitude not between r.bbox_lat_min and r.bbox_lat_max
       or v.longitude not between r.bbox_lon_min and r.bbox_lon_max);
  assert n = 0, format('%s espaços da montra fora da caixa da região', n);

  select count(*) into n
    from public.coretos c
    join public.municipalities m on m.id = c.municipality_id
    join public.regions r on r.id = m.region_id
   where r.id = 'vale-do-coreto'
     and (c.latitude not between r.bbox_lat_min and r.bbox_lat_max
       or c.longitude not between r.bbox_lon_min and r.bbox_lon_max);
  assert n = 0, format('%s coretos da montra fora da caixa da região', n);

  select count(*) into n
    from public.venues v
    join public.municipalities m on m.id = v.municipality_id
   where m.region_id = 'vale-do-coreto';
  assert n = 8, format('%s espaços na montra, esperavam-se 8', n);

  select count(*) into n
    from public.coretos c
    join public.municipalities m on m.id = c.municipality_id
   where m.region_id = 'vale-do-coreto';
  assert n = 3, format('%s coretos na montra, esperavam-se 3', n);

  select count(*) into n
    from public.venues v
    join public.municipalities m on m.id = v.municipality_id
   where m.region_id = 'vale-do-coreto'
     and not exists (
       select 1 from public.venue_aliases a
        where a.venue_id = v.id
          and a.municipality_id = v.municipality_id
          and a.alias = public.normalize_for_hash(v.name)
     );
  assert n = 0, format('%s espaços da montra sem o próprio nome como alias', n);

  -- A renovação existe, corre, e hoje não tem nada para mover.
  movidos := public.renovar_montra();
  assert movidos = 0, format('renovar_montra moveu %s eventos num programa acabado de nascer', movidos);
end
$$;

commit;
