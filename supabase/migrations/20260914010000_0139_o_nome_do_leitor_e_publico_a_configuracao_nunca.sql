-- 0139 — O nome do leitor de cada fonte passa a ser público. A configuração,
-- nunca.
--
-- **Porquê agora.** A 12 e 13 de setembro de 2026, oito fontes do Médio Tejo
-- não responderam a um único pedido — `http_responses = 0` nas duas noites —,
-- enquanto as 26 juntas de freguesia responderam a todas. Sete das oito correm
-- o mesmo leitor, `joomla-eventbooking`; a oitava é o CAMINHOS. Nos catorze
-- dias anteriores, zero fontes mudas.
--
-- Oito domínios diferentes a calarem-se na mesma noite não são oito avarias:
-- são uma, e é quase de certeza do lado de lá — um fornecedor comum, uma regra
-- nova num WAF, um bloco de endereços. Quem abre a `/estado` vê hoje oito
-- linhas de «sem leitura com sucesso desde 11 de setembro» e tem de descobrir
-- sozinho o que elas têm em comum. **A informação que falta à página está na
-- base e é o `adapter`.**
--
-- **O que se concede, e o que continua fechado.** O `adapter` é o nome do
-- leitor — `joomla-eventbooking`, `portal-freguesia`, `generic-html` —, e
-- qualquer pessoa o infere abrindo o sítio da câmara; a `/fontes` já publica o
-- endereço de todas. O `config` é outra coisa: leva seletores, exclusões,
-- chaves de caminho, e continua na lista de proibidas da 0049. A distinção é a
-- que interessa escrever: **o nome do leitor é público, a configuração dele
-- nunca.**
--
-- A 0128 conta as colunas públicas das fontes e falha se forem outras que não
-- onze. Passam a ser doze, e a asserção volta a contar — é ela que impede que
-- uma concessão nova entre de passagem, e por isso é reescrita aqui em vez de
-- ser relaxada.

grant select (adapter) on public.sources to anon, authenticated;

comment on column public.sources.adapter is
  'O leitor que sabe ler esta fonte. Público desde a 0139: é o que permite à '
  '/estado dizer «sete das oito fontes caladas correm o mesmo produto» em vez '
  'de oito linhas soltas. O `config` continua privado.';

do $$
declare
  v_publicas integer;
  v_proibidas integer;
begin
  select count(*) into v_publicas
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'sources'
     and grantee = 'anon' and privilege_type = 'SELECT';
  assert v_publicas = 12,
    format('esperavam-se 12 colunas públicas nas fontes, há %s', v_publicas);

  assert has_column_privilege('anon', 'public.sources', 'adapter', 'select'),
    'o nome do leitor não ficou público';

  -- A garantia da 0049 continua de pé, e é a metade que importa: o nome do
  -- leitor é público, a configuração dele nunca.
  select count(*) into v_proibidas
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'sources'
     and grantee = 'anon' and privilege_type = 'SELECT'
     and column_name in ('config', 'notes', 'last_error', 'circuit_open_until',
                         'consecutive_failures', 'baseline_item_count', 'min_expected_items');
  assert v_proibidas = 0,
    format('a chave anónima ganhou acesso a %s colunas internas das fontes', v_proibidas);

  -- E a tabela inteira continua fechada (mesma razão da 0128: um privilégio de
  -- tabela não aparece em `column_privileges` e apagava as duas asserções de
  -- cima sem as fazer falhar).
  assert not exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'sources'
       and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
  ), 'a tabela sources voltou a ser legível por inteiro pelo público';
end $$;
