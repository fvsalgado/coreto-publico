-- 0101 — As regiões. O Coreto deixa de ser uma agenda e passa a ser um produto.
--
-- (Ia chamar-se 0100, mas uma sessão paralela queimou o número no histórico
-- da base com «o auditório de Ourém entra no catálogo» minutos antes. O
-- número cede-se; a ordem de aplicação, que é a do carimbo temporal, não
-- muda.)
--
-- Até aqui havia *a* região: os concelhos da CIM do Médio Tejo, escritos no
-- seed, na prosa, nas verificações e numa constante de TypeScript. A decisão
-- do editor (2026-09-01) é vender o Coreto a outras Comunidades
-- Intermunicipais com uma regra inegociável — um só código, com as regiões
-- por configuração, nunca um fork por CIM — e num modelo multi-inquilino:
-- uma base, um deployment, cada região com o seu domínio.
--
-- Isto reverte parcialmente uma decisão registada em NOTES.md («não há
-- backoffice multi-tenant, por decisão de âmbito»): passa a haver
-- multi-região com um operador único; contas por CIM continuam de fora,
-- agora por fase e não por âmbito.
--
-- O desenho aproveita o que a casa já tinha certo: quase todas as tabelas
-- regionais penduram de `municipality_id`, por isso a região entra por UMA
-- tabela e UMA coluna — `regions` e `municipalities.region_id` — e tudo o
-- resto deriva por junção. Nada de `region_id` espalhado por vinte tabelas.
--
-- Sobre os identificadores: os slugs continuam num espaço de nomes GLOBAL
-- (`tomar`, `cine-teatro-paraiso`, `cm-tomar`). Os concelhos portugueses têm
-- nome único a nível nacional; para espaços, coretos, fontes e ciclos, a
-- regra — que os seeds do Médio Tejo já praticam — é desambiguar com o nome
-- da terra. Fica escrita no comentário da tabela e no guia de nascimento de
-- uma região nova.

