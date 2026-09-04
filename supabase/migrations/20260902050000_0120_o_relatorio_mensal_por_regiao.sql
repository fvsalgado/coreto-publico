-- 0120 — O relatório mensal por região.
--
-- Uma CIM presta contas a quem a financia, e presta-as ao mês: o que a agenda
-- publicou, se as fontes estiveram vivas, o que chegou por email e pelo
-- formulário, em que estado está o catálogo e quantas vezes foi visitado.
-- Tudo isto já existia no painel — em cinco páginas, cada uma a dizer o
-- estado de hoje, nenhuma a dizer o de agosto. O relatório junta-as numa
-- resposta só, por região e por mês, que se imprime e se descarrega.
--
-- ## As visitas não têm data, e é de propósito
--
-- `event_stats` guarda totais de sempre: quatro contadores por evento, sem
-- linha por visita, sem sessão, sem IP, sem data — é essa ausência que
-- sustenta a política de privacidade, e as schema-checks trancam-lhe as
-- colunas. Perguntar-lhe «quantas aberturas em agosto?» não tem resposta, e
-- acrescentar-lhe uma data de visita era trocar a natureza da tabela.
--
-- O que se acrescenta não é uma data de visita. É uma fotografia diária dos
-- totais por concelho — os mesmos números que `event_stats_by_municipality()`
-- já soma, guardados com o dia em que foram lidos. Agosto é a diferença entre
-- a fotografia de 1 de setembro e a de 1 de agosto. Continua a não haver nada
-- de ninguém: são agregados de agregados, por concelho e por dia, e a mesma
-- expressão regular que vigia `event_stats` passa a vigiar esta tabela.
--
-- A fotografia tira-a a recolha noturna, que é a única coisa que corre todas
-- as noites com a chave de serviço na mão — é lá que já se chama
-- `prune_rate_limits`. Uma noite sem fotografia não inventa nada: o mês
-- conta-se entre as duas fotografias mais próximas que existirem, o relatório
-- diz quais foram, e sem duas fotografias diz que não há histórico.
--
-- ## Uma função para o relatório inteiro
--
-- `monthly_report(região, mês)` devolve um JSON só, com as cinco secções.
-- Podia ser cinco leituras da página, uma por tabela; era cinco sítios a
-- recortar por região, cinco a recortar por mês, e cinco maneiras de os dois
-- recortes divergirem. Aqui a fronteira do mês escreve-se uma vez, e a da
-- região também. As fronteiras são à meia-noite do fuso da base (UTC no
-- Supabase): uma hora de diferença de Lisboa no verão, que num relatório
-- mensal não muda nenhuma conclusão.
-- ---------------------------------------------------------------------------

create table public.event_stats_snapshots (
  municipality_id text not null references public.municipalities(id) on delete cascade,
  taken_on        date not null,
  events_counted  bigint not null default 0,
  views           bigint not null default 0,
  ticket_clicks   bigint not null default 0,
  ical_downloads  bigint not null default 0,
  shares          bigint not null default 0,
  clicks          bigint not null default 0,
  primary key (municipality_id, taken_on),
  constraint event_stats_snapshots_non_negative check (
    events_counted >= 0 and views >= 0 and ticket_clicks >= 0
    and ical_downloads >= 0 and shares >= 0 and clicks >= 0
  )
);

comment on table public.event_stats_snapshots is
  'Uma fotografia por dia e por concelho dos totais de `event_stats`, tal como '
  '`event_stats_by_municipality()` os soma. Serve para o relatório mensal dizer '
  'quanto cresceram num mês. Não identifica ninguém: são agregados de '
  'agregados, sem visita, sessão, IP nem data de visita — só o dia em que o '
  'total foi lido. As mesmas asserções que trancam `event_stats` trancam esta.';

comment on column public.event_stats_snapshots.taken_on is
  'O dia em que a fotografia foi tirada (a data da base, em UTC). Um dia, uma '
  'fotografia por concelho: tirar outra no mesmo dia escreve por cima.';

create index event_stats_snapshots_taken_on_idx
  on public.event_stats_snapshots (taken_on);

-- Sem policy nenhuma, de propósito: escreve a chave de serviço, lê a chave de
-- serviço. O público tem os contadores em `event_stats`; a fotografia é
-- matéria do painel, e uma tabela com RLS ligado e sem policies não se lê
-- por nenhuma das chaves públicas.
alter table public.event_stats_snapshots enable row level security;
revoke all on table public.event_stats_snapshots from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A fotografia
-- ---------------------------------------------------------------------------

