-- 0138 — A categoria passa a dizer de onde veio, e um cadeado deixa de ser um
-- palpite.
--
-- O `resolveCategory` (packages/core/src/taxonomy.ts) devolve três coisas: a
-- categoria, a confiança e a **origem** — `alias`, `keyword`, `venue_kind` ou
-- `none`. As duas primeiras são gravadas; a terceira morre na função. Quem lê a
-- base vê `0.400` e tem de saber de cor que 0,4 quer dizer «foi pelo tipo do
-- espaço». Isso é um mapa que vive na cabeça de quem escreveu o código.
--
-- **A retalho está lá, e medi-o antes de o escrever.** Nos 194 publicados de
-- hoje: 89 a 0,95 (alias), 30 a 0,7 (palavra do título), 6 a 0,4 (tipo do
-- espaço), 55 a 1,0, e 14 sem categoria nenhuma. Os 55 são todos de pessoa — 30
-- de eventos criados à mão e 25 com a categoria travada em `manual_overrides`.
-- O retorno é exato, e é por isso que o preenchimento desta coluna se pode
-- fazer sem adivinhar nada. Mas é exato por coincidência: bastava uma regra de
-- palavra com outra confiança para o mapa deixar de existir.
--
-- ---------------------------------------------------------------------------
-- O defeito que apareceu ao medir
-- ---------------------------------------------------------------------------
-- Dois eventos têm a categoria **decidida por uma pessoa**, com a nota escrita
-- ao lado em `manual_overrides`, e continuam com a confiança do palpite da
-- máquina:
--
--   «Dia Mundial da Observação da Natureza» → desporto-natureza, 0,400
--     nota: «Sem descrição nem ligação. O título nomeia a observação da
--     natureza… O espaço resolvido é o CIRA, classificado como museu — sem este
--     bloqueio a recolha punha-o em exposições.»
--   «Do olhar à pintura» → exposicoes, 0,950
--     nota: «É uma exposição de pintura, e a etiqueta "eventos-literarios" é o
--     segmento do endereço na agenda de Tomar, não uma afirmação sobre o
--     evento.»
--
-- O cadeado trava o `category_slug` e não trava a `category_confidence`: a
-- recolha reescreve a confiança da máquina por cima da decisão da pessoa, todas
-- as noites. Enquanto ninguém lia a confiança, não se via. No dia em que a
-- ficha escrever «provavelmente desporto e natureza» por baixo de 0,7, passa a
-- ser uma ressalva publicada sobre uma decisão deliberada — e a nota que a
-- justifica está na base, escrita, a dizer o contrário.
--
-- Por isso a coluna nova não chega: o cadeado tem de mandar nas duas.

alter table public.events
  add column if not exists category_source text;

alter table public.events
  drop constraint if exists events_category_source_conhecida;
alter table public.events
  add constraint events_category_source_conhecida check (
    category_source is null
    or category_source in ('alias', 'keyword', 'venue_kind', 'person')
  );

comment on column public.events.category_source is
  'Como se chegou à categoria: `alias` (uma etiqueta da fonte, pelo mapa), '
  '`keyword` (uma palavra inequívoca do título), `venue_kind` (o tipo do '
  'espaço, que é o último recurso) ou `person` (alguém decidiu). Nulo quando '
  'não há categoria. É o `source` que o `resolveCategory` sempre devolveu e '
  'que até aqui morria na função.';

