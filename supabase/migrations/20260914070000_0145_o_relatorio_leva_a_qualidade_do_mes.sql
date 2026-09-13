-- 0145 — O relatório do mês passa a levar a qualidade do mês.
--
-- A 0144 deu memória à medida de qualidade. Esta migração é o que a usa, e é
-- também a que apaga uma ressalva publicada: a legenda de
-- `/admin/relatorios` dizia, por escrito, «é o catálogo tal como está hoje, e
-- não como estava no fim do mês: a medida de qualidade não guarda histórico,
-- e o relatório prefere dizê-lo a fingir». Estava certa quando foi escrita.
-- Deixa de estar assim que houver fotografias.
--
-- O relatório passa a levar a **última fotografia tirada dentro do mês** — o
-- estado com que o mês fechou. Não uma média dos dias: a média de uma medida
-- de completude não é a completude de dia nenhum, e o que se quer saber de um
-- mês fechado é como acabou.
--
-- **`quality_as_of` é o que impede isto de mentir.** Traz a data da
-- fotografia, ou nulo quando não houve nenhuma nesse mês — e aí a qualidade
-- continua a ser a de hoje, exatamente como antes, e a página continua a
-- dizê-lo. É a mesma forma que a 0142 deu ao `clicks_since`: o relatório
-- prefere escrever «a partir de» a mostrar um número que não mediu.
--
-- Os meses anteriores à 0144 ficam sem fotografia para sempre, e é o que
-- deve ser: recuar a de hoje para julho era escrever sobre julho um número
-- que ninguém leu em julho.
--
-- A função é refeita por inteiro e não remendada: o `create or replace` de
-- uma função em plpgsql substitui o corpo todo, e um corpo parcial não é
-- corpo nenhum. O texto vem da 0142, com o bloco de qualidade trocado e a
-- chave nova na cauda do objeto — a cauda, para que quem lê por nome não
-- parta.

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
  v_qual_de  date;
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
  --
  -- Até à 0144 isto lia sempre a vista, e a legenda do relatório dizia-o: «é
  -- o catálogo tal como está hoje, e não como estava no fim do mês». Um
  -- relatório de julho aberto em novembro mostrava números de novembro.
  --
  -- Agora há fotografias. A do mês é a **última tirada dentro do mês** — o
  -- estado com que o mês fechou, não uma média nem a primeira — e é essa que
  -- o relatório leva. `v_qual_de` diz a data dela, e é o que permite à página
  -- escrever «no dia 31» em vez de deixar quem lê supor.
  --
  -- Sem fotografia nenhuma dentro do mês, `v_qual_de` fica a nulo e a
  -- qualidade é a de hoje, como antes. É o caso dos meses anteriores à 0144:
  -- não há como saber como estavam, e inventar uma fotografia recuando a de
  -- hoje seria escrever sobre um mês um número que ninguém leu nele.
  select max(taken_on) into v_qual_de
    from public.event_quality_snapshots s
    join public.municipalities m on m.id = s.municipality_id
   where m.region_id = p_region
     and s.taken_on >= v_inicio and s.taken_on < v_seguinte;

  if v_qual_de is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'municipality_id',   s.municipality_id,
             'municipality_name', m.name,
             'published',         s.published,
             'pending',           s.pending,
             'in_catalogue',      s.in_catalogue,
             'with_time',         s.with_time,
             'with_venue',        s.with_venue,
             'with_image',        s.with_image,
             'with_description',  s.with_description,
             'with_price',        s.with_price,
             'with_coordinates',  s.with_coordinates)
           order by m.sort_order), '[]'::jsonb)
      into v_qual
      from public.event_quality_snapshots s
      join public.municipalities m on m.id = s.municipality_id
     where m.region_id = p_region and s.taken_on = v_qual_de;
  else
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
  end if;

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
    'quality_as_of', v_qual_de,
    'visits',       v_visitas);
end;
$$;

-- ---------------------------------------------------------------------------
-- As provas
-- ---------------------------------------------------------------------------
do $$
declare
  v_rel      jsonb;
  v_mes      date;
  v_concelho text;
  v_antes    bigint;
begin
  v_mes := date_trunc('month', current_date)::date;

  -- Sem fotografia no mês, a qualidade é a de hoje e a data sai a nulo.
  delete from public.event_quality_snapshots
   where taken_on >= v_mes and taken_on < (v_mes + interval '1 month')::date;

  v_rel := public.monthly_report('medio-tejo', v_mes);
  if v_rel -> 'quality_as_of' <> 'null'::jsonb then
    raise exception 'sem fotografia no mês, quality_as_of devia vir a nulo e veio %',
      v_rel -> 'quality_as_of';
  end if;

  -- Com fotografia, a qualidade é a da fotografia — e prova-se mexendo na
  -- fotografia e não no catálogo: se o relatório mudar, é porque a leu.
  perform public.snapshot_event_quality();

  select q ->> 'municipality_id', (q ->> 'in_catalogue')::bigint
    into v_concelho, v_antes
    from jsonb_array_elements(public.monthly_report('medio-tejo', v_mes) -> 'quality') as q
   limit 1;
  if v_concelho is null then
    raise exception 'o relatório do Médio Tejo veio sem concelho nenhum na qualidade';
  end if;

  update public.event_quality_snapshots
     set in_catalogue = in_catalogue + 7, pending = pending + 7
   where municipality_id = v_concelho and taken_on = current_date;

  v_rel := public.monthly_report('medio-tejo', v_mes);
  if (v_rel ->> 'quality_as_of')::date <> current_date then
    raise exception 'com fotografia no mês, quality_as_of devia ser hoje e veio %',
      v_rel ->> 'quality_as_of';
  end if;
  if (select (q ->> 'in_catalogue')::bigint
        from jsonb_array_elements(v_rel -> 'quality') as q
       where q ->> 'municipality_id' = v_concelho) <> v_antes + 7 then
    raise exception 'o relatório continua a ler a vista em vez da fotografia do mês';
  end if;

  -- E a fotografia de um mês não se empresta a outro. A de hoje não pode
  -- aparecer no relatório do mês passado.
  v_rel := public.monthly_report('medio-tejo', (v_mes - interval '1 month')::date);
  if v_rel -> 'quality_as_of' <> 'null'::jsonb then
    raise exception 'a fotografia de hoje apareceu no relatório do mês passado, com data %',
      v_rel -> 'quality_as_of';
  end if;

  -- A prova não deixa a base torta: a fotografia volta ao que a vista diz.
  perform public.snapshot_event_quality();
end
$$;
