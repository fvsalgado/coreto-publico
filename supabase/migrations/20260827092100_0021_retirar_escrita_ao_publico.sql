-- 0021 — Retirar ao público as permissões de escrita que o Supabase concede
-- por omissão.
--
-- Por omissão, o Supabase concede `insert`, `update` e `delete` aos papéis
-- `anon` e `authenticated` em todas as tabelas de `public`. Hoje isso não faz
-- mal nenhum: a RLS bloqueia tudo, e a sondagem feita ao projeto confirmou-o
-- tabela a tabela.
--
-- Mas depende de uma coisa só. Basta alguém acrescentar um dia uma policy
-- permissiva de mais — ou um `for all` onde queria `for select` — para a
-- permissão que estava lá desde o início passar a ser explorável. Retirar a
-- concessão faz com que sejam precisos DOIS enganos em vez de um.
--
-- No Coreto nada é escrito pelo público, em circunstância nenhuma: as três
-- vias de entrada (recolha, email, formulário) passam todas pelo servidor com
-- a chave de serviço, que ignora tanto a RLS como estas concessões. Não há
-- nada a perder.

revoke insert, update, delete, truncate on all tables in schema public
  from anon, authenticated;

-- E o mesmo para as tabelas que vierem a existir, para isto não ter de ser
-- lembrado em cada migração nova.
alter default privileges in schema public
  revoke insert, update, delete, truncate on tables from anon, authenticated;

-- A leitura fica como está: é a RLS que decide o que é visível, e é ela que
-- deve continuar a decidir. Retirar o `select` aqui tornaria as policies
-- inúteis e esconderia a intenção.
