-- 0076 — Uma recusa que dura mais do que uma noite.
--
-- Em 30 de agosto de 2026, às 01:37, a `0073` recusou quatro candidatos da
-- fila de moderação, um a um, com o motivo escrito. Às 07:39 a recolha da
-- noite correu, e a fila tinha três candidatos por decidir outra vez. Eram,
-- linha a linha, três dos quatro que tinham acabado de ser recusados:
--
--   · `eb-112` (Mação) — o PDF da agenda cultural do bimestre;
--   · `eb-132` (Mação) — o aviso de adiamento da semana de cinema;
--   · `cinema-agosto-2026` (Gil Vicente) — o programa do mês sem uma data.
--
-- O quarto, «Reunião Câmara», não voltou — porque a `0073` não se limitou a
-- recusá-lo: pô-lo em `excludeTitles`, e um candidato excluído na origem não
-- chega a ser produzido. Foi essa assimetria que mostrou onde estava o
-- defeito: a recusa, por si só, não valia nada.
--
-- ## Porque é que voltavam
--
-- Antes de pôr um candidato na fila, a recolha ia ver se ele já lá estava —
-- e ia ver só entre as submissões `pending` e `needs_info`. Uma recusada não
-- constava, logo o candidato era «novo», logo entrava outra vez. O moderador
-- fazia o trabalho e a recolha desfazia-o, todas as noites, para sempre.
--
-- A correcção está no recolector (`loadSubmissionMemory`), e tem duas
-- memórias com granularidades diferentes, de propósito:
--
--   · o que **está à espera de decisão** trava pelo `sourceKey` — é sobre
--     aquele item da fonte, e enquanto lá estiver não se pergunta de novo;
--   · o que **já foi recusado** trava pela impressão digital — título
--     normalizado, data e concelho. Uma recusa é um juízo sobre o que ali
--     estava escrito. Se a fonte mudar o que diz, a impressão digital muda
--     com ela e o candidato volta a ser mostrado a uma pessoa. A recusa nunca
--     fecha a porta à fonte; responde àquele texto.
--
-- Esta migração fecha as três linhas que já voltaram. O código impede as
-- próximas.
-- ---------------------------------------------------------------------------

update public.submissions p set
  status = 'rejected',
  reviewed_at = now(),
  reviewed_by = 'recolha sem memória (0076)',
  -- O motivo da máquina fica: é o que explica porque é que o candidato foi
  -- parar à fila. A decisão humana escreve-se a seguir, e não por cima.
  review_notes =
    case when coalesce(p.review_notes, '') = '' then '' else p.review_notes || ' ' end ||
    'Recusado a 30/08/2026 pela 0073 e reposto na fila pela recolha da mesma '
    'noite, que não lia as submissões já decididas. Fica recusado; o '
    'recolector passou a lembrar-se.',
  updated_at = now()
where p.status in ('pending', 'needs_info')
  and p.fingerprint is not null
  and exists (
    select 1 from public.submissions r
    where r.fingerprint = p.fingerprint
      and r.source_id is not distinct from p.source_id
      and r.status in ('rejected', 'duplicate')
  );

-- ---------------------------------------------------------------------------
do $$
declare
  v_repetidas integer;
begin
  -- A invariante que a partir de hoje se mantém sozinha: nenhuma submissão
  -- por decidir é a repetição de uma que já foi decidida contra. Numa base
  -- vazia é verdade por não haver linhas nenhumas — e é isso que se quer,
  -- que a asserção descreva a regra e não o dia em que foi escrita.
  select count(*) into v_repetidas
  from public.submissions p
  where p.status in ('pending', 'needs_info')
    and p.fingerprint is not null
    and exists (
      select 1 from public.submissions r
      where r.fingerprint = p.fingerprint
        and r.source_id is not distinct from p.source_id
        and r.status in ('rejected', 'duplicate')
    );

  if v_repetidas <> 0 then
    raise exception '% submissões por decidir repetem uma decisão já tomada', v_repetidas;
  end if;
end
$$;
