-- 0170 — Uma conta por pessoa, e um papel por região.
--
-- O painel tinha uma palavra-passe e um papel: quem a sabia via tudo e mexia
-- em tudo, de todas as regiões, e a auditoria escrevia «gestor» em todas as
-- linhas (C4-015). Enquanto houve uma pessoa a operar, era honesto e barato —
-- o `docs/plano/07-painel.md` deixou-o escrito, com a condição de entrada: «no
-- dia em que houver uma segunda organização com técnicos próprios, isto passa
-- à frente de tudo». Esse dia é o da primeira CIM com moderação própria: dar o
-- painel à técnica de cultura de uma CIM era dar-lhe os emails em bruto de
-- terceiros das outras regiões, as licenças de todas, e o interruptor que tira
-- outra região do ar.
--
-- O desenho é comum aos dois painéis da casa (o do Paragem.pt é este,
-- levantado e reduzido), e está decidido:
--
--   * cada pessoa entra com o seu email e a sua palavra-passe (scrypt, como a
--     do dono — o hash faz-se no servidor e só ele chega aqui);
--   * vê e mexe só nas regiões onde tem um papel: «gestor» (as definições da
--     região e tudo o que o editor faz) ou «editor» (a fila, os eventos, os
--     espaços e as etiquetas da região);
--   * **o dono não está aqui.** A senha que já está no ambiente
--     (`ADMIN_PASSWORD_HASH`) continua a ser a dele, com acesso a tudo — é o
--     que garante que ninguém fica trancado fora no dia em que isto chega a
--     produção: sem uma linha nestas tabelas, entra quem entrava;
--   * a auditoria passa a dizer **quem**, com nome e email.
--
-- ---------------------------------------------------------------------------
-- Os nomes
-- ---------------------------------------------------------------------------
--
-- As três tabelas e as colunas chamam-se em português, contra a regra do
-- `CONTRIBUTING.md` («identificadores em inglês»). É deliberado e tem uma
-- razão só: são as mesmas tabelas, com as mesmas colunas e as mesmas funções,
-- nos dois produtos — o desenho foi escrito uma vez para os dois, e duas
-- grafias da mesma coisa em dois repositórios eram duas documentações a
-- divergir. As colunas mais recentes desta base (`pausada_ate`,
-- `region_highlights.posicao`, `cartaz_alojavel`) já tinham aberto o caminho.
--
-- ---------------------------------------------------------------------------
-- Esta migração é segura para o sítio de hoje
-- ---------------------------------------------------------------------------
--
-- É toda aditiva: três tabelas novas e funções novas, nenhuma coluna mexida,
-- nenhuma função existente alterada. O sítio publicado hoje não sabe que elas
-- existem e não as pede. E o sítio novo funciona **antes** de ela chegar a
-- produção: sem as tabelas, a entrada não encontra pessoa nenhuma e cai na
-- senha do dono, que é exatamente o painel de hoje (`apps/web/src/lib/admin/
-- pessoas.ts` trata a tabela em falta como «não há pessoas»).

-- ---------------------------------------------------------------------------
-- As pessoas
-- ---------------------------------------------------------------------------

create table if not exists public.admin_pessoas (
  id            uuid primary key default gen_random_uuid(),
  -- Em minúsculas, e é a base que o garante: «Ana@CIM.pt» e «ana@cim.pt» são a
  -- mesma pessoa, e um índice único sobre o texto tal como veio deixava entrar
  -- as duas.
  email         text not null unique
                check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  nome          text not null check (length(btrim(nome)) between 1 and 120),
  -- Nula até à ativação: a pessoa escolhe a sua, pela ligação de convite. O
  -- dono nunca sabe a palavra-passe de ninguém.
  senha_hash    text check (senha_hash is null or senha_hash ~ '^scrypt\$[0-9]+\$[0-9]+\$[0-9]+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$'),
  ativada_em    timestamptz,
  desativada_em timestamptz,
  criada_em     timestamptz not null default now(),
  criada_por    text not null,
  ultimo_acesso timestamptz
);

comment on table public.admin_pessoas is
  'As pessoas que entram no painel, uma por email. O dono do produto não está '
  'aqui: entra com a senha do ambiente (ADMIN_PASSWORD_HASH) e vê tudo. RLS '
  'ligada e nenhuma policy — a ausência de policy é a política: só a chave de '
  'serviço lê e escreve, e só pelas funções admin_* desta migração.';
