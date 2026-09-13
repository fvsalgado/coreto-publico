-- 0147 — O relatório leva as comparações.
--
-- A 0146 escreveu as duas peças: `region_observed_since`, que diz desde
-- quando se pode afirmar alguma coisa sobre uma região, e `report_totals`,
-- que conta uma janela. Esta migração é a que as põe no relatório.
--
-- O bloco novo vai na **cauda** do objeto, para que nada do que já lê por
-- nome parta, e traz cinco chaves: a data de observação, o mês corrente, o
-- mês anterior, o mês homólogo e o acumulado do ano.
--
-- **Três delas podem vir a nulo, e é a parte que interessa.** O Médio Tejo
-- tem registo desde 28 de agosto de 2026. O mês anterior a setembro começa a
-- 1 de agosto — antes de estarmos a olhar — e por isso o relatório de
-- setembro sai com `previous_month: null`: o agosto que há são quatro dias, e
-- um crescimento calculado sobre eles mede a data em que o projeto começou.
-- O homólogo de setembro de 2025 é nulo pela mesma razão, e vai continuar a
-- sê-lo até setembro de 2027.
--
-- Isto quer dizer que o primeiro relatório com comparações a sério é o de
-- outubro de 2026. Escreve-se aqui para que ninguém, ao vê-lo vazio, o tome
-- por uma avaria.
--
-- O `current` é redundante com os totais que o relatório já publica, e é
-- redundante de propósito: é o que permite à página pôr os dois lados da
-- comparação lado a lado sem os ir buscar a sítios diferentes, e a prova da
-- 0146 confirma que os dois caminhos dão o mesmo número.
--
-- A função é refeita por inteiro: o `create or replace` de uma função em
-- plpgsql substitui o corpo todo. O texto vem da 0145.

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
  v_desde_r  date;
  v_comp     jsonb;
  v_ano_de   date;
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

  -- ---- Comparações ----
  --
  -- Um número sozinho não responde à pergunta para que o relatório foi
  -- pedido. «128 eventos em setembro» não diz se setembro foi bom; «128,
  -- contra 94 em agosto» diz.
  --
  -- **Só se compara um mês que tenha sido observado por inteiro.** A data em
  -- que a região passou a ser observada decide-o: um mês que começou antes
  -- dela foi visto em parte, e dividir por ele mede a data em que o projeto
  -- começou. Aí sai `null`, e a página escreve «sem comparação» — a regra que
  -- as visitas seguem desde a 0120, aplicada a mais um sítio.
  --
  -- Os quatro blocos saem de `report_totals`, a mesma expressão chamada
  -- quatro vezes. Uma comparação em que os dois lados são contados por SQL
  -- diferente é uma comparação entre duas perguntas.
  v_desde_r := public.region_observed_since(p_region);

  -- O acumulado começa no primeiro de janeiro, ou no dia em que passámos a
  -- olhar, se for mais tarde. «Acumulado do ano: 194» sobre um projeto que
  -- existe desde agosto diz «o ano», e o ano não é isso — por isso o bloco
  -- leva a data de início lá dentro, e a página escreve-a.
  v_ano_de := greatest(date_trunc('year', v_inicio)::date, v_desde_r);

  v_comp := jsonb_build_object(
    'observed_since', v_desde_r,
    'current', public.report_totals(p_region, v_inicio, v_seguinte),
    'previous_month',
      case when v_desde_r is not null
            and (v_inicio - interval '1 month')::date >= v_desde_r
           then public.report_totals(p_region,
                  (v_inicio - interval '1 month')::date, v_inicio) end,
    'same_month_last_year',
      case when v_desde_r is not null
            and (v_inicio - interval '1 year')::date >= v_desde_r
           then public.report_totals(p_region,
                  (v_inicio - interval '1 year')::date,
                  (v_seguinte - interval '1 year')::date) end,
    'year_to_date',
      case when v_desde_r is not null and v_ano_de < v_seguinte
           then public.report_totals(p_region, v_ano_de, v_seguinte) end);

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
    'visits',       v_visitas,
    'comparison',   v_comp);
end;
$$;

-- ---------------------------------------------------------------------------
-- As provas
-- ---------------------------------------------------------------------------
do $$
declare
  v_rel   jsonb;
  v_mes   date;
  v_desde date;
begin
  v_mes   := date_trunc('month', current_date)::date;
  v_desde := public.region_observed_since('medio-tejo');
  v_rel   := public.monthly_report('medio-tejo', v_mes);

  if (v_rel -> 'comparison' ->> 'observed_since')::date <> v_desde then
    raise exception 'o relatório diz que se observa desde % e a função diz %',
      v_rel -> 'comparison' ->> 'observed_since', v_desde;
  end if;

  -- O mês corrente vem sempre, e bate com o total que o relatório já
  -- publicava pelo caminho antigo.
  if (v_rel -> 'comparison' -> 'current' ->> 'events_published')::bigint
     <> (v_rel -> 'events' -> 'totals' ->> 'published_in_month')::bigint then
    raise exception 'os dois caminhos do mesmo número divergem: % e %',
      v_rel -> 'comparison' -> 'current' ->> 'events_published',
      v_rel -> 'events' -> 'totals' ->> 'published_in_month';
  end if;

  -- Um mês que começou antes de estarmos a olhar não se compara.
  if v_desde > (v_mes - interval '1 month')::date then
    if v_rel -> 'comparison' -> 'previous_month' <> 'null'::jsonb then
      raise exception 'o mês anterior começou antes da observação (%) e mesmo assim veio com números', v_desde;
    end if;
  end if;

  -- O homólogo de há um ano é nulo enquanto não houver um ano de registo.
  if v_desde > (v_mes - interval '1 year')::date then
    if v_rel -> 'comparison' -> 'same_month_last_year' <> 'null'::jsonb then
      raise exception 'o mês homólogo é anterior à observação (%) e mesmo assim veio com números', v_desde;
    end if;
  end if;

  -- O acumulado leva a data em que começou, e essa data nunca é anterior à
  -- observação: dizer «desde 1 de janeiro» num projeto que existe desde
  -- agosto é dizer o ano, e o ano não é isso.
  if (v_rel -> 'comparison' -> 'year_to_date' ->> 'from')::date < v_desde then
    raise exception 'o acumulado diz que começou a % e só observamos desde %',
      v_rel -> 'comparison' -> 'year_to_date' ->> 'from', v_desde;
  end if;

  -- E um mês inteiramente dentro do que se observou compara-se. Prova-se com
  -- o próprio mês corrente, que por construção está lá dentro.
  if public.monthly_report('medio-tejo', v_mes) -> 'comparison' -> 'current' = 'null'::jsonb then
    raise exception 'o mês corrente veio sem totais';
  end if;
end
$$;
