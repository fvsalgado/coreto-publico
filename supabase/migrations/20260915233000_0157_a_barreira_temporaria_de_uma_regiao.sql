-- 0157 — A barreira temporária de uma região.
--
-- Uma região podia estar em dois estados: ligada e à vista de toda a gente, ou
-- desligada e invisível (`regions.is_enabled`, 0121). Falta o terceiro, e é o
-- que uma região por licenciar precisa: **de pé, a funcionar, e só para quem
-- tem a senha**.
--
-- O caso concreto que a pediu: o `mediotejo.coreto.org` está pronto e ainda não
-- está contratado. Desligá-lo não serve — não há o que mostrar a um comprador;
-- deixá-lo aberto também não — é o trabalho de uma CIM à vista de quem passa,
-- antes de ela ter dito que sim.
--
-- ---------------------------------------------------------------------------
-- Onde vive o quê, e porquê
-- ---------------------------------------------------------------------------
--
-- **O interruptor é público. O segredo não é.**
--
-- `regions.gate_enabled` fica na tabela das regiões, que tem `grant select` ao
-- `anon` desde a 0128. E fica bem: que uma região tem barreira não é segredo
-- nenhum — a própria página de entrada o anuncia a quem lá bate. O que o
-- middleware precisa de saber para decidir é isto, e só isto.
--
-- A senha vive noutro sítio, com a porta trancada: `region_gates`, com a RLS
-- ligada e as concessões revogadas ao `public`, ao `anon` e ao `authenticated`,
-- como a `region_report_tokens` da 0151. **Guarda o sha256 e mais nada.** Um
-- `gate_password_hash` acrescentado à `regions` teria sido a forma óbvia de
-- fazer isto — e teria posto o hash de todas as senhas no primeiro `select`
-- que qualquer visitante faz à tabela das regiões.
--
-- ---------------------------------------------------------------------------
-- O que esta barreira não é
-- ---------------------------------------------------------------------------
--
-- Não é autenticação. É uma senha partilhada, dita ao telefone ou num email,
-- igual para toda a gente que a receba, sem contas e sem nomes. Serve para o
-- que foi pedida: **tapar uma região a quem passa, enquanto ela não está
-- contratada.** Quem a quiser usar para guardar dados pessoais está a usar a
-- ferramenta errada — e a fila de moderação, essa, continua onde sempre
-- esteve, atrás da sessão do painel.
--
-- E cobre **as páginas**, por decisão de quem a pediu: os feeds, a API e o
-- widget continuam a responder. É a forma mais simples, para uma coisa
-- temporária, e o painel di-lo à letra a quem liga a barreira — para não ser
-- surpresa no dia em que alguém encontrar o `feed.xml`.

-- ---------------------------------------------------------------------------
-- Esta migração corre ANTES do deploy que a acompanha
-- ---------------------------------------------------------------------------
--
-- O código passa a pedir `gate_enabled` na leitura das regiões
-- (`COLUNAS_DA_REGIAO`), e uma coluna que não existe não dá `null` — dá
-- `column … does not exist` e leva a agenda inteira com ela. Já aconteceu, com
-- a 0128 e a 0129: dois builds de produção falharam e o sítio serviu a vaga
-- anterior durante mais de uma hora sem um único sinal. A guarda que ficou
-- desse dia é o `scripts/migracoes-por-aplicar.sh`, que reprova quando o
-- repositório vai à frente da base — e o remédio é a ordem de sempre: aplicar
-- as migrações primeiro, deployar depois (`docs/INFRAESTRUTURA.md`).

-- ---------------------------------------------------------------------------
-- O interruptor
-- ---------------------------------------------------------------------------

alter table public.regions
  add column if not exists gate_enabled boolean not null default false;

comment on column public.regions.gate_enabled is
  'Se esta região está atrás de uma barreira de senha. Público de propósito: '
  'o middleware decide com isto, e a página de entrada anuncia-o na mesma a '
  'quem lá bate. A senha não está aqui — está em region_gates, sem concessões '
  'ao anon.';

-- ---------------------------------------------------------------------------
-- O segredo
-- ---------------------------------------------------------------------------

