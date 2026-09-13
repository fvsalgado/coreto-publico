-- 0121 — A região nasce no painel.
--
-- A promessa comercial do Coreto está escrita no NOVA-CIM.md: «uma CIM nova
-- entra em produção sem um único commit». Era verdade — e era um SQL editor.
-- A linha da região, os concelhos, um espaço e uma fonte por concelho, a
-- contagem declarada e a caixa geográfica escreviam-se à mão, com a chave de
-- serviço, sem rasto na auditoria e com o teclado em cima das colunas que
-- nunca mais mudam (o `ical_uid_domain`, ver 0101). A 0109 pôs a edição no
-- painel e deixou o nascimento de fora, por desenho: as quatro colunas que a
-- `update_region` recusa — o domínio, o domínio dos UID, a contagem e a caixa
-- — «mudam quando os dados mudam, juntos». Nascer é exatamente o momento em
-- que os dados nascem juntos, e é por isso que aqui entram todas de uma vez,
-- e por uma função só.
--
-- ## O que a função faz, e porquê cada peça
--
-- `create_region` recebe a identidade da região e a lista dos concelhos, e
-- escreve tudo o que as schema-checks exigem a uma região viva:
--
--   · a linha em `regions`, sempre do tipo «cim» — a montra é uma decisão de
--     migração (0113), nunca de formulário — com `expected_municipality_count`
--     igual ao tamanho da lista e a caixa geográfica calculada dos centros
--     dos concelhos. A promessa e os dados nascem do mesmo gesto, e não podem
--     divergir no primeiro dia;
--   · um concelho por linha da lista, com `sort_order` pela posição — a ordem
--     em que a região os quer ver nas listas é a ordem em que os escreveu;
--   · por concelho, UM espaço provisório — «Câmara Municipal de <Nome>», do
--     tipo `other`, no centro do concelho, com a nota a dizer que foi o painel
--     que o criou e que está por confirmar. Existe porque as schema-checks
--     exigem um espaço a cada concelho (`concelhos sem um único espaço`), e
--     porque uma região sem espaços é uma agenda em que nenhum evento tem
--     onde ser. É provisório e diz-se provisório: o catálogo verdadeiro
--     entra depois, como sempre — por migração, com proveniência;
--   · por concelho, UMA fonte DESLIGADA, do leitor genérico `generic-html`, a
--     apontar ao sítio do município quando o há e a um endereço `.example`
--     quando não há — a mesma convenção das fontes da montra (0110, 0122):
--     um endereço que nunca será pedido, para registar de onde se há de
--     ler. Existe porque as schema-checks exigem uma fonte a cada concelho
--     (`concelhos sem fonte de recolha`), e nasce desligada porque a recolha
--     não bate a portas que ainda não se combinaram. O `public_note` diz
--     porquê, para a página /fontes não mentir;
--   · uma linha de auditoria, `region.create`, com tudo o que ficou escrito.
--
-- ## O que ela recusa
--
-- Tudo o que uma pessoa distraída faria a um formulário, com a mensagem em
-- português: um identificador que não é um slug, uma região ou um concelho
-- que já existem (os slugs dos concelhos são um espaço global — os endereços
-- não levam região), um domínio que já é de alguém ou que já é alias (0111),
-- uma lista de concelhos vazia, um concelho repetido, coordenadas que não
-- caem em Portugal — a latitude e a longitude trocadas, ou um sinal a menos,
-- que são os enganos que acontecem de verdade. A caixa geográfica que nasce
-- daqui é a que as schema-checks vão verificar todas as noites; nascer com
-- um ponto no mar era nascer já a falhar.
--
-- A margem da caixa é de três décimos de grau à volta dos centros — cerca de
-- trinta quilómetros. Não é folga por preguiça: a caixa tem de conter os
-- espaços do concelho inteiro, e um concelho português estende-se até trinta
-- quilómetros da sede (Abrantes, Mação, Odemira). É a mesma generosidade das
-- regiões semeadas à mão (0101, 0110) e, como a `update_region` não deixa
-- editar a caixa, uma margem apertada era uma armadilha para o primeiro
-- espaço da periferia.
--
-- O que NÃO muda: o domínio continua a entrar no Vercel e no DNS pelo guia,
-- os logótipos continuam a entrar por commit, e o `ical_uid_domain` continua
-- a ser definitivo — a função aceita-o uma vez, ao nascer, e mais ninguém lhe
-- toca. O NOVA-CIM.md passa a ter o painel como primeiro caminho e o SQL como
-- segundo; o seed de prova do CI (supabase/ci/9000) continua a ser SQL, e as
-- schema-checks provam os dois caminhos.