-- ---------------------------------------------------------------------------
-- regions — quem é cada região, escrito uma vez
-- ---------------------------------------------------------------------------
create table public.regions (
  id            text primary key,   -- slug: 'medio-tejo'
  name          text not null,      -- 'Médio Tejo'
  cim_name      text not null,      -- 'Comunidade Intermunicipal do Médio Tejo'
  cim_url       text not null,      -- 'https://mediotejo.pt'

  -- O Host que aponta a esta região. É por aqui que um pedido a
  -- coreto.mediotejo.pt/agenda vira a agenda do Médio Tejo e um a
  -- coreto.<outra>.pt vira a da outra.
  domain        text not null unique,

  -- Para onde se escreve à região: entrada de eventos por email, contactos
  -- nas páginas públicas.
  contact_email text not null,

  -- O espaço de nomes dos UID do iCal. NUNCA muda depois de haver
  -- subscritores: um UID é a identidade permanente de um compromisso, e
  -- mudá-lo faz um calendário já subscrito tratar tudo como novo e duplicar
  -- a agenda inteira. Nasce igual ao domínio e diverge dele se um dia o
  -- domínio mudar — o domínio pode; isto não.
  ical_uid_domain text not null,

  -- Prosa da região. Tudo anulável de propósito: sem texto, o sítio gera a
  -- frase neutra a partir de name + concelhos. O contrato de composição, que
  -- o código implementa:
  --   tagline      → a description dos metadados, inteira e tal como se lê.
  --   about_intro  → a cauda do primeiro parágrafo de «O que é», depois da
  --                  enumeração dos concelhos (que continua viva, vinda da
  --                  base): «É a agenda cultural dos N concelhos da {cim}:
  --                  {nomes}. {about_intro}»
  --   about_story  → a frase com topónimos em «Porque se chama Coreto»; o
  --                  parágrafo do coreto-palco é do produto e vive no código.
  tagline       text,
  about_intro   text,
  about_story   text,

  -- Cofinanciamento (artigo 50.º do Regulamento (UE) 2021/1060), por
  -- programa regional — o Centro 2030 é do Centro; uma CIM do Norte ou do
  -- Alentejo tem outro, e uma sem cofinanciamento não tem nenhum: com isto a
  -- nulo, o bloco não se desenha e o rodapé não assume menção nenhuma.
  funding_statement    text,
  funding_logo_path    text,
  funding_logo_width   integer,
  funding_logo_height  integer,
  funding_logo_alt     text,

  -- A marca da CIM, em duas tintas (ver o comentário que hoje está em
  -- apps/web/src/lib/promotor.ts): a branco para o bloco grafite, a escuro
  -- para o toldo. Anulável: sem ficheiro, a assinatura é texto — uma região
  -- nasce sem commit de ativos.
  logo_on_graphite_path text,
  logo_on_brand_path    text,
  logo_width            integer,
  logo_height           integer,

  -- O cartaz social. Anulável: sem ele, serve o cartaz neutro do produto.
  og_image_path text,
  og_image_alt  text,

  -- RGPD: o responsável pelo tratamento. Nulo renderiza a própria CIM
  -- (cim_name/cim_url); a coluna existe porque o modelo — cada CIM
  -- responsável e o editor subcontratante, ou outro — é decisão contratual
  -- do editor, CIM a CIM, e o texto tem de poder acompanhar o contrato.
  data_controller_name text,
  data_controller_url  text,

  -- O que as verificações de esquema exigem a esta região: a contagem de
  -- concelhos declarada (uma contagem que a própria região declara é uma
  -- verificação; uma contagem escrita num script era um número mágico que já
  -- uma vez foi «corrigido» para errado — ver a saga das migrações 0016/0030)
  -- e a caixa geográfica onde todas as suas coordenadas têm de cair.
  expected_municipality_count integer not null check (expected_municipality_count > 0),
  bbox_lat_min double precision not null,
  bbox_lat_max double precision not null,
  bbox_lon_min double precision not null,
  bbox_lon_max double precision not null,
  constraint regions_bbox_ordenada
    check (bbox_lat_min < bbox_lat_max and bbox_lon_min < bbox_lon_max),

  is_enabled  boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.regions is
  'As regiões servidas pelo Coreto — uma por CIM, cada uma com o seu domínio. '
  'A identidade regional inteira (nome, promotor, prosa, financiamento, '
  'verificações) vive aqui: uma região nova são INSERTs, nunca um fork. Os '
  'slugs de concelhos, espaços, coretos, fontes e ciclos continuam globais; '
  'uma região nova desambigua os seus com o nome da terra, como os seeds do '
  'Médio Tejo sempre fizeram.';

comment on column public.regions.ical_uid_domain is
  'Espaço de nomes permanente dos UID do iCal. Nunca muda depois de haver '
  'subscritores: mudar duplica a agenda em todos os calendários subscritos.';

create trigger regions_set_updated_at
  before update on public.regions
  for each row execute function public.set_updated_at();

-- Leitura pública só do que está ligado; escrita, como em toda a casa, é
-- privilégio da chave de serviço.
alter table public.regions enable row level security;

create policy regions_public_read on public.regions
  for select to anon, authenticated using (is_enabled);

-- ---------------------------------------------------------------------------
-- O Médio Tejo passa a ser a primeira região configurada
--
-- Os textos são copiados LETRA A LETRA de onde hoje vivem no código
-- (apps/web/app/layout.tsx, apps/web/src/lib/promotor.ts,
-- apps/web/app/informacoes/page.tsx): quando o código passar a lê-los daqui,
-- o sítio não muda um byte — e essa igualdade é o critério de verificação
-- dessa mudança.
-- ---------------------------------------------------------------------------
insert into public.regions (
  id, name, cim_name, cim_url, domain, contact_email, ical_uid_domain,
  tagline, about_intro, about_story,
  funding_statement, funding_logo_path, funding_logo_width, funding_logo_height, funding_logo_alt,
  logo_on_graphite_path, logo_on_brand_path, logo_width, logo_height,
  og_image_path, og_image_alt,
  expected_municipality_count, bbox_lat_min, bbox_lat_max, bbox_lon_min, bbox_lon_max,
  sort_order
) values (
  'medio-tejo',
  'Médio Tejo',
  'Comunidade Intermunicipal do Médio Tejo',
  'https://mediotejo.pt',
  'coreto.mediotejo.pt',
  'coreto@mediotejo.pt',
  'coreto.mediotejo.pt',
  'Tudo o que há para fazer nos onze concelhos do Médio Tejo: música, teatro, exposições, festas, cinema e visitas. Da cidade-sede à aldeia.',
  'Reúne num sítio só o que já está a acontecer — concertos, teatro, exposições, festas, cinema, visitas — e ocupa o lugar da agenda intermunicipal que deixou de ser atualizada.',
  'Há coretos assim por todo o Médio Tejo: na Várzea Pequena, em Minde, no Jardim da Aranha, em Penhascoso, no Rossio ao Sul do Tejo. Alguns têm mais de cem anos.',
  'O Coreto é a agenda cultural dos onze concelhos do Médio Tejo: reúne num sítio só a programação que hoje está espalhada por onze agendas, publica-a em formatos abertos e devolve-a a quem a faz. É promovido pela Comunidade Intermunicipal do Médio Tejo e cofinanciado pelo Portugal 2030, através do programa regional Centro 2030, com o apoio da União Europeia.',
  '/logos/cofinanciamento-centro-2030.png', 1200, 138,
  'Centro 2030 — Os Fundos Europeus mais próximos de si · Portugal 2030 · Cofinanciado pela União Europeia',
  '/logos/cim-medio-tejo-branco.png', '/logos/cim-medio-tejo-escuro.png', 608, 159,
  -- O cartaz ainda vive na convenção de ficheiro do Next; o caminho é o que
  -- ele passará a ter quando a mudança do encaminhamento o mover. Ninguém lê
  -- esta coluna até lá.
  '/og/medio-tejo.png',
  'Coreto de ferro estilizado sobre o turquesa do Médio Tejo, com a frase «A agenda cultural do Médio Tejo» e os nomes dos onze concelhos.',
  11, 39.3, 39.85, -8.8, -7.8,
  0
)
on conflict (id) do update set
  name = excluded.name,
  cim_name = excluded.cim_name,
  cim_url = excluded.cim_url,
  domain = excluded.domain,
  contact_email = excluded.contact_email,
  tagline = excluded.tagline,
  about_intro = excluded.about_intro,
  about_story = excluded.about_story,
  funding_statement = excluded.funding_statement,
  funding_logo_path = excluded.funding_logo_path,
  funding_logo_width = excluded.funding_logo_width,
  funding_logo_height = excluded.funding_logo_height,
  funding_logo_alt = excluded.funding_logo_alt,
  logo_on_graphite_path = excluded.logo_on_graphite_path,
  logo_on_brand_path = excluded.logo_on_brand_path,
  logo_width = excluded.logo_width,
  logo_height = excluded.logo_height,
  og_image_path = excluded.og_image_path,
  og_image_alt = excluded.og_image_alt,
  expected_municipality_count = excluded.expected_municipality_count,
  bbox_lat_min = excluded.bbox_lat_min,
  bbox_lat_max = excluded.bbox_lat_max,
  bbox_lon_min = excluded.bbox_lon_min,
  bbox_lon_max = excluded.bbox_lon_max,
  sort_order = excluded.sort_order;
  -- ical_uid_domain fica de fora do update de propósito: é permanente.

-- ---------------------------------------------------------------------------
-- Cada concelho pertence a uma região; cada ciclo também
-- ---------------------------------------------------------------------------
alter table public.municipalities
  add column region_id text references public.regions(id) on delete restrict;

update public.municipalities set region_id = 'medio-tejo' where region_id is null;

alter table public.municipalities alter column region_id set not null;

comment on column public.municipalities.region_id is
  'A região a que o concelho pertence. É por esta coluna — e só por ela — que '
  'tudo o resto (eventos, espaços, coretos, fontes, ciclos) fica de uma '
  'região: deriva-se por junção, nunca por uma segunda coluna.';

-- `is_regional` passa a ler-se «atravessa os concelhos da SUA região» — o
-- CAMINHOS é programação em rede do Médio Tejo, não do país. Redes entre
-- CIM ficam explicitamente fora de âmbito.
alter table public.series
  add column region_id text references public.regions(id) on delete restrict;

update public.series set region_id = 'medio-tejo' where region_id is null;

alter table public.series alter column region_id set not null;

-- Nas submissões é uma pista, não um veredicto: o formulário grava a região
-- da página onde foi preenchido e o email a do endereço que recebeu; a região
-- definitiva sai do concelho escolhido na moderação. Anulável porque o
-- histórico não a tem e porque uma submissão pode chegar sem contexto.
alter table public.submissions
  add column region_id text references public.regions(id) on delete set null;

comment on column public.submissions.region_id is
  'Pista de triagem: de que região veio a submissão (página ou endereço de '
  'email). O veredicto é o concelho escolhido na aprovação.';

-- ---------------------------------------------------------------------------
-- A rede de segurança desta migração
-- ---------------------------------------------------------------------------
do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.regions where is_enabled;
  if v_n < 1 then
    raise exception 'não ficou uma única região ligada';
  end if;

  select count(*) into v_n from public.municipalities where region_id is distinct from 'medio-tejo';
  if v_n <> 0 then
    raise exception '% concelhos ficaram fora do Médio Tejo, e hoje não há outra região', v_n;
  end if;

  select count(*) into v_n
  from public.regions r
  where (select count(*) from public.municipalities m where m.region_id = r.id)
        <> r.expected_municipality_count;
  if v_n <> 0 then
    raise exception '% regiões com contagem de concelhos diferente da declarada', v_n;
  end if;
end $$;
