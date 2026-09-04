-- 0020 — Anotar a intenção do cadeado, e calar dois avisos legítimos.
--
-- O analisador do Supabase assinala onze tabelas com «RLS ligado, sem policy».
-- Não é um defeito: nestas tabelas a ausência de policy É a policy. RLS ligado
-- sem nenhuma regra significa que ninguém lê nem escreve, exceto a chave de
-- serviço — e é exatamente isso que se pretende para a fila de moderação, para
-- os endereços de quem submete e para o registo de auditoria.
--
-- O analisador não distingue «esqueceram-se da policy» de «a ausência de
-- policy é a decisão». Quem fizer a próxima auditoria também não vai
-- distinguir, a menos que esteja escrito na própria tabela. Fica escrito.

comment on table public.submissions is
  'RLS ligado e SEM policy, de propósito: só a chave de serviço lê esta fila. '
  'Contém endereços de email de quem submete programação.';

comment on table public.submission_attachments is
  'RLS ligado e SEM policy, de propósito. Anexos por moderar; os ficheiros '
  'vivem no balde privado `intake` e só são vistos por endereço assinado.';

comment on table public.admin_actions is
  'RLS ligado e SEM policy, de propósito: o registo de auditoria não é público '
  'e não é alterável por ninguém a partir da API.';

comment on table public.sources is
  'RLS ligado e SEM policy, de propósito. A configuração da recolha (endereços, '
  'seletores, estado do disjuntor) não é informação pública.';

comment on table public.source_runs is
  'RLS ligado e SEM policy, de propósito: o histórico de execuções é '
  'diagnóstico interno.';

comment on table public.sender_quotas is
  'RLS ligado e SEM policy, de propósito. Indexada por endereço de email.';

comment on table public.rate_limits is
  'RLS ligado e SEM policy, de propósito. Contém hashes de endereços IP.';

comment on table public.manual_overrides is
  'RLS ligado e SEM policy, de propósito: que campos uma pessoa corrigiu é '
  'informação de moderação.';

comment on table public.venue_aliases is
  'RLS ligado e SEM policy, de propósito. Tabela de resolução usada pela '
  'recolha; não acrescenta nada a quem visita.';

comment on table public.category_aliases is
  'RLS ligado e SEM policy, de propósito. Ver `venue_aliases`.';

comment on table public.unknown_tags is
  'RLS ligado e SEM policy, de propósito: fila de trabalho da taxonomia.';

-- ---------------------------------------------------------------------------
-- A única `security definer` que escapou ao `revoke` geral da 0007.
--
-- É uma função de trigger: chamada diretamente rebenta com «trigger functions
-- can only be called as triggers», e por isso não é explorável. Mas ficar de
-- fora do padrão obriga quem audita a ir verificar porquê — e um aviso que se
-- explica todas as vezes acaba por ser um aviso que se ignora todas as vezes.
-- ---------------------------------------------------------------------------
revoke execute on function public.event_sessions_sync_dates() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Chaves estrangeiras sem índice.
--
-- Só as que crescem com o catálogo. As outras que o analisador aponta estão em
-- tabelas de dezenas de linhas, onde o Postgres percorre a tabela toda mais
-- depressa do que consulta um índice — indexá-las era acrescentar escrita para
-- não poupar leitura nenhuma.
-- ---------------------------------------------------------------------------

-- Cresce com o catálogo: uma sessão por ocorrência, e as itinerâncias da rede
-- CAMINHOS/VOLver mudam de espaço a meio.
create index if not exists event_sessions_venue_idx
  on public.event_sessions (venue_id)
  where venue_id is not null;

-- O backoffice filtra a fila por concelho assim que houver fila que chegue
-- para isso justificar um filtro.
create index if not exists submissions_municipality_idx
  on public.submissions (municipality_id)
  where municipality_id is not null;

create index if not exists submissions_resulting_event_idx
  on public.submissions (resulting_event_id)
  where resulting_event_id is not null;
