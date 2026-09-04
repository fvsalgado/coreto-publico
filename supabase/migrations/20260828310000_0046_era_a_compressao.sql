-- 0046 — Era a compressão.
--
-- Quatro recolhas seguidas do Teatro Virgínia esgotaram o tempo de resposta a
-- partir do executor, e três correções falharam porque cada uma supôs a causa
-- em vez de a medir: primeiro o endereço, depois o tempo limite, depois o
-- User-Agent. A quarta tentativa parou de adivinhar e foi perguntar.
--
-- A sondagem — que corre do mesmo executor e faz os pedidos com `curl` —
-- trouxe a mesma página com `200` e os 465 KB completos, em seis segundos. Do
-- mesmo sítio, no mesmo minuto, com o mesmo agente. Ficaram duas hipóteses, e
-- a primeira caiu numa experiência controlada: correr a recolha sem
-- `NODE_EXTRA_CA_CERTS` deu exatamente o mesmo tempo esgotado.
--
-- Restava uma diferença, e era esta: o `curl` da sondagem não pede compressão,
-- e recebe a página tal e qual; o cliente da recolha aceita brotli, e o
-- servidor comprime-lhe meio megabyte de HTML a cada pedido. É trabalho que
-- ele faz de cada vez — e que, ao executor, não acabava dentro de quarenta e
-- cinco segundos.
--
-- Com `semCompressao`, a mesma fonte respondeu em quinze segundos com as
-- vinte e seis sessões da época, cada uma com hora, duração e classificação
-- etária. Nenhuma das quatro recolhas falhadas escreveu o que quer que fosse:
-- o guarda de contagem travou-as todas.
--
-- A época publicada (janeiro a junho de 2026) já passou, por isso o catálogo
-- não muda hoje. Muda na noite em que o Cineclube publicar a próxima.

update public.sources set
  config = coalesce(config, '{}'::jsonb) || '{"semCompressao": true}'::jsonb,
  consecutive_failures = 0,
  circuit_open_until = null,
  last_error = null,
  notes = coalesce(notes || ' ', '') || 'Resolvido a 2026-08-28: o servidor comprimia a página a cada pedido e não acabava dentro do tempo. Com semCompressao, responde em ~15 s com as 26 sessões da época. Diagnóstico feito com a sondagem (curl do mesmo executor, que passava) contra a recolha (Node com brotli, que esgotava).',
  updated_at = now()
where id = 'teatro-virginia';

-- ---------------------------------------------------------------------------
do $$
declare
  v_sem_compressao boolean;
begin
  select (config ->> 'semCompressao')::boolean into v_sem_compressao
    from public.sources where id = 'teatro-virginia';
  if v_sem_compressao is not true then
    raise exception 'a fonte do Virgínia tem de pedir a página sem compressão';
  end if;
end
$$;
