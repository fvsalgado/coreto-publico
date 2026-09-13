-- 0133 — Os três prazos que a política publicada promete e nenhum código executa.
--
-- O `docs/RGPD.md` §5 tem uma tabela de prazos de conservação com cinco linhas.
-- Três dizem **«Por implementar»**, e são as três com dados de contacto:
-- submissões e anexos (24 meses após a data do evento), `sender_quotas` (24
-- meses após a última submissão) e `admin_actions` (24 meses). A `/privacidade`
-- publica as mesmas frases sem a ressalva — quem a lê não sabe que são
-- intenções. Uma promessa de apagamento que nenhum processo executa é uma
-- promessa que não se cumpre, e o que a torna falsa é o tempo a passar, não um
-- erro de alguém.
--
-- **Isto é profilaxia, e o número diz qual.** Medido em produção a 13 de
-- setembro de 2026: 49 submissões, 0 anexos, 0 quotas de remetente, 185 ações
-- de moderação, 0 linhas de rate_limits — e **zero linhas fora de prazo em
-- qualquer uma das tabelas**. A linha de dados pessoais mais antiga é de
-- 2026-08-28, portanto a primeira coisa que pode caducar caduca a 2028-08-28.
-- Estas funções vão devolver zero todas as noites durante dois anos. O que
-- muda hoje não é uma linha apagada: é a tabela do RGPD.md deixar de dizer
-- «Por implementar» sem mentir.
--
-- ---------------------------------------------------------------------------
-- A âncora: três canais, TRÊS formatos de payload
-- ---------------------------------------------------------------------------
-- O prazo conta «após a data do evento», e a data do evento está dentro do
-- `payload` — em três sítios diferentes, porque cada canal grava a forma que
-- lhe serve:
--
--   recolha    `pipeline.ts` grava `{raw, event, sessions}`, e o `event` é uma
--              `EventRow` → `payload -> 'event' ->> 'date_start'`
--   formulário `build-row.ts` grava um `EventCandidate` liso, que é um
--              `Pick<EventRow, …>` → `payload ->> 'date_start'`
--   email      `api/intake/email/route.ts:262` grava `{...outcome.event}`, que
--              é um `ExtractedEvent` (`packages/core/src/schemas.ts`) — e esse
--              **não tem `date_start`**: as ocorrências vêm em
--              `dates: [{ date, startTime }]`
--
-- O terceiro é o que interessa, e é o que se perde primeiro se alguém olhar
-- para dois: o canal de email é precisamente o que traz `sender_email`,
-- `ip_hash`, `raw_text`, `raw_headers` e anexos. Se a âncora o não souber ler,
-- o `coalesce` recua para `created_at` e apaga a submissão 24 meses depois de
-- ela **chegar** — que pode ser dois anos antes de o evento acontecer, e é o
-- contrário exato da frase publicada. Não saber ler uma data que está ali ao
-- lado não é «não há data»: é «não fui ver».
--
-- Da lista de `dates` conta a **última**, não a primeira: o prazo corre do fim
-- do evento, como já corre no `greatest(date_end, date_start)` de um evento
-- publicado.
--
-- ---------------------------------------------------------------------------

-- Um `text::date` que não rebenta. O cast depende do GUC `DateStyle`, portanto
-- isto é `stable` e nunca `immutable`: marcar por imutável autorizava o
-- planeador a dobrar a chamada em constante e a guardá-la numa expressão de
-- índice, e um dia pagava-se.
create or replace function public.data_ou_nulo(p_texto text)
returns date
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_texto is null then
    return null;
  end if;
  return p_texto::date;
exception when invalid_datetime_format or datetime_field_overflow then
  -- «Não consegui ler» devolve nulo, e quem chama decide o que fazer com isso.
  return null;
end;
$$;

comment on function public.data_ou_nulo(text) is
  'Converte texto em data, devolvendo nulo quando não é uma data — para ler '
  'payloads que ninguém valida à saída. `stable` e não `immutable`: o cast '
  'depende do DateStyle.';

