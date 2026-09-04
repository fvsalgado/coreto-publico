-- 0028 — Onde é que cada espaço publica, e o que isso obriga a concluir.
--
-- O catálogo tem 81 espaços e tinha **dois** com endereço. Foi semeado com
-- nomes e tipos, sem fontes — e sem fontes um catálogo de espaços é uma lista
-- de nomes bonitos que não traz um evento.
--
-- Isto regista o que uma sondagem verificou, um a um, e sobretudo o que ela
-- obriga a concluir. As respostas negativas ficam escritas porque custaram o
-- mesmo a obter e evitam que alguém repita o trabalho daqui a três meses.
--
-- ---------------------------------------------------------------------------
-- O que se procurou, e porquê
-- ---------------------------------------------------------------------------
-- A hipótese vinha de outro projeto do mesmo autor: muitos equipamentos
-- culturais correm WordPress com o The Events Calendar, que serve a
-- programação inteira em `/wp-json/tribe/events/v1/events` e em `?ical=1`. Um
-- feed desses é um contrato estável — sem deriva de seletores, com as datas a
-- trazerem ano e fuso — e acrescentar uma fonte passa a ser configuração em
-- vez de um parser novo.
--
-- Procurou-se isso em todos os candidatos. Encontrou-se **uma vez**.
--
-- ---------------------------------------------------------------------------
-- A conclusão estrutural, que é a que interessa
-- ---------------------------------------------------------------------------
-- No Médio Tejo os equipamentos são esmagadoramente municipais, e quem os
-- programa é a câmara. A programação do Cine-Teatro São Pedro, do Centro
-- Cultural Gil Vicente ou da Casa da Cultura não vive num sítio do
-- equipamento: vive na agenda da câmara, que o Coreto já recolhe.
--
-- Isso muda onde está a alavanca. Não são 81 adaptadores de espaço — são os
-- nomes de sítio que as agendas municipais já dão e que ninguém casou com o
-- catálogo. É por isso que `with_venue` está nos 10%: não é a recolha que
-- falha, é a fila de `/admin/espacos` que ninguém percorreu.
--
-- ---------------------------------------------------------------------------
-- O que se confirmou, com o veredito pela assinatura do conteúdo
-- ---------------------------------------------------------------------------
update public.venues set
  website_url = 'https://www.bonssons.pt',
  notes = 'WordPress com tipo de conteúdo próprio: /wp-json/wp/v2/event devolve '
       || 'JSON com a programação do Bons Sons. É a única API de primeira parte '
       || 'encontrada nos espaços, fora da de Ourém. Merece adaptador.'
where id = 'scocs-cem-soldos';

update public.venues set
  website_url = 'https://www.fatima.pt/pt/schedule',
  notes = 'Sítio próprio com horários estruturados por categoria (missa, terço, '
       || 'procissão, celebrações). Sem API: /wp-json e ?ical=1 respondem 302 '
       || 'para a entrada. Fonte de HTML, e das maiores em volume do território.'
where id = 'santuario-de-fatima';

update public.venues set
  website_url = 'https://www.fmnf.pt/pt',
  notes = 'Sítio próprio, só HTML. Tudo o que se pediu abaixo de /wp-json '
       || 'responde 302 para a entrada — não é WordPress, e o 200 que uma '
       || 'sondagem ingénua vê é a homepage servida depois do redirecionamento.'
where id = 'museu-nacional-ferroviario';

update public.venues set
  website_url = 'https://alviela.cienciaviva.pt',
  notes = 'Sítio próprio antigo, servido em iso-8859-1. Sem API: /wp-json dá '
       || '404. Fonte de HTML, se e quando valer o adaptador.'
where id = 'ccv-alviela-carsoscopio';

-- ---------------------------------------------------------------------------
-- E o que se procurou e não existe. Isto não é uma lacuna do registo: é o
-- resultado.
-- ---------------------------------------------------------------------------
update public.venues set
  notes = coalesce(notes || ' ', '')
       || 'Sem sítio próprio encontrado. Programado pela câmara e publicado na '
       || 'agenda municipal, que já é recolhida — o que falta é casar o nome '
       || 'do sítio com este espaço, não uma fonte nova.'
where id in (
  'cine-teatro-sao-pedro-abrantes', 'centro-cultural-gil-vicente',
  'casa-da-cultura-ferreira-do-zezere', 'centro-cultural-entroncamento',
  'cineteatro-municipal-serta', 'cine-teatro-rogerio-venancio',
  'cine-teatro-sao-pedro-alcanena', 'teatro-municipal-ourem',
  'centro-cultural-barquinha', 'ceft-casa-dos-cubos'
) and notes is null;

-- ---------------------------------------------------------------------------
-- Facebook: pode-se, e não é um scraper.
--
-- Vários destes espaços publicam only no Facebook. Foi testado o que lá se
-- consegue ir buscar:
--
--     página                     302  (muro de login)
--     separador /events          200  HTML sem conteúdo servido
--     graph.facebook.com/…       403  {"message":"(#200) Provide valid app ID"}
--
-- Ou seja: existe caminho legítimo e não é raspar HTML — é a Graph API com uma
-- aplicação registada. E essa exige uma de duas coisas: ou o administrador de
-- cada página concede um token, ou a aplicação passa a Análise da Meta com
-- «Page Public Content Access», que leva verificação de negócio. É papelada,
-- não é código, e por isso não entra como tarefa de engenharia enquanto
-- ninguém a tratar.
-- ---------------------------------------------------------------------------

do $$
declare
  v_com_sitio integer;
begin
  select count(*) into v_com_sitio from public.venues where website_url is not null;
  if v_com_sitio < 6 then
    raise exception 'esperavam-se pelo menos 6 espaços com endereço, e há %', v_com_sitio;
  end if;
end
$$;
