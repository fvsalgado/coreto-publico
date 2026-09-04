-- 0069 — O que se conseguiu provar sobre os espaços, e o que não.
--
-- O catálogo tinha oitenta espaços, doze sem uma linha de descrição e trinta e
-- dois sem fotografia. Esta migração fecha a parte que se consegue fechar sem
-- inventar nada, e diz em voz alta o tamanho da parte que fica.
--
-- ## As fotografias: quatro em trinta e duas
--
-- As quarenta e oito fotografias que o catálogo já tinha vêm todas do Wikimedia
-- Commons, e é regra da casa: uma fotografia de um sítio municipal é de quem a
-- tirou, e uma agenda pública não se serve do que não pode dar. Procuraram-se
-- as trinta e duas que faltavam por coordenadas (raio de 120 m à volta de cada
-- espaço) e por nome, e depois varreu-se o Commons concelho a concelho.
--
-- Existem quatro. As outras vinte e oito não existem — não há fotografia livre
-- do Cineclube de Torres Novas nem do Coreto de Espite, e uma agenda que
-- copiasse a do sítio da câmara estaria a publicar o que não é dela. Fica por
-- fazer, e fica por fazer com uma razão.
--
-- Cada uma foi vista antes de entrar. Duas do Mercado de Tomar estavam
-- disponíveis e escolheu-se a que mostra o corpo do edifício com a insígnia, e
-- não a que mostra sobretudo o parque de estacionamento.
--
-- ## As descrições: dez em doze
--
-- Cada uma sai de uma fonte que se pode citar — a câmara, o turismo do
-- concelho, a Biblioteca Nacional, a base de bandas filarmónicas da
-- Universidade de Aveiro. Ficam duas de fora, e adiante se diz porquê.
--
-- ## Três espaços que faltavam, e um que não existe
--
-- A ficha de «Casa da Cultura» de Ferreira do Zêzere trazia a dúvida escrita
-- nas próprias notas desde 28 de agosto: «Não foi possível confirmar
-- equipamento com este nome em fontes oficiais». Está confirmado que não
-- existe: o turismo do concelho lista três espaços culturais — a biblioteca, o
-- Cine-Teatro Ivone Silva e o Centro Cultural Alfredo Keil — e a Casa da
-- Cultura não é nenhum deles. Nenhum evento lhe estava ligado.
--
-- Sai, e entram os dois que ela estava a tapar. Entra também o Centro Cultural
-- Elvino Pereira, em Mação, que o catálogo não tinha e onde a biblioteca
-- municipal já estava — as coordenadas da biblioteca são as dele.
-- ---------------------------------------------------------------------------

-- ------------------------------- Fotografias --------------------------------
-- Todas de Threeohsix, CC BY-SA 4.0, via Wikimedia Commons.
update public.venues as v set
  image_url = f.url,
  image_credit = 'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons',
  updated_at = now()
