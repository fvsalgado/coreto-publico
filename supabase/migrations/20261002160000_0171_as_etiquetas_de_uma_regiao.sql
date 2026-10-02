-- 0171 — As etiquetas por mapear, recortadas por região.
--
-- A fila das etiquetas por mapear (`unknown_tags_pendentes`, 0084 e 0140) é
-- uma só para o produto inteiro, e conta os eventos de todas as regiões. Com
-- as contas por pessoa (0170), o editor de uma região modera as etiquetas
-- dela — e a lista que lhe aparece tem de ser a das etiquetas que os eventos
-- da região dele trazem, contadas nesses eventos, e não as de outra CIM.
--
-- A etiqueta continua a ser do produto: mapeá-la é taxonomia, e faz-se por
-- migração, por quem opera o Coreto (a página di-lo). O que se recorta é o
-- que cada um vê e conta.
--
-- Segura para o sítio de hoje: é uma função nova, e só o sítio novo a chama —
-- e só para quem tem um papel numa região, o que só existe depois da 0170.

create or replace function public.etiquetas_por_mapear_nas_regioes(p_regioes text[])
returns table (
  tag                    text,
  hits                   integer,
  last_seen              timestamptz,
  example_url            text,
  eventos                bigint,
  eventos_sem_prateleira bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with dos_eventos as (
    select t.tag, t.hits, t.last_seen, t.example_url,
           count(e.id) as eventos,
           count(e.id) filter (where e.category_slug is null) as eventos_sem_prateleira
      from public.unknown_tags t
      join public.events e on t.tag = any (e.categories_raw)
      join public.municipalities m on m.id = e.municipality_id
     where not t.dismissed
       and m.region_id = any (coalesce(p_regioes, '{}'))
       and not exists (
         select 1 from public.category_aliases a
          where a.alias = public.normalize_for_hash(t.tag)
       )
     group by t.tag, t.hits, t.last_seen, t.example_url
  )
  select tag, hits, last_seen, example_url, eventos, eventos_sem_prateleira
    from dos_eventos
   order by eventos desc, hits desc
   limit 200;
$$;

comment on function public.etiquetas_por_mapear_nas_regioes(text[]) is
  'As etiquetas por mapear que os eventos destas regiões trazem, contadas só '
  'nesses eventos. A fila do painel para quem modera uma região (0170): a '
  'etiqueta é do produto, a contagem é da região.';

revoke all on function public.etiquetas_por_mapear_nas_regioes(text[]) from public, anon, authenticated;
grant execute on function public.etiquetas_por_mapear_nas_regioes(text[]) to service_role;

-- ---------------------------------------------------------------------------
-- A prova, numa transação que se desfaz
-- ---------------------------------------------------------------------------
do $$
declare
  v_concelho text;
  v_regiao   text;
  v_outra    text;
  n          bigint;
begin
  select m.id, m.region_id into v_concelho, v_regiao
    from public.municipalities m order by m.sort_order, m.id limit 1;
  if v_concelho is null then
    raise exception using errcode = 'DEADA', message = 'sem concelhos: nada para provar';
  end if;
  select id into v_outra from public.regions where id <> v_regiao order by id limit 1;

  insert into public.unknown_tags (tag, hits) values ('etiqueta-de-prova-0171', 3);
  insert into public.events (slug, title, municipality_id, location_name, status, fingerprint, categories_raw)
  values ('prova-0171', 'Prova da 0171', v_concelho, 'Algures', 'draft', 'prova-0171',
          array['etiqueta-de-prova-0171']);

  select eventos into n from public.etiquetas_por_mapear_nas_regioes(array[v_regiao])
   where tag = 'etiqueta-de-prova-0171';
  assert n = 1, format('a região do evento devia contar 1 evento com a etiqueta, contou %s', n);

  if v_outra is not null then
    select count(*) into n from public.etiquetas_por_mapear_nas_regioes(array[v_outra])
     where tag = 'etiqueta-de-prova-0171';
    assert n = 0, 'a etiqueta de uma região apareceu na lista de outra';
  end if;

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
