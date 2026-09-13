-- 0074 — Um interruptor por secção, e o que ele não pode ser.
--
-- Quatro secções do sítio passam a poder estar ligadas ou desligadas a partir
-- do painel: os **coretos**, os **ciclos e festivais**, o **de onde vêm os
-- eventos** e as **informações**. Ligada, a secção está na navegação, no mapa
-- do sítio e responde no seu endereço; desligada, não está em lado nenhum e o
-- endereço devolve 404.
--
-- ## A regra da casa, e como é que isto não a parte
--
-- Está escrito em `/admin/espacos`, e continua a valer: «resolver é uma
-- migração, não um botão. Uma alteração feita a partir da web não fica no
-- repositório, e uma base de dados que já não se reconstrói do repositório é
-- o princípio do fim.» Um interruptor no painel é, à letra, estado mudado a
-- partir da web. Por isso o desenho separa duas coisas que se confundem com
-- facilidade:
--
--   · **Que secções existem** é do repositório, e continua a sê-lo. O nome, o
--     endereço, o ícone e o texto de cada uma vivem em `navegacao.ts`; aqui
--     vive a restrição `site_sections_conhecidas`, que só admite estes quatro
--     identificadores. Uma secção nova não entra por `insert`: entra por
--     migração, porque uma secção nova é uma rota nova, e uma rota nova é
--     código.
--   · **Se cada uma está ligada hoje** é operação, e não desenho. Muda com o
--     estado da região e não com o estado do código — é a mesma natureza do
--     `is_enabled` das fontes, que já vive nesta base há setenta e três
--     migrações.
--
-- E o painel mostra, ao lado dos interruptores, o `update` que reproduz o
-- estado actual. Quem quiser que o repositório passe a nascer já com estas
-- escolhas cola essas linhas numa migração. O caminho de volta ao
-- repositório fica aberto, que é o que a regra realmente protege.
--
-- ## Porquê uma linha por secção e não uma coluna por secção
--
-- Uma tabela `settings` de coluna por definição obrigava a uma migração por
-- cada interruptor novo — e a uma alteração de tipo em cada leitura. Uma linha
-- por secção lê-se de uma vez, ordena-se, e a auditoria pode falar de uma
-- entidade com nome (`site_section` / `coretos`) em vez de uma coluna.
-- ---------------------------------------------------------------------------

create table public.site_sections (
  id         text primary key,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint site_sections_conhecidas
    check (id in ('coretos', 'ciclos', 'fontes', 'informacoes'))
);

comment on table public.site_sections is
  'O interruptor de cada secção opcional do sítio. Que secções existem é do '
  'repositório (a restrição `site_sections_conhecidas` e `navegacao.ts`); o '
  'que aqui se guarda é apenas se cada uma está ligada hoje. Escreve-se por '
  '`set_site_section`, que deixa rasto em `admin_actions`.';

comment on column public.site_sections.updated_by is
  'Quem carregou no interruptor. Fica na linha além de ficar na auditoria: '
  'o painel mostra «desligada por X» sem ter de ler o registo todo.';

-- As quatro nascem ligadas, que é o estado em que o sítio está hoje. Uma
-- migração que desligasse alguma coisa mudava o sítio sem ninguém ter pedido.
insert into public.site_sections (id) values
  ('coretos'), ('ciclos'), ('fontes'), ('informacoes');

-- ---------------------------------------------------------------------------
-- Quem lê isto é o sítio inteiro, com a chave anónima
--
-- O layout de raiz lê esta tabela em todas as páginas para saber que destinos
-- desenhar, e quem lê o layout é a chave pública. Daí a única policy de
-- leitura desta migração — e é leitura e mais nada: escrever continua a ser
-- privilégio da chave de serviço, como em todas as outras tabelas.
alter table public.site_sections enable row level security;

create policy site_sections_public_read on public.site_sections
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- A escrita, pelo caminho de sempre
--
-- A aplicação não escreve na tabela: chama a função, e é ela que regista o
-- antes e o depois. Um interruptor sem rasto era a única coisa no painel que
-- mudava a cara do sítio sem dizer quem foi.
create or replace function public.set_site_section(
  p_id      text,
  p_enabled boolean,
  p_actor   text,
  p_ip_hash text default null
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
  from public.site_sections where id = p_id
  for update;

  if not found then
    raise exception 'não há secção com o identificador %', p_id;
  end if;

  -- Carregar duas vezes no mesmo botão não é um acontecimento. Sem isto, o
  -- registo de auditoria enchia-se de linhas que não dizem nada.
  if v_antes = p_enabled then
    return false;
  end if;

  update public.site_sections
  set is_enabled = p_enabled, updated_at = now(), updated_by = p_actor
  where id = p_id;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after, ip_hash)
  values (
    p_actor,
    case when p_enabled then 'section.enable' else 'section.disable' end,
    'site_section',
    p_id,
    jsonb_build_object('is_enabled', v_antes),
    jsonb_build_object('is_enabled', p_enabled),
    p_ip_hash
  );

  return true;
end;
$$;

comment on function public.set_site_section(text, boolean, text, text) is
  'Liga ou desliga uma secção do sítio, com uma linha de auditoria. Devolve '
  '`false` quando já estava assim. É o único caminho pelo qual a aplicação '
  'escreve em `site_sections`.';

revoke all on function public.set_site_section(text, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.set_site_section(text, boolean, text, text) to service_role;

-- ---------------------------------------------------------------------------
do $$
declare
  v_n       integer;
  v_mudou   boolean;
  v_ligadas integer;
begin
  select count(*) into v_n from public.site_sections;
  if v_n <> 4 then
    raise exception 'esperavam-se 4 secções e há %', v_n;
  end if;

  select count(*) into v_ligadas from public.site_sections where is_enabled;
  if v_ligadas <> 4 then
    raise exception 'as quatro secções têm de nascer ligadas, e há % ligadas', v_ligadas;
  end if;

  -- Vai e volta, para não deixar a base diferente do que estava.
  v_mudou := public.set_site_section('coretos', false, 'migração 0074');
  if not v_mudou or (select is_enabled from public.site_sections where id = 'coretos') then
    raise exception 'set_site_section não desligou a secção';
  end if;

  if not exists (
    select 1 from public.admin_actions
    where entity_type = 'site_section' and entity_id = 'coretos'
      and actor = 'migração 0074' and action = 'section.disable'
      and (after->>'is_enabled')::boolean is false
  ) then
    raise exception 'set_site_section não deixou rasto na auditoria';
  end if;

  -- Carregar outra vez no mesmo botão não escreve nada.
  if public.set_site_section('coretos', false, 'migração 0074') then
    raise exception 'desligar o que já estava desligado devia devolver false';
  end if;

  perform public.set_site_section('coretos', true, 'migração 0074');
  if not (select is_enabled from public.site_sections where id = 'coretos') then
    raise exception 'a reposição da asserção falhou — a base ficou diferente';
  end if;

  -- Um identificador que o código não conhece não entra por engano.
  begin
    perform public.set_site_section('widget', false, 'migração 0074');
    raise exception 'uma secção desconhecida devia ter sido recusada';
  exception when others then
    if sqlerrm = 'uma secção desconhecida devia ter sido recusada' then raise; end if;
  end;

  begin
    insert into public.site_sections (id) values ('widget');
    raise exception 'a restrição das secções conhecidas não travou';
  exception when check_violation then
    null;
  end;
end
$$;
