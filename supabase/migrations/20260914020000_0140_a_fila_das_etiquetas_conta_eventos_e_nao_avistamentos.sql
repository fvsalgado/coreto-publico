-- 0140 — A fila das etiquetas passa a contar eventos, e não avistamentos.
--
-- O painel mostra as etiquetas por mapear ordenadas por `hits`, e a 0084
-- deixou escrito o critério para abrir prateleira nova: «no dia em que houver
-- meia dúzia de cada, a resposta certa passa a ser uma prateleira nova». O
-- número que decide é esse — meia dúzia **de eventos**.
--
-- **`hits` não é esse número, e engana por um fator de doze.** É um contador de
-- avistamentos: a recolha soma um de cada vez que vê a etiqueta, todas as
-- noites, no mesmo evento. Medido em produção a 13 de setembro de 2026, na
-- própria vista que o painel lê:
--
--   etiqueta                  hits   eventos no catálogo
--   Infantis                    12                     1
--   Projetos em Residência      11                     1
--   Standup                      4                     1
--   Art’Andante                  3                     2
--   Bebeteca                     2                     1
--
-- Quem abrisse o painel lia «Infantis, 12» no topo e via um padrão. É um
-- evento. Ordenada por avistamentos, a fila põe em primeiro lugar a etiqueta
-- que a recolha viu mais vezes, que é coisa diferente da que mais eventos
-- espera — e a decisão que ela existe para informar é sobre eventos.
--
-- **E a resposta, hoje, é não abrir prateleira nenhuma.** Nenhuma das cinco
-- chega a meia dúzia de eventos, e três delas já caem numa prateleira que
-- existe: a «Bebeteca» e os «Infantis» estão em literatura. O que este número
-- produz hoje é a decisão de não mexer — que é exatamente para isso que se
-- conta antes de abrir.
--
-- O `hits` fica, e fica por uma razão: separa «uma etiqueta que apareceu uma
-- vez e nunca mais» de «uma etiqueta que a fonte escreve todas as noites num
-- evento só». As duas têm um evento, e não são a mesma coisa.
--
-- O molde é o da `unresolved_venues_pendentes`, que já conta eventos à espera
-- de um nome em vez de avistamentos. As duas filas passam a dizer a mesma
-- espécie de número.

create or replace view public.unknown_tags_pendentes
with (security_invoker = true) as
-- As colunas novas vão para o fim, e é obrigação e não estilo: um
-- `create or replace view` não deixa inserir colunas no meio («cannot change
-- name of view column»). Um `drop` + `create` deixava, e deixava também um
-- instante sem vista — a fila do painel a responder «não existe» a meio de uma
-- migração. Quem lê seleciona por nome.
select t.tag,
       t.hits,
       t.first_seen,
       t.last_seen,
       t.example_url,
       -- Os eventos do catálogo que trazem esta etiqueta. É o número que
       -- decide se há prateleira a abrir.
       (select count(*) from public.events e where t.tag = any(e.categories_raw))
         as eventos,
       -- E, desses, os que continuam sem prateleira nenhuma: é a fatia que uma
       -- prateleira nova viria mesmo arrumar. Uma etiqueta cujos eventos já
       -- caem todos numa categoria não pede prateleira — pede um alias.
       (select count(*) from public.events e
         where t.tag = any(e.categories_raw) and e.category_slug is null)
         as eventos_sem_prateleira
from public.unknown_tags t
where not t.dismissed
  and not exists (
    select 1 from public.category_aliases a
    where a.alias = public.normalize_for_hash(t.tag)
  );

comment on view public.unknown_tags_pendentes is
  'A fila de etiquetas por mapear, sem as já mapeadas e sem as que não nomeiam '
  'categoria nenhuma. `eventos` é o número que decide se há prateleira a abrir '
  '(0084: meia dúzia); `hits` são avistamentos e chegam a inflacionar doze '
  'vezes. Ver `unresolved_venues_pendentes`.';

-- ---------------------------------------------------------------------------
-- As provas
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_eventos integer;
  v_sem integer;
begin
  -- A contagem é de eventos distintos e não de avistamentos: uma etiqueta vista
  -- mil vezes no mesmo evento continua a ser um evento.
  insert into public.events (slug, title, municipality_id, fingerprint, location_name,
                             status, date_start, categories_raw)
  values ('prova-0140', 'Prova da 0140', 'tomar', 'fp-prova-0140', 'Sala de Ensaio',
          'published', '2099-01-01', array['etiqueta-da-prova-0140'])
  returning id into v_id;

  insert into public.unknown_tags (tag, hits) values ('etiqueta-da-prova-0140', 999);

  select eventos, eventos_sem_prateleira into v_eventos, v_sem
    from public.unknown_tags_pendentes where tag = 'etiqueta-da-prova-0140';

  assert v_eventos = 1,
    format('999 avistamentos num evento deviam contar 1 evento, contaram %s', v_eventos);
  assert v_sem = 1,
    format('o evento de prova não tem categoria e devia contar como sem prateleira, contou %s', v_sem);

  raise exception using errcode = 'DEADA', message = 'prova feita, a desfazer';
exception
  when sqlstate 'DEADA' then
    null;
end $$;
