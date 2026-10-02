-- 0169 — O promotor declara o seu artigo.
--
-- A prosa do sítio dava a quem promove uma agenda o feminino de
-- «Comunidade», escrito à mão: «Promovido pela …», «a agenda dos onze
-- concelhos da …», «Concelho do distrito de …, na …» (C1-031). O comentário
-- de `apps/web/src/lib/regiao.ts` já dizia quando isso deixava de chegar —
-- «se um dia o promotor puder ser um Município, o artigo do promotor passa a
-- coluna, como o do nome» —, e o produto licencia-se a uma câmara sozinha:
-- «Promovido pela Município de Ourém» era a primeira frase partida que uma
-- câmara via no rodapé da sua agenda.
--
-- **Por omissão «a»**, que é o artigo de todas as entidades que hoje
-- promovem uma agenda — Comunidade Intermunicipal, Área Metropolitana,
-- Associação de Municípios —, e por isso nenhuma região existente muda uma
-- letra. Um município declara «o», no painel ou ao nascer.
--
-- É uma declaração e não uma dedução: «o Município», mas «a Câmara
-- Municipal»; nenhuma regra acerta no artigo de um nome próprio, e o do nome
-- da região (`article`, 0104) já se declara pela mesma razão.

alter table public.regions
  add column if not exists cim_article text not null default 'a';

alter table public.regions
  drop constraint if exists regions_artigo_do_promotor;
alter table public.regions
  add constraint regions_artigo_do_promotor
  check (cim_article in ('o', 'a', 'os', 'as'));

comment on column public.regions.cim_article is
  'O artigo do nome de quem promove a região (`cim_name`): «a» Comunidade Intermunicipal, «o» '
  'Município. É o que compõe «promovido pela/pelo …» e «a agenda dos concelhos da/do …». Ver a 0169.';

-- ---------------------------------------------------------------------------
-- A lista fechada da update_region ganha a coluna
-- ---------------------------------------------------------------------------
--
-- `create or replace` numa migração nova, como a 0164 e a 0167 fizeram: o
-- teste do `CAMPOS_DA_REGIAO` lê a última migração que declara `v_editaveis`,
-- e é esta que passa a valer. O corpo é o da 0167, com a coluna nova e a sua
-- validação.

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
    'cim_name', 'cim_article', 'cim_url', 'contact_email',
    'funding_statement', 'funding_logo_path', 'funding_logo_width',
    'funding_logo_height', 'funding_logo_alt',
    'logo_on_graphite_path', 'logo_on_brand_path', 'logo_width', 'logo_height',
    'og_image_path', 'og_image_alt',
    'data_controller_name', 'data_controller_url', 'data_controller_nif',
    'data_controller_address', 'data_controller_email',
    'data_controller_dpo', 'data_controller_dpo_contact',
    'transit_planner_url', 'brand_color',
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
  -- O artigo do promotor diz-se com palavras antes de a restrição responder
  -- com o nome dela: são quatro, e não há um quinto.
  if p_patch ? 'cim_article' and coalesce(p_patch->>'cim_article', '') not in ('o', 'a', 'os', 'as') then
    raise exception 'o artigo do promotor é «o», «a», «os» ou «as» — «o Município», «a Comunidade»';
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
  -- A cor diz-se com palavras antes de a restrição da coluna responder com o
  -- nome dela: o formato, e a tinta que tem de se ler por cima.
  if p_patch ? 'brand_color' then
    if coalesce(p_patch->>'brand_color', '') !~* '^#[0-9a-f]{6}$' then
      raise exception 'a cor da região escreve-se #rrggbb, por exemplo #1f5c4a';
    end if;
    if not public.cor_com_tinta_legivel(p_patch->>'brand_color') then
      raise exception 'nem o branco nem o grafite se leem sobre a cor % (o mínimo é 4,5:1) — escolha uma mais escura ou mais clara', p_patch->>'brand_color';
    end if;
  end if;

  update public.regions set
    name                  = case when p_patch ? 'name'                  then p_patch->>'name'                          else name                  end,
    article               = case when p_patch ? 'article'               then p_patch->>'article'                       else article               end,
    tagline               = case when p_patch ? 'tagline'               then p_patch->>'tagline'                       else tagline               end,
    about_intro           = case when p_patch ? 'about_intro'           then p_patch->>'about_intro'                   else about_intro           end,
    about_story           = case when p_patch ? 'about_story'           then p_patch->>'about_story'                   else about_story           end,
    cim_name              = case when p_patch ? 'cim_name'              then p_patch->>'cim_name'                      else cim_name              end,
    cim_article           = case when p_patch ? 'cim_article'           then p_patch->>'cim_article'                   else cim_article           end,
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
    brand_color           = case when p_patch ? 'brand_color'           then lower(p_patch->>'brand_color')            else brand_color           end,
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
  'o planeador de transportes públicos; desde a 0167, a cor da marca; desde a '
  '0169, o artigo do promotor.';

-- ---------------------------------------------------------------------------
-- As provas, numa transação que se desfaz.
-- ---------------------------------------------------------------------------
do $$
declare
  v_regiao  text;
  v_recusou boolean;
begin
  -- O Médio Tejo é promovido por uma Comunidade Intermunicipal, e continua
  -- «a», onde existir.
  assert not exists (select 1 from public.regions where id = 'medio-tejo' and cim_article <> 'a'),
    'o promotor do Médio Tejo perdeu o artigo «a»';

  select id into v_regiao from public.regions order by sort_order limit 1;
  assert v_regiao is not null, 'sem região nenhuma para provar a 0169';

  perform public.update_region(v_regiao, jsonb_build_object('cim_article', 'o'), 'prova-0169');
  assert (select cim_article from public.regions where id = v_regiao) = 'o',
    'a update_region não gravou o artigo do promotor';

  v_recusou := false;
  begin
    perform public.update_region(v_regiao, jsonb_build_object('cim_article', 'lo'), 'prova-0169');
  exception when others then
    v_recusou := true;
  end;
  assert v_recusou, 'um artigo que não existe passou';

  v_recusou := false;
  begin
    perform public.update_region(v_regiao, jsonb_build_object('cim_article', null), 'prova-0169');
  exception when others then
    v_recusou := true;
  end;
  assert v_recusou, 'um artigo vazio passou';

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
