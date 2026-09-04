-- 0106 — As fontes sem concelho declaram a sua região.
--
-- O plano deixava esta decisão para a fase 5; a região de prova no CI não
-- deixou. Uma fonte com concelho pertence à região do concelho — deriva-se, e
-- não se duplica. Mas há fontes que são da região inteira («CAMINHOS —
-- Programação Cultural em Rede», as agendas em PDF da CIM) e têm
-- `municipality_id` nulo: até aqui, «sem concelho» lia-se como «de toda a
-- gente», e a página de fontes da região de prova apareceu no CI com as
-- fontes da CIM do Médio Tejo dentro — a fuga exata que a prova existe para
-- apanhar.
--
-- A coluna é nula quando o concelho decide (o caso normal), e obrigatória
-- quando não há concelho que o faça: é isso que a restrição diz. As duas
-- fontes regionais existentes são do Médio Tejo, e é o que o backfill
-- escreve.

alter table public.sources
  add column region_id text references public.regions (id);

comment on column public.sources.region_id is
  'A região de uma fonte SEM concelho. Com concelho fica nula: a região deriva '
  'do concelho, e escrevê-la nos dois sítios era convidar os dois a divergir.';

update public.sources
   set region_id = 'medio-tejo'
 where municipality_id is null;

alter table public.sources
  add constraint sources_regiao_quando_sem_concelho
  check (municipality_id is not null or region_id is not null);