create or replace function public.create_region(
  p_id              text,
  p_name            text,
  p_article         text,
  p_cim_name        text,
  p_cim_url         text,
  p_domain          text,
  p_contact_email   text,
  p_ical_uid_domain text,
  p_municipalities  jsonb,
  p_actor           text,
  p_ip_hash         text default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Um slug: o mesmo padrão que os identificadores da casa sempre seguiram.
  c_slug      constant text := '^[a-z0-9][a-z0-9-]*$';
  -- Um nome de anfitrião: etiquetas de letras, algarismos e hífenes, com pelo
  -- menos um ponto — sem esquema, sem porto, sem barras.
  c_host      constant text := '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$';
  -- Um número decimal escrito à mão, com ou sem sinal.
  c_numero    constant text := '^-?[0-9]+(\.[0-9]+)?$';
  -- Trinta quilómetros à volta dos centros — ver o cabeçalho.
  c_margem    constant double precision := 0.3;

  v_dominio   text;
  v_uid       text;
  v_concelho  jsonb;
  v_posicao   integer := 0;
  v_ids       text[] := '{}';
  v_id        text;
  v_nome      text;
  v_distrito  text;
  v_lat       double precision;
  v_lon       double precision;
  v_sitio     text;
  v_espaco    text;
  v_fonte     text;
  v_lat_min   double precision;
  v_lat_max   double precision;
  v_lon_min   double precision;
  v_lon_max   double precision;
  v_ordem     integer;
  v_criados   jsonb := '[]'::jsonb;
begin
  if p_actor is null or p_actor = '' then
    raise exception 'sem autor não nasce região nenhuma';
  end if;

  -- ---- A região ----
  if p_id is null or p_id !~ c_slug then
    raise exception 'o identificador da região tem de ser um slug — minúsculas, algarismos e hífenes, a começar por letra ou algarismo (recebido «%»)', coalesce(p_id, '');
  end if;
  if exists (select 1 from public.regions where id = p_id) then
    raise exception 'já há uma região com o identificador %', p_id;
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'o nome da região não pode ficar vazio';
  end if;
  if p_article is null or p_article not in ('o', 'a', 'os', 'as') then
    raise exception 'o artigo do nome tem de ser «o», «a», «os» ou «as» (recebido «%»)', coalesce(p_article, '');
  end if;
  if coalesce(trim(p_cim_name), '') = '' then
    raise exception 'o nome do promotor não pode ficar vazio';
  end if;
  if coalesce(trim(p_cim_url), '') !~ '^https?://' then
    raise exception 'o endereço do promotor tem de ser um URL completo, com https:// (recebido «%»)', coalesce(p_cim_url, '');
  end if;
  if coalesce(trim(p_contact_email), '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'o email da região tem de ser um endereço de email (recebido «%»)', coalesce(p_contact_email, '');
  end if;

  v_dominio := lower(trim(coalesce(p_domain, '')));
  if v_dominio !~ c_host then
    raise exception 'o domínio tem de ser um nome de anfitrião, como coreto.cimlt.pt — sem https:// nem barras (recebido «%»)', coalesce(p_domain, '');
  end if;
  if exists (select 1 from public.regions where domain = v_dominio) then
    raise exception 'o domínio % já é o canónico de outra região', v_dominio;
  end if;
  -- Um alias redireciona; um canónico serve. O mesmo host nas duas listas era
  -- um laço de redirecionamento — a regra das schema-checks, apanhada antes.
  if exists (select 1 from public.region_domain_aliases where domain = v_dominio) then
    raise exception 'o domínio % já está registado como alias de outra região (0111)', v_dominio;
  end if;

  v_uid := lower(trim(coalesce(p_ical_uid_domain, '')));
  if v_uid !~ c_host then
    raise exception 'o domínio dos UID iCal tem de ser um nome de anfitrião, como o domínio (recebido «%»)', coalesce(p_ical_uid_domain, '');
  end if;

  -- ---- Os concelhos: primeiro conferem-se todos, depois escreve-se ----
  if p_municipalities is null or jsonb_typeof(p_municipalities) <> 'array'
     or jsonb_array_length(p_municipalities) = 0 then
    raise exception 'uma região nasce com pelo menos um concelho — a lista veio vazia';
  end if;

  for v_concelho in select value from jsonb_array_elements(p_municipalities) loop
    v_posicao := v_posicao + 1;
    if jsonb_typeof(v_concelho) <> 'object' then
      raise exception 'o concelho na posição % não é um objeto com id, name, district, latitude e longitude', v_posicao;
    end if;

    v_id := v_concelho ->> 'id';
    if v_id is null or v_id !~ c_slug then
      raise exception 'o identificador do concelho na posição % tem de ser um slug (recebido «%»)', v_posicao, coalesce(v_id, '');
    end if;
    if v_id = any(v_ids) then
      raise exception 'o concelho % aparece duas vezes na lista', v_id;
    end if;
    -- Os slugs dos concelhos são um espaço global: /concelho/<id> não leva
    -- região. Um nome repetido desambigua-se com a terra, como os seeds fazem.
    if exists (select 1 from public.municipalities where id = v_id) then
      raise exception 'já há um concelho com o identificador % — os identificadores dos concelhos são globais, e um repetido desambigua-se com o nome da terra', v_id;
    end if;
    if coalesce(trim(v_concelho ->> 'name'), '') = '' then
      raise exception 'o concelho % não tem nome', v_id;
    end if;
    -- O distrito é público («Concelho do distrito de …») e a coluna nasceu
    -- com o do Médio Tejo por omissão; uma região nova diz o seu.
    if coalesce(trim(v_concelho ->> 'district'), '') = '' then
      raise exception 'o concelho % não diz de que distrito é', v_id;
    end if;
    if jsonb_typeof(v_concelho -> 'latitude') not in ('number', 'string')
       or jsonb_typeof(v_concelho -> 'longitude') not in ('number', 'string')
       or (v_concelho ->> 'latitude') !~ c_numero
       or (v_concelho ->> 'longitude') !~ c_numero then
      raise exception 'as coordenadas do concelho % têm de ser dois números decimais (recebidos «%» e «%»)',
        v_id, coalesce(v_concelho ->> 'latitude', ''), coalesce(v_concelho ->> 'longitude', '');
    end if;
    v_lat := (v_concelho ->> 'latitude')::double precision;
    v_lon := (v_concelho ->> 'longitude')::double precision;
    -- Portugal inteiro, do Corvo a Bragança: latitude entre 32 e 43, longitude
    -- entre −32 e −6. Não valida a morada; apanha o que acontece de verdade —
    -- a latitude e a longitude ao contrário, ou o sinal da longitude a menos.
    if v_lat not between 32 and 43 or v_lon not between -32 and -6 then
      raise exception 'as coordenadas do concelho % (%, %) não caem em Portugal — latitude e longitude trocadas, ou um sinal a menos?', v_id, v_lat, v_lon;
    end if;
    v_sitio := nullif(trim(coalesce(v_concelho ->> 'website', '')), '');
    if v_sitio is not null and v_sitio !~ '^https?://' then
      raise exception 'o sítio do concelho % tem de ser um URL completo, com https:// (recebido «%»)', v_id, v_sitio;
    end if;

    -- O espaço e a fonte que nascem com o concelho têm identificadores
    -- derivados; um choque é raro, mas rebenta com uma frase e não com uma
    -- violação de chave.
    v_espaco := 'camara-municipal-de-' || v_id;
    v_fonte  := 'cm-' || v_id;
    if exists (select 1 from public.venues where id = v_espaco) then
      raise exception 'já há um espaço com o identificador %, que seria o espaço provisório do concelho %', v_espaco, v_id;
    end if;
    if exists (select 1 from public.sources where id = v_fonte) then
      raise exception 'já há uma fonte com o identificador %, que seria a fonte do concelho %', v_fonte, v_id;
    end if;

    v_ids     := v_ids || v_id;
    v_lat_min := least(coalesce(v_lat_min, v_lat), v_lat);
    v_lat_max := greatest(coalesce(v_lat_max, v_lat), v_lat);
    v_lon_min := least(coalesce(v_lon_min, v_lon), v_lon);
    v_lon_max := greatest(coalesce(v_lon_max, v_lon), v_lon);
  end loop;

  -- A caixa: os extremos dos centros com a margem, arredondados para fora às
  -- centésimas — a forma que as regiões semeadas à mão têm (40.50, 41.00).
  v_lat_min := floor((v_lat_min - c_margem) * 100) / 100;
  v_lat_max := ceil((v_lat_max + c_margem) * 100) / 100;
  v_lon_min := floor((v_lon_min - c_margem) * 100) / 100;
  v_lon_max := ceil((v_lon_max + c_margem) * 100) / 100;

  -- A seguir às que já existem, com espaço entre elas; a ordem edita-se no
  -- painel como qualquer outro campo.
  select coalesce(max(sort_order), 0) + 10 into v_ordem from public.regions;

  insert into public.regions (
    id, name, article, kind, cim_name, cim_url, domain, contact_email, ical_uid_domain,
    expected_municipality_count, bbox_lat_min, bbox_lat_max, bbox_lon_min, bbox_lon_max,
    sort_order
  ) values (
    p_id, trim(p_name), p_article, 'cim', trim(p_cim_name), trim(p_cim_url), v_dominio,
    trim(p_contact_email), v_uid,
    jsonb_array_length(p_municipalities), v_lat_min, v_lat_max, v_lon_min, v_lon_max,
    v_ordem
  );

  v_posicao := 0;
  for v_concelho in select value from jsonb_array_elements(p_municipalities) loop
    v_posicao  := v_posicao + 1;
    v_id       := v_concelho ->> 'id';
    v_nome     := trim(v_concelho ->> 'name');
    v_distrito := trim(v_concelho ->> 'district');
    v_lat      := (v_concelho ->> 'latitude')::double precision;
    v_lon      := (v_concelho ->> 'longitude')::double precision;
    v_sitio    := nullif(trim(coalesce(v_concelho ->> 'website', '')), '');
    v_espaco   := 'camara-municipal-de-' || v_id;
    v_fonte    := 'cm-' || v_id;

    insert into public.municipalities (id, name, district, latitude, longitude, website_url, sort_order, region_id)
    values (v_id, v_nome, v_distrito, v_lat, v_lon, v_sitio, v_posicao, p_id);

    -- O espaço provisório: existe para o concelho ter um espaço desde o
    -- primeiro dia, que é o que as schema-checks exigem. `notes` é o caderno
    -- e diz a verdade; `description` fica vazia, que o público não lê notas.
    insert into public.venues (id, name, municipality_id, kind, status, is_association, latitude, longitude, notes)
    values (
      v_espaco, 'Câmara Municipal de ' || v_nome, v_id, 'other', 'provisional', false, v_lat, v_lon,
      'Criado pelo painel por ' || p_actor || ' ao nascer a região ' || p_id
      || ', como espaço provisório do concelho: existe para o concelho ter um espaço desde o '
      || 'primeiro dia (as schema-checks exigem-no). Está por confirmar — nome, morada, '
      || 'coordenadas (são as do centro do concelho) e tipo — contra uma fonte primária; ou '
      || 'entra o catálogo verdadeiro do concelho, por migração, e este apaga-se.'
    );
    -- O próprio nome resolve para si, como em todos os outros espaços — preso
    -- ao concelho, que é a escolha segura (0066).
    insert into public.venue_aliases (alias, venue_id, municipality_id)
    values (public.normalize_for_hash('Câmara Municipal de ' || v_nome), v_espaco, v_id)
    on conflict do nothing;

    -- A fonte desligada: existe para o concelho ter uma fonte desde o primeiro
    -- dia, que é o que as schema-checks exigem, e fica registado de onde se
    -- há de ler. Sem sítio, o endereço `.example` nunca será pedido — a
    -- convenção das fontes da montra (0110, 0122).
    insert into public.sources (id, name, kind, municipality_id, url, adapter, config, is_enabled, public_note, notes)
    values (
      v_fonte, 'Agenda do Município de ' || v_nome, 'municipal_site', v_id,
      coalesce(v_sitio, 'https://' || v_id || '.example/'), 'generic-html', '{}'::jsonb, false,
      case
        when v_sitio is null then
          'Fonte registada ao nascer a região, desligada: o concelho entrou sem sítio, e o '
          || 'endereço é um marcador que nunca será pedido. Liga-se depois de se saber onde o '
          || 'município publica a agenda e de se escolher o leitor.'
        else
          'Fonte registada ao nascer a região, desligada: aponta ao sítio do município, mas '
          || 'ainda não se sondou onde está a agenda nem se escolheu o leitor. Liga-se depois '
          || 'disso, nunca antes.'
      end,
      'Criada pelo painel por ' || p_actor || ' ao nascer a região ' || p_id
      || '. Existe para o concelho ter uma fonte desde o primeiro dia (as schema-checks '
      || 'exigem-no) e nasce desligada: sondar o sítio, escolher o adaptador e o config, '
      || 'declarar min_expected_items — e só então ligar.'
    );

    v_criados := v_criados || jsonb_build_object(
      'id', v_id, 'venue_id', v_espaco, 'source_id', v_fonte
    );
  end loop;

  perform public.log_admin_action(
    p_actor,
    'region.create',
    'region',
    p_id,
    null,
    jsonb_build_object(
      'name', trim(p_name),
      'article', p_article,
      'kind', 'cim',
      'cim_name', trim(p_cim_name),
      'cim_url', trim(p_cim_url),
      'domain', v_dominio,
      'contact_email', trim(p_contact_email),
      'ical_uid_domain', v_uid,
      'expected_municipality_count', jsonb_array_length(p_municipalities),
      'bbox', jsonb_build_object(
        'lat_min', v_lat_min, 'lat_max', v_lat_max, 'lon_min', v_lon_min, 'lon_max', v_lon_max
      ),
      'sort_order', v_ordem,
      'municipalities', v_criados
    ),
    p_ip_hash
  );

  return p_id;
end;
$$;

comment on function public.create_region(text, text, text, text, text, text, text, text, jsonb, text, text) is
  'Faz nascer uma região do tipo «cim» a partir do painel: a linha em '
  '`regions` com a contagem e a caixa geográfica calculadas dos concelhos, um '
  'concelho por elemento da lista, e por concelho um espaço provisório e uma '
  'fonte desligada — o mínimo que as schema-checks exigem —, com uma linha de '
  'auditoria. Devolve o identificador. O domínio no Vercel e os ficheiros '
  'continuam a entrar pelo NOVA-CIM.md.';

revoke all on function public.create_region(text, text, text, text, text, text, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.create_region(text, text, text, text, text, text, text, text, jsonb, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- A rede de segurança desta migração é curta de propósito: o nascimento
-- inteiro — os concelhos, o espaço e a fonte de cada um, a caixa, a auditoria
-- e a recusa de um segundo nascimento com o mesmo nome — prova-se nas
-- schema-checks, ao lado dos outros fluxos do painel, com uma região de prova
-- que nasce e se desfaz na mesma transação.
-- ---------------------------------------------------------------------------
do $$
declare
  c_assinatura constant text :=
    'public.create_region(text, text, text, text, text, text, text, text, jsonb, text, text)';
begin
  if to_regprocedure(c_assinatura) is null then
    raise exception 'a função create_region não ficou criada com a assinatura esperada';
  end if;

  -- Só a chave de serviço faz nascer regiões.
  if has_function_privilege('anon', c_assinatura, 'execute')
     or has_function_privilege('authenticated', c_assinatura, 'execute') then
    raise exception 'create_region ficou executável pelo público';
  end if;
  if not has_function_privilege('service_role', c_assinatura, 'execute') then
    raise exception 'create_region não ficou executável pela chave de serviço';
  end if;

  -- Sem autor, nada — e antes de se olhar para o resto.
  begin
    perform public.create_region(
      'regiao-sem-autor', 'Região sem autor', 'a', 'CIM', 'https://cim.example',
      'coreto.cim.example', 'coreto@cim.example', 'coreto.cim.example',
      '[]'::jsonb, ''
    );
    raise exception 'create_region aceitou um autor vazio';
  exception when others then
    if sqlerrm = 'create_region aceitou um autor vazio' then raise; end if;
  end;
  if exists (select 1 from public.regions where id = 'regiao-sem-autor') then
    raise exception 'create_region escreveu uma região sem autor';
  end if;
end
$$;