comment on column public.admin_pessoas.senha_hash is
  'scrypt$N$r$p$sal$hash, feito no servidor. Nula até a pessoa ativar a conta '
  'pela ligação de convite. Trocá-la invalida as sessões abertas dessa pessoa.';
comment on column public.admin_pessoas.desativada_em is
  'Desativada não entra, e as sessões abertas caem no pedido seguinte — o '
  'painel relê a pessoa da base em cada pedido. Não se apaga ninguém: a '
  'auditoria aponta para estas linhas.';

-- ---------------------------------------------------------------------------
-- Os papéis
-- ---------------------------------------------------------------------------

create table if not exists public.admin_papeis (
  pessoa_id     uuid not null references public.admin_pessoas(id) on delete cascade,
  region_id     text not null references public.regions(id) on delete cascade,
  -- Dois, e só dois. Domínios, alias, licenças, barreira, criar regiões e
  -- gerir pessoas não são papéis de ninguém: são do dono, que é quem responde
  -- pela instalação e pelos contratos.
  papel         text not null check (papel in ('gestor', 'editor')),
  atribuido_em  timestamptz not null default now(),
  atribuido_por text not null,
  primary key (pessoa_id, region_id)
);

create index if not exists admin_papeis_regiao_idx on public.admin_papeis (region_id);

comment on table public.admin_papeis is
  'Um papel por pessoa e por região: gestor (as definições da região e tudo o '
  'que o editor faz) ou editor (a fila, os eventos, os espaços e as etiquetas '
  'da região). Sem linha, a pessoa não vê nada dessa região.';

-- ---------------------------------------------------------------------------
-- Os convites
-- ---------------------------------------------------------------------------

