-- 0142 — O relatório mensal leva os dois cliques novos, e diz desde quando.
--
-- A 0141 pôs a contar o clique em «Página oficial» e em «como chegar». Esta põe
-- os dois no relatório mensal, com o cuidado que a 0141 preparou: as
-- fotografias anteriores a ela não têm estas colunas, e a diferença de um mês
-- em que uma das pontas não tem o número sai a **nulo**.
--
-- Zero seria dizer que ninguém carregou. Ninguém carregou porque não havia
-- botão que contasse, e num relatório entregue a uma CIM a diferença entre as
-- duas frases é toda.
--
-- E para a frase ficar completa, `visits.clicks_since` traz o dia da primeira
-- fotografia que tem os contadores. É o que deixa a página escrever «a partir
-- de 14 de setembro» em vez de deixar um nulo por explicar.
--
-- A função é reescrita por inteiro porque é o que um `create or replace` de
-- plpgsql obriga; o que muda é uma variável, duas contagens e uma chave.

create or replace function public.monthly_report(p_region text, p_month date)
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
  v_terra    jsonb;
  v_desde    date;
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

  -- ---- Território ----
  -- Contagens, e mais nada. A percentagem é uma leitura, e quem recebe o
  -- relatório faz a sua — é a regra que o `paraCsv` já escreve em comentário.
  --
  -- `parishes` fica a **nulo** se um único concelho da região não tiver as
  -- freguesias contadas. Somar os que têm dava um denominador silenciosamente
  -- menor, e uma fração com o denominador a menos é a mentira mais barata que
  -- há: faz o numerador parecer maior sem ninguém escrever nada de falso.
  select jsonb_build_object(
    'municipalities', count(*),
    'parishes', case when count(*) filter (where m.parish_count is null) = 0
                     then sum(m.parish_count) end,
    'municipal_sources_enabled', (
      select count(*) from public.sources s
        join public.municipalities x on x.id = s.municipality_id
       where x.region_id = p_region and s.kind = 'municipal_site' and s.is_enabled),
    'parish_sources_enabled', (
      select count(*) from public.sources s
        join public.municipalities x on x.id = s.municipality_id
       where x.region_id = p_region and s.kind = 'parish_site' and s.is_enabled))
    into v_terra
    from public.municipalities m
   where m.region_id = p_region;

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

  -- A primeira fotografia que traz os contadores da 0141. Antes dela não há
  -- número: a diferença sai a nulo e o relatório diz «a partir de», em vez de
  -- mostrar um zero que se lê como «ninguém carregou».
  select min(s.taken_on) into v_desde
    from public.event_stats_snapshots s
    join public.municipalities m on m.id = s.municipality_id
   where m.region_id = p_region
     and s.source_clicks is not null;

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
      'clicks_since', v_desde,
      'by_municipality', coalesce(jsonb_agg(jsonb_build_object(
        'municipality_id',   m.id,
        'municipality_name', m.name,
        'views',          greatest(coalesce(fim.views, 0)          - coalesce(ini.views, 0), 0),
        'ticket_clicks',  greatest(coalesce(fim.ticket_clicks, 0)  - coalesce(ini.ticket_clicks, 0), 0),
        'ical_downloads', greatest(coalesce(fim.ical_downloads, 0) - coalesce(ini.ical_downloads, 0), 0),
        'shares',         greatest(coalesce(fim.shares, 0)         - coalesce(ini.shares, 0), 0),
        'clicks',         greatest(coalesce(fim.clicks, 0)         - coalesce(ini.clicks, 0), 0),
        -- Nulo quando um dos lados não tem o contador: «não medi» e «ninguém
        -- carregou» são respostas diferentes, e num relatório entregue a
        -- diferença é a que interessa.
        'source_clicks', case when ini.source_clicks is null or fim.source_clicks is null then null
                              else greatest(fim.source_clicks - ini.source_clicks, 0) end,
        'directions_clicks', case when ini.directions_clicks is null or fim.directions_clicks is null then null
                                  else greatest(fim.directions_clicks - ini.directions_clicks, 0) end)
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
      'clicks_since', v_desde,
      'by_municipality', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'region',       v_regiao,
    'month',        to_char(v_inicio, 'YYYY-MM'),
    'generated_at', now(),
    'events',       v_eventos,
    'sources',      v_fontes,
    'territory',    v_terra,
    'submissions',  v_sub,
    'quality',      v_qual,
    'visits',       v_visitas);
end;
$$;

-- ---------------------------------------------------------------------------
-- As provas
-- ---------------------------------------------------------------------------
do $$
declare
  v jsonb;
  v_linha jsonb;
begin
  -- Duas fotografias, a primeira sem os contadores novos (como as que já
  -- existiam) e a segunda com eles: a diferença tem de sair a nulo.
  insert into public.event_stats_snapshots
    (municipality_id, taken_on, events_counted, views, ticket_clicks,
     ical_downloads, shares, clicks, source_clicks, directions_clicks)
  values ('tomar', date_trunc('month', current_date)::date, 1, 10, 0, 0, 0, 0, null, null),
         ('tomar', (date_trunc('month', current_date) + interval '1 month')::date,
          1, 20, 0, 0, 0, 0, 7, 3)
  on conflict (municipality_id, taken_on) do update set
    views = excluded.views, source_clicks = excluded.source_clicks,
    directions_clicks = excluded.directions_clicks;

  v := public.monthly_report('medio-tejo', current_date) -> 'visits';
  assert (v ->> 'available') = 'true', 'as duas fotografias de prova não deram histórico';

  select valor into v_linha
    from jsonb_array_elements(v -> 'by_municipality') as e(valor)
   where valor ->> 'municipality_id' = 'tomar';

  assert v_linha -> 'source_clicks' = 'null'::jsonb,
    format('com a primeira fotografia sem o contador, a diferença devia ser nula e foi %s',
           v_linha ->> 'source_clicks');
  assert (v_linha ->> 'views')::integer = 10,
    format('as aberturas deviam contar 10 e contaram %s', v_linha ->> 'views');

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
