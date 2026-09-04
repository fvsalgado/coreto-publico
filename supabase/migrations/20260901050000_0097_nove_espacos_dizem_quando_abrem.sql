-- 0097 — Mais nove espaços dizem quando abrem, e três dizem por que número.
--
-- Segunda passagem aos campos vazios, feita nas fontes oficiais de cada
-- concelho. O horário passa de 21 para 30 espaços; três ganham o segundo
-- número que a fonte publica e que faltava.
--
-- ## Os horários, e o que se aprendeu a lê-los
--
-- **Três destes não são horários de porta aberta, são de bilheteira** — o
-- Teatro Virgínia, o Gil Vicente e (já desde a 0094) o Cine-Teatro Paraíso.
-- Um teatro não se «visita»: vai-se lá à hora do espetáculo, e o que interessa
-- saber é quando é que se compram bilhetes ao balcão. O texto di-lo por
-- extenso, para ninguém aparecer às três da tarde à espera de ver a sala.
--
-- **Dois têm calendário e não só semana.** A biblioteca de Tomar tem três
-- horários — setembro a junho, julho, agosto — e a de Ferreira do Zêzere
-- fecha aos sábados de julho a setembro. É por isto que o campo é texto
-- livre e não uma grelha de dias e horas: a grelha perdia a parte que faz a
-- pessoa ir ou não ir.
--
-- ## Os telefones
--
-- Três fichas tinham um número onde a fonte publica dois. Não é preciosismo:
-- na Casa-Memória de Camões o segundo é um telemóvel, que é o que atende
-- quando o fixo do museu não atende. `telefones()` já sabe partir a lista
-- pelo ` / ` e montar um `tel:` por número.
--
-- ## O que se recusou, outra vez
--
-- **A bilheteira do Teatro Virgínia continua vazia.** Confirmei na página
-- deles: a venda online é pelo BOL (`teatrovirginia.bol.pt`). Esta casa não
-- usa o BOL, e por isso o campo fica vazio e o horário do guichê fica no
-- lugar dele. Fica escrito na nota para não se voltar a procurar.
--
-- **A morada do Cine-Teatro São Pedro de Alcanena não muda.** A página do
-- município diz «Rua 25 de Abril» e «300 pessoas»; a nossa ficha diz
-- «Avenida 25 de Abril» e «trezentos e quarenta e dois lugares», e veio de um
-- levantamento anterior que a verificou. **Uma fonte nova que contradiz uma
-- verificação antiga não a substitui só por ser nova** — fica a divergência
-- registada na nota, para quem for ao terreno decidir.
--
-- **O email da biblioteca de Mação e o da de Alcanena continuam vazios.** As
-- páginas municipais escondem-nos atrás de JavaScript, e o que lá está à
-- vista é o endereço geral da câmara. Um endereço geral no campo do email de
-- um espaço é dizer ao leitor que tem o contacto do espaço quando não tem.

-- ---------------------------------------------------------------------------
-- I. Nove horários.
-- ---------------------------------------------------------------------------

update public.venues v set
  opening_hours = d.horario,
  opening_hours_checked_on = date '2026-09-01',
  updated_at = now()
from (values

  ('biblioteca-municipal-sardoal',
   'Terça-feira, das 11h00 às 13h00 e das 14h00 às 18h00. Quarta-feira a sábado, das 10h00 às '
   '13h00 e das 14h00 às 18h00. Encerra à segunda, ao domingo e nos feriados.'),

  ('centro-cultural-gil-vicente',
   'Bilheteira: terça-feira a sábado, das 15h00 às 19h00. Em dias de espetáculo, abre uma hora '
   'antes do início.'),

  ('ceft-casa-dos-cubos',
   'Inverno: terça a sexta, das 10h00 às 12h00 e das 14h00 às 17h00; sábados e domingos, das '
   '14h00 às 17h00. Verão: terça a sexta, das 10h00 às 13h00 e das 14h00 às 18h00; sábados e '
   'domingos, das 14h00 às 18h00. Encerra nos feriados.'),

  ('teatro-virginia',
   'Bilheteira: segunda a sexta, das 11h00 às 12h30 e das 15h00 às 18h30. Em dias de espetáculo '
   'abre duas horas antes e fecha meia hora depois de o espetáculo começar.'),

  ('casa-memoria-de-camoes',
   'Verão: segunda a sexta, das 09h30 às 12h30 e das 14h00 às 18h00; sábados, domingos e '
   'feriados, das 14h00 às 18h00. Inverno: segunda a sexta, das 09h30 às 12h30 e das 14h00 às '
   '17h00; sábados, domingos e feriados, das 14h00 às 17h00.'),

  ('biblioteca-municipal-entroncamento',
   'Segunda a sexta, das 09h30 às 18h00. Sábado, das 09h30 às 13h00.'),

  ('biblioteca-municipal-tomar',
   'De setembro a junho: segunda a sexta, das 09h30 às 18h30; sábado, das 10h00 às 13h00. Em '
   'julho: segunda a sexta, das 09h30 às 13h00 e das 14h30 às 18h00; sábado, das 10h00 às 13h00. '
   'Em agosto: segunda a sexta, das 09h30 às 13h00 e das 14h30 às 18h00; encerra ao sábado.'),

  ('casa-da-cultura-pateo',
   'Dias úteis, das 09h00 às 12h30 e das 14h00 às 17h30.'),

  ('biblioteca-municipal-ferreira-do-zezere',
   'Segunda a sexta, das 09h00 às 18h30. Sábado, das 09h00 às 12h30 — mas em julho, agosto e '
   'setembro encerra ao sábado.')

) as d(id, horario)
where v.id = d.id;

