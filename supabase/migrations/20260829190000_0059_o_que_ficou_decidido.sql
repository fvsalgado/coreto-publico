-- 0059 — O que ficou decidido, e o que a sondagem de hoje encontrou
--
-- Duas decisões do dono do projeto, tomadas a 2026-08-29, e três achados que
-- explicam por que é que fontes saudáveis mostram zero eventos por acontecer.
--
-- A diferença entre «ainda não decidimos» e «está decidido» não é de estilo: a
-- primeira convida a repetir a discussão de seis em seis meses, e a segunda
-- fecha-a. Fica escrito onde quem for a seguir olha.

begin;

-- ---------------------------------------------------------------------------
-- Decisão: as celebrações diárias de Fátima não entram.
-- ---------------------------------------------------------------------------
--
-- A migração 0058 deixou isto como decisão por tomar, com a nota de que era de
-- quem manda no projeto e não do recoletor. Foi tomada: não entram.
--
-- Não fecha a porta ao santuário. Fecha-a ao ofício diário, que é o que
-- afogaria a agenda de Ourém. Se um dia houver forma de separar a exposição
-- temporária ou o encontro do «Celebrações e Grupos no dia X», reabre-se — e
-- aí a fonte já está registada, com o adaptador identificado.
update public.sources
   set public_note = 'O santuário publica uma lista curta e bem estruturada em `/pt/events`, mas metade do que lá está são celebrações do dia — o rosário na Capelinha, «Celebrações e Grupos no dia 29 de agosto» — que se repetem todas as manhãs do ano. Está decidido que não entram: enchiam a agenda de Ourém com um ofício por dia e afogavam a programação que se procura aqui. Não é uma limitação técnica, é uma escolha sobre o que esta agenda é.',
       notes = 'DECIDIDO a 2026-08-29 pelo dono do projeto: as celebrações diárias não entram. Tecnicamente a fonte é ligável a qualquer momento — sondagem 2026-08-29: 4 itens em div.event, com data («28 ago» + «2026»), título em h3 e ligação própria, que o generic-html lê sem código novo. O que falta não é adaptador, é uma forma de separar a programação cultural do ofício diário. Sem essa separação, fica desligada.',
       updated_at = now()
 where id = 'fatima-eventos';

-- ---------------------------------------------------------------------------
-- Achado: há fontes vivas cuja página está parada.
-- ---------------------------------------------------------------------------
--
-- `min_expected_items` conta o que a página **traz**, não o que dela está por
-- acontecer. Uma agenda municipal que ficou em 2025 continua a trazer seis
-- itens e a passar no mínimo — a execução fica verde e o concelho aparece
-- vazio. Não é o adaptador que falha; é a página que não é atualizada, e isso
-- só se vê olhando para as datas do que entrou.
--
-- Fica escrito por fonte para que a próxima pessoa não volte a suspeitar do
-- recoletor.

update public.sources
   set notes = 'Sondagem 2026-08-29: a página responde 200 e traz 6 blocos de evento, mas o mais recente é o «Mercado de Natal 2025» (06/12/2025) e os restantes são de 2024 e 2025. O adaptador lê-a corretamente — é a agenda do município que não é atualizada há meses. Os eventos que Constância mostra no Coreto vêm todos das juntas de freguesia. A execução fica verde porque o mínimo esperado conta itens lidos, não itens por acontecer.',
       updated_at = now()
 where id = 'cm-constancia';

update public.sources
   set notes = 'Sondagem 2026-08-29: a página responde 200 e traz 10 itens, todos de abril e maio de 2026 — a rede mostra uma temporada que já passou. O adaptador lê-a corretamente; não há programação nova publicada. Revisitar quando a CIM anunciar a temporada seguinte.',
       updated_at = now()
 where id = 'caminhos-cimt';

update public.sources
   set notes = 'Sondagem 2026-08-29: a página de cinema responde 200 com meio megabyte, e não tem uma única sessão — as únicas datas do documento são de artigos («10 dezembro 2021», «20 março 2026»). A execução ficou em `partial` com «contagem suspeita: 0 itens contra uma linha de base de 26», que é o mecanismo a funcionar: uma queda de 26 para 0 não se aceita em silêncio. Não é avaria do adaptador — é o cineclube sem programação publicada. Enquanto assim for, Torres Novas fica sem nada por acontecer, porque a agenda do município continua atrás de um WAF.',
       updated_at = now()
 where id = 'teatro-virginia';

-- ---------------------------------------------------------------------------
-- O que tem de continuar verdade.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  select count(*) into n from public.sources where id = 'fatima-eventos' and is_enabled;
  assert n = 0, 'fatima-eventos ligada: as celebrações diárias estão decididas como fora';

  select count(*) into n from public.sources
   where id = 'fatima-eventos' and notes not like 'DECIDIDO a 2026-08-29%';
  assert n = 0, 'a decisão sobre Fátima tem de ficar escrita na fonte';

  -- Quatro fontes ficaram com a sondagem de hoje anotada. Se uma delas voltar a
  -- trazer programação, a nota deixa de descrever a realidade — e é preferível
  -- que alguém a reescreva a que ninguém saiba porque é que o concelho está
  -- vazio.
  select count(*) into n from public.sources
   where id in ('cm-constancia', 'caminhos-cimt', 'teatro-virginia')
     and notes not like 'Sondagem 2026-08-29%';
  assert n = 0, format('%s fontes paradas sem a sondagem anotada', n);
end $$;

commit;
