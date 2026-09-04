-- 0117 — Ligar um sítio é um clique.
--
-- A 2 de setembro de 2026, cinquenta e oito dos cento e oito eventos
-- publicados por acontecer não apontavam a espaço nenhum do catálogo. O nome
-- do sítio estava em `location_name`, em texto solto, tal como a fonte o
-- escreveu — e na maior parte dos casos o catálogo TINHA o espaço. O que
-- faltava era a linha de `venue_aliases` a dizer que «Cine Teatro Paraíso» e
-- o Cine-Teatro Paraíso são a mesma casa.
--
-- Ligar um nome ao espaço era escrever uma migração. Uma migração é um custo
-- que se paga por lotes, quando alguém tem uma tarde: a 0078 fechou trinta e
-- três nomes de uma vez, e foi a única que o fez. Entre lotes a fila enche, e
-- os eventos ficam sem mapa, sem morada e sem a ficha do espaço a dizer onde
-- é. Cinquenta e oito em cento e oito é o tamanho do intervalo entre tardes.
--
-- ## O que muda, e porque é que não parte a regra da casa
--
-- A regra está escrita em `/admin/etiquetas` e estava em `/admin/espacos`:
-- «resolver é uma migração, não um botão. Uma alteração feita a partir da
-- web não fica no repositório, e uma base de dados que já não se reconstrói
-- do repositório é o princípio do fim.» Continua a valer para o que é
-- desenho — a taxonomia, e o CATÁLOGO de espaços.
--
-- Mas ligar um nome que uma fonte escreve a um espaço que JÁ ESTÁ no
-- catálogo não é desenho. É trabalho editorial, da mesma natureza de aprovar
-- uma submissão (0006) ou de editar a prosa de uma região no painel (0109).
-- Nenhuma dessas fica no repositório, e ninguém acha que devia: o registo
-- delas é `admin_actions`, com quem e quando, e a cópia de segurança da base
-- (docs/BACKUPS.md), que é o que se restaura. Um alias passa a ser a mesma
-- coisa. Quem vê a fila é quem a fecha, à hora a que a vê, sem abrir um
-- editor de SQL. O que se perde é a linha no repositório; o que se ganha é
-- que a fila deixa de esperar por uma tarde.
--
-- O que NÃO muda: criar um espaço novo continua a ser uma migração, e não
-- por teimosia. Um espaço precisa de morada, coordenadas, tipo e de uma nota
-- a dizer quem confirmou o quê, onde e quando — leia-se a 0078, quatro
-- espaços, cada um contra fonte primária. Isso é catálogo, com proveniência,
-- e o repositório é que o reconstrói. O painel fica com o SQL desse caso e
-- de mais nenhum.
--
-- ## As duas funções
--
-- `set_venue_alias` faz o que a 0078 fazia à mão: grava o alias — preso ao
-- concelho quando o nome traz concelho, regional quando não traz — e liga os
-- eventos que estavam à espera desse nome. Com duas recusas e uma reserva:
--
--   · recusa um alias de um concelho a apontar a um espaço de outro: um nome
--     de Tomar não pode mandar um evento para um teatro de Abrantes;
--   · recusa um autor vazio, como todas as outras;
--   · e ao ligar os eventos aplica a regra que a recolha aplica (0051, 0067):
--     o evento só se liga se estiver no concelho do espaço. A 0078 não
--     verificava isto e não lhe fez falta, porque cada alias foi escrito à
--     mão com o caso à frente; um botão não tem esse cuidado, por isso a
--     função tem de o ter. E o que uma pessoa trancou (0015) não se pisa: um
--     `venue_id` em `manual_overrides` fica como está.
--
-- `dismiss_unresolved_venue` é o «não é um sítio» — «Vários locais», «A
-- anunciar», o nome de um concelho. Marca a linha, deixa o histórico de
-- quantas vezes apareceu, e regista quem decidiu.
--
-- E a fila passa a dizer, por nome, quantos eventos publicados e ainda por
-- acontecer estão à espera dele. É por aí que se decide o que ligar
-- primeiro: um nome visto cem vezes em eventos que já passaram vale menos do
-- que um visto três vezes no sábado que vem.
-- ---------------------------------------------------------------------------