-- ---------------------------------------------------------------------------
-- O cadeado manda: quem decidiu foi uma pessoa, e a confiança é dela
-- ---------------------------------------------------------------------------
create or replace function public.resolver_origem_da_categoria(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.events e
     set category_source = case
           when e.category_slug is null then null
           when exists (select 1 from public.manual_overrides mo
                         where mo.event_id = e.id and mo.field = 'category_slug')
             then 'person'
           when e.origin = 'manual' then 'person'
           else e.category_source
         end,
         category_confidence = case
           when e.category_slug is null then null
           when exists (select 1 from public.manual_overrides mo
                         where mo.event_id = e.id and mo.field = 'category_slug')
             then 1.0
           else e.category_confidence
         end
   where e.id = target
     and (e.category_source, e.category_confidence) is distinct from (
       case
         when e.category_slug is null then null
         when exists (select 1 from public.manual_overrides mo
                       where mo.event_id = e.id and mo.field = 'category_slug')
           then 'person'
         when e.origin = 'manual' then 'person'
         else e.category_source
       end,
       case
         when e.category_slug is null then null
         when exists (select 1 from public.manual_overrides mo
                       where mo.event_id = e.id and mo.field = 'category_slug')
           then 1.0
         else e.category_confidence
       end);
$$;

revoke all on function public.resolver_origem_da_categoria(uuid) from public, anon, authenticated;

-- 1. O evento mudou de categoria (ou nasceu).
create or replace function public.events_sync_origem_categoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.resolver_origem_da_categoria(new.id);
  return null;
end;
$$;

revoke execute on function public.events_sync_origem_categoria() from public, anon, authenticated;

drop trigger if exists events_sync_origem_categoria_trg on public.events;
create trigger events_sync_origem_categoria_trg
  after insert or update of category_slug, category_confidence, category_source, origin
  on public.events
  for each row execute function public.events_sync_origem_categoria();

-- 2. O cadeado apareceu ou saiu — e é este lado que se esquece, como na 0129.
--    Sem isto, travar a categoria no painel não mudava a confiança até a
--    recolha tocar no evento outra vez.
create or replace function public.overrides_sync_origem_categoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento uuid := coalesce(new.event_id, old.event_id);
  v_campo  text := coalesce(new.field, old.field);
begin
  if v_campo = 'category_slug' then
    perform public.resolver_origem_da_categoria(v_evento);
  end if;
  return null;
end;
$$;

revoke execute on function public.overrides_sync_origem_categoria() from public, anon, authenticated;

drop trigger if exists overrides_sync_origem_categoria_trg on public.manual_overrides;
create trigger overrides_sync_origem_categoria_trg
  after insert or update or delete on public.manual_overrides
  for each row execute function public.overrides_sync_origem_categoria();

-- ---------------------------------------------------------------------------
-- O preenchimento, pela retalho medida
-- ---------------------------------------------------------------------------
-- A ordem importa: primeiro o que a máquina decidiu, pela confiança; depois as
-- pessoas por cima, que é quem ganha. As duas linhas divergentes ficam a
-- `person` com confiança 1,0, que é o que a nota delas sempre disse.
-- O `case` sem `else` devolve nulo ao que não casa, e é de propósito: os
-- eventos com categoria e sem confiança (ver a asserção lá em baixo) ficam sem
-- origem, que é o que se sabe deles.
update public.events
   set category_source = case
     when category_slug is null then null
     when category_confidence = 0.95 then 'alias'
     when category_confidence = 0.70 then 'keyword'
     when category_confidence = 0.40 then 'venue_kind'
     when category_confidence = 1.00 then 'person'
   end
 where category_source is null;

update public.events e
   set category_source = 'person', category_confidence = 1.0
 where e.category_slug is not null
   and (exists (select 1 from public.manual_overrides mo
                 where mo.event_id = e.id and mo.field = 'category_slug')
        or e.origin = 'manual')
   and (e.category_source, e.category_confidence) is distinct from ('person', 1.0);

-- ---------------------------------------------------------------------------
-- As provas
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  v_lista text;
begin
  -- Nenhum evento com categoria E confiança ficou sem dizer de onde ela veio.
  --
  -- A condição tem as duas metades, e a segunda não é folga: há eventos com
  -- categoria e **sem confiança nenhuma**, e a asserção recusou esta migração
  -- da primeira vez até eu ir ver porquê. Vêm da 0077, que escreveu
  -- `category_slug = 'festas-populares'` (e outras) por uma regra escrita à
  -- mão numa migração — «a condição espelha a regra do código», diz o
  -- comentário — e não escreveu a confiança ao lado. Em produção são quatro,
  -- todos `hidden`: a Festa de Cem Soldos, o III Aquatlo de Mação, a Procissão
  -- na capela de Almogadel e o Workshop de Danças.
  --
  -- **Não lhes escrevo uma origem.** Adivinhá-la a partir do título seria eu a
  -- decidir hoje o que a 0077 não disse, e ficava escrito na base como se
  -- alguém o soubesse. Nulo é a resposta certa: não consegui saber. A ficha
  -- cala-se sozinha nesse caso — a `ressalvaDaCategoria` não ressalva o que
  -- não tem confiança, porque uma confiança nula é «não medi» e não «tenho
  -- pouca certeza», e pôr «provavelmente» por cima dela era inventar uma
  -- dúvida com número.
  select count(*), string_agg(slug, ', ' order by slug) into n, v_lista
    from public.events
   where category_slug is not null
     and category_confidence is not null
     and category_source is null;
  assert n = 0, format('eventos com categoria e confiança e sem origem: %s', left(coalesce(v_lista, ''), 300));

  -- E nenhum evento sem categoria inventou uma origem.
  select count(*) into n from public.events
   where category_slug is null and category_source is not null;
  assert n = 0, format('%s eventos sem categoria com origem escrita', n);

  -- Uma categoria travada à mão é de uma pessoa, e a confiança é dela.
  select count(*), string_agg(e.slug, ', ' order by e.slug) into n, v_lista
    from public.events e
    join public.manual_overrides mo on mo.event_id = e.id and mo.field = 'category_slug'
   where e.category_source is distinct from 'person'
      or e.category_confidence is distinct from 1.0;
  assert n = 0,
    format('categorias travadas à mão com a confiança da máquina: %s', left(coalesce(v_lista, ''), 300));
end $$;

-- E a prova do gatilho, que é a que não se faz por contagem: travar a categoria
-- no painel muda a confiança na hora, sem esperar pela recolha. Numa transação
-- que se desfaz.
do $$
declare
  v_id uuid;
  v_conf numeric;
  v_fonte text;
begin
  select id into v_id from public.events
   where category_slug is not null
     and category_source = 'venue_kind'
   limit 1;

  if v_id is null then
    -- Sem um caso na base, a prova não se faz — e dizer que passou seria pior.
    raise notice 'sem evento com categoria pelo tipo do espaço: prova do gatilho saltada';
    return;
  end if;

  insert into public.manual_overrides (event_id, field, value, actor, note)
  values (v_id, 'category_slug', to_jsonb('musica'::text), 'prova da 0138', 'prova, desfeita a seguir');

  select category_confidence, category_source into v_conf, v_fonte
    from public.events where id = v_id;

  assert v_conf = 1.0 and v_fonte = 'person',
    format('depois do cadeado a confiança era %s e a origem %s', v_conf, v_fonte);

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
