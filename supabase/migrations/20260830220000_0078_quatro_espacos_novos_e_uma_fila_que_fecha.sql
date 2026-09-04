-- 0078 — Quatro espaços novos, sete nomes resolvidos, e a fila de espaços
-- fecha.
--
-- A fila de espaços por resolver tinha trinta e três nomes que a recolha viu e
-- o catálogo não reconheceu. Trabalhados um a um, dão três respostas
-- diferentes — e a razão de cada uma fica escrita, porque a fila só volta a
-- ser útil se o que lá está for mesmo trabalho por fazer.
--
-- ## I — Quatro são equipamentos que faltavam ao catálogo
--
-- Cada um confirmado contra fonte primária antes de ser escrito. Nenhum campo
-- que não se tenha lido.
--
--   · **quARTel — Galeria Municipal de Arte** (Abrantes). Inaugurada a 31 de
--     agosto de 2013 no edifício do antigo quartel dos Bombeiros Municipais,
--     no Largo de Sant'Ana. É onde está «A linha do tempo: 30 anos do Atelier
--     do Massimo», que hoje aparece sem espaço.
--   · **Cine-Teatro Municipal de Mação**. Inaugurado nos anos 50, renovado, e
--     desde março de 2025 na Rede de Teatros e Cineteatros Portugueses. Cerca
--     de 220 lugares. É o único equipamento do género na vila e o concelho só
--     tinha quatro espaços no catálogo.
--   · **Museu dos Rios e das Artes Marítimas** (Constância). Inaugurado em
--     1998, na Estrada Nacional 3. Conta o tempo em que Constância era um dos
--     portos importantes do Médio Tejo — pesca, transporte fluvial e
--     construção naval. Constância tinha três espaços; passa a quatro.
--   · **CIRA — Centro Interpretativo da Ribeira de Alcolobre** (Abrantes).
--     Instalado na antiga escola primária do Crucifixo, no Tramagal, é o
--     ponto de partida de um percurso pedestre de 11,2 km. É onde acontece o
--     «Dia Mundial da Observação da Natureza».
--
-- ## II — Sete são nomes de coisas que já cá estavam
--
-- Uma sala dentro de um teatro, um claustro dentro de um museu, um centro
-- cultural que a fonte regional nomeia sem dizer qual. O concelho do evento
-- desempata os que precisam de desempate — é para isso que os alias têm
-- concelho desde a 0066.
--
-- O caso que vale a pena escrever é o **Convento de São Domingos (claustro)**,
-- em Abrantes: não é um espaço novo, é o edifício onde o MIAA está instalado.
-- Criar-lhe ficha própria seria pôr o mesmo sítio duas vezes no mapa.
--
-- ## III — E vinte e dois não são espaços, e nunca vão ser
--
-- É esta a decisão que a fila precisava, e a razão de ela nunca esvaziar:
--
--   · **Três são topónimos** — «Fátima», «Tomar», «Caxarias». Uma fonte que
--     escreve o nome do concelho no campo do local não está a nomear uma
--     casa. O evento já sabe em que concelho é.
--   · **Dois nomeiam dois sítios ao mesmo tempo** — «CEFT - Casa dos Cubos e
--     Convento de Cristo» e «Biblioteca Municipal e Cine-Teatro Paraíso». São
--     exposições e programas que acontecem mesmo nos dois. Um evento tem um
--     `venue_id`; escolher um dos dois seria escrever uma meia-verdade, e o
--     nome inteiro continua à vista na ficha.
--   · **Dezassete são lugares, não equipamentos** — praças, jardins, largos,
--     um centro histórico, uma praia fluvial, campos de futebol, uma pista de
--     atletismo, uma adega, um parque de ciência, um salão paroquial. As
--     coisas acontecem lá, e o nome aparece na ficha do evento. Mas o Coreto
--     é uma agenda cultural e o `/espacos` é o directório das casas da
--     cultura da região: encher-lho com «Centro histórico» e «Pista de
--     Atletismo» torna-o menos útil, não mais.
--
-- Ficam `dismissed`, com o histórico intacto — quantas vezes apareceram e
-- quando. Se um dia um destes lugares ganhar porta e programação própria,
-- entra pela porta da frente, com fonte.
-- ---------------------------------------------------------------------------

-- --------------------------- I. Os quatro novos -----------------------------

