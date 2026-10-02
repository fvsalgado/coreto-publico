-- 0174 — As fontes governam-se no painel: pausar com prazo, retomar, reabrir,
-- ligar e desligar, com rasto.
--
-- O painel só as mostrava (C4-032): uma tabela de leitura, zero botões, e o
-- erro cortado aos sessenta caracteres. «A agenda da câmara X deixou de
-- aparecer — o que se passa?» é a pergunta que uma CIM mais vai fazer, e a
-- resposta era SQL em `docs/OPERACAO.md`. E «desligar a fonte a pedido do
-- município», que o contrato prevê, não tinha botão.
--
-- Cinco gestos, cada um uma função com a sua linha na auditoria — a aplicação
-- continua a não escrever em `sources`:
--
--   * **pausar** — a pausa declarada da 0159: até uma data e com um motivo,
--     e nesse dia o alarme volta sozinho. Não impede a recolha de tentar; cala
--     o painel e o `/estado`, que dizem porquê. A data tem de ser futura e no
--     máximo a noventa dias: uma pausa sem fim é um alarme apagado com outro
--     nome, e noventa dias chegam para a resposta a uma carta;
--   * **retomar** — tirar a pausa antes do prazo;
--   * **reabrir** — a pausa automática (o `circuit_open_until`), que a
--     recolha abre ao fim de falhas seguidas: volta a tentar na recolha
--     seguinte, como o `update` que o manual mandava escrever à mão;
--   * **ligar** e **desligar** — a decisão sem data, «o município pediu».
--     Desligar pede o motivo, que fica na auditoria; ligar não pede nada.
--
-- Quem pode, decide-o a aplicação, pela região da fonte (o gestor dela, ou o
-- dono — `CONTAS.md`); as funções guardam o que é da base: o prazo, o motivo
-- e o rasto.
--
-- Seguro para o sítio de hoje: cinco funções novas, que o sítio publicado não
-- chama. A pausa usa as colunas e a restrição da 0159, que já lá estão.