from (values
  ('ourearte',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Fachada_principal_da_Ourearte%2C_antiga_Casa_dos_Magistrados%2C_atual_Casa_da_M%C3%BAsica_de_Our%C3%A9m.jpg?width=1600'),
  ('mercado-municipal-tomar',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Volume_principal_com_ins%C3%ADgnia_do_Mercado_de_Tomar.jpg?width=1600'),
  ('biblioteca-municipal-sardoal',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Biblioteca_Municipal_do_Sardoal_instalada_em_parte_da_Casa_Grande.jpg?width=1600'),
  ('biblioteca-municipal-barquinha',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Vista_distante_para_Biblioteca_Municipal_de_Vila_Nova_da_Barquinha.jpg?width=1600')
) as f(id, url)
where v.id = f.id and v.image_url is null;

-- ------------------------------- Descrições ---------------------------------
update public.venues as v set
  description = d.texto,
  updated_at = now()
from (values
  -- cm-constancia.pt
  ('biblioteca-municipal-constancia',
   'Inaugurada a 4 de abril de 1994 no edifício da antiga escola primária, '
   'construído entre 1912 e 1917 para servir os dois sexos e alojar os '
   'professores. Tem o nome do poeta desde 2005: em 1986, ano da morte de '
   'Alexandre O''Neill, o filho doou ao município a biblioteca pessoal dele — '
   '3461 títulos.'),
  -- Dicionário de Historiadores Portugueses (BNP) e cm-ferreiradozezere.pt
  ('biblioteca-municipal-ferreira-do-zezere',
   'Tem o nome de António Eduardo Simões Baião (1878–1961), nascido no '
   'Alqueidão de Santo Amaro, neste concelho: foi o último guarda-mor da Torre '
   'do Tombo e depois o primeiro diretor dela, de 1910 a 1949, e escreveu «A '
   'vila e o concelho de Ferreira do Zêzere». Fica na Rua João da Costa; de '
   'julho a setembro encerra aos sábados.'),
  -- jf-minde.pt e imprensa regional
  ('casa-da-memoria-minde',
   'Casa centenária no centro de Minde, aberta a 20 de janeiro de 2019 para '
   'guardar o espólio de história e cultura da vila que o professor Abílio '
   'Madeira Martins e a mulher, Maria Cândida do Nascimento, juntaram a vida '
   'inteira — e foram eles que deram o dinheiro para comprar o imóvel. Ele '
   'fundou o Jornal de Minde em 1955.'),
  -- Biblioteca do Instituto Politécnico de Tomar e imprensa regional
  ('biblioteca-municipal-tomar',
   'Está na Alameda dos Templários desde 1997 e tem o nome de António Cartaxo '
   'da Fonseca, que lhe doou mais de sessenta mil livros, primeiras edições e '
   'documentos raros incluídos. O auditório tem o mesmo nome.'),
  -- Tomar na Rede, citando o arquiteto Costa Rosa em «Tomar Perspetivas»
  ('mercado-municipal-tomar',
   'Inaugurado a 6 de maio de 1951, com projeto do arquiteto Carlos Ramos. '
   'Até aí a praça fazia-se no tabuleiro central da Praça da República e a do '
   'peixe atrás dos Paços do Concelho; no terreno junto ao Nabão onde o '
   'mercado ficou havia o campo de futebol do Sporting de Tomar, palco das '
   'batalhas de flores.'),
  -- cm-alcanena.pt e portugal.gov.pt
  ('mercado-municipal-alcanena',
   'Inaugurado em 1985 e reaberto ao público a 7 de outubro de 2020, depois de '
   'uma requalificação de 1,7 milhões de euros. Além das bancas e das lojas '
   'ficou com um espaço polivalente, que é onde recebe exposições e '
   'iniciativas culturais.'),
  -- Rotas de Mação (turismo municipal)
  ('biblioteca-municipal-macao',
   'Fica dentro do Centro Cultural Elvino Pereira, que partilha com o auditório '
   'municipal, a galeria e a ludoteca. Tem cerca de onze mil volumes.'),
  -- Turismo de Torres Novas
  ('jardim-municipal-torres-novas',
   'O jardim do centro de Torres Novas, entre o rio Almonda e o castelo, com '
   'lago e repuxo. Tem coreto, e é lá que a programação sai de portas.'),
  -- Junta de freguesia de São Pedro, Lapas e Ribeira Branca
  ('smut-lapas',
   'Nasceu nas festas de Lapas de agosto de 1920: o mestre da banda de Ourém '
   'convidada para tocar reparou no jeito dos rapazes da terra e decidiu '
   'fundar-lhes uma. Ficou Academia Musical União e Trabalho a 18 de outubro '
   'desse ano, e Sociedade Musical em maio de 1930.'),
  -- «A Nossa Música», Universidade de Aveiro
  ('sf-euterpe-meiaviense',
   'Fundada a 19 de março de 1896 na Meia Via, pelo seu primeiro maestro, '
   'Manuel de Matos Branco. Tem escola de música desde setembro de 1976, e é '
   'instituição de utilidade pública desde 1993.')
) as d(id, texto)
where v.id = d.id and (v.description is null or btrim(v.description) = '');

-- --------------------- Os dois de Ferreira do Zêzere ------------------------
insert into public.venues
  (id, name, municipality_id, parish, kind, status, is_association,
   address, postal_code, phone, website_url, description, notes)
values
  ('centro-cultural-alfredo-keil', 'Centro Cultural Alfredo Keil',
   'ferreira-do-zezere', null, 'cultural_centre', 'active', false,
   'Rua Ferreira do Alentejo 2', '2240-388', '249360150',
   'https://www.visitferreiradozezere.pt/repositorio/centro-cultural-de-ferreira-do-zezere/',
   'O centro cultural do concelho. Tem o nome do compositor Alfredo Keil por '
   'uma razão local: Keil chegou a Ferreira do Zêzere em 1885, na caçada de D. '
   'Carlos, voltou a passar cá quinze verões, e foi aqui que escreveu para '
   'piano «A Portuguesa», que a República viria a adotar como hino. O nome foi '
   'atribuído a 24 de setembro de 2022, nos 800 anos do foral.',
   'Levantamento 2026-08-30: confirmado no turismo municipal '
   '(visitferreiradozezere.pt) e na imprensa regional. Programado pela câmara '
   'e publicado na agenda municipal, que já é recolhida.'),
  ('cine-teatro-ivone-silva', 'Cine-Teatro Ivone Silva',
   'ferreira-do-zezere', null, 'theatre', 'active', false,
   'Rua Professor Doutor António Esperança Mendes Ferreira 27', '2240-357',
   '249360150',
   'https://www.visitferreiradozezere.pt/repositorio/cine-teatro-ivone-silva/',
   'O cineteatro municipal, com o nome da atriz Ivone Silva (1936–1987), '
   'nascida em Paio Mendes, neste concelho. Desde 2016 é a casa do Festival de '
   'Teatro Ivone Silva, dedicado ao teatro cómico — que foi o dela.',
   'Levantamento 2026-08-30: confirmado no turismo municipal '
   '(visitferreiradozezere.pt). Programado pela câmara e publicado na agenda '
   'municipal, que já é recolhida.')
on conflict (id) do nothing;

-- ---------------------------- E o de Mação ----------------------------------
-- As coordenadas são as que a biblioteca municipal já tinha: é o mesmo
-- edifício, e foi por aí que se descobriu que faltava.
insert into public.venues
  (id, name, municipality_id, parish, kind, status, is_association,
   latitude, longitude, website_url, description, notes)
values
  ('centro-cultural-elvino-pereira', 'Centro Cultural Elvino Pereira',
   'macao', 'Mação, Penhascoso e Aboboreira', 'cultural_centre', 'active', false,
   39.55315, -7.99535,
   'https://www.rotasdemacao.pt/pt/conhecer/o-que-visitar/6022-centro-cultural-elvino-pereira/',
   'O centro cultural de Mação, que junta num edifício o auditório municipal, '
   'a galeria, a biblioteca — com cerca de onze mil volumes — e a ludoteca. É '
   'onde acontece boa parte da programação do concelho.',
   'Levantamento 2026-08-30: confirmado no turismo municipal '
   '(rotasdemacao.pt). Programado pela câmara e publicado na agenda municipal, '
   'que já é recolhida.')
on conflict (id) do nothing;

-- ----------------------- O que não existe, sai ------------------------------
-- A ficha nasceu no seed inicial com o estado «por confirmar», e nunca foi
-- confirmada. Não tem morada, coordenadas, telefone, descrição nem fotografia,
-- e não há um único evento ligado a ela. O que havia era o nome, e o nome não
-- aparece em fonte nenhuma do concelho.
--
-- O alias regional «casadacultura», que era dela, desaparece com ela (a chave
-- estrangeira é `on delete cascade`) — e é o que tem de acontecer: sem este
-- registo, «Casa da Cultura» só quer dizer alguma coisa em Alcanena, onde a
-- 0066 lhe prendeu um alias com concelho.
delete from public.venues
where id = 'casa-da-cultura-ferreira-do-zezere'
  and not exists (select 1 from public.events where venue_id = 'casa-da-cultura-ferreira-do-zezere');

-- ------------------------------- Os alias -----------------------------------
-- O nome canónico de cada espaço tem de resolver para si próprio: a recolha só
-- resolve por alias.
insert into public.venue_aliases (alias, venue_id) values
  ('centroculturalalfredokeil',   'centro-cultural-alfredo-keil'),
  ('centroculturaldeferreiradozezere', 'centro-cultural-alfredo-keil'),
  ('cineteatroivonesilva',        'cine-teatro-ivone-silva'),
  ('cineteatromunicipalivonesilva', 'cine-teatro-ivone-silva'),
  ('centroculturalelvinopereira', 'centro-cultural-elvino-pereira'),
  ('ccelvinopereira',             'centro-cultural-elvino-pereira')
on conflict (alias, ambito) do nothing;

-- E os eventos que já tinham ficado com estes nomes em texto livre.
update public.events set venue_id = 'cine-teatro-ivone-silva', updated_at = now()
where venue_id is null and municipality_id = 'ferreira-do-zezere'
  and public.normalize_for_hash(location_name) in
      ('cineteatroivonesilva', 'cineteatromunicipalivonesilva');

update public.events set venue_id = 'centro-cultural-alfredo-keil', updated_at = now()
where venue_id is null and municipality_id = 'ferreira-do-zezere'
  and public.normalize_for_hash(location_name) in
      ('centroculturalalfredokeil', 'centroculturaldeferreiradozezere');

update public.events set venue_id = 'centro-cultural-elvino-pereira', updated_at = now()
where venue_id is null and municipality_id = 'macao'
  and public.normalize_for_hash(location_name) in
      ('centroculturalelvinopereira', 'ccelvinopereira');

-- ---------------------------------------------------------------------------
do $$
declare
  v_novos    integer;
  v_fantasma integer;
  v_orfaos   integer;
  v_fotos    integer;
begin
  select count(*) into v_novos from public.venues
  where id in ('centro-cultural-alfredo-keil', 'cine-teatro-ivone-silva',
               'centro-cultural-elvino-pereira');
  if v_novos <> 3 then
    raise exception 'esperavam-se os 3 espaços novos, e há %', v_novos;
  end if;

  select count(*) into v_fantasma from public.venues
  where id = 'casa-da-cultura-ferreira-do-zezere';
  if v_fantasma <> 0 then
    raise exception 'a «Casa da Cultura» de Ferreira do Zêzere devia ter saído';
  end if;

  -- A regra da 0066 continua de pé com os espaços novos lá dentro.
  select count(*) into v_orfaos from public.venues v
  where not exists (
    select 1 from public.venue_aliases a
    where a.alias = public.normalize_for_hash(v.name)
      and (a.municipality_id is null or a.municipality_id = v.municipality_id)
  );
  if v_orfaos <> 0 then
    raise exception '% espaços ficaram sem o próprio nome como alias', v_orfaos;
  end if;

  -- E nenhuma fotografia entrou de outro sítio que não o Commons.
  select count(*) into v_fotos from public.venues
  where image_url is not null and image_url not like 'https://commons.wikimedia.org/%';
  if v_fotos <> 0 then
    raise exception '% fotografias vêm de fora do Wikimedia Commons', v_fotos;
  end if;
end
$$;