insert into public.venues (
  id, name, short_name, municipality_id, parish, kind, address, postal_code,
  phone, website_url, description, notes
) values
  (
    'quartel-galeria-abrantes',
    'quARTel — Galeria Municipal de Arte',
    'quARTel',
    'abrantes',
    'Abrantes (São Vicente e São João) e Alferrarede',
    'gallery',
    'Largo de Sant''Ana',
    '2200-348',
    '241 331 408',
    'https://www.museusdeabrantes.pt/quartel/quartel.html',
    'Galeria municipal de arte contemporânea de Abrantes, inaugurada a 31 de '
    'agosto de 2013 no edifício do antigo quartel dos Bombeiros Municipais. '
    'Mostra pintura, escultura, fotografia e desenho de artistas '
    'contemporâneos, com exposições que mudam ao longo do ano.',
    'Criado pela 0078. Morada, telefone e data de inauguração confirmados em '
    'museusdeabrantes.pt e cm-abrantes.pt a 30/08/2026. O nome oficial faz o '
    'trocadilho «quARTel»; a agenda municipal escreve «Quartel - Galeria '
    'Municipal de Arte», e é essa a grafia que entra como alias.'
  ),
  (
    'cine-teatro-macao',
    'Cine-Teatro Municipal de Mação',
    'Cine-Teatro de Mação',
    'macao',
    null,
    'theatre',
    null,
    null,
    null,
    'https://www.rtcp.pt/pt/espacos/cine-teatro-de-macao/',
    'Sala municipal de espetáculos e cinema de Mação, inaugurada nos anos 50 e '
    'durante décadas o único espaço do género na vila. Depois de obras de '
    'renovação, tem cerca de 220 lugares sentados e equipamento de luz e '
    'multimédia. Integra a Rede de Teatros e Cineteatros Portugueses desde '
    'março de 2025.',
    'Criado pela 0078. Capacidade, gestão municipal e entrada na RTCP '
    'confirmadas na ficha da própria RTCP a 30/08/2026. Morada e telefone por '
    'confirmar — a ficha da RTCP não os publica e não se inventam.'
  ),
  (
    'museu-rios-artes-maritimas',
    'Museu dos Rios e das Artes Marítimas',
    'Museu dos Rios',
    'constancia',
    null,
    'museum',
    'Estrada Nacional 3',
    '2250-028',
    '249 730 053',
    null,
    'Museu municipal de Constância, inaugurado em 1998, sobre o tempo em que a '
    'vila era um dos portos importantes do Médio Tejo. A exposição permanente '
    'divide-se em três núcleos — a pesca, o transporte fluvial e a construção '
    'naval — com miniaturas de embarcações, redes, utensílios e uma pequena '
    'oficina de calafate com um barco em construção.',
    'Criado pela 0078. Ano de inauguração, morada, telefone e núcleos da '
    'exposição confirmados em cm-constancia.pt a 30/08/2026.'
  ),
  (
    'cira-alcolobre',
    'CIRA — Centro Interpretativo da Ribeira de Alcolobre',
    'CIRA',
    'abrantes',
    'Tramagal',
    'museum',
    null,
    null,
    null,
    null,
    'Centro de interpretação da ribeira de Alcolobre, instalado na antiga '
    'escola primária do Crucifixo, no Tramagal. Junta conteúdos sobre o '
    'património local, a biodiversidade e a história da ribeira, e é o ponto '
    'de partida de um percurso pedestre de 11,2 km. A ribeira de Alcolobre '
    'corre na fronteira entre Abrantes e Constância e é um dos sítios da '
    'região com mais diversidade de habitats.',
    'Criado pela 0078. Localização, percurso e conteúdos confirmados na '
    'cobertura da inauguração a 21 de março. Morada exacta e horário por '
    'confirmar com a câmara.'
  )
on conflict (id) do nothing;

-- ------------------------ II. Os sete que já cá estavam ---------------------

insert into public.venue_aliases (alias, venue_id, municipality_id) values
  -- Uma sala dentro do teatro. A fonte regional não diz o concelho; o nome
  -- não é ambíguo em lado nenhum, por isso o alias é regional.
  (public.normalize_for_hash('Teatro Municipal de Ourém (Sala Estúdio)'), 'teatro-municipal-ourem', null),
  -- O claustro do convento onde o MIAA está instalado.
  (public.normalize_for_hash('Convento de São Domingos (claustro)'), 'miaa', 'abrantes'),
  -- «Centro Cultural», sem mais nada, é o do Entroncamento neste evento — e
  -- só neste concelho, porque há pelo menos cinco na região com este nome.
  (public.normalize_for_hash('Centro Cultural'), 'centro-cultural-entroncamento', 'entroncamento'),
  -- E os quatro espaços que esta migração acabou de criar.
  (public.normalize_for_hash('Quartel - Galeria Municipal de Arte'), 'quartel-galeria-abrantes', 'abrantes'),
  (public.normalize_for_hash('quARTel — Galeria Municipal de Arte'), 'quartel-galeria-abrantes', 'abrantes'),
  (public.normalize_for_hash('Cine-Teatro de Mação'), 'cine-teatro-macao', null),
  (public.normalize_for_hash('Museu dos Rios e das Artes Marítimas (jardim)'), 'museu-rios-artes-maritimas', null),
  (public.normalize_for_hash('Museu dos Rios e das Artes Marítimas'), 'museu-rios-artes-maritimas', null),
  (public.normalize_for_hash('CIRA'), 'cira-alcolobre', 'abrantes')
