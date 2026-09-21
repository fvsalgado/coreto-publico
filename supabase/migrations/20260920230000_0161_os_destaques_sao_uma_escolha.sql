-- 0161 — Os destaques da semana passam a ser uma escolha.
--
-- A fila de cartazes da entrada mostrava os doze primeiros eventos da semana,
-- por ordem de `agenda_date`. Não era uma escolha: era a ordem da consulta a
-- fazer de montra. O benchmark de 20/09/2026 apanhou isto contra os pares —
-- a Agenda LX, a Agenda Porto, a GuiaBCN e a visitBerlin têm todas uma escolha
-- humana à cabeça, e é ela que faz a diferença entre uma agenda e uma lista.
--
-- O que esta migração traz é o mínimo para haver escolha sem obrigar a haver
-- redação: **quem administra fixa os que quer, e o resto preenche-se
-- sozinho**. Nunca há uma montra vazia por ninguém ter tido tempo.
--
-- Duas peças, e cada uma tem uma razão separada.

-- ---------------------------------------------------------------------------
-- 1. Quantos destaques a entrada mostra, por região.
--
-- Estava escrito no componente (`DESTAQUES = 12`) e é uma decisão editorial,
-- não de desenho: uma região com quatro concelhos e pouca programação fica
-- melhor com seis do que com doze meio vazios. Vive na região porque é da
-- região.
--
-- O tecto de vinte e quatro não é arbitrário: acima disso a fila deixa de ser
-- uma montra e passa a ser a lista outra vez, que já existe por baixo. O zero
-- é legítimo e quer dizer «não quero montra nenhuma» — a fila não se desenha.
-- ---------------------------------------------------------------------------
alter table public.regions
  add column if not exists destaques_alvo smallint not null default 12;

alter table public.regions
  drop constraint if exists regions_destaques_alvo_check;

alter table public.regions
  add constraint regions_destaques_alvo_check
  check (destaques_alvo between 0 and 24);

comment on column public.regions.destaques_alvo is
  'Quantos cartazes a fila de destaques da entrada mostra. Os fixados em region_highlights entram primeiro; o resto preenche-se com a semana. Zero desliga a fila.';

-- ---------------------------------------------------------------------------
-- 2. Os que quem administra fixou.
--
-- **A chave primária é (região, evento) e não um identificador próprio**: um
-- evento fixado duas vezes na mesma região não é um estado que valha a pena
-- poder representar, e uma tabela que o permite é uma tabela onde um dia ele
-- aparece.
--
-- **A posição é única por região.** Reordenar é trocar duas linhas, e o painel
-- fala com a base pelo PostgREST, que manda cada `UPDATE` no seu próprio
-- pedido: não há transação onde adiar a verificação, e por isso a troca
-- directa (1↔2) é recusada — medido, e é o comportamento certo. Quem reordena
-- passa por um lugar de estacionamento livre: sai um, entra o outro, volta o
-- primeiro. Três escritas, nenhuma delas inválida em instante nenhum.
--
-- A restrição fica `deferrable` na mesma, e é para quem vier: uma migração ou
-- um `plpgsql` que faça a troca dentro de uma transação pode adiá-la e trocar
-- as duas de uma vez. `initially immediate` mantém o comportamento estrito
-- para todos os outros, que é quem escreve hoje.
--
-- **O `on delete cascade` no evento é deliberado.** Um evento apagado — uma
-- duplicação fundida, um cancelamento — deixa de poder ser destaque, e deixar
-- a linha para trás dava uma montra com um buraco que ninguém conseguia
-- explicar a partir do painel.
--
-- Não há coluna de «até quando»: um destaque deixa de aparecer quando o
-- evento passa, e isso lê-se do próprio evento. Uma data de validade a mais
-- era mais um sítio onde a verdade pode divergir.
-- ---------------------------------------------------------------------------
create table if not exists public.region_highlights (
  region_id  text not null references public.regions (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  posicao    smallint not null,
  -- Quem fixou, para a auditoria do painel saber de quem foi a escolha.
  fixado_por text not null,
  fixado_em  timestamptz not null default now(),

  primary key (region_id, event_id)
);

alter table public.region_highlights
  drop constraint if exists region_highlights_posicao_unica;

alter table public.region_highlights
  add constraint region_highlights_posicao_unica
  unique (region_id, posicao) deferrable initially immediate;

comment on table public.region_highlights is
  'Os eventos que quem administra fixou na fila de destaques da entrada, por região e por ordem. O que faltar para chegar a regions.destaques_alvo preenche-se com a semana, baralhada por dia.';

-- A entrada é pública e lê isto com a chave anónima, como lê os eventos.
-- Só a leitura: escrever é do painel, que usa a chave de serviço.
alter table public.region_highlights enable row level security;

drop policy if exists region_highlights_public_read on public.region_highlights;

create policy region_highlights_public_read on public.region_highlights
  for select to anon, authenticated using (true);

-- A entrada pergunta «quais são os fixados desta região», sempre por região e
-- sempre por ordem. A chave primária começa por `region_id` e serve a primeira
-- metade; esta índice serve a ordenação sem um passo de `sort`.
create index if not exists region_highlights_ordem_idx
  on public.region_highlights (region_id, posicao);
