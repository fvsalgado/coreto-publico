-- 0094 — As fichas passam a dizer quando o espaço está aberto.
--
-- ## O buraco
--
-- A ficha de um espaço diz o que ele é, o que lá acontece, como se lá chega e
-- como se entra. Não diz **quando está aberto** — e para um museu, uma
-- biblioteca ou um castelo essa é a primeira pergunta de quem vai. A agenda
-- resolve o «quando» de um espetáculo, que tem hora marcada; não resolve o de
-- uma exposição, que se visita em horário de porta aberta.
--
-- Vinte e um espaços do catálogo publicam o horário na sua fonte oficial e
-- nenhum deles o mostrava aqui.
--
-- ## Porque é que são duas colunas e não uma
--
-- Um horário sem data é uma afirmação sobre um dia que não se sabe qual é.
-- Muda com as obras, com a época, com o orçamento, e ninguém nos avisa. Uma
-- ficha que diga «3.ª a domingo, 10h–18h» e mais nada está a afirmar sobre
-- hoje o que era verdade num dia qualquer do passado — e manda alguém a uma
-- porta fechada com a nossa assinatura em baixo.
--
-- Por isso `opening_hours_checked_on`, e por isso a restrição: **um horário
-- sem a data em que foi lido não entra na tabela.** É a mesma disciplina das
-- notas de acessibilidade, onde todas dizem que o TUR4all não data a
-- avaliação — só que aqui a data existe, e é nossa, e portanto grava-se.
--
-- A página mostra as duas juntas e diz que na dúvida vale a pena telefonar.
-- Não é uma fórmula de cortesia: é o que se faz quando a informação tem idade.
--
-- ## O que não entra
--
-- **A bilheteira.** `ticketing_url` continua a 0 em 106, e continua de
-- propósito. O Teatro Virgínia vende online pelo BOL, que esta casa não usa;
-- o Cine-Teatro Paraíso não publica plataforma nenhuma, só o horário do
-- guichê. Uma ligação de compra que não existe não se inventa.
--
-- **Horários que só uma exposição publica.** Os do Cine-Teatro Paraíso são os
-- da bilheteira e dizem-no; os da Galeria Municipal do Entroncamento são os
-- que o município publica em cada exposição, repetidos em duas exposições
-- distintas de meses diferentes — e a nota diz de onde vêm.

alter table public.venues
  add column if not exists opening_hours text,
  add column if not exists opening_hours_checked_on date;

comment on column public.venues.opening_hours is
  'Horário de funcionamento, como a fonte oficial o publica. Texto livre: um museu com época '
  'alta e baixa, um mercado que abre à segunda e ao sábado e um castelo com última entrada 40 '
  'minutos antes não cabem num esquema de dias e horas sem se perder o que importa.';

comment on column public.venues.opening_hours_checked_on is
  'O dia em que se leu o horário na fonte oficial. Obrigatório sempre que há horário: sem ele, a '
  'ficha afirma sobre hoje o que era verdade num dia que ninguém sabe qual é.';

alter table public.venues
  drop constraint if exists venues_opening_hours_tem_data;

alter table public.venues
  add constraint venues_opening_hours_tem_data
  check (opening_hours is null or opening_hours_checked_on is not null);

-- ---------------------------------------------------------------------------
-- Vinte e um horários, todos lidos na fonte oficial de cada espaço a 1 de
-- setembro de 2026.
-- ---------------------------------------------------------------------------

update public.venues v set
  opening_hours = d.horario,
  opening_hours_checked_on = date '2026-09-01',
  updated_at = now()
