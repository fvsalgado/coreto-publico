-- 0130 — A geografia deixa de depender da atenção de quem escreve.
--
-- Um evento diz em que concelho é (`municipality_id`) e, quando o espaço
-- existe no catálogo, diz também onde é (`venue_id`). As duas coisas podem
-- discordar, e até hoje nada na base o impedia: `venue_id` tinha uma chave
-- estrangeira que só exigia que o espaço existisse — em qualquer concelho, em
-- qualquer região.
--
-- **A consequência não é só um evento na página errada.** A 0129 pôs dois
-- gatilhos a materializar `coalesce(acesso do evento, acesso do espaço)` numa
-- coluna publicada. Com o espaço trocado, o Coreto passa a afirmar que um
-- evento é acessível em cadeira de rodas porque um espaço de outro concelho o
-- é. Isso é fabricar um campo publicado a partir de uma coisa que não tem
-- nada a ver com o evento — a regra que esta casa põe acima de todas as
-- outras, partida à letra e sem ninguém dar por ela.
--
-- **Porquê uma chave estrangeira composta e não um `check`.** Um `check` só vê
-- as colunas da própria linha: o Postgres recusa a subconsulta com «cannot use
-- subquery in check constraint». Está fora de questão, e mediu-se.
--
-- **Porquê a chave e não só um gatilho.** A chave é declarativa — não há corpo
-- de função que se possa desviar da intenção —, cobre também o lado dos
-- espaços (recusa mudar um espaço de concelho enquanto lá houver eventos), e
-- sobrevive a uma escrita em massa que um gatilho de linha mal escrito
-- deixasse passar. O que ela não faz é falar português; para isso é a peça IV.
--
-- **O que fica de fora, de propósito.** `event_sessions.venue_id` não leva
-- esta regra: as itinerâncias da rede CAMINHOS/VOLver mudam de sítio entre
-- sessões, e a 0004 declara isso legítimo por escrito. A regra que ali faria
-- sentido é a da região e não a do concelho, e a tabela não tem
-- `municipality_id` — não pode ser chave composta. Fica para uma linha sua.

-- I. A rede antes da rede.
--
-- Se houver linhas por tratar, dizê-lo em português e com os identificadores à
-- frente, em vez de deixar o `alter table` rebentar com uma mensagem que não
-- diz quais são. A base que o repositório reconstrói não tem nenhuma; a de
-- produção, medida a 7 de setembro de 2026, também não — e a maior parte dos
-- eventos dela nunca passou por aqui, foi a recolha noturna que os escreveu.
-- É por isso que a contagem é feita aqui e não na cabeça de quem aplica.
do $$
declare
  v_n integer;
  v_lista text;
begin
  select count(*),
         string_agg(e.slug || ' (' || e.municipality_id || ' → ' || v.municipality_id || ')', ', ')
    into v_n, v_lista
    from public.events e
    join public.venues v on v.id = e.venue_id
   where v.municipality_id <> e.municipality_id;

  if v_n = 1 then
    raise exception
      'um evento está marcado num concelho e aponta a um espaço de outro; trate-o antes de impor a regra: %',
      v_lista;
  elsif v_n > 1 then
    raise exception
      '% eventos estão marcados num concelho e apontam a um espaço de outro; trate-os antes de impor a regra: %',
      v_n, v_lista;
  end if;
end $$;

-- II. O alvo da chave.
--
-- Redundante em teoria — `id` já é chave primária — e obrigatório em Postgres:
-- uma chave estrangeira só aponta a colunas com unicidade declarada.
alter table public.venues
  add constraint venues_id_concelho_key unique (id, municipality_id);

-- III. A garantia.
--
-- `match simple` (o padrão) é o que salva os eventos sem espaço: com qualquer
-- coluna da chave a nulo, a restrição dá-se por satisfeita. `venue_id` é
-- anulável e `municipality_id` é `not null`, por isso «sem espaço do catálogo»
-- passa sempre e «com espaço» é sempre verificado.
--
-- E como um concelho pertence a uma região e só a uma (0101), a regra do
-- concelho impõe a da região por consequência.
--
-- Sem `on update cascade`, de propósito: arrastar os eventos atrás de um
-- espaço que mudou de concelho parece cómodo e é exactamente o que esta
-- restrição existe para impedir — mudar um evento de concelho em silêncio.
alter table public.events
  add constraint events_espaco_do_mesmo_concelho
  foreign key (venue_id, municipality_id)
  references public.venues (id, municipality_id);

comment on constraint events_espaco_do_mesmo_concelho on public.events is
  'Um evento só aponta a um espaço do seu próprio concelho — e portanto da sua própria região. Anulável de propósito: um evento sem espaço do catálogo (só location_name) não é tocado.';

-- IV. A frase em português.
--
-- A chave recusa em inglês e sem dizer qual é o concelho de cada lado. As
-- chaves estrangeiras são gatilhos `after`; este é `before` e fala primeiro.
-- Não substitui a chave: a chave é que cobre o lado dos espaços e quem escreva
-- por fora daqui.
create or replace function public.eventos_espaco_do_mesmo_concelho()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_do_espaco text;
begin
  if new.venue_id is null then
    return new;
  end if;

  select municipality_id into v_do_espaco from public.venues where id = new.venue_id;

  if v_do_espaco is not null and v_do_espaco <> new.municipality_id then
    raise exception
      'o espaço «%» é de %, e o evento está marcado em % — um evento não pode acontecer num espaço de outro concelho',
      new.venue_id, v_do_espaco, new.municipality_id
      using errcode = '23514';
  end if;

  return new;
end $$;

drop trigger if exists events_espaco_do_mesmo_concelho_trg on public.events;
create trigger events_espaco_do_mesmo_concelho_trg
  before insert or update of venue_id, municipality_id on public.events
  for each row execute function public.eventos_espaco_do_mesmo_concelho();
