-- 0017 — Contadores por evento, sem identificar ninguém.
--
-- O problema: quem programa precisa de saber o que interessou às pessoas —
-- quantas vezes se abriu a ficha de um evento, quantas se carregou no botão
-- da bilhética, quantas se levou o evento para o calendário. Sem isso, a
-- decisão de continuar ou acabar com um ciclo é feita a olho.
--
-- A solução habitual — uma linha por visita, com IP, agente e identificador
-- de visitante — resolve o problema e cria outro: passa a haver um histórico
-- de comportamento de pessoas concretas, que precisa de base legal, de prazo
-- de conservação, de resposta a pedidos de acesso e, na prática, de um aviso
-- de cookies.
--
-- Aqui guarda-se apenas o resultado: quatro números por evento. Não há linha
-- por visita, não há identificador de sessão, não há IP — nem sequer em
-- hash. O que se pode responder é «este evento teve 412 aberturas e 37
-- cliques na bilhética»; o que nunca se pode responder é «quem». Como não há
-- dados pessoais, não há tratamento a fundamentar nem nada para apagar.
--
-- O preço desta escolha é conhecido e aceite: sem identificador não há como
-- distinguir duas aberturas da mesma pessoa de aberturas de duas pessoas, nem
-- como descontar um robô que ignore o `robots.txt`. Estes números são uma
-- medida de interesse relativo entre eventos, não um censo de público — e é
-- assim que a página de estatísticas os apresenta.

create table public.event_stats (
  event_id        uuid primary key references public.events(id) on delete cascade,
  views           bigint not null default 0,
  ticket_clicks   bigint not null default 0,
  ical_downloads  bigint not null default 0,
  shares          bigint not null default 0,
  -- Soma dos três cliques, materializada: é a pergunta que o backoffice faz
  -- («quantos cliques teve este evento») e assim pode ser ordenada e paginada
  -- pela base de dados, em vez de puxar tudo para memória para somar.
  clicks          bigint not null generated always as (ticket_clicks + ical_downloads + shares) stored,
  updated_at      timestamptz not null default now(),

  constraint event_stats_non_negative check (
    views >= 0 and ticket_clicks >= 0 and ical_downloads >= 0 and shares >= 0
  )
);

create index event_stats_views_idx on public.event_stats (views desc);
create index event_stats_clicks_idx on public.event_stats (clicks desc);

comment on table public.event_stats is
  'Contadores agregados por evento. Sem qualquer coluna que identifique, '
  'direta ou indiretamente, quem visitou: não há IP, sessão, dispositivo nem '
  'data de visita — só totais. Acrescentar aqui uma coluna dessas muda a '
  'natureza da tabela e obriga a rever a base legal de todo o sítio.';

comment on column public.event_stats.clicks is
  'Coluna gerada: ticket_clicks + ical_downloads + shares.';

-- ---------------------------------------------------------------------------
-- Registo de uma contagem
-- ---------------------------------------------------------------------------

/**
 * Incrementa um contador de um evento.
 *
 * `p_kind` é validado contra uma lista fechada e não é concatenado em SQL
 * nenhum: o `case` escolhe a coluna, o que torna impossível que um valor
 * vindo do exterior escreva onde não deve.
 */
create or replace function public.record_event_stat(p_event_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('view', 'ticket_click', 'ical_download', 'share') then
    raise exception 'tipo de contagem desconhecido: %', coalesce(p_kind, 'null');
  end if;

  -- Um evento que já não existe não é erro: a ficha pode estar aberta há uma
  -- hora no separador de alguém, ou em cache. Contar era impossível (a chave
  -- estrangeira não deixa) e rebentar só encheria os registos de ruído por
  -- uma contagem que não vale um erro.
  if not exists (select 1 from public.events e where e.id = p_event_id) then
    return;
  end if;

  insert into public.event_stats as s (event_id, views, ticket_clicks, ical_downloads, shares)
  values (
    p_event_id,
    case when p_kind = 'view' then 1 else 0 end,
    case when p_kind = 'ticket_click' then 1 else 0 end,
    case when p_kind = 'ical_download' then 1 else 0 end,
    case when p_kind = 'share' then 1 else 0 end
  )
  on conflict (event_id) do update set
    views          = s.views + excluded.views,
    ticket_clicks  = s.ticket_clicks + excluded.ticket_clicks,
    ical_downloads = s.ical_downloads + excluded.ical_downloads,
    shares         = s.shares + excluded.shares,
    updated_at     = now();
end;
$$;

comment on function public.record_event_stat(uuid, text) is
  'Soma 1 ao contador indicado. Chamada pela rota de contagem do site, com a '
  'chave de serviço; nunca diretamente pelo navegador.';

-- ---------------------------------------------------------------------------
-- Agregação por concelho
-- ---------------------------------------------------------------------------

/**
 * Totais por concelho, incluindo os concelhos ainda sem uma única contagem.
 *
 * O `left join` a partir de `municipalities` é o que garante que os treze
 * aparecem sempre: um concelho a zero é informação — provavelmente a mais
 * acionável de todas —, e desaparecer da tabela faria com que ninguém desse
 * por ele.
 */
create or replace function public.event_stats_by_municipality()
returns table (
  municipality_id   text,
  municipality_name text,
  events_counted    bigint,
  views             bigint,
  ticket_clicks     bigint,
  ical_downloads    bigint,
  shares            bigint,
  clicks            bigint
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
         coalesce(sum(s.clicks), 0)
    from public.municipalities m
    left join public.events e
      on e.municipality_id = m.id
    left join public.event_stats s
      on s.event_id = e.id
   group by m.id, m.name
   order by m.sort_order;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.event_stats enable row level security;

-- Leitura pública: sim, e de propósito.
--
-- Estes números são agregados sem qualquer dado pessoal, e o sítio já publica
-- o catálogo inteiro em JSON e em iCal sem pedir chave. Fechar os contadores
-- não protegeria ninguém — não há aqui ninguém para proteger — e impediria o
-- que se quer que aconteça: uma câmara mostrar no seu sítio quantas pessoas
-- abriram a ficha do seu festival.
--
-- A policy espelha a dos eventos: só se leem os contadores de eventos
-- publicados. Um evento em rascunho ou escondido não revela pelos números que
-- existe.
create policy event_stats_public_read on public.event_stats
  for select to anon, authenticated using (
    exists (
      select 1 from public.events e
       where e.id = event_stats.event_id
         and e.status = 'published'
    )
  );

-- Sem policy de escrita: quem conta é o servidor, com a chave de serviço.
-- Uma policy de `insert`/`update` aqui deixaria qualquer visitante escrever o
-- número que quisesse.

revoke execute on function public.record_event_stat(uuid, text) from public, anon, authenticated;
revoke execute on function public.event_stats_by_municipality() from public, anon, authenticated;
grant execute on function public.record_event_stat(uuid, text) to service_role;
grant execute on function public.event_stats_by_municipality() to service_role;
