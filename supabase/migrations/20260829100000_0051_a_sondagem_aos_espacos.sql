-- 0051 — A sondagem aos espaços, e a primeira porta que ela abriu.
--
-- Pergunta: cada um dos oitenta espaços publica a sua própria programação, e
-- dá para a ler? Sondaram-se os quarenta e um que têm endereço declarado —
-- robots.txt primeiro, depois a entrada do sítio — à procura de feed, de
-- dados estruturados, de uma página de agenda.
--
-- O que se encontrou, por ordem de utilidade:
--
--   · Um feed de eventos a sério, na Junta de Freguesia de Minde. Cada item
--     traz título, ligação e um `pubDate` que é o dia do evento, não o dia da
--     publicação. Fica ligado nesta migração, com o adaptador `rss-eventos`.
--   · Dez espaços que publicam programação de forma legível mas ainda sem
--     adaptador. Entram como fontes desligadas, cada uma a dizer o que tem e
--     o que lhe falta — que é o que a página das fontes já sabe mostrar.
--   · Dez endereços que não respondem a partir do recoletor. Não se dão por
--     mortos: já uma vez se deu por morto um sítio que estava vivo.
--   · O resto publica notícias, não agenda: um museu que anuncia a exposição
--     num parágrafo sem data não é uma fonte, é um cartaz.
--
-- Uma fonte desligada não é uma falha escondida — é a explicação de porque é
-- que falta a programação de um sítio, e vale mais do que uma lista arrumada
-- só com o que corre bem.

-- ---------------------------------------------------------------------------
-- A que fica a ler já.
-- ---------------------------------------------------------------------------

insert into public.sources (
  id, name, kind, municipality_id, venue_id, url, adapter, config,
  is_enabled, min_expected_items, public_note
) values (
  'jf-minde',
  'Junta de Freguesia de Minde',
  'feed',
  'alcanena',
  null,
  'https://www.jf-minde.pt/eventos/rss',
  'rss-eventos',
  '{}'::jsonb,
  true,
  1,
  'O feed de eventos da junta de freguesia. Minde tem cine-teatro, museu de aguarela, banda, fábrica de cultura e jazz, e nada disto passa pela agenda do município — a junta é que o publica.'
)
on conflict (id) do update set
  name = excluded.name,
  url = excluded.url,
  adapter = excluded.adapter,
  is_enabled = excluded.is_enabled,
  public_note = excluded.public_note,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- As que a sondagem encontrou e ainda não se leem.
--
-- Ficam desligadas, com endereço e razão. Desligada e explicada vale mais do
-- que ausente: quem lê a página das fontes fica a saber que a programação
-- existe e porque é que ainda não está aqui.
-- ---------------------------------------------------------------------------

