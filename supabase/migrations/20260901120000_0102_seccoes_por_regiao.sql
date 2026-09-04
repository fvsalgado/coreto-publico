-- 0102 — Os interruptores de secção passam a ser por região.
--
-- A 0074 deu ao sítio quatro interruptores — coretos, ciclos, fontes,
-- informações — com o `id` da secção por chave. Com mais do que uma região
-- isso deixava de servir: desligar os coretos de uma CIM desligava os de
-- todas. A chave passa a `(region_id, id)`.
--
-- Que secções EXISTEM continua a ser do repositório (a restrição
-- `site_sections_conhecidas` fica intacta — os quatro ids são do produto);
-- o que cada região liga ou desliga é dela. E uma região nova sem linhas
-- nasce com tudo ligado, porque quem lê (`lerDesligadas`) só procura o que
-- está desligado — não é preciso semear secções no nascimento.
--
-- `set_site_section` ganha a região como parâmetro COM omissão 'medio-tejo':
-- é o que deixa o backoffice de hoje continuar a funcionar sem mudar uma
-- linha até a aplicação aprender a passar a região. A linha de auditoria
-- passa a identificar a secção como 'regiao/seccao'.

alter table public.site_sections
  add column region_id text;

update public.site_sections set region_id = 'medio-tejo' where region_id is null;

alter table public.site_sections alter column region_id set not null;

alter table public.site_sections
  add constraint site_sections_region_fk
  foreign key (region_id) references public.regions(id) on delete cascade;

alter table public.site_sections drop constraint site_sections_pkey;
alter table public.site_sections add primary key (region_id, id);

comment on table public.site_sections is
  'O interruptor de cada secção opcional do sítio, por região. Que secções '
  'existem é do repositório (a restrição `site_sections_conhecidas` e '
  '`navegacao.ts`); o que aqui se guarda é apenas se cada uma está ligada '
  'hoje, em cada região — e uma região sem linhas tem tudo ligado. '
  'Escreve-se por `set_site_section`, que deixa rasto em `admin_actions`.';

-- A assinatura antiga (sem região) sai primeiro: com outra assinatura, um
-- `create or replace` criava uma sobrecarga em vez de substituir, e um RPC
-- com os nomes antigos ficava ambíguo.
drop function if exists public.set_site_section(text, boolean, text, text);

create or replace function public.set_site_section(
  p_id      text,
  p_enabled boolean,
  p_actor   text,
  p_ip_hash text default null,
  p_region  text default 'medio-tejo'
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes boolean;
begin
  if p_actor is null or p_actor = '' then
    raise exception 'sem autor não se liga nem desliga nada';
  end if;

  select is_enabled into v_antes
  from public.site_sections
  where region_id = p_region and id = p_id
  for update;

  if not found then
    -- A linha pode legitimamente não existir ainda: uma região nova nasce
    -- sem linhas e com tudo ligado. Ligar o que já está ligado por omissão
    -- não é um acontecimento; desligar é o primeiro toque, e criar a linha
    -- aqui é o mesmo gesto que a 0074 fazia à mão no seed.
    if p_id not in ('coretos', 'ciclos', 'fontes', 'informacoes') then
      raise exception 'não há secção com o identificador %', p_id;
    end if;
    if not exists (select 1 from public.regions where id = p_region) then
      raise exception 'não há região com o identificador %', p_region;
    end if;
    if p_enabled then
      return false;
    end if;
    insert into public.site_sections (region_id, id, is_enabled)
    values (p_region, p_id, true);
    v_antes := true;
  end if;

  -- Carregar duas vezes no mesmo botão não é um acontecimento. Sem isto, o
  -- registo de auditoria enchia-se de linhas que não dizem nada.
  if v_antes = p_enabled then
    return false;
  end if;

  update public.site_sections
  set is_enabled = p_enabled, updated_at = now(), updated_by = p_actor
  where region_id = p_region and id = p_id;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after, ip_hash)
  values (
    p_actor,
    case when p_enabled then 'section.enable' else 'section.disable' end,
    'site_section',
    p_region || '/' || p_id,
    jsonb_build_object('is_enabled', v_antes),
    jsonb_build_object('is_enabled', p_enabled),
    p_ip_hash
  );

  return true;
end;
$$;

comment on function public.set_site_section(text, boolean, text, text, text) is
  'Liga ou desliga uma secção do sítio numa região, com uma linha de '
  'auditoria. Devolve `false` quando já estava assim. É o único caminho pelo '
  'qual a aplicação escreve em `site_sections`.';

revoke all on function public.set_site_section(text, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.set_site_section(text, boolean, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.site_sections where region_id = 'medio-tejo';
  if v_n <> 4 then
    raise exception 'esperavam-se as 4 secções do Médio Tejo e há %', v_n;
  end if;
end $$;
