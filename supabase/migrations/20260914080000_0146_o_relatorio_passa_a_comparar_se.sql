-- 0146 — O relatório passa a comparar-se, e diz quando não pode.
--
-- Um relatório mensal com um número sozinho não responde à pergunta para que
-- foi pedido. «Publicámos 128 eventos em setembro» não diz se setembro foi
-- bom: diz-o «128, contra 94 em agosto e 71 em setembro do ano passado». É a
-- diferença entre uma contagem e uma prestação de contas, e é a peça que uma
-- CIM anexa quando tem de justificar o que pagou.
--
-- Três comparações, e o acumulado do ano: o mês anterior, o mês homólogo, e o
-- que vai do ano até ao fim do mês relatado.
--
-- **O que isto não faz é comparar contra um mês que não observámos por
-- inteiro.** O Médio Tejo tem registo desde 28 de agosto de 2026. Agosto
-- «tem» dados — quatro dias deles — e um relatório de setembro que dividisse
-- por esse agosto mostrava um crescimento de várias centenas por cento que
-- mede a data em que o projeto começou, e não a agenda de ninguém. Um mês só
-- se compara se o primeiro dia dele já estiver dentro do que se observou; se
-- não, o relatório escreve **«sem comparação»**, que é a regra que as visitas
-- já seguem desde a 0120.
--
-- É por isso que nasce `region_observed_since`: a data em que a região passou
-- a ser observada, do primeiro de três registos — o primeiro evento, a
-- primeira submissão, a primeira execução de uma fonte da região. A recolha
-- que não trouxe nada conta na mesma: estávamos a olhar.
--
-- **O acumulado do ano leva a sua própria data de início.** «Acumulado do
-- ano: 194» sobre um projeto que existe desde 28 de agosto diz «o ano», e o
-- ano não é isso. O bloco traz `from`, e a página escreve «desde 28 de
-- agosto».
--
-- **As sessões entram ao lado dos eventos, e é a razão da CIM.** Um festival
-- de três dias é um evento e são três sessões; o INE conta espetáculos ao
-- vivo em sessões, e sem essa coluna a CIM não consegue pôr o seu número ao
-- lado do oficial na mesma frase. O Coreto já as tem em `event_sessions`
-- desde a 0004 — o que faltava era alguém somá-las. As canceladas ficam de
-- fora: uma sessão cancelada não é um espetáculo que aconteceu.
--
-- **Os quatro blocos saem da mesma expressão, e não de quatro cópias.** Uma
-- comparação em que o «antes» e o «depois» são contados por SQL diferente é
-- uma comparação entre duas perguntas, e o erro não aparece — aparece um
-- número. `report_totals` é essa expressão, chamada quatro vezes; a prova, lá
-- em baixo, confirma que o bloco do mês corrente bate com os totais que o
-- relatório já publicava por outro caminho.

-- ---------------------------------------------------------------------------
-- Desde quando é que se pode dizer alguma coisa sobre esta região
-- ---------------------------------------------------------------------------

create function public.region_observed_since(p_region text)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select min(dia) from (
    select min(e.created_at)::date as dia
      from public.events e
      join public.municipalities m on m.id = e.municipality_id
     where m.region_id = p_region
    union all
    select min(s.created_at)::date
      from public.submissions s
      left join public.events e on e.id = s.resulting_event_id
      left join public.municipalities m on m.id = e.municipality_id
     where coalesce(m.region_id, s.region_id) = p_region
    union all
    -- Uma recolha que não trouxe nada conta na mesma: estávamos a olhar, e
    -- «olhámos e não havia» é uma observação.
    select min(r.started_at)::date
      from public.source_runs r
      join public.sources src on src.id = r.source_id
      left join public.municipalities m on m.id = src.municipality_id
     where coalesce(m.region_id, src.region_id) = p_region
  ) as origens;
$$;

comment on function public.region_observed_since(text) is
  'O primeiro dia em que esta região passou a ser observada: o mais antigo '
  'entre o primeiro evento, a primeira submissão e a primeira execução de uma '
  'fonte sua. É o que decide se um mês se pode comparar — um mês que começou '
  'antes disto foi observado em parte, e dividir por ele mede a data em que o '
  'projeto começou, não a agenda de ninguém.';

revoke execute on function public.region_observed_since(text) from public, anon, authenticated;
grant execute on function public.region_observed_since(text) to service_role;

-- ---------------------------------------------------------------------------
-- Os totais de uma janela, numa expressão só
-- ---------------------------------------------------------------------------

