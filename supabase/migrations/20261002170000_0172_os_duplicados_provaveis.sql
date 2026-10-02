-- 0172 — Os duplicados prováveis, pelo sítio e pela hora, e o «fundir com este».
--
-- A procura de parecidos da fila (`find_duplicate_candidates`, 0006) só
-- compara o título: semelhança de 0,55 ou mais, três dias para cada lado, no
-- mesmo concelho. O duplicado que mais acontece não é esse. É o mesmo
-- espetáculo, no mesmo espaço, no mesmo dia e à mesma hora, anunciado com
-- outro título — «Noite de Fados — Trio Corda Solta» e «Noite de Fados na
-- Filarmónica» —, e passava sem aviso nenhum (C4-014). Em produção, a agenda
-- do Médio Tejo tinha a 1 de outubro o mesmo curso duas vezes, no mesmo dia e
-- no mesmo espaço.
--
-- E quando o painel encontrava um parecido, tratá-lo exigia escrever à mão o
-- identificador de um evento que a página não mostrava (C4-014, C4-029). A
-- página passa a mostrar cada candidato com data, hora, espaço e porquê, e
-- dois gestos: «É este» (a proposta é duplicada) e «Fundir com este» (as datas
-- da proposta juntam-se ao evento que já existe). O segundo é a função nova
-- desta migração.
--
-- Seguro para o sítio de hoje: duas funções novas, que o sítio publicado não
-- chama; a de 0006 fica como está. O sítio novo usa a nova, e sem ela volta à
-- antiga (só o dono entra antes da 0170, e vê o que via).

create or replace function public.candidatos_a_duplicado(
  p_title           text,
  p_date            date,
  p_municipality_id text,
  p_venue_id        text default null,
  p_start_time      time default null,
  p_excluir         uuid default null
)
returns table (
  event_id      uuid,
  title         text,
  slug          text,
  status        text,
  date_start    date,
  start_time    time,
  venue_id      text,
  venue_name    text,
  location_name text,
  similarity    real,
  motivo        text
)
language sql
stable
security definer
set search_path = ''
as $$
  with candidatos as (
    select e.id,
           e.title,
           e.slug,
           e.status::text as status,
           e.date_start,
           e.venue_id,
           e.location_name,
           extensions.similarity(public.normalize_for_hash(e.title),
                                 public.normalize_for_hash(coalesce(p_title, ''))) as semelhanca,
           -- A sessão do dia pedido, se o evento a tem: é a hora dela que se
           -- compara e que se mostra.
           (select s.start_time from public.event_sessions s
             where s.event_id = e.id and s.session_date = p_date
             order by s.start_time nulls last limit 1) as hora_do_dia,
           exists (select 1 from public.event_sessions s
                    where s.event_id = e.id and s.session_date = p_date) as tem_o_dia
      from public.events e
     where e.municipality_id = p_municipality_id
       and e.status <> 'archived'
       and e.is_canonical
       and (p_excluir is null or e.id <> p_excluir)
       and (p_date is null or e.date_start between p_date - 3 and p_date + 3
            or exists (select 1 from public.event_sessions s
                        where s.event_id = e.id and s.session_date = p_date))
  ),
  com_motivo as (
    select c.*,
           case
             when p_venue_id is not null and c.venue_id = p_venue_id and c.tem_o_dia
                  and p_start_time is not null and c.hora_do_dia = p_start_time
               then 'mesmo-espaco-dia-e-hora'
             when p_venue_id is not null and c.venue_id = p_venue_id and c.tem_o_dia
               then 'mesmo-espaco-e-dia'
             when c.tem_o_dia and p_start_time is not null and c.hora_do_dia = p_start_time
               then 'mesmo-dia-e-hora'
             when c.semelhanca >= 0.55
               then 'titulo-parecido'
           end as motivo
      from candidatos c
  )
  select m.id, m.title, m.slug, m.status, m.date_start, m.hora_do_dia, m.venue_id,
         v.name, m.location_name, m.semelhanca, m.motivo
    from com_motivo m
    left join public.venues v on v.id = m.venue_id
   where m.motivo is not null
   order by case m.motivo
              when 'mesmo-espaco-dia-e-hora' then 1
              when 'mesmo-espaco-e-dia' then 2
              when 'mesmo-dia-e-hora' then 3
              else 4
            end,
            m.semelhanca desc
   limit 10;
$$;

comment on function public.candidatos_a_duplicado(text, date, text, text, time, uuid) is
  'Os eventos que podem ser o mesmo que uma proposta: no mesmo espaço e dia (e '
  'hora), no mesmo dia e hora do concelho, ou com o título parecido (o critério '
  'da 0006). Cada um com o motivo, pela ordem da força. p_excluir tira o próprio '
  'evento, para a ficha de um evento publicado procurar os seus repetidos.';

-- ---------------------------------------------------------------------------
-- Fundir uma proposta num evento que já existe
-- ---------------------------------------------------------------------------
--
-- «É este» marca a proposta como duplicada e não toca no evento. «Fundir com
-- este» faz o mesmo e mais uma coisa: as datas que a proposta traz e o evento
-- não tem entram no evento — a terceira sessão de um espetáculo que a câmara
-- anunciou com duas, a reposição de uma exposição. Nunca tira nada: as
-- sessões do evento ficam, e uma que já lá está (o mesmo dia e a mesma hora) é
-- descartada pelo índice único.
--
-- As sessões chegam de fora, lidas da proposta pelo servidor (as três formas
-- de payload estão em `apps/web/src/lib/admin/fields.ts`), em vez de lidas
-- aqui: são as que a página mostrou a quem decidiu.

