-- 0095 — O Museu dos Fósforos ganha ligação oficial, e fica escrito o que
-- Tomar tem e nós não temos.
--
-- ## A ligação
--
-- O Museu dos Fósforos é dos espaços mais conhecidos de Tomar e a sua ficha
-- não tinha uma única ligação oficial. Passa a ter a do **Roteiro Museológico
-- de Tomar** (`museus.cm-tomar.pt`), que é o portal do município para os seus
-- museus e onde o museu está.
--
-- É o índice do roteiro e não uma página só dele — o portal não tem
-- endereço por museu que se consiga alcançar. Fica assim porque o índice
-- oficial é melhor do que nada, e porque `visit-tomar.com`, que o TUR4all
-- aponta como o sítio do museu, recusa o nosso agente e não se contorna.
--
-- ## O que a pesquisa encontrou e não cabe nesta migração
--
-- O Roteiro Museológico de Tomar lista **dezasseis espaços museológicos** do
-- município. O catálogo do Coreto tem cinco deles. Ficam de fora, entre
-- outros:
--
--   · **Núcleo de Arte Contemporânea (NAC)** — tem sítio próprio
--     (`nac.cm-tomar.pt`, que responde 200), email `nac@cm-tomar.pt` e
--     telefone. Tem ficha no TUR4all. É o que mais falta.
--   · Casa-Memória Lopes Graça, Centro Interpretativo Tomar Templários,
--     Fundição Tomarense, Central Elétrica de Tomar, Moagem a Portuguesa,
--     Moagem a Nabantina, Centro de Interpretação e Sensibilização Ambiental,
--     e a exposição permanente da Festa dos Tabuleiros.
--
-- As três igrejas e a capela do roteiro não entram: a 0083 tirou os espaços
-- religiosos do catálogo e essa decisão mantém-se.
--
-- Acrescentar espaços é decisão de catálogo e não de ficha, que era o que
-- estava pedido. Fica registado aqui para quem decidir, e em tarefa aberta.

update public.venues set
  website_url = 'https://museus.cm-tomar.pt/',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: passa a ter ligação oficial — o Roteiro Museológico de Tomar, '
    'portal do município para os seus museus, que responde 200. É o índice e não uma página só '
    'do museu: o portal não expõe endereço por museu. visit-tomar.com, que o TUR4all indica como '
    'sítio do museu, recusa o nosso agente e não se contorna. O roteiro lista 16 espaços '
    'museológicos do concelho e o catálogo tem cinco — o Núcleo de Arte Contemporânea, com sítio '
    'próprio em nac.cm-tomar.pt, é o que mais falta.',
  updated_at = now()
where id = 'museu-dos-fosforos';

-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  -- Postcondição sobre a única linha que esta migração toca.
  select count(*) into n
  from public.venues
  where id = 'museu-dos-fosforos' and website_url is null;

  if n > 0 then
    raise exception 'o Museu dos Fósforos continua sem ligação oficial';
  end if;

  select count(*) into n from public.venues where website_url is not null;
  raise notice '% espaços com ligação oficial', n;
end
$$;