create or replace function public.data_do_evento_na_submissao(p_payload jsonb)
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(
    -- recolha: {raw, event, sessions} (packages/ingest/src/pipeline.ts)
    public.data_ou_nulo(p_payload -> 'event' ->> 'date_end'),
    public.data_ou_nulo(p_payload -> 'event' ->> 'date_start'),
    -- formulário: EventCandidate liso (apps/web/src/lib/submissions/build-row.ts)
    public.data_ou_nulo(p_payload ->> 'date_end'),
    public.data_ou_nulo(p_payload ->> 'date_start'),
    -- email: ExtractedEvent (packages/core/src/schemas.ts), sem date_start —
    -- as ocorrências vêm em dates[] = [{date, startTime}]. A última é a âncora.
    (
      select max(public.data_ou_nulo(d.valor ->> 'date'))
        from jsonb_array_elements(
               case when jsonb_typeof(p_payload -> 'dates') = 'array'
                    then p_payload -> 'dates'
                    else '[]'::jsonb end
             ) as d(valor)
    )
  );
$$;

comment on function public.data_do_evento_na_submissao(jsonb) is
  'A data do evento guardada no payload de uma submissão. Três canais, três '
  'formatos: recolha aninhado em `event`, formulário liso, email em `dates[]`. '
  'Devolve nulo quando nenhum deles tem data legível.';

-- ---------------------------------------------------------------------------
-- Uma definição do prazo, e uma só
-- ---------------------------------------------------------------------------
-- As três funções de expurgo e as asserções leem todas daqui. Um prazo escrito
-- em três sítios são três prazos no dia em que um deles mudar.
create or replace function public.submissoes_caducadas()
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
    from public.submissions s
   where coalesce(
           -- Se a submissão deu origem a um evento, a data dele manda: é a que
           -- a moderação corrigiu, e a do payload é a que a máquina propôs.
           (select greatest(e.date_end, e.date_start)
              from public.events e where e.id = s.resulting_event_id),
           public.data_do_evento_na_submissao(s.payload),
           -- Sem data de evento nenhuma, o prazo conta do que se sabe: a
           -- moderação, e em último caso a chegada.
           s.reviewed_at::date,
           s.created_at::date
         ) < current_date - interval '24 months';
$$;

comment on function public.submissoes_caducadas() is
  'Os ids das submissões cuja conservação passou dos 24 meses após a data do '
  'evento (docs/RGPD.md §5). É a única definição do prazo.';