create function public.report_totals(p_region text, p_de date, p_ate date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'from', p_de,
    -- O último dia **dentro** da janela. `p_ate` é exclusivo, como em todo o
    -- resto do relatório; quem lê um relatório não lê intervalos meio abertos.
    'to',   p_ate - 1,
    -- A decisão de publicar, com os arquivados dentro: um evento publicado em
    -- julho e arquivado em agosto foi publicado em julho. É a mesma regra que
    -- `published_in_month` segue desde a 0120.
    'events_published', (
      select count(*)
        from public.events e
        join public.municipalities m on m.id = e.municipality_id
       where m.region_id = p_region
         and e.is_canonical
         and e.status not in ('draft', 'hidden')
         and e.published_at >= p_de and e.published_at < p_ate),
    -- A programação: o que esteve à vista do público dentro da janela.
    'events_happening', (
      select count(*)
        from public.events e
        join public.municipalities m on m.id = e.municipality_id
       where m.region_id = p_region
         and e.is_canonical
         and e.status = 'published'
         and e.date_start < p_ate
         and coalesce(e.date_end, e.date_start) >= p_de),
    -- A unidade do INE. Um festival de três dias é um evento e três sessões,
    -- e as canceladas não contam: não foram espetáculos.
    'sessions_happening', (
      select count(*)
        from public.event_sessions s
        join public.events e on e.id = s.event_id
        join public.municipalities m on m.id = e.municipality_id
       where m.region_id = p_region
         and e.is_canonical
         and e.status = 'published'
         and not s.is_cancelled
         and s.session_date >= p_de and s.session_date < p_ate),
    'submissions_received', (
      select count(*)
        from public.submissions s
        left join public.events e on e.id = s.resulting_event_id
        left join public.municipalities m on m.id = e.municipality_id
       where coalesce(m.region_id, s.region_id) = p_region
         and s.created_at >= p_de and s.created_at < p_ate),
    'submissions_approved', (
      select count(*)
        from public.submissions s
        left join public.events e on e.id = s.resulting_event_id
        left join public.municipalities m on m.id = e.municipality_id
       where coalesce(m.region_id, s.region_id) = p_region
         and s.status = 'approved'
         and s.reviewed_at >= p_de and s.reviewed_at < p_ate));
$$;

comment on function public.report_totals(text, date, date) is
  'Os totais comparáveis de uma região numa janela [de, ate). Existe para que '
  'o mês corrente, o anterior, o homólogo e o acumulado do ano saiam todos da '
  'mesma expressão: uma comparação em que os dois lados são contados por SQL '
  'diferente é uma comparação entre duas perguntas.';

revoke execute on function public.report_totals(text, date, date) from public, anon, authenticated;
grant execute on function public.report_totals(text, date, date) to service_role;

-- ---------------------------------------------------------------------------
-- A prova
-- ---------------------------------------------------------------------------
do $$
declare
  v_mes    date;
  v_desde  date;
  v_rel    jsonb;
  v_totais jsonb;
begin
  v_mes   := date_trunc('month', current_date)::date;
  v_desde := public.region_observed_since('medio-tejo');

  if v_desde is null then
    raise exception 'o Médio Tejo não tem registo nenhum, e tem catálogo publicado';
  end if;

  -- Os totais da janela e os que o relatório já publicava por outro caminho
  -- são o mesmo número. Se um dia deixarem de ser, é aqui que se sabe — e não
  -- num quadro entregue a quem financia.
  v_rel    := public.monthly_report('medio-tejo', v_mes);
  v_totais := public.report_totals('medio-tejo', v_mes,
                                   (v_mes + interval '1 month')::date);

  if (v_totais ->> 'events_published')::bigint
     <> (v_rel -> 'events' -> 'totals' ->> 'published_in_month')::bigint then
    raise exception 'report_totals diz % eventos publicados no mês e o relatório diz %',
      v_totais ->> 'events_published',
      v_rel -> 'events' -> 'totals' ->> 'published_in_month';
  end if;

  if (v_totais ->> 'events_happening')::bigint
     <> (v_rel -> 'events' -> 'totals' ->> 'happening_in_month')::bigint then
    raise exception 'report_totals diz % eventos a decorrer e o relatório diz %',
      v_totais ->> 'events_happening',
      v_rel -> 'events' -> 'totals' ->> 'happening_in_month';
  end if;

  if (v_totais ->> 'submissions_received')::bigint
     <> (v_rel -> 'submissions' ->> 'received')::bigint then
    raise exception 'report_totals diz % submissões recebidas e o relatório diz %',
      v_totais ->> 'submissions_received', v_rel -> 'submissions' ->> 'received';
  end if;

  -- Nunca há mais eventos do que sessões a decorrer: um evento sem sessão
  -- nenhuma não existe, e um com três conta três. Se isto inverter, é sinal de
  -- eventos gravados sem sessões — e o número do INE fica por baixo do real.
  if (v_totais ->> 'sessions_happening')::bigint
     < (v_totais ->> 'events_happening')::bigint then
    raise exception 'há % eventos a decorrer e só % sessões: eventos sem sessão nenhuma',
      v_totais ->> 'events_happening', v_totais ->> 'sessions_happening';
  end if;

  -- A janela é meio aberta, e o `to` que sai é o último dia lá dentro.
  if (v_totais ->> 'to')::date <> (v_mes + interval '1 month')::date - 1 then
    raise exception 'a janela devolveu o dia % como último, e o mês acaba a %',
      v_totais ->> 'to', (v_mes + interval '1 month')::date - 1;
  end if;

  -- E um mês inteiramente anterior à observação não traz número nenhum a
  -- fingir: traz zeros, e é o relatório que os há de recusar chamar
  -- comparação. Aqui prova-se que a data de observação os separa.
  if v_desde >= v_mes then
    raise notice 'a região passou a ser observada a %, dentro do mês corrente: o mês anterior não se compara', v_desde;
  end if;
end
$$;
