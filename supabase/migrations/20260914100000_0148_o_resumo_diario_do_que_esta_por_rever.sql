-- 0148 — O resumo diário do que está por rever.
--
-- O painel responde a tudo isto, e responde bem. O problema é que responde a
-- quem lá vai. Uma submissão de um evento que acontece amanhã fica na fila
-- exatamente igual a uma de um evento de dezembro, e a diferença entre as
-- duas é que uma delas deixa de valer alguma coisa depois de amanhã.
--
-- Sete perguntas, uma ida à base, e o formato é o que cabe num ecrã
-- bloqueado. É a mesma forma que a `agenda-semanal.yml` já usa: um relatório,
-- não um alarme — só que este, ao contrário daquele, **não se envia quando não
-- há nada a fazer**. Um aviso diário sobre uma fila vazia aprende-se a ignorar
-- em duas semanas, e é o argumento que a própria casa escreve na
-- `agenda-semanal.yml` para justificar ser semanal.
--
-- **O que urge é o evento, e não a submissão.** Uma submissão chegada ontem
-- de um concerto de amanhã é mais urgente do que uma de há uma semana de um
-- festival de julho. A data do evento vive dentro do `payload`, em três
-- formas — uma por canal —, e já há quem a saiba ler: `data_do_evento_na_
-- submissao`, escrita na 0133 para o prazo de conservação. É a mesma pergunta
-- e é a mesma resposta, e por isso é a mesma função.
--
-- **Três dias na fila é o limiar, e é uma escolha.** Uma submissão por rever
-- há três dias já passou um fim de semana; a partir daí, quem a mandou tem
-- razão para achar que ninguém a leu. Fica em `p_dias_na_fila` para quem tenha
-- outra opinião, com três por omissão.
--
-- O que **não** entra: nada que já esteja em `/estado` e não urja. A
-- contagem de fontes caladas vem cá porque uma noite calada custa um dia de
-- programação; a saúde de cada fonte, essa, fica no painel onde já está.

