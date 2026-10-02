-- A segunda região de prova: o Mirante, um município sozinho.
--
-- NUNCA é uma migração e NUNCA chega a produção, como a Travessia (9000): só o
-- CI a executa, depois das migrações e antes das asserções.
--
-- Existe pelo C1-031. O produto licencia-se a uma câmara sozinha — é a
-- primeira frase da página do produto —, e nenhuma das regiões que o CI
-- semeava o provava: o Médio Tejo tem onze concelhos e a Travessia dois, e as
-- duas são promovidas por uma Comunidade. Com um concelho, a contagem por
-- extenso entrava nas frases sem concordância («Um concelhos, um palco», «os
-- um concelhos»), e o artigo do promotor estava escrito «da» à mão — «a agenda
-- dos um concelhos da Município do Mirante». Esta região é a que as faz
-- aparecer, se voltarem: UM concelho, e um promotor no MASCULINO (`cim_article`
-- «o», 0169).
--
-- Mínima como a Travessia — sem prosa, sem ficheiros, sem eventos, com a fonte
-- desligada —, e numa caixa geográfica disjunta das outras duas.

insert into public.regions (
  id, name, article, cim_name, cim_article, cim_url, domain, contact_email, ical_uid_domain,
  expected_municipality_count, bbox_lat_min, bbox_lat_max, bbox_lon_min, bbox_lon_max,
  sort_order
) values (
  'mirante',
  'Mirante',
  'o',
  'Município do Mirante',
  'o',
  'https://mirante.example',
  'coreto.mirante.example',
  'coreto@mirante.example',
  'coreto.mirante.example',
  1,
  37.00, 37.30, -8.00, -7.70,
  20
);

-- O concelho, com o artigo dele (0165): «do Mirante», «no Mirante». O
-- identificador é do espaço global de slugs, e nenhum concelho português se
-- chama assim.
insert into public.municipalities (id, name, article, district, latitude, longitude, sort_order, region_id, parish_count) values
  ('mirante', 'Mirante', 'o', 'Mirante', 37.15, -7.85, 1, 'mirante', 3);

-- Um espaço e uma fonte, que é o mínimo que as schema-checks exigem a
-- qualquer concelho — a fonte DESLIGADA, para o CI nunca bater a um domínio
-- que não existe.
insert into public.venues (id, name, municipality_id, kind, is_association, latitude, longitude) values
  ('auditorio-do-mirante', 'Auditório do Mirante', 'mirante', 'theatre', false, 37.151, -7.851);

insert into public.sources (id, name, kind, municipality_id, url, adapter, is_enabled) values
  ('cm-mirante', 'Agenda do Município do Mirante', 'municipal_site', 'mirante', 'https://cm-mirante.example/agenda', 'generic-html', false);
