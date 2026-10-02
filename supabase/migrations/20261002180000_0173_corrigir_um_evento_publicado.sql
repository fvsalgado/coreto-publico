-- 0173 — Corrigir um evento publicado, pelo painel e com rasto.
--
-- Não havia onde. O painel aprovava propostas e mudava estados em lote, e a
-- hora errada, o preço que faltou ou o espaço trocado de um evento já
-- publicado corrigiam-se por SQL — o caminho sem auditoria, sem validação e
-- sem cadeado contra a recolha (C4-017). É o que permite dizer a uma câmara
-- «se a agenda tiver um erro, corrigimos hoje» sem que isso queira dizer que
-- alguém escreve na base de produção à mão.
--
-- A disciplina é a da `update_region` (`docs/plano/07-painel.md` §11):
--
--   * uma lista fechada de colunas — as do formulário do painel, que são as
--     de `EDITABLE_FIELDS` (`apps/web/src/lib/admin/fields.ts`) mais o «em
--     cartaz». O endereço (`slug`) não está nela de propósito: já pode ter
--     sido partilhado. Nem o estado, que tem a sua função (`set_event_status`);
--   * a comparação do lado da base: só o que mudou se escreve, se tranca e se
--     regista;
--   * uma linha `event.update` na auditoria, com o antes e o depois do que
--     mudou e mais nada;
--   * o cadeado: cada campo mudado entra em `manual_overrides`, e a recolha
--     da noite seguinte não lhe volta a escrever por cima (0015).
--
-- **As datas também se trancam.** As sessões não são uma coluna de `events`,
-- e por isso o `applyManualLocks` da recolha nunca as protegeu: corrigir a hora
-- de um evento de uma fonte durava até à noite seguinte. Uma correção de datas
-- grava o cadeado `sessions`, que a recolha passa a respeitar
-- (`packages/ingest/src/pipeline.ts`, `CADEADO_DAS_SESSOES`). As sessões que
-- ficam guardam o que tinham além do dia e da hora — cancelada, outro espaço,
-- notas —; só as que saem saem, e só as novas entram.
--
-- Seguro para o sítio de hoje: uma função nova, que o sítio publicado não
-- chama.

