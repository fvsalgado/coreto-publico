-- 0151 — A porta de quem decide.
--
-- O relatório mensal existe e não é usado. Dar hoje o relatório à técnica de
-- cultura da CIM é dar-lhe a fila de moderação, o registo de auditoria, a
-- edição de regiões e as licenças comerciais — logo ninguém lho dá, e o dono
-- do produto exporta o CSV à mão até se fartar.
--
-- Isto é a porta: um segredo por região que abre o **balanço** dessa região,
-- em leitura, sem sessão de administração e sem acesso a mais nada.
--
-- ## Isto desafia uma regra escrita da casa, e é de propósito
--
-- «Uma palavra-passe, sem contas» é uma decisão explícita do projeto, e isto
-- abre uma segunda porta. O argumento está no plano e repete-se aqui porque é
-- onde vai ser lido: a regra foi escrita para a **moderação**, onde há um
-- operador só. Este utilizador é outro — não modera, não escreve, e o que vê
-- já é do território dele. Um segredo de leitura por região é muito mais
-- barato do que contas com papéis, que o plano põe fora de âmbito.
--
-- O risco é um endereço com segredo circular por email. Mitiga-se com prazo e
-- rotação — as duas nesta tabela — e com o conteúdo: agregados, sem dados
-- pessoais de ninguém.
--
-- ## O segredo em claro nunca entra aqui
--
-- A tabela guarda **o sha256 e mais nada**. O segredo é gerado em Node, dito
-- uma vez a quem o pediu, e nunca existe do lado da base: não está numa
-- coluna, não passa por parâmetro de função, não pode aparecer num plano de
-- consulta, num `raise notice` ou no registo de consultas lentas. Um segredo
-- de 32 bytes aleatórios não precisa de `scrypt` — a força bruta contra ele
-- não é viável e o custo de derivação só atrasaria quem tem o direito de
-- entrar.
--
-- A comparação é feita pela base, sobre o hash, com um índice único: é a
-- própria procura que a faz, e não há caminho em que um hash parcial revele
-- alguma coisa.
--
-- ## Rodar invalida o anterior, e fica escrito
--
-- `criar_token_de_balanco` revoga o que estava ativo para aquela região antes
-- de escrever o novo. Não há dois tokens vivos para a mesma região, e o
-- anterior deixa de servir **no pedido seguinte** — não no fim de um prazo.
-- A criação e a revogação ficam em `admin_actions`, com o id do token e nunca
-- com o token.

