-- 0141 — Contar o clique em «Página oficial» e em «Como chegar».
--
-- «A agenda mandou 340 pessoas ao vosso portal em setembro» é a frase que faz
-- uma câmara continuar a alimentar a agenda, e é a única prova de retorno que
-- um agregador sem bilheteira consegue dar a quem organiza. O «como chegar» é o
-- sinal mais próximo de intenção de comparecer que existe aqui.
--
-- Hoje não se contam. A ficha do evento marca três botões com `data-stat-kind`
-- — bilhetes, calendário e partilha — e o «Página oficial» é o único daquela
-- fila sem marca nenhuma. Medido em produção a 13 de setembro de 2026: 98
-- aberturas de ficha em 46 eventos, e zero em todos os outros contadores.
--
-- ---------------------------------------------------------------------------
-- O que NÃO muda, e é a decisão mais importante desta migração
-- ---------------------------------------------------------------------------
-- A coluna `event_stats.clicks` é **gerada**: `ticket_clicks + ical_downloads +
-- shares` (0017). A tentação é acrescentar-lhe as duas novas. Não se faz.
--
-- Aquele número já saiu em relatórios entregues. Somar-lhe duas contagens que
-- só existem a partir de hoje fazia outubro parecer maior do que setembro sem
-- ninguém ter carregado em mais nada — o pior género de crescimento, o que vem
-- da régua e não do território. As duas colunas novas contam-se ao lado, e a
-- soma fica como sempre foi.
--
-- ---------------------------------------------------------------------------
-- «Zero» e «não medi» são coisas diferentes, e a fotografia tem de as separar
-- ---------------------------------------------------------------------------
-- O relatório mensal é a **diferença entre duas fotografias diárias**. As
-- fotografias anteriores a hoje não têm estas colunas; se nascessem com
-- `not null default 0`, a diferença de setembro dava zero — e zero, num
-- relatório, lê-se como «ninguém carregou». Ninguém carregou porque não havia
-- botão que contasse.
--
-- Por isso, em `event_stats_snapshots`, as duas colunas nascem **anuláveis**.
-- Uma fotografia antiga tem nulo, a diferença dá nulo, e o relatório diz «a
-- partir de» em vez de mostrar um zero que mente. Em `event_stats` — que é o
-- contador vivo e não tem história — nascem a zero, que é a verdade: o botão
-- existe desde agora e ninguém lhe tocou ainda.

alter table public.event_stats
  add column if not exists source_clicks     integer not null default 0,
  add column if not exists directions_clicks integer not null default 0;

comment on column public.event_stats.source_clicks is
  'Cliques na ligação para a página oficial do evento. É a prova de retorno '
  'que se dá a quem organiza. Não entra na coluna gerada `clicks`, de '
  'propósito: aquele número já saiu em relatórios entregues.';

comment on column public.event_stats.directions_clicks is
  'Cliques em «como chegar». É o sinal mais próximo de intenção de comparecer '
  'que este sítio consegue medir. Também não entra em `clicks`.';

alter table public.event_stats_snapshots
  add column if not exists source_clicks     bigint,
  add column if not exists directions_clicks bigint;

comment on column public.event_stats_snapshots.source_clicks is
  'Anulável de propósito: uma fotografia anterior à 0141 não tem este número, e '
  'nulo é «não medi». Zero seria dizer que ninguém carregou num botão que ainda '
  'não contava.';

comment on column public.event_stats_snapshots.directions_clicks is
  'Anulável pela mesma razão da `source_clicks`.';