create function public.snapshot_event_stats()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  insert into public.event_stats_snapshots as s
    (municipality_id, taken_on, events_counted, views, ticket_clicks,
     ical_downloads, shares, clicks)
  select f.municipality_id, current_date, f.events_counted, f.views, f.ticket_clicks,
         f.ical_downloads, f.shares, f.clicks
    from public.event_stats_by_municipality() f
  on conflict (municipality_id, taken_on) do update set
    events_counted = excluded.events_counted,
    views          = excluded.views,
    ticket_clicks  = excluded.ticket_clicks,
    ical_downloads = excluded.ical_downloads,
    shares         = excluded.shares,
    clicks         = excluded.clicks;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

comment on function public.snapshot_event_stats() is
  'Tira a fotografia de hoje: uma linha por concelho com os totais de '
  '`event_stats_by_municipality()`. Chamada pela recolha noturna com a chave '
  'de serviço. Devolve quantas linhas escreveu; duas chamadas no mesmo dia '
  'dão uma fotografia só.';

revoke all on function public.snapshot_event_stats() from public, anon, authenticated;
grant execute on function public.snapshot_event_stats() to service_role;

-- ---------------------------------------------------------------------------
-- O relatório
-- ---------------------------------------------------------------------------

/**
 * O relatório de um mês de uma região, num JSON só. A forma:
 *
 *   {
 *     region: { id, name },
 *     month: 'AAAA-MM',
 *     generated_at: timestamptz,
 *     events: {
 *       published_in_month: [{ municipality_id, municipality_name,
 *                              category_slug, category_name, count }],
 *       happening_in_month: [{ municipality_id, municipality_name, count }],
 *       totals: { published_in_month, happening_in_month, published_now }
 *     },
 *     sources: [{ id, name, municipality_id, is_enabled, runs, failures,
 *                 last_success_at, items_new_in_month }],
 *     submissions: {
 *       received_by_channel: { scraper, email, form },
 *       received,
 *       reviewed: { approved, rejected, other }
 *     },
 *     quality: [{ municipality_id, municipality_name, published, pending,
 *                 in_catalogue, with_time, with_venue, with_image,
 *                 with_description, with_price, with_coordinates }],
 *     visits: { available, from, to,
 *               by_municipality: [{ municipality_id, municipality_name, views,
 *                                   ticket_clicks, ical_downloads, shares,
 *                                   clicks }] }
 *   }
 *
 * O que cada secção conta, e porquê:
 *
 * - `published_in_month` é o que foi ao ar nesse mês (`published_at`) e não
 *   foi retirado por engano — canónico e em qualquer estado que não seja
 *   rascunho nem escondido. Um evento publicado em agosto e cancelado em
 *   setembro foi publicado em agosto; um escondido foi um engano, e não conta.
 *   Por concelho e categoria, só as combinações que existem.
 * - `happening_in_month` é o que está publicado e acontece nesse mês — a
 *   agenda que o público viu —, com todos os concelhos da região, a zero
 *   inclusive: um concelho sem nada é a informação mais acionável de todas.
 * - `sources` são as fontes da região (pelo concelho; sem concelho, pela
 *   `region_id` da 0106) com as execuções começadas no mês. `failures` conta
 *   as que acabaram em `failed`; uma execução parcial não é uma falha.
 * - `submissions` atribuem-se pelo concelho do evento que resultou delas
 *   quando foram aprovadas, e pela região de triagem (`region_id`) quando
 *   não. As recebidas contam-se por `created_at`, as revistas por
 *   `reviewed_at`; `other` são as fundidas, as duplicadas e as que ficaram à
 *   espera de informação. Uma submissão antiga sem região nem evento não é de
 *   ninguém e não conta em lado nenhum.
 * - `quality` é a vista de qualidade tal como está hoje — não tem histórico,
 *   e o relatório di-lo em vez de fingir que é o fim do mês.
 * - `visits` conta entre a última fotografia tirada até ao primeiro dia do
 *   mês (`from`) e a última tirada até ao primeiro dia do mês seguinte
 *   (`to`). Uma fotografia tirada de madrugada é o estado do fim do dia
 *   anterior, e é por isso que as fronteiras são os dias 1 e não o último
 *   dia do mês. Sem uma das duas, ou com as duas iguais, `available` é falso
 *   e as datas dizem o que faltou. Apagar um evento leva os contadores dele
 *   (0017), e a diferença pode encolher: nunca se mostra um número negativo.
 */
