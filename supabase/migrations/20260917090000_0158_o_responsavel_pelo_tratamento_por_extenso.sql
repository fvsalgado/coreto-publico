-- 0158 — O responsável pelo tratamento, por extenso.
--
-- A `regions` sabia dizer duas coisas sobre quem responde pelos dados
-- pessoais de uma agenda: um **nome** e um **endereço web**. É o que chega
-- para uma CIM, que tem sítio próprio, e é exatamente o que falta para todos
-- os outros casos.
--
-- ---------------------------------------------------------------------------
-- O que o RGPD.md pede e a tabela não guardava
-- ---------------------------------------------------------------------------
--
-- O registo de atividades de tratamento desta casa tem um quadro por região, e
-- o quadro pede seis linhas: região, responsável **com NIPC**, **morada e
-- contactos**, **encarregado de proteção de dados**, **contacto do EPD**, e a
-- data da última revisão. A tabela guardava uma e meia. O `LICENCIAR.md` diz a
-- mesma coisa por outras palavras na secção 2.1 — «nome, NIF, morada e
-- endereço de contacto da entidade responsável pelo tratamento» — e classifica
-- a falta como **o que impede assinar**.
--
-- E há uma que não é opcional. Quando o responsável é uma autoridade ou
-- organismo público — uma comunidade intermunicipal, um município — a
-- designação de encarregado de proteção de dados é **obrigatória** (RGPD,
-- artigo 37.º, n.º 1, alínea a)) e o contacto dele **tem de ser publicado**
-- (artigo 37.º, n.º 7). Uma agenda contratada com uma CIM que não consegue
-- publicar o contacto do EPD é uma agenda que não cumpre, por não ter onde o
-- escrever.
--
-- ---------------------------------------------------------------------------
-- Cinco colunas, todas a nulo, e é assim que ficam
-- ---------------------------------------------------------------------------
--
-- **Esta migração não preenche nada, e não é por cautela — é por não saber.**
-- Quem responde pelo tratamento de cada agenda é uma decisão contratual entre
-- o titular do software e cada CIM, tomada fora deste repositório. O que aqui
-- se faz é dar-lhe onde caber, para que no dia em que o contrato existir seja
-- trabalho de formulário e não de migração.
--
-- O Médio Tejo continua por contratar e continua a nulo: a `/privacidade`
-- mostra a CIM promotora, que é a omissão desde a 0101 e é a leitura certa
-- enquanto ninguém disser outra coisa.

-- ---------------------------------------------------------------------------
-- As colunas
-- ---------------------------------------------------------------------------

alter table public.regions
  add column if not exists data_controller_nif         text,
  add column if not exists data_controller_address     text,
  add column if not exists data_controller_email       text,
  add column if not exists data_controller_dpo         text,
  add column if not exists data_controller_dpo_contact text;

comment on column public.regions.data_controller_nif is
  'NIF ou NIPC de quem responde pelo tratamento. Guardado como texto e não '
  'como número: um NIPC tem nove dígitos que podem começar por zero, e um '
  'inteiro come o zero da frente.';

comment on column public.regions.data_controller_address is
  'A morada de quem responde pelo tratamento, para a política de privacidade. '
  'Numa linha ou em várias — o que a região escrever é o que sai.';

comment on column public.regions.data_controller_email is
  'O contacto para o exercício de direitos, quando não é o email da região. '
  'A nulo, vale o regions.contact_email — que é o que a política já publicava.';

comment on column public.regions.data_controller_dpo is
  'O encarregado de proteção de dados. Obrigatório quando o responsável é uma '
  'autoridade ou organismo público (RGPD, artigo 37.º, n.º 1, alínea a)).';

comment on column public.regions.data_controller_dpo_contact is
  'O contacto do EPD, que o artigo 37.º, n.º 7, manda publicar e comunicar à '
  'autoridade de controlo.';

-- ---------------------------------------------------------------------------
-- A lista fechada da update_region ganha as cinco
-- ---------------------------------------------------------------------------
--
-- `create or replace` numa migração nova, e nunca uma edição da 0109: as
-- migrações desta casa são história. O teste do `CAMPOS_DA_REGIAO` lê a
-- **última** migração que declara `v_editaveis`, por isso é esta que passa a
-- valer — e o espelho do lado do código muda com ela na mesma vaga.

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
    data_controller_nif   = case when p_patch ? 'data_controller_nif'   then p_patch->>'data_controller_nif'           else data_controller_nif   end,
    data_controller_address
                          = case when p_patch ? 'data_controller_address'
                                 then p_patch->>'data_controller_address'     else data_controller_address     end,
    data_controller_email = case when p_patch ? 'data_controller_email' then p_patch->>'data_controller_email'         else data_controller_email end,
    data_controller_dpo   = case when p_patch ? 'data_controller_dpo'   then p_patch->>'data_controller_dpo'           else data_controller_dpo   end,
    data_controller_dpo_contact
                          = case when p_patch ? 'data_controller_dpo_contact'
                                 then p_patch->>'data_controller_dpo_contact' else data_controller_dpo_contact end,
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
  'contacto e o encarregado de proteção de dados do responsável.';

revoke all on function public.update_region(text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.update_region(text, jsonb, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- As asserções
-- ---------------------------------------------------------------------------

do $$
declare
  n   integer;
  def text;
begin
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public' and table_name = 'regions'
     and column_name in ('data_controller_nif', 'data_controller_address',
                         'data_controller_email', 'data_controller_dpo',
                         'data_controller_dpo_contact');
  assert n = 5, format('ficaram %s das 5 colunas do responsável pelo tratamento', n);

  -- Uma coluna que existe e que a função não deixa editar é uma coluna que
  -- ninguém consegue preencher pelo painel — o engano que o teste do
  -- CAMPOS_DA_REGIAO existe para apanhar, apanhado também deste lado.
  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'update_region';
  assert def like '%data_controller_dpo_contact%',
    'a update_region não ficou a saber editar o contacto do EPD';

  -- Ninguém ganha um responsável por esta migração. Quem responde pelos dados
  -- de uma agenda decide-se num contrato, não num ficheiro SQL.
  select count(*) into n from public.regions
   where data_controller_nif is not null or data_controller_address is not null
      or data_controller_email is not null or data_controller_dpo is not null
      or data_controller_dpo_contact is not null;
  assert n = 0, format('%s região(ões) ficaram com dados do responsável por esta migração', n);
end
$$;