-- O que tem de sair do balde antes de a linha poder ser apagada. Ler isto é o
-- primeiro passo de um expurgo manual de anexos.
create or replace function public.expired_intake_objects()
returns table (submission_id uuid, storage_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.submission_id, a.storage_path
    from public.submission_attachments a
   where a.submission_id in (select c.id from public.submissoes_caducadas() c)
   order by a.submission_id, a.storage_path;
$$;

comment on function public.expired_intake_objects() is
  'Os ficheiros do balde `intake` que pertencem a submissões caducadas. O SQL '
  'não os apaga: os bytes só saem pela API do Storage.';

-- ---------------------------------------------------------------------------
-- O expurgo das submissões
-- ---------------------------------------------------------------------------
create or replace function public.prune_submissions()
returns table (apagadas integer, retidas integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_apagadas integer;
  v_retidas integer;
begin
  -- O endereço de quem submeteu também está em `admin_actions.before`: a
  -- `reject_submission` e a `approve_submission` gravam lá `to_jsonb(s)` da
  -- linha inteira (0006). Apagar a submissão e deixar a fotografia não é
  -- cumprir o prazo — é mudá-lo de sítio. O rasto fica, que é a
  -- responsabilização do artigo 5.º, n.º 2; os dados de contacto saem.
  --
  -- A marca `expurgado_em` serve duas coisas: diz que aquela linha foi mexida
  -- e por que razão está incompleta, e impede que a noite seguinte volte a
  -- reescrever as mesmas linhas das submissões que ficaram retidas.
  update public.admin_actions a
     set before = (a.before
                    - 'sender_email' - 'sender_name' - 'sender_organisation'
                    - 'ip_hash' - 'user_agent'
                    - 'raw_text' - 'raw_subject' - 'raw_headers')
                  || jsonb_build_object('expurgado_em', current_date)
   where a.entity_type = 'submission'
     and a.before is not null
     and not (a.before ? 'expurgado_em')
     and a.entity_id in (select c.id::text from public.submissoes_caducadas() c);

  -- Um ficheiro no balde privado não sai daqui. Apagar a linha de metadados
  -- deixava os bytes lá dentro sem ninguém que soubesse o caminho: o expurgo
  -- passava a criar exatamente o que diz evitar. Estas ficam, e são contadas.
  --
  -- Contam-se **antes** de apagar, e apagam-se só as outras: uma submissão
  -- retida não é razão para as restantes ficarem por expurgar. Uma exceção
  -- aqui travava o prazo de todas por causa de um anexo.
  select count(distinct a.submission_id) into v_retidas
    from public.submission_attachments a
    join storage.objects o
      on o.bucket_id = 'intake' and o.name = a.storage_path
   where a.submission_id in (select c.id from public.submissoes_caducadas() c);

  delete from public.submissions s
   where s.id in (select c.id from public.submissoes_caducadas() c)
     and not exists (
       select 1
         from public.submission_attachments a
         join storage.objects o
           on o.bucket_id = 'intake' and o.name = a.storage_path
        where a.submission_id = s.id
     );
  get diagnostics v_apagadas = row_count;

  if v_retidas > 0 then
    raise warning
      '% submissão(ões) caducada(s) ficaram por apagar: os anexos ainda estão no balde intake (ver expired_intake_objects)',
      v_retidas;
  end if;

  return query select v_apagadas, v_retidas;
end;
$$;

comment on function public.prune_submissions() is
  'Apaga as submissões caducadas e limpa os dados de contacto que ficaram na '
  'fotografia de `admin_actions.before`. Devolve quantas apagou e quantas '
  'ficaram retidas por terem anexos ainda no balde.';

create or replace function public.prune_sender_quotas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.sender_quotas
   where updated_at < now() - interval '24 months'
     -- Um bloqueio é uma decisão humana e só se desfaz à mão (0018). Apagar a
     -- linha desfazia-o em silêncio e o remetente voltava a passar — o prazo
     -- de conservação não é uma amnistia.
     and not is_blocked;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.prune_sender_quotas() is
  'Apaga as quotas de remetente sem atividade há mais de 24 meses. As linhas '
  'bloqueadas ficam: o bloqueio é uma decisão humana.';

create or replace function public.prune_admin_actions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.admin_actions where created_at < now() - interval '24 months';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.prune_admin_actions() is
  'Apaga o registo de moderação com mais de 24 meses (docs/RGPD.md §5).';

-- ---------------------------------------------------------------------------
-- Nada disto é público (mesma regra da 0007)
-- ---------------------------------------------------------------------------
revoke execute on function public.data_ou_nulo(text) from public, anon, authenticated;
revoke execute on function public.data_do_evento_na_submissao(jsonb) from public, anon, authenticated;
revoke execute on function public.submissoes_caducadas() from public, anon, authenticated;
revoke execute on function public.expired_intake_objects() from public, anon, authenticated;
revoke execute on function public.prune_submissions() from public, anon, authenticated;
revoke execute on function public.prune_sender_quotas() from public, anon, authenticated;
revoke execute on function public.prune_admin_actions() from public, anon, authenticated;

grant execute on function public.data_ou_nulo(text) to service_role;
grant execute on function public.data_do_evento_na_submissao(jsonb) to service_role;
grant execute on function public.submissoes_caducadas() to service_role;
grant execute on function public.expired_intake_objects() to service_role;
grant execute on function public.prune_submissions() to service_role;
grant execute on function public.prune_sender_quotas() to service_role;
grant execute on function public.prune_admin_actions() to service_role;

-- ---------------------------------------------------------------------------
-- As provas, que é onde esta casa as põe.
-- ---------------------------------------------------------------------------
-- A âncora lida com os três formatos e com o que não é data nenhuma. É a
-- asserção que importa: uma fixture por FORMATO, e não por canal — foi o
-- formato do email que uma primeira versão desta migração não sabia ler, e uma
-- asserção escrita por canal passava na mesma.
do $$
begin
  -- recolha: aninhado em `event`, e o fim manda sobre o início
  assert public.data_do_evento_na_submissao(
    '{"event": {"date_start": "2026-01-05", "date_end": "2026-01-07"}}'::jsonb
  ) = date '2026-01-07', 'a âncora não leu o formato da recolha';

  -- formulário: EventCandidate liso
  assert public.data_do_evento_na_submissao(
    '{"date_start": "2026-01-05", "date_end": null}'::jsonb
  ) = date '2026-01-05', 'a âncora não leu o formato do formulário';

  -- email: ExtractedEvent, com as ocorrências em `dates`. A última é a âncora.
  assert public.data_do_evento_na_submissao(
    '{"title": "Festival", "dates": [{"date": "2026-01-05", "startTime": "21:00"},
                                     {"date": "2026-01-07", "startTime": "21:00"}]}'::jsonb
  ) = date '2026-01-07', 'a âncora não leu o formato do email';

  -- uma data inválida no meio não deita fora a válida que está ao lado
  assert public.data_do_evento_na_submissao(
    '{"dates": [{"date": "2026-01-05"}, {"date": "2026-02-31"}]}'::jsonb
  ) = date '2026-01-05', 'uma data impossível em dates[] levou a válida atrás';

  -- e o que não tem data nenhuma diz que não sabe, em vez de inventar
  assert public.data_do_evento_na_submissao('{}'::jsonb) is null,
    'um payload vazio devolveu uma data';
  assert public.data_do_evento_na_submissao('{"dates": []}'::jsonb) is null,
    'uma lista de ocorrências vazia devolveu uma data';
  assert public.data_do_evento_na_submissao('{"dates": "amanhã"}'::jsonb) is null,
    'um `dates` que não é lista rebentou ou devolveu uma data';
  assert public.data_do_evento_na_submissao('{"date_start": "para a semana"}'::jsonb) is null,
    'um texto que não é data passou por data';