create table if not exists public.admin_convites (
  -- O sha256 do token, em hexadecimal. O token em claro é gerado no servidor,
  -- mostrado UMA vez ao dono para ele o enviar pelos seus meios, e nunca se
  -- guarda — como os segredos do balanço (0151).
  token_sha256  text primary key check (token_sha256 ~ '^[0-9a-f]{64}$'),
  pessoa_id     uuid not null references public.admin_pessoas(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  criado_por    text not null,
  expira_em     timestamptz not null default now() + interval '7 days',
  usado_em      timestamptz,
  -- Uma ligação nova anula as que estavam por usar: a pessoa que pediu outra
  -- porque perdeu a primeira não pode deixar a primeira a valer por aí.
  anulado_em    timestamptz
);

create index if not exists admin_convites_pessoa_idx on public.admin_convites (pessoa_id);

comment on table public.admin_convites is
  'As ligações de ativação, uma por convite ou por «esqueci-me da palavra-passe». '
  'Guarda-se o sha256 do token e nunca o token. Valem 7 dias e uma vez; uma nova '
  'anula as que estavam por usar.';

alter table public.admin_pessoas  enable row level security;
alter table public.admin_papeis   enable row level security;
alter table public.admin_convites enable row level security;
revoke all on table public.admin_pessoas  from public, anon, authenticated;
revoke all on table public.admin_papeis   from public, anon, authenticated;
revoke all on table public.admin_convites from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- As escritas, todas por funções com rasto
-- ---------------------------------------------------------------------------
--
-- A regra dos dois produtos: nenhuma escrita toca nestas tabelas por fora.
-- Cada função escreve e deixa a linha em `admin_actions` com o antes e o
-- depois — como `set_region_enabled`, `update_region` e as outras. As
-- mensagens de recusa são em português porque chegam, tal e qual, ao aviso do
-- painel.

create or replace function public.admin_criar_pessoa(
  p_email text,
  p_nome  text,
  p_actor text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome  text := btrim(coalesce(p_nome, ''));
  v_id    uuid;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se cria pessoa nenhuma';
  end if;
  if v_nome = '' then
    raise exception 'a pessoa precisa de um nome';
  end if;
  if length(v_nome) > 120 then
    raise exception 'o nome tem mais de 120 caracteres';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception '«%» não é um endereço de email', v_email;
  end if;
  if exists (select 1 from public.admin_pessoas where email = v_email) then
    raise exception 'já há uma pessoa com o email %', v_email;
  end if;

  insert into public.admin_pessoas (email, nome, criada_por)
  values (v_email, v_nome, p_actor)
  returning id into v_id;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after)
  values (p_actor, 'pessoa.criar', 'pessoa', v_id::text, null,
          jsonb_build_object('nome', v_nome, 'email', v_email));

  return v_id;
end;
$$;

comment on function public.admin_criar_pessoa(text, text, text) is
  'Cria uma pessoa do painel, ainda sem palavra-passe e sem papéis. O email '
  'guarda-se em minúsculas e é único. Fica a linha pessoa.criar na auditoria.';

-- Definir e retirar são a mesma função: `p_papel` nulo retira. Devolve se
-- alguma coisa mudou, para o painel não dizer «papel atualizado» a um clique
-- que não mudou nada.
create or replace function public.admin_definir_papel(
  p_pessoa uuid,
  p_regiao text,
  p_papel  text,
  p_actor  text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes text;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se mexe em papel nenhum';
  end if;
  if p_papel is not null and p_papel not in ('gestor', 'editor') then
    raise exception 'o papel é «gestor» ou «editor» — «%» não é nenhum dos dois', p_papel;
  end if;
  if not exists (select 1 from public.admin_pessoas where id = p_pessoa) then
    raise exception 'não há pessoa com o identificador %', coalesce(p_pessoa::text, 'null');
  end if;
  if not exists (select 1 from public.regions where id = p_regiao) then
    raise exception 'não há região com o identificador %', coalesce(p_regiao, 'null');
  end if;

  select papel into v_antes from public.admin_papeis
   where pessoa_id = p_pessoa and region_id = p_regiao;

  if v_antes is not distinct from p_papel then
    return false;
  end if;

  if p_papel is null then
    delete from public.admin_papeis where pessoa_id = p_pessoa and region_id = p_regiao;
  else
    insert into public.admin_papeis (pessoa_id, region_id, papel, atribuido_por)
    values (p_pessoa, p_regiao, p_papel, p_actor)
    on conflict (pessoa_id, region_id) do update
      set papel = excluded.papel,
          atribuido_em = now(),
          atribuido_por = excluded.atribuido_por;
  end if;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after)
  values (p_actor, 'pessoa.papel', 'pessoa', p_pessoa::text,
          jsonb_build_object('regiao', p_regiao, 'papel', v_antes),
          jsonb_build_object('regiao', p_regiao, 'papel', p_papel));

  return true;
end;
$$;

comment on function public.admin_definir_papel(uuid, text, text, text) is
  'Dá, troca ou retira (p_papel nulo) o papel de uma pessoa numa região. '
  'Devolve false quando nada mudou. Fica a linha pessoa.papel na auditoria, com '
  'o papel de antes e o de depois.';

-- Desativar não apaga: a auditoria aponta para a pessoa, e quem saiu da
-- equipa continua a ter de aparecer como quem aprovou o que aprovou. Reativar
-- é o mesmo gesto ao contrário, e as ligações por usar morrem nos dois.
create or replace function public.admin_definir_estado_da_pessoa(
  p_pessoa uuid,
  p_ativa  boolean,
  p_actor  text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desativada timestamptz;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se mexe em pessoa nenhuma';
  end if;
  if p_ativa is null then
    raise exception 'diga se a pessoa fica ativa ou desativada';
  end if;

  select desativada_em into v_desativada from public.admin_pessoas
   where id = p_pessoa for update;
  if not found then
    raise exception 'não há pessoa com o identificador %', coalesce(p_pessoa::text, 'null');
  end if;

  if (v_desativada is null) = p_ativa then
    return false;
  end if;

  update public.admin_pessoas
     set desativada_em = case when p_ativa then null else now() end
   where id = p_pessoa;

  update public.admin_convites set anulado_em = now()
   where pessoa_id = p_pessoa and usado_em is null and anulado_em is null;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after)
  values (p_actor, case when p_ativa then 'pessoa.reativar' else 'pessoa.desativar' end,
          'pessoa', p_pessoa::text,
          jsonb_build_object('ativa', v_desativada is null),
          jsonb_build_object('ativa', p_ativa));

  return true;
end;
$$;

comment on function public.admin_definir_estado_da_pessoa(uuid, boolean, text) is
  'Desativa ou reativa uma pessoa. Desativada não entra e as sessões abertas '
  'caem no pedido seguinte; as ligações por usar são anuladas. Não apaga nada.';

create or replace function public.admin_criar_convite(
  p_pessoa       uuid,
  p_token_sha256 text,
  p_actor        text
) returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desativada timestamptz;
  v_expira     timestamptz := now() + interval '7 days';
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se cria ligação nenhuma';
  end if;
  if coalesce(p_token_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'a ligação chega aqui como sha256 em hexadecimal, e nunca em claro';
  end if;

  select desativada_em into v_desativada from public.admin_pessoas where id = p_pessoa;
  if not found then
    raise exception 'não há pessoa com o identificador %', coalesce(p_pessoa::text, 'null');
  end if;
  if v_desativada is not null then
    raise exception 'esta pessoa está desativada — reative-a antes de lhe dar uma ligação';
  end if;

  update public.admin_convites set anulado_em = now()
   where pessoa_id = p_pessoa and usado_em is null and anulado_em is null;

  insert into public.admin_convites (token_sha256, pessoa_id, criado_por, expira_em)
  values (p_token_sha256, p_pessoa, p_actor, v_expira);

  -- Nem o token nem o hash entram na auditoria: quem a lê não precisa de
  -- nenhum dos dois para saber o que aconteceu (a regra da 0157).
  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after)
  values (p_actor, 'pessoa.convite', 'pessoa', p_pessoa::text, null,
          jsonb_build_object('expira_em', v_expira));

  return v_expira;
end;
$$;

comment on function public.admin_criar_convite(uuid, text, text) is
  'Regista uma ligação de ativação (o sha256 do token, nunca o token), válida 7 '
  'dias e uma vez, e anula as que a pessoa tinha por usar. Devolve quando expira.';

-- A ativação é a única escrita que não tem um dono do painel por trás: quem
-- chama é a própria pessoa, pela ligação. O autor da linha de auditoria é ela.
-- Todas as recusas dizem a mesma frase de propósito — distinguir «não existe»
-- de «expirou» dizia a quem experimenta tokens se acertou num.
create or replace function public.admin_ativar_com_convite(
  p_token_sha256 text,
  p_senha_hash   text
) returns table (id uuid, email text, nome text)
language plpgsql
security definer
set search_path = ''
as $$
-- As colunas devolvidas chamam-se como as da tabela; sem isto, cada `id` no
-- corpo era ambíguo entre a coluna e a variável de saída.
#variable_conflict use_column
declare
  v_convite public.admin_convites%rowtype;
  v_pessoa  public.admin_pessoas%rowtype;
begin
  if coalesce(p_senha_hash, '') !~ '^scrypt\$[0-9]+\$[0-9]+\$[0-9]+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$' then
    raise exception 'a palavra-passe chega aqui já em scrypt, e nunca em claro';
  end if;

  select * into v_convite from public.admin_convites c
   where c.token_sha256 = p_token_sha256 for update;
  if not found
     or v_convite.usado_em is not null
     or v_convite.anulado_em is not null
     or v_convite.expira_em <= now() then
    raise exception 'esta ligação já não vale';
  end if;

  select * into v_pessoa from public.admin_pessoas p where p.id = v_convite.pessoa_id for update;
  if v_pessoa.desativada_em is not null then
    raise exception 'esta ligação já não vale';
  end if;

  update public.admin_pessoas p
     set senha_hash = p_senha_hash,
         ativada_em = coalesce(p.ativada_em, now())
   where p.id = v_pessoa.id;

  update public.admin_convites c set usado_em = now() where c.token_sha256 = p_token_sha256;
  update public.admin_convites c set anulado_em = now()
   where c.pessoa_id = v_pessoa.id and c.usado_em is null and c.anulado_em is null;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after)
  values (v_pessoa.nome || ' · ' || v_pessoa.email, 'pessoa.ativar', 'pessoa', v_pessoa.id::text,
          jsonb_build_object('ativada', v_pessoa.ativada_em is not null),
          jsonb_build_object('ativada', true, 'palavra_passe_nova', true));

  return query select v_pessoa.id, v_pessoa.email, v_pessoa.nome;
