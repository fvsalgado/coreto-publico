-- 0073 — Quatro não-eventos, e a reunião que voltava todos os meses.
--
-- A fila de moderação tinha quatro candidatos desde 29 de agosto. Nenhum é um
-- evento, e a razão de cada um vale a pena escrever — é o que impede a próxima
-- pessoa de aprovar por cansaço.
--
--   · **«Adiamento da 2.ª Semana de Cinema ao Ar Livre»** (Mação) — é um aviso,
--     não é um evento. Anuncia quatro sessões (Envendos, Mação, Ortiga,
--     Penhascoso), e essas seriam bem-vindas; o aviso não. Publicá-lo punha na
--     agenda uma notícia com data, que é exatamente o que a `0009` limpou de
--     Tomar.
--   · **«Agenda Cultural Julho/Agosto 2026»** (Mação) — é o PDF do programa do
--     bimestre, com data de início a 1 de julho e de fim a 31 de agosto. Um
--     índice de eventos não é um evento.
--   · **«Reunião Câmara»** (Sardoal) — é a reunião do executivo municipal, no
--     Salão Nobre dos Paços do Concelho. É informação municipal legítima e não
--     é programação cultural.
--   · **«Cinema agosto/ 2026»** (Centro Cultural Gil Vicente) — o programa do
--     mês, sem uma única data. Sem data não há evento, e agosto já acabou.
--
-- ## E a que ia voltar
--
-- «Reunião Câmara» não é um acidente: é uma entrada mensal da agenda de
-- Sardoal, com endereços numerados (`reuniao-camara-4`). Rejeitá-la hoje
-- resolvia hoje. Por isso entra em `excludeTitles`, que é o mecanismo que
-- `cm-tomar` já usa para a piscina municipal — o candidato deixa de ser
-- produzido, em vez de ser produzido e recusado todos os meses.
-- ---------------------------------------------------------------------------

update public.submissions set
  status = 'rejected',
  reviewed_at = now(),
  reviewed_by = 'levantamento 2026-08-30',
  review_notes = case
    when payload->'raw'->>'sourceKey' = 'eb-132' then
      'Aviso de adiamento, não é um evento. As quatro sessões que anuncia — '
      'Envendos 31 ago, Mação 1 set, Ortiga 2 set, Penhascoso 3 set — não '
      'estão publicadas pela fonte como eventos próprios.'
    when payload->'raw'->>'sourceKey' = 'eb-112' then
      'É o PDF da agenda cultural do bimestre. Um índice de eventos não é um evento.'
    when payload->'raw'->>'title' = 'Reunião Câmara' then
      'Reunião do executivo municipal. Informação municipal legítima, não é '
      'programação cultural. Passa a ser excluída na origem.'
    else
      'Programa do mês sem uma única data. Sem data não há evento.'
  end,
  updated_at = now()
where status = 'pending'
  and source_id in ('cm-macao', 'cm-sardoal', 'ccgv-sardoal')
  and (
    payload->'raw'->>'sourceKey' in ('eb-132', 'eb-112')
    or payload->'raw'->>'title' in ('Reunião Câmara', 'Cinema agosto/ 2026')
  );

-- ---------------------------------------------------------------------------
-- A exclusão na origem, com a mesma forma que `cm-tomar` já usa.
update public.sources
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('excludeTitles', jsonb_build_array('reunião câmara', 'reuniao camara')),
    updated_at = now()
where id = 'cm-sardoal';

-- ---------------------------------------------------------------------------
-- E dois que já tinham passado, e são da mesma família
--
-- A fila de hoje fez olhar para o que Mação já tem publicado, e lá estavam
-- dois avisos com ar de evento:
--
--   · **«Época Balnear no Concelho de Mação - 2026»**, de 13 de junho a 13 de
--     setembro. É o período em que as praias fluviais têm nadador-salvador.
--     `looksLikeMunicipalNotice` já devolve `true` para este título — está
--     escrito no teste da 0009 — e mesmo assim ele está publicado.
--   · **«Acontece em Mação... em Agosto»**, de 1 a 31 de agosto, em «vários
--     lugares do concelho». É o índice do mês, como a agenda cultural que
--     acima se recusa.
--
-- Ficam `hidden` e não apagados: o registo continua lá, com a data e a fonte,
-- e uma pessoa desfaz isto num instante se discordar. O `status` fica trancado
-- em `manual_overrides`, sem o que a recolha desta noite os republicava.
--
-- Mação passa a ter três eventos por acontecer em vez de cinco. Não é uma
-- perda: é a contagem verdadeira, e é ela que mostra onde falta trabalho.
update public.events set status = 'hidden', updated_at = now()
where municipality_id = 'macao'
  and status = 'published'
  and title in ('Época Balnear no Concelho de Mação - 2026', 'Acontece em Mação... em Agosto');

insert into public.manual_overrides (event_id, field, value, actor, note)
select id, 'status', to_jsonb('hidden'::text), 'levantamento 2026-08-30',
       'Aviso municipal com ar de evento, não é programação cultural. '
       'O detetor `looksLikeMunicipalNotice` já o reconhece.'
from public.events
where municipality_id = 'macao'
  and title in ('Época Balnear no Concelho de Mação - 2026', 'Acontece em Mação... em Agosto')
on conflict (event_id, field) do nothing;

update public.events e set has_manual_overrides = true
where exists (select 1 from public.manual_overrides o where o.event_id = e.id)
  and not e.has_manual_overrides;

-- ---------------------------------------------------------------------------
do $$
declare
  v_na_fila integer;
  v_excluir jsonb;
  v_avisos  integer;
begin
  select count(*) into v_na_fila from public.submissions where status = 'pending';
  if v_na_fila <> 0 then
    raise notice 'ficam % candidatos na fila de moderação', v_na_fila;
  end if;

  select config -> 'excludeTitles' into v_excluir from public.sources where id = 'cm-sardoal';
  if v_excluir is null or jsonb_array_length(v_excluir) < 2 then
    raise exception 'a fonte de Sardoal ficou sem a exclusão da reunião de câmara';
  end if;

  -- Um aviso escondido sem bloqueio volta a ser publicado hoje à noite.
  select count(*) into v_avisos
  from public.events e
  where e.status = 'hidden'
    and e.municipality_id = 'macao'
    and not exists (
      select 1 from public.manual_overrides o
      where o.event_id = e.id and o.field = 'status'
    );
  if v_avisos <> 0 then
    raise exception '% avisos escondidos ficaram sem bloqueio de status', v_avisos;
  end if;
end
$$;