-- ---------------------------------------------------------------------------
-- II. Três segundos números.
-- ---------------------------------------------------------------------------

update public.venues v set phone = d.tel, updated_at = now()
from (values
  ('casa-memoria-de-camoes',   '+351 249 730 052 / +351 915 742 309'),
  ('biblioteca-municipal-tomar','+351 249 329 874 / +351 249 324 141'),
  ('casa-da-cultura-pateo',    '+351 249 889 114 / +351 939 091 302')
) as d(id, tel)
where v.id = d.id;

-- ---------------------------------------------------------------------------
-- III. O que se aprendeu e não muda campo nenhum, mas fica escrito.
-- ---------------------------------------------------------------------------

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: a venda online de bilhetes é pelo BOL (teatrovirginia.bol.pt), '
    'confirmado na página da bilheteira. Como esta casa não usa o BOL, ticketing_url fica vazio e '
    'o campo do horário leva o do guichê. Não voltar a procurar plataforma.',
  updated_at = now()
where id = 'teatro-virginia';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: divergência por resolver no terreno. A página do município '
    '(cm-alcanena.pt) diz «Rua 25 de Abril, 2380-042» e «auditório com capacidade para 300 '
    'pessoas»; a nossa ficha diz «Avenida 25 de Abril» e 342 lugares, de levantamento anterior '
    'verificado. Não se mexeu: uma fonte nova que contradiz uma verificação antiga não a '
    'substitui só por ser nova. A biblioteca do mesmo concelho também está na Rua 25 de Abril, '
    'com o mesmo código postal, o que dá algum peso à versão do município.',
  updated_at = now()
where id = 'cine-teatro-sao-pedro-alcanena';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: morada e código postal reconfirmados em visitferreiradozezere.pt '
    '(«R. Ferreira do Alentejo n.º 2, 2240-388»). Sem horário publicado.',
  updated_at = now()
where id = 'centro-cultural-alfredo-keil';

-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  tocados constant text[] := array[
    'biblioteca-municipal-sardoal','centro-cultural-gil-vicente','ceft-casa-dos-cubos',
    'teatro-virginia','casa-memoria-de-camoes','biblioteca-municipal-entroncamento',
    'biblioteca-municipal-tomar','casa-da-cultura-pateo','biblioteca-municipal-ferreira-do-zezere'];
begin
  -- Postcondições sobre as linhas desta migração. Numa base vazia contam zero.

  -- 1. Os nove ficam com horário e com a data em que foi lido.
  select count(*) into n
  from public.venues
  where id = any(tocados)
    and (opening_hours is null or opening_hours_checked_on is null);

  if n > 0 then
    raise exception '% dos nove horários desta migração ficaram por gravar ou sem data', n;
  end if;

  -- 2. Os três que são de bilheteira dizem-no. Sem esta palavra, a ficha
  --    convida alguém a aparecer num teatro fechado a meio da tarde.
  select count(*) into n
  from public.venues
  where id in ('teatro-virginia','centro-cultural-gil-vicente','cine-teatro-paraiso')
    and opening_hours is not null
    and opening_hours !~* 'bilheteira';

  if n > 0 then
    raise exception '% horário(s) de bilheteira deixaram de dizer que são da bilheteira', n;
  end if;

  -- 3. Os telefones continuam no formato que `telefones()` sabe partir.
  select count(*) into n
  from public.venues
  where id in ('casa-memoria-de-camoes','biblioteca-municipal-tomar','casa-da-cultura-pateo')
    and phone !~ '^\+351 \d{3} \d{3} \d{3}';

  if n > 0 then
    raise exception '% telefones desta migração saíram do formato «+351 NNN NNN NNN»', n;
  end if;

  select count(*) into n from public.venues where opening_hours is not null;
  raise notice '% espaços dizem quando abrem', n;
end
$$;