end;
$$;

comment on function public.admin_ativar_com_convite(text, text) is
  'Gasta uma ligação de ativação: grava a palavra-passe (em scrypt) e devolve a '
  'pessoa. Uma ligação usada, anulada, expirada ou de uma pessoa desativada '
  'recusa-se sempre com a mesma frase. A palavra-passe antiga deixa de valer.';

-- O registo de entrada vale para as pessoas e para o dono (`p_pessoa` nulo):
-- «quem entrou, e quando» é uma pergunta que a auditoria tem de saber
-- responder para os dois.
create or replace function public.admin_registar_acesso(
  p_pessoa uuid,
  p_actor  text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se regista entrada nenhuma';
  end if;

  if p_pessoa is not null then
    update public.admin_pessoas set ultimo_acesso = now() where id = p_pessoa;
  end if;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after)
  values (p_actor, 'pessoa.entrar', 'pessoa', coalesce(p_pessoa::text, 'dono'), null, null);
end;
$$;

comment on function public.admin_registar_acesso(uuid, text) is
  'Regista uma entrada no painel: o último acesso da pessoa e a linha '
  'pessoa.entrar na auditoria. p_pessoa nulo é o dono.';

-- ---------------------------------------------------------------------------
-- O limite de tentativas conta só as falhadas
-- ---------------------------------------------------------------------------
--
-- Cinco entradas em quinze minutos, **mesmo certas**, trancavam a equipa
-- inteira de uma CIM, que sai para a internet pelo mesmo endereço (C4-016). O
-- limitador da entrada passa a perguntar antes (`rate_limit_peek`, sem
-- contar), a contar só quando a palavra-passe falha (`rate_limit_hit`, a de
-- sempre), por endereço e por email, e a limpar o balde do endereço numa
-- entrada certa (`rate_limit_clear`).

