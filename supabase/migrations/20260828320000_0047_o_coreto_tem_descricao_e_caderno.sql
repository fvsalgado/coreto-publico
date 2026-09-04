-- 0047 — O coreto tem descrição, e tem caderno.
--
-- A página dos coretos publicava `coretos.notes` tal e qual. Só que `notes` é
-- o caderno de pesquisa: o sítio onde fica escrito que a prova é fraca, que
-- há um homónimo a evitar, que a pesquisa do site municipal respondeu «nenhum
-- resultado», e a data em que se mudou de ideias. Isso serve a quem faz o
-- levantamento e não serve a quem vem ver se há coreto na sua terra.
--
-- Os espaços já tinham esta separação — `description` para o público, `notes`
-- para dentro — e ficou por fazer nos coretos. Fica feita: a mesma regra, na
-- mesma casa.
--
-- Nada se apaga. As notas continuam onde estavam, para a moderação; o que
-- muda é o que a página lê. E a descrição pública diz exatamente a mesma
-- verdade, incluindo a dúvida: um coreto por confirmar continua a dizer que
-- está por confirmar e porquê — o que sai é o processo, não a incerteza.

alter table public.coretos add column if not exists description text;

comment on column public.coretos.description is
  'Texto público do coreto, para a página. Nunca o caderno de pesquisa — esse é `notes`.';
comment on column public.coretos.notes is
  'Notas de trabalho: proveniência, força da prova, homónimos, decisões. Não é publicado.';

-- ---------------------------------------------------------------------------
-- Os confirmados.
-- ---------------------------------------------------------------------------

update public.coretos set description = 'No adro da Igreja de São Pedro, na Praça da República. Construído em 1981.'
  where id = 'coreto-alvega';

update public.coretos set description = 'No recinto do Santuário de Nossa Senhora do Tojo, na Quintã. Construído em 1956.'
  where id = 'coreto-nossa-senhora-do-tojo';

update public.coretos set description = 'De planta quadrada — que no concelho de Abrantes não se repete em mais nenhum. Dos primeiros anos do século XX, junto à Igreja Matriz.'
  where id = 'coreto-rio-de-moinhos';

update public.coretos set description = 'O primeiro coreto de Abrantes, de 1894: ferro sobre base de pedra, no jardim romântico que ocupa o antigo fosso do castelo. Era ali que se davam os concertos ao domingo.'
  where id = 'coreto-jardim-do-castelo';

update public.coretos set description = 'Inaugurado a 20 de setembro de 1915, no Largo D. Joana Godinho Soares Mendes. O levantamento dos coretos do concelho, feito em 2008, dá-o como o mais bonito de Abrantes.'
  where id = 'coreto-rossio-ao-sul-do-tejo';

update public.coretos set description = 'O segundo coreto do Souto, na Praça Luís de Camões, junto à igreja. De alvenaria, planta hexagonal, com acesso por uma escada interior.'
  where id = 'coreto-souto-praca-luis-de-camoes';

update public.coretos set description = 'Base octogonal com painéis de azulejo que retratam os ofícios têxteis de Minde, colunas de ferro fundido e cobertura de oito águas rematada a lambrequim. No Largo Justino Guedes, em frente ao MARG. Inventariado no SIPA com o n.º 31124.'
  where id = 'coreto-minde';

update public.coretos set description = 'No Jardim-Parque Dr. José Pereira Caldas, aberto em 1934. Por baixo do coreto fica a estufa com a aranha de ferro no teto que dá a alcunha ao jardim, e uma fonte de água. A requalificação de 2012 manteve o coreto e a torre.'
  where id = 'coreto-jardim-da-aranha';

update public.coretos set description = 'No centro da aldeia, entre o património que o percurso pedestre PR9 «Rota do Penhascoso» assinala — as capelas, os fontanários, a Igreja de Nossa Senhora do Pranto e a Torre do Relógio.'
  where id = 'coreto-penhascoso';

update public.coretos set description = 'Inaugurado em 1897 e restaurado cem anos depois. É das melhores obras da arquitetura do ferro em Tomar, com dupla cobertura e lanternim — e é aqui, no Jardim da Várzea Pequena, que a câmara programa o «Verão no Coreto».'
  where id = 'coreto-varzea-pequena';

update public.coretos set description = 'No Barquinha Parque, junto ao Largo 1.º de Dezembro e ao Centro Cultural. É do parque ribeirinho aberto em 2005 — não é um coreto oitocentista, e nem por isso é menos palco.'
  where id = 'coreto-jardim-ribeirinho';

-- ---------------------------------------------------------------------------
-- Os que estão por confirmar. A dúvida fica escrita; o caderno é que sai.
-- ---------------------------------------------------------------------------

update public.coretos set description = 'Está marcado no OpenStreetMap, na Rua da Escola. Falta quem confirme que lá está.'
  where id = 'coreto-casais-de-revelhos';

update public.coretos set description = 'Não encontrámos vestígio de um coreto em Constância — nem nos mapas colaborativos, nem nas fotografias livres, nem no sítio da câmara. Fica aqui a pergunta em aberto: há coreto em Constância?'
  where id = 'coreto-constancia';

