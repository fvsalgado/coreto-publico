-- 0144 — A medida de qualidade ganha memória.
--
-- `/admin/relatorios` diz isto, por escrito, na legenda do bloco de
-- qualidade: «É o catálogo tal como está hoje, e não como estava no fim do
-- mês: a medida de qualidade não guarda histórico, e o relatório prefere
-- dizê-lo a fingir.» Está certo, e é o género de ressalva que uma casa
-- honesta escreve — mas é uma ressalva sobre uma lacuna, não sobre uma
-- escolha. Um relatório de julho aberto hoje mostra números de hoje; aberto
-- outra vez em novembro mostra outros. O mês acabou e a medida continua a
-- mexer.
--
-- **A pergunta que isto fecha é «está a melhorar?».** O painel responde «62%
-- têm hora» e nada mais: se no mês passado eram 45% ou 78%, ninguém sabe,
-- porque não ficou escrito em lado nenhum. Uma percentagem sem a anterior ao
-- lado não distingue um mês bom de um mau.
--
-- A forma é a da 0120, e de propósito: uma fotografia por dia e por concelho,
-- com a data em que foi lida, escrita pela noite e lida pelo painel. Uma
-- segunda fotografia no mesmo dia escreve por cima — o que interessa é o
-- estado do dia, não quantas vezes se olhou.
--
-- **A fotografia não guarda percentagens, guarda contagens.** A percentagem é
-- uma leitura — está escrito no `relatorio.ts` e vale aqui: guardar 62% perde
-- se eram 5 em 8 ou 62 em 100, e a diferença entre essas duas é toda a
-- diferença entre um mês em que não se fez nada e um em que se dobrou o
-- catálogo. Com as contagens, a percentagem calcula-se sempre; ao contrário,
-- não.
--
-- Só por concelho, e não também por fonte. Uma fonte que se desliga leva a
-- linha com ela (`on delete cascade` nas duas), e por fonte isso acontece —
-- a 0139 mostrou oito a ficarem caladas numa noite. O concelho é o eixo que
-- não desaparece, e é o eixo do relatório.
--
-- Sem policy nenhuma, como a 0120: escreve a chave de serviço, lê a chave de
-- serviço. Isto é matéria do painel.

create table public.event_quality_snapshots (
  municipality_id  text not null references public.municipalities(id) on delete cascade,
  taken_on         date not null,
  published        bigint not null default 0,
  pending          bigint not null default 0,
  in_catalogue     bigint not null default 0,
  with_time        bigint not null default 0,
  with_venue       bigint not null default 0,
  with_image       bigint not null default 0,
  with_description bigint not null default 0,
  with_price       bigint not null default 0,
  with_coordinates bigint not null default 0,
  primary key (municipality_id, taken_on),
  constraint event_quality_snapshots_non_negative check (
    published >= 0 and pending >= 0 and in_catalogue >= 0
    and with_time >= 0 and with_venue >= 0 and with_image >= 0
    and with_description >= 0 and with_price >= 0 and with_coordinates >= 0
  ),
  -- Nenhuma lacuna se preenche em mais eventos do que os que há. Um
  -- `with_time` maior do que `in_catalogue` não é um número alto: é uma
  -- fotografia tirada a meio de uma escrita, e vale mais recusá-la do que
  -- deixá-la produzir uma percentagem acima de cem.
  constraint event_quality_snapshots_dentro_do_catalogo check (
    with_time        <= in_catalogue and
    with_venue       <= in_catalogue and
    with_image       <= in_catalogue and
    with_description <= in_catalogue and
    with_price       <= in_catalogue and
    with_coordinates <= in_catalogue and
    published + pending = in_catalogue
  )
);

comment on table public.event_quality_snapshots is
  'Uma fotografia por dia e por concelho do que está preenchido no catálogo, '
  'tal como `event_quality_by_municipality` o conta. Serve para responder a '
  '«está a melhorar?», que a percentagem sozinha não responde. Guarda '
  'contagens e não percentagens, de propósito: 5 em 8 e 62 em 100 são a mesma '
  'percentagem e não são o mesmo mês. Não identifica ninguém — são contagens '
  'de eventos do catálogo público.';

comment on column public.event_quality_snapshots.taken_on is
  'O dia em que a fotografia foi tirada (a data da base, em UTC). Um dia, uma '
  'fotografia por concelho: tirar outra no mesmo dia escreve por cima.';