create or replace function public.update_event(
  p_event_id uuid,
  p_patch    jsonb,
  p_sessions jsonb,
  p_actor    text,
  p_ip_hash  text default null
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corrigiveis constant text[] := array[
    'title', 'subtitle', 'description', 'municipality_id', 'venue_id', 'location_name',
    'parish', 'how_to_arrive', 'category_slug', 'series_id', 'is_free', 'price_display',
    'ticketing_url', 'image_url', 'accessibility_notes', 'is_ongoing'
  ];
  v_antes          jsonb;
  v_campo          text;
  v_novo           jsonb;
  v_mudados        text[] := '{}';
  v_de             jsonb := '{}'::jsonb;
  v_para           jsonb := '{}'::jsonb;
  v_sessoes_antes  jsonb;
  v_sessoes_novas  jsonb;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se corrige evento nenhum';
  end if;

  select to_jsonb(e) into v_antes from public.events e where e.id = p_event_id for update;
  if v_antes is null then
    raise exception 'este evento já não existe';
  end if;
  if v_antes ->> 'status' = 'archived' then
    raise exception 'este evento está arquivado — já não aparece em lado nenhum, e corrigi-lo não muda nada';
  end if;

  -- O que mudou, campo a campo. Um campo que o formulário não mandou não foi
  -- decidido por ninguém, e fica como está.
  for v_campo in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if not (v_campo = any (v_corrigiveis)) then
      raise exception 'o campo % não se corrige aqui', v_campo;
    end if;
    v_novo := p_patch -> v_campo;
    -- Texto vazio é «sem valor»: um formulário não tem como mandar nulo.
    if jsonb_typeof(v_novo) = 'string' and btrim(v_novo #>> '{}') = '' then
      v_novo := 'null'::jsonb;
    end if;
    if v_novo is distinct from coalesce(v_antes -> v_campo, 'null'::jsonb) then
      v_mudados := v_mudados || v_campo;
      v_de := v_de || jsonb_build_object(v_campo, v_antes -> v_campo);
      v_para := v_para || jsonb_build_object(v_campo, v_novo);
    end if;
  end loop;

  if 'title' = any (v_mudados) and v_para ->> 'title' is null then
    raise exception 'o título não pode ficar vazio';
  end if;
  if 'municipality_id' = any (v_mudados) and v_para ->> 'municipality_id' is null then
    raise exception 'um evento tem de ter concelho';
  end if;
  if coalesce(case when 'venue_id' = any (v_mudados) then v_para ->> 'venue_id' else v_antes ->> 'venue_id' end,
              case when 'location_name' = any (v_mudados) then v_para ->> 'location_name' else v_antes ->> 'location_name' end)
     is null then
    raise exception 'um evento tem de dizer onde é: escolhe um espaço, ou escreve o local livre';
  end if;

  if array_length(v_mudados, 1) > 0 then
    update public.events e set
      title               = case when 'title' = any (v_mudados) then v_para ->> 'title' else e.title end,
      subtitle            = case when 'subtitle' = any (v_mudados) then v_para ->> 'subtitle' else e.subtitle end,
      description         = case when 'description' = any (v_mudados) then v_para ->> 'description' else e.description end,
      municipality_id     = case when 'municipality_id' = any (v_mudados) then v_para ->> 'municipality_id' else e.municipality_id end,
      venue_id            = case when 'venue_id' = any (v_mudados) then v_para ->> 'venue_id' else e.venue_id end,
      location_name       = case when 'location_name' = any (v_mudados) then v_para ->> 'location_name' else e.location_name end,
      parish              = case when 'parish' = any (v_mudados) then v_para ->> 'parish' else e.parish end,
      how_to_arrive       = case when 'how_to_arrive' = any (v_mudados) then v_para ->> 'how_to_arrive' else e.how_to_arrive end,
      category_slug       = case when 'category_slug' = any (v_mudados) then v_para ->> 'category_slug' else e.category_slug end,
      series_id           = case when 'series_id' = any (v_mudados) then v_para ->> 'series_id' else e.series_id end,
      is_free             = case when 'is_free' = any (v_mudados) then coalesce((v_para ->> 'is_free')::boolean, false) else e.is_free end,
      price_display       = case when 'price_display' = any (v_mudados) then v_para ->> 'price_display' else e.price_display end,
      ticketing_url       = case when 'ticketing_url' = any (v_mudados) then v_para ->> 'ticketing_url' else e.ticketing_url end,
      image_url           = case when 'image_url' = any (v_mudados) then v_para ->> 'image_url' else e.image_url end,
      accessibility_notes = case when 'accessibility_notes' = any (v_mudados) then v_para ->> 'accessibility_notes' else e.accessibility_notes end,
      is_ongoing          = case when 'is_ongoing' = any (v_mudados) then coalesce((v_para ->> 'is_ongoing')::boolean, false) else e.is_ongoing end,
      -- Cartaz diferente, medidas esquecidas — como na `approve_submission`
      -- (0126): o navegador reservava a caixa de uma imagem para receber outra.
      image_width         = case when 'image_url' = any (v_mudados) then null else e.image_width end,
      image_height        = case when 'image_url' = any (v_mudados) then null else e.image_height end,
      -- E a cópia nossa do cartaz antigo deixa de valer (0162): o que se serve
      -- passa a ser o endereço novo, creditado a ele mesmo, e as listas
      -- deixam de mostrar a miniatura do cartaz que saiu.
      image_origem        = case when 'image_url' = any (v_mudados) then v_para ->> 'image_url' else e.image_origem end,
      image_miniatura     = case when 'image_url' = any (v_mudados) then null else e.image_miniatura end,
      image_guardado_em   = case when 'image_url' = any (v_mudados) then null else e.image_guardado_em end
     where e.id = p_event_id;
  end if;

  -- As datas: só se o formulário as mandou, e só se mudaram.
  if p_sessions is not null then
    with novas as (
      select distinct on (x.d, coalesce(x.h, '00:00'::time)) x.d, x.h, x.f
        from (
          select (s ->> 'session_date')::date as d,
                 nullif(s ->> 'start_time', '')::time as h,
                 nullif(s ->> 'end_time', '')::time as f
            from jsonb_array_elements(p_sessions) s
           where coalesce(s ->> 'session_date', '') <> ''
        ) x
       order by x.d, coalesce(x.h, '00:00'::time), x.f nulls last
    )
    select coalesce(jsonb_agg(jsonb_build_object('session_date', n.d, 'start_time', n.h, 'end_time', n.f)
                              order by n.d, n.h nulls first), '[]'::jsonb)
      into v_sessoes_novas
      from novas n;

    if jsonb_array_length(v_sessoes_novas) = 0 then
      raise exception 'um evento sem data nenhuma não aparece em lista nenhuma — marca pelo menos um dia';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('session_date', s.session_date, 'start_time', s.start_time,
                                                 'end_time', s.end_time)
                              order by s.session_date, s.start_time nulls first), '[]'::jsonb)
      into v_sessoes_antes
      from public.event_sessions s
     where s.event_id = p_event_id;

    if v_sessoes_novas is distinct from v_sessoes_antes then
      -- Saem as que deixaram de estar; as que ficam guardam o resto do que
      -- tinham (cancelada, outro espaço, notas); entram as novas.
      delete from public.event_sessions s
       where s.event_id = p_event_id
         and not exists (
           select 1 from jsonb_array_elements(v_sessoes_novas) n
            where (n ->> 'session_date')::date = s.session_date
              and coalesce((n ->> 'start_time')::time, '00:00'::time) = coalesce(s.start_time, '00:00'::time)
         );
      insert into public.event_sessions (event_id, session_date, start_time, end_time)
      select p_event_id, (n ->> 'session_date')::date, (n ->> 'start_time')::time, (n ->> 'end_time')::time
        from jsonb_array_elements(v_sessoes_novas) n
      on conflict (event_id, session_date, coalesce(start_time, '00:00'::time))
        do update set end_time = excluded.end_time;

      v_mudados := v_mudados || 'sessions'::text;
      v_de := v_de || jsonb_build_object('sessions', v_sessoes_antes);
      v_para := v_para || jsonb_build_object('sessions', v_sessoes_novas);
    end if;
  end if;

  if array_length(v_mudados, 1) is null then
    return v_mudados;
  end if;

  -- O cadeado: o que uma pessoa corrigiu não volta a ser pisado pela recolha.
  -- O valor guardado é o de depois, para o painel poder mostrar «a fonte diz
  -- X, nós dizemos Y».
  foreach v_campo in array v_mudados loop
    insert into public.manual_overrides (event_id, field, value, actor, note)
    values (p_event_id, v_campo, v_para -> v_campo, p_actor, 'corrigido no painel')
    on conflict (event_id, field) do update set
      value = excluded.value,
      actor = excluded.actor,
      note = excluded.note,
      created_at = now();
  end loop;
  update public.events set has_manual_overrides = true where id = p_event_id;

  perform public.log_admin_action(
    p_actor, 'event.update', 'event', p_event_id::text, v_de, v_para, p_ip_hash
  );

  return v_mudados;
