-- 0164 — A região declara o seu planeador de transportes públicos.
--
-- «Como chegar» oferecia o Google Maps e o OpenStreetMap, e nenhuma palavra
-- sobre transportes públicos (C2-015). No interior, quem não conduz precisa de
-- saber se há autocarro — e o PROJETO.md diz, desde o primeiro dia, que o campo
-- «como chegar» existe a pensar na mobilidade.
--
-- **Um campo da região, e nunca um endereço no código.** A Paragem.pt é da
-- mesma casa e serve os mesmos territórios, mas uma região só tem planeador
-- quando alguém o declarou: a ligação aparece nas fichas da região que o
-- declara, e em mais nenhuma. Uma CIM sem planeador não ganha uma ligação para
-- o planeador de outra.
--
-- **O que a ligação faz hoje, e fica dito.** Abre o planeador da região sem o
-- destino preenchido: o planeador aceita `?para=` com o NOME exato de um ponto
-- da sua procura (uma paragem, uma estação), e não uma coordenada nem o nome de
-- um espaço cultural. A ficha di-lo a quem carrega — escreva lá o destino — em
-- vez de prometer um percurso que não monta. Quando o planeador aceitar o
-- destino em coordenadas, é a ficha que muda, e não esta coluna.
--
-- **As migrações só semeiam o que é de prova.** Nenhuma região real recebe aqui
-- um endereço: o do Médio Tejo entra pelo painel, como a 0109 manda para tudo o
-- que é configuração de uma CIM.

alter table public.regions
  add column if not exists transit_planner_url text;

-- Só `https`, e sem espaços: é um endereço que vai parar a um `href` público.
-- Um `javascript:` escrito por engano no painel era um defeito de segurança, e
-- um endereço sem esquema era uma ligação relativa a um caminho que não existe.
alter table public.regions
  drop constraint if exists regions_planeador_https;
alter table public.regions
  add constraint regions_planeador_https
  check (transit_planner_url is null or transit_planner_url ~ '^https://[^[:space:]]+$');

comment on column public.regions.transit_planner_url is
  'O planeador de transportes públicos da região (o da Paragem.pt, quando a '
  'região o tem), para a ligação «Ir de transportes públicos» das fichas. Nulo '
  'é «sem planeador» — e então a ligação não aparece.';

-- ---------------------------------------------------------------------------
-- A lista fechada da update_region ganha a coluna
-- ---------------------------------------------------------------------------
--
-- `create or replace` numa migração nova, como a 0158 fez: o teste do
-- `CAMPOS_DA_REGIAO` lê a última migração que declara `v_editaveis`, e é esta
-- que passa a valer. O corpo é o da 0158 com a coluna nova e a sua validação.

