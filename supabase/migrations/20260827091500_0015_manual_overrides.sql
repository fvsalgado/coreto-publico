-- 0015 — Bloqueios manuais: o que uma pessoa corrigiu não volta a ser pisado.
--
-- O problema que isto resolve é o que faz uma equipa desistir de moderar. Um
-- editor corrige a data de um evento que a câmara publicou errada; nessa
-- noite a recolha corre, lê a mesma data errada e escreve-a por cima. Na
-- manhã seguinte o erro está de volta, e ninguém percebe porquê. Ao fim de
-- duas ou três vezes, ninguém corrige mais nada.
--
-- A partir daqui, cada campo que uma pessoa toca fica marcado. A recolha
-- continua a atualizar tudo o resto — o que não se quer é o contrário, um
-- evento congelado inteiro por causa de uma vírgula corrigida.

create table public.manual_overrides (
  event_id    uuid not null references public.events(id) on delete cascade,
  field       text not null,
  value       jsonb,
  actor       text not null,
  note        text,
  created_at  timestamptz not null default now(),
  primary key (event_id, field)
);

create index manual_overrides_event_idx on public.manual_overrides (event_id);

comment on table public.manual_overrides is
  'Campos de um evento corrigidos à mão. A recolha nunca escreve por cima destes.';

alter table public.manual_overrides enable row level security;
-- Sem policy: só a chave de serviço.

alter table public.events
  add column has_manual_overrides boolean not null default false;

comment on column public.events.has_manual_overrides is
  'Atalho de leitura para o backoffice saber, sem juntar tabelas, que este '
  'evento tem correções a proteger.';

/**
 * Marca campos como corrigidos à mão.
 *
 * `p_fields` é a lista de colunas de `events` que a pessoa editou. Guarda-se
 * também o valor, para que o backoffice possa mostrar «a fonte diz X, nós
 * dizemos Y» em vez de esconder o conflito.
 */
create or replace function public.lock_event_fields(
  p_event_id uuid,
  p_fields text[],
  p_actor text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event jsonb;
  v_field text;
  v_count integer := 0;
begin
  select to_jsonb(e) into v_event from public.events e where e.id = p_event_id;
  if v_event is null then
    raise exception 'evento % não existe', p_event_id;
  end if;

  foreach v_field in array p_fields
  loop
    -- Só se bloqueiam colunas que existem. Um nome errado passaria a ser um
    -- bloqueio fantasma que ninguém consegue levantar.
    if not (v_event ? v_field) then
      raise exception 'coluna % não existe em events', v_field;
    end if;

    insert into public.manual_overrides (event_id, field, value, actor, note)
    values (p_event_id, v_field, v_event -> v_field, p_actor, p_note)
    on conflict (event_id, field) do update set
      value = excluded.value,
      actor = excluded.actor,
      note = excluded.note,
      created_at = now();
    v_count := v_count + 1;
  end loop;

  update public.events set has_manual_overrides = true where id = p_event_id;

  perform public.log_admin_action(
    p_actor, 'event.lock_fields', 'event', p_event_id::text,
    null, jsonb_build_object('fields', p_fields), null
  );

  return v_count;
end;
$$;

/** Levanta bloqueios. Sem `p_fields`, levanta todos. */
create or replace function public.unlock_event_fields(
  p_event_id uuid,
  p_actor text,
  p_fields text[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.manual_overrides
   where event_id = p_event_id
     and (p_fields is null or field = any(p_fields));
  get diagnostics v_count = row_count;

  update public.events e
     set has_manual_overrides = exists (
           select 1 from public.manual_overrides m where m.event_id = e.id
         )
   where e.id = p_event_id;

  perform public.log_admin_action(
    p_actor, 'event.unlock_fields', 'event', p_event_id::text,
    jsonb_build_object('fields', p_fields), null, null
  );

  return v_count;
end;
$$;

/** Os campos bloqueados de um evento, para a recolha os retirar do que escreve. */
create or replace function public.locked_fields(p_event_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(field order by field), '{}')
    from public.manual_overrides
   where event_id = p_event_id;
$$;

revoke execute on function public.lock_event_fields(uuid, text[], text, text) from public, anon, authenticated;
revoke execute on function public.unlock_event_fields(uuid, text, text[]) from public, anon, authenticated;
revoke execute on function public.locked_fields(uuid) from public, anon, authenticated;
grant execute on function public.lock_event_fields(uuid, text[], text, text) to service_role;
grant execute on function public.unlock_event_fields(uuid, text, text[]) to service_role;
grant execute on function public.locked_fields(uuid) to service_role;
