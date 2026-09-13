-- 0110 — A região montra: o Vale do Coreto.
--
-- O produto precisa de uma região que não seja de ninguém: a que responde por
-- anfitriões desconhecidos e pré-visualizações, a que fica quando um cliente
-- sai, a que se mostra a quem pergunta «e isto o que é?». Hoje esse papel é
-- do Médio Tejo — um cliente pago — e a guarda do #93 deixou escrito o
-- caminho certo: primeiro nasce a montra, depois a omissão do deployment
-- passa para ela (variável `REGIAO_DE_OMISSAO` no Vercel; ver docs/VERCEL.md).
--
-- O Vale do Coreto não existe no mapa. Os dois concelhos, os espaços e as
-- fontes são INVENTADOS de propósito — a regra da casa é não recolher nada de
-- terceiros, e uma montra com dados verdadeiros de alguém seria exatamente
-- isso. As fontes nascem desligadas: nunca se fará um pedido a um domínio que
-- não existe.
--
-- Nasce pelo guia NOVA-CIM, como qualquer região — é a mesma forma do seed de
-- prova do CI (supabase/ci/9000), que continua a ser só do CI: os
-- identificadores daqui são outros, para as duas conviverem na mesma base
-- quando o verify-migrations corre as três.
--
-- A caixa geográfica é disjunta da do Médio Tejo e da região de prova, para
-- as asserções de coordenadas das schema-checks não se encobrirem.

insert into public.regions (
  id, name, article, cim_name, cim_url, domain, contact_email, ical_uid_domain,
  tagline, about_intro, about_story,
  expected_municipality_count, bbox_lat_min, bbox_lat_max, bbox_lon_min, bbox_lon_max,
  sort_order
) values (
  'vale-do-coreto',
  'Vale do Coreto',
  'o',
  'Equipa do Coreto',
  'https://salgado.zip',
  'coreto.org',
  'ola@coreto.org',
  'coreto.org',
  'A montra do Coreto — a agenda cultural que cada região pode ter.',
  'O Vale do Coreto não existe no mapa: é a região de demonstração do Coreto, '
  || 'com dois concelhos inventados e uma agenda por preencher. Serve para '
  || 'mostrar como se apresenta a agenda cultural de uma região verdadeira.',
  'O Coreto é um software de agenda cultural por regiões: uma instalação, '
  || 'várias comunidades intermunicipais, cada uma no seu domínio, com os '
  || 'seus concelhos, as suas fontes e a sua identidade. Esta montra mostra o '
  || 'produto sem pedir nada emprestado a ninguém — os dados são inventados '
  || 'de propósito, porque a regra da casa é não recolher de terceiros. Uma '
  || 'região nova nasce por configuração, nunca por um fork. O Coreto — o '
  || 'nome, o código e o desenho — é desenvolvido e é propriedade de Fábio '
  || 'Salgado (salgado.zip).',
  2,
  41.20, 41.70, -7.40, -6.90,
  100
);

-- Os dois concelhos inventados. Os identificadores vivem no espaço global de
-- slugs do produto, por isso são nomes que nenhum concelho português tem.
insert into public.municipalities (id, name, district, latitude, longitude, sort_order, region_id) values
  ('vila-da-charamela', 'Vila da Charamela', 'Vale do Coreto', 41.45, -7.20, 1, 'vale-do-coreto'),
  ('ponte-do-bombo',    'Ponte do Bombo',    'Vale do Coreto', 41.32, -7.05, 2, 'vale-do-coreto');

-- Um espaço por concelho — o mínimo que as schema-checks exigem a qualquer
-- região. Um municipal e uma coletividade, para as duas vias de apresentação.
insert into public.venues (id, name, municipality_id, kind, is_association, latitude, longitude) values
  ('cine-teatro-da-charamela',      'Cine-Teatro da Charamela',      'vila-da-charamela', 'theatre',     false, 41.451, -7.201),
  ('sociedade-filarmonica-da-ponte','Sociedade Filarmónica da Ponte','ponte-do-bombo',    'association', true,  41.321, -7.051);

-- Uma fonte por concelho, DESLIGADA: fica escrito de onde uma região a sério
-- leria, sem nunca se pedir nada a um domínio que não existe.
insert into public.sources (id, name, kind, municipality_id, url, adapter, is_enabled) values
  ('cm-vila-da-charamela', 'Agenda do Município da Vila da Charamela', 'municipal_site', 'vila-da-charamela', 'https://cm-viladacharamela.example/agenda', 'generic-html', false),
  ('cm-ponte-do-bombo',    'Agenda do Município da Ponte do Bombo',    'municipal_site', 'ponte-do-bombo',    'https://cm-pontedobombo.example/agenda',    'generic-html', false);

-- Um coreto no levantamento, que uma montra do Coreto sem coreto era pobre.
insert into public.coretos (id, name, parish, municipality_id, latitude, longitude, is_confirmed) values
  ('coreto-do-jardim-da-charamela', 'Coreto do Jardim da Charamela', 'Vila da Charamela', 'vila-da-charamela', 41.452, -7.202, true);

-- Um ciclo em rede, para a página dos ciclos ter chão.
insert into public.series (id, name, kind, region_id, is_regional, description) values
  ('bandas-no-coreto', 'Bandas no Coreto', 'network_programme', 'vale-do-coreto', true,
   'A programação em rede dos dois concelhos do Vale do Coreto.');

-- Sem linhas em site_sections: como qualquer região, nasce com tudo ligado.
