-- 0014 — Reconciliação: o que fazer quando um evento desaparece da fonte.
--
-- Sem isto, um evento cancelado ou retirado do site da câmara ficava no
-- Coreto para sempre e levava alguém a uma porta fechada. Com isto mal feito,
-- acontece o contrário e pior: uma falha de rede que devolve uma lista vazia
-- «com sucesso» apaga o catálogo de um concelho inteiro em três noites.
--
-- O desenho leva as duas coisas em conta:
--   * um evento futuro só é retirado ao fim de 3 recolhas seguidas sem o ver;
--   * conta no máximo uma falta por dia, para que uma reexecução manual não
--     acelere a remoção;
--   * eventos passados há mais de 90 dias saem sem contemplações — não há
--     dúvida nenhuma sobre eles;
--   * eventos que não vieram de recolha (submetidos por email ou formulário)
--     ficam de fora do confronto: a recolha nunca os viu, por isso «não estar
--     na recolha» não diz nada sobre eles.
--
-- A trava de segurança — recusar reconciliar quando a recolha rendeu pouco
-- demais — está do lado do TypeScript, em `packages/core/src/lifecycle.ts`,
-- porque é uma decisão que se quer testável sem base de dados.

alter table public.events
  add column miss_count smallint not null default 0,
  add column last_missed_on date,
  add column archived_reason text;

comment on column public.events.miss_count is
  'Recolhas seguidas em que a fonte deixou de mostrar este evento.';
comment on column public.events.last_missed_on is
  'Dia da última falta contada. Impede que duas execuções no mesmo dia contem duas vezes.';

create index events_missing_idx on public.events (source_id, miss_count)
  where miss_count > 0;

/**
 * Marca em falta os eventos de uma fonte que não vieram nesta recolha.
 *
 * `p_seen_keys` são os `source_key` que a recolha viu. Devolve o que fez, para
 * o registo da execução poder dizer quantos eventos foram retirados e quantos
 * estão a caminho disso.
 *
 * Quem chama é responsável por NÃO chamar quando a recolha rendeu pouco
 * demais (ver `shouldSkipReconcile`). Esta função confia em quem a chama, e
 * por isso a trava tem de estar antes.
 */
create or replace function public.reconcile_source_events(
  p_source_id text,
  p_seen_keys text[],
  p_today date default current_date,
  p_miss_threshold smallint default 3,
  p_past_days integer default 90
)
returns table (marked integer, archived integer, recovered integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marked integer := 0;
  v_archived integer := 0;
  v_recovered integer := 0;
begin
  -- Quem voltou a aparecer perde o histórico de faltas e volta ao ar.
  --
  -- Duas coisas de uma vez, e a segunda é a que importa: um evento adiado e
  -- reposto não pode chegar ao limiar por acumulação de meses, e um evento
  -- que foi retirado por ausência tem de voltar quando a fonte o repõe —
  -- caso contrário uma noite de rede má tirava-o do site para sempre.
  --
  -- Só ressuscita o que ESTA reconciliação escondeu (`archived_reason` a
  -- dizê-lo). Um evento escondido por decisão de quem modera não é reposto
  -- pela recolha: essa decisão é humana e ganha.
  with seen as (
    update public.events
       set miss_count = 0,
           last_missed_on = null,
           last_seen_at = now(),
           status = case
                      when status = 'hidden' and archived_reason = 'ausente-da-fonte'
                        then 'published'::public.event_status
                      else status
                    end,
           archived_reason = case
                               when status = 'hidden' and archived_reason = 'ausente-da-fonte'
                                 then null
                               else archived_reason
                             end
     where source_id = p_source_id
       and source_key = any(p_seen_keys)
       and (miss_count > 0 or (status = 'hidden' and archived_reason = 'ausente-da-fonte'))
    returning 1
  )
  select count(*) into v_recovered from seen;

  -- Passado remoto: sai já. Não há cenário em que um evento de há três meses
  -- volte a interessar a uma agenda.
  with old_events as (
    update public.events
       set status = 'archived',
           archived_reason = 'passado'
     where source_id = p_source_id
       and status = 'published'
       and date_end is not null
       and date_end < p_today - p_past_days
    returning 1
  )
  select count(*) into v_archived from old_events;

  -- Futuro e presente: conta uma falta, no máximo uma por dia.
  with missing as (
    update public.events
       set miss_count = miss_count + 1,
           last_missed_on = p_today
     where source_id = p_source_id
       and status = 'published'
       -- Só o que veio de recolha. O que foi submetido por email ou
       -- formulário nunca esteve na fonte e não pode acumular faltas.
       and origin = 'scraper'
       and not (source_key = any(p_seen_keys))
       and (last_missed_on is null or last_missed_on < p_today)
    returning id, miss_count
  )
  select count(*) into v_marked from missing;

  -- Ao terceiro desaparecimento seguido, sai de cena.
  with gone as (
    update public.events
       set status = 'hidden',
           archived_reason = 'ausente-da-fonte'
     where source_id = p_source_id
       and status = 'published'
       and origin = 'scraper'
       and miss_count >= p_miss_threshold
    returning 1
  )
  select v_archived + count(*) into v_archived from gone;

  return query select v_marked, v_archived, v_recovered;
end;
$$;

revoke execute on function public.reconcile_source_events(text, text[], date, smallint, integer)
  from public, anon, authenticated;
grant execute on function public.reconcile_source_events(text, text[], date, smallint, integer)
  to service_role;
