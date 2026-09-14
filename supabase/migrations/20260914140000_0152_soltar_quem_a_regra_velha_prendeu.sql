-- 0152 — Soltar quem a regra velha prendeu, e desarmar um alarme falso.
--
-- O código mudou: o disjuntor deixou de contar leituras que trouxeram menos
-- do que o costume e passou a contar só as que não se conseguiram fazer.
-- Mas duas fontes estão presas em estado criado pela regra antiga, e o
-- código novo não desfaz o que o velho escreveu. Isto desfaz.
--
-- É a mesma forma da 0046, e pela mesma razão: uma correção de
-- comportamento que deixa para trás fontes trancadas não está acabada.
--
-- ---------------------------------------------------------------------------
-- 1. A Câmara do Sardoal
-- ---------------------------------------------------------------------------
--
-- **Não tem defeito de extração nenhum.** Medido a 14/09/2026: a página serve
-- quatro blocos `.eb-event-wrapper` — uma reunião de câmara e três sessões de
-- cinema — e o adaptador lê os quatro. O terceiro número vem do nosso próprio
-- `excludeTitles`, que tira a reunião de câmara. Três é a agenda verdadeira
-- do concelho.
--
-- O que a prendeu foi a linha de base. A programação encolheu devagar — seis
-- eventos, cinco, quatro, três — e `nextBaseline` tem uma banda morta que não
-- acompanha descidas de um item de cada vez: `round(6 × 0,7 + 5 × 0,3) = 6`.
-- A linha de base ficou em seis; a contagem caiu para três; e para voltar a
-- «normal» precisava de 4,2. Cada noite contava uma falha, e ao fim de cinco
-- o disjuntor abriu. O concelho deixou de ser lido por ter menos programação.
--
-- A linha de base passa a três, que é o número medido hoje. Não é baixar a
-- fasquia para calar um aviso: é substituir uma medição velha por uma nova.
-- O `min_expected_items = 1` continua de pé e continua a apanhar o dia em que
-- o seletor parta a sério — zero itens dá deriva, e a deriva não escreve nada.
--
-- ---------------------------------------------------------------------------
-- 2. O feed morto do Sardoal e do Mação
-- ---------------------------------------------------------------------------
--
-- O `joomla-eventbooking` lê o HTML e o feed da mesma agenda, e usa o feed
-- como segunda testemunha: se o HTML não der blocos e o feed trouxer eventos,
-- **lança**, porque isso quer dizer que o seletor deixou de casar. É uma boa
-- ideia, e depende de o feed estar vivo.
--
-- Não está. Verificado ao vivo hoje no Sardoal: o feed serve dez itens, e os
-- dez são de 2023 — «Asteroid City», exposições de dezembro de 2023. Está
-- parado há mais de dois anos. No Mação a prova é a fixture de 28/08 (o sítio
-- está bloqueado e não lhe batemos): `pubDate` de março e dezembro de 2023.
--
-- Duas consequências, e a segunda é uma bomba por rebentar:
--
--   * O aviso «o HTML deu 4 blocos e o feed 10 eventos» compara a agenda de
--     hoje com um feed de 2023. Não é sinal de nada, e manda quem o lê
--     procurar um seletor partido que está intacto.
--
--   * **No dia em que a agenda do Sardoal estiver honestamente vazia** — e
--     já vai em três eventos — o HTML dará zero blocos, o feed continuará a
--     trazer os seus dez fósseis, e a recolha rebenta com «o seletor deixou
--     de casar». Uma frase falsa, numa noite em que não há nada de errado.
--
-- `skipFeed` desliga a segunda testemunha onde ela já não testemunha nada.
-- Poupa um pedido a cada fonte, por acréscimo.
--
-- ---------------------------------------------------------------------------
-- 3. O Teatro Virgínia
-- ---------------------------------------------------------------------------
--
-- Fica com o disjuntor limpo, e **não se finge que está resolvido**. A avaria
-- é outra e continua de pé: o servidor manda os cabeçalhos e depois não acaba
-- de mandar o corpo dentro dos quarenta e cinco segundos, três vezes por
-- noite, desde 4 de setembro. Daqui responde em 2,4 s. Já tem as duas manhãs
-- que a 0046 descobriu — `timeoutMs` e `semCompressao` — e elas funcionaram
-- uma semana antes de a coisa voltar, pior.
--
-- Limpa-se o disjuntor por uma razão só: **para se poder medir.** Com a pausa
-- armada até amanhã, uma corrida dirigida à fonte é saltada sem escrever
-- linha nenhuma, e não há diagnóstico possível. Isto abre a porta para a
-- medição, não afirma que a avaria passou.

update public.sources set
  config = coalesce(config, '{}'::jsonb) || '{"skipFeed": true}'::jsonb,
  baseline_item_count = 3,
  consecutive_failures = 0,
  circuit_open_until = null,
  last_error = null,
  notes = coalesce(notes || ' ', '') ||
    'Solto a 2026-09-14: a agenda encolheu de 6 para 3 eventos, e a linha de base não acompanha ' ||
    'descidas de um item (banda morta do nextBaseline). O disjuntor abriu por isso, sob a regra ' ||
    'antiga que contava contagens em baixo como falhas. Linha de base reposta no número medido ' ||
    'hoje. skipFeed porque o feed está parado em 2023 e armava um «o seletor deixou de casar» ' ||
    'falso para o dia em que a agenda estiver vazia.',
  updated_at = now()
where id = 'cm-sardoal';

update public.sources set
  config = coalesce(config, '{}'::jsonb) || '{"skipFeed": true}'::jsonb,
  updated_at = now()
where id = 'cm-macao';

update public.sources set
  consecutive_failures = 0,
  circuit_open_until = null,
  updated_at = now()
where id = 'teatro-virginia';

-- ---------------------------------------------------------------------------
-- A prova, aqui dentro, porque uma migração que não verifica o que fez é uma
-- intenção e não uma alteração.
-- ---------------------------------------------------------------------------
do $$
declare
  v_presas integer;
  v_com_feed integer;
  v_base integer;
begin
  select count(*) into v_presas
    from public.sources
   where id in ('cm-sardoal', 'teatro-virginia')
     and (circuit_open_until is not null or consecutive_failures <> 0);
  if v_presas <> 0 then
    raise exception 'ficaram % fonte(s) ainda presas no disjuntor', v_presas;
  end if;

  select count(*) into v_com_feed
    from public.sources
   where id in ('cm-sardoal', 'cm-macao')
     and coalesce((config ->> 'skipFeed')::boolean, false) is not true;
  if v_com_feed <> 0 then
    raise exception '% fonte(s) com feed de 2023 ainda a ser lido', v_com_feed;
  end if;

  select baseline_item_count into v_base
    from public.sources where id = 'cm-sardoal';
  if v_base <> 3 then
    raise exception 'a linha de base do Sardoal ficou em %, e o medido hoje é 3', v_base;
  end if;
end $$;