create or replace function public.pausar_fonte(
  p_fonte   text,
  p_ate     timestamptz,
  p_motivo  text,
  p_actor   text,
  p_ip_hash text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se pausa fonte nenhuma';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'uma pausa precisa de um motivo — quem a vir no painel ou no /estado lê-o';
  end if;
  if length(btrim(p_motivo)) > 280 then
    raise exception 'o motivo tem no máximo 280 caracteres — aparece na página pública /estado';
  end if;
  if p_ate is null or p_ate <= now() then
    raise exception 'a pausa tem de acabar num dia que ainda não passou';
  end if;
  if p_ate > now() + interval '90 days' then
    raise exception 'uma pausa dura no máximo noventa dias — e nesse dia o alarme volta sozinho';
  end if;

  select jsonb_build_object('pausada_ate', s.pausada_ate, 'pausa_motivo', s.pausa_motivo)
    into v_antes
    from public.sources s where s.id = p_fonte for update;
  if v_antes is null then
    raise exception 'esta fonte já não existe';
  end if;

  update public.sources
     set pausada_ate = p_ate, pausa_motivo = btrim(p_motivo), updated_at = now()
   where id = p_fonte;

  perform public.log_admin_action(
    p_actor, 'fonte.pausar', 'source', p_fonte, v_antes,
    jsonb_build_object('pausada_ate', p_ate, 'pausa_motivo', btrim(p_motivo)), p_ip_hash
  );
end;
$$;

create or replace function public.retomar_fonte(
  p_fonte   text,
  p_actor   text,
  p_ip_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se retoma fonte nenhuma';
  end if;
  select jsonb_build_object('pausada_ate', s.pausada_ate, 'pausa_motivo', s.pausa_motivo)
    into v_antes
    from public.sources s where s.id = p_fonte for update;
  if v_antes is null then
    raise exception 'esta fonte já não existe';
  end if;
  if v_antes ->> 'pausada_ate' is null then
    return false;
  end if;

  update public.sources
     set pausada_ate = null, pausa_motivo = null, updated_at = now()
   where id = p_fonte;

  perform public.log_admin_action(
    p_actor, 'fonte.retomar', 'source', p_fonte, v_antes,
    jsonb_build_object('pausada_ate', null, 'pausa_motivo', null), p_ip_hash
  );
  return true;
end;
$$;

create or replace function public.reabrir_fonte(
  p_fonte   text,
  p_actor   text,
  p_ip_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se reabre fonte nenhuma';
  end if;
  select jsonb_build_object('circuit_open_until', s.circuit_open_until,
                            'consecutive_failures', s.consecutive_failures)
    into v_antes
    from public.sources s where s.id = p_fonte for update;
  if v_antes is null then
    raise exception 'esta fonte já não existe';
  end if;
  if v_antes ->> 'circuit_open_until' is null
     and coalesce((v_antes ->> 'consecutive_failures')::integer, 0) = 0 then
    return false;
  end if;

  update public.sources
     set circuit_open_until = null, consecutive_failures = 0, updated_at = now()
   where id = p_fonte;

  perform public.log_admin_action(
    p_actor, 'fonte.reabrir', 'source', p_fonte, v_antes,
    jsonb_build_object('circuit_open_until', null, 'consecutive_failures', 0), p_ip_hash
  );
  return true;
end;
$$;

create or replace function public.definir_fonte_ligada(
  p_fonte   text,
  p_ligada  boolean,
  p_motivo  text,
  p_actor   text,
  p_ip_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes boolean;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'sem autor não se liga nem desliga fonte nenhuma';
  end if;
  if p_ligada is null then
    raise exception 'ligar ou desligar — a escolha não pode ficar em branco';
  end if;
  if not p_ligada and coalesce(btrim(p_motivo), '') = '' then
    raise exception 'desligar uma fonte precisa de um motivo — «o município pediu», «a agenda mudou de sítio»';
  end if;

  select s.is_enabled into v_antes from public.sources s where s.id = p_fonte for update;
  if not found then
    raise exception 'esta fonte já não existe';
  end if;
  if v_antes = p_ligada then
    return false;
  end if;

  update public.sources set is_enabled = p_ligada, updated_at = now() where id = p_fonte;

  perform public.log_admin_action(
    p_actor, case when p_ligada then 'fonte.ligar' else 'fonte.desligar' end, 'source', p_fonte,
    jsonb_build_object('is_enabled', v_antes),
    jsonb_build_object('is_enabled', p_ligada, 'motivo', nullif(btrim(coalesce(p_motivo, '')), '')),
    p_ip_hash
  );
  return true;
end;
$$;

comment on function public.pausar_fonte(text, timestamptz, text, text, text) is
  'Cala o alarme de uma fonte até uma data (no máximo a noventa dias), com um motivo que o /estado mostra. Não impede a recolha de tentar. Linha fonte.pausar na auditoria.';
comment on function public.retomar_fonte(text, text, text) is
  'Tira a pausa declarada de uma fonte antes do prazo. Falso se não havia pausa. Linha fonte.retomar.';
comment on function public.reabrir_fonte(text, text, text) is
  'Reabre a pausa automática da recolha (circuit_open_until, falhas seguidas): a fonte volta a ser tentada na recolha seguinte. Falso se não havia nada a reabrir. Linha fonte.reabrir.';
comment on function public.definir_fonte_ligada(text, boolean, text, text, text) is
  'Liga ou desliga uma fonte — a decisão sem data. Desligar pede motivo, que fica na auditoria. Falso se já estava assim. Linhas fonte.ligar e fonte.desligar.';

revoke all on function public.pausar_fonte(text, timestamptz, text, text, text) from public, anon, authenticated;
revoke all on function public.retomar_fonte(text, text, text) from public, anon, authenticated;
revoke all on function public.reabrir_fonte(text, text, text) from public, anon, authenticated;
revoke all on function public.definir_fonte_ligada(text, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.pausar_fonte(text, timestamptz, text, text, text) to service_role;
grant execute on function public.retomar_fonte(text, text, text) to service_role;
grant execute on function public.reabrir_fonte(text, text, text) to service_role;
grant execute on function public.definir_fonte_ligada(text, boolean, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- As provas, numa transação que se desfaz
-- ---------------------------------------------------------------------------
do $$
declare
  v_fonte   text;
  v_recusou boolean;
begin
  select id into v_fonte from public.sources order by id limit 1;
  if v_fonte is null then
    raise exception using errcode = 'DEADA', message = 'sem fontes: nada para provar';
  end if;

  -- Pausar: com prazo e motivo, e o rasto.
  perform public.pausar_fonte(v_fonte, now() + interval '7 days', 'À espera de resposta da câmara', 'prova-0174');
  assert (select pausa_motivo from public.sources where id = v_fonte) = 'À espera de resposta da câmara',
    'a pausa não ficou';
  assert exists (select 1 from public.admin_actions where actor = 'prova-0174' and action = 'fonte.pausar'),
    'a pausa não ficou na auditoria';

  -- Sem motivo, sem fim, ou para lá dos noventa dias: recusa.
  v_recusou := false;
  begin
    perform public.pausar_fonte(v_fonte, now() + interval '7 days', '  ', 'prova-0174');
  exception when raise_exception then v_recusou := true;
  end;
  assert v_recusou, 'uma pausa sem motivo passou';
  v_recusou := false;
  begin
    perform public.pausar_fonte(v_fonte, now() + interval '91 days', 'longa', 'prova-0174');
  exception when raise_exception then v_recusou := true;
  end;
  assert v_recusou, 'uma pausa de mais de noventa dias passou';

  -- Retomar, reabrir, desligar e ligar.
  assert public.retomar_fonte(v_fonte, 'prova-0174'), 'retomar não tirou a pausa';
  assert (select pausada_ate from public.sources where id = v_fonte) is null, 'a pausa ficou';
  update public.sources set circuit_open_until = now() + interval '1 day', consecutive_failures = 5
   where id = v_fonte;
  assert public.reabrir_fonte(v_fonte, 'prova-0174'), 'reabrir não reabriu';
  assert (select consecutive_failures from public.sources where id = v_fonte) = 0, 'as falhas não voltaram a zero';
  v_recusou := false;
  begin
    perform public.definir_fonte_ligada(v_fonte, false, '', 'prova-0174');
  exception when raise_exception then v_recusou := true;
  end;
  assert v_recusou, 'desligar sem motivo passou';
  perform public.definir_fonte_ligada(v_fonte, true, null, 'prova-0174');
  perform public.definir_fonte_ligada(v_fonte, false, 'O município pediu', 'prova-0174');
  assert not (select is_enabled from public.sources where id = v_fonte), 'desligar não desligou';

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