from (values
  -- Abrantes
  ('quartel-galeria-abrantes',
   'Terça-feira a sábado, das 14h00 às 17h30. Encerra ao domingo, à segunda e nos feriados '
   '(excepto 14 de junho). Última entrada 30 minutos antes do encerramento. Entrada gratuita.'),
  ('miaa',
   'Terça-feira a domingo, das 10h00 às 12h30 e das 14h00 às 17h30. Encerra à segunda e nos '
   'feriados (excepto 14 de junho).'),
  ('museu-dom-lopo-de-almeida',
   'Verão: terça-feira a domingo, das 10h00 às 13h00 e das 14h00 às 18h00. Inverno: terça-feira '
   'a domingo, das 09h00 às 13h00 e das 14h00 às 17h00.'),

  -- Alcanena
  ('museu-municipal-alcanena',
   'Quarta-feira a domingo. De abril a setembro, das 10h00 às 13h00 e das 14h00 às 18h00; de '
   'outubro a março, das 09h00 às 12h30 e das 14h00 às 17h30. Entrada gratuita. Visitas de grupo '
   'com marcação de pelo menos oito dias.'),
  ('ccv-alviela-carsoscopio',
   'Terça-feira a domingo, das 10h00 às 18h00; encerra à segunda. De 1 de maio a 31 de agosto: '
   'terça a sexta, das 10h00 às 18h00; sábados, domingos e feriados, das 11h00 às 19h00.'),

  -- Constância
  ('ccv-constancia',
   'Terça-feira a sexta, das 09h30 às 13h00 e das 14h30 às 18h00. Sábado, das 15h00 às 19h00 e '
   'das 21h30 às 23h30. Domingos e feriados, das 15h00 às 19h00. Encerra à segunda. Marcação '
   'prévia obrigatória.'),
  ('museu-rios-artes-maritimas',
   'Segunda a sexta, das 09h00 às 12h30 e das 14h00 às 17h30. Entrada 1,00 €; visita com guia '
   '0,50 € por pessoa, em grupos até 20.'),
  ('biblioteca-municipal-constancia',
   'Segunda a sexta, das 09h00 às 17h00.'),

  -- Entroncamento
  ('museu-nacional-ferroviario',
   'Terça-feira a domingo, das 10h30 às 17h30. Bilhete a partir de 3 €; gratuito até aos 5 anos.'),
  ('galeria-municipal-entroncamento',
   'Terça-feira a sexta, das 14h00 às 19h00. Sábados, das 11h00 às 13h00 e das 14h00 às 19h00. '
   'Domingos e feriados, das 14h00 às 19h00. Entrada gratuita. É o horário que o município '
   'publica em cada exposição.'),

  -- Ferreira do Zêzere
  ('mercado-municipal-ferreira-do-zezere',
   'Segunda-feira, das 7h30 às 12h00, e sábado, das 7h30 às 12h30.'),

  -- Mação
  ('museu-arte-pre-historica-macao',
   'Dias úteis, das 09h00 às 12h30 e das 14h00 às 17h30. Fins de semana, das 10h00 às 13h00 e '
   'das 14h30 às 17h00. Encerra a 1 de janeiro, 1 de maio, 25 de dezembro e nos dias de feira em '
   'Mação. Atenção: as visitas estão por marcação por causa de obras na envolvente.'),

  -- Ourém
  ('castelo-vila-medieval-ourem',
   'Inverno (1 de novembro a final de fevereiro): terça-feira a domingo, das 09h00 às 13h00 e das '
   '14h00 às 17h00. Verão (1 de março a 31 de outubro): terça-feira a domingo, das 10h00 às 13h00 '
   'e das 14h00 às 18h00. Visita livre ou guiada, a guiada com marcação.'),

  -- Tomar
  ('museu-dos-fosforos',
   'Verão (abril a setembro): terça-feira a domingo, das 10h00 às 13h00 e das 14h00 às 18h00. '
   'Inverno (outubro a março): terça-feira a domingo, das 10h00 às 12h00 e das 14h00 às 17h00. '
   'Encerra a 1 de janeiro, 1 de maio e 25 de dezembro. Entrada gratuita.'),
  ('sinagoga-museu-luso-hebraico',
   'Verão (abril a setembro): terça-feira a domingo, das 10h00 às 13h00 e das 14h00 às 18h00. '
   'Inverno (outubro a março): terça-feira a domingo, das 10h00 às 12h00 e das 14h00 às 17h00. '
   'Encerra a 1 de janeiro, 1 de maio e 25 de dezembro.'),
  ('cine-teatro-paraiso',
   'Bilheteira: terça-feira a sábado, das 15h00 às 18h00. Em dias de espetáculo, das 15h00 às '
   '19h00 e das 20h00 às 21h30. Cinema comercial: segunda, das 20h00 às 21h00; domingo, das '
   '10h00 às 11h00, das 15h00 às 16h00 e das 20h00 às 21h00.'),
  ('convento-de-cristo',
   'Outubro a maio, das 09h00 às 17h30 (última entrada às 17h00). Junho a setembro, das 09h00 às '
   '18h30 (última entrada às 18h00). Encerra a 1 de janeiro, 1 de março, domingo de Páscoa, '
   '1 de maio, 24 e 25 de dezembro. Há zonas com acesso condicionado por obras de conservação.'),

  -- Torres Novas
  ('biblioteca-gustavo-pinto-lopes',
   'Segunda-feira e sábado, das 10h00 às 13h00 e das 14h30 às 18h30. Terça a sexta, das 09h30 às '
   '18h30. Encerra ao domingo e nos feriados.'),

  -- Vila Nova da Barquinha
  ('galeria-do-parque',
   'Terça-feira a sábado. Verão (março a setembro), das 14h00 às 19h00; inverno (outubro a '
   'fevereiro), das 14h00 às 17h30. Entrada gratuita.'),
  ('centro-cultural-barquinha',
   'Dias úteis, das 09h00 às 12h30 e das 14h00 às 17h30. Sábados, domingos e feriados: verão '
   '(março a setembro), das 10h00 às 13h00 e das 15h00 às 18h00; inverno (outubro a fevereiro), '
   'das 10h00 às 13h00 e das 14h30 às 17h30.'),
  ('castelo-de-almourol',
   'Verão (março a setembro), das 09h30 às 13h00 e das 14h30 às 18h30. Inverno (outubro a '
   'fevereiro), das 10h00 às 13h00 e das 14h30 às 17h00. A última travessia é 40 minutos antes '
   'do encerramento. Bilhete 4 € a partir dos 7 anos, com acesso ao castelo e ao CITA.')
) as d(id, horario)
where v.id = d.id;

