-- 0114 — As exposições já gravadas dizem que estão em cartaz.
--
-- ## O que estava mal
--
-- A regra da casa está escrita em `packages/core/src/dates.ts`: um intervalo
-- dá **dois** extremos, nunca um dia por cada dia lá pelo meio. Os adaptadores
-- cumpriam metade dela — os dois extremos ficavam gravados e os dias do meio
-- não eram fabricados — e ninguém escrevia a outra metade: que aqueles dois
-- dias são os **extremos de uma coisa contínua**.
--
-- O resultado é uma ficha que se contradiz. A exposição «Intervenção de
-- conservação e restauro da coleção de arqueologia industrial da Central do
-- Caldeirão», de Torres Novas, está patente de 27 de setembro de 2025 a 20 de
-- setembro de 2026. Na ficha lia-se «2 sessões», seguidas do dia de abrir e do
-- dia de fechar — a dizer, a quem lesse, que nos onze meses do meio não havia
-- nada para ver. E no cartão ao lado lia-se o intervalo inteiro, porque
-- `date_start` e `date_end` saem dos mesmos dois extremos e ficavam certos.
-- A mesma página a afirmar duas coisas incompatíveis, uma por baixo da outra.
--
-- No calendário era pior, porque fica na agenda de quem subscreveu: duas
-- sessões passam por baixo do tecto que encolhe as temporadas num compromisso
-- só, e por isso saíam dois `VEVENT` — o dia de abrir e o dia de fechar
-- marcados, e os meses do meio em branco.
--
-- A coluna `is_ongoing` existe desde a 0004 e servia exatamente para isto.
-- Estava a `false` nos **195 eventos** da base, sem uma única excepção: nunca
-- ninguém a escreveu.
--
-- ## O que esta migração corrige, e o que deixa em paz
--
-- Marca `is_ongoing` nos eventos que já estão gravados com **exactamente dois
-- extremos e um vão pelo meio**. São 48 à data em que isto foi escrito: 39
-- publicados, com vãos de 2 a 358 dias — 29 deles de um mês ou mais, 16 de
-- três meses ou mais.
--
-- O predicado é estreito de propósito, porque a pergunta «isto é um período ou
-- são dois compromissos?» não se responde olhando para as datas. Responde-se
-- sabendo **quem escreveu as linhas**:
--
--   · **Só os adaptadores cujas duas sessões são, por construção, os extremos
--     de um intervalo declarado pela fonte** — `joomla-eventbooking` (lê
--     «02/06/2026 - 30/09/2026» de um campo só), `ourem-api` e
--     `abrantes-proxy` (leem `data_inicio`/`data_fim`), e os dois que esta
--     mesma leva de vencida, `municipal-cms` e `generic-html`. Estes nunca
--     escrevem duas sessões por outro motivo.
--
--   · **Nunca o `paraiso`.** O Cine-Teatro Paraíso publica «30 de agosto .
--     domingo . 16h00 | 31 de agosto . segunda . 21h00» — duas datas no mesmo
--     resumo que são mesmo dois espetáculos, com horas diferentes. Há um
--     evento dele com dois dias e uma semana pelo meio, e são duas sessões.
--     Marcá-lo em cartaz apagava um compromisso verdadeiro, que é o erro
--     simétrico e mais caro do que aquele que se está a corrigir.
--
--   · **Nem os `portal-freguesia`, `caminhos`, `rss-eventos` ou
--     `teatro-virginia`**, que não têm hoje um único evento nesta forma e
--     cujas duas datas, quando as houver, não querem dizer a mesma coisa.
--
--   · **Vão de dois dias ou mais.** Dois dias colados — «sábado e domingo» —
--     são uma lista completa: não falta lá nada e ninguém está a ser
--     enganado. Marcá-los seria arriscar transformar dois compromissos
--     seguidos num período sem ter nada a ganhar com isso. Onde for mesmo um
--     fim de semana em cartaz, é a recolha seguinte que o corrige, com a
--     leitura da fonte à frente e não com uma dedução feita aqui.
--
--   · **Só `origin = 'scraper'`.** O que veio do formulário público já
--     resolve isto em `apps/web/src/lib/submissions/build-row.ts`, e o que uma
--     pessoa introduziu à mão não é para ser adivinhado por um `update`.
--
-- ## Porque é que uma migração, se a recolha da noite seguinte corrigia isto
--
-- Corrigia **quase** tudo. Seis destes eventos são de `cm-torresnovas`, cuja
-- fonte está desligada: entraram por instantâneo (ver a 0061) e nenhuma
-- recolha lhes volta a tocar. Entre eles está a exposição de onze meses do
-- exemplo lá em cima, publicada. Sem isto, ficavam assim para sempre.
--
-- Os outros 42 são corrigidos duas vezes — aqui e na recolha seguinte — e
-- isso não faz mal nenhum: a recolha escreve o que lê da fonte por cima, e o
-- que ela lê é o mesmo que isto escreve. O que se ganha é não ter a agenda a
-- contradizer-se durante mais uma noite.
--
-- Idempotente: o `where` exclui o que já está marcado, e correr isto duas
-- vezes não muda uma linha na segunda.

update public.events e
   set is_ongoing = true,
       updated_at = now()
 where e.is_ongoing = false
   and e.origin = 'scraper'
   -- Ver a lista acima: só os adaptadores cujas duas sessões são, por
   -- construção, os extremos de um intervalo que a fonte declarou.
   and exists (
         select 1
           from public.sources src
          where src.id = e.source_id
            and src.adapter in (
              'joomla-eventbooking',
              'ourem-api',
              'abrantes-proxy',
              'municipal-cms',
              'generic-html'
            )
       )
   -- Dois extremos, e um vão pelo meio que ninguém afirmou. As canceladas
   -- ficam de fora pela mesma razão por que ficam de fora do `date_start`:
   -- ver `refresh_event_dates`, na 0004.
   and (
         select count(*) = 2
            and max(es.session_date) - min(es.session_date) >= 2
           from public.event_sessions es
          where es.event_id = e.id
            and es.is_cancelled = false
       );
