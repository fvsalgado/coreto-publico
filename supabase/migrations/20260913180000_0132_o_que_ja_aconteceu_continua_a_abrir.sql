-- 0132 — Uma ficha de evento continua a abrir depois de ele acontecer.
--
-- A política pública de `events` deixa passar o arquivo desde a 0064, e nunca
-- serviu uma única ficha. A razão não é a política: é que a `fetchEvent` filtra
-- `status = 'published'` em código, e uma consulta que exclui nunca chega a
-- perguntar à base se podia incluir. Sessenta e seis migrações com a porta
-- aberta e ninguém a bater.
--
-- **O que muda aqui, e é uma condição só.** A 0064 abriu o arquivo para a
-- edição passada de um **ciclo** — foi escrita para o CAMINHOS, e por isso pede
-- `series_id is not null`. A promessa que este projeto quer fazer é maior e não
-- tem nada que ver com ciclos: uma ligação para um evento do Médio Tejo abre
-- daqui a cinco anos e diz o que houve. Cai o `series_id`; fica tudo o resto.
--
-- **O `is_canonical` fica, e é carga.** A `reconcile_source_events` (0014)
-- escreve `archived_reason = 'passado'` filtrando por fonte, estado e data, e
-- **não** por canonicidade. É esta condição, e mais nenhuma, que separa a rua de
-- um duplicado arquivado. Medido: hoje os 33 candidatos são todos canónicos, e
-- há dois arquivados não canónicos que têm de continuar invisíveis.
--
-- **Porque não uma regra por data.** Dos 45 arquivados, 41 já têm data passada.
-- Uma política do género «arquivado e a data já passou» abriria já os seis
-- eventos de fontes que servem agenda podre e os dois duplicados; dentro de
-- dezassete dias abriria os três que foram arquivados por não serem eventos —
-- uma reunião de câmara, o horário de uma piscina. A data não separa nada. O
-- que separa é o símbolo `'passado'`, que é escrito por máquina e por mais
-- ninguém.
--
-- Alcance medido a 13 de setembro de 2026: o anon vê hoje 204 linhas (194
-- publicadas mais as 10 do CAMINHOS que já passavam) e passa a ver 227. As 23
-- novas são a programação do cineteatro de Torres Novas de janeiro a junho —
-- páginas que existem na base e não existiam em sítio nenhum do sítio. E o
-- número cresce: há 37 eventos publicados com data já passada, que vão cruzando
-- os noventa dias da `PAST_EVENT_DAYS` ao longo dos próximos três meses.
--
-- `alter policy` e não `drop` + `create`, como a 0115: a política que fica é a
-- de sempre, com o mesmo nome, e nunca houve um instante sem ela.

alter policy events_public_read on public.events
  using (
    status = 'published'
    or (
      status = 'archived'
      and archived_reason = 'passado'
      and is_canonical
    )
  );

comment on policy events_public_read on public.events is
  'O que está publicado, e o que foi arquivado por ter acontecido, sendo '
  'canónico — que é o registo do que houve. O resto do arquivo não: o que foi '
  'escondido por estar errado, o que não era um evento, e o duplicado.';

-- ---------------------------------------------------------------------------
-- As provas, que é onde esta casa as põe.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  -- Continua a haver uma política só. Duas somadas com «ou» eram o aviso do
  -- linter que a 0115 veio calar, e voltar a haver duas seria desfazê-la.
  select count(*) into n
    from pg_policy
   where polrelid = 'public.events'::regclass;
  assert n = 1, format('esperava-se uma política em events, há %s', n);

  -- Tudo o que o predicado deixa passar do arquivo é 'passado' e canónico.
  --
  -- `is distinct from` e não `<>`, e é a diferença entre a guarda servir e não
  -- servir: com `<>` as linhas de razão **nula** escapam à contagem por lógica
  -- de três valores — e são precisamente essas que incluem os dois duplicados
  -- não canónicos, os únicos casos que provam que o `is_canonical` faz alguma
  -- coisa. Uma guarda cega ao que ela existe para vigiar.
  select count(*) into n
    from public.events
   where status = 'archived'
     and (archived_reason is distinct from 'passado' or not is_canonical)
     and (
       status = 'published'
       or (status = 'archived' and archived_reason = 'passado' and is_canonical)
     );
  assert n = 0, format('%s arquivados passam o predicado sem serem passado e canónicos', n);
end $$;

-- E a prova que não se consegue fazer por contagem: uma linha 'passado' **não
-- canónica** continua invisível a quem lê de fora. Numa transação que se
-- desfaz — a base do CI não fica com o que isto escreve, e a de produção
-- também não.
do $$
declare
  visiveis integer;
begin
  insert into public.events (slug, title, municipality_id, fingerprint, location_name,
                             status, archived_reason, is_canonical, date_start)
  values ('prova-0132-duplicado', 'Prova da 0132', 'tomar', 'fp-prova-0132', 'Sala de Ensaio',
          'archived', 'passado', false, '2020-01-01');

  set local role anon;
  select count(*) into visiveis from public.events where slug = 'prova-0132-duplicado';
  reset role;

  assert visiveis = 0,
    'um arquivado "passado" não canónico ficou visível ao anon — o is_canonical do predicado deixou de travar o duplicado';

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
