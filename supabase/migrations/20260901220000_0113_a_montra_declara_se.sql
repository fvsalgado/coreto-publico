-- 0113 — O tipo da região: uma CIM ou a montra.
--
-- A página inicial da montra não é uma agenda: é a página fixa do produto —
-- o que é o Coreto, o que faz, quem o faz, como se fala connosco. A escolha
-- de QUEM mostra essa página não pode ser um `if` com um identificador
-- cravado no código («um só código, regiões por configuração» vale também
-- para a montra): é uma coluna, e quem a tem é a linha da região.
--
-- Fica de fora da lista editável da `update_region` de propósito: mudar o
-- tipo muda a natureza do sítio inteiro dessa região, e isso é uma decisão
-- de migração, com revisão, não um campo de formulário.

alter table public.regions
  add column kind text not null default 'cim';

alter table public.regions
  add constraint regions_kind check (kind in ('cim', 'montra'));

comment on column public.regions.kind is
  'O que esta região é: «cim» serve uma agenda regional; «montra» serve a '
  'página do produto na entrada e a demonstração no resto. Muda por '
  'migração, nunca pelo painel.';

update public.regions set kind = 'montra' where id = 'vale-do-coreto';
