-- 0049 — As colunas públicas das fontes.
--
-- A tabela `sources` tem RLS ligada e nenhuma política: ninguém a lê com a
-- chave pública, e é assim de propósito. Lá dentro está o `config` (que numa
-- fonte traz o cabeçalho `Origin` combinado com a câmara de Abrantes), o
-- `notes` da recolha e o `last_error` da última avaria. Nada disso é para a
-- rua.
--
-- Mas a pergunta «que fontes é que esta agenda lê?» é pública, e a resposta
-- devia ser. A saída não é abrir a tabela nem esconder a projeção segura
-- dentro de uma vista com privilégios de dono — é dizer ao Postgres, coluna a
-- coluna, o que a chave anónima pode ver. É para isso que existem os
-- privilégios por coluna, e é a forma mais curta de escrever a intenção: as
-- dez colunas de baixo são públicas, as outras não são.
--
-- A política de linhas deixa passar todas: uma fonte desligada é precisamente
-- a que interessa mostrar — é ela que explica porque é que falta um concelho.

create policy sources_public_read on public.sources
  for select to anon, authenticated
  using (true);

-- Primeiro tira-se tudo, para não sobrar um privilégio de tabela inteira que
-- torne os privilégios por coluna decorativos.
revoke select on public.sources from anon, authenticated;

grant select (
  id,
  name,
  kind,
  municipality_id,
  venue_id,
  url,
  is_enabled,
  last_success_at,
  public_note
) on public.sources to anon, authenticated;

-- ---------------------------------------------------------------------------
do $$
declare
  v_publicas integer;
  v_proibidas integer;
begin
  select count(*) into v_publicas
    from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'sources'
      and grantee = 'anon' and privilege_type = 'SELECT';
  if v_publicas <> 9 then
    raise exception 'esperavam-se 9 colunas públicas nas fontes, há %', v_publicas;
  end if;

  -- O que esta migração existe para garantir: o caderno, a configuração e o
  -- erro da última recolha não saem daqui.
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
