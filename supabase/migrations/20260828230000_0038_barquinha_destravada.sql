-- 0038 — Vila Nova da Barquinha destravada: era a cadeia TLS, e resolve-se
-- do lado de cá.
--
-- A 0011 desligou esta fonte com a razão escrita: o servidor não completava
-- a ligação TLS, nem daqui nem do executor do GitHub. O diagnóstico de
-- 2026-08-28 encontrou a causa exata — o servidor envia o certificado folha
-- (*.cm-vnbarquinha.pt, emitido pela GlobalSign) **sem o intermédio** que o
-- liga à raiz. Os browsers escondem o problema porque vão buscar o
-- intermédio ao URL «CA Issuers» declarado no próprio certificado; o curl e
-- o Node, corretamente, recusam uma cadeia que não conseguem construir.
--
-- A correção não toca na verificação: o intermédio genuíno da GlobalSign
-- (obtido do URL declarado no certificado, validado contra a raiz R6 do
-- armazém de sistema) passa a ser dado ao processo da recolha por
-- NODE_EXTRA_CA_CERTS — estritamente aditivo. O ficheiro, com proveniência
-- e validade no cabeçalho, vive em packages/ingest/certs/.
--
-- Com a ligação a funcionar, a agenda respondeu com nove eventos em
-- com_eventbooking — o mesmo molde dos outros nove concelhos, servido pelo
-- adaptador que já existe. **Com esta fonte ligada, os onze concelhos têm
-- recolha automática.**

update public.sources
   set is_enabled = true,
       -- Nove eventos na sondagem de 2026-08-28; abaixo de dois, ou a agenda
       -- esvaziou ou o TLS voltou a partir — e quer-se saber.
       min_expected_items = 2,
       -- O disjuntor pode ter aberto enquanto a fonte falhava por TLS.
       consecutive_failures = 0,
       circuit_open_until = null,
       notes = 'Religada a 2026-08-28. O servidor envia a cadeia TLS incompleta '
            || '(folha sem intermédio); a recolha compensa com NODE_EXTRA_CA_CERTS '
            || 'a apontar para o intermédio genuíno da GlobalSign em '
            || 'packages/ingest/certs/ (validade até 2027-05-21 — se voltar a '
            || 'falhar por TLS depois dessa data, é renovar o ficheiro). '
            || 'Agenda em com_eventbooking como os outros nove concelhos.',
       updated_at = now()
 where id = 'cm-vnbarquinha';

do $$
declare
  v_fonte record;
begin
  select * into v_fonte from public.sources where id = 'cm-vnbarquinha';
  if v_fonte is null or not v_fonte.is_enabled then
    raise exception 'a fonte cm-vnbarquinha devia ter ficado ligada';
  end if;
  if v_fonte.min_expected_items < 1 then
    raise exception 'fonte ligada sem mínimo esperado declarado';
  end if;
end
$$;
