-- 0040 — Dois nomes que viram alias: MIAA por extenso e o auditório do Paço.
--
-- O pipeline liga um evento ao espaço quando o nome que a fonte usa, depois
-- de normalizado, existe em `venue_aliases`. A recolha de 2026-08-28 deixou
-- à vista dois nomes reais que o catálogo conhece mas o alias não cobria:
--
--   · «MIAA – Museu Ibérico de Arqueologia e Arte de Abrantes» — a forma da
--     agenda municipal de Abrantes («de Abrantes» por extenso, contra o
--     «(Abrantes)» do nome canónico);
--   · «Auditório Paço dos Condes» — a agenda de Ourém chama assim ao
--     auditório do Paço dos Condes de Ourém, que no catálogo vive com o
--     castelo e a vila medieval.
--
-- Cada nome resolvido uma vez vira alias e melhora todas as recolhas
-- seguintes; os `update` por baixo ligam já os eventos que ficaram soltos,
-- em vez de esperar pela próxima madrugada. Os aliases guardam-se na forma
-- normalizada (minúsculas, sem acentos, só [a-z0-9]), como os restantes.

insert into public.venue_aliases (alias, venue_id) values
  ('miaamuseuibericodearqueologiaeartedeabrantes', 'miaa'),
  ('auditoriopacodoscondes', 'castelo-vila-medieval-ourem')
on conflict (alias) do nothing;

update public.events
set venue_id = 'miaa', updated_at = now()
where venue_id is null
  and municipality_id = 'abrantes'
  and location_name = 'MIAA – Museu Ibérico de Arqueologia e Arte de Abrantes';

update public.events
set venue_id = 'castelo-vila-medieval-ourem', updated_at = now()
where venue_id is null
  and municipality_id = 'ourem'
  and location_name = 'Auditório Paço dos Condes';

-- ---------------------------------------------------------------------------
do $$
declare
  v_aliases integer;
begin
  select count(*) into v_aliases
  from public.venue_aliases
  where (alias = 'miaamuseuibericodearqueologiaeartedeabrantes' and venue_id = 'miaa')
     or (alias = 'auditoriopacodoscondes' and venue_id = 'castelo-vila-medieval-ourem');
  if v_aliases <> 2 then
    raise exception 'esperavam-se os 2 aliases novos de espaço, e há %', v_aliases;
  end if;
end
$$;
