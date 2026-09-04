-- 0111 — Cada região tem um domínio canónico; os outros apontam-lhe.
--
-- Com o coreto.org registado, cada região passa a poder ter dois endereços:
-- o seu domínio próprio (`regions.domain`, que continua a ser O canónico — o
-- dos endereços canónicos, dos feeds e do sitemap) e o subdomínio de produto
-- `<slug>.coreto.org`, que o wildcard no Vercel torna automático. Dois
-- endereços a SERVIR o mesmo conteúdo era conteúdo duplicado; por isso um
-- alias nunca serve: redireciona (308) para o canónico, caminho incluído.
--
-- A tabela é deliberadamente pequena: um alias é encaminhamento, não
-- identidade. Quem serve continua a ser `regions.domain`; isto só diz «este
-- host também é desta região — manda-o para casa». A regra de que um alias
-- não pode ser o canónico de ninguém vive nas schema-checks, onde as regras
-- entre tabelas desta casa sempre viveram.

create table public.region_domain_aliases (
  domain     text primary key,
  region_id  text not null references public.regions(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.region_domain_aliases is
  'Domínios que redirecionam (308) para o canónico da sua região '
  '(regions.domain). Encaminhamento, não identidade: um alias nunca serve '
  'conteúdo, e por isso nunca aparece em canónicos, feeds ou sitemaps.';

-- Leitura pública: é o middleware, com a chave anónima, que constrói o mapa.
alter table public.region_domain_aliases enable row level security;

create policy region_domain_aliases_public_read on public.region_domain_aliases
  for select to anon, authenticated using (true);

-- Os primeiros dois alias, à espera do DNS:
--   · o subdomínio de produto do Médio Tejo;
--   · o www do apex da montra, que metade das pessoas escreve por hábito.
insert into public.region_domain_aliases (domain, region_id) values
  ('mediotejo.coreto.org', 'medio-tejo'),
  ('www.coreto.org',       'vale-do-coreto');