create table public.region_report_tokens (
  id           uuid primary key default gen_random_uuid(),
  region_id    text not null references public.regions(id) on delete cascade,
  -- 64 caracteres hexadecimais. Único: dois segredos com o mesmo hash seriam
  -- o mesmo segredo, e a restrição diz isso em vez de o deixar acontecer.
  token_sha256 text not null unique
    constraint region_report_tokens_sha256_bem_formado check (token_sha256 ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now(),
  created_by   text not null,
  -- Um prazo é obrigatório. Um segredo sem fim é um segredo que circula por
  -- email durante anos e que ninguém se lembra de rodar.
  expires_on   date not null,
  revoked_at   timestamptz,
  -- O dia — e não o instante — em que foi usado pela última vez. O dia chega
  -- para saber se ainda serve a alguém, e o instante seria um rasto de
  -- utilização de uma pessoa identificável pela região.
  last_used_on date,
  constraint region_report_tokens_prazo_no_futuro
    check (expires_on > created_at::date)
);

comment on table public.region_report_tokens is
  'Um segredo de leitura por região, que abre o balanço dessa região sem '
  'sessão de administração. Guarda o sha256 e mais nada: o segredo em claro é '
  'gerado fora da base, dito uma vez, e nunca entra aqui. Prazo obrigatório, '
  'rotação que revoga o anterior no pedido seguinte, e criação e revogação '
  'escritas em admin_actions.';

comment on column public.region_report_tokens.last_used_on is
  'O dia da última utilização, não o instante: chega para saber se ainda '
  'serve a alguém, e não deixa rasto da hora a que uma pessoa identificável '
  'pela região abriu o relatório.';

create index region_report_tokens_regiao_idx
  on public.region_report_tokens (region_id) where revoked_at is null;

alter table public.region_report_tokens enable row level security;
revoke all on table public.region_report_tokens from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Criar e rodar
-- ---------------------------------------------------------------------------

create function public.criar_token_de_balanco(
  p_region text,
  p_actor  text,
  p_sha256 text,
  p_dias   integer default 180
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid;
  v_revogados integer;
begin
  if not exists (select 1 from public.regions where id = p_region) then
    raise exception 'não há região com o identificador %', coalesce(p_region, 'null');
  end if;
  if p_dias < 1 then
    raise exception 'o prazo tem de ser de pelo menos um dia';
  end if;

  -- Rodar é revogar. Não há dois tokens vivos para a mesma região: um segredo
  -- antigo que continuasse a servir depois de se ter dado um novo era a
  -- rotação a não rodar nada.
  update public.region_report_tokens
     set revoked_at = now()
   where region_id = p_region and revoked_at is null;
  get diagnostics v_revogados = row_count;

  insert into public.region_report_tokens (region_id, token_sha256, created_by, expires_on)
  values (p_region, p_sha256, p_actor, (now() + make_interval(days => p_dias))::date)
  returning id into v_id;

  -- O `after` leva o id e o prazo, e **nunca** o segredo nem o hash: quem lê
  -- a auditoria não precisa de nenhum dos dois para saber o que aconteceu, e
  -- o hash num registo que se exporta é uma cópia do segredo à espera de uma
  -- tabela arco-íris que nunca vai existir mas que não custa nada evitar.
  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after)
  values (p_actor, 'token_de_balanco_criado', 'region', p_region,
          jsonb_build_object('revogados', v_revogados),
          jsonb_build_object('token_id', v_id, 'dias', p_dias));

  return v_id;
end;
$$;

comment on function public.criar_token_de_balanco(text, text, text, integer) is
  'Cria o segredo de leitura de uma região e revoga o que lá estava. Recebe o '
  'sha256 e nunca o segredo: quem o gera é quem o vai dizer. Devolve o id, '
  'para a auditoria — nunca o segredo, que já não existe deste lado.';

create function public.revogar_tokens_de_balanco(p_region text, p_actor text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.region_report_tokens
     set revoked_at = now()
   where region_id = p_region and revoked_at is null;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    insert into public.admin_actions (actor, action, entity_type, entity_id, before, after)
    values (p_actor, 'tokens_de_balanco_revogados', 'region', p_region,
            jsonb_build_object('ativos', v_n), jsonb_build_object('ativos', 0));
  end if;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Abrir
-- ---------------------------------------------------------------------------

create function public.regiao_do_token_de_balanco(p_sha256 text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_region text;
begin
  -- Um hash malformado não é procurado: é recusado. Sem isto, um parâmetro
  -- estranho passeava-se pelo índice e pelo registo de consultas.
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  -- A procura e o carimbo numa instrução só. Duas instruções deixavam uma
  -- janela em que o token era aceite e não ficava marcado como usado.
  update public.region_report_tokens
     set last_used_on = current_date
   where token_sha256 = p_sha256
     and revoked_at is null
     and expires_on >= current_date
  returning region_id into v_region;

  return v_region;
end;
$$;

comment on function public.regiao_do_token_de_balanco(text) is
  'A região que este segredo abre, ou nulo. Nulo para um segredo que não '
  'existe, para um revogado e para um fora de prazo — os três são a mesma '
  'resposta de propósito: distingui-los dizia a quem tenta se acertou no '
  'segredo de alguém.';

revoke execute on function public.criar_token_de_balanco(text, text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.revogar_tokens_de_balanco(text, text)
  from public, anon, authenticated;
revoke execute on function public.regiao_do_token_de_balanco(text)
  from public, anon, authenticated;
grant execute on function public.criar_token_de_balanco(text, text, text, integer) to service_role;
grant execute on function public.revogar_tokens_de_balanco(text, text) to service_role;
grant execute on function public.regiao_do_token_de_balanco(text) to service_role;

-- ---------------------------------------------------------------------------
-- As provas
-- ---------------------------------------------------------------------------
do $$
declare
  v_a      text := repeat('a', 64);
  v_b      text := repeat('b', 64);
  v_c      text := repeat('c', 64);
  v_id     uuid;
  v_id2    uuid;
  v_antes  bigint;
begin
  select count(*) into v_antes from public.admin_actions;

  -- Com o segredo certo, a região certa.
  v_id := public.criar_token_de_balanco('medio-tejo', 'prova-0151', v_a, 30);
  if public.regiao_do_token_de_balanco(v_a) <> 'medio-tejo' then
    raise exception 'o segredo do Médio Tejo não abriu o Médio Tejo';
  end if;

  -- Um segredo que não existe não abre nada, e não diz que não existe.
  if public.regiao_do_token_de_balanco(v_c) is not null then
    raise exception 'um segredo que nunca foi criado abriu alguma coisa';
  end if;

  -- Malformado também não, e nem sequer é procurado.
  if public.regiao_do_token_de_balanco('nao-e-um-hash') is not null then
    raise exception 'um segredo malformado abriu alguma coisa';
  end if;
  if public.regiao_do_token_de_balanco(null) is not null then
    raise exception 'um segredo nulo abriu alguma coisa';
  end if;

  -- Rodar invalida o anterior **no pedido seguinte**.
  v_id2 := public.criar_token_de_balanco('medio-tejo', 'prova-0151', v_b, 30);
  if public.regiao_do_token_de_balanco(v_a) is not null then
    raise exception 'o segredo anterior continuou a servir depois da rotação';
  end if;
  if public.regiao_do_token_de_balanco(v_b) <> 'medio-tejo' then
    raise exception 'o segredo novo não abriu a região';
  end if;
  if v_id = v_id2 then
    raise exception 'a rotação devolveu o mesmo id';
  end if;

  -- Só há um vivo por região.
  if (select count(*) from public.region_report_tokens
       where region_id = 'medio-tejo' and revoked_at is null) <> 1 then
    raise exception 'ficou mais do que um segredo vivo para a mesma região';
  end if;

  -- O uso fica carimbado ao dia.
  if (select last_used_on from public.region_report_tokens where id = v_id2)
     <> current_date then
    raise exception 'o segredo foi usado e não ficou carimbado';
  end if;

  -- Um segredo fora de prazo não abre.
  --
  -- A criação vai para trás junto com o prazo, e **não é comodidade**: a
  -- restrição `region_report_tokens_prazo_no_futuro` recusa um prazo anterior
  -- à criação, e recusou esta prova na primeira tentativa. O que se escreve
  -- aqui é o que existe de verdade — um segredo criado há dez dias com uma
  -- semana de prazo, que caducou ontem. A restrição também garante que
  -- ninguém caduca um segredo vivo com um `update` distraído: para o fechar
  -- há a revogação, que é logo a seguir.
  update public.region_report_tokens
     set created_at = now() - interval '10 days',
         expires_on = current_date - 1
   where id = v_id2;
  if public.regiao_do_token_de_balanco(v_b) is not null then
    raise exception 'um segredo fora de prazo abriu a região';
  end if;

  -- A revogação em massa conta o que revogou.
  update public.region_report_tokens
     set created_at = now(), expires_on = current_date + 30 where id = v_id2;
  if public.revogar_tokens_de_balanco('medio-tejo', 'prova-0151') <> 1 then
    raise exception 'a revogação não contou o segredo que revogou';
  end if;
  if public.regiao_do_token_de_balanco(v_b) is not null then
    raise exception 'um segredo revogado continuou a abrir';
  end if;

  -- Uma região que não existe recusa-se, em vez de criar um segredo órfão.
  begin
    perform public.criar_token_de_balanco('regiao-que-nao-existe', 'prova-0151', v_c, 30);
    raise exception 'criou-se um segredo para uma região que não existe';
  exception when raise_exception then
    if position('não há região' in sqlerrm) = 0 then raise; end if;
  end;

  -- A auditoria registou tudo, e **não tem o segredo nem o hash lá dentro**.
  if (select count(*) from public.admin_actions) <= v_antes then
    raise exception 'a criação e a revogação não deixaram rasto na auditoria';
  end if;
  if exists (
    select 1 from public.admin_actions
     where action like '%token_de_balanco%'
       and (before::text like '%' || v_a || '%' or after::text like '%' || v_a || '%'
         or before::text like '%' || v_b || '%' or after::text like '%' || v_b || '%')
  ) then
    raise exception 'o hash de um segredo apareceu no registo de auditoria';
  end if;

  -- A prova não deixa nada atrás de si.
  delete from public.region_report_tokens where created_by = 'prova-0151';
  delete from public.admin_actions where actor = 'prova-0151';
end
$$;