-- ---------------------------------------------------------------------------
-- A ligação do Convento de Cristo deixou de mostrar o monumento.
--
-- `conventocristo.gov.pt` responde 200, mas o que serve hoje é a página de
-- espera do novo portal Museus e Monumentos de Portugal — «Em breve», sem
-- horário, sem morada, sem preço. Uma ligação que responde e não serve é
-- uma ligação partida com melhores modos.
--
-- Passa a apontar para a página do monumento no portal que a substituiu.
--
-- De passagem, uma confirmação que interessa ao histórico: **é a própria
-- página oficial que escreve «Convento de Cristo · 2300-000 Tomar»**. Era de
-- lá que vinha o código postal que a 0091 tirou da ficha. Continua a não ser
-- um código dos CTT, e continua fora — mas fica registado que o erro não foi
-- nosso.
-- ---------------------------------------------------------------------------

update public.venues set
  website_url = 'https://www.museusemonumentos.pt/pt/museus-e-monumentos/convento-de-cristo',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: conventocristo.gov.pt responde 200 mas serve a página de espera do '
    'portal Museus e Monumentos de Portugal, sem informação do monumento. Passa a apontar para a '
    'página do Convento no portal novo. A morada oficial aí publicada é «Convento de Cristo · '
    '2300-000 Tomar» — é a origem do código postal que a 0091 removeu, e continua removido.',
  updated_at = now()
where id = 'convento-de-cristo';

-- ---------------------------------------------------------------------------
do $$
declare
  sem_data integer;
  n        integer;
begin
  -- Postcondições. Numa base vazia contam zero e passam caladas.

  -- 1. A regra da casa, verificada e não só declarada: nenhum horário sem data.
  select count(*) into sem_data
  from public.venues
  where opening_hours is not null and opening_hours_checked_on is null;

  if sem_data > 0 then
    raise exception '% horário(s) sem a data em que foram lidos', sem_data;
  end if;

  -- 2. A ressalva das obras de Mação vive em dois sítios — na nota de
  --    acessibilidade e no horário — porque quem lê um não lê forçosamente o
  --    outro, e chegar lá e estar fechado é o mesmo desgosto pelas duas vias.
  select count(*) into n
  from public.venues
  where id = 'museu-arte-pre-historica-macao'
    and opening_hours is not null
    and opening_hours !~* 'marcação';

  if n > 0 then
    raise exception 'o horário de Mação deixou de dizer que as visitas são por marcação';
  end if;

  -- 3. A ligação de espera não volta à ficha do Convento.
  select count(*) into n
  from public.venues
  where id = 'convento-de-cristo' and website_url like '%conventocristo.gov.pt%';

  if n > 0 then
    raise exception 'o Convento de Cristo voltou a apontar para a página de espera';
  end if;

  select count(*) into n from public.venues where opening_hours is not null;
  raise notice '% espaços dizem quando estão abertos', n;
end
$$;
