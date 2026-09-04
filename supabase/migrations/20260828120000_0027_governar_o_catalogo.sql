-- 0027 — Governar o catálogo sem passar pelo SQL à mão.
--
-- Faltava a coisa mais elementar: não havia como publicar um evento. O
-- backoffice tem fila, fontes, espaços, etiquetas, qualidade, estatísticas e
-- auditoria — e nenhuma página que liste os eventos. Tudo o que a recolha
-- escreve nasce em rascunho, por desenho, e não havia botão nenhum que o
-- tirasse de lá. Os sessenta e quatro primeiros eventos do sítio foram
-- publicados por `update` à mão, o que é a definição de um buraco.
--
-- A regra do projeto é que a aplicação não escreve em `events` diretamente:
-- escreve-se pelas funções, e são elas que deixam rasto. Esta segue-a.
--
-- A escrita é uma só, mas **a auditoria é uma linha por evento**, com o seu
-- próprio antes e depois. É isso que mantém cada mudança individualmente
-- reversível a partir de `/admin/auditoria`: registar o lote como um
-- acontecimento só pouparia linhas e tornaria irreversível o que agora se
-- desfaz um a um.

create or replace function public.set_event_status(
  p_ids     uuid[],
  p_status  public.event_status,
  p_actor   text,
  p_ip_hash text default null
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento record;
  v_contados integer := 0;
begin
  if p_actor is null or p_actor = '' then
    raise exception 'sem autor não se muda o estado de nada';
  end if;

  -- O mesmo tecto da página. Não é uma limitação técnica: é o que se consegue
  -- auditar de uma vez sem a ação demorar, e o que uma pessoa consegue mesmo
  -- ter olhado antes de carregar no botão.
  if array_length(p_ids, 1) > 50 then
    raise exception 'no máximo 50 eventos de cada vez, e vieram %', array_length(p_ids, 1);
  end if;

  for v_evento in
    select id, status, municipality_id, title, published_at
    from public.events
    where id = any(p_ids)
    for update
  loop
    -- Um evento que já está no estado pedido não conta nem gera auditoria:
    -- senão um lote repetido enchia o registo de linhas que não dizem nada.
    continue when v_evento.status = p_status;

    update public.events set
      status = p_status,
      -- `published_at` marca a primeira ida ao ar e não se reescreve: é dele
      -- que se sabe há quanto tempo uma coisa está publicada, e repô-lo a cada
      -- despublicar-e-voltar-a-publicar apagava essa história.
      published_at = case
        when p_status = 'published' and published_at is null then now()
        else published_at
      end,
      updated_at = now()
    where id = v_evento.id;

    insert into public.admin_actions (actor, action, entity_type, entity_id, before, after, ip_hash)
    values (
      p_actor,
      'set_status',
      'event',
      v_evento.id::text,
      jsonb_build_object('status', v_evento.status, 'title', v_evento.title),
      jsonb_build_object('status', p_status, 'title', v_evento.title),
      p_ip_hash
    );

    v_contados := v_contados + 1;
  end loop;

  return v_contados;
end;
$$;

comment on function public.set_event_status(uuid[], public.event_status, text, text) is
  'Muda o estado de até 50 eventos, com uma linha de auditoria por evento. '
  'É o único caminho pelo qual a aplicação publica ou despublica.';

-- Como todas as outras: quem chega pela chave anónima não lhe toca.
revoke all on function public.set_event_status(uuid[], public.event_status, text, text)
  from public, anon, authenticated;

do $$
declare
  v_id uuid;
  v_antes public.event_status;
  v_n integer;
begin
  select id, status into v_id, v_antes
  from public.events where is_canonical order by id limit 1;

  if v_id is null then
    raise notice 'catálogo vazio — asserção saltada';
    return;
  end if;

  -- Vai e volta, para não deixar a base diferente do que estava.
  v_n := public.set_event_status(array[v_id], 'hidden', 'migração 0027');
  if v_n <> 1 or (select status from public.events where id = v_id) <> 'hidden' then
    raise exception 'set_event_status não mudou o estado';
  end if;

  if not exists (
    select 1 from public.admin_actions
    where entity_id = v_id::text and actor = 'migração 0027'
      and before->>'status' = v_antes::text and after->>'status' = 'hidden'
  ) then
    raise exception 'set_event_status não deixou rasto na auditoria';
  end if;

  perform public.set_event_status(array[v_id], v_antes, 'migração 0027');
  if (select status from public.events where id = v_id) <> v_antes then
    raise exception 'a reposição da asserção falhou — a base ficou diferente';
  end if;

  -- E o tecto tem de travar.
  begin
    perform public.set_event_status(
      (select array_agg(gen_random_uuid()) from generate_series(1, 51)), 'hidden', 'migração 0027');
    raise exception 'o tecto de 50 não travou';
  exception when others then
    if position('no máximo 50' in sqlerrm) = 0 then raise; end if;
  end;
end
$$;