insert into public.sources (
  id, name, kind, municipality_id, venue_id, url, adapter, config,
  is_enabled, min_expected_items, public_note
) values
  ('ccgv-sardoal', 'Centro Cultural Gil Vicente', 'venue_site', 'sardoal',
   'centro-cultural-gil-vicente', 'https://ccgv.sardoal.pt/programacao/', 'generic-html', '{}'::jsonb,
   false, 1,
   'A sala publica a programação e a bilheteira no seu próprio sítio, com dados estruturados. Falta ler: por enquanto o que há do Sardoal vem da agenda do município.'),

  ('cpminde-bilheteira', 'Casa do Povo de Minde — bilheteira', 'venue_site', 'alcanena',
   'cine-teatro-rogerio-venancio', 'https://cpminde.pt/bilheteira/', 'generic-html', '{}'::jsonb,
   false, 1,
   'O Cine-Teatro Rogério Venâncio vende bilhetes no sítio da Casa do Povo, e é aí que a programação aparece primeiro. A loja não abre os dados sem credenciais; a ler pela página, ainda por fazer.'),

  ('visitbarquinha-eventos', 'Visit Barquinha — eventos', 'venue_site', 'vila-nova-da-barquinha',
   null, 'https://visitbarquinha.pt/categorias/eventos/', 'generic-html', '{}'::jsonb,
   false, 1,
   'O turismo do município mantém uma categoria de eventos à parte da agenda da câmara — é por aqui que costuma sair o Barquinha Jazz e o que acontece no Barquinha Parque.'),

  ('fatima-eventos', 'Santuário de Fátima — eventos', 'venue_site', 'ourem',
   'santuario-de-fatima', 'https://www.fatima.pt/pt/events', 'generic-html', '{}'::jsonb,
   false, 1,
   'O santuário publica celebrações, exposições temporárias e encontros em endereços próprios por evento. É muita programação e é de acesso livre; falta decidir o que dela é agenda cultural da região e o que é vida religiosa corrente.'),

  ('espalhafitas-programacao', 'Espalhafitas — programação', 'venue_site', 'abrantes',
   'espalhafitas-cineclube', 'https://espalhafitas.wixsite.com/cineclubedeabrantes/programacao', 'generic-html', '{}'::jsonb,
   false, 1,
   'O cineclube publica a programação mensal no seu sítio. As sessões vêm num texto por mês e não numa lista de datas, o que dá trabalho a ler bem — e ler mal um cineclube é pior do que não o ler.'),

  ('cineclube-torres-novas-blog', 'Cineclube de Torres Novas — blogue', 'venue_site', 'torres-novas',
   'cineclube-torres-novas', 'https://cctorresnovas.blogspot.com/feeds/posts/default', 'rss-eventos', '{}'::jsonb,
   false, 1,
   'O blogue do cineclube tem feed, mas é um feed de notícias: a data de cada entrada é o dia em que foi escrita, não o dia da sessão. As sessões continuam a entrar pelo Teatro Virgínia, que as publica com hora.'),

  ('ourearte-eventos', 'Ourearte — eventos', 'venue_site', 'ourem',
   'ourearte', 'https://ourearte.pt/eventos/', 'generic-html', '{}'::jsonb,
   false, 1,
   'A escola de música e artes publica os seus concertos e audições. São poucos por ano e nem sempre com data fechada; a ler quando houver adaptador que aguente isso sem inventar datas.'),

  ('mnf-agenda', 'Museu Nacional Ferroviário', 'venue_site', 'entroncamento',
   'museu-nacional-ferroviario', 'https://www.fmnf.pt', 'generic-html', '{}'::jsonb,
   false, 1,
   'O museu tem programação própria — visitas temáticas, comboios históricos, exposições — no seu sítio. Falta ler.'),

  ('ccv-alviela-agenda', 'Centro Ciência Viva do Alviela', 'venue_site', 'alcanena',
   'ccv-alviela-carsoscopio', 'https://alviela.cienciaviva.pt', 'generic-html', '{}'::jsonb,
   false, 1,
   'O Carsoscópio publica atividades e oficinas no seu sítio. Falta ler.'),

  ('ipt-agenda', 'Instituto Politécnico de Tomar — agenda', 'venue_site', 'tomar',
   'ipt', 'https://portal2.ipt.pt/pt/agenda', 'generic-html', '{}'::jsonb,
   false, 1,
   'O politécnico tem agenda própria, com muita coisa aberta à cidade e muita coisa que é vida académica interna. Entra quando houver como separar as duas.')
on conflict (id) do update set
  name = excluded.name,
  url = excluded.url,
  public_note = excluded.public_note,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- As garantias.
-- ---------------------------------------------------------------------------
do $$
declare
  v_sem_nota integer;
  v_orfas integer;
  v_minde integer;
begin
  select count(*) into v_sem_nota from public.sources
    where public_note is null or btrim(public_note) = '';
  if v_sem_nota > 0 then
    raise exception '% fontes sem linha pública — a página /fontes mostra-as todas', v_sem_nota;
  end if;

  -- Uma fonte apontada a um espaço que não existe é uma ligação partida na
  -- página do concelho, e passa despercebida porque o `venue_id` é opcional.
  select count(*) into v_orfas from public.sources s
    where s.venue_id is not null
      and not exists (select 1 from public.venues v where v.id = s.venue_id);
  if v_orfas > 0 then
    raise exception '% fontes apontadas a espaços que não existem', v_orfas;
  end if;

  select count(*) into v_minde from public.sources
    where id = 'jf-minde' and is_enabled and adapter = 'rss-eventos';
  if v_minde <> 1 then
    raise exception 'a fonte de Minde não ficou ligada com o adaptador rss-eventos';
  end if;
end
$$;