create function public.monthly_report(p_region text, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inicio   date;
  v_seguinte date;
  v_fim      date;
  v_regiao   jsonb;
  v_eventos  jsonb;
  v_fontes   jsonb;
  v_sub      jsonb;
  v_qual     jsonb;
  v_de       date;
  v_ate      date;
  v_visitas  jsonb;
begin
  if p_month is null then
    raise exception 'o relatório é de um mês, e o mês não veio';
  end if;

  v_inicio   := date_trunc('month', p_month)::date;
  v_seguinte := (date_trunc('month', p_month) + interval '1 month')::date;
  v_fim      := v_seguinte - 1;

  select jsonb_build_object('id', r.id, 'name', r.name) into v_regiao
    from public.regions r
   where r.id = p_region;
  if v_regiao is null then
    raise exception 'não há região com o identificador %', coalesce(p_region, 'null');
  end if;

  -- ---- Eventos ----
  select jsonb_build_object(
    'published_in_month', coalesce((
      select jsonb_agg(jsonb_build_object(
               'municipality_id',   x.municipality_id,
               'municipality_name', x.municipality_name,
               'category_slug',     x.category_slug,
               'category_name',     x.category_name,
               'count',             x.n)
             order by x.sort_order, x.n desc, x.category_slug)
        from (
          select m.id as municipality_id, m.name as municipality_name, m.sort_order,
                 e.category_slug, c.name as category_name, count(*) as n
            from public.events e
            join public.municipalities m on m.id = e.municipality_id
            left join public.categories c on c.slug = e.category_slug
           where m.region_id = p_region
             and e.is_canonical
             and e.status not in ('draft', 'hidden')
             and e.published_at >= v_inicio
             and e.published_at <  v_seguinte
           group by m.id, m.name, m.sort_order, e.category_slug, c.name
        ) x), '[]'::jsonb),
    'happening_in_month', coalesce((
      select jsonb_agg(jsonb_build_object(
               'municipality_id',   x.municipality_id,
               'municipality_name', x.municipality_name,
               'count',             x.n)
             order by x.sort_order)
        from (
          select m.id as municipality_id, m.name as municipality_name, m.sort_order,
                 count(e.id) as n
            from public.municipalities m
            left join public.events e
              on e.municipality_id = m.id
             and e.is_canonical
             and e.status = 'published'
             and e.date_start <= v_fim
             and coalesce(e.date_end, e.date_start) >= v_inicio
           where m.region_id = p_region
           group by m.id, m.name, m.sort_order
        ) x), '[]'::jsonb),
    'totals', jsonb_build_object(
      'published_in_month', (
        select count(*)
          from public.events e
          join public.municipalities m on m.id = e.municipality_id
         where m.region_id = p_region
           and e.is_canonical
           and e.status not in ('draft', 'hidden')
           and e.published_at >= v_inicio
           and e.published_at <  v_seguinte),
      'happening_in_month', (
        select count(*)
          from public.events e
          join public.municipalities m on m.id = e.municipality_id
         where m.region_id = p_region
           and e.is_canonical
           and e.status = 'published'
           and e.date_start <= v_fim
           and coalesce(e.date_end, e.date_start) >= v_inicio),
      'published_now', (
        select count(*)
          from public.events e
          join public.municipalities m on m.id = e.municipality_id
         where m.region_id = p_region
           and e.is_canonical
           and e.status = 'published')))
    into v_eventos;

  -- ---- Fontes ----
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',                 x.id,
           'name',               x.name,
           'municipality_id',    x.municipality_id,
           'is_enabled',         x.is_enabled,
           'runs',               x.runs,
           'failures',           x.failures,
           'last_success_at',    x.last_success_at,
           'items_new_in_month', x.items_new)
         order by x.sort_order nulls last, x.name), '[]'::jsonb)
    into v_fontes
    from (
      select s.id, s.name, s.municipality_id, s.is_enabled, s.last_success_at, m.sort_order,
             count(r.id)                                    as runs,
             count(r.id) filter (where r.status = 'failed') as failures,
             coalesce(sum(r.items_new), 0)                  as items_new
        from public.sources s
        left join public.municipalities m on m.id = s.municipality_id
        left join public.source_runs r
          on r.source_id = s.id
         and r.started_at >= v_inicio
         and r.started_at <  v_seguinte
       where coalesce(m.region_id, s.region_id) = p_region
       group by s.id, s.name, s.municipality_id, s.is_enabled, s.last_success_at, m.sort_order
    ) x;

  -- ---- Submissões ----
  select jsonb_build_object(
    'received_by_channel', jsonb_build_object(
      'scraper', count(*) filter (where s.channel = 'scraper'
                                    and s.created_at >= v_inicio and s.created_at < v_seguinte),
      'email',   count(*) filter (where s.channel = 'email'
                                    and s.created_at >= v_inicio and s.created_at < v_seguinte),
      'form',    count(*) filter (where s.channel = 'form'
                                    and s.created_at >= v_inicio and s.created_at < v_seguinte)),
    'received', count(*) filter (where s.created_at >= v_inicio and s.created_at < v_seguinte),
    'reviewed', jsonb_build_object(
      'approved', count(*) filter (where s.status = 'approved'
                                     and s.reviewed_at >= v_inicio and s.reviewed_at < v_seguinte),
      'rejected', count(*) filter (where s.status = 'rejected'
                                     and s.reviewed_at >= v_inicio and s.reviewed_at < v_seguinte),
      'other',    count(*) filter (where s.status not in ('approved', 'rejected')
                                     and s.reviewed_at >= v_inicio and s.reviewed_at < v_seguinte)))
    into v_sub
    from public.submissions s
    left join public.events e on e.id = s.resulting_event_id
    left join public.municipalities m on m.id = e.municipality_id
   where coalesce(m.region_id, s.region_id) = p_region
     and ((s.created_at  >= v_inicio and s.created_at  < v_seguinte)
       or (s.reviewed_at >= v_inicio and s.reviewed_at < v_seguinte));

  -- ---- Qualidade ----
  select coalesce(jsonb_agg(jsonb_build_object(
           'municipality_id',   q.municipality_id,
           'municipality_name', q.municipality_name,
           'published',         q.published,
           'pending',           q.pending,
           'in_catalogue',      q.in_catalogue,
           'with_time',         q.with_time,
           'with_venue',        q.with_venue,
           'with_image',        q.with_image,
           'with_description',  q.with_description,
           'with_price',        q.with_price,
           'with_coordinates',  q.with_coordinates)
         order by m.sort_order), '[]'::jsonb)
    into v_qual
    from public.event_quality_by_municipality q
    join public.municipalities m on m.id = q.municipality_id
   where q.region_id = p_region;

  -- ---- Visitas ----
  select max(s.taken_on) into v_de
    from public.event_stats_snapshots s
    join public.municipalities m on m.id = s.municipality_id
   where m.region_id = p_region
     and s.taken_on <= v_inicio;

  select max(s.taken_on) into v_ate
    from public.event_stats_snapshots s
    join public.municipalities m on m.id = s.municipality_id
   where m.region_id = p_region
     and s.taken_on <= v_seguinte;

  if v_de is not null and v_ate is not null and v_de < v_ate then
    select jsonb_build_object(
      'available', true,
      'from',      v_de,
      'to',        v_ate,
      'by_municipality', coalesce(jsonb_agg(jsonb_build_object(
        'municipality_id',   m.id,
        'municipality_name', m.name,
        'views',          greatest(coalesce(fim.views, 0)          - coalesce(ini.views, 0), 0),
        'ticket_clicks',  greatest(coalesce(fim.ticket_clicks, 0)  - coalesce(ini.ticket_clicks, 0), 0),
        'ical_downloads', greatest(coalesce(fim.ical_downloads, 0) - coalesce(ini.ical_downloads, 0), 0),
        'shares',         greatest(coalesce(fim.shares, 0)         - coalesce(ini.shares, 0), 0),
        'clicks',         greatest(coalesce(fim.clicks, 0)         - coalesce(ini.clicks, 0), 0))
        order by m.sort_order), '[]'::jsonb))
      into v_visitas
      from public.municipalities m
      left join public.event_stats_snapshots ini
        on ini.municipality_id = m.id and ini.taken_on = v_de
      left join public.event_stats_snapshots fim
        on fim.municipality_id = m.id and fim.taken_on = v_ate
     where m.region_id = p_region;
  else
    v_visitas := jsonb_build_object(
      'available', false,
      'from',      v_de,
      'to',        v_ate,
      'by_municipality', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'region',       v_regiao,
    'month',        to_char(v_inicio, 'YYYY-MM'),
    'generated_at', now(),
    'events',       v_eventos,
    'sources',      v_fontes,
    'submissions',  v_sub,
    'quality',      v_qual,
    'visits',       v_visitas);
