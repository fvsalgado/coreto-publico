-- 0071 — Oito etiquetas mapeadas, e doze que não são categorias.
--
-- A fila de etiquetas por mapear tinha vinte entradas, algumas com sessenta e
-- cinco ocorrências. A tentação é mapear tudo para esvaziar a fila. Seria um
-- erro, e vale a pena escrever porquê.
--
-- `resolveCategory` consulta as etiquetas **primeiro**, e uma etiqueta que
-- case devolve logo a categoria, com confiança de 0,95. Só quando nenhuma casa
-- é que a leitura do título entra — e a leitura do título é boa: reconhece
-- «concerto», «feira», «romaria», «oficina», «visita guiada».
--
-- Isso inverte a conta habitual. Mapear uma etiqueta ambígua não acrescenta
-- informação: **cala** a leitura do título, que acertava mais. «Festas e
-- Feiras» é o caso exemplar — junta duas categorias que esta casa separa de
-- propósito, e mapeá-la para uma delas etiquetava mal metade dos sessenta e
-- cinco eventos. Sem alias, «Feira de Artesanato» vai para feiras-mercados e
-- «Festas em Honra de São Miguel» vai para festas-populares, cada uma pela sua
-- palavra.
--
-- ## A regra
--
-- Mapeia-se a etiqueta que **nomeia um género**, e só essa. Não se mapeia a
-- que nomeia um sítio («Ar Livre»), uma época («Animação de Verão»), quem
-- organiza («Eventos Municipio»), o facto de serem vários géneros
-- («Multidisciplinar») ou a área inteira («Cultura»).
--
-- ## A fila passa a esquecer
--
-- E há o mesmo problema que a 0067 resolveu para os espaços: uma etiqueta que
-- ninguém pode mapear volta todas as noites e fica na fila para sempre.
-- `unknown_tags` ganha `dismissed`, com a mesma semântica de
-- `unresolved_venues`: «isto não é uma categoria, e não voltes a perguntar».
-- ---------------------------------------------------------------------------

alter table public.unknown_tags add column dismissed boolean not null default false;

comment on column public.unknown_tags.dismissed is
  'Marcado quando alguém decidiu que esta etiqueta não nomeia uma categoria — '
  'um sítio, uma época, quem organiza. Sem isto, a fila enche-se de linhas '
  'que ninguém pode resolver e deixa de ser lida. Ver `unresolved_venues`.';

create index unknown_tags_pendentes_idx
  on public.unknown_tags (hits desc, last_seen desc)
  where not dismissed;

-- ------------------------- As oito que se mapeiam ---------------------------
insert into public.category_aliases (alias, category_slug) values
  -- A categoria «Literatura e ideias» diz, à letra, «conversas, conferências».
  ('eventosliterarios',            'literatura'),
  ('conferenciasseminarios',       'literatura'),
  -- «Teatro» diz, à letra, «marionetas».
  ('teatromarionetas',             'teatro'),
  -- «Formação e oficinas» diz, à letra, «oficinas, cursos, residências e ateliês».
  ('formacaoatelieroficinas',      'formacao'),
  -- «Infantil e família».
  ('infanciaejuventude',           'infantil'),
  -- «Desporto e natureza».
  ('atividadesrecreativasdesportivas', 'desporto-natureza')
on conflict (alias) do nothing;

-- ------------------ As doze que não nomeiam género nenhum -------------------
update public.unknown_tags set dismissed = true
where not dismissed and public.normalize_for_hash(tag) in (
  -- Junta duas categorias que esta casa separa. Sem alias, o título decide, e
  -- decide melhor.
  'festaseferias',
  -- Um sítio, não um género: há música, teatro e feiras ao ar livre.
  'arlivre',
  -- Uma época.
  'animacaodeverao',
  -- A área inteira. É o sítio todo.
  'cultura',
  -- Diz de propósito que são vários géneros.
  'multidisciplinar',
  -- Diz quem organiza, não o que é.
  'eventosmunicipio',
  -- Mapear para «outros» calava a leitura do título, que acerta mais.
  'outroseventos',
  -- Esta casa não tem categoria religiosa, e é decisão: as celebrações
  -- diárias de Fátima não entram na agenda. Uma festa em honra de um padroeiro
  -- é uma festa popular, e é o título que o diz.
  'eventosreligiosos'
);

-- ---------------------------------------------------------------------------
do $$
declare
  v_alias    integer;
  v_postas   integer;
  v_na_fila  integer;
begin
  select count(*) into v_alias from public.category_aliases
  where alias in ('eventosliterarios', 'conferenciasseminarios', 'teatromarionetas',
                  'formacaoatelieroficinas', 'infanciaejuventude',
                  'atividadesrecreativasdesportivas');
  if v_alias <> 6 then
    raise exception 'esperavam-se 6 alias de categoria novos, e há %', v_alias;
  end if;

  -- Nenhum alias pode apontar a uma categoria que não existe. A chave
  -- estrangeira já o garante; isto é para o dizer em voz alta.
  select count(*) into v_postas from public.category_aliases a
  where not exists (select 1 from public.categories c where c.slug = a.category_slug);
  if v_postas <> 0 then
    raise exception '% alias apontam a categorias que não existem', v_postas;
  end if;

  select count(*) into v_na_fila from public.unknown_tags where not dismissed;
  raise notice 'ficam % etiquetas na fila', v_na_fila;
end
$$;
