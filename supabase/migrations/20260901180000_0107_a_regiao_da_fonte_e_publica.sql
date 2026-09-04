-- 0107 — A região de uma fonte é pública.
--
-- A 0106 criou `sources.region_id` mas a chave anónima não a via: a 0049
-- fechou a tabela e abriu coluna a coluna, de propósito, e uma coluna nova
-- nasce fechada — que é o comportamento certo, e é também por isso que esta
-- migração existe em vez de a região ter entrado em silêncio. A página de
-- fontes filtra por ela; sem o privilégio, o PostgREST recusava a consulta
-- inteira e a página degradava para o vazio.
--
-- Vai em migração própria e não numa edição da 0106 porque a 0106 já correu
-- em produção — a história não se reescreve.

grant select (region_id) on public.sources to anon, authenticated;

-- ---------------------------------------------------------------------------
do $$
declare
  v_publicas integer;
  v_proibidas integer;
begin
  -- As nove da 0049 mais esta.
  select count(*) into v_publicas
    from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'sources'
      and grantee = 'anon' and privilege_type = 'SELECT';
  if v_publicas <> 10 then
    raise exception 'esperavam-se 10 colunas públicas nas fontes, há %', v_publicas;
  end if;

  -- A garantia da 0049 continua de pé: o caderno, a configuração e o erro
  -- da última recolha não saem daqui.
  select count(*) into v_proibidas
    from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'sources'
      and grantee = 'anon' and privilege_type = 'SELECT'
      and column_name in ('config', 'notes', 'last_error', 'circuit_open_until',
                          'consecutive_failures', 'baseline_item_count', 'min_expected_items');
  if v_proibidas > 0 then
    raise exception 'a chave anónima ganhou acesso a % colunas internas das fontes', v_proibidas;
  end if;
end
$$;
