-- 0084 — Trinta e oito títulos ganham categoria, e três prateleiras vazias abrem.
--
-- Quarenta e quatro dos cento e quarenta eventos publicados não tinham
-- categoria. Passado o classificador de hoje por cima dos quarenta e quatro
-- títulos, ele apanha **dois** — «II Prova de Resistência Terrantêz Trail
-- Team» e «Mercados Ecorurais», ambos por palavra do título, ambos com a
-- confiança 0.7 da regra. Não é preguiça do classificador: ele lê palavras
-- inequívocas no título e mais nada, de propósito — «a descrição menciona
-- "concerto" em metade dos eventos que não são concertos», diz o ficheiro que
-- o escreve. Nos outros quarenta e dois o título não tem por onde se pegar:
-- «Sopro», «Catarinas», «FIF Abrantes».
--
-- Foi preciso ir ver. O que entra aqui vem de cinco sítios, e cada linha
-- guarda de qual — não só neste comentário: a prova vai para o `note` do
-- bloqueio, que é onde o backoffice a mostra a quem abrir o evento.
--
--   · **o classificador**, para os dois que ele já dá;
--   · **o cartaz**, lido. Seis eventos de Abrantes não têm descrição nem
--     ligação, mas a API do município dá `imagemDestaque`, e um cartaz diz o
--     que é um espetáculo melhor do que o título dele;
--   · **a descrição**, quando a há e chega — as do Centro Cultural Gil Vicente
--     são sinopses inteiras, e a do Art'InRua traz o programa hora a hora;
--   · **o título**, num caso em que é inequívoco e não há mais nada;
--   · **fora da base**, em dois: a página do CAORG e a imprensa regional.
--
-- Três categorias que existiam e nunca tinham sido usadas abrem hoje:
-- **dança**, **património** e **comunidade**. Não se inventou nenhuma — a
-- prateleira estava feita e vazia, o que quase sempre quer dizer que se andou
-- a arrumar o que lá devia ir noutro sítio qualquer.
--
-- ## A forma antes do assunto, e onde a regra não chega
--
-- Um espetáculo de marionetas é teatro, mesmo quando é para crianças, porque
-- `teatro` diz «teatro, teatro de rua, marionetas e novo circo» e a forma
-- manda. O `infantil` fica para quando o próprio evento se declara para os
-- mais novos, e o sinal é a idade no título — é o caso do «Mamma Mia! Baby».
-- Um «espetáculo pensado para toda a família» na sinopse não é isso: é
-- amplitude, não é idade, e por isso o espetáculo de magia fica em `teatro`,
-- ao lado do novo circo, que é o parente que a lista das categorias tem.
--
-- Duas formas entram hoje no catálogo pela primeira vez e nenhuma prateleira
-- as nomeia: **stand-up comedy** («O Primogénito») e **magia de palco**
-- («Magia // Ensemble Magia Contemporânea»). As duas ficam em `teatro`, que é
-- a única categoria que guarda espetáculo de palco. Fica dito que é uma
-- escolha e não uma leitura: no dia em que houver meia dúzia de cada, a
-- resposta certa passa a ser uma prateleira nova.
--
-- ## O bloqueio, sem o qual isto durava até à próxima recolha
--
-- Trinta e seis destas categorias ficam trancadas em `manual_overrides`, e a
-- razão é medível. O classificador tem um terceiro degrau: quando não
-- reconhece o título, dá a categoria por omissão do **tipo de espaço**, com
-- confiança 0.4. Três destes eventos têm espaço resolvido com omissão, e em
-- dois deles a omissão está errada:
--
--   · «Dia Mundial da Observação da Natureza» está no CIRA, que é `museum` —
--     a recolha punha-o em `exposicoes`;
--   · «Fins de Tarde na Vila Medieval ‘26» está no castelo de Ourém, que é
--     `heritage` — a recolha punha-o em `patrimonio`, e são dez concertos
--     nomeados, de Lula Pena aos PAUS.
--
-- Sem o bloqueio, uma leitura feita com o programa à frente era substituída
-- por um palpite de 0.4 na primeira noite em que a recolha voltasse a correr.
-- Com ele, a fonte continua a ser lida em tudo o resto e o desacordo fica
-- registado — a recolha escreve «a fonte discorda de campos corrigidos à mão»
-- no seu diário em vez de pisar por cima em silêncio.
--
-- Os dois do classificador **não** são trancados, e é deliberado: são a
-- resposta da máquina, não uma correção de uma pessoa. Se a taxonomia mudar
-- de ideias sobre eles, devem acompanhá-la.
--
-- A confiança segue a casa: **1** para o que uma pessoa decidiu — é o valor
-- que o formulário de submissão já grava quando quem submete escolhe a
-- categoria —, e **0.7** para os dois que vêm da regra de título, que é o
-- valor que a própria regra devolve.
--
-- ## Uma coisa que fica por explicar
--
-- Os dois que o classificador apanha estão guardados sem categoria, e não
-- deviam. A correção que faz a recolha voltar a derivar a categoria do que já
-- está publicado entrou em `main` a 30 de agosto às 05:49; a última recolha
-- correu nesse mesmo dia entre as 07:26 e as 07:39. Correu com a correção lá
-- dentro e mesmo assim os dois continuam a nulo. Porquê, não se estabelece a
-- partir da base: era preciso o diário da corrida, e não há corridas novas
-- desde que os executores do GitHub Actions caíram. Fica escrito para quem lá
-- for quando eles voltarem. O que esta migração faz é pôr o valor certo agora,
-- em vez de esperar por uma noite que não se sabe quando chega.
--
-- ## Seis ficam por classificar, e é a resposta certa nos seis
--
-- **Quatro não têm por onde se pegar.** «Domingo de Praça» («este mês também
-- vamos ter a atividade "Domingo de Praça"»), «Festival da Saúde» («mais
-- informação a disponibilizar em breve»), «Noites de Verão 2026 animam a Praça
-- Salgueiro Maia» e «Comemoração do Dia Internacional da Juventude 26» — as
-- duas últimas sem descrição nenhuma. Uma categoria adivinhada é pior do que
-- uma em falta: um campo com ar de preenchido não volta a ser revisto por
-- ninguém.
--
-- **Dois não são programação cultural.** «Vacinação Antirrábica» e «Campanha
-- de Sensibilização para o Bem-Estar Animal» são avisos municipais de serviço
-- público, entraram por estarem na agenda do município, e não há prateleira
-- onde caibam — nem devia haver. Dar-lhes categoria seria afirmar que
-- pertencem a uma agenda cultural. Se saem ou ficam é decisão do dono, não de
-- uma migração: ficam por classificar, e quem olhar vê-os logo.

create temporary table levantamento_de_categorias (
  titulo    text primary key,
  slug      text not null,
  confianca numeric(4, 3) not null,
  trancar   boolean not null,
  prova     text not null
);

insert into levantamento_de_categorias (titulo, slug, confianca, trancar, prova) values

-- ————— O que o classificador de hoje já dá —————
('II Prova de Resistência Terrantêz Trail Team', 'desporto-natureza', 0.7, false,
 'Regra de título do classificador («prova»), confiança 0.7.'),
('Mercados Ecorurais', 'feiras-mercados', 0.7, false,
 'Regra de título do classificador («mercado»), confiança 0.7.'),

-- ————— Cartaz lido —————
('Sopro', 'teatro', 1, true,
 'Cartaz: dois intérpretes em pernas de pau e um adereço gigante de rodas, num jardim. Teatro de rua.'),
('Um dia no fundo do mar', 'teatro', 1, true,
 'Cartaz: marionetas de mão — sereia e caranguejo — sobre um barco desenhado. A categoria do teatro inclui marionetas.'),
('Pai Que Se Tornou Mãe', 'teatro', 1, true,
 'Cartaz: um intérprete só, em contraluz azul, a manipular figuras de papel. Teatro de objetos.'),
('Union Salsera', 'musica', 1, true,
 'Cartaz: banda ao vivo em palco ao ar livre — duas vozes, congas, baixo, teclas.'),
('Mamma Mia! Baby', 'infantil', 1, true,
 'Cartaz de espetáculo de palco, e o «Baby» do título é a declaração de idade que a regra do infantil pede.'),
('FIF Abrantes', 'danca', 1, true,
 'Cartaz: seis bandeiras (Portugal, Costa Rica, Grécia, Itália, Lituânia, Brasil) sobre friso floral folclórico. '
 'É o Festival Internacional de Folclore de Abrantes, na Praça Barão da Batalha, organizado pelo Rancho Folclórico '
 'e Etnográfico de Casais de Revelhos, com delegações estrangeiras. A categoria da dança diz «ranchos folclóricos '
 'em palco»; a da música também diz «ranchos», mas em lista de agrupamentos musicais — a da dança é a mais precisa.'),

-- ————— Descrição —————
('ARTE', 'teatro', 1, true,
 'Sinopse: peça de Yasmina Reza, três amigos e um quadro.'),
('Catarinas', 'teatro', 1, true,
 'Sinopse: «um grupo de pessoas reúne-se, uma vez por semana, para fazer teatro»; adaptação de um texto.'),
('O Primogénito', 'teatro', 1, true,
 'Sinopse: «quarto solo de stand-up comedy», de Dário Guerreiro. Primeiro stand-up do catálogo; fica em teatro '
 'por ser a única categoria de espetáculo de palco.'),
('Magia // Ensemble Magia Contemporânea', 'teatro', 1, true,
 'Sinopse: três mágicos contemporâneos num espetáculo de palco. Primeira magia do catálogo; fica em teatro, ao '
 'lado do novo circo. O «para toda a família» da sinopse é amplitude, não declaração de idade.'),
('Art In Rua 2026', 'teatro', 1, true,
 'Programa hora a hora na descrição: oito números de circo contemporâneo, cinco de clown, cinco de animação de '
 'rua, teatro e teatro de objetos. É a forma dominante de um festival com música, dança e oficinas à mistura.'),
('Celebratorium', 'musica', 1, true,
 'Sinopse: homenagem a Luís de Freitas Branco pela Camerata de Estudantes do Instituto Superior de Estudos Musicais.'),
('Focus Sax Quartet', 'musica', 1, true,
 'Sinopse: quarteto de saxofones, Prémio Jovens Músicos 2023.'),
('Palavra Puxa Palavra', 'musica', 1, true,
 'Sinopse: espetáculo do cantautor Rogério Charraz, «encontro entre a palavra, a música e a emoção».'),
('Fins de Tarde na Vila Medieval ‘26', 'musica', 1, true,
 'Descrição: dez concertos nomeados — Lula Pena, PAUS, Mário Parizek, Diogo Zambujo, Rita Vian, Emmy Curl, '
 'Thispage, Estardalhaço da Geringonça, Riff 65 e Miss Universo — «todos com entrada livre».'),
('Verão Ferreira do Zêzere - Agosto', 'musica', 1, true,
 'Descrição: «três concertos na Praça da Vila»; Maria Janeiro a 1 de agosto.'),
('Festival ao Alto', 'musica', 1, true,
 'Programa: Palco Principal com Bia Caboz, Palco ao Alto com Ivo Ramada. Há torneio e animação à volta, mas o '
 'palco é o eixo.'),
('Sons na Adega®', 'musica', 1, true,
 'Descrição: recebe o grupo Resenha do Samba — «a batucada firme e a harmonia do cavaco e do pandeiro».'),
('Sorrisos entre Letras', 'literatura', 1, true,
 'Na Sala Polivalente da Biblioteca Municipal Alexandre O''Neill, em Constância, e o título nomeia as letras.'),
('Fora da Estante | Dia Internacional da Literacia (Financeira)', 'literatura', 1, true,
 'Mostra de livros da Biblioteca Municipal de Ourém durante todo o mês de setembro.'),
('Almourol Templário - O assalto', 'patrimonio', 1, true,
 'Programa: acampamento militar e civil no Cais de Almourol, hastear da bandeira, experiências templárias e '
 'protocolo com o Convento de Cristo. Recriação histórica num monumento.'),
('A Arte do Calafate', 'formacao', 1, true,
 'Descrição: «o ensinamento da construção e reparação naval», quatro sessões de duas horas, com inscrição '
 'obrigatória. É uma oficina.'),
('Insufláveis no parque', 'infantil', 1, true,
 'Insufláveis no parque ribeirinho, sete tardes gratuitas.'),
('Município promove desporto ao ar livre em julho e agosto | Verão Ativo Ginásios', 'desporto-natureza', 1, true,
 'Descrição: «atividades desportivas ao ar livre, gratuitas», aulas abertas com dois ginásios do concelho.'),
('Caminhos D’ourém – Freguesia de Caxarias', 'desporto-natureza', 1, true,
 'Descrição: caminhada que quer «sensibilizar para a importância da prática da atividade física».'),
('Almoço dos Idosos', 'comunidade', 1, true,
 'Descrição: almoço da junta de freguesia, «encontros para mais convívio da população».'),
('Passeio Anual do Idoso 2026', 'comunidade', 1, true,
 'Descrição: passeio da Junta Sénior com visita, almoço, lanche e convívio.'),
('7.ª edição dos Passeios Socioculturais Seniores', 'comunidade', 1, true,
 'Descrição: programa do município para a população com 65 ou mais anos; este ano a Cascais e Belém.'),
('Aniversário Moto Clube', 'comunidade', 1, true,
 'Descrição: aniversário do Moto Clube de Ferreira do Zêzere, «três dias de convívio e animação». Há atuações '
 'musicais, mas o evento é o do clube.'),
('Raízes de Montalvo', 'comunidade', 1, true,
 'Descrição: «programa de intervenção realizado em grupo, uma vez por semana» — dança sénior, estimulação '
 'cognitiva e atividades criativas.'),
('Fim de Semana Jovem em Torres Novas', 'comunidade', 1, true,
 'Descrição: programa para jovens que «reúne desporto, música, formação, voluntariado e convívio». Nenhuma '
 'forma domina.'),
('Cerimónia “Regenerar Alcanena” 2026', 'comunidade', 1, true,
 'Descrição: entrega dos galardões «Acreditar Alcanena» pelo município. Cerimónia cívica do concelho.'),
('Em Tomar a aprender', 'comunidade', 1, true,
 'Descrição: receções ao pessoal não docente e aos professores no arranque do ano letivo, pelo município.'),

-- ————— Título, quando é inequívoco e não há mais nada —————
('Dia Mundial da Observação da Natureza', 'desporto-natureza', 1, true,
 'Sem descrição nem ligação. O título nomeia a observação da natureza, e a categoria é «desporto e natureza». '
 'O espaço resolvido é o CIRA, classificado como museu — sem este bloqueio a recolha punha-o em exposições.'),

-- ————— Fora da base —————
('Botto em palavras', 'literatura', 1, true,
 'Sem descrição. É a comemoração do nascimento de António Botto no Largo do Chão da Eira, na Concavada, terra '
 'natal do poeta, a 17 de agosto. A forma muda de ano para ano — em 2023 a imprensa deu-a como teatro, em 2025 '
 'como poemas musicados por Hugo Sampaio —, o assunto não: é a poesia de Botto, e é isso que a categoria diz.'),
('Comemoração 30º Aniversário Charales Chorus - Caorg, Minde', 'musica', 1, true,
 'A descrição só tem o local. O Charales Chorus é o coro do Centro de Artes e Ofícios Roque Gameiro, fundado em '
 'dezembro de 1996 — daí os trinta anos —, com cerca de trinta vozes e repertório sacro, clássico e popular. '
 'A categoria da música diz, à letra, «coros».');

update public.events e set
  category_slug = d.slug,
  category_confidence = d.confianca,
  updated_at = now()
from levantamento_de_categorias d
where e.title = d.titulo
  and e.status = 'published'
  and e.category_slug is null;

-- O bloqueio guarda a prova, e não só o valor: quem abrir o evento no
-- backoffice lê porque é que ali diz o que diz.
insert into public.manual_overrides (event_id, field, value, actor, note)
select e.id, 'category_slug', to_jsonb(e.category_slug),
       'levantamento de categorias 2026-08-31', d.prova
from public.events e
join levantamento_de_categorias d on d.titulo = e.title
where d.trancar
  and e.status = 'published'
  and e.category_slug = d.slug
on conflict (event_id, field) do nothing;

update public.events e set has_manual_overrides = true
where exists (select 1 from public.manual_overrides o where o.event_id = e.id)
  and not e.has_manual_overrides;

-- ---------------------------------------------------------------------------
do $$
declare
  por_classificar integer;
  quais           text;
  sem_bloqueio    integer;
  confianca_torta integer;
  restantes       integer;
begin
  -- Postcondição, e não contagem do dia: numa base vazia isto passa sem dizer
  -- nada, que é o que tem de acontecer. O que se afirma é sobre estas linhas.
  select count(*), string_agg(e.title, ' · ' order by e.title)
    into por_classificar, quais
  from public.events e
  join levantamento_de_categorias d on d.titulo = e.title
  where e.status = 'published' and e.category_slug is null;

  if por_classificar > 0 then
    raise exception '% títulos desta migração ficaram sem categoria: %', por_classificar, quais;
  end if;

  select count(*) into confianca_torta
  from public.events e
  join levantamento_de_categorias d on d.titulo = e.title
  where e.status = 'published'
    and (e.category_slug is distinct from d.slug or e.category_confidence is distinct from d.confianca);

  if confianca_torta > 0 then
    raise exception '% eventos ficaram com categoria ou confiança diferentes do levantamento', confianca_torta;
  end if;

  select count(*) into sem_bloqueio
  from public.events e
  join levantamento_de_categorias d on d.titulo = e.title
  where d.trancar and e.status = 'published'
    and not exists (
      select 1 from public.manual_overrides o
      where o.event_id = e.id and o.field = 'category_slug'
    );

  if sem_bloqueio > 0 then
    raise exception
      '% categorias ficaram por trancar — a recolha da próxima noite escrevia por cima', sem_bloqueio;
  end if;

  select count(*) into restantes
  from public.events where status = 'published' and category_slug is null;

  raise notice 'ficam % eventos por classificar, e nenhum por falta de trabalho', restantes;
end
$$;

drop table levantamento_de_categorias;