create function public.daily_digest(
  p_region        text,
  p_dias_na_fila  integer default 3,
  p_dias_de_prazo integer default 30
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with fila as (
    select s.id, s.channel, s.created_at,
           public.data_do_evento_na_submissao(s.payload) as dia_do_evento
      from public.submissions s
      left join public.events e on e.id = s.resulting_event_id
      left join public.municipalities m on m.id = e.municipality_id
     where s.status = 'pending'
       and coalesce(m.region_id, s.region_id) = p_region
  )
  select jsonb_build_object(
    'region', p_region,
    'as_of',  current_date,

    -- 1. Quantas estão por rever, e por onde entraram. O canal importa porque
    --    diz de quem é a expectativa: quem preencheu um formulário está à
    --    espera de resposta, e a recolha automática não está à espera de nada.
    'pending', jsonb_build_object(
      'total', (select count(*) from fila),
      'by_channel', jsonb_build_object(
        'scraper', (select count(*) from fila where channel = 'scraper'),
        'email',   (select count(*) from fila where channel = 'email'),
        'form',    (select count(*) from fila where channel = 'form'))),

    -- 2. As que urgem: o evento acontece nos próximos sete dias. Uma
    --    submissão sem data legível não entra aqui — não se sabe se urge, e
    --    contá-la como urgente ou como tranquila seria decidir por ela.
    'pending_within_7_days', (
      select count(*) from fila
       where dia_do_evento is not null
         and dia_do_evento >= current_date
         and dia_do_evento < current_date + 7),

    -- 3. E as que já acontecem hoje ou aconteceram: rever estas não é
    --    trabalho por fazer, é trabalho que já não vale a pena. Conta-se à
    --    parte para não inflacionar o número que urge.
    'pending_already_past', (
      select count(*) from fila
       where dia_do_evento is not null and dia_do_evento < current_date),

    -- 4. As que estão na fila há mais tempo do que o razoável.
    'pending_stale', (
      select count(*) from fila
       where created_at < now() - make_interval(days => p_dias_na_fila)),

    -- 5. Fontes que correram e não trouxeram nada — o sinal da 0139, que fala
    --    à primeira noite em vez de esperar pela terceira.
    'silent_sources', (
      select count(*)
        from public.sources s
        left join public.municipalities m on m.id = s.municipality_id
       where coalesce(m.region_id, s.region_id) = p_region
         and s.is_enabled
         and s.last_run_at is not null
         and (s.last_success_at is null or s.last_run_at > s.last_success_at)),

    -- 6. O que está publicado para amanhã e não diz a que horas.
    --
    --    Amanhã e não hoje: hoje já não há tempo de emendar, e um aviso sobre
    --    o que já não se pode arranjar é ruído.
    --
    --    **A hora, e não «a hora ou o sítio», e foi esta migração a
    --    descobrir porquê.** O plano pedia as duas, e a primeira versão
    --    perguntava `venue_id is null and location_name is null` — que é uma
    --    condição que a base não deixa ser verdadeira desde a 0004:
    --    `events_has_location` exige um dos dois. A prova aqui em baixo
    --    recusou-se a gravar o evento de exemplo, e foi assim que se soube.
    --
    --    O mesmo defeito estava no painel: o filtro «sem sítio nenhum» de
    --    `/admin/eventos` servia-se da mesma condição, dava zero desde sempre,
    --    e lia-se como «não falta sítio a nenhum evento». Saiu na mesma
    --    alteração que traz esta migração.
    --
    --    Um evento sem espaço do catálogo mas com o sítio por escrito não
    --    entra aqui: tem sítio, ainda que não esteja ligado. Essa é uma lacuna
    --    de catálogo, e vive em `/admin/qualidade`, que é onde se trabalha com
    --    tempo — não num aviso sobre amanhã.
    'tomorrow_incomplete', (
      select count(*)
        from public.events e
        join public.municipalities m on m.id = e.municipality_id
       where m.region_id = p_region
         and e.is_canonical
         and e.status = 'published'
         and e.date_start <= current_date + 1
         and coalesce(e.date_end, e.date_start) >= current_date + 1
         and not exists (
           select 1 from public.event_sessions es
            where es.event_id = e.id and es.start_time is not null)),

    -- 7. As licenças a acabar. Uma licença que caduca não avaria: chega ao
    --    fim, e no dia seguinte alguém pergunta porque é que o sítio deixou de
    --    servir. As sem prazo (a montra, um piloto aberto) não contam.
    'licenses_ending', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'kind', l.kind, 'ends_on', l.ends_on)
             order by l.ends_on), '[]'::jsonb)
        from public.region_licenses l
       where l.region_id = p_region
         and l.ends_on is not null
         and l.ends_on >= current_date
         and l.ends_on < current_date + p_dias_de_prazo));
$$;

comment on function public.daily_digest(text, integer, integer) is
  'Sete perguntas sobre o que urge hoje numa região, numa ida à base. É o que '
  'o resumo diário envia — e o que decide se envia alguma coisa: sem nada por '
  'fazer, não se manda nada, porque um aviso diário sobre uma fila vazia '
  'aprende-se a ignorar em duas semanas.';

