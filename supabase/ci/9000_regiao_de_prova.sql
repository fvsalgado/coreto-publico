-- A região de prova: a Travessia do Zêzere.
--
-- NUNCA é uma migração e NUNCA chega a produção. Vive em `supabase/ci/` e só
-- o CI a executa (`verify-migrations.sh` e o job `regioes`), depois das
-- migrações e antes das asserções — é o que faz o loop das schema-checks e o
-- sítio inteiro correrem sobre DUAS regiões todas as noites.
--
-- É também o guia NOVA-CIM em forma executável: estes INSERTs, com os nomes
-- trocados pelos verdadeiros, são exatamente o que se corre para uma CIM nova
-- entrar em produção. Se um dia o processo de nascer uma região mudar e este
-- ficheiro não mudar com ele, o CI conta.
--
-- A Travessia é deliberadamente MÍNIMA — é a região no dia zero:
--
-- - sem tagline nem prosa: prova as frases geradas («Tudo o que há para fazer
--   nos dois concelhos da Travessia do Zêzere…»);
-- - sem logótipos nem cartaz social: prova a assinatura em texto e a ausência
--   de og:image — o nascimento não pode depender de um commit de ativos;
-- - sem cofinanciamento nem responsável próprio: o bloco não se desenha e o
--   RGPD cai na CIM;
-- - sem fronteiras nos concelhos: o mapa degrada para os centros;
-- - sem eventos: as páginas provam os estados vazios;
-- - fontes DESLIGADAS: o CI nunca faz um pedido a um sítio que não existe.
--
-- O artigo é «a» («da Travessia», «na Travessia») de propósito: o Médio Tejo
-- é «o», e com os dois artigos no CI nenhuma contração volta a ficar cravada.
-- A caixa geográfica é disjunta da do Médio Tejo, para as asserções de
-- coordenadas não se encobrirem uma à outra.

insert into public.regions (
  id, name, article, cim_name, cim_url, domain, contact_email, ical_uid_domain,
  expected_municipality_count, bbox_lat_min, bbox_lat_max, bbox_lon_min, bbox_lon_max,
  sort_order
) values (
  'travessia',
  'Travessia do Zêzere',
  'a',
  'Comunidade Intermunicipal da Travessia do Zêzere',
  'https://travessia.example',
  'coreto.travessia.example',
  'coreto@travessia.example',
  'coreto.travessia.example',
  2,
  40.50, 41.00, -8.20, -7.60,
  10
);

-- Os dois concelhos. Os identificadores são o espaço global de slugs do
-- produto (os endereços não levam região), por isso até os fictícios são
-- nomes que nenhum concelho português tem.
insert into public.municipalities (id, name, district, latitude, longitude, sort_order, region_id) values
  ('pontezela',     'Pontezela',     'Travessia', 40.72, -7.95, 1, 'travessia'),
  ('vau-do-zezere', 'Vau do Zêzere', 'Travessia', 40.61, -7.78, 2, 'travessia');

-- Um espaço por concelho — é o mínimo que as schema-checks exigem a qualquer
-- região. Um municipal e uma coletividade, para as duas vias de apresentação.
insert into public.venues (id, name, municipality_id, kind, is_association, latitude, longitude) values
  ('cine-teatro-de-pontezela', 'Cine-Teatro de Pontezela', 'pontezela',     'theatre',     false, 40.721, -7.951),
  ('casa-do-povo-do-vau',      'Casa do Povo do Vau',      'vau-do-zezere', 'association', true,  40.612, -7.781);

-- Uma fonte por concelho, DESLIGADA: fica registado de onde a região há de
-- ler, sem o CI fazer um único pedido a um domínio que não existe.
insert into public.sources (id, name, kind, municipality_id, url, adapter, is_enabled) values
  ('cm-pontezela',     'Agenda do Município de Pontezela',     'municipal_site', 'pontezela',     'https://cm-pontezela.example/agenda',     'generic-html', false),
  ('cm-vau-do-zezere', 'Agenda do Município do Vau do Zêzere', 'municipal_site', 'vau-do-zezere', 'https://cm-vaudozezere.example/agenda', 'generic-html', false);

-- Um coreto no levantamento, para a secção ter chão quando se ligar.
insert into public.coretos (id, name, parish, municipality_id, latitude, longitude, is_confirmed) values
  ('coreto-do-largo-do-vau', 'Coreto do Largo do Vau', 'Vau do Zêzere', 'vau-do-zezere', 40.613, -7.782, true);

-- Um ciclo em rede, para a prova das páginas de ciclos.
insert into public.series (id, name, kind, region_id, is_regional, description) values
  ('encontros-da-travessia', 'Encontros da Travessia', 'network_programme', 'travessia', true,
   'A programação em rede dos dois concelhos da Travessia do Zêzere.');

-- O alias de produto (0111): o subdomínio do coreto.org que redireciona ao
-- canónico. É o que o verificar-regioes afirma com um 308.
insert into public.region_domain_aliases (domain, region_id) values
  ('travessia.coreto.example', 'travessia');

-- Sem linhas em site_sections: uma região nova nasce com as secções todas
-- ligadas — desligar é um ato do painel, não um passo do nascimento.
