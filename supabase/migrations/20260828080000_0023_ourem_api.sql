-- 0023 — Ourém entra pela sua própria API.
--
-- A migração 0022 deixou `cm-ourem` desligada com a razão escrita: a API
-- existe, é pública, é a melhor fonte do território, e faltava o adaptador que
-- a lê. O adaptador está escrito e testado contra a resposta verdadeira
-- (`packages/ingest/src/__fixtures__/ourem-api.json`, 28 de agosto de 2026).
--
-- É a primeira fonte do Coreto que traz hora de início e coordenadas.

update public.sources set
  url = 'https://servicos.ourem.pt/api/index.php?service=list_eventos',
  adapter = 'ourem-api',
  is_enabled = true,
  min_expected_items = 1,
  -- A fonte esteve desligada à espera do adaptador. O histórico de falhas que
  -- daí veio não diz nada sobre a API e não pode manter o disjuntor aberto na
  -- primeira noite com o adaptador certo.
  consecutive_failures = 0,
  circuit_open_until = null,
  last_error = null,
  notes = 'API JSON pública do município, sem chave. Traz identificador estável, '
       || 'datas em ISO, hora, sinopse, imagem, local e coordenadas. Os outros '
       || 'serviços da mesma API (filter_event, lists_event_day) devolveram '
       || 'lista vazia em todas as datas sondadas e não são lidos.'
where id = 'cm-ourem';

-- ---------------------------------------------------------------------------
-- O que deliberadamente NÃO se faz aqui: aliases para a `tipologia` de Ourém.
--
-- A API classifica tudo em dois baldes — «Eventos Municipio» e «Atividades
-- Recreativas/Desportivas». O segundo é tentador: parece «Desporto e
-- natureza». Mas os eventos que o trazem incluem a Feira de São Bartolomeu,
-- que é uma feira de olaria centenária, ao lado de provas de trail. Mapeá-lo
-- punha a Feira das Panelas na categoria de desporto.
--
-- Sem alias, a etiqueta desconhecida vai para `unknown_tags` — que é a fila
-- para uma pessoa decidir — e a categoria é resolvida pelo título e pela
-- descrição, que em «Feira de São Bartolomeu» acerta. Uma taxonomia que
-- adivinha a partir de um balde grosseiro erra com confiança; esta erra a
-- pedir ajuda.
-- ---------------------------------------------------------------------------

do $$
declare
  ligadas int;
begin
  select count(*) into ligadas
  from public.sources
  where id = 'cm-ourem' and is_enabled and adapter = 'ourem-api';

  if ligadas <> 1 then
    raise exception 'cm-ourem devia ficar ligada com o adaptador ourem-api';
  end if;
end
$$;
