-- 0043 — Os coretos: a mesma régua para todos.
--
-- Auditoria de 2026-08-28 aos registos sem fotografia, com duas perguntas:
-- alguma coordenada cai fora do concelho indicado (ou fora do Médio Tejo), e
-- a prova de cada «confirmado» aguenta ser lida?
--
-- **À primeira, não.** As treze coordenadas foram verificadas por geocodificação
-- inversa e pela hierarquia administrativa: concelho e freguesia batem certo em
-- todas. Não há contaminação de homónimos de fora da região — e há homónimos a
-- sério à espera (Ourém do Pará tem coreto fotografado no Commons; Castelo Novo
-- do Fundão é Aldeia Histórica; «Carril» repete-se treze vezes no país). Ficam
-- escritos, para que um enriquecimento futuro não os apanhe por distração.
--
-- **À segunda, não inteiramente** — e o defeito é de critério, que é o pior
-- sítio para ter um. O Coreto de Zibreira estava dado como confirmado por uma
-- ficha de um diretório turístico auto-gerado; o Coreto do Jardim Municipal de
-- Torres Novas ficou por confirmar porque a prova era «texto genérico de um
-- agregador». É a mesma fonte a valer de dois modos conforme o que dá jeito.
-- A régua passa a ser uma só: um diretório sozinho não confirma nada.
--
-- Por isso Zibreira desce e o Souto sobe. O Souto tem o contrário do diretório:
-- um levantamento local que o descreve fisicamente — «de alvenaria, tem forma
-- hexagonal e o acesso faz-se por escada interior», na Praça Luís de Camões
-- junto à Igreja — com fotografia própria. Descrição a esse ponto não se
-- inventa, e é a mesma fonte que já sustenta os outros coretos de Abrantes.
--
-- E entram dois que faltavam, ambos em Tomar e ambos por confirmar: sabê-los
-- por confirmar vale mais do que não os ter.

-- Zibreira: a régua aplica-se aqui primeiro.
update public.coretos set
  is_confirmed = false,
  notes = 'Na Praça Engenheiro Luís Tavares Simão, junto à Igreja de São Sebastião — a coordenada fica a 47 m da igreja e a 90 m da Junta, portanto é centro de aldeia e não campo aberto. '
       || 'A única fonte é uma ficha de diretório turístico auto-gerada, sem fontes citadas e com texto traduzido à máquina; a praça que ela nomeia não existe no OpenStreetMap. '
       || 'Baixado a por confirmar em 2026-08-28 por coerência de critério: o mesmo diretório foi recusado como prova no Jardim Municipal de Torres Novas. '
       || 'Confirmar com a Junta de Freguesia da Zibreira. Cuidado com a Zibreira de Torres Vedras, homónima.',
  updated_at = now()
where id = 'coreto-zibreira';

-- Souto: sobe, porque a fonte o descreve em vez de o listar.
update public.coretos set
  is_confirmed = true,
  notes = 'O segundo coreto do Souto, na Praça Luís de Camões, junto à Igreja. De alvenaria, planta hexagonal, com acesso por escada interior. '
       || 'A coordenada cai exatamente na praça. Fonte: levantamento local «Coretos do Concelho de Abrantes» (2008), que o descreve fisicamente e publica fotografia própria — a mesma fonte que sustenta os restantes coretos do concelho.',
  updated_at = now()
where id = 'coreto-souto-praca-luis-de-camoes';

-- Penhascoso: a prova existe, mas não é a que estava citada, e dizia de mais.
update public.coretos set
  notes = 'No centro da aldeia de Penhascoso, entre o património que o percurso pedestre PR9 «Rota do Penhascoso» assinala — a par das capelas, dos fontanários, da Igreja de N.ª Sr.ª do Pranto e da Torre do Relógio. '
       || 'A fonte não diz que o coreto está no jardim do Fundão (diz que o percurso começa aí), e a nota anterior lia de mais. Coordenada aproximada, do centro da aldeia — afinar no terreno.',
  updated_at = now()
where id = 'coreto-penhascoso';

-- Ortiga: a distância ao santuário estava mal por vinte vezes.
update public.coretos set
  notes = 'Mapeado no OpenStreetMap a cerca de 20 m do Santuário de N.ª Sr.ª da Ortiga (a documentação dizia ~400 m, e estava errada), onde decorre a festa anual no 1.º domingo de julho. '
       || 'A fonte da festa não menciona o coreto: a prova é só do OpenStreetMap, mapeado por imagem aérea. Não confundir com a Ortiga de Mação. Por confirmar.',
  updated_at = now()
where id = 'coreto-ortiga-fatima';

-- Bugarrel e Maçaroca: continuam por confirmar, mas já não estão sozinhos.
update public.coretos set
  notes = 'Mapeado no OpenStreetMap junto à EM 530, no lugar do Bugarrel (código postal 2300-251). '
       || 'Um diretório turístico lista um «Coreto da Serra» com o mesmo código postal — duas fontes independentes a apontar ao mesmo sítio, o que não chega para confirmar mas vale mais do que uma. Por confirmar no terreno.',
  updated_at = now()