end;
$$;

comment on function public.update_event(uuid, jsonb, jsonb, text, text) is
  'Corrige um evento pelo painel: lista fechada de colunas, só o que mudou se '
  'escreve, tranca contra a recolha (incluindo as datas, com o cadeado sessions) '
  'e deixa a linha event.update com o antes e o depois. Devolve os campos mudados.';

revoke all on function public.update_event(uuid, jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.update_event(uuid, jsonb, jsonb, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- As provas, numa transação que se desfaz
-- ---------------------------------------------------------------------------
do $$
declare
  v_concelho text;
  v_espaco   text;
  v_evento   uuid;
  v_mudados  text[];
  v_recusou  boolean;
  n          integer;
begin
  select v.municipality_id, v.id into v_concelho, v_espaco
    from public.venues v order by v.municipality_id, v.id limit 1;
  if v_concelho is null then
    raise exception using errcode = 'DEADA', message = 'sem espaços: nada para provar';
  end if;

  insert into public.events (slug, title, municipality_id, venue_id, status, fingerprint, date_start)
  values ('prova-0173', 'Concerto de Outono', v_concelho, v_espaco, 'published', 'prova-0173',
          date '2031-10-10')
  returning id into v_evento;
  insert into public.event_sessions (event_id, session_date, start_time, notes)
  values (v_evento, date '2031-10-10', time '21:30', 'nota que tem de ficar'),
         (v_evento, date '2031-10-11', time '21:30', null);

  -- Nada mudou: nada se escreve, nada se tranca, nada se regista.
  v_mudados := public.update_event(v_evento, jsonb_build_object('title', 'Concerto de Outono'),
    '[{"session_date":"2031-10-10","start_time":"21:30"},{"session_date":"2031-10-11","start_time":"21:30"}]'::jsonb,
    'prova-0173');
  assert coalesce(array_length(v_mudados, 1), 0) = 0,
    format('sem mudanças, a função devolveu %s', v_mudados);
  assert not exists (select 1 from public.manual_overrides where event_id = v_evento),
    'sem mudanças, ficou um cadeado';

  -- A hora de uma sessão e o preço: só esses mudam, ficam trancados e
  -- registados; a nota da sessão que fica não se perde.
  v_mudados := public.update_event(v_evento, jsonb_build_object('price_display', '5 €', 'title', 'Concerto de Outono'),
    '[{"session_date":"2031-10-10","start_time":"21:30"},{"session_date":"2031-10-11","start_time":"18:00"}]'::jsonb,
    'prova-0173');
  assert v_mudados = array['price_display', 'sessions'],
    format('mudou o preço e as datas, a função devolveu %s', v_mudados);
  assert (select price_display from public.events where id = v_evento) = '5 €', 'o preço não ficou';
  assert (select count(*) from public.event_sessions where event_id = v_evento and start_time = time '18:00') = 1,
    'a hora nova não entrou';
  assert (select count(*) from public.event_sessions where event_id = v_evento) = 2,
    'ficaram sessões a mais ou a menos';
  assert (select notes from public.event_sessions where event_id = v_evento and session_date = date '2031-10-10')
         = 'nota que tem de ficar',
    'a sessão que ficou perdeu a nota';
  select count(*) into n from public.manual_overrides
   where event_id = v_evento and field in ('price_display', 'sessions');
  assert n = 2, format('os cadeados não ficaram (%s)', n);
  assert exists (select 1 from public.admin_actions
                  where action = 'event.update' and entity_id = v_evento::text
                    and before ? 'price_display' and after ->> 'price_display' = '5 €'
                    and not (after ? 'title')),
    'a auditoria não diz só o que mudou';

  -- O endereço não se corrige aqui, e um evento sem data não se grava.
  v_recusou := false;
  begin
    perform public.update_event(v_evento, jsonb_build_object('slug', 'outro'), null, 'prova-0173');
  exception when raise_exception then v_recusou := true;
  end;
  assert v_recusou, 'o slug corrigiu-se';
  v_recusou := false;
  begin
    perform public.update_event(v_evento, '{}'::jsonb, '[]'::jsonb, 'prova-0173');
  exception when raise_exception then v_recusou := true;
  end;
  assert v_recusou, 'um evento ficou sem datas';

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