revoke execute on function public.daily_digest(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.daily_digest(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- As provas
-- ---------------------------------------------------------------------------
do $$
declare
  v_r        jsonb;
  v_antes    bigint;
  v_evento   uuid;
  v_amanha   date := current_date + 1;
begin
  v_r := public.daily_digest('medio-tejo');

  if v_r ->> 'region' <> 'medio-tejo' then
    raise exception 'o resumo veio de outra região: %', v_r ->> 'region';
  end if;

  -- Os canais somam o total. Se um canal novo entrar em `submissions.channel`
  -- e não aqui, o total deixa de bater e é aqui que se sabe — e não por
  -- alguém reparar que a fila tem mais do que o resumo diz.
  if (v_r -> 'pending' ->> 'total')::bigint
     <> (v_r -> 'pending' -> 'by_channel' ->> 'scraper')::bigint
      + (v_r -> 'pending' -> 'by_channel' ->> 'email')::bigint
      + (v_r -> 'pending' -> 'by_channel' ->> 'form')::bigint then
    raise exception 'os canais não somam o total: % contra os três',
      v_r -> 'pending' ->> 'total';
  end if;

  -- Uma submissão de um evento de amanhã tem de aparecer no que urge, e a
  -- data tem de sair do `payload` — que é a parte que um contador ingénuo
  -- erra, porque a submissão não tem coluna de data nenhuma.
  v_antes := (v_r ->> 'pending_within_7_days')::bigint;

  insert into public.submissions (channel, status, region_id, payload)
  values ('form', 'pending', 'medio-tejo',
          jsonb_build_object('date_start', to_char(v_amanha, 'YYYY-MM-DD'),
                             'title', 'Prova da 0148'));

  v_r := public.daily_digest('medio-tejo');
  if (v_r ->> 'pending_within_7_days')::bigint <> v_antes + 1 then
    raise exception 'o resumo não viu a submissão de um evento de amanhã: % e depois %',
      v_antes, v_r ->> 'pending_within_7_days';
  end if;

  -- E uma de um evento que já passou não entra no que urge: entra na coluna
  -- que diz que já não vale a pena.
  v_antes := (v_r ->> 'pending_already_past')::bigint;
  insert into public.submissions (channel, status, region_id, payload)
  values ('form', 'pending', 'medio-tejo',
          jsonb_build_object('date_start', to_char(current_date - 30, 'YYYY-MM-DD'),
                             'title', 'Prova da 0148, já passada'));

  v_r := public.daily_digest('medio-tejo');
  if (v_r ->> 'pending_already_past')::bigint <> v_antes + 1 then
    raise exception 'o resumo contou um evento passado como urgente';
  end if;

  -- Uma submissão sem data legível não conta nem para um lado nem para o
  -- outro. «Não sei quando é» não é «é para a semana» nem «já passou».
  v_antes := (v_r ->> 'pending_within_7_days')::bigint
           + (v_r ->> 'pending_already_past')::bigint;
  insert into public.submissions (channel, status, region_id, payload)
  values ('form', 'pending', 'medio-tejo',
          jsonb_build_object('title', 'Prova da 0148, sem data'));

  v_r := public.daily_digest('medio-tejo');
  if (v_r ->> 'pending_within_7_days')::bigint
     + (v_r ->> 'pending_already_past')::bigint <> v_antes then
    raise exception 'uma submissão sem data legível foi arrumada numa das gavetas';
  end if;

  -- Um evento publicado para amanhã sem hora aparece. Repare-se no
  -- `location_name`: **é obrigatório**, e é essa a razão de a pergunta ser
  -- sobre a hora e não sobre o sítio — `events_has_location`, da 0004, não
  -- deixa gravar um evento sem sítio nenhum. A primeira versão desta migração
  -- tentou-o, e foi a base a dizer que não.
  v_antes := (v_r ->> 'tomorrow_incomplete')::bigint;
  insert into public.events (slug, title, municipality_id, fingerprint, location_name,
                             status, date_start, date_end, published_at)
  values ('prova-0148', 'Prova da 0148', 'tomar', 'fp-prova-0148', 'Sítio da prova',
          'published', v_amanha, v_amanha, now())
  returning id into v_evento;

  v_r := public.daily_digest('medio-tejo');
  if (v_r ->> 'tomorrow_incomplete')::bigint <> v_antes + 1 then
    raise exception 'o resumo não viu um evento de amanhã sem hora';
  end if;

  -- E deixa de aparecer quando ganha hora. É a prova de que a condição é
  -- sobre a lacuna e não sobre a data.
  insert into public.event_sessions (event_id, session_date, start_time)
  values (v_evento, v_amanha, '21:30');

  v_r := public.daily_digest('medio-tejo');
  if (v_r ->> 'tomorrow_incomplete')::bigint <> v_antes then
    raise exception 'o evento continua na lista depois de ganhar hora';
  end if;

  -- E a condição que o plano pedia não pode ser verdadeira: a base recusa um
  -- evento sem sítio. Fica provado aqui, a rolar para trás, em vez de ficar
  -- por afirmação num comentário.
  begin
    insert into public.events (slug, title, municipality_id, fingerprint,
                               status, date_start)
    values ('prova-0148-sem-sitio', 'Prova da 0148 sem sítio', 'tomar',
            'fp-prova-0148-sem-sitio', 'draft', v_amanha);
    raise exception 'a base aceitou um evento sem espaço e sem sítio por escrito';
  exception when check_violation then
    null;
  end;

  -- A prova não deixa nada atrás de si.
  delete from public.event_sessions where event_id = v_evento;
  delete from public.events where id = v_evento;
  delete from public.submissions where payload ->> 'title' like 'Prova da 0148%';
end
$$;
