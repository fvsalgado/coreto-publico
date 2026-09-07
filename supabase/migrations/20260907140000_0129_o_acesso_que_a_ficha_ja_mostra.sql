-- 0129 — O acesso que a ficha já mostra passa a existir para quem filtra.
--
-- **O que estava errado, com número.** O atalho «Acessível» da agenda faz
-- `wheelchair_accessible = true` sobre `events`, e essa coluna está a nulo em
-- quase todos: as câmaras não a preenchem, e o leitor de prosa só a escreve
-- quando a descrição do **evento** fala de acesso. O resultado, medido no
-- Médio Tejo a 7 de setembro de 2026: `/api/events?accessible=1` devolve
-- **0 de 128**.
--
-- E não é que a informação não exista. A ficha de evento mostra-a há muito
-- tempo, e mostra-a bem: `EventDetailAccessibility` faz
-- `event.wheelchair_accessible ?? venue.wheelchair_accessible` — se o evento
-- se cala, responde o espaço, que é quem tem rampa ou degraus. Vinte e sete
-- dos 128 eventos acontecem num espaço declarado acessível, e a ficha de cada
-- um diz «Acessível». O filtro não os encontra, e o cartão da agenda também
-- não o diz: **três leituras da mesma pergunta, e só uma sabia a resposta.**
--
-- **O que esta migração faz.** Materializa a resposta numa coluna, para que
-- as três leiam a mesma. `wheelchair_accessible_resolved` é, à letra,
-- `coalesce(events.wheelchair_accessible, venues.wheelchair_accessible)` — o
-- que a ficha já calculava em TypeScript.
--
-- **Porque é coluna e não vista nem junção.** A pergunta atravessa duas
-- tabelas, e o PostgREST não sabe pôr uma coluna de recurso embebido dentro
-- de um `or` de topo: a alternativa era resolver os espaços acessíveis num
-- pedido e mandar os identificadores todos na cadeia de consulta do seguinte,
-- que funciona com oitenta espaços e parte com quinhentos. Uma coluna é o que
-- torna isto um `eq` como os outros — indexável, paginável, e igual para a
-- agenda, para a API e para o widget.
--
-- **O preço, dito por extenso: é uma desnormalização, e desnormalizações
-- dessincronizam-se.** Os dois gatilhos abaixo são o que impede isso, e são
-- dois porque há duas formas de a resposta mudar: o evento muda de espaço (ou
-- de declaração), e o espaço muda de declaração. O segundo é o que se
-- esquece: alguém marca o Cine-Teatro como acessível no painel e, sem ele,
-- os quarenta eventos de lá continuavam a não aparecer no filtro.
--
-- A coluna é derivada e ninguém a escreve à mão: os gatilhos correm sempre,
-- e uma escrita direta é reposta na atualização seguinte da linha.

alter table public.events
  add column if not exists wheelchair_accessible_resolved boolean;

comment on column public.events.wheelchair_accessible_resolved is
  'Derivada: coalesce(wheelchair_accessible, venues.wheelchair_accessible). Mantida pelos gatilhos da 0129 — não escrever à mão.';

-- ---------------------------------------------------------------------------
-- A regra, escrita uma vez.
-- ---------------------------------------------------------------------------
create or replace function public.resolver_acesso_do_evento(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.events e
     set wheelchair_accessible_resolved = coalesce(
           e.wheelchair_accessible,
           (select v.wheelchair_accessible from public.venues v where v.id = e.venue_id)
         )
   where e.id = target
     and e.wheelchair_accessible_resolved is distinct from coalesce(
           e.wheelchair_accessible,
           (select v.wheelchair_accessible from public.venues v where v.id = e.venue_id)
         );
$$;

revoke all on function public.resolver_acesso_do_evento(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. O evento mudou de declaração ou de espaço.
-- ---------------------------------------------------------------------------
create or replace function public.events_sync_acesso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.resolver_acesso_do_evento(new.id);
  return null;
end;
$$;

drop trigger if exists events_sync_acesso_trg on public.events;
create trigger events_sync_acesso_trg
  after insert or update of wheelchair_accessible, venue_id on public.events
  for each row execute function public.events_sync_acesso();

-- ---------------------------------------------------------------------------
-- 2. O espaço mudou de declaração — e é este que se esquece.
--
-- Alguém marca o Cine-Teatro como acessível no painel; sem isto, os quarenta
-- eventos de lá continuavam fora do filtro até alguém lhes tocar um a um.
-- ---------------------------------------------------------------------------
create or replace function public.venues_sync_acesso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.events e
     set wheelchair_accessible_resolved = coalesce(e.wheelchair_accessible, new.wheelchair_accessible)
   where e.venue_id = new.id
     and e.wheelchair_accessible_resolved
         is distinct from coalesce(e.wheelchair_accessible, new.wheelchair_accessible);
  return null;
end;
$$;

drop trigger if exists venues_sync_acesso_trg on public.venues;
create trigger venues_sync_acesso_trg
  after update of wheelchair_accessible on public.venues
  for each row execute function public.venues_sync_acesso();

-- ---------------------------------------------------------------------------
-- O que já lá está.
-- ---------------------------------------------------------------------------
update public.events e
   set wheelchair_accessible_resolved = coalesce(
         e.wheelchair_accessible,
         (select v.wheelchair_accessible from public.venues v where v.id = e.venue_id)
       );

-- O índice do atalho passa a ser o da coluna nova. O antigo servia uma
-- consulta que deixa de existir.
create index if not exists events_accessible_resolved_idx on public.events (date_start)
  where status = 'published' and is_canonical = true and wheelchair_accessible_resolved = true;

-- ---------------------------------------------------------------------------
do $$
declare
  v_erradas integer;
  v_gatilhos integer;
begin
  -- A coluna diz o que a ficha diria, linha a linha.
  select count(*) into v_erradas
    from public.events e
    left join public.venues v on v.id = e.venue_id
   where e.wheelchair_accessible_resolved
         is distinct from coalesce(e.wheelchair_accessible, v.wheelchair_accessible);
  if v_erradas > 0 then
    raise exception '% eventos com o acesso resolvido em desacordo com a regra', v_erradas;
  end if;

  -- E os dois gatilhos existem, porque um só deixava a coluna a apodrecer
  -- na metade que ninguém vê.
  select count(*) into v_gatilhos
    from pg_trigger
   where not tgisinternal
     and tgname in ('events_sync_acesso_trg', 'venues_sync_acesso_trg');
  if v_gatilhos <> 2 then
    raise exception 'esperavam-se os dois gatilhos do acesso resolvido, há %', v_gatilhos;
  end if;
end
$$;