create or replace function public.set_venue_alias(
  p_name            text,
  p_venue_id        text,
  p_municipality_id text,
  p_actor           text
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alias     text;
  v_concelho  text;     -- o do alias: o pedido, ou nulo quando é regional
  v_do_espaco text;     -- o concelho onde o espaço fica
  v_antes     text;     -- a que espaço este alias apontava, se já existia
  v_ligados   integer;
begin
  if p_actor is null or p_actor = '' then
    raise exception 'sem autor não se liga nome nenhum a espaço nenhum';
  end if;

  v_alias := public.normalize_for_hash(coalesce(p_name, ''));
  if v_alias = '' then
    raise exception 'o nome «%» não tem letras nem números com que fazer um alias', p_name;
  end if;

  select v.municipality_id into v_do_espaco
  from public.venues v
  where v.id = p_venue_id;
  if not found then
    raise exception 'não há espaço com o identificador %', p_venue_id;
  end if;

  -- Um formulário fala em texto: o concelho vazio é o alias regional.
  v_concelho := nullif(p_municipality_id, '');
  if v_concelho is not null and v_concelho <> v_do_espaco then
    raise exception 'um nome de % não pode apontar a um espaço de % (%)',
      v_concelho, v_do_espaco, p_venue_id;
  end if;

  select a.venue_id into v_antes
  from public.venue_aliases a
  where a.alias = v_alias and a.ambito = coalesce(v_concelho, '');

  insert into public.venue_aliases (alias, venue_id, municipality_id)
  values (v_alias, p_venue_id, v_concelho)
  on conflict (alias, ambito) do update set venue_id = excluded.venue_id;

  -- Os eventos que estavam à espera deste nome. É o `update` da 0078, com a
  -- regra da recolha por cima: só no concelho do espaço, e nunca por cima de
  -- um `venue_id` que alguém trancou à mão. O que está escondido, cancelado
  -- ou arquivado fica quieto — não é a agenda, e ninguém o vai ver.
  update public.events e
     set venue_id = p_venue_id, updated_at = now()
   where e.venue_id is null
     and e.location_name is not null
     and public.normalize_for_hash(e.location_name) = v_alias
     and e.municipality_id = v_do_espaco
     and e.is_canonical
     and e.status in ('published', 'draft')
     and not exists (
       select 1 from public.manual_overrides o
        where o.event_id = e.id and o.field = 'venue_id'
     );
  get diagnostics v_ligados = row_count;

  perform public.log_admin_action(
    p_actor,
    'venue.alias',
    'venue_alias',
    v_alias || '/' || coalesce(v_concelho, ''),
    case when v_antes is null then null else jsonb_build_object('venue_id', v_antes) end,
    jsonb_build_object(
      'name', p_name,
      'venue_id', p_venue_id,
      'municipality_id', v_concelho,
      'events_linked', v_ligados
    )
  );

  return v_ligados;
end;
$$;

comment on function public.set_venue_alias(text, text, text, text) is
  'Grava um alias de espaço — preso ao concelho ou regional — e liga-lhe os '
  'eventos que estavam à espera desse nome, com uma linha de auditoria. '
  'Devolve quantos eventos ligou. É o caminho pelo qual o painel escreve em '
  '`venue_aliases`; criar o espaço em si continua a ser uma migração.';

revoke all on function public.set_venue_alias(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.set_venue_alias(text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------

create or replace function public.dismiss_unresolved_venue(
  p_normalized text,
  p_actor      text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text;
begin
  if p_actor is null or p_actor = '' then
    raise exception 'sem autor não se põe nome nenhum de lado';
  end if;

  -- Uma linha que não existe, ou que já estava de lado, não é um
  -- acontecimento: nem se escreve nem se regista. É a regra do interruptor
  -- das secções (0074) — carregar duas vezes no mesmo botão não enche a
  -- auditoria de linhas que não dizem nada.
  update public.unresolved_venues
     set dismissed = true
   where normalized = p_normalized
     and not dismissed
  returning name into v_nome;
  if not found then
    return;
  end if;

  perform public.log_admin_action(
    p_actor,
    'venue.dismiss',
    'unresolved_venue',
    p_normalized,
    jsonb_build_object('name', v_nome, 'dismissed', false),
    jsonb_build_object('name', v_nome, 'dismissed', true)
  );
end;
$$;

comment on function public.dismiss_unresolved_venue(text, text) is
  'Marca um nome da fila de espaços por resolver como «não é um sítio», com '
  'uma linha de auditoria. O histórico de quantas vezes apareceu fica. Um '
  'nome que não está na fila não é um acontecimento e não regista nada.';

revoke all on function public.dismiss_unresolved_venue(text, text)
  from public, anon, authenticated;
grant execute on function public.dismiss_unresolved_venue(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- A fila diz quantos eventos estão à espera de cada nome.
--
-- As sete colunas da 0067 ficam como estão e pela mesma ordem — é a condição
-- do `create or replace view` — e a oitava entra no fim. A regra de «o que
-- hoje não resolve» é a da 0067, palavra por palavra: tem de continuar a ser
-- a mesma que `resolveVenueInMunicipality` aplica na recolha.
-- ---------------------------------------------------------------------------

create or replace view public.unresolved_venues_pendentes
with (security_invoker = true) as
select u.normalized,
       u.name,
       u.municipality_id,
       u.hits,
       u.first_seen,
       u.last_seen,
       u.example_url,
       (
         select count(*)::integer
           from public.events e
          where e.venue_id is null
            and e.location_name is not null
            and e.status = 'published'
            and e.is_canonical
            and coalesce(e.date_end, e.date_start) >= current_date
            and public.normalize_for_hash(e.location_name) = u.normalized
            and (u.municipality_id is null or e.municipality_id = u.municipality_id)
       ) as eventos_por_acontecer
from public.unresolved_venues u
where not u.dismissed
  and not exists (
    select 1
    from public.venue_aliases a
    join public.venues v on v.id = a.venue_id
    where a.alias = u.normalized
      and (
        a.municipality_id = u.municipality_id
        or (
          a.municipality_id is null
          and (u.municipality_id is null or v.municipality_id = u.municipality_id)
        )
      )
  );

comment on view public.unresolved_venues_pendentes is
  'A fila de espaços por resolver, sem o que já foi resolvido. Aplica a mesma '
  'regra que a recolha: o alias preso ao concelho ganha, o regional só vale se '
  'não apontar a um espaço de outro concelho. Uma linha sai da fila no '
  'instante em que ganha alias, sem ninguém a ter de a apagar. '
  '`eventos_por_acontecer` conta os eventos publicados, canónicos e ainda por '
  'acontecer que estão à espera desse nome — é a ordem por que vale a pena '
  'trabalhar a fila.';

-- ---------------------------------------------------------------------------
do $$
declare
  v_colunas text;
  n         integer;
begin
  -- As sete de sempre, pela ordem de sempre, e a oitava no fim. O painel lê
  -- as colunas pelo nome, mas quem recria a vista lê-as pela posição.
  select string_agg(column_name, ',' order by ordinal_position) into v_colunas
  from information_schema.columns
  where table_schema = 'public' and table_name = 'unresolved_venues_pendentes';
  if v_colunas <> 'normalized,name,municipality_id,hits,first_seen,last_seen,example_url,eventos_por_acontecer' then
    raise exception 'a vista ficou com as colunas «%»', v_colunas;
  end if;

  -- Só a chave de serviço chama as duas.
  if has_function_privilege('anon', 'public.set_venue_alias(text, text, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.set_venue_alias(text, text, text, text)', 'execute')
     or has_function_privilege('anon', 'public.dismiss_unresolved_venue(text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.dismiss_unresolved_venue(text, text)', 'execute')
  then
    raise exception 'as funções do painel de espaços ficaram executáveis pelo público';
  end if;

  -- Um espaço que não existe é recusado antes de se escrever seja o que for.
  begin
    perform public.set_venue_alias('Um nome qualquer', 'espaco-que-nao-existe', null, 'migração 0117');
    raise exception 'set_venue_alias aceitou um espaço que não existe';
  exception when others then
    if sqlerrm = 'set_venue_alias aceitou um espaço que não existe' then raise; end if;
  end;

  -- Sem autor, nada.
  begin
    perform public.set_venue_alias('Um nome qualquer', 'espaco-que-nao-existe', null, '');
    raise exception 'set_venue_alias aceitou um autor vazio';
  exception when others then
    if sqlerrm = 'set_venue_alias aceitou um autor vazio' then raise; end if;
  end;

  -- Pôr de lado um nome que não está na fila não escreve nem regista nada.
  perform public.dismiss_unresolved_venue('nomequenuncaesteveaqui0117', 'migração 0117');
  select count(*) into n from public.admin_actions
  where action = 'venue.dismiss' and entity_id = 'nomequenuncaesteveaqui0117';
  if n <> 0 then
    raise exception 'dismiss_unresolved_venue registou um nome que não existe';
  end if;
end
$$;