update public.coretos set description = 'Não encontrámos prova de um coreto no Carril. O lugar é conhecido pela música — foi ali que «A Portuguesa» teve, em 1890, a sua primeira orquestração, pela Filarmónica Carrilense —, mas fama musical não é coreto.'
  where id = 'coreto-carril';

update public.coretos set description = 'Está marcado no OpenStreetMap junto à ER 356, na Freixianda. Falta quem confirme que lá está.'
  where id = 'coreto-freixianda-varzea-do-bispo';

update public.coretos set description = 'Não encontrámos prova de um coreto em Espite: nada nos mapas colaborativos, nas fotografias livres ou no sítio da junta. A confirmar junto da freguesia.'
  where id = 'coreto-espite';

update public.coretos set description = 'Está marcado no OpenStreetMap a poucos metros do Santuário de Nossa Senhora da Ortiga, onde há festa no primeiro domingo de julho. A marcação foi feita por fotografia aérea e é a única indicação que temos. Não confundir com a Ortiga de Mação.'
  where id = 'coreto-ortiga-fatima';

update public.coretos set description = 'Não encontrámos vestígio de um coreto no concelho do Sardoal — nem na vila, nem em Alcaravela, Santiago de Montalegre ou Valhascos. Fica aqui a pergunta em aberto.'
  where id = 'coreto-sardoal';

update public.coretos set description = 'Aparece listado num diretório turístico, na Fonte de Dom João, no mesmo conjunto de lugares a nordeste de Tomar que o Bugarrel e o Castelo Novo. Uma fonte só, e de diretório, não chega para confirmar. A coordenada é a do lugar, não a do coreto.'
  where id = 'coreto-fonte-de-dom-joao';

update public.coretos set description = 'Está marcado no OpenStreetMap na Rua da Capela, junto à capela do lugar. Falta quem confirme que lá está.'
  where id = 'coreto-brasoes';

update public.coretos set description = 'Está marcado no OpenStreetMap no lugar de Castelo Novo, na freguesia da Serra, por fotografia aérea e sem mais nada que o sustente — é a indicação mais frágil deste levantamento. Castelo Novo da Serra, em Tomar; não o Castelo Novo do Fundão.'
  where id = 'coreto-serra-castelo-novo';

update public.coretos set description = 'Está marcado no OpenStreetMap junto à EM 530, no lugar do Bugarrel, e um diretório turístico lista um «Coreto da Serra» com o mesmo código postal. Duas indicações a apontar ao mesmo sítio não são uma confirmação, mas valem mais do que uma.'
  where id = 'coreto-serra-bugarrel';

update public.coretos set description = 'Aparece listado num diretório turístico, no Largo do Espírito Santo, em Poço Redondo. Uma fonte só, e de diretório, não chega para confirmar. A coordenada é a do lugar, não a do coreto.'
  where id = 'coreto-poco-redondo';

update public.coretos set description = 'Está marcado no OpenStreetMap junto à EM 557, na Maçaroca. Um diretório turístico lista um «Coreto de Chancelaria» com o mesmo código postal mas com morada no Largo da Igreja, a quase dois quilómetros — ou a morada está errada, ou há dois coretos na freguesia.'
  where id = 'coreto-chancelaria-macaroca';

update public.coretos set description = 'Aparece na Praça Engenheiro Luís Tavares Simão, junto à Igreja de São Sebastião, numa ficha de diretório turístico sem fontes citadas. É pouco para dar por confirmado. A Zibreira de Torres Novas, não a de Torres Vedras.'
  where id = 'coreto-zibreira';

update public.coretos set description = 'O Jardim Municipal existe; um coreto nele não aparece em fonte nenhuma — nem nos mapas, nem nas fotografias livres, nem na ficha do próprio jardim. Se houver memória de um coreto antigo, falta quem no-lo diga.'
  where id = 'coreto-jardim-municipal-torres-novas';

update public.coretos set updated_at = now() where description is not null;

-- ---------------------------------------------------------------------------
-- Nenhum coreto pode ficar sem texto público: a página passa a ler daqui, e
-- uma descrição em falta é uma ficha muda em produção.
do $$
declare
  v_sem_descricao integer;
  v_com_caderno integer;
begin
  select count(*) into v_sem_descricao from public.coretos where description is null or btrim(description) = '';
  if v_sem_descricao > 0 then
    raise exception 'ficaram % coretos sem descrição pública', v_sem_descricao;
  end if;

  -- O que motivou esta migração: expressões que só fazem sentido para quem
  -- faz o levantamento não podem sobreviver na coluna que vai para a página.
  select count(*) into v_com_caderno from public.coretos
    where description ~* '(por confirmar no terreno|afinar no terreno|ATENÇÃO|coerência de critério|não se repita do zero|Wikimedia Commons|cm-[a-z]+\.pt/)';
  if v_com_caderno > 0 then
    raise exception '% descrições públicas ainda trazem linguagem de caderno de pesquisa', v_com_caderno;
  end if;
end
$$;