where id = 'coreto-serra-bugarrel';

update public.coretos set
  notes = 'Mapeado no OpenStreetMap junto à EM 557, na Maçaroca (código postal 2350-073). '
       || 'Um diretório turístico lista um «Coreto de Chancelaria» com o mesmo código postal mas dá-lhe a morada «Largo da Igreja», que fica a 1,7 km daqui — ou a morada é imprecisa, ou há dois coretos na freguesia. Por confirmar no terreno, e a contar os dois.',
  updated_at = now()
where id = 'coreto-chancelaria-macaroca';

-- Castelo Novo: o homónimo é famoso, e o desambiguador do nome é para ficar.
update public.coretos set
  notes = 'Mapeado no OpenStreetMap no lugar de Castelo Novo, freguesia da Serra — mas com uma etiqueta inválida («man_made=Coreto» em vez de «leisure=bandstand»), pelo que nem é indexado pela pesquisa do próprio OSM. Mapeado em 2014 por imagem aérea, sem comentário. É a prova mais fraca do levantamento. '
       || 'ATENÇÃO ao homónimo: Castelo Novo do Fundão é Aldeia Histórica de Portugal, e qualquer pesquisa por «coreto de Castelo Novo» traz material de lá. O «(Serra)» no nome não é enfeite. Por confirmar no terreno.',
  updated_at = now()
where id = 'coreto-serra-castelo-novo';

-- Constância e Sardoal: a conclusão mantém-se; o que muda é poder repeti-la.
update public.coretos set
  notes = 'Procurado em OpenStreetMap, Wikimedia Commons, imprensa regional, diretórios e na pesquisa interna do site municipal: zero resultados em todo o concelho. '
       || 'A pesquisa do município (cm-constancia.pt/pesquisa?q=coreto) responde «Nenhum resultado encontrado». Provavelmente não existe — fica registado para que a pergunta não se repita do zero.',
  updated_at = now()
where id = 'coreto-constancia';

update public.coretos set
  notes = 'Procurado em OpenStreetMap, Wikimedia Commons, imprensa regional, diretórios e na pesquisa interna do site municipal, em toda a área do concelho (vila, Alcaravela, Santiago de Montalegre e Valhascos): zero resultados. '
       || 'A pesquisa do município (cm-sardoal.pt/search?q=coreto) responde «Nenhum resultado obtido». Provavelmente não existe — fica registado para que a pergunta não se repita do zero.',
  updated_at = now()
where id = 'coreto-sardoal';

-- Os dois que faltavam, ambos em Tomar, ambos por confirmar.
insert into public.coretos (id, name, parish, municipality_id, latitude, longitude, is_confirmed, notes) values
  (
    'coreto-poco-redondo',
    'Coreto do Poço Redondo',
    'Olalhas',
    'tomar',
    39.62796,
    -8.32065,
    false,
    'Listado por um diretório turístico no Largo do Espírito Santo, Poço Redondo (2300-035), lugar da freguesia de Olalhas. '
    || 'Fonte única e de diretório, que por si não confirma nada — entra por confirmar, como os outros da mesma classe de prova. A coordenada é a do lugar, não a do coreto.'
  ),
  (
    'coreto-fonte-de-dom-joao',
    'Coreto da Fonte de Dom João',
    'União das freguesias de Serra e Junceira',
    'tomar',
    39.62419,
    -8.33083,
    false,
    'Listado por um diretório turístico na Fonte de Dom João (2300-035), lugar da Junceira, no mesmo conjunto a nordeste de Tomar que o Bugarrel e o Castelo Novo. '
    || 'Fonte única e de diretório, que por si não confirma nada — entra por confirmar. A coordenada é a do lugar, não a do coreto.'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
do $$
declare
  v_zibreira boolean;
  v_souto boolean;
  v_novos integer;
  v_tomar integer;
begin
  select is_confirmed into v_zibreira from public.coretos where id = 'coreto-zibreira';
  if v_zibreira then
    raise exception 'o coreto de Zibreira devia ter descido a por confirmar';
  end if;

  select is_confirmed into v_souto from public.coretos where id = 'coreto-souto-praca-luis-de-camoes';
  if not v_souto then
    raise exception 'o coreto do Souto devia ter subido a confirmado';
  end if;

  select count(*) into v_novos from public.coretos
   where id in ('coreto-poco-redondo', 'coreto-fonte-de-dom-joao');
  if v_novos <> 2 then
    raise exception 'esperavam-se os 2 coretos novos de Tomar, e há %', v_novos;
  end if;

  -- Os dois novos entram por confirmar, como manda a régua.
  select count(*) into v_tomar from public.coretos
   where id in ('coreto-poco-redondo', 'coreto-fonte-de-dom-joao') and is_confirmed;
  if v_tomar <> 0 then
    raise exception 'os coretos novos de Tomar não podem entrar como confirmados';
  end if;
end
$$;
