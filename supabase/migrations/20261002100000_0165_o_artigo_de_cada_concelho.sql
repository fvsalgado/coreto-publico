-- 0165 — O artigo de cada concelho.
--
-- A caixa que uma câmara embebe no seu sítio dizia «Agenda de Entroncamento» e
-- «Agenda de Sardoal» — no sítio da Câmara Municipal do Entroncamento e no da
-- do Sardoal (C4-020). O título da página do concelho dizia o mesmo, e o
-- calendário, e o feed. É o primeiro erro que o técnico de comunicação da
-- câmara vê, e é o problema que a casa já resolveu para as regiões: nenhuma
-- heurística acerta nos topónimos portugueses — «o Entroncamento», «o
-- Sardoal», «a Golegã», mas «Tomar» e «Torres Novas» sem nada —, e por isso a
-- região declara o seu artigo desde a 0104. O concelho passa a declarar o dele.
--
-- Nulo é «sem artigo», que é o caso da maioria: «de Tomar», «em Ourém». Uma
-- coluna anulável e não um texto vazio, para o nulo querer dizer uma coisa só.
--
-- Os valores são os do Médio Tejo e os da demonstração. Os do Vale do Coreto
-- seguem o que a 0110 já escrevia nos nomes das fontes («Agenda do Município
-- da Vila da Charamela», «… da Ponte do Bombo»). Uma região nova nasce com os
-- concelhos sem artigo — o certo para quase todos —, e o que faltar escreve-se
-- aqui, numa migração, como estes.

alter table public.municipalities
  add column if not exists article text;

alter table public.municipalities
  drop constraint if exists municipalities_artigo_conhecido;
alter table public.municipalities
  add constraint municipalities_artigo_conhecido
  check (article is null or article in ('o', 'a', 'os', 'as'));

comment on column public.municipalities.article is
  'O artigo definido do nome do concelho, quando o tem: «o» para o Entroncamento, «a» para a '
  'Golegã. Nulo quando o nome não leva artigo, que é o caso da maioria («de Tomar», «em Ourém»). '
  'A prosa compõe com ele «do Entroncamento», «no Sardoal» — ver apps/web/src/lib/regiao.ts. '
  'Ver a 0165.';

update public.municipalities set article = 'o'
 where id in ('entroncamento', 'sardoal') and article is null;

update public.municipalities set article = 'a'
 where id in ('vila-da-charamela', 'ponte-do-bombo') and article is null;

do $$
declare
  n integer;
begin
  -- Só onde o concelho existe: a migração corre também em bases sem o Médio
  -- Tejo semeado, e aí não há nada a afirmar sobre ele.
  select count(*) into n from public.municipalities
   where id in ('entroncamento', 'sardoal') and article is distinct from 'o';
  assert n = 0, format('%s concelhos do Médio Tejo sem o artigo «o»', n);

  select count(*) into n from public.municipalities
   where id in ('tomar', 'abrantes', 'torres-novas', 'ourem') and article is not null;
  assert n = 0, format('%s concelhos que não levam artigo ficaram com um', n);
end
$$;
