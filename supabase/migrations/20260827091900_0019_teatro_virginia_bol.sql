-- 0019 — Teatro Virgínia: a agenda está na bilheteira, não no site da sala.
--
-- O site próprio (`teatrovirginia.pt`) é um Joomla que monta a programação já
-- no browser: quem o lê do servidor recebe o esqueleto da página e nenhum
-- espetáculo. A fonte ficou desde o seed a apontar para lá com o adaptador
-- `generic-html`, o que só podia dar recolhas vazias — e uma recolha vazia
-- não faz barulho nenhum, limita-se a não trazer Torres Novas.
--
-- A verdade estruturada está na loja BOL da sala. É uma white-label de um
-- equipamento só: tudo o que lá se vende é do Teatro Virgínia, por isso não
-- se declara `venueSlugSuffix` e leva-se a loja inteira. Numa bilheteira
-- municipal — que vende o teatro, o museu e o pavilhão pelo mesmo domínio —
-- esse sufixo passa a ser obrigatório, sob pena de se pendurar um trail na
-- programação do cine-teatro.
--
-- `venueName` não é decoração: é o nome que a ficha do bilhete declara em
-- `location.name`, e serve para deixar cair um bilhete que a loja venda mas
-- que aconteça noutra sala (uma digressão, uma coprodução fora de casa).

update public.sources
set
  url = 'https://teatrovirginia.bol.pt/Comprar/Bilhetes/Lista',
  adapter = 'bol-store',
  config = jsonb_build_object('venueName', 'Teatro Virgínia'),
  notes = 'O site próprio monta a agenda no browser e não serve de fonte. A programação é lida da loja BOL da sala, que é white-label de um equipamento só.',
  -- A fonte esteve a apontar para o sítio errado: o histórico de falhas que
  -- daí veio não diz nada sobre a loja e não pode manter o disjuntor aberto
  -- na primeira noite com o adaptador certo.
  consecutive_failures = 0,
  circuit_open_until = null,
  last_error = null
where id = 'teatro-virginia';