create or replace function public.update_region(
  p_id      text,
  p_patch   jsonb,
  p_actor   text,
  p_ip_hash text default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha     public.regions%rowtype;
  v_chave     text;
  v_antes     jsonb := '{}'::jsonb;
  v_depois    jsonb := '{}'::jsonb;
  v_editaveis text[] := array[
    'name', 'article', 'tagline', 'about_intro', 'about_story',
    'cim_name', 'cim_url', 'contact_email',
    'funding_statement', 'funding_logo_path', 'funding_logo_width',
    'funding_logo_height', 'funding_logo_alt',
    'logo_on_graphite_path', 'logo_on_brand_path', 'logo_width', 'logo_height',
    'og_image_path', 'og_image_alt',
    'data_controller_name', 'data_controller_url', 'data_controller_nif',
    'data_controller_address', 'data_controller_email',
    'data_controller_dpo', 'data_controller_dpo_contact',
    'transit_planner_url',
    'is_enabled', 'sort_order'
  ];
begin
  if p_actor is null or p_actor = '' then
    raise exception 'sem autor não se edita região nenhuma';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'a alteração tem de ser um objeto com as colunas a mudar';
  end if;

  select * into v_linha from public.regions where id = p_id for update;
  if not found then
    raise exception 'não há região com o identificador %', p_id;
  end if;

  for v_chave in select jsonb_object_keys(p_patch) loop
    if not (v_chave = any(v_editaveis)) then
      raise exception 'a coluna % não se edita por aqui — o NOVA-CIM.md diz onde', v_chave;
    end if;
    if to_jsonb(v_linha) -> v_chave is distinct from p_patch -> v_chave then
      v_antes  := v_antes  || jsonb_build_object(v_chave, to_jsonb(v_linha) -> v_chave);
      v_depois := v_depois || jsonb_build_object(v_chave, p_patch -> v_chave);
    end if;
  end loop;

  -- Guardar o mesmo não é um acontecimento — nem merece linha de auditoria.
  if v_depois = '{}'::jsonb then
    return false;
  end if;

  -- O que é obrigatório não pode ficar em branco por um formulário distraído.
  if p_patch ? 'name' and coalesce(trim(p_patch->>'name'), '') = '' then
    raise exception 'o nome da região não pode ficar vazio';
  end if;
  if p_patch ? 'cim_name' and coalesce(trim(p_patch->>'cim_name'), '') = '' then
    raise exception 'o nome do promotor não pode ficar vazio';
  end if;
  if p_patch ? 'cim_url' and coalesce(trim(p_patch->>'cim_url'), '') = '' then
    raise exception 'o endereço do promotor não pode ficar vazio';
  end if;
  if p_patch ? 'contact_email' and coalesce(trim(p_patch->>'contact_email'), '') = '' then
    raise exception 'o email da região não pode ficar vazio';
  end if;
  -- A mesma regra da restrição da coluna, dita aqui com palavras: a
  -- restrição sozinha respondia com o nome dela, e quem preenche o formulário
  -- não tem de saber o que é um `check`.
  if p_patch ? 'transit_planner_url'
     and p_patch->>'transit_planner_url' is not null
     and p_patch->>'transit_planner_url' !~ '^https://[^[:space:]]+$' then
    raise exception 'o planeador de transportes tem de ser um endereço completo, com https://';
  end if;

  update public.regions set
    name                  = case when p_patch ? 'name'                  then p_patch->>'name'                          else name                  end,
    article               = case when p_patch ? 'article'               then p_patch->>'article'                       else article               end,
    tagline               = case when p_patch ? 'tagline'               then p_patch->>'tagline'                       else tagline               end,
    about_intro           = case when p_patch ? 'about_intro'           then p_patch->>'about_intro'                   else about_intro           end,
    about_story           = case when p_patch ? 'about_story'           then p_patch->>'about_story'                   else about_story           end,
    cim_name              = case when p_patch ? 'cim_name'              then p_patch->>'cim_name'                      else cim_name              end,
    cim_url               = case when p_patch ? 'cim_url'               then p_patch->>'cim_url'                       else cim_url               end,
    contact_email         = case when p_patch ? 'contact_email'         then p_patch->>'contact_email'                 else contact_email         end,
    funding_statement     = case when p_patch ? 'funding_statement'     then p_patch->>'funding_statement'             else funding_statement     end,
    funding_logo_path     = case when p_patch ? 'funding_logo_path'     then p_patch->>'funding_logo_path'             else funding_logo_path     end,
    funding_logo_width    = case when p_patch ? 'funding_logo_width'    then (p_patch->>'funding_logo_width')::integer else funding_logo_width    end,
    funding_logo_height   = case when p_patch ? 'funding_logo_height'   then (p_patch->>'funding_logo_height')::integer else funding_logo_height  end,
    funding_logo_alt      = case when p_patch ? 'funding_logo_alt'      then p_patch->>'funding_logo_alt'              else funding_logo_alt      end,
    logo_on_graphite_path = case when p_patch ? 'logo_on_graphite_path' then p_patch->>'logo_on_graphite_path'         else logo_on_graphite_path end,
    logo_on_brand_path    = case when p_patch ? 'logo_on_brand_path'    then p_patch->>'logo_on_brand_path'            else logo_on_brand_path    end,
    logo_width            = case when p_patch ? 'logo_width'            then (p_patch->>'logo_width')::integer         else logo_width            end,
    logo_height           = case when p_patch ? 'logo_height'           then (p_patch->>'logo_height')::integer        else logo_height           end,
    og_image_path         = case when p_patch ? 'og_image_path'         then p_patch->>'og_image_path'                 else og_image_path         end,
    og_image_alt          = case when p_patch ? 'og_image_alt'          then p_patch->>'og_image_alt'                  else og_image_alt          end,
    data_controller_name  = case when p_patch ? 'data_controller_name'  then p_patch->>'data_controller_name'          else data_controller_name  end,
    data_controller_url   = case when p_patch ? 'data_controller_url'   then p_patch->>'data_controller_url'           else data_controller_url   end,
    data_controller_nif   = case when p_patch ? 'data_controller_nif'   then p_patch->>'data_controller_nif'           else data_controller_nif   end,
    data_controller_address
                          = case when p_patch ? 'data_controller_address'
                                 then p_patch->>'data_controller_address'     else data_controller_address     end,
    data_controller_email = case when p_patch ? 'data_controller_email' then p_patch->>'data_controller_email'         else data_controller_email end,
    data_controller_dpo   = case when p_patch ? 'data_controller_dpo'   then p_patch->>'data_controller_dpo'           else data_controller_dpo   end,
    data_controller_dpo_contact
                          = case when p_patch ? 'data_controller_dpo_contact'
                                 then p_patch->>'data_controller_dpo_contact' else data_controller_dpo_contact end,
    transit_planner_url   = case when p_patch ? 'transit_planner_url'   then p_patch->>'transit_planner_url'           else transit_planner_url   end,
    is_enabled            = case when p_patch ? 'is_enabled'            then (p_patch->>'is_enabled')::boolean         else is_enabled            end,
    sort_order            = case when p_patch ? 'sort_order'            then (p_patch->>'sort_order')::integer         else sort_order            end,
    updated_at            = now()
  where id = p_id;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after, ip_hash)
  values (p_actor, 'region.update', 'region', p_id, v_antes, v_depois, p_ip_hash);

  return true;