create table if not exists public.region_gates (
  region_id      text primary key references public.regions(id) on delete cascade,
  -- O sha256 da senha, em hexadecimal minúsculo. A senha em claro é escolhida
  -- por quem administra, dita uma vez, e nunca entra aqui.
  password_sha256 text not null check (password_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at     timestamptz not null default now(),
  updated_by     text
);

comment on table public.region_gates is
  'A senha da barreira de cada região, em sha256 e mais nada. Uma linha por '
  'região, substituída quando se troca a senha. Sem concessões ao público: '
  'quem a lê é o servidor, com a chave de serviço, para comparar.';

alter table public.region_gates enable row level security;
revoke all on table public.region_gates from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Definir, trocar e levantar
-- ---------------------------------------------------------------------------

create or replace function public.definir_barreira_da_regiao(
  p_region  text,
  p_actor   text,
  p_ligada  boolean,
  p_sha256  text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tinha_senha boolean;
  v_antes       boolean;
begin
  select gate_enabled into v_antes from public.regions where id = p_region;
  if not found then
    raise exception 'não há região com o identificador %', coalesce(p_region, 'null');
  end if;

  if p_sha256 is not null then
    insert into public.region_gates (region_id, password_sha256, updated_by)
    values (p_region, p_sha256, p_actor)
    on conflict (region_id) do update
      set password_sha256 = excluded.password_sha256,
          updated_at      = now(),
          updated_by      = excluded.updated_by;
  end if;

  select exists (select 1 from public.region_gates where region_id = p_region)
    into v_tinha_senha;

  -- Ligar uma barreira sem senha trancava a região sem deixar ninguém entrar,
  -- incluindo quem a ligou. Recusa-se aqui e não no formulário: a regra é da
  -- base, e um dia há de haver outro caminho até esta função.
  if p_ligada and not v_tinha_senha then
    raise exception 'não se liga a barreira de % sem senha definida', p_region;
  end if;

  update public.regions set gate_enabled = p_ligada where id = p_region;

  -- Nem a senha nem o hash entram na auditoria. Quem a lê não precisa de
  -- nenhum dos dois para saber o que aconteceu, e um hash num registo que se
  -- exporta é uma cópia do segredo à espera de quem tenha tempo.
  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after)
  values (p_actor, 'barreira_da_regiao', 'region', p_region,
          jsonb_build_object('ligada', v_antes),
          jsonb_build_object('ligada', p_ligada, 'senha_trocada', p_sha256 is not null));

  return v_antes is distinct from p_ligada or p_sha256 is not null;
end;
$$;

comment on function public.definir_barreira_da_regiao(text, text, boolean, text) is
  'Liga, desliga ou troca a senha da barreira de uma região. Recebe o sha256 e '
  'nunca a senha. Recusa ligar uma barreira sem senha definida — isso trancava '
  'a região sem deixar entrar ninguém, incluindo quem a ligou. Desligar não '
  'apaga a senha: a região volta a fechar-se com a mesma no dia seguinte.';

revoke execute on function public.definir_barreira_da_regiao(text, text, boolean, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- As asserções
-- ---------------------------------------------------------------------------

do $$
declare
  n integer;
begin
  select count(*) into n
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'region_gates'
     and grantee in ('anon', 'authenticated');
  assert n = 0, format('a tabela das senhas está ao alcance do público: %s concessões', n);

  select count(*) into n
    from information_schema.columns
   where table_schema = 'public' and table_name = 'regions' and column_name = 'gate_enabled';
  assert n = 1, 'a coluna regions.gate_enabled não ficou criada';

  select count(*) into n
    from pg_policies
   where schemaname = 'public' and tablename = 'region_gates';
  assert n = 0, format('a region_gates ganhou %s policy(s) — com a RLS ligada e sem policies, nega tudo', n);

  -- Ninguém nasce com barreira. Uma migração que a ligasse sozinha tirava do
  -- ar uma região que está no ar.
  select count(*) into n from public.regions where gate_enabled;
  assert n = 0, format('%s região(ões) ficaram com a barreira ligada por esta migração', n);
end
$$;