create or replace function public.rate_limit_peek(
  p_bucket         text,
  p_window_seconds integer
) returns table (hits integer, reset_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
begin
  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'a janela tem de ser de pelo menos um segundo';
  end if;
  -- A mesma conta da `rate_limit_hit` (0005): a janela é fixa, e as duas
  -- funções têm de cair na mesma.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  return query
    select coalesce((select rl.hits from public.rate_limits rl
                      where rl.bucket = p_bucket and rl.window_start = v_window_start), 0),
           v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

comment on function public.rate_limit_peek(text, integer) is
  'Quantas vezes um balde já contou na janela corrente, sem contar mais esta. '
  'É o que deixa a entrada do painel contar só as tentativas falhadas.';

create or replace function public.rate_limit_clear(p_bucket text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removidas integer;
begin
  delete from public.rate_limits where bucket = p_bucket;
  get diagnostics v_removidas = row_count;
  return v_removidas;
end;
$$;

comment on function public.rate_limit_clear(text) is
  'Esquece um balde do limitador. Uma entrada certa no painel limpa o do seu '
  'endereço: quem acertou não fica a pagar os enganos de quem partilha a rede.';

-- ---------------------------------------------------------------------------
-- Só a chave de serviço chama estas funções
-- ---------------------------------------------------------------------------

revoke all on function public.admin_criar_pessoa(text, text, text) from public, anon, authenticated;
revoke all on function public.admin_definir_papel(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_definir_estado_da_pessoa(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.admin_criar_convite(uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_ativar_com_convite(text, text) from public, anon, authenticated;
revoke all on function public.admin_registar_acesso(uuid, text) from public, anon, authenticated;
revoke all on function public.rate_limit_peek(text, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_clear(text) from public, anon, authenticated;

grant execute on function public.admin_criar_pessoa(text, text, text) to service_role;
grant execute on function public.admin_definir_papel(uuid, text, text, text) to service_role;
grant execute on function public.admin_definir_estado_da_pessoa(uuid, boolean, text) to service_role;
grant execute on function public.admin_criar_convite(uuid, text, text) to service_role;
grant execute on function public.admin_ativar_com_convite(text, text) to service_role;
grant execute on function public.admin_registar_acesso(uuid, text) to service_role;
grant execute on function public.rate_limit_peek(text, integer) to service_role;
grant execute on function public.rate_limit_clear(text) to service_role;
grant select on table public.admin_pessoas, public.admin_papeis, public.admin_convites to service_role;

-- ---------------------------------------------------------------------------
-- As provas, numa transação que se desfaz
-- ---------------------------------------------------------------------------
do $$
declare
  v_regiao  text;
  v_pessoa  uuid;
  v_recusou boolean;
  v_hash    constant text := 'scrypt$32768$8$1$c2FsdG9wcm92YQ==$aGFzaHByb3Zh';
  v_token   constant text := repeat('a', 64);
  v_ativada record;
  n         integer;
begin
  -- Ninguém nasce com conta: a linha de uma pessoa entra pelo painel, nunca
  -- por uma migração que vai para o repositório público.
  select count(*) into n from public.admin_pessoas;
  assert n = 0, format('a migração deixou %s pessoa(s) semeada(s)', n);

  select count(*) into n
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('admin_pessoas', 'admin_papeis', 'admin_convites')
     and grantee in ('anon', 'authenticated');
  assert n = 0, format('as tabelas das contas estão ao alcance do público: %s concessões', n);

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('admin_pessoas', 'admin_papeis', 'admin_convites');
  assert n = 0, format('as tabelas das contas ganharam %s policy(s)', n);

  select id into v_regiao from public.regions order by sort_order limit 1;
  assert v_regiao is not null, 'sem região nenhuma para provar a 0170';

  v_pessoa := public.admin_criar_pessoa('  Prova@Exemplo.PT ', 'Pessoa de prova', 'prova-0170');
  assert (select email from public.admin_pessoas where id = v_pessoa) = 'prova@exemplo.pt',
    'o email não ficou em minúsculas';

  v_recusou := false;
  begin
    perform public.admin_criar_pessoa('prova@exemplo.pt', 'Outra', 'prova-0170');
  exception when others then v_recusou := true;
  end;
  assert v_recusou, 'duas pessoas com o mesmo email passaram';

  v_recusou := false;
  begin
    perform public.admin_definir_papel(v_pessoa, v_regiao, 'administrador', 'prova-0170');
  exception when others then v_recusou := true;
  end;
  assert v_recusou, 'um papel que não existe passou';

  assert public.admin_definir_papel(v_pessoa, v_regiao, 'editor', 'prova-0170'),
    'dar o papel de editor não mudou nada';
  assert not public.admin_definir_papel(v_pessoa, v_regiao, 'editor', 'prova-0170'),
    'repetir o mesmo papel contou como mudança';
  assert public.admin_definir_papel(v_pessoa, v_regiao, 'gestor', 'prova-0170'),
    'passar a gestor não mudou nada';
  assert (select papel from public.admin_papeis where pessoa_id = v_pessoa) = 'gestor',
    'o papel não ficou gestor';

  perform public.admin_criar_convite(v_pessoa, v_token, 'prova-0170');
  select * into v_ativada from public.admin_ativar_com_convite(v_token, v_hash);
  assert v_ativada.id = v_pessoa, 'a ativação devolveu outra pessoa';
  assert (select senha_hash from public.admin_pessoas where id = v_pessoa) = v_hash,
    'a palavra-passe não ficou gravada';

  v_recusou := false;
  begin
    perform public.admin_ativar_com_convite(v_token, v_hash);
  exception when others then v_recusou := true;
  end;
  assert v_recusou, 'uma ligação usada valeu segunda vez';

  -- Uma ligação nova anula a que estava por usar.
  perform public.admin_criar_convite(v_pessoa, repeat('b', 64), 'prova-0170');
  perform public.admin_criar_convite(v_pessoa, repeat('c', 64), 'prova-0170');
  v_recusou := false;
  begin
    perform public.admin_ativar_com_convite(repeat('b', 64), v_hash);
  exception when others then v_recusou := true;
  end;
  assert v_recusou, 'uma ligação anulada por outra mais nova continuou a valer';

  -- Desativada, nem a ligação mais nova vale.
  assert public.admin_definir_estado_da_pessoa(v_pessoa, false, 'prova-0170'),
    'desativar não mudou nada';
  v_recusou := false;
  begin
    perform public.admin_ativar_com_convite(repeat('c', 64), v_hash);
  exception when others then v_recusou := true;
  end;
  assert v_recusou, 'uma pessoa desativada ativou-se com uma ligação antiga';

  perform public.admin_registar_acesso(null, 'prova-0170');
  select count(*) into n from public.admin_actions
   where actor = 'prova-0170' and action like 'pessoa.%';
  assert n >= 6, format('a auditoria das contas tem %s linhas, esperavam-se pelo menos 6', n);

  -- O limitador: espreitar não conta, e limpar esquece.
  perform public.rate_limit_hit('prova-0170:balde', 900, 5);
  perform public.rate_limit_hit('prova-0170:balde', 900, 5);
  assert (select hits from public.rate_limit_peek('prova-0170:balde', 900)) = 2,
    'espreitar o balde não devolveu as duas tentativas';
  assert (select hits from public.rate_limit_peek('prova-0170:balde', 900)) = 2,
    'espreitar o balde contou como tentativa';
  perform public.rate_limit_clear('prova-0170:balde');
  assert (select hits from public.rate_limit_peek('prova-0170:balde', 900)) = 0,
    'limpar o balde não o esqueceu';

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