on conflict do nothing;

-- Os eventos que estavam à espera destes nomes ligam-se agora.
update public.events e set venue_id = a.venue_id, updated_at = now()
from public.venue_aliases a
where e.venue_id is null
  and e.location_name is not null
  and a.alias = public.normalize_for_hash(e.location_name)
  and (a.municipality_id is null or a.municipality_id = e.municipality_id);

-- ---------- II.b — E o concelho que faltava às linhas da fila ---------------
--
-- Duas linhas — o claustro do Convento de São Domingos e um «Centro Cultural»
-- sem sobrenome — vinham do CAMINHOS, que percorre os onze concelhos e por
-- isso não tem concelho próprio. A recolha gravava o concelho **da fonte**, e
-- ficavam com `null`. Com `null`, um alias preso a um concelho nunca as
-- consegue fechar: a vista compara os dois, e «abrantes = null» não é
-- verdade. Eram linhas que ninguém podia trabalhar.
--
-- O recolector passou a gravar o concelho do **evento** (`EspacoPorResolver`,
-- em `packages/ingest/src/db.ts`). Aqui preenche-se o que ficou para trás, a
-- partir do evento que produziu cada nome — e só onde está vazio, que uma
-- primeira leitura correcta não se reescreve.
update public.unresolved_venues u set municipality_id = e.municipality_id
from (
  select distinct on (public.normalize_for_hash(location_name))
         public.normalize_for_hash(location_name) as chave,
         municipality_id
  from public.events
  where location_name is not null and municipality_id is not null
  order by public.normalize_for_hash(location_name), updated_at desc
) e
where u.municipality_id is null and u.normalized = e.chave;

-- ---------- II.c — Dois teatros com o mesmo nome, e o alias que só via um ----
--
-- Este achado é da asserção, e não da leitura: assim que as linhas da fila
-- ganharam concelho, apareceu uma que estava escondida — «Cine-Teatro São
-- Pedro», em Alcanena.
--
-- Há dois na região: o **Cineteatro São Pedro** de Abrantes e o
-- **Cine-Teatro São Pedro de Alcanena**. O alias `cineteatrosaopedro` estava
-- gravado como **regional** e apontava só ao de Abrantes. Enquanto a linha da
-- fila não tinha concelho, a vista dava-a por resolvida e ninguém via o
-- problema.
--
-- O catálogo não chegou a errar: a regra que a 0051 escreveu — um alias
-- regional não ganha quando aponta a um espaço de outro concelho — mandou o
-- «Corpo Suspenso» do CAMINHOS para o teatro de Alcanena, que é o certo. Mas
-- o alias continuava a ser uma armadilha para o dia em que a fonte não
-- dissesse o concelho.
--
-- Passa a haver dois alias, um por concelho, que é para isto que a coluna
-- existe desde a 0066.
delete from public.venue_aliases
where alias = 'cineteatrosaopedro' and municipality_id is null;

insert into public.venue_aliases (alias, venue_id, municipality_id) values
  ('cineteatrosaopedro', 'cine-teatro-sao-pedro-abrantes', 'abrantes'),
  ('cineteatrosaopedro', 'cine-teatro-sao-pedro-alcanena', 'alcanena')
on conflict do nothing;

-- ------------------- III. E os que nunca vão ser espaços --------------------