end;
$$;

comment on function public.monthly_report(text, date) is
  'O relatório de um mês de uma região, num JSON só: eventos publicados e a '
  'decorrer, fontes e execuções, submissões recebidas e revistas, qualidade do '
  'catálogo e visitas entre duas fotografias. Lê-se pela chave de serviço, no '
  'painel (/admin/relatorios) e nas suas exportações. A forma está documentada '
  'na migração 0120 e em `apps/web/src/lib/admin/relatorio.ts`.';

revoke all on function public.monthly_report(text, date) from public, anon, authenticated;
grant execute on function public.monthly_report(text, date) to service_role;

-- ---------------------------------------------------------------------------
-- A primeira fotografia, e a rede de segurança desta migração
-- ---------------------------------------------------------------------------
do $$
declare
  n          integer;
  v_concelhos integer;
  v_regiao   text;
  v_relatorio jsonb;
begin
  select count(*) into v_concelhos from public.municipalities;

  -- A primeira fotografia tira-se já: é a partir dela que o primeiro mês se
  -- vai poder contar. Uma linha por concelho, nem mais nem menos.
  n := public.snapshot_event_stats();
  if n <> v_concelhos then
    raise exception 'a fotografia escreveu % linhas para % concelhos', n, v_concelhos;
  end if;

  -- Tirar duas no mesmo dia é uma só: a segunda escreve por cima.
  perform public.snapshot_event_stats();
  select count(*) into n from public.event_stats_snapshots where taken_on = current_date;
  if n <> v_concelhos then
    raise exception 'duas fotografias no mesmo dia deixaram % linhas para % concelhos', n, v_concelhos;
  end if;

  -- Só a chave de serviço escreve e lê.
  if has_function_privilege('anon', 'public.snapshot_event_stats()', 'execute')
     or has_function_privilege('authenticated', 'public.snapshot_event_stats()', 'execute')
     or has_function_privilege('anon', 'public.monthly_report(text, date)', 'execute')
     or has_function_privilege('authenticated', 'public.monthly_report(text, date)', 'execute')
  then
    raise exception 'as funções do relatório ficaram executáveis pelo público';
  end if;
  if has_table_privilege('anon', 'public.event_stats_snapshots', 'select')
     or has_table_privilege('authenticated', 'public.event_stats_snapshots', 'select')
  then
    raise exception 'as fotografias dos contadores ficaram legíveis pelo público';
  end if;

  -- O relatório de cada região responde com a forma prometida, mesmo num mês
  -- em que não aconteceu nada — e uma fotografia só não chega para contar um
  -- mês, e é isso que ele tem de dizer.
  for v_regiao in select id from public.regions order by sort_order loop
    v_relatorio := public.monthly_report(v_regiao, date_trunc('month', current_date)::date);

    if not (v_relatorio ?& array['region', 'month', 'generated_at', 'events', 'sources',
                                 'submissions', 'quality', 'visits']) then
      raise exception 'o relatório de % não tem a forma prometida: %', v_regiao, v_relatorio;
    end if;
    if v_relatorio #>> '{region,id}' is distinct from v_regiao then
      raise exception 'o relatório de % diz ser de %', v_regiao, v_relatorio #>> '{region,id}';
    end if;
    if v_relatorio ->> 'month' <> to_char(current_date, 'YYYY-MM') then
      raise exception 'o relatório de % é do mês «%»', v_regiao, v_relatorio ->> 'month';
    end if;

    select count(*) into n from public.municipalities where region_id = v_regiao;
    if jsonb_array_length(v_relatorio -> 'quality') <> n
       or jsonb_array_length(v_relatorio #> '{events,happening_in_month}') <> n
    then
      raise exception 'o relatório de % não tem uma linha por concelho', v_regiao;
    end if;

    if (v_relatorio #>> '{visits,available}') <> 'false' then
      raise exception 'uma fotografia só não chega para contar um mês, e o relatório de % conta', v_regiao;
    end if;
  end loop;

  -- Uma região que não existe é um erro, não um relatório vazio.
  begin
    perform public.monthly_report('regiao-que-nao-existe', current_date);
    raise exception 'monthly_report aceitou uma região que não existe';
  exception when others then
    if sqlerrm = 'monthly_report aceitou uma região que não existe' then raise; end if;
  end;
end
$$;
