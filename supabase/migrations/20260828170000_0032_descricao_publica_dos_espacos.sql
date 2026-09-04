-- 0032 — A descrição pública de um espaço não é a nota de trabalho.
--
-- A 0028 escreveu nas notas dos espaços o resultado de uma sondagem técnica
-- («/wp-json/wp/v2/event devolve JSON… merece adaptador») — e a página
-- pública de cada espaço mostrava `notes` como se fosse a apresentação do
-- sítio, e usava-a até como descrição para os motores de busca. Prosa de
-- bastidores no palco.
--
-- A separação passa a ser estrutural: `description` é o que o público lê,
-- `notes` é o caderno da moderação e deixa de ser selecionado pelas
-- consultas públicas (ver apps/web/src/lib/queries/fields.ts).

alter table public.venues
  add column if not exists description text;

comment on column public.venues.description is
  'Apresentação editorial do espaço, escrita para quem visita o sítio. '
  'As notas de trabalho vivem em `notes` e não saem da moderação.';

comment on column public.venues.notes is
  'Caderno de trabalho da moderação e da recolha (sondagens, decisões). '
  'NUNCA aparece no sítio público — para isso existe `description`.';