update public.unresolved_venues set dismissed = true
where not dismissed
  and normalized in (
    -- Topónimos: o nome do concelho ou da freguesia no campo do local.
    public.normalize_for_hash('Fátima'),
    public.normalize_for_hash('Tomar'),
    public.normalize_for_hash('Caxarias'),
    -- Dois sítios ao mesmo tempo, e um evento só tem um `venue_id`.
    public.normalize_for_hash('CEFT - Casa dos Cubos e Convento de Cristo'),
    public.normalize_for_hash('Biblioteca Municipal e Cine-Teatro Paraíso'),
    -- Lugares, não equipamentos.
    public.normalize_for_hash('Alto de Santo António'),
    public.normalize_for_hash('Campos das Equipas Participantes e Cidade Desportiva de Abrantes'),
    public.normalize_for_hash('Centro histórico'),
    public.normalize_for_hash('Cidade Desportiva de Abrantes (campo nº1, campo nº2 e campo nº3 em Rossio ao Sul do Tejo), campo CUF em Alferrarede, campo Comendador Eduardo Duarte Ferreira me Tramagal e campo de jogos do Pego'),
    public.normalize_for_hash('Esplanada 1º de Maio'),
    public.normalize_for_hash('Estádio Municipal'),
    public.normalize_for_hash('Jardim da República'),
    public.normalize_for_hash('Largo das Festas Arreciadas'),
    public.normalize_for_hash('Largo do Chão da Eira - Concavada'),
    public.normalize_for_hash('Parque Urbano de São Lourenço'),
    public.normalize_for_hash('Partida, Praça Barão da Batalha'),
    public.normalize_for_hash('Pista de Atletismo'),
    public.normalize_for_hash('Praça Barão da Batalha'),
    public.normalize_for_hash('Praia Fluvial de Aldeia do Mato'),
    public.normalize_for_hash('TAGUSVALLEY – Parque de Ciência e Tecnologia de Abrantes'),
    public.normalize_for_hash('Adega da Gaveta - Margaval Vinhos, Casa Nova (Serra)'),
    public.normalize_for_hash('Largo do mercado- Caxarias'),
    public.normalize_for_hash('Sede da Associação na Rua da Escola, 155 - Pinhel'),
    public.normalize_for_hash('Salão Paroquial de Fátima'),
    public.normalize_for_hash('Capela das Serras'),
    public.normalize_for_hash('Associação Humanitária dos Bombeiros Voluntários de Vila Nova da Barquinha')
  );

-- ------------------- IV. E uma execução que nunca fechou --------------------
--
-- Uma recolha aberta a 28 de agosto às 15:32 ficou em `running` para sempre:
-- o processo morreu entre abrir e fechar o registo, e não há quem o feche.
-- Não estraga nada — mas mente ao painel de saúde, que conta execuções por
-- estado, e uma linha «a correr» há dois dias faz duvidar de tudo o resto.
update public.source_runs set
  status = 'failed',
  finished_at = coalesce(finished_at, started_at),
  error = coalesce(error, 'Execução interrompida antes de fechar o registo. '
                          'Fechada pela 0078 a 30/08/2026.')
where status = 'running' and started_at < now() - interval '6 hours';

-- ---------------------------------------------------------------------------
do $$
declare
  v_fila      integer;
  v_novos     integer;
  v_penduradas integer;
  v_orfaos    integer;
  v_ambiguos  integer;
begin
  select count(*) into v_fila from public.unresolved_venues_pendentes;
  if v_fila <> 0 then
    raise exception 'a fila de espaços devia ficar vazia e tem % nomes', v_fila;
  end if;

  select count(*) into v_novos from public.venues
  where id in ('quartel-galeria-abrantes','cine-teatro-macao','museu-rios-artes-maritimas','cira-alcolobre');
  if v_novos <> 4 then
    raise exception 'esperavam-se os 4 espaços novos e há %', v_novos;
  end if;

  select count(*) into v_penduradas from public.source_runs
  where status = 'running' and started_at < now() - interval '6 hours';
  if v_penduradas <> 0 then
    raise exception '% execuções continuam penduradas', v_penduradas;
  end if;

  -- Nenhum alias novo pode apontar a um espaço que não existe: seria um
  -- evento a ficar sem sítio na próxima recolha, em silêncio.
  select count(*) into v_orfaos from public.venue_aliases a
  where not exists (select 1 from public.venues v where v.id = a.venue_id);
  if v_orfaos <> 0 then
    raise exception '% alias apontam a espaços que não existem', v_orfaos;
  end if;

  -- E nenhum alias regional pode chamar-se como um espaço de outro concelho.
  -- É a armadilha do «Cine-Teatro São Pedro»: enquanto a fonte disser o
  -- concelho, a regra da 0051 salva-nos; no dia em que não disser, o evento
  -- ia parar à casa errada, e ninguém dava por isso.
  select count(*) into v_ambiguos
  from public.venue_aliases a
  join public.venues meu on meu.id = a.venue_id
  join public.venues outro on public.normalize_for_hash(outro.name) = a.alias
  where a.municipality_id is null
    and outro.municipality_id is distinct from meu.municipality_id;
  if v_ambiguos <> 0 then
    raise exception '% alias regionais têm o nome de um espaço de outro concelho', v_ambiguos;
  end if;
end
$$;
