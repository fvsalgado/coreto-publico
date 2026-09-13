-- 0116 — A pesquisa lê português: sem acentos, pelo radical, e com índice.
--
-- ## O que estava mal
--
-- A caixa «Pesquisar» da agenda, e o `q` da API, faziam um `ilike '%…%'` ao
-- título e ao resumo. Três defeitos, todos medidos:
--
--   * **acentos**: «virginia» não encontrava o Teatro Virgínia, e no telemóvel
--     ninguém escreve o til — o `/espacos` já tira os acentos em JavaScript,
--     mas a agenda tem centenas de linhas e não se filtra em memória;
--   * **plural e conjugação**: «concertos» não encontrava «concerto», «fados»
--     não encontrava «fado»;
--   * **custo**: o título tem um índice de trigramas, o resumo não, e um «ou»
--     entre os dois varria a tabela inteira a cada pesquisa.
--
-- ## O que esta migração faz
--
-- Uma configuração de pesquisa de texto, `public.portugues`, que é a
-- `portuguese` do Postgres com o dicionário `unaccent` à frente do radical:
-- «Virgínia», «virginia» e «VIRGINIA» dão o mesmo lexema. Uma coluna gerada
-- em `events`, `search_vector`, com o título a pesar mais do que o subtítulo
-- e o sítio, e estes mais do que o resumo — é o mesmo peso que os olhos dão
-- a um cartaz. E um índice GIN por cima, que é o que torna a pesquisa uma
-- leitura de índice em vez de uma varredura.
--
-- O `to_tsvector(regconfig, text)` é imutável, e é por isso que pode viver
-- numa coluna gerada; as `tags` ficam de fora porque `array_to_string` não o
-- é. A consulta faz-se do lado do sítio com `to_tsquery` na mesma
-- configuração e prefixos (`fad:*` encontra «fado» e «fados»), por isso quem
-- escreve meia palavra também encontra.

create text search configuration public.portugues (copy = pg_catalog.portuguese);

alter text search configuration public.portugues
  alter mapping for hword, hword_part, word
  with extensions.unaccent, pg_catalog.portuguese_stem;

comment on text search configuration public.portugues is
  'Português sem acentos e pelo radical: a configuração da pesquisa da agenda.';

alter table public.events
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('public.portugues', coalesce(title, '')), 'A')
    || setweight(to_tsvector('public.portugues', coalesce(subtitle, '')), 'B')
    || setweight(to_tsvector('public.portugues', coalesce(location_name, '')), 'B')
    || setweight(to_tsvector('public.portugues', coalesce(description_short, '')), 'C')
  ) stored;

comment on column public.events.search_vector is
  'O que a pesquisa lê: título (A), subtítulo e sítio (B), resumo (C), em '
  'português sem acentos. Gerada; nunca se escreve.';

create index events_search_idx on public.events using gin (search_vector);
