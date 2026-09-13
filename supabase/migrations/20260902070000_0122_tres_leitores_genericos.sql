-- 0122 — Três leitores genéricos: iCalendar, The Events Calendar e JSON-LD.
--
-- Até aqui, cada adaptador novo nascia de um sítio: o Joomla das câmaras, a
-- API de Ourém, o CMS das juntas. Funcionou para este território e não
-- escala para o próximo — uma região nova tem trinta sítios que nunca vimos,
-- e escrever trinta adaptadores é o contrário do que o produto promete
-- («uma CIM nova entra sem um único commit», docs/NOVA-CIM.md).
--
-- Esta migração regista três adaptadores que não são de sítio nenhum. São do
-- FORMATO, e servem qualquer região que o use:
--
--   · `ical` — qualquer calendário público em iCalendar (RFC 5545): o Google
--     Calendar, o Outlook, o Nextcloud, o «subscrever o calendário» de
--     metade dos CMS.
--   · `wordpress-events` — a API REST do The Events Calendar, o plugin de
--     agenda mais instalado do WordPress, em `/wp-json/tribe/events/v1/events`.
--   · `events-calendar` — qualquer página que embuta `schema.org/Event` em
--     JSON-LD, que é o que a maioria dos plugins de eventos escreve.
--
-- As três fontes nascem DESLIGADAS, e por razões diferentes, ditas em cada
-- `public_note`:
--
--   · A UF de Além da Ribeira e Pedreira (Tomar) é uma fonte verdadeira,
--     sondada em agosto de 2026 (docs/regioes/medio-tejo/FREGUESIAS.md):
--     corre o The Events Calendar e responde na API. A agenda estava vazia
--     nesse dia; liga-se quando houver programação a ler.
--   · Para o `ical` e o `events-calendar` não se encontrou neste território
--     nenhuma fonte real — a página do Centro Cultural Gil Vicente não tem
--     JSON-LD (docs/regioes/medio-tejo/FONTES.md), e o Viral Agenda, que o
--     tem, é um agregador de terceiros de onde não se recolhe. As duas linhas
--     ficam na montra (região 0110), com endereços `.example` que nunca
--     serão pedidos, pela mesma convenção das fontes de lá: existem para
--     registar o adaptador, e o teste de registo (`registo.test.ts`) exige
--     que cada adaptador em código seja nomeado em SQL.
--
-- Nenhuma destas linhas mexe no que já corre.

insert into public.sources (
  id, name, kind, municipality_id, venue_id, url, adapter, config,
  is_enabled, public_note
) values
  ('jf-alem-da-ribeira-e-pedreira', 'UF de Além da Ribeira e Pedreira', 'feed', 'tomar',
   null, 'https://jf-alemdaribeirapedreira.pt/wp-json/tribe/events/v1/events', 'wordpress-events', '{}'::jsonb,
   false,
   'A junta corre o WordPress com o The Events Calendar, que publica a agenda numa API aberta. Estava vazia quando se sondou, em agosto de 2026; liga-se quando houver programação a ler.'),

  ('cine-teatro-da-charamela-ical', 'Cine-Teatro da Charamela — calendário', 'feed', 'vila-da-charamela',
   'cine-teatro-da-charamela', 'https://cineteatro-charamela.example/agenda.ics', 'ical',
   '{"venueName": "Cine-Teatro da Charamela"}'::jsonb,
   false,
   'Fonte de demonstração da montra: o endereço não existe e nunca será pedido. A linha regista o leitor de calendários iCalendar, por onde entra qualquer calendário público — do Google Calendar ao Outlook — com uma linha e sem código.'),

  ('filarmonica-da-ponte-agenda', 'Sociedade Filarmónica da Ponte — agenda', 'venue_site', 'ponte-do-bombo',
   'sociedade-filarmonica-da-ponte', 'https://filarmonica-da-ponte.example/agenda/', 'events-calendar', '{}'::jsonb,
   false,
   'Fonte de demonstração da montra: o endereço não existe e nunca será pedido. A linha regista o leitor de dados estruturados schema.org (JSON-LD), por onde entra qualquer página de agenda que os publique — a maioria dos plugins de eventos fá-lo sem que ninguém na casa saiba.')
on conflict (id) do update set
  name = excluded.name,
  kind = excluded.kind,
  municipality_id = excluded.municipality_id,
  venue_id = excluded.venue_id,
  url = excluded.url,
  adapter = excluded.adapter,
  config = excluded.config,
  is_enabled = excluded.is_enabled,
  public_note = excluded.public_note,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Conferir o que ficou, com o nome de cada adaptador escrito por extenso — é
-- também por aqui que o teste de registo confirma que os três existem em
-- código.
-- ---------------------------------------------------------------------------

do $$
declare
  n integer;
begin
  select count(*) into n from public.sources
   where id = 'jf-alem-da-ribeira-e-pedreira' and adapter = 'wordpress-events'
     and municipality_id = 'tomar' and not is_enabled;
  if n <> 1 then
    raise exception 'a fonte da UF de Além da Ribeira e Pedreira não ficou registada com o wordpress-events, desligada';
  end if;

  select count(*) into n from public.sources
   where id = 'cine-teatro-da-charamela-ical' and adapter = 'ical' and not is_enabled
     and url like '%.example/%';
  if n <> 1 then
    raise exception 'a fonte de demonstração do ical não ficou registada, desligada e com endereço .example';
  end if;

  select count(*) into n from public.sources
   where id = 'filarmonica-da-ponte-agenda' and adapter = 'events-calendar' and not is_enabled
     and url like '%.example/%';
  if n <> 1 then
    raise exception 'a fonte de demonstração do events-calendar não ficou registada, desligada e com endereço .example';
  end if;
end
$$;
