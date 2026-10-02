-- 0163 — Um evento cancelado ou adiado continua a abrir, e diz que o foi.
--
-- Quem guardou ou partilhou a ligação de um concerto que entretanto foi
-- cancelado recebia «Esta página não existe» (C2-006). É a informação mais
-- importante que a agenda lhe pode dar nesse dia — «já não há concerto» —, e
-- saía como uma avaria. A razão era a mesma da 0132: a política pública de
-- `events` só deixava passar o publicado e o arquivo do que aconteceu, e o
-- `getEvent` filtrava o mesmo em código.
--
-- **O que passa a abrir.** `cancelled` e `postponed`, canónicos. Os dois são
-- decisões de uma pessoa sobre um evento, e nunca da recolha: a recolha deita
-- fora o que a fonte declara cancelado ou adiado (ver os adaptadores), e a
-- 0026 e a 0118 já os tratam como tal. Afirmá-los é afirmar o que alguém
-- decidiu, não um palpite. O `is_canonical` fica pela razão da 0132: o
-- duplicado de um cancelado continua a ser um duplicado.
--
-- **O que NÃO passa a abrir.** `hidden` (o que foi escondido por estar errado)
-- e `draft`. Esses são exatamente o que a rua não deve ver.
--
-- **E as listagens não mudam.** A agenda, a entrada, o concelho, o espaço, o
-- mapa, os feeds, o sitemap e as contagens filtram `status = 'published'` em
-- código, e continuam a filtrar: um cancelado abre pela sua ligação e não
-- aparece na lista do fim de semana. As duas leituras do ciclo, que confiavam
-- só nesta política, passam a dizer em código o que leem — publicado e
-- arquivado —, no mesmo commit.
--
-- **As sessões seguem o evento**, e era uma falha antiga: a política das
-- sessões ficou na 0007 a deixar ver só as do publicado. Desde a 0132 a ficha
-- do arquivo abria com o título e as datas e dizia «Sem horário publicado» na
-- secção «Quando» — as sessões existiam e a política escondia-as. Passa a
-- valer o mesmo predicado dos dois lados, escrito duas vezes de propósito: uma
-- política que confiasse na outra por subconsulta deixava de dizer, lida
-- sozinha, o que deixa passar.
--
-- `alter policy`, e não `drop` + `create`, como a 0115 e a 0132: nunca há um
-- instante sem política.

alter policy events_public_read on public.events
  using (
    status = 'published'
    or (status = 'archived' and archived_reason = 'passado' and is_canonical)
    or (status in ('cancelled', 'postponed') and is_canonical)
  );

comment on policy events_public_read on public.events is
  'O que está publicado; o que foi arquivado por ter acontecido; e o que uma '
  'pessoa deu como cancelado ou adiado — sempre canónico. O resto não: o que foi '
  'escondido por estar errado, o rascunho, o que não era um evento e o duplicado.';

alter policy event_sessions_public_read on public.event_sessions
  using (
    exists (
      select 1
        from public.events e
       where e.id = event_sessions.event_id
         and (
           e.status = 'published'
           or (e.status = 'archived' and e.archived_reason = 'passado' and e.is_canonical)
           or (e.status in ('cancelled', 'postponed') and e.is_canonical)
         )
    )
  );

comment on policy event_sessions_public_read on public.event_sessions is
  'As sessões dos eventos que a rua pode ler, pelo mesmo predicado de '
  'events_public_read: uma ficha que abre mostra os seus dias.';

-- ---------------------------------------------------------------------------
-- As provas, numa transação que se desfaz.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  eventos integer;
  sessoes integer;
  escondidos integer;
begin
  -- Continua a haver uma política em cada tabela: duas somadas com «ou» eram o
  -- aviso do linter que a 0115 veio calar.
  select count(*) into n from pg_policy where polrelid = 'public.events'::regclass;
  assert n = 1, format('esperava-se uma política em events, há %s', n);
  select count(*) into n from pg_policy where polrelid = 'public.event_sessions'::regclass;
  assert n = 1, format('esperava-se uma política em event_sessions, há %s', n);

  insert into public.events (slug, title, municipality_id, fingerprint, location_name,
                             status, is_canonical, date_start)
  values
    ('prova-0163-cancelado', 'Prova da 0163', 'tomar', 'fp-prova-0163-a', 'Sala de Ensaio',
     'cancelled', true, '2030-01-01'),
    ('prova-0163-adiado', 'Prova da 0163', 'tomar', 'fp-prova-0163-b', 'Sala de Ensaio',
     'postponed', true, '2030-01-02'),
    ('prova-0163-duplicado', 'Prova da 0163', 'tomar', 'fp-prova-0163-c', 'Sala de Ensaio',
     'cancelled', false, '2030-01-03'),
    ('prova-0163-escondido', 'Prova da 0163', 'tomar', 'fp-prova-0163-d', 'Sala de Ensaio',
     'hidden', true, '2030-01-04'),
    ('prova-0163-arquivo', 'Prova da 0163', 'tomar', 'fp-prova-0163-e', 'Sala de Ensaio',
     'archived', true, '2020-01-05');
  update public.events set archived_reason = 'passado' where slug = 'prova-0163-arquivo';

  insert into public.event_sessions (event_id, session_date, start_time)
  select id, date_start, '21:00' from public.events where slug like 'prova-0163-%';

  set local role anon;
  select count(*) into eventos from public.events
   where slug in ('prova-0163-cancelado', 'prova-0163-adiado', 'prova-0163-arquivo');
  select count(*) into sessoes from public.event_sessions s
    join public.events e on e.id = s.event_id
   where e.slug in ('prova-0163-cancelado', 'prova-0163-adiado', 'prova-0163-arquivo');
  select count(*) into escondidos from public.events
   where slug in ('prova-0163-duplicado', 'prova-0163-escondido');
  reset role;

  assert eventos = 3, format('o cancelado, o adiado e o arquivo deviam abrir; abrem %s', eventos);
  assert sessoes = 3,
    format('as sessões do cancelado, do adiado e do arquivo deviam ler-se; leem-se %s', sessoes);
  assert escondidos = 0,
    'um cancelado não canónico ou um escondido ficou visível ao anon';

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