create or replace function public.fundir_submissao_no_evento(
  p_submission_id uuid,
  p_event_id      uuid,
  p_sessions      jsonb,
  p_actor         text,
  p_ip_hash       text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub      public.submissions;
  v_antes    jsonb;
  v_sessao   jsonb;
  v_novas    integer := 0;
  v_inseriu  integer;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se funde proposta nenhuma';
  end if;

  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'esta proposta já não existe';
  end if;
  if v_sub.status not in ('pending', 'needs_info') then
    raise exception 'esta proposta já foi decidida — recarrega a página';
  end if;

  select jsonb_build_object('status', e.status, 'date_start', e.date_start, 'date_end', e.date_end,
                            'sessoes', (select count(*) from public.event_sessions s where s.event_id = e.id))
    into v_antes
    from public.events e where e.id = p_event_id and e.status <> 'archived';
  if v_antes is null then
    raise exception 'o evento escolhido já não existe, ou foi arquivado';
  end if;

  for v_sessao in select * from jsonb_array_elements(coalesce(p_sessions, '[]'::jsonb))
  loop
    if coalesce(v_sessao ->> 'session_date', '') = '' then
      continue;
    end if;
    insert into public.event_sessions (event_id, session_date, start_time, end_time)
    values (
      p_event_id,
      (v_sessao ->> 'session_date')::date,
      nullif(v_sessao ->> 'start_time', '')::time,
      nullif(v_sessao ->> 'end_time', '')::time
    )
    on conflict do nothing;
    get diagnostics v_inseriu = row_count;
    v_novas := v_novas + v_inseriu;
  end loop;

  if v_novas > 0 then
    perform public.refresh_event_dates(p_event_id);
  end if;

  update public.submissions
     set status = 'duplicate',
         duplicate_of_event_id = p_event_id,
         review_notes = coalesce(review_notes, 'fundida no evento que já existia'),
         reviewed_at = now(),
         reviewed_by = p_actor
   where id = p_submission_id;

  perform public.log_admin_action(
    p_actor, 'submission.merge', 'submission', p_submission_id::text,
    v_antes,
    jsonb_build_object('event_id', p_event_id, 'sessoes_novas', v_novas),
    p_ip_hash
  );

  return v_novas;
end;
$$;

comment on function public.fundir_submissao_no_evento(uuid, uuid, jsonb, text, text) is
  'Marca uma proposta como duplicada de um evento e junta-lhe as datas que ele não '
  'tinha. Nunca tira sessões. Devolve quantas entraram. Fica a linha '
  'submission.merge na auditoria.';

revoke all on function public.candidatos_a_duplicado(text, date, text, text, time, uuid)
  from public, anon, authenticated;
revoke all on function public.fundir_submissao_no_evento(uuid, uuid, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.candidatos_a_duplicado(text, date, text, text, time, uuid) to service_role;
grant execute on function public.fundir_submissao_no_evento(uuid, uuid, jsonb, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- As provas, numa transação que se desfaz
-- ---------------------------------------------------------------------------
do $$
declare
  v_concelho text;
  v_espaco   text;
  v_evento   uuid;
  v_sub      uuid;
  v_motivo   text;
  n          integer;
begin
  select v.municipality_id, v.id into v_concelho, v_espaco
    from public.venues v order by v.municipality_id, v.id limit 1;
  if v_concelho is null then
    raise exception using errcode = 'DEADA', message = 'sem espaços: nada para provar';
  end if;

  insert into public.events (slug, title, municipality_id, venue_id, status, fingerprint, date_start)
  values ('prova-0172', 'Noite de Fados na Filarmónica', v_concelho, v_espaco, 'published',
          'prova-0172', date '2031-10-04')
  returning id into v_evento;
  insert into public.event_sessions (event_id, session_date, start_time)
  values (v_evento, date '2031-10-04', time '21:30');

  -- O caso do C4-014: outro título, o mesmo espaço, o mesmo dia e a mesma hora.
  select motivo into v_motivo
    from public.candidatos_a_duplicado('Trio Corda Solta ao vivo', date '2031-10-04', v_concelho,
                                       v_espaco, time '21:30')
   where event_id = v_evento;
  assert v_motivo = 'mesmo-espaco-dia-e-hora',
    format('o duplicado pelo espaço, dia e hora não apareceu (motivo: %s)', coalesce(v_motivo, 'nenhum'));

  -- O próprio evento não é candidato a si mesmo.
  select count(*) into n
    from public.candidatos_a_duplicado('Noite de Fados na Filarmónica', date '2031-10-04', v_concelho,
                                       v_espaco, time '21:30', v_evento);
  assert n = 0, 'o evento apareceu como duplicado de si próprio';

  -- Fundir: a sessão que já existe não se repete; a nova entra.
  insert into public.submissions (channel, status, payload, municipality_id)
  values ('form', 'pending', '{}'::jsonb, v_concelho)
  returning id into v_sub;
  n := public.fundir_submissao_no_evento(
    v_sub, v_evento,
    '[{"session_date":"2031-10-04","start_time":"21:30"},{"session_date":"2031-10-05","start_time":"21:30"}]'::jsonb,
    'prova-0172');
  assert n = 1, format('fundir devia acrescentar uma sessão, acrescentou %s', n);
  assert (select status from public.submissions where id = v_sub) = 'duplicate',
    'a proposta fundida não ficou duplicada';
  assert (select date_end from public.events where id = v_evento) = date '2031-10-05',
    'as datas do evento não acompanharam a sessão nova';

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
