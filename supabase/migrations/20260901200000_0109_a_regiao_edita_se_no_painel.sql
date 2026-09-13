-- 0109 — A região edita-se no painel.
--
-- Até aqui, mexer na prosa, nos contactos ou nos ficheiros de uma região era
-- abrir o SQL editor — sem rasto e com o teclado em cima das colunas que não
-- podem mudar. Esta função é o caminho único de edição para o painel
-- `/admin/regioes`: valida, escreve e deixa a linha de auditoria, como a
-- `set_site_section` faz às secções.
--
-- A lista de colunas editáveis é FECHADA, e o que fica de fora fica de fora
-- por desenho, não por preguiça:
--
--   - `id` é a chave de tudo;
--   - `ical_uid_domain` é o espaço de nomes permanente dos calendários —
--     mudá-lo duplicava a agenda de quem subscreveu (ver 0101);
--   - `domain` é encaminhamento: um engano aqui torna a região inalcançável
--     e cai tudo na omissão — muda-se com a cabeça fria, pelo guia;
--   - `expected_municipality_count` e a caixa geográfica são as promessas
--     que as schema-checks verificam — mudam quando os DADOS mudam, juntos.
--
-- O guia NOVA-CIM.md continua a ser o caminho dessas quatro.

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
    'data_controller_name', 'data_controller_url',
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
  'da 0109 e o NOVA-CIM.md.';

revoke all on function public.update_region(text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.update_region(text, jsonb, text, text) to service_role;