end $$;

-- E a prova que não se faz sem escrever: uma submissão de cada formato, com o
-- evento no futuro e a chegada há 30 meses, tem de **ficar**. É o caso que
-- separa este expurgo da simplificação óbvia — «apagar 24 meses depois de
-- chegar» —, que apagava as três.
do $$
declare
  v_caducadas integer;
begin
  insert into public.submissions (id, channel, status, municipality_id, payload, sender_email, created_at)
  values
    ('d0000000-0000-4000-8000-000000000001', 'scraper', 'pending', 'tomar',
     jsonb_build_object('event', jsonb_build_object(
       'date_start', to_char(current_date + interval '2 months', 'YYYY-MM-DD'))),
     null, now() - interval '30 months'),
    ('d0000000-0000-4000-8000-000000000002', 'form', 'pending', 'tomar',
     jsonb_build_object('date_start', to_char(current_date + interval '2 months', 'YYYY-MM-DD')),
     'futuro-formulario@exemplo.pt', now() - interval '30 months'),
    ('d0000000-0000-4000-8000-000000000003', 'email', 'pending', 'tomar',
     jsonb_build_object('title', 'Festival', 'dates', jsonb_build_array(
       jsonb_build_object('date', to_char(current_date + interval '2 months', 'YYYY-MM-DD'),
                          'startTime', '21:00'))),
     'futuro-email@exemplo.pt', now() - interval '30 months'),
    -- e uma que chegou há 30 meses de um evento que já lá vai: essa sai
    ('d0000000-0000-4000-8000-000000000004', 'email', 'rejected', 'tomar',
     jsonb_build_object('title', 'Já foi', 'dates', jsonb_build_array(
       jsonb_build_object('date', to_char(current_date - interval '30 months', 'YYYY-MM-DD')))),
     'antigo@exemplo.pt', now() - interval '30 months');

  select count(*) into v_caducadas
    from public.submissoes_caducadas()
   where id::text like 'd0000000%';

  assert v_caducadas = 1,
    format('esperava-se uma submissão caducada das quatro de prova, foram %s — '
           'se forem quatro, a âncora não está a ler nenhum payload', v_caducadas);

  assert exists (select 1 from public.submissoes_caducadas()
                  where id = 'd0000000-0000-4000-8000-000000000004'),
    'a submissão de um evento que já aconteceu há 30 meses não caducou';

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
