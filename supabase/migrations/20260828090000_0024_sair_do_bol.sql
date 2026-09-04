-- 0024 — O BOL sai, e o Teatro Virgínia fica dito como está.
--
-- A regra do projeto passou a ser explícita: recolhe-se de sites municipais,
-- dos próprios equipamentos e de fontes públicas de dados. De terceiros, não.
-- A migração 0019 tinha apontado o Teatro Virgínia à loja BOL da sala, com um
-- adaptador de 492 linhas escrito só para isso. Sai tudo.

-- ---------------------------------------------------------------------------
-- Teatro Virgínia: o sítio próprio não serve hoje, e a razão é outra.
--
-- A 0019 justificou o BOL dizendo que o sítio próprio «monta a programação já
-- no browser». Isso não é verdade — o sítio é servido do servidor, e o plano
-- de dados chegou a dizer que por isso servia de fonte. Foi ver-se ao detalhe:
--
--   * «Programação» (`/index.php`) está **vazia**: 180 caracteres de texto,
--     que são o menu e o rodapé. Nenhum espetáculo.
--   * O arquivo (`/index.php/arquivo`) traz quarenta espetáculos, com título,
--     categoria, etiquetas e imagem — e **nenhuma data**. Os cabeçalhos
--     agrupam por mês de publicação, que não é a data de nenhum espetáculo.
--   * As páginas de detalhe **respondem 404**. As ligações da própria listagem
--     estão partidas, todas as que foram tentadas.
--
-- Um evento sem data não entra no catálogo, por regra antiga e boa. Um sítio
-- que não publica datas não é uma fonte, por muito bem servido que seja o HTML.
--
-- Fica desligada, com o endereço próprio, à espera de que a casa volte a
-- publicar programação — ou de que o pedido à CIM abra o site municipal, que é
-- de onde o Teatro Virgínia também é programado.
-- ---------------------------------------------------------------------------
update public.sources set
  url = 'https://www.teatrovirginia.pt/index.php',
  adapter = 'generic-html',
  config = '{}'::jsonb,
  is_enabled = false,
  consecutive_failures = 0,
  circuit_open_until = null,
  last_error = null,
  notes = 'Desligada a 2026-08-28. Não se recolhe de bilheteiras de terceiros. '
       || 'O sítio próprio é servido do servidor mas não publica datas: a '
       || 'Programação está vazia, o arquivo não traz data nenhuma, e as '
       || 'páginas de detalhe respondem 404. Um evento sem data não entra no '
       || 'catálogo. Torres Novas entra por email e formulário até o site '
       || 'municipal abrir ao agente do Coreto.'
where id = 'teatro-virginia';

-- ---------------------------------------------------------------------------
-- Cine-Teatro Paraíso: ganha o adaptador que o sítio dele pede.
--
-- Estava com `generic-html` e `config` vazia — e esse adaptador recusa-se a
-- correr sem `listSelector`, por isso a fonte falhava todas as noites sem
-- nunca ter trazido nada.
--
-- O sítio é feito à medida e traz mais do que os outros: identificador
-- estável, categoria, imagem, e um resumo com todas as sessões de cada
-- espetáculo, com hora. A entrada é que serve; `/agenda` monta-se no browser e
-- devolve zero blocos a quem a lê do servidor.
-- ---------------------------------------------------------------------------
update public.sources set
  url = 'https://cineteatro.cm-tomar.pt/',
  adapter = 'paraiso',
  config = '{}'::jsonb,
  is_enabled = true,
  min_expected_items = 1,
  consecutive_failures = 0,
  circuit_open_until = null,
  last_error = null,
  notes = 'Sítio próprio, feito à medida. A entrada serve a programação; '
       || '/agenda monta-se no browser e devolve zero blocos ao servidor. '
       || 'O resumo traz todas as sessões de cada espetáculo, com hora.'
where id = 'cine-teatro-paraiso';

-- ---------------------------------------------------------------------------
-- A trava que torna a regra verificável, e não só escrita.
--
-- Uma regra que vive num documento volta a ser quebrada por quem não o leu. Um
-- `update` que aponte uma fonte a uma bilheteira de terceiros passa a rebentar
-- aqui, com o nome da fonte, em vez de passar despercebido até alguém reparar
-- no domínio meses depois.
--
-- O que a lista tem são **bilheteiras e agregadores**: sítios cujos dados são
-- deles, recolhidos e organizados por eles, e cuja programação chega ao Coreto
-- em segunda mão.
--
-- O que a lista deliberadamente **não** tem é o Issuu, onde vivem as agendas
-- em PDF de vários municípios. A distinção não é o servidor, é de quem são os
-- dados: uma agenda que a câmara publicou e alojou no Issuu continua a ser a
-- publicação da câmara, como um cartaz continua a ser do teatro esteja ele
-- pregado em que parede estiver. Alojamento não é autoria.
-- ---------------------------------------------------------------------------
do $$
declare
  terceiros text[] := array['bol.pt', 'ticketline.pt', 'blueticket.pt', 'seetickets.com',
                            'eventbrite.', 'ticketmaster.', 'viralagenda.com', 'songkick.com',
                            'bandsintown.com'];
  padrao text;
  fonte record;
begin
  foreach padrao in array terceiros loop
    for fonte in
      select id, url from public.sources where position(padrao in lower(url)) > 0
    loop
      raise exception
        'a fonte «%» aponta para %, que é um terceiro — recolhe-se de sites municipais, dos próprios equipamentos e de fontes públicas de dados',
        fonte.id, padrao;
    end loop;
  end loop;
end
$$;
