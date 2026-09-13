-- 0118 — Os eventos sem hora têm nome.
--
-- O painel de qualidade mede «Hora» em percentagem, por concelho e por fonte,
-- e a percentagem responde bem à pergunta «a agenda está a melhorar ou só a
-- crescer?». Não responde à seguinte, que é «quais?». À data em que isto se
-- escreve, 22 dos 108 eventos publicados que ainda vão acontecer não dizem a
-- que horas são em sessão nenhuma — e para os corrigir era preciso percorrer
-- o catálogo à procura deles, um a um. A hora não vive em `events`: vive em
-- `event_sessions.start_time`, e um filtro sobre a tabela dos eventos não a
-- vê. O `falta=hora` do painel filtrava `date_start is null` — os sem data,
-- que são outra coisa — e ninguém deu por isso porque a opção nem sequer
-- estava na lista.
--
-- Esta vista é a lista. Um evento entra quando está no catálogo — publicado
-- ou por publicar, canónico —, ainda vai acontecer, e nenhuma das suas
-- sessões tem hora de início. Os que não têm sessão nenhuma entram também: é
-- o caso mais vazio de todos, e a contagem de sessões vai ao lado exatamente
-- para o distinguir de «tem três sessões e nenhuma diz a que horas».
--
-- Os outros estados ficam de fora pela razão da 0026: `hidden`, `cancelled`,
-- `postponed` e `archived` são decisões de uma pessoa sobre um evento, não
-- lacunas de recolha. E o que já passou fica de fora porque corrigir a hora
-- de um evento que já aconteceu não leva ninguém a lado nenhum. O «hoje» é o
-- do servidor, em UTC — uma hora de diferença de Lisboa à volta da meia-noite,
-- que numa lista de trabalho não faz mal a ninguém.
--
-- A região vai na cauda, como na 0103: com duas regiões na base, quem lê tem
-- de poder recortar. `security_invoker`, e sem leitura para a chave pública,
-- como as vistas de qualidade — isto é do painel, e o painel entra pela chave
-- de serviço.

create view public.events_without_time
with (security_invoker = true) as
select
  e.id,
  e.slug,
  e.title,
  e.municipality_id,
  e.source_id,
  e.date_start,
  e.date_end,
  e.is_ongoing,
  e.status,
  (
    select count(*)
    from public.event_sessions es
    where es.event_id = e.id
  ) as sessions,
  m.region_id
from public.events e
join public.municipalities m
  on m.id = e.municipality_id
where e.is_canonical
  and e.status in ('published', 'draft')
  and coalesce(e.date_end, e.date_start) >= current_date
  and not exists (
    select 1
    from public.event_sessions es
    where es.event_id = e.id
      and es.start_time is not null
  );

comment on view public.events_without_time is
  'Os eventos do catálogo — publicados e por publicar — que ainda vão '
  'acontecer e não dizem a que horas são em sessão nenhuma, com a contagem '
  'de sessões ao lado (zero é o caso mais vazio). É a lista por trás da '
  'percentagem «Hora» do painel de qualidade: o passo entre saber e corrigir.';

-- A vista herda as permissões de quem a cria, e as por omissão dão leitura à
-- chave pública. Repor, como na 0026: isto é do painel, e só a chave de
-- serviço a lê.
revoke all on public.events_without_time from public, anon, authenticated;
grant select on public.events_without_time to service_role;

do $$
declare
  v_n integer;
begin
  -- A definição, dita como asserção: nenhuma linha pode ter uma sessão com
  -- hora, e nenhuma pode já ter passado.
  select count(*) into v_n
    from public.events_without_time v
   where exists (
           select 1
             from public.event_sessions es
            where es.event_id = v.id
              and es.start_time is not null
         )
      or coalesce(v.date_end, v.date_start) < current_date;
  if v_n <> 0 then
    raise exception 'a vista dos eventos sem hora tem % linhas que têm hora ou já passaram', v_n;
  end if;

  -- E a contagem tem de bater certo com a que se faz à mão sobre as tabelas:
  -- se o catálogo tem eventos sem hora, a vista tem de os ver todos.
  select count(*) into v_n from public.events_without_time;
  if v_n <> (
    select count(*)
      from public.events e
     where e.is_canonical
       and e.status in ('published', 'draft')
       and coalesce(e.date_end, e.date_start) >= current_date
       and not exists (
             select 1
               from public.event_sessions es
              where es.event_id = e.id
                and es.start_time is not null
           )
  ) then
    raise exception 'a vista dos eventos sem hora não está a ver o catálogo inteiro';
  end if;

  -- E nenhuma linha sem região: a junção ao concelho garante-o.
  select count(*) into v_n from public.events_without_time where region_id is null;
  if v_n <> 0 then
    raise exception '% linhas da vista dos eventos sem hora sem região', v_n;
  end if;

  -- A chave pública não a lê.
  if has_table_privilege('anon', 'public.events_without_time', 'select')
     or has_table_privilege('authenticated', 'public.events_without_time', 'select') then
    raise exception 'a vista dos eventos sem hora está legível pela chave pública';
  end if;
end
$$;
