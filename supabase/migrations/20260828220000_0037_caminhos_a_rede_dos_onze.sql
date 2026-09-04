-- 0037 — CAMINHOS: a primeira fonte que cobre os onze concelhos de uma vez.
--
-- A CIM do Médio Tejo programa cultura **em rede**: a mesma produção percorre
-- escolas, museus e centros culturais de vários concelhos, e publica tudo em
-- caminhos.mediotejo.pt — o sítio institucional da própria rede, não uma
-- bilheteira nem um agregador de terceiros. A série `caminhos` existe no
-- catálogo desde a 0012, à espera disto.
--
-- Uma fonte destas não tem UM concelho para declarar, e é a primeira assim:
-- `municipality_id` fica a nulo (a coluna sempre o permitiu) e é o adaptador
-- que devolve um evento por concelho, cada um com o seu — uma itinerância que
-- passa por Ferreira do Zêzere e Constância são duas entradas, uma na agenda
-- de cada concelho, com as sessões de lá. O pipeline recusa, um a um e com
-- registo, qualquer candidato que fique sem concelho de nenhum dos lados.
--
-- O que a fonte traz por produção: categoria, duração, público-alvo com
-- classificação etária («Comunidade escolar (M/3)»), condições de acesso,
-- sinopse, cartaz, e as sessões com data, hora, espaço e concelho.

insert into public.sources
  (id, name, kind, municipality_id, venue_id, url, adapter, config, is_enabled,
   -- A grelha de 2026-08-28 tem 10 produções. A programação é por temporada
   -- e pode encolher entre ciclos: abaixo de 1 é a grelha vazia ou o tema
   -- mudou, e quer-se saber — mais do que isso seria alarme falso em julho.
   min_expected_items,
   -- Meia hora depois das municipais, para não bater em todo o lado à mesma hora.
   schedule, notes)
values
  ('caminhos-cimt',
   'CAMINHOS — Programação Cultural em Rede do Médio Tejo',
   'municipal_site',
   null,
   null,
   'https://caminhos.mediotejo.pt/programacao/',
   'caminhos',
   '{}'::jsonb,
   true,
   1,
   '30 4 * * *',
   'Sítio institucional da CIM Médio Tejo (fonte primária, não é agregador). '
   || 'Fonte regional: cobre os onze concelhos, municipality_id a nulo de propósito — '
   || 'o adaptador devolve um evento por concelho com as sessões desse concelho, '
   || 'ligados à série «caminhos» (0012). Contactos da rede: caminhos@cimt.pt.')
on conflict (id) do update set
  name = excluded.name,
  kind = excluded.kind,
  municipality_id = excluded.municipality_id,
  url = excluded.url,
  adapter = excluded.adapter,
  is_enabled = excluded.is_enabled,
  min_expected_items = excluded.min_expected_items,
  schedule = excluded.schedule,
  notes = excluded.notes,
  updated_at = now();

-- A fonte nova não pode nascer a violar as regras da casa: ligada com mínimo
-- declarado, apontada ao domínio institucional, e com o adaptador registado
-- no código (o registo de adaptadores falha alto se não estiver).
do $$
declare
  v_fonte record;
begin
  select * into v_fonte from public.sources where id = 'caminhos-cimt';
  if v_fonte is null then
    raise exception 'a fonte caminhos-cimt não ficou criada';
  end if;
  if v_fonte.is_enabled and v_fonte.min_expected_items < 1 then
    raise exception 'fonte ligada sem mínimo esperado declarado';
  end if;
  if v_fonte.url not like 'https://caminhos.mediotejo.pt/%' then
    raise exception 'a fonte caminhos-cimt aponta para fora do domínio institucional: %', v_fonte.url;
  end if;
end
$$;
