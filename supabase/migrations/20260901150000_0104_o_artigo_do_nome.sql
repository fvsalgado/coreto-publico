-- 0104 — O artigo do nome da região.
--
-- A prosa do sítio escreve «a agenda cultural DO Médio Tejo» e «o que
-- acontece NO Médio Tejo» — contrações de `de`+artigo e `em`+artigo. Com o
-- nome sozinho isso só funciona enquanto a região for masculina e singular:
-- a Lezíria do Tejo pede «da», as Terras de Trás-os-Montes pedem «das», o
-- Oeste volta a pedir «do». Nenhuma heurística acerta nos topónimos
-- portugueses, por isso o artigo declara-se, como a contagem de concelhos.
--
-- Sem valor por omissão, de propósito: uma região nova que não declare o
-- artigo não nasce — um INSERT que rebenta é melhor do que uma agenda que
-- fala da «do Lezíria» durante três semanas sem ninguém reparar.

alter table public.regions
  add column article text;

update public.regions set article = 'o' where id = 'medio-tejo';

alter table public.regions
  alter column article set not null;

alter table public.regions
  add constraint regions_artigo_conhecido
  check (article in ('o', 'a', 'os', 'as'));

comment on column public.regions.article is
  'O artigo definido do nome («o» Médio Tejo, «a» Lezíria do Tejo, «as» '
  'Terras de Trás-os-Montes). A prosa compõe com ele as contrações do/da/dos/'
  'das e no/na/nos/nas — ver `regiaoDaLinha` em apps/web/src/lib/regiao.ts.';

-- ---------------------------------------------------------------------------
do $$
declare
  v_artigo text;
begin
  select article into v_artigo from public.regions where id = 'medio-tejo';
  if v_artigo is distinct from 'o' then
    raise exception 'o Médio Tejo ficou com o artigo «%»', v_artigo;
  end if;
end $$;
