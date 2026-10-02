-- 0167 — A região tem a sua cor.
--
-- Todas as regiões vestiam o turquesa do Médio Tejo: estava escrito no
-- `@theme` do `globals.css`, e a tabela `regions` não tinha cor nenhuma
-- (C4-006, e o E5 da auditoria de 19/09). Uma CIM criada no painel nascia com
-- a cor de outra — e a página do produto prometia-lhe o contrário.
--
-- **Uma cor, e o resto sai dela.** `brand_color` é a cor da marca tal como a
-- região a publica, e pinta o cabeçalho; a tinta que vai por cima, o acento
-- que se lê sobre o papel e os dois temas calculam-se no sítio
-- (`apps/web/src/lib/paleta.ts`), pelas contas que o `globals.css` já fazia à
-- mão para o turquesa. O que a base guarda é o que só a região pode decidir.
--
-- **A cor tem de aguentar texto por cima.** O nome do sítio, a navegação e o
-- anel de foco vão em cima dela: a restrição exige que o branco ou o grafite
-- da casa passem os 4,5:1 sobre ela, e a `update_region` diz-o com palavras
-- antes de a restrição responder com o nome dela.
--
-- **Uma região nova nasce com o vermelho do produto**, que é o que a coluna dá
-- por omissão — e não com a cor de outra CIM. O Médio Tejo fica com o seu
-- turquesa, que é o que a CIM publica. A demonstração ganha a sua na 0168.

-- ---------------------------------------------------------------------------
-- O contraste, com as contas da WCAG 2.1
-- ---------------------------------------------------------------------------

create or replace function public.luminancia_relativa(p_cor text)
returns double precision
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_canais double precision[] := array[]::double precision[];
  v_c      double precision;
begin
  if p_cor !~* '^#[0-9a-f]{6}$' then
    raise exception 'cor inválida: % (escreve-se #rrggbb)', p_cor;
  end if;
  for i in 0..2 loop
    v_c := ('x' || substr(p_cor, 2 + i * 2, 2))::bit(8)::integer / 255.0;
    v_canais := v_canais || (case when v_c <= 0.03928 then v_c / 12.92
                                  else power((v_c + 0.055) / 1.055, 2.4) end);
  end loop;
  return 0.2126 * v_canais[1] + 0.7152 * v_canais[2] + 0.0722 * v_canais[3];
end;
$$;

create or replace function public.contraste_de_cores(p_a text, p_b text)
returns double precision
language sql
immutable
strict
set search_path = ''
as $$
  select (greatest(la, lb) + 0.05) / (least(la, lb) + 0.05)
    from (select public.luminancia_relativa(p_a) as la, public.luminancia_relativa(p_b) as lb) as t;
$$;

-- O branco ou o grafite da casa (`--color-ink`, #181921) a 4,5:1 ou mais.
create or replace function public.cor_com_tinta_legivel(p_cor text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select greatest(public.contraste_de_cores(p_cor, '#ffffff'),
                  public.contraste_de_cores(p_cor, '#181921')) >= 4.5;
$$;

comment on function public.cor_com_tinta_legivel(text) is
  'Verdadeiro quando o branco ou o grafite da casa se leem (4,5:1) sobre a cor — a condição de uma '
  'cor de marca de região. Ver a 0167 e apps/web/src/lib/paleta.ts.';

-- ---------------------------------------------------------------------------
-- A coluna
-- ---------------------------------------------------------------------------

alter table public.regions
  add column if not exists brand_color text not null default '#c2281c';

alter table public.regions
  drop constraint if exists regions_cor_da_marca;
alter table public.regions
  add constraint regions_cor_da_marca
  check (brand_color ~ '^#[0-9a-f]{6}$' and public.cor_com_tinta_legivel(brand_color));

comment on column public.regions.brand_color is
  'A cor da marca da região, #rrggbb em minúsculas: pinta o cabeçalho, e o resto da paleta sai '
  'dela (apps/web/src/lib/paleta.ts). Por omissão o vermelho do produto. Ver a 0167.';

-- O turquesa que a CIM do Médio Tejo publica no seu tema, e que a casa vestia
-- a todas as regiões. Só se a coluna ainda tiver a omissão: quem já escolheu
-- outra no painel escolheu-a.
update public.regions set brand_color = '#40c0c4'
 where id = 'medio-tejo' and brand_color = '#c2281c';

-- ---------------------------------------------------------------------------
-- A lista fechada da update_region ganha a coluna
-- ---------------------------------------------------------------------------
--
-- `create or replace` numa migração nova, como a 0164 fez: o teste do
-- `CAMPOS_DA_REGIAO` lê a última migração que declara `v_editaveis`, e é esta
-- que passa a valer. O corpo é o da 0164 com a coluna nova e a sua validação.

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
  'o planeador de transportes públicos; desde a 0167, a cor da marca.';

-- ---------------------------------------------------------------------------
-- As provas, numa transação que se desfaz.
-- ---------------------------------------------------------------------------
do $$
declare
  v_regiao  text;
  v_recusou boolean;
begin
  -- As contas: os dois extremos e o par que a casa usa no turquesa (o
  -- `globals.css` diz 7,9:1, e é 7,97 — o comentário corta, não arredonda).
  assert round(public.contraste_de_cores('#ffffff', '#000000')::numeric, 1) = 21.0,
    'o contraste do branco com o preto tem de ser 21:1';
  assert public.contraste_de_cores('#40c0c4', '#181921') between 7.9 and 8.0,
    'o grafite sobre o turquesa tem de dar quase 8:1, como o globals.css diz';
  assert not public.cor_com_tinta_legivel('#777777'),
    'o cinzento médio não aguenta nem branco nem grafite, e passou';

  -- O Médio Tejo continua turquesa, onde existir.
  assert not exists (select 1 from public.regions where id = 'medio-tejo' and brand_color <> '#40c0c4'),
    'o Médio Tejo perdeu o turquesa';

  select id into v_regiao from public.regions order by sort_order limit 1;
  assert v_regiao is not null, 'sem região nenhuma para provar a 0167';

  perform public.update_region(v_regiao, jsonb_build_object('brand_color', '#1F5C4A'), 'prova-0167');
  assert (select brand_color from public.regions where id = v_regiao) = '#1f5c4a',
    'a update_region não gravou a cor, em minúsculas';

  v_recusou := false;
  begin
    perform public.update_region(v_regiao, jsonb_build_object('brand_color', '#777777'), 'prova-0167');
  exception when others then
    v_recusou := true;
  end;
  assert v_recusou, 'uma cor onde nenhuma tinta se lê passou';

  v_recusou := false;
  begin
    perform public.update_region(v_regiao, jsonb_build_object('brand_color', 'verde'), 'prova-0167');
  exception when others then
    v_recusou := true;
  end;
  assert v_recusou, 'uma cor mal escrita passou';

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
