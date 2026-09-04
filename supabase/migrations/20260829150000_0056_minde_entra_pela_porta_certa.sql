-- 0056 — Minde entra pela porta certa
--
-- A recolha de Minde entrava pelo RSS da junta, e o RSS mente em quatro
-- pontos, todos verificados contra o feed vivo de 2026-08-29:
--
--   1. A ligação de cada item é um 404. O feed escreve
--      `/autarquia/noticias/<id>-<slug>`, que é a rota das notícias; a página
--      do evento vive em `/freguesia/agenda/<dd-mm-aaaa>/<id>-<slug>`. O botão
--      «Página oficial» de cada ficha levava a lado nenhum.
--   2. Não há horas: todo o `pubDate` é 00:00:00. A listagem diz «21:30h».
--   3. Não há cartaz. A listagem traz a imagem de cada evento.
--   4. É arquivo e não agenda: 24 itens, 21 deles já passados, recriados e
--      recusados todas as noites.
--
-- A listagem `/freguesia/agenda` é servida pelo servidor e traz tudo certo. O
-- adaptador novo — `portal-freguesia` — lê-a, e serve para qualquer junta que
-- corra o mesmo CMS («Portal da Freguesia», da GESAutarquia), que são muitas.
--
-- `locationName` e `parish`: a agenda de uma junta é a agenda daquela
-- freguesia, e isso sabe-se por construção da fonte, não se adivinha do texto
-- de cada evento. É o chão do que se sabe — um espaço do catálogo ganha-lhe
-- sempre. Sem isto, um evento que a junta publica sem dizer o sítio ia para a
-- fila de moderação todas as noites, e a fila enchia-se de coisas que ninguém
-- pode resolver porque a informação não existe na origem.

begin;

update public.sources
   set adapter = 'portal-freguesia',
       url = 'https://www.jf-minde.pt/freguesia/agenda',
       kind = 'venue_site',
       config = jsonb_build_object('locationName', 'Minde', 'parish', 'Minde'),
       -- A listagem mostra o que falta acontecer. Numa freguesia isso é dois
       -- ou três eventos, e há semanas em que é zero — um mínimo de 1 fazia a
       -- recolha gritar por uma agenda que apenas está vazia.
       min_expected_items = 0,
       baseline_item_count = null,
       public_note = 'A agenda da junta de freguesia. Minde tem cine-teatro, museu de aguarela, banda, fábrica de cultura e jazz, e nada disto passa pela agenda do município — a junta é que o publica.',
       notes = 'Lê-se a listagem servida e não o RSS: o RSS da mesma casa aponta as ligações para /autarquia/noticias, que responde 404, não traz horas nem cartaz, e é arquivo (24 itens, 21 passados). Verificado a 2026-08-29.',
       updated_at = now()
 where id = 'jf-minde';

-- As três submissões que ficaram na fila vieram do feed antigo, com a ligação
-- partida e sem horas. Os mesmos três eventos voltam a entrar pela listagem,
-- com a chave nova (`evento-<id>`), e ficam certos. Recusar as antigas é
-- arrumar o que esta casa estragou — fica escrito porquê, para quem abrir o
-- histórico perceber que não foi uma decisão editorial sobre os eventos.
update public.submissions
   set status = 'rejected',
       review_notes = 'substituída: veio do RSS da junta, com a ligação a 404 e sem horas. Os mesmos eventos voltam a entrar pela listagem da agenda.',
       reviewed_at = now(),
       reviewed_by = 'migração 0056',
       updated_at = now()
 where source_id = 'jf-minde'
   and status = 'pending';

do $$
declare
  v_adapter text;
  v_url text;
  v_local text;
  v_pendentes int;
begin
  select adapter, url, config->>'locationName'
    into v_adapter, v_url, v_local
    from public.sources where id = 'jf-minde';

  if v_adapter is distinct from 'portal-freguesia' then
    raise exception 'jf-minde ficou com o adaptador «%»', v_adapter;
  end if;

  if v_url is distinct from 'https://www.jf-minde.pt/freguesia/agenda' then
    raise exception 'jf-minde ficou a apontar para «%»', v_url;
  end if;

  if v_local is distinct from 'Minde' then
    raise exception 'jf-minde ficou sem o local por omissão (ficou «%»)', v_local;
  end if;

  select count(*) into v_pendentes
    from public.submissions where source_id = 'jf-minde' and status = 'pending';
  if v_pendentes <> 0 then
    raise exception 'ficaram % submissões de Minde por arrumar', v_pendentes;
  end if;

  -- Nenhuma fonte pode continuar a apontar para o RSS da junta: é a origem
  -- das ligações partidas, e um dia alguém volta a lá pôr uma por distração.
  if exists (select 1 from public.sources where is_enabled and url like '%jf-minde.pt/eventos/rss%') then
    raise exception 'há uma fonte ligada a apontar outra vez para o RSS de Minde';
  end if;
end $$;

commit;