-- ---------------------------------------------------------------------------
-- A lista fechada ganha dois nomes, e continua fechada
-- ---------------------------------------------------------------------------
create or replace function public.record_event_stat(p_event_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('view', 'ticket_click', 'ical_download', 'share',
                                      'source_click', 'directions_click') then
    raise exception 'tipo de contagem desconhecido: %', coalesce(p_kind, 'null');
  end if;

  -- Um evento que já não existe não é erro: a ficha pode estar aberta há uma
  -- hora no separador de alguém, ou em cache.
  if not exists (select 1 from public.events e where e.id = p_event_id) then
    return;
  end if;

  insert into public.event_stats as s
    (event_id, views, ticket_clicks, ical_downloads, shares, source_clicks, directions_clicks)
  values (
    p_event_id,
    case when p_kind = 'view'             then 1 else 0 end,
    case when p_kind = 'ticket_click'     then 1 else 0 end,
    case when p_kind = 'ical_download'    then 1 else 0 end,
    case when p_kind = 'share'            then 1 else 0 end,
    case when p_kind = 'source_click'     then 1 else 0 end,
    case when p_kind = 'directions_click' then 1 else 0 end
  )
  on conflict (event_id) do update set
    views             = s.views + excluded.views,
    ticket_clicks     = s.ticket_clicks + excluded.ticket_clicks,
    ical_downloads    = s.ical_downloads + excluded.ical_downloads,
    shares            = s.shares + excluded.shares,
    source_clicks     = s.source_clicks + excluded.source_clicks,
    directions_clicks = s.directions_clicks + excluded.directions_clicks,
    updated_at        = now();
end;
$$;

comment on function public.record_event_stat(uuid, text) is
  'Soma 1 ao contador indicado. Chamada pela rota de contagem do site, com a '
  'chave de serviço; nunca diretamente pelo navegador. Seis tipos, e a lista é '
  'fechada: um tipo desconhecido rebenta, em vez de somar a lado nenhum.';

-- ---------------------------------------------------------------------------
-- A agregação por concelho
-- ---------------------------------------------------------------------------
drop function if exists public.event_stats_by_municipality();

create function public.event_stats_by_municipality()
returns table (
  municipality_id   text,
  municipality_name text,
  events_counted    bigint,
  views             bigint,
  ticket_clicks     bigint,
  ical_downloads    bigint,
  shares            bigint,
  clicks            bigint,
  region_id         text,
  source_clicks     bigint,
  directions_clicks bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,
         m.name,
         count(s.event_id),
         coalesce(sum(s.views), 0),
         coalesce(sum(s.ticket_clicks), 0),
         coalesce(sum(s.ical_downloads), 0),
         coalesce(sum(s.shares), 0),
         coalesce(sum(s.clicks), 0),
         m.region_id,
         coalesce(sum(s.source_clicks), 0),
         coalesce(sum(s.directions_clicks), 0)
    from public.municipalities m
    left join public.events e
      on e.municipality_id = m.id
    left join public.event_stats s
      on s.event_id = e.id
   group by m.id, m.name, m.region_id
   order by m.sort_order;
$$;

revoke execute on function public.event_stats_by_municipality() from public, anon, authenticated;
grant execute on function public.event_stats_by_municipality() to service_role;

-- ---------------------------------------------------------------------------
-- A fotografia diária
-- ---------------------------------------------------------------------------
create or replace function public.snapshot_event_stats()
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
     ical_downloads, shares, clicks, source_clicks, directions_clicks)
  select f.municipality_id, current_date, f.events_counted, f.views, f.ticket_clicks,
         f.ical_downloads, f.shares, f.clicks, f.source_clicks, f.directions_clicks
    from public.event_stats_by_municipality() f
  on conflict (municipality_id, taken_on) do update set
    events_counted    = excluded.events_counted,
    views             = excluded.views,
    ticket_clicks     = excluded.ticket_clicks,
    ical_downloads    = excluded.ical_downloads,
    shares            = excluded.shares,
    clicks            = excluded.clicks,
    source_clicks     = excluded.source_clicks,
    directions_clicks = excluded.directions_clicks;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- As provas
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_fonte integer;
  v_caminho integer;
  v_gerado bigint;
begin
  insert into public.events (slug, title, municipality_id, fingerprint, location_name,
                             status, date_start)
  values ('prova-0141', 'Prova da 0141', 'tomar', 'fp-prova-0141', 'Sala de Ensaio',
          'published', '2099-01-01')
  returning id into v_id;

  perform public.record_event_stat(v_id, 'source_click');
  perform public.record_event_stat(v_id, 'source_click');
  perform public.record_event_stat(v_id, 'directions_click');
  perform public.record_event_stat(v_id, 'ticket_click');

  select source_clicks, directions_clicks, clicks
    into v_fonte, v_caminho, v_gerado
    from public.event_stats where event_id = v_id;

  assert v_fonte = 2, format('esperavam-se 2 cliques na página oficial, foram %s', v_fonte);
  assert v_caminho = 1, format('esperava-se 1 clique no como chegar, foi %s', v_caminho);

  -- A coluna gerada não mexeu: só o clique na bilhética lá entrou.
  assert v_gerado = 1,
    format('a coluna gerada devia continuar a somar só os três de sempre, e deu %s', v_gerado);

  -- E a lista continua fechada.
  begin
    perform public.record_event_stat(v_id, 'scroll');
    assert false, 'um tipo de contagem desconhecido passou';
  exception when raise_exception then
    null;
  end;

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