end;
$$;

comment on function public.update_region(text, jsonb, text, text) is
  'Edita as colunas editáveis de uma região, com uma linha de auditoria. '
  'Devolve `false` quando nada mudou. As colunas de encaminhamento e as '
  'promessas das schema-checks ficam de fora por desenho — ver o cabeçalho '
  'da 0109 e o NOVA-CIM.md. Desde a 0158 edita também o NIF, a morada, o '
  'contacto e o encarregado de proteção de dados do responsável; desde a 0164, '
  'o planeador de transportes públicos.';

-- ---------------------------------------------------------------------------
-- As provas, numa transação que se desfaz.
-- ---------------------------------------------------------------------------
do $$
declare
  v_regiao text;
  v_recusou boolean := false;
begin
  select id into v_regiao from public.regions order by sort_order limit 1;
  assert v_regiao is not null, 'sem região nenhuma para provar a 0164';

  perform public.update_region(
    v_regiao, jsonb_build_object('transit_planner_url', 'https://planeador.exemplo.pt/viagem/'),
    'prova-0164');
  assert (select transit_planner_url from public.regions where id = v_regiao)
           = 'https://planeador.exemplo.pt/viagem/',
    'a update_region não gravou o planeador';

  begin
    perform public.update_region(
      v_regiao, jsonb_build_object('transit_planner_url', 'javascript:alert(1)'), 'prova-0164');
  exception when others then
    v_recusou := true;
  end;
  assert v_recusou, 'um planeador que não é https passou';

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
