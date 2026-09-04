-- 0018 — As travas de custo do canal de email, do lado da base de dados.
--
-- A tabela `sender_quotas` existe desde a 0005. Faltavam as duas operações
-- que a tornam utilizável sem corridas: ler o estado numa só ida e somar o
-- consumo de forma atómica.
--
-- Porquê funções e não `select`/`upsert` do lado da aplicação:
--
-- 1. **A viragem do dia.** Os contadores são diários e a linha é uma só por
--    remetente. Reiniciar em JavaScript é ler, comparar o dia, escrever — e
--    dois emails do mesmo remetente ao mesmo tempo perdem uma das contas.
--    Aqui a comparação acontece dentro do `on conflict do update`.
-- 2. **O orçamento do dia.** É uma soma sobre a tabela inteira. Trazer as
--    linhas todas para as somar em memória é uma soma que passa a estar
--    errada no dia em que houver mais remetentes do que a página de leitura
--    da API devolve.
--
-- O dia é decidido por quem chama, e é sempre o dia de Lisboa. A base de
-- dados corre em UTC; `current_date` daria o dia errado durante a primeira
-- hora de cada noite de verão.

-- O orçamento diário lê-se somando a coluna por dia.
create index if not exists sender_quotas_day_idx on public.sender_quotas (day);

-- ---------------------------------------------------------------------------
-- Estado da quota: o remetente e a casa, numa só ida
-- ---------------------------------------------------------------------------
--
-- Os nomes das colunas de saída são diferentes dos das colunas da tabela
-- (`blocked` e não `is_blocked`, `block_note` e não `block_reason`) para não
-- haver nenhuma referência ambígua dentro do corpo da função.
create or replace function public.extraction_quota_state(
  p_sender text,
  p_day date
)
returns table (
  blocked boolean,
  block_note text,
  sender_extractions integer,
  sender_cost_micros bigint,
  day_cost_micros bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(q.is_blocked, false),
    q.block_reason,
    -- Uma linha de ontem conta como zero: os contadores são do dia corrente,
    -- e um remetente não começa o dia com a quota de ontem esgotada.
    coalesce(case when q.day = p_day then q.extractions end, 0)::integer,
    coalesce(case when q.day = p_day then q.cost_micros end, 0)::bigint,
    coalesce(
      (select sum(s.cost_micros) from public.sender_quotas s where s.day = p_day),
      0
    )::bigint
  from (values (1)) as anchor(one)
  left join public.sender_quotas q on q.sender_email = p_sender;
$$;

comment on function public.extraction_quota_state(text, date) is
  'Estado da quota de extração de um remetente no dia indicado (dia de Lisboa), '
  'mais o gasto total da casa nesse dia.';

-- ---------------------------------------------------------------------------
-- Registo do consumo
-- ---------------------------------------------------------------------------
create or replace function public.sender_quota_record(
  p_sender text,
  p_day date,
  p_submissions integer default 0,
  p_extractions integer default 0,
  p_cost_micros bigint default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sender_quotas as q
    (sender_email, day, submissions, extractions, cost_micros, updated_at)
  values (p_sender, p_day, p_submissions, p_extractions, p_cost_micros, now())
  on conflict (sender_email) do update set
    day = p_day,
    -- As expressões veem a linha antiga: `q.day` é o dia que lá estava. Dia
    -- diferente ⇒ os contadores recomeçam do zero com o que agora se soma.
    submissions = case when q.day = p_day then q.submissions else 0 end + p_submissions,
    extractions = case when q.day = p_day then q.extractions else 0 end + p_extractions,
    cost_micros = case when q.day = p_day then q.cost_micros else 0 end + p_cost_micros,
    updated_at = now();
end;
$$;

comment on function public.sender_quota_record(text, date, integer, integer, bigint) is
  'Soma o consumo de um remetente no dia indicado, reiniciando os contadores '
  'quando o dia mudou. O bloqueio (`is_blocked`) não é tocado: é uma decisão '
  'humana e só se desfaz à mão.';

-- ---------------------------------------------------------------------------
-- Nada de `security definer` exposto ao público (mesma regra da 0007)
-- ---------------------------------------------------------------------------
revoke execute on function public.extraction_quota_state(text, date)
  from public, anon, authenticated;
revoke execute on function public.sender_quota_record(text, date, integer, integer, bigint)
  from public, anon, authenticated;

grant execute on function public.extraction_quota_state(text, date) to service_role;
grant execute on function public.sender_quota_record(text, date, integer, integer, bigint)
  to service_role;