create index event_quality_snapshots_taken_on_idx
  on public.event_quality_snapshots (taken_on);

alter table public.event_quality_snapshots enable row level security;
revoke all on table public.event_quality_snapshots from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A fotografia
-- ---------------------------------------------------------------------------

create function public.snapshot_event_quality()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  insert into public.event_quality_snapshots as s
    (municipality_id, taken_on, published, pending, in_catalogue, with_time,
     with_venue, with_image, with_description, with_price, with_coordinates)
  select q.municipality_id, current_date, q.published, q.pending, q.in_catalogue,
         q.with_time, q.with_venue, q.with_image, q.with_description,
         q.with_price, q.with_coordinates
    from public.event_quality_by_municipality q
  on conflict (municipality_id, taken_on) do update set
    published        = excluded.published,
    pending          = excluded.pending,
    in_catalogue     = excluded.in_catalogue,
    with_time        = excluded.with_time,
    with_venue       = excluded.with_venue,
    with_image       = excluded.with_image,
    with_description = excluded.with_description,
    with_price       = excluded.with_price,
    with_coordinates = excluded.with_coordinates;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

comment on function public.snapshot_event_quality() is
  'Tira a fotografia do dia à qualidade do catálogo, um concelho por linha. '
  'Idempotente: correr duas vezes no mesmo dia escreve por cima em vez de '
  'duplicar. É a noite que a chama, e o painel que a lê.';

-- A 0134 fechou a porta a funções `security definer` executáveis pela chave
-- anónima, e uma função nova nasce com `execute` para toda a gente. Esta
-- escreve, e quem escreve é a noite.
revoke execute on function public.snapshot_event_quality() from public, anon, authenticated;
grant execute on function public.snapshot_event_quality() to service_role;

-- ---------------------------------------------------------------------------
-- A prova
-- ---------------------------------------------------------------------------
do $$
declare
  v_linhas   integer;
  v_outra    integer;
  v_catalogo bigint;
  v_foto     bigint;
begin
  v_linhas := public.snapshot_event_quality();
  if v_linhas <> (select count(*) from public.event_quality_by_municipality) then
    raise exception 'a fotografia gravou % linhas e há % concelhos',
      v_linhas, (select count(*) from public.event_quality_by_municipality);
  end if;

  -- Idempotente: a segunda no mesmo dia escreve por cima. Sem isto, a noite
  -- a correr duas vezes rebentava na chave primária e a recolha parava por
  -- causa de uma fotografia.
  v_outra := public.snapshot_event_quality();
  if v_outra <> v_linhas then
    raise exception 'a segunda fotografia do dia gravou % linhas em vez de %', v_outra, v_linhas;
  end if;
  if (select count(*) from public.event_quality_snapshots where taken_on = current_date)
     <> v_linhas then
    raise exception 'a segunda fotografia duplicou linhas em vez de escrever por cima';
  end if;

  -- E o que lá está é o que a vista diz. Uma fotografia que não bate com o
  -- original não é memória: é um segundo número a circular.
  select coalesce(sum(in_catalogue), 0) into v_catalogo
    from public.event_quality_by_municipality;
  select coalesce(sum(in_catalogue), 0) into v_foto
    from public.event_quality_snapshots where taken_on = current_date;
  if v_catalogo <> v_foto then
    raise exception 'a vista diz % eventos no catálogo e a fotografia diz %', v_catalogo, v_foto;
  end if;

  -- A restrição que recusa uma lacuna maior do que o catálogo continua de pé.
  -- Uma regra de honestidade que se possa largar com um `drop constraint`
  -- distraído não é uma regra.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.event_quality_snapshots'::regclass
       and conname = 'event_quality_snapshots_dentro_do_catalogo'
  ) then
    raise exception 'a restrição que trava percentagens acima de cem não ficou lá';
  end if;

  -- E recusa mesmo. Escrito a rolar para trás, como a 0133: a prova corre,
  -- prova, e não deixa linha.
  begin
    insert into public.event_quality_snapshots
      (municipality_id, taken_on, published, pending, in_catalogue, with_time)
    select municipality_id, current_date - 1, 1, 0, 1, 2
      from public.event_quality_by_municipality limit 1;
    raise exception 'a fotografia aceitou mais eventos com hora do que eventos';
  exception when check_violation then
    null;
  end;
end
$$;
