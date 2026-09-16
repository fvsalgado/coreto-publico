-- Asserções sobre o esquema e os seeds. Falham alto: qualquer `assert` falso
-- aborta e devolve código de erro ao CI.
\set ON_ERROR_STOP on

do $$
declare
  n integer;
  r record;
  tabela text;
begin
  -- ---- Regiões e seeds ----
  --
  -- As contagens deixaram de ser números mágicos deste script: cada região
  -- declara, na sua própria linha, quantos concelhos tem e a caixa geográfica
  -- onde as suas coordenadas caem, e o loop verifica todas — as de produção e
  -- a de prova que o CI acrescenta. Foi uma contagem escrita à mão que uma
  -- vez se «corrigiu» para errado (a saga 0016/0030); uma contagem declarada
  -- ao lado dos próprios dados é uma promessa de quem os semeia, verificada
  -- contra o que semeou.
  select count(*) into n from public.regions where is_enabled;
  assert n >= 1, 'não há uma única região ligada';

  -- Um alias (0111) redireciona; um canónico serve. O mesmo host nas duas
  -- listas era um laço de redirecionamento — e é regra entre tabelas, por
  -- isso vive aqui e não numa constraint.
  -- (o alias de tabela não pode ser `r`: é a variável do loop deste bloco.)
  select count(*) into n
    from public.region_domain_aliases alias_
    join public.regions reg on reg.domain = alias_.domain;
  assert n = 0, format('%s alias de domínio são também canónicos de uma região', n);

  for r in select * from public.regions loop
    select count(*) into n from public.municipalities where region_id = r.id;
    assert n = r.expected_municipality_count,
      format('%s: esperados %s concelhos, encontrados %s',
             r.id, r.expected_municipality_count, n);

    select count(*) into n from public.municipalities m
     where m.region_id = r.id
       and not exists (select 1 from public.venues v where v.municipality_id = m.id);
    assert n = 0, format('%s: %s concelhos sem um único espaço no seed', r.id, n);

    select count(*) into n from public.municipalities m
     where m.region_id = r.id
       and not exists (select 1 from public.sources s where s.municipality_id = m.id);
    assert n = 0, format('%s: %s concelhos sem fonte de recolha', r.id, n);

    -- Coordenadas dentro do território da região. Uma coordenada trocada põe
    -- um evento no mar e o mapa deixa de fazer sentido: a caixa não valida a
    -- morada, apanha o erro que realmente acontece — sinal trocado, graus e
    -- minutos baralhados, latitude e longitude ao contrário.
    select count(*) into n
      from public.venues v
      join public.municipalities m on m.id = v.municipality_id
     where m.region_id = r.id and v.latitude is not null
       and (v.latitude not between r.bbox_lat_min and r.bbox_lat_max
         or v.longitude not between r.bbox_lon_min and r.bbox_lon_max);
    assert n = 0, format('%s: %s espaços com coordenadas fora da região', r.id, n);

    select count(*) into n from public.municipalities m
     where m.region_id = r.id
       and (m.latitude not between r.bbox_lat_min and r.bbox_lat_max
         or m.longitude not between r.bbox_lon_min and r.bbox_lon_max);
    assert n = 0, format('%s: %s concelhos com coordenadas fora da região', r.id, n);

    select count(*) into n
      from public.coretos c
      join public.municipalities m on m.id = c.municipality_id
     where m.region_id = r.id and c.latitude is not null
       and (c.latitude not between r.bbox_lat_min and r.bbox_lat_max
         or c.longitude not between r.bbox_lon_min and r.bbox_lon_max);
    assert n = 0, format('%s: %s coretos com coordenadas fora da região', r.id, n);

    -- A vista de qualidade tem de cobrir todos os concelhos da região, mesmo
    -- os que ainda não têm eventos: um concelho que desaparece do painel por
    -- estar a zero é exatamente o que este projeto existe para não deixar
    -- acontecer.
    select count(*) into n from public.event_quality_by_municipality
     where region_id = r.id;
    assert n = r.expected_municipality_count,
      format('%s: a vista de qualidade tem %s linhas para %s concelhos',
             r.id, n, r.expected_municipality_count);

    -- As fronteiras, quando as há, são anéis a sério: array com pelo menos
    -- quatro pares, fechado, e dentro da caixa da região — com um décimo de
    -- grau de folga, porque a caixa declara onde vivem centros e espaços e um
    -- contorno roça mais largo do que os seus centros. Um concelho sem
    -- fronteira não é um erro do produto (o mapa degrada para o centro);
    -- os onze do Médio Tejo terem todos uma é promessa da curadoria, abaixo.
    select count(*) into n
      from public.municipalities m
     where m.region_id = r.id and m.boundary is not null
       and (jsonb_typeof(m.boundary) <> 'array'
         or jsonb_array_length(m.boundary) < 4
         or m.boundary -> 0 is distinct from m.boundary -> (jsonb_array_length(m.boundary) - 1));
    assert n = 0, format('%s: %s fronteiras que não são um anel fechado', r.id, n);

    select count(*) into n
      from public.municipalities m
     cross join lateral jsonb_array_elements(m.boundary) as ponto
     where m.region_id = r.id and m.boundary is not null
       and ((ponto ->> 0)::double precision not between r.bbox_lon_min - 0.1 and r.bbox_lon_max + 0.1
         or (ponto ->> 1)::double precision not between r.bbox_lat_min - 0.1 and r.bbox_lat_max + 0.1);
    assert n = 0, format('%s: %s vértices de fronteira fora da caixa da região', r.id, n);
  end loop;

  -- ---- A montra tem programa, e não lê ninguém (0119) ----
  --
  -- A região montra é o que um comprador vê ao carregar em «Ver a montra a
  -- funcionar». Vazia, a demonstração demonstra o contrário do que devia. As
  -- datas do programa são relativas e `renovar_montra()` empurra-as todas as
  -- noites; se um dia deixar de correr, é aqui que se dá por isso. E um
  -- evento da montra vindo de uma fonte seria a montra a recolher de
  -- terceiros — exatamente a regra da casa que ela existe para não quebrar.
  for r in select * from public.regions where kind = 'montra' loop
    select count(*) into n
      from public.events e
      join public.municipalities m on m.id = e.municipality_id
     where m.region_id = r.id
       and e.status = 'published' and e.is_canonical
       and coalesce(e.date_end, e.date_start) >= current_date;
    assert n >= 20,
      format('%s: a montra tem %s eventos por acontecer, esperavam-se pelo menos 20', r.id, n);

    select count(*) into n
      from public.events e
      join public.municipalities m on m.id = e.municipality_id
     where m.region_id = r.id and e.source_id is not null;
    assert n = 0, format('%s: %s eventos da montra vindos de uma fonte — a montra não lê terceiros', r.id, n);
  end loop;

  -- ---- Curadoria do Médio Tejo, com o âmbito declarado ----
  --
  -- Estas são promessas sobre os DADOS do Médio Tejo, não sobre o produto —
  -- e por isso nomeiam a região em vez de varrer a base.

  -- Esta asserção já cá esteve ao contrário, a exigir que os dois estivessem.
  -- A Sertã e Vila de Rei saíram da CIM do Médio Tejo a 23 de dezembro de 2022,
  -- para a CIM da Beira Baixa; as listas de onze que o projeto tinha estavam
  -- certas e foram corrigidas para errado por uma contagem. No Médio Tejo não
  -- podem estar; noutra região — a da Beira Baixa — poderão legitimamente, e é
  -- por isso que o filtro é da região e não da base inteira.
  select count(*) into n from public.municipalities
   where region_id = 'medio-tejo' and id in ('serta', 'vila-de-rei');
  assert n = 0, 'a Sertã e Vila de Rei saíram da CIM do Médio Tejo em 2022-12-23 e não podem estar cá';

  select count(*) into n
    from public.venues v
    join public.municipalities m on m.id = v.municipality_id
   where m.region_id = 'medio-tejo' and v.kind = 'library';
  assert n = 11, format('esperadas 11 bibliotecas municipais no Médio Tejo, encontradas %s', n);

  -- O levantamento cartográfico do Médio Tejo está completo: os onze têm
  -- contorno. Uma região nova pode nascer sem eles; esta já os tem, e
  -- perdê-los seria uma regressão de dados, não uma escolha.
  select count(*) into n from public.municipalities
   where region_id = 'medio-tejo' and boundary is null;
  assert n = 0, format('%s concelhos do Médio Tejo sem fronteira', n);

  select count(*) into n
    from public.coretos c
    join public.municipalities m on m.id = c.municipality_id
   where m.region_id = 'medio-tejo';
  assert n >= 11, format('esperado pelo menos um coreto por concelho do Médio Tejo, e há %s para onze', n);

  -- O molde que nenhum destes sites serve.
  --
  -- As dezasseis fontes foram semeadas com `/pt/agenda`, escrito por analogia
  -- e nunca confrontado com um site. Sobreviveu porque nada o contrariava, e
  -- teria produzido uma recolha vazia por concelho, em silêncio. Se voltar — num seed
  -- copiado, numa migração à pressa —, rebenta aqui.
  --
  -- A exceção é `portal2.ipt.pt`, que serve mesmo um `/pt/agenda`: responde 200
  -- com a página da agenda do politécnico. Sondada outra vez a 2026-08-29, essa
  -- página não tinha um único evento marcado — é agosto —, por isso a fonte
  -- continua desligada e o endereço continua a ser o verdadeiro. A asserção
  -- apanha o molde onde ele foi erro — nos sites municipais — e deixa passar o
  -- único sítio onde a rota existe.
  select count(*) into n from public.sources
   where url like '%/pt/agenda%'
     and url not like 'https://portal2.ipt.pt/%';
  assert n = 0, format('%s fontes com o molde /pt/agenda, que nenhum destes sites serve', n);

  -- Uma fonte ligada tem de dizer o que espera trazer.
  --
  -- Com `min_expected_items` a zero, uma recolha sem eventos é uma execução
  -- verde — e uma agenda que desaparece em silêncio é a falha que este projeto
  -- mais teme. Quem liga uma fonte declara o mínimo, ou explica-se.
  --
  -- A excepção é a agenda de uma freguesia, e tem uma razão que não é
  -- comodidade: uma freguesia está legitimamente sem nada marcado semanas a
  -- fio, e com um mínimo de 1 a recolha gritava por uma agenda que apenas
  -- está vazia. O que substitui a contagem é melhor do que ela — o adaptador
  -- `portal-freguesia` confirma que a página é mesmo a da agenda (a mobília
  -- do CMS: as ligações para «todos» e «concluídos») antes de aceitar zero.
  -- Página sem mobília é erro e a execução falha; página com mobília e sem
  -- eventos é uma leitura verdadeira.
  select count(*) into n from public.sources
   where is_enabled and min_expected_items < 1
     and adapter <> 'portal-freguesia';
  assert n = 0, format('%s fontes ligadas sem mínimo esperado declarado', n);

  -- A data do espetáculo não é a data do post.
  --
  -- O tema do Centro Cultural Gil Vicente põe as duas em cada cartão, e a de
  -- publicação é sempre uma data válida — «27 de Julho, 2026» — e sempre a
  -- errada. Sem `dateOnlyFromSelector`, a leitura cai para o texto do cartão
  -- inteiro e apanha-a: a agenda enchia-se de espetáculos que já aconteceram,
  -- sem um único erro pelo caminho. Foi assim que o RSS de Minde publicou vinte
  -- e um eventos passados, e não se deu por isso durante dias.
  --
  -- A configuração desta fonte vive em SQL, por desenho, e um `update` pode
  -- deitar isto abaixo sem tocar em código nenhum. É aqui que se apanha.
  select count(*) into n from public.sources
   where id = 'ccgv-sardoal' and is_enabled
     and config -> 'dateOnlyFromSelector' is distinct from 'true'::jsonb;
  assert n = 0, 'ccgv-sardoal ligada sem dateOnlyFromSelector: leria a data de publicação do post';

  -- E, pela mesma razão, a passagem pela página do espetáculo.
  --
  -- A listagem desta casa não traz sinopse nenhuma: título, data e cartaz, e
  -- mais nada. O texto que diz o que o espetáculo é — entre 850 e 1 600
  -- caracteres — vive só na página de cada um, em `.column_attr`. Sem
  -- `followLinks` e sem o seletor, os oito espetáculos publicados voltam a
  -- ficar com um título e um mapa.
  --
  -- O seletor está escrito e não é adivinhado de propósito: o
  -- `og:description` desta casa é «10/outubro | 21h30», que é a data. Um
  -- palpite genérico guardá-la-ia como se fosse a descrição, e um campo com
  -- ar de preenchido não volta a ser revisto por ninguém.
  select count(*) into n from public.sources
   where id = 'ccgv-sardoal' and is_enabled
     and (
       config -> 'followLinks' is distinct from 'true'::jsonb
       or config -> 'detailDescriptionSelector' ->> 0 is distinct from '.column_attr'
     );
  assert n = 0, 'ccgv-sardoal ligada sem seguir a página do evento: os espetáculos ficam sem sinopse';

  -- De quem são os dados.
  --
  -- Recolhe-se de sites municipais, dos próprios equipamentos e de fontes
  -- públicas de dados. De bilheteiras e agregadores, não — a programação
  -- chegava em segunda mão, e o Coreto passava a depender de quem a vende.
  --
  -- O Issuu não está na lista de propósito: uma agenda que a câmara publicou e
  -- alojou lá continua a ser a publicação da câmara. Alojamento não é autoria.
  select count(*) into n from public.sources
   where lower(url) similar to
     '%(bol.pt|ticketline.pt|blueticket.pt|seetickets.com|eventbrite.|ticketmaster.|viralagenda.com|songkick.com|bandsintown.com)%';
  assert n = 0, format('%s fontes a apontar para uma bilheteira ou agregador de terceiros', n);

  select count(*) into n from public.coretos c
   where c.venue_id is not null
     and not exists (select 1 from public.venues v where v.id = c.venue_id);
  assert n = 0, 'coreto a apontar para um espaço que não existe';

  select count(*) into n from public.category_aliases a
   where not exists (select 1 from public.categories c where c.slug = a.category_slug);
  assert n = 0, 'alias de categoria órfão';

  -- Os aliases têm de estar guardados já normalizados, senão o resolvedor
  -- nunca os encontra.
  select count(*) into n from public.category_aliases
   where alias <> public.normalize_for_hash(alias);
  assert n = 0, 'alias de categoria por normalizar';

  select count(*) into n from public.venue_aliases
   where alias <> public.normalize_for_hash(alias);
  assert n = 0, 'alias de espaço por normalizar';

  -- A fila dos espaços por resolver é indexada pelo nome já normalizado, pela
  -- mesma razão dos aliases: um nome guardado cru nunca volta a casar com o
  -- que a recolha lhe traz na noite seguinte, e a fila enche-se de repetições
  -- do mesmo problema.
  select count(*) into n from public.unresolved_venues
   where normalized <> public.normalize_for_hash(normalized);
  assert n = 0, 'espaço por resolver com a chave por normalizar';

  -- ---- Normalização e impressão digital ----
  assert public.event_fingerprint('Concerto de Ano Novo', '2026-01-01', 'tomar')
       = public.event_fingerprint('  concerto DE ano-novo!! ', '2026-01-01', 'tomar'),
    'a impressão digital deixou de ser insensível a acentos e pontuação';

  assert public.event_fingerprint('X', '2026-01-01', 'tomar')
      <> public.event_fingerprint('X', '2026-01-01', 'ourem'),
    'a impressão digital deixou de separar concelhos';

  assert public.event_fingerprint('X', '2026-01-01', 'tomar')
      <> public.event_fingerprint('X', '2026-01-02', 'tomar'),
    'a impressão digital deixou de separar datas';

  assert public.slugify('Ferreira do Zêzere') = 'ferreira-do-zezere',
    'slugify mudou de comportamento';

  -- Valores fixados, iguais aos de `packages/core/src/text.test.ts`.
  --
  -- A impressão digital é calculada dos DOIS lados: pela recolha, em
  -- TypeScript, e pela aprovação de submissões, aqui em SQL. Se divergirem, o
  -- mesmo evento entra duas vezes no catálogo. Fixar as mesmas constantes nos
  -- dois sítios faz com que uma alteração de qualquer dos lados parta um
  -- teste, em vez de partir o catálogo em silêncio meses depois.
  --
  -- «2ª» e «3º» estão aqui de propósito: é onde o `unaccent` do Postgres e o
  -- `NFKD` do JavaScript discordam, e foi onde isto quase correu mal.
  assert public.event_fingerprint('Concerto de Ano Novo', '2026-05-10', 'tomar')
       = 'f3898385b1d58e3e8034b5797f54f6747e69a79a49c5e497b28e07f772f7d6d6',
    'a impressão digital divergiu do valor fixado em packages/core';

  assert public.event_fingerprint('2ª Feira de São Brás', '2026-05-10', 'tomar')
       = '6eb08924857f87d9422ad4d7b8c2298f38f819e796bff77c6a22bba66445362f',
    'a impressão digital divergiu no ordinal feminino («2ª»)';

  assert public.event_fingerprint('Festa da Nossa Senhora da Piedade — 3º dia', '2026-05-10', 'tomar')
       = '0c4ba98d92ebb38677a252bba9f1d91f14a2248a069cd002794ff0928675b064',
    'a impressão digital divergiu no ordinal masculino («3º»)';

  assert public.event_fingerprint('Mação 100% — Ação!', '2026-05-10', 'tomar')
       = 'baf5df60422ca73d1e10d267d8c044ec56aafe498cecfa2d697a1f1da84f8f0c',
    'a impressão digital divergiu com acentos e pontuação';

  assert public.normalize_for_hash('2ª Feira de São Brás') = '2feiradesaobras',
    'normalize_for_hash mudou de comportamento no ordinal feminino';

  -- ---- RLS ligado em todas as tabelas do domínio ----
  select count(*) into n
    from pg_tables t
   where t.schemaname = 'public'
     and t.tablename not in ('schema_migrations')
     and not exists (
       select 1 from pg_class c
        join pg_namespace ns on ns.oid = c.relnamespace
       where ns.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity
     );
  assert n = 0, format('%s tabelas em `public` sem RLS ligado', n);

  -- ---- Uma vista não pode ser um buraco na RLS ----
  --
  -- Por omissão, uma vista corre com os direitos de quem a criou e não com os
  -- de quem a lê: a RLS das tabelas por baixo deixa de se aplicar. É dos
  -- enganos mais fáceis de cometer e dos mais difíceis de ver depois.
  select count(*) into n
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public'
     and c.relkind = 'v'
     and coalesce((
       select option_value from pg_options_to_table(c.reloptions)
        where option_name = 'security_invoker'
     ), 'off') not in ('on', 'true');
  assert n = 0, format('%s vistas em `public` sem security_invoker', n);

  -- ---- O público não escreve em lado nenhum ----
  --
  -- A RLS já o impede. Isto verifica a segunda tranca: que nem sequer existe
  -- a concessão de escrita. São precisos dois enganos, não um.
  select count(*) into n
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  assert n = 0, format('%s concessões de escrita ao público em `public`', n);

  -- ---- Nenhuma tabela sensível legível pelo público ----
  --
  -- `sources` não está nesta lista desde a 0049: a página /fontes lê-a, mas
  -- só as nove colunas que o `grant` por coluna deixa passar. A tranca dessa
  -- tabela é a asserção seguinte, que é mais apertada do que esta — verifica
  -- coluna a coluna em vez de tabela inteira.
  select count(*) into n
    from pg_policies p
   where p.schemaname = 'public'
     and p.tablename in ('submissions', 'submission_attachments', 'admin_actions',
                         'sender_quotas', 'rate_limits', 'source_runs',
                         -- 0157: as senhas das barreiras. Uma policy que as
                         -- expusesse punha o sha256 de cada região na rua.
                         'region_gates')
     and (p.roles::text like '%anon%' or p.roles::text like '%authenticated%');
  assert n = 0, format('%s policies expõem tabelas internas ao público', n);

  -- ---- Das fontes, o público vê a apresentação e não o caderno ----
  --
  -- O `config` de uma fonte guarda o cabeçalho `Origin` combinado com a
  -- câmara de Abrantes; o `notes` e o `last_error` são o diário da recolha.
  -- Um `grant select` à tabela inteira — feito de passagem, um dia, para
  -- desbloquear alguma coisa — punha tudo isso na rua sem ninguém dar por
  -- ela. É por isso que a asserção conta as colunas em vez de confiar na
  -- política.
  select count(*) into n
    from information_schema.column_privileges
   where table_schema = 'public'
     and table_name = 'sources'
     and grantee in ('anon', 'authenticated')
     and privilege_type = 'SELECT'
     and column_name not in ('id', 'name', 'kind', 'municipality_id', 'region_id',
                             'venue_id', 'url', 'is_enabled', 'last_success_at',
                             'last_run_at', 'public_note',
                             -- O nome do leitor, público desde a 0139. É o que
                             -- deixa a /estado dizer «sete das oito fontes
                             -- caladas correm o mesmo produto» em vez de oito
                             -- linhas soltas — e qualquer pessoa o infere
                             -- abrindo o sítio da câmara. O `config` é outra
                             -- coisa e continua onde estava: leva seletores,
                             -- exclusões e chaves de caminho. O nome do leitor
                             -- é público, a configuração dele nunca.
                             'adapter');
  assert n = 0, format('%s colunas internas das fontes estão legíveis pelo público', n);

  -- ---- E o público lê mesmo o que tem de ler ----
  --
  -- **Todas as asserções acima contam concessões a MAIS.** Uma base sem
  -- concessão nenhuma passava em todas elas, e passava porque cada uma
  -- pergunta «há alguma coisa aberta que não devia?». Faltava a pergunta
  -- simétrica, e a falta tinha um custo concreto: o ensaio mensal de restauro
  -- dava verde sobre uma cópia restaurada com `--no-privileges`, onde `anon`
  -- não conseguia ler uma linha do sítio. Um teto sem chão não é um
  -- intervalo.
  --
  -- A lista é a mesma da 0128, e é de propósito que está escrita duas vezes:
  -- lá é o que se concede, aqui é o que tem de estar concedido, e uma
  -- migração futura que revogue por engano tem de fazer isto falhar.
  for tabela in select unnest(array[
    'categories', 'coretos', 'event_sessions', 'events', 'municipalities',
    'region_domain_aliases', 'regions', 'series', 'site_sections', 'venues'
  ]) loop
    select count(*) into n
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = tabela
       and grantee = 'anon' and privilege_type = 'SELECT';
    assert n = 1, format('o público não consegue ler `%s` — o sítio não servia uma linha', tabela);
  end loop;

  -- Das fontes, a tabela está fechada e as colunas abertas: contar aqui é o
  -- que impede uma base restaurada de passar com a página /fontes vazia.
  select count(*) into n
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'sources'
     and grantee = 'anon' and privilege_type = 'SELECT';
  -- Doze desde a 0139, que pôs o nome do leitor na rua e deixou a
  -- configuração onde estava.
  assert n = 12, format('esperavam-se 12 colunas públicas nas fontes, há %s', n);

  -- ---- O acesso resolvido diz o que a ficha diria ----
  --
  -- `wheelchair_accessible_resolved` (0129) é uma desnormalização, e
  -- desnormalizações dessincronizam-se. Os dois gatilhos são o que a mantém;
  -- isto é o que dá por eles terem deixado de correr. Corre sobre a base do
  -- CI depois dos seeds e da região de prova, que é onde há linhas com as
  -- três combinações — evento que declara, evento calado com espaço que
  -- declara, e evento sem espaço nenhum.
  select count(*) into n
    from public.events e
    left join public.venues v on v.id = e.venue_id
   where e.wheelchair_accessible_resolved
         is distinct from coalesce(e.wheelchair_accessible, v.wheelchair_accessible);
  assert n = 0, format('%s eventos com o acesso resolvido em desacordo com a regra', n);

  -- E os dois gatilhos continuam lá. Um só deixava a coluna certa na metade
  -- que se edita e podre na que se herda: alguém marca um espaço como
  -- acessível no painel e os eventos de lá continuam fora do filtro.
  select count(*) into n
    from pg_trigger
   where not tgisinternal
     and tgname in ('events_sync_acesso_trg', 'venues_sync_acesso_trg');
  assert n = 2, format('esperavam-se os dois gatilhos do acesso resolvido, há %s', n);

  -- ---- Um evento não acontece num espaço de outro concelho ----
  --
  -- A regra é da 0130 e tem duas peças que se apoiam: a chave estrangeira
  -- composta, que é o que cobre também o lado dos espaços e quem escreva por
  -- fora da aplicação, e o gatilho, que é o que a recusa diz em português.
  -- Perder qualquer uma delas volta a abrir a porta ao que a 0129 fabrica por
  -- cima: um evento de um concelho a declarar-se acessível porque um espaço de
  -- outro concelho o é (medido).
  select count(*) into n
    from pg_constraint
   where conname = 'events_espaco_do_mesmo_concelho'
     and conrelid = 'public.events'::regclass
     and contype = 'f';
  assert n = 1, 'falta a chave que prende o evento ao concelho do seu espaço (0130)';

  select count(*) into n
    from pg_trigger
   where not tgisinternal and tgname = 'events_espaco_do_mesmo_concelho_trg';
  assert n = 1, 'falta o gatilho que diz em português porque é que o espaço não serve (0130)';

  -- E, por medida de segurança, a própria condição: nenhuma linha viva a
  -- violá-la. A restrição garante-o para o futuro; isto dá por uma base que
  -- tenha sido semeada por fora dela.
  select count(*) into n
    from public.events e
    join public.venues v on v.id = e.venue_id
   where v.municipality_id <> e.municipality_id;
  assert n = 0, format('%s eventos num espaço de outro concelho', n);
end
$$;

-- ---- Fluxo completo: submissão → aprovação → evento publicado ----
begin;
insert into public.submissions (id, channel, status, municipality_id)
values ('11111111-1111-1111-1111-111111111111', 'form', 'pending', 'tomar');

do $$
declare
  v_event uuid;
  v_start date;
  v_end date;
  v_sessions integer;
  v_actions integer;
begin
  v_event := public.approve_submission(
    '11111111-1111-1111-1111-111111111111',
    'ci',
    jsonb_build_object(
      'title', 'Concerto de Reis',
      'municipality_id', 'tomar',
      'venue_id', 'coreto-varzea-pequena',
      'category_slug', 'musica',
      'is_free', true,
      'date_start', '2027-01-06'
    ),
    jsonb_build_array(
      jsonb_build_object('session_date', '2027-01-07', 'start_time', '18:00'),
      jsonb_build_object('session_date', '2027-01-06', 'start_time', '21:00')
    )
  );

  select date_start, date_end into v_start, v_end from public.events where id = v_event;
  assert v_start = '2027-01-06', 'date_start não foi derivado das sessões';
  assert v_end = '2027-01-07', 'date_end não foi derivado das sessões';

  select count(*) into v_sessions from public.event_sessions where event_id = v_event;
  assert v_sessions = 2, format('esperadas 2 sessões, encontradas %s', v_sessions);

  select count(*) into v_actions from public.admin_actions
   where entity_id = '11111111-1111-1111-1111-111111111111';
  assert v_actions = 1, 'a aprovação não deixou rasto na auditoria';

  -- Uma sessão cancelada deixa de contar para as datas visíveis.
  update public.event_sessions set is_cancelled = true
   where event_id = v_event and session_date = '2027-01-07';
  select date_end into v_end from public.events where id = v_event;
  assert v_end = '2027-01-06', 'cancelar uma sessão não recalculou date_end';

  -- Um quase-duplicado é encontrado, não fundido.
  assert exists (
    select 1 from public.find_duplicate_candidates('Concerto dos Reis', '2027-01-06', 'tomar')
  ), 'o detetor de quase-duplicados deixou de encontrar o óbvio';

  assert not exists (
    select 1 from public.find_duplicate_candidates('Noite de Fados', '2027-01-06', 'tomar')
  ), 'o detetor de quase-duplicados passou a casar títulos sem relação';
end
$$;
rollback;

-- ---- Reconciliação do que desaparece da fonte ----
begin;
insert into public.events (id, slug, title, municipality_id, venue_id, status, origin,
                           fingerprint, source_id, source_key, date_start, date_end)
values
  ('a0000000-0000-4000-8000-000000000001', 'ci-presente', 'Presente', 'tomar',
   'coreto-varzea-pequena', 'published', 'scraper', 'f1', 'cm-tomar', 'k1',
   '2099-01-06', '2099-01-06'),
  ('a0000000-0000-4000-8000-000000000002', 'ci-sumido', 'Sumido', 'tomar',
   'coreto-varzea-pequena', 'published', 'scraper', 'f2', 'cm-tomar', 'k2',
   '2099-01-06', '2099-01-06'),
  ('a0000000-0000-4000-8000-000000000003', 'ci-antigo', 'Antigo', 'tomar',
   'coreto-varzea-pequena', 'published', 'scraper', 'f3', 'cm-tomar', 'k3',
   '2020-01-06', '2020-01-06'),
  ('a0000000-0000-4000-8000-000000000004', 'ci-submetido', 'Submetido', 'tomar',
   'coreto-varzea-pequena', 'published', 'email', 'f4', null, null,
   '2099-01-06', '2099-01-06');

do $$
declare
  v_status public.event_status;
  v_misses smallint;
begin
  perform public.reconcile_source_events('cm-tomar', array['k1'], '2026-08-27');

  -- Duas execuções no mesmo dia contam uma falta só: o limiar de 3 assume
  -- recolhas diárias, e uma reexecução manual não pode acelerar a remoção.
  perform public.reconcile_source_events('cm-tomar', array['k1'], '2026-08-28');
  perform public.reconcile_source_events('cm-tomar', array['k1'], '2026-08-28');

  select miss_count into v_misses from public.events
   where id = 'a0000000-0000-4000-8000-000000000002';
  assert v_misses = 2, format('duas execuções no mesmo dia contaram %s faltas', v_misses);

  select status into v_status from public.events
   where id = 'a0000000-0000-4000-8000-000000000002';
  assert v_status = 'published', 'um evento saiu antes de atingir o limiar de faltas';

  perform public.reconcile_source_events('cm-tomar', array['k1'], '2026-08-29');
  select status into v_status from public.events
   where id = 'a0000000-0000-4000-8000-000000000002';
  assert v_status = 'hidden', 'um evento ausente há 3 recolhas não saiu de cena';

  -- O que a recolha continua a ver não é tocado.
  select status into v_status from public.events
   where id = 'a0000000-0000-4000-8000-000000000001';
  assert v_status = 'published', 'a reconciliação retirou um evento que a fonte mostra';

  -- Passado remoto sai logo.
  select status into v_status from public.events
   where id = 'a0000000-0000-4000-8000-000000000003';
  assert v_status = 'archived', 'um evento de 2020 continua publicado';

  -- O que foi submetido por email nunca esteve na fonte e não acumula faltas.
  select status, miss_count into v_status, v_misses from public.events
   where id = 'a0000000-0000-4000-8000-000000000004';
  assert v_status = 'published' and v_misses = 0,
    'a reconciliação contou faltas a um evento que não veio de recolha';

  -- Reaparecer limpa o histórico: um evento adiado e reposto não pode chegar
  -- ao limiar por acumulação de meses.
  update public.events set status = 'published'
   where id = 'a0000000-0000-4000-8000-000000000002';
  perform public.reconcile_source_events('cm-tomar', array['k1', 'k2'], '2026-08-30');
  select miss_count into v_misses from public.events
   where id = 'a0000000-0000-4000-8000-000000000002';
  assert v_misses = 0, 'reaparecer não limpou o histórico de faltas';
end
$$;
rollback;

-- ---- Ressurreição e bloqueios manuais ----
begin;
insert into public.events (id, slug, title, municipality_id, venue_id, status, origin,
                           fingerprint, source_id, source_key, date_start, date_end,
                           archived_reason)
values
  ('b0000000-0000-4000-8000-000000000001', 'ci-reaparece', 'Reaparece', 'tomar',
   'coreto-varzea-pequena', 'published', 'scraper', 'g1', 'cm-tomar', 'k1',
   '2099-01-06', '2099-01-06', null),
  ('b0000000-0000-4000-8000-000000000002', 'ci-mao', 'Escondido à mão', 'tomar',
   'coreto-varzea-pequena', 'hidden', 'scraper', 'g2', 'cm-tomar', 'k2',
   '2099-01-06', '2099-01-06', null);

do $$
declare
  v_status public.event_status;
  v_fields text[];
  v_flag boolean;
begin
  perform public.reconcile_source_events('cm-tomar', array['k2'], '2026-08-27');
  perform public.reconcile_source_events('cm-tomar', array['k2'], '2026-08-28');
  perform public.reconcile_source_events('cm-tomar', array['k2'], '2026-08-29');

  select status into v_status from public.events
   where id = 'b0000000-0000-4000-8000-000000000001';
  assert v_status = 'hidden', 'o evento ausente não saiu de cena';

  -- Reaparecer repõe o que a reconciliação escondeu.
  perform public.reconcile_source_events('cm-tomar', array['k1', 'k2'], '2026-08-30');
  select status into v_status from public.events
   where id = 'b0000000-0000-4000-8000-000000000001';
  assert v_status = 'published', 'um evento que a fonte repôs continuou escondido';

  -- Mas uma decisão humana ganha à recolha: o que foi escondido à mão
  -- (sem `archived_reason`) não é reposto por a fonte voltar a mostrá-lo.
  select status into v_status from public.events
   where id = 'b0000000-0000-4000-8000-000000000002';
  assert v_status = 'hidden', 'a recolha desfez uma decisão de quem modera';

  -- Bloqueios de campo.
  perform public.lock_event_fields(
    'b0000000-0000-4000-8000-000000000001', array['title', 'date_start'], 'ci');
  select public.locked_fields('b0000000-0000-4000-8000-000000000001') into v_fields;
  assert v_fields = array['date_start', 'title'], 'os bloqueios não ficaram registados';

  select has_manual_overrides into v_flag from public.events
   where id = 'b0000000-0000-4000-8000-000000000001';
  assert v_flag, 'o atalho has_manual_overrides não acompanhou os bloqueios';

  perform public.unlock_event_fields('b0000000-0000-4000-8000-000000000001', 'ci', array['title']);
  select public.locked_fields('b0000000-0000-4000-8000-000000000001') into v_fields;
  assert v_fields = array['date_start'], 'levantar um bloqueio levantou os outros';
end
$$;

do $$
begin
  -- Um nome de coluna errado tem de rebentar: um bloqueio fantasma nunca mais
  -- se levanta, porque ninguém sabe que existe.
  begin
    perform public.lock_event_fields(
      'b0000000-0000-4000-8000-000000000001', array['coluna_que_nao_existe'], 'ci');
    raise exception 'lock_event_fields aceitou uma coluna inexistente';
  exception
    when others then
      if sqlerrm like 'lock_event_fields aceitou%' then raise; end if;
  end;
end
$$;
rollback;

-- ---- Ligar um sítio a um espaço, a partir do painel (0117) ----
--
-- Quatro eventos com o mesmo nome de sítio em texto solto: um de Tomar por
-- acontecer, um de Tomar com o `venue_id` trancado à mão, um de Abrantes e um
-- de Tomar que já passou. Ligar o nome ao coreto da Várzea Pequena tem de
-- apanhar o primeiro e o último — e só esses.
begin;
insert into public.events (id, slug, title, municipality_id, venue_id, location_name,
                           status, origin, fingerprint, date_start, date_end)
values
  ('d0000000-0000-4000-8000-000000000001', 'ci-sitio-solto', 'Sítio solto', 'tomar',
   null, 'Coreto da Várzea, à beira do rio', 'published', 'manual', 'i1',
   '2099-06-01', '2099-06-01'),
  ('d0000000-0000-4000-8000-000000000002', 'ci-sitio-trancado', 'Sítio trancado', 'tomar',
   null, 'Coreto da Várzea, à beira do rio', 'published', 'manual', 'i2',
   '2099-06-02', '2099-06-02'),
  ('d0000000-0000-4000-8000-000000000003', 'ci-sitio-de-abrantes', 'Sítio de Abrantes', 'abrantes',
   null, 'Coreto da Várzea, à beira do rio', 'published', 'manual', 'i3',
   '2099-06-03', '2099-06-03'),
  ('d0000000-0000-4000-8000-000000000004', 'ci-sitio-passado', 'Sítio que já passou', 'tomar',
   null, 'Coreto da Várzea, à beira do rio', 'published', 'manual', 'i4',
   '2020-06-04', '2020-06-04');

do $$
declare
  v_chave   text := public.normalize_for_hash('Coreto da Várzea, à beira do rio');
  v_ligados integer;
  v_venue   text;
  n         integer;
begin
  perform public.record_unresolved_venue('Coreto da Várzea, à beira do rio', 'tomar', null);
  perform public.lock_event_fields(
    'd0000000-0000-4000-8000-000000000002', array['venue_id'], 'ci', 'corrigido à mão');

  -- A fila conta o que está por acontecer em Tomar: o solto e o trancado.
  -- Nem o de Abrantes, nem o que já passou.
  select eventos_por_acontecer into n from public.unresolved_venues_pendentes
   where normalized = v_chave;
  assert n = 2, format('a fila devia contar 2 eventos por acontecer com este nome, e conta %s', n);

  -- Um nome de Abrantes não aponta a um espaço de Tomar.
  begin
    perform public.set_venue_alias(
      'Coreto da Várzea, à beira do rio', 'coreto-varzea-pequena', 'abrantes', 'ci');
    raise exception 'set_venue_alias aceitou um alias de Abrantes a apontar a um espaço de Tomar';
  exception
    when others then
      if sqlerrm like 'set_venue_alias aceitou%' then raise; end if;
  end;

  v_ligados := public.set_venue_alias(
    'Coreto da Várzea, à beira do rio', 'coreto-varzea-pequena', 'tomar', 'ci');
  assert v_ligados = 2, format('esperavam-se 2 eventos ligados, e foram %s', v_ligados);

  select venue_id into v_venue from public.events
   where id = 'd0000000-0000-4000-8000-000000000001';
  assert v_venue = 'coreto-varzea-pequena', 'o evento por acontecer não ficou ligado ao espaço';

  select venue_id into v_venue from public.events
   where id = 'd0000000-0000-4000-8000-000000000004';
  assert v_venue = 'coreto-varzea-pequena', 'o evento que já passou ficou por ligar';

  select venue_id into v_venue from public.events
   where id = 'd0000000-0000-4000-8000-000000000002';
  assert v_venue is null, 'ligar um sítio pisou um venue_id trancado à mão';

  select venue_id into v_venue from public.events
   where id = 'd0000000-0000-4000-8000-000000000003';
  assert v_venue is null, 'um alias preso a Tomar ligou um evento de Abrantes';

  -- Com alias, o nome sai da fila sozinho — é a promessa da 0067.
  select count(*) into n from public.unresolved_venues_pendentes where normalized = v_chave;
  assert n = 0, 'a fila continua a mostrar um nome que já tem alias';

  select count(*) into n from public.admin_actions
   where action = 'venue.alias' and actor = 'ci'
     and entity_id = v_chave || '/tomar'
     and (after ->> 'events_linked')::integer = 2;
  assert n = 1, 'ligar um sítio não deixou rasto na auditoria';

  -- E o «não é um sítio».
  perform public.record_unresolved_venue('Em vários sítios da prova', 'tomar', null);
  perform public.dismiss_unresolved_venue(
    public.normalize_for_hash('Em vários sítios da prova'), 'ci');
  select count(*) into n from public.unresolved_venues_pendentes
   where normalized = public.normalize_for_hash('Em vários sítios da prova');
  assert n = 0, 'pôr um nome de lado não o tirou da fila';
  select count(*) into n from public.admin_actions
   where action = 'venue.dismiss' and actor = 'ci'
     and entity_id = public.normalize_for_hash('Em vários sítios da prova');
  assert n = 1, 'pôr um nome de lado não deixou rasto na auditoria';
end
$$;
rollback;

-- ---- A montra renova-se sozinha (0119) ----
--
-- Recua-se um evento da montra cem dias, para o passado, e chama-se
-- `renovar_montra()`: ele tem de voltar ao futuro no menor salto múltiplo de
-- 60 dias, com as mesmas sessões e o mesmo espaçamento entre elas, com a
-- impressão digital a acompanhar a data nova — e mais nenhum evento se pode
-- mexer, nem os que já passaram de verdade nas regiões a sério. A segunda
-- chamada não tem nada para fazer.
begin;
do $$
declare
  v_evento   uuid;
  v_vao      integer;
  v_sessoes  integer;
  v_antes    date;
  v_depois   date;
  v_movidos  integer;
  n          integer;
begin
  -- Um evento da montra com mais de uma sessão, que é onde o espaçamento se
  -- prova. O que começa mais cedo, para a escolha ser sempre a mesma.
  select e.id, e.date_end - e.date_start into v_evento, v_vao
    from public.events e
    join public.municipalities m on m.id = e.municipality_id
    join public.regions r on r.id = m.region_id
   where r.kind = 'montra' and e.status = 'published'
     and (select count(*) from public.event_sessions s where s.event_id = e.id) >= 2
   order by e.date_start, e.title
   limit 1;
  assert v_evento is not null, 'não há na montra um evento com duas sessões para pôr à prova';

  select count(*) into v_sessoes from public.event_sessions where event_id = v_evento;

  update public.event_sessions set session_date = session_date - 100 where event_id = v_evento;
  select date_end into v_antes from public.events where id = v_evento;
  assert v_antes < current_date, 'depois de recuar cem dias o evento devia estar no passado';

  v_movidos := public.renovar_montra();
  assert v_movidos = 1, format('renovar_montra devia mover um evento, e moveu %s', v_movidos);

  select date_end into v_depois from public.events where id = v_evento;
  assert v_depois >= current_date, 'o evento continua no passado depois de renovar';
  assert (v_depois - v_antes) % 60 = 0 and v_depois - v_antes > 0,
    format('o salto foi de %s dias, e tinha de ser um múltiplo de 60', v_depois - v_antes);
  assert v_depois - 60 < current_date,
    format('o salto de %s dias não foi o menor que devolvia o evento ao futuro', v_depois - v_antes);

  select count(*) into n from public.event_sessions where event_id = v_evento;
  assert n = v_sessoes, format('a renovação deixou o evento com %s sessões em vez de %s', n, v_sessoes);

  select count(*) into n from public.events
   where id = v_evento and date_end - date_start = v_vao;
  assert n = 1, 'a renovação mudou o espaçamento entre a primeira e a última sessão';

  select count(*) into n from public.events
   where id = v_evento
     and fingerprint = public.event_fingerprint(title, date_start, municipality_id);
  assert n = 1, 'a impressão digital não acompanhou a data nova';

  v_movidos := public.renovar_montra();
  assert v_movidos = 0, format('a segunda chamada não tinha nada para mover, e moveu %s', v_movidos);
end
$$;
rollback;

-- ---- A região nasce no painel (0121) ----
--
-- É o guia NOVA-CIM pelo caminho do painel, em forma executável — como o seed
-- de prova (supabase/ci/9000) é o caminho do SQL. Uma região com dois
-- concelhos, um com sítio e outro sem, nasce por `create_region` e tem de
-- ficar exatamente como o loop das regiões, acima, exige a qualquer região:
-- a contagem declarada a bater, um espaço e uma fonte por concelho, os
-- centros dentro da caixa. E mais o que só o painel promete: o espaço é
-- provisório e diz-se provisório, a fonte está desligada e diz porquê, a
-- auditoria tem a linha, e um segundo nascimento com o mesmo identificador —
-- ou com um concelho que já é de alguém, ou com as coordenadas trocadas — é
-- recusado antes de se escrever seja o que for.
begin;
do $$
declare
  r       public.regions%rowtype;
  v_id    text;
  v_url   text;
  v_nota  text;
  n       integer;
begin
  v_id := public.create_region(
    'prova-do-painel', 'Prova do Painel', 'a',
    'Comunidade Intermunicipal da Prova do Painel', 'https://prova-do-painel.example',
    'coreto.prova-do-painel.example', 'coreto@prova-do-painel.example',
    'coreto.prova-do-painel.example',
    jsonb_build_array(
      jsonb_build_object('id', 'alto-da-prova', 'name', 'Alto da Prova', 'district', 'Prova',
                         'latitude', 37.12, 'longitude', -8.45,
                         'website', 'https://cm-altodaprova.example'),
      jsonb_build_object('id', 'baixa-da-prova', 'name', 'Baixa da Prova', 'district', 'Prova',
                         'latitude', 37.31, 'longitude', -8.21)
    ),
    'ci'
  );
  assert v_id = 'prova-do-painel',
    format('create_region devolveu «%s» em vez do identificador da região', v_id);

  select * into r from public.regions where id = 'prova-do-painel';
  assert found, 'a região não ficou escrita';
  assert r.kind = 'cim', format('a região nasceu do tipo «%s»; o painel só faz nascer CIM', r.kind);
  assert r.expected_municipality_count = 2,
    format('a contagem declarada é %s para 2 concelhos', r.expected_municipality_count);
  assert r.article = 'a' and r.domain = 'coreto.prova-do-painel.example'
     and r.ical_uid_domain = 'coreto.prova-do-painel.example'
     and r.contact_email = 'coreto@prova-do-painel.example',
    'a identidade da região não ficou como se pediu';
  assert r.is_enabled, 'a região nasceu desligada; nasce ligada, como as semeadas à mão';

  -- A caixa contém os dois centros, com folga: os espaços de um concelho não
  -- vivem todos na sede, e a caixa não se edita no painel.
  assert 37.12 between r.bbox_lat_min and r.bbox_lat_max
     and -8.45 between r.bbox_lon_min and r.bbox_lon_max
     and 37.31 between r.bbox_lat_min and r.bbox_lat_max
     and -8.21 between r.bbox_lon_min and r.bbox_lon_max,
    format('a caixa (%s–%s N, %s–%s E) não contém os dois concelhos',
           r.bbox_lat_min, r.bbox_lat_max, r.bbox_lon_min, r.bbox_lon_max);
  assert r.bbox_lat_min <= 37.12 - 0.2 and r.bbox_lat_max >= 37.31 + 0.2
     and r.bbox_lon_min <= -8.45 - 0.2 and r.bbox_lon_max >= -8.21 + 0.2,
    'a caixa nasceu sem margem à volta dos centros';

  -- Os concelhos: pela ordem da lista, com o que a lista trazia.
  select count(*) into n from public.municipalities where region_id = 'prova-do-painel';
  assert n = 2, format('esperavam-se 2 concelhos na região, e há %s', n);
  select sort_order into n from public.municipalities where id = 'baixa-da-prova';
  assert n = 2, 'a ordem dos concelhos não é a da lista';
  select count(*) into n from public.municipalities
   where id = 'alto-da-prova' and district = 'Prova'
     and website_url = 'https://cm-altodaprova.example'
     and latitude = 37.12 and longitude = -8.45;
  assert n = 1, 'o concelho não ficou com o distrito, o sítio e as coordenadas que se pediram';

  -- Por concelho, um espaço: provisório, no centro do concelho, com a nota a
  -- dizer quem o criou — e a resolver pelo próprio nome, como os outros.
  select count(*) into n from public.municipalities m
   where m.region_id = 'prova-do-painel'
     and (select count(*) from public.venues v where v.municipality_id = m.id) <> 1;
  assert n = 0, 'cada concelho novo devia ter exatamente um espaço';
  select count(*) into n
    from public.venues v
    join public.municipalities m on m.id = v.municipality_id
   where m.region_id = 'prova-do-painel'
     and v.status = 'provisional' and v.kind = 'other'
     and v.latitude = m.latitude and v.longitude = m.longitude
     and v.notes like '%pelo painel por ci%';
  assert n = 2, 'o espaço provisório não ficou provisório, no centro do concelho e com a nota';
  select count(*) into n from public.venue_aliases
   where venue_id = 'camara-municipal-de-alto-da-prova' and municipality_id = 'alto-da-prova'
     and alias = public.normalize_for_hash('Câmara Municipal de Alto da Prova');
  assert n = 1, 'o espaço provisório não resolve pelo próprio nome';

  -- Por concelho, uma fonte: desligada, do leitor genérico, a dizer porquê.
  select count(*) into n from public.municipalities m
   where m.region_id = 'prova-do-painel'
     and (select count(*) from public.sources s where s.municipality_id = m.id) <> 1;
  assert n = 0, 'cada concelho novo devia ter exatamente uma fonte';
  select count(*) into n
    from public.sources s
    join public.municipalities m on m.id = s.municipality_id
   where m.region_id = 'prova-do-painel'
     and (s.is_enabled or s.adapter <> 'generic-html' or s.public_note is null);
  assert n = 0, 'uma fonte nasceu ligada, sem o leitor genérico ou sem dizer porque está desligada';
  select url into v_url from public.sources where id = 'cm-alto-da-prova';
  assert v_url = 'https://cm-altodaprova.example',
    format('a fonte do concelho com sítio devia apontar ao sítio, e aponta a %s', v_url);
  select url, public_note into v_url, v_nota from public.sources where id = 'cm-baixa-da-prova';
  assert v_url = 'https://baixa-da-prova.example/',
    format('a fonte do concelho sem sítio devia apontar a um .example, e aponta a %s', v_url);
  assert v_nota like '%nunca será pedido%',
    'a fonte com endereço .example não diz que o endereço nunca será pedido';

  -- O que o loop das regiões exige a todas, para esta: a vista de qualidade
  -- cobre os dois concelhos desde o primeiro dia.
  select count(*) into n from public.event_quality_by_municipality
   where region_id = 'prova-do-painel';
  assert n = 2, format('a vista de qualidade tem %s linhas para 2 concelhos novos', n);

  -- A auditoria: quem, o quê, e o que ficou escrito.
  select count(*) into n from public.admin_actions
   where action = 'region.create' and entity_type = 'region'
     and entity_id = 'prova-do-painel' and actor = 'ci'
     and (after ->> 'expected_municipality_count')::integer = 2
     and jsonb_array_length(after -> 'municipalities') = 2;
  assert n = 1, 'o nascimento não deixou rasto na auditoria';

  -- Um segundo nascimento com o mesmo identificador é recusado.
  begin
    perform public.create_region(
      'prova-do-painel', 'Prova do Painel, outra vez', 'a',
      'Comunidade Intermunicipal da Prova do Painel', 'https://prova-do-painel.example',
      'coreto2.prova-do-painel.example', 'coreto@prova-do-painel.example',
      'coreto2.prova-do-painel.example',
      jsonb_build_array(jsonb_build_object('id', 'outro-da-prova', 'name', 'Outro da Prova',
        'district', 'Prova', 'latitude', 37.2, 'longitude', -8.3)),
      'ci');
    raise exception 'create_region aceitou uma segunda região com o mesmo identificador';
  exception when others then
    if sqlerrm like 'create_region aceitou%' then raise; end if;
  end;

  -- Um concelho que já é de outra região também: os slugs são globais.
  begin
    perform public.create_region(
      'prova-repetida', 'Prova Repetida', 'a',
      'Comunidade Intermunicipal da Prova Repetida', 'https://prova-repetida.example',
      'coreto.prova-repetida.example', 'coreto@prova-repetida.example',
      'coreto.prova-repetida.example',
      jsonb_build_array(jsonb_build_object('id', 'tomar', 'name', 'Tomar',
        'district', 'Santarém', 'latitude', 39.6039, 'longitude', -8.4103)),
      'ci');
    raise exception 'create_region aceitou um concelho que já é de outra região';
  exception when others then
    if sqlerrm like 'create_region aceitou%' then raise; end if;
  end;

  -- As coordenadas trocadas são recusadas antes de porem um concelho no mar.
  begin
    perform public.create_region(
      'prova-no-mar', 'Prova no Mar', 'a',
      'Comunidade Intermunicipal da Prova no Mar', 'https://prova-no-mar.example',
      'coreto.prova-no-mar.example', 'coreto@prova-no-mar.example',
      'coreto.prova-no-mar.example',
      jsonb_build_array(jsonb_build_object('id', 'concelho-no-mar', 'name', 'Concelho no Mar',
        'district', 'Prova', 'latitude', -8.45, 'longitude', 37.12)),
      'ci');
    raise exception 'create_region aceitou a latitude e a longitude trocadas';
  exception when others then
    if sqlerrm like 'create_region aceitou%' then raise; end if;
  end;

  -- E um domínio que já é canónico ou alias de outra região (0111).
  begin
    perform public.create_region(
      'prova-do-dominio', 'Prova do Domínio', 'a',
      'Comunidade Intermunicipal da Prova do Domínio', 'https://prova-do-dominio.example',
      'mediotejo.coreto.org', 'coreto@prova-do-dominio.example', 'coreto.prova-do-dominio.example',
      jsonb_build_array(jsonb_build_object('id', 'concelho-do-dominio', 'name', 'Concelho do Domínio',
        'district', 'Prova', 'latitude', 37.2, 'longitude', -8.3)),
      'ci');
    raise exception 'create_region aceitou um domínio que já é alias de outra região';
  exception when others then
    if sqlerrm like 'create_region aceitou%' then raise; end if;
  end;

  -- Nenhuma das recusas escreveu seja o que for.
  select count(*) into n from public.regions
   where id in ('prova-repetida', 'prova-no-mar', 'prova-do-dominio');
  assert n = 0, 'uma região recusada ficou escrita';
  select count(*) into n from public.municipalities
   where id in ('outro-da-prova', 'concelho-no-mar', 'concelho-do-dominio');
  assert n = 0, 'um concelho de uma região recusada ficou escrito';
end
$$;
rollback;

-- ---- Limitação de tráfego ----
begin;
do $$
declare
  v_allowed boolean;
begin
  perform public.rate_limit_hit('ci-teste', 60, 2);
  perform public.rate_limit_hit('ci-teste', 60, 2);
  select allowed into v_allowed from public.rate_limit_hit('ci-teste', 60, 2);
  assert v_allowed = false, 'o limitador deixou passar um pedido acima do limite';
end
$$;
rollback;

-- ---- Os tipos de fonte descrevem o território (0135/0136) ----
--
-- As asserções da 0136 correram uma vez, antes de a região de prova existir.
-- Estas correm depois de tudo, e é aqui que a segunda CIM do CI é obrigada às
-- mesmas regras da primeira — que é a única razão por que a região de prova
-- existe.
do
$$
declare
  n integer;
  v_lista text;
begin
  select count(*), string_agg(id, ', ' order by id) into n, v_lista
    from public.sources
   where (id like 'jf-%' or id like 'uf-%') and kind is distinct from 'parish_site';
  assert n = 0, format('fontes com id de junta que não são parish_site: %s', v_lista);

  select count(*), string_agg(id, ', ' order by id) into n, v_lista
    from public.sources
   where kind = 'parish_site' and id not like 'jf-%' and id not like 'uf-%';
  assert n = 0, format('fontes marcadas como junta sem o id de uma: %s', v_lista);

  -- Uma fonte de junta não tem espaço: uma junta é uma instituição, não uma
  -- sala. É a diferença que justifica o `parish_site` existir.
  select count(*), string_agg(id, ', ' order by id) into n, v_lista
    from public.sources where kind = 'parish_site' and venue_id is not null;
  assert n = 0, format('fontes de junta com espaço: %s', v_lista);

  -- O denominador, em toda a região completa que não seja a montra.
  select count(*), string_agg(m.id, ', ' order by m.id) into n, v_lista
    from public.municipalities m
    join public.regions r on r.id = m.region_id
   where m.parish_count is null
     and r.kind <> 'montra'
     and r.expected_municipality_count =
         (select count(*) from public.municipalities x where x.region_id = r.id);
  assert n = 0,
    format('concelhos sem freguesias contadas numa região que se declara completa: %s — '
           'ver docs/NOVA-CIM.md', v_lista);

  -- E o numerador nunca pode passar o denominador: mais juntas ligadas do que
  -- freguesias existem é a fração a dizer que 27 de 84 são 27 de 84 mais uma.
  select count(*), string_agg(m.id, ', ' order by m.id) into n, v_lista
    from public.municipalities m
   where m.parish_count is not null
     and (select count(*) from public.sources s
           where s.kind = 'parish_site' and s.municipality_id = m.id) > m.parish_count;
  assert n = 0, format('concelhos com mais juntas ligadas do que freguesias: %s', v_lista);
end
$$;

-- ---- Nada de `security definer` ao alcance de quem não é a chave de serviço ----
--
-- A regra está escrita desde a 0007 e nunca esteve verificada: lá, oito funções
-- foram revogadas uma a uma, à mão. Uma regra que se cumpre à mão cumpre-se até
-- ao dia em que alguém escreve a nona — e escreveram-se três, nas 0129 e 0130,
-- todas com o `execute` que o Postgres dá a PUBLIC por omissão. Quem as apanhou
-- foi o linter da Supabase, que existe, funciona, e ninguém lia.
--
-- Isto não tem lista de exceções de propósito. Se um dia uma função
-- `security definer` tiver mesmo de ser pública, a exceção escreve-se aqui com
-- a razão ao lado — que é o momento em que alguém tem de a justificar.
do
$$
declare
  v_ao_alcance text;
begin
  select string_agg(p.proname || '() → ' || pg_get_function_result(p.oid), ', ' order by p.proname)
    into v_ao_alcance
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'));

  assert v_ao_alcance is null,
    format('funções security definer ao alcance do anon ou do authenticated: %s', v_ao_alcance);
end
$$;

-- A tabela dos resumos das migrações vive no esquema que o PostgREST serve, e
-- é a única que nasceu fora de uma migração — por isso escapou à regra das
-- outras treze tabelas de serviço até à 0134.
do
$$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.migration_checksums'::regclass),
    'migration_checksums está no esquema exposto sem RLS';
  assert not has_table_privilege('anon', 'public.migration_checksums', 'select'),
    'o anon lê a lista de migrações aplicadas';
  assert not has_table_privilege('authenticated', 'public.migration_checksums', 'select'),
    'quem tem sessão lê a lista de migrações aplicadas';
end
$$;

-- ---- Prazos de conservação (0133) ----
--
-- A política publicada promete apagar; isto verifica que o código apaga o que
-- ela promete e **só** isso. As fixtures são uma por FORMATO de payload e não
-- uma por canal: o que uma primeira versão da âncora não sabia ler era o
-- formato do email (`dates[]`), e uma asserção escrita por canal passava na
-- mesma porque a fixture do email trazia um `date_start` que a rota nunca
-- escreve.
begin;

insert into public.submissions (id, channel, status, municipality_id, payload,
                                sender_email, ip_hash, raw_text, created_at)
values
  -- caducada: email de um evento que aconteceu há 30 meses
  ('e0000000-0000-4000-8000-000000000001', 'email', 'rejected', 'tomar',
   jsonb_build_object('title', 'Já foi', 'dates', jsonb_build_array(
     jsonb_build_object('date', to_char(current_date - interval '30 months', 'YYYY-MM-DD')))),
   'antigo@exemplo.pt', 'hash-antigo', 'o texto do email', now() - interval '30 months'),
  -- caducada também, mas com um anexo ainda no balde
  ('e0000000-0000-4000-8000-000000000002', 'email', 'rejected', 'tomar',
   jsonb_build_object('title', 'Com cartaz', 'dates', jsonb_build_array(
     jsonb_build_object('date', to_char(current_date - interval '30 months', 'YYYY-MM-DD')))),
   'cartaz@exemplo.pt', 'hash-cartaz', 'o texto do outro', now() - interval '30 months'),
  -- NÃO caducada: chegou há 30 meses, mas o evento é daqui a dois — e é o caso
  -- que separa este expurgo de «apagar 24 meses depois de chegar»
  ('e0000000-0000-4000-8000-000000000003', 'email', 'pending', 'tomar',
   jsonb_build_object('title', 'Ainda vai ser', 'dates', jsonb_build_array(
     jsonb_build_object('date', to_char(current_date + interval '2 months', 'YYYY-MM-DD')))),
   'futuro@exemplo.pt', 'hash-futuro', 'o texto do terceiro', now() - interval '30 months');

-- A fotografia que a `reject_submission` grava em `admin_actions.before` (0006)
-- leva o endereço, o hash do IP e o texto em bruto.
insert into public.admin_actions (actor, action, entity_type, entity_id, before)
values ('ci', 'submission.reject', 'submission', 'e0000000-0000-4000-8000-000000000001',
        jsonb_build_object('id', 'e0000000-0000-4000-8000-000000000001',
                           'sender_email', 'antigo@exemplo.pt',
                           'ip_hash', 'hash-antigo',
                           'raw_text', 'o texto do email',
                           'status', 'pending'));

insert into public.submission_attachments (submission_id, storage_path, mime_type, size_bytes)
values ('e0000000-0000-4000-8000-000000000002', 'e0000000/cartaz.pdf', 'application/pdf', 2048);
insert into storage.objects (bucket_id, name) values ('intake', 'e0000000/cartaz.pdf');

do $$
declare
  v_apagadas integer;
  v_retidas integer;
  v_before jsonb;
begin
  select apagadas, retidas into v_apagadas, v_retidas from public.prune_submissions();

  assert v_apagadas = 1, format('esperava-se uma submissão apagada, foram %s', v_apagadas);
  assert v_retidas = 1, format('esperava-se uma submissão retida pelo anexo, foram %s', v_retidas);

  assert not exists (select 1 from public.submissions
                      where id = 'e0000000-0000-4000-8000-000000000001'),
    'a submissão caducada sem anexos não foi apagada';

  -- Os bytes ainda estão no balde: apagar a linha deixava-os lá sem ninguém
  -- que soubesse o caminho.
  assert exists (select 1 from public.submissions
                  where id = 'e0000000-0000-4000-8000-000000000002'),
    'a submissão com o anexo ainda no balde foi apagada — os bytes ficaram órfãos';

  -- E o evento que ainda não aconteceu fica, mesmo tendo chegado há 30 meses.
  assert exists (select 1 from public.submissions
                  where id = 'e0000000-0000-4000-8000-000000000003'),
    'apagou-se a submissão de um evento que ainda não aconteceu — a âncora não leu o payload do email';

  select before into v_before from public.admin_actions
   where entity_id = 'e0000000-0000-4000-8000-000000000001';
  assert not (v_before ? 'sender_email'), 'o endereço ficou na fotografia de admin_actions.before';
  assert not (v_before ? 'ip_hash'), 'o hash do IP ficou na fotografia de admin_actions.before';
  assert not (v_before ? 'raw_text'), 'o texto em bruto ficou na fotografia de admin_actions.before';
  assert v_before ? 'status', 'a anonimização levou atrás o resto do rasto';
  assert v_before ? 'expurgado_em', 'a fotografia não diz que foi expurgada';
end
$$;

-- Tirado o ficheiro do balde pela API do Storage, a linha sai na noite
-- seguinte, e o anexo vai atrás por cascata.
delete from storage.objects where bucket_id = 'intake' and name = 'e0000000/cartaz.pdf';

do $$
declare
  v_apagadas integer;
  v_retidas integer;
begin
  select apagadas, retidas into v_apagadas, v_retidas from public.prune_submissions();
  assert v_apagadas = 1 and v_retidas = 0,
    format('depois de o ficheiro sair do balde esperavam-se 1 apagada e 0 retidas, foram %s e %s',
           v_apagadas, v_retidas);
  assert not exists (select 1 from public.submission_attachments
                      where submission_id = 'e0000000-0000-4000-8000-000000000002'),
    'o anexo não saiu por cascata com a submissão';
end
$$;

-- As quotas de remetente: as inativas saem, a bloqueada fica. Um bloqueio é
-- uma decisão humana e o prazo de conservação não é uma amnistia (0018).
insert into public.sender_quotas (sender_email, updated_at, is_blocked)
values ('inativo@exemplo.pt', now() - interval '30 months', false),
       ('bloqueado@exemplo.pt', now() - interval '30 months', true),
       ('recente@exemplo.pt', now(), false);

do $$
declare
  n integer;
begin
  n := public.prune_sender_quotas();
  assert n = 1, format('esperava-se uma quota apagada, foram %s', n);
  assert exists (select 1 from public.sender_quotas where sender_email = 'bloqueado@exemplo.pt'),
    'o expurgo desfez um bloqueio em silêncio';
  assert exists (select 1 from public.sender_quotas where sender_email = 'recente@exemplo.pt'),
    'o expurgo apagou uma quota dentro do prazo';
end
$$;

-- E o registo de moderação com mais de 24 meses.
insert into public.admin_actions (actor, action, entity_type, entity_id, created_at)
values ('ci', 'event.hide', 'event', 'prova-do-prazo', now() - interval '30 months');

do $$
declare
  n integer;
begin
  n := public.prune_admin_actions();
  assert n = 1, format('esperava-se uma ação de moderação apagada, foram %s', n);
  assert not exists (select 1 from public.admin_actions where entity_id = 'prova-do-prazo'),
    'a ação de moderação fora de prazo ficou';
end
$$;

rollback;

-- ---- Contadores por evento ----
begin;
insert into public.events (id, slug, title, municipality_id, venue_id, status, origin,
                           fingerprint, date_start, date_end)
values
  ('c0000000-0000-4000-8000-000000000001', 'ci-contadores', 'Contadores', 'tomar',
   'coreto-varzea-pequena', 'published', 'manual', 'h1', '2099-05-10', '2099-05-10');

do $$
declare
  v_views bigint;
  v_ticket bigint;
  v_ical bigint;
  v_shares bigint;
  v_clicks bigint;
  n integer;
begin
  -- Um tipo fora da lista tem de rebentar. Se passasse em silêncio, a
  -- contagem perdia-se e ninguém dava por isso — que é a pior maneira de um
  -- número estar errado.
  begin
    perform public.record_event_stat('c0000000-0000-4000-8000-000000000001', 'clique_qualquer');
    raise exception 'record_event_stat aceitou um tipo desconhecido';
  exception
    when others then
      if sqlerrm like 'record_event_stat aceitou%' then raise; end if;
  end;

  begin
    perform public.record_event_stat('c0000000-0000-4000-8000-000000000001', null);
    raise exception 'record_event_stat aceitou um tipo nulo';
  exception
    when others then
      if sqlerrm like 'record_event_stat aceitou%' then raise; end if;
  end;

  -- Cada tipo tem de somar ao contador que lhe pertence, e a nenhum outro.
  perform public.record_event_stat('c0000000-0000-4000-8000-000000000001', 'view');
  perform public.record_event_stat('c0000000-0000-4000-8000-000000000001', 'view');
  perform public.record_event_stat('c0000000-0000-4000-8000-000000000001', 'ticket_click');
  perform public.record_event_stat('c0000000-0000-4000-8000-000000000001', 'ical_download');
  perform public.record_event_stat('c0000000-0000-4000-8000-000000000001', 'share');

  select views, ticket_clicks, ical_downloads, shares, clicks
    into v_views, v_ticket, v_ical, v_shares, v_clicks
    from public.event_stats
   where event_id = 'c0000000-0000-4000-8000-000000000001';

  assert v_views = 2, format('esperadas 2 vistas, contadas %s', v_views);
  assert v_ticket = 1, format('esperado 1 clique na bilhética, contados %s', v_ticket);
  assert v_ical = 1, format('esperada 1 transferência de calendário, contadas %s', v_ical);
  assert v_shares = 1, format('esperada 1 partilha, contadas %s', v_shares);
  assert v_clicks = 3, format('a soma de cliques deu %s, esperavam-se 3', v_clicks);

  -- Uma ficha aberta há uma hora num separador de alguém pode apontar para um
  -- evento que entretanto desapareceu. Isso não conta e não rebenta.
  perform public.record_event_stat('c0000000-0000-4000-8000-00000000ffff', 'view');
  select count(*) into n from public.event_stats
   where event_id = 'c0000000-0000-4000-8000-00000000ffff';
  assert n = 0, 'guardou-se uma contagem de um evento que não existe';

  -- Apagar o evento leva os contadores com ele.
  delete from public.events where id = 'c0000000-0000-4000-8000-000000000001';
  select count(*) into n from public.event_stats
   where event_id = 'c0000000-0000-4000-8000-000000000001';
  assert n = 0, 'os contadores sobreviveram ao evento a que pertenciam';
end
$$;
rollback;

-- ---- O relatório mensal conta as visitas entre duas fotografias ----
--
-- A 0120 prova que uma fotografia só não chega para contar um mês. Aqui
-- prova-se o contrário, com a região de prova já na base: duas fotografias
-- com um mês entre elas, cem aberturas e três cliques em cada concelho no
-- intervalo, e o relatório desse mês tem de dizer exatamente isso — e as
-- datas das fotografias com que o disse.
begin;
do $$
declare
  r           record;
  v_mes       date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_seguinte  date := date_trunc('month', current_date)::date;
  v_relatorio jsonb;
  n           integer;
  v_concelhos integer;
begin
  perform public.snapshot_event_stats();

  insert into public.event_stats_snapshots
    (municipality_id, taken_on, events_counted, views, ticket_clicks, ical_downloads, shares, clicks)
  select municipality_id, v_mes, events_counted, views, ticket_clicks, ical_downloads, shares, clicks
    from public.event_stats_snapshots
   where taken_on = current_date
  on conflict (municipality_id, taken_on) do update set
    events_counted = excluded.events_counted, views = excluded.views,
    ticket_clicks = excluded.ticket_clicks, ical_downloads = excluded.ical_downloads,
    shares = excluded.shares, clicks = excluded.clicks;

  insert into public.event_stats_snapshots
    (municipality_id, taken_on, events_counted, views, ticket_clicks, ical_downloads, shares, clicks)
  select municipality_id, v_seguinte, events_counted, views + 100, ticket_clicks + 1,
         ical_downloads + 1, shares + 1, clicks + 3
    from public.event_stats_snapshots
   where taken_on = v_mes
  on conflict (municipality_id, taken_on) do update set
    events_counted = excluded.events_counted, views = excluded.views,
    ticket_clicks = excluded.ticket_clicks, ical_downloads = excluded.ical_downloads,
    shares = excluded.shares, clicks = excluded.clicks;

  for r in select id from public.regions loop
    v_relatorio := public.monthly_report(r.id, v_mes);
    select count(*) into v_concelhos from public.municipalities where region_id = r.id;

    assert (v_relatorio #>> '{visits,available}') = 'true',
      format('%s: com duas fotografias o mês tinha de contar', r.id);
    assert (v_relatorio #>> '{visits,from}') = to_char(v_mes, 'YYYY-MM-DD')
       and (v_relatorio #>> '{visits,to}') = to_char(v_seguinte, 'YYYY-MM-DD'),
      format('%s: o relatório contou entre %s e %s', r.id,
             v_relatorio #>> '{visits,from}', v_relatorio #>> '{visits,to}');

    select count(*) into n
      from jsonb_array_elements(v_relatorio #> '{visits,by_municipality}') x
     where (x ->> 'views')::bigint = 100
       and (x ->> 'ticket_clicks')::bigint = 1
       and (x ->> 'clicks')::bigint = 3;
    assert n = v_concelhos,
      format('%s: as visitas do mês não são a diferença entre as duas fotografias', r.id);

    -- O resto do relatório continua a ter a forma prometida num mês vazio.
    assert jsonb_array_length(v_relatorio -> 'quality') = v_concelhos
       and jsonb_array_length(v_relatorio #> '{events,happening_in_month}') = v_concelhos,
      format('%s: o relatório não tem uma linha por concelho', r.id);
    assert jsonb_typeof(v_relatorio #> '{submissions,received_by_channel,email}') = 'number',
      format('%s: as submissões recebidas por canal não vêm como números', r.id);
  end loop;
end
$$;
rollback;

-- ---- A tabela de contadores não identifica ninguém ----
--
-- Esta é a asserção que sustenta a promessa da política de privacidade e a
-- ausência de aviso de cookies. Uma coluna com IP, sessão, dispositivo ou
-- sequer data da visita transformava contadores agregados em histórico de
-- comportamento — e isso já são dados pessoais, com tudo o que se lhes segue.
do $$
declare
  n integer;
  v_cols text;
begin
  select count(*), coalesce(string_agg(column_name, ', '), '')
    into n, v_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'event_stats'
     and column_name not in ('event_id', 'views', 'ticket_clicks',
                             'ical_downloads', 'shares', 'clicks', 'updated_at',
                             -- Dois contadores novos na 0141: o clique na
                             -- página oficial do evento e o clique em «como
                             -- chegar». São contagens agregadas por evento como
                             -- as outras cinco — não trazem IP, sessão,
                             -- dispositivo nem data de visita, que é a única
                             -- coisa que esta asserção existe para travar.
                             --
                             -- A lista escreve-se à mão de propósito: acrescentar
                             -- um nome aqui obriga a passar por este comentário e
                             -- a perguntar se a coluna nova identifica alguém.
                             'source_clicks', 'directions_clicks');
  assert n = 0, format('event_stats ganhou colunas fora dos contadores: %s', v_cols);

  -- A lista acima trava qualquer coluna nova; esta trava-a pelo nome, para que
  -- a mensagem de erro diga porque é que a coluna não pode existir.
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'event_stats'
     and (column_name ~* '(ip|user|session|visitor|device|agent|referr|cookie|fingerprint|email|hash)');
  assert n = 0, 'event_stats tem uma coluna que identifica quem visitou';

  -- A fotografia diária dos contadores (0120) é um agregado do agregado, por
  -- concelho e por dia, e fica presa à mesma promessa: as mesmas colunas por
  -- lista fechada, e nem uma que identifique, pelo nome. A chave fica fora
  -- da expressão regular só porque «municipality» traz um «ip» no meio — é o
  -- nome do concelho, e é a única exceção.
  select count(*), coalesce(string_agg(column_name, ', '), '')
    into n, v_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'event_stats_snapshots'
     and column_name not in ('municipality_id', 'taken_on', 'events_counted', 'views',
                             'ticket_clicks', 'ical_downloads', 'shares', 'clicks',
                             -- Os dois contadores da 0141. Aqui são anuláveis, e é
                             -- a diferença que importa: uma fotografia anterior à
                             -- 0141 tem nulo, a diferença do mês dá nulo, e o
                             -- relatório diz «a partir de» em vez de um zero que
                             -- se lia como «ninguém carregou».
                             'source_clicks', 'directions_clicks');
  assert n = 0, format('event_stats_snapshots ganhou colunas fora dos contadores: %s', v_cols);

  select count(*) into n
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'event_stats_snapshots'
     and column_name <> 'municipality_id'
     and (column_name ~* '(ip|user|session|visitor|device|agent|referr|cookie|fingerprint|email|hash)');
  assert n = 0, 'event_stats_snapshots tem uma coluna que identifica quem visitou';

  -- E as fotografias são só do painel: RLS ligado, sem policy nenhuma.
  select count(*) into n
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'event_stats_snapshots' and c.relrowsecurity;
  assert n = 1, 'event_stats_snapshots está sem RLS';

  select count(*) into n
    from pg_policies p
   where p.schemaname = 'public'
     and p.tablename = 'event_stats_snapshots';
  assert n = 0, 'há uma policy em event_stats_snapshots: as fotografias são só do painel';

  -- A fotografia da qualidade (0144) tem de ficar tão fechada como a dos
  -- contadores. Não guarda nada de pessoal — são contagens de eventos de um
  -- catálogo público — mas é memória de operação, e uma tabela de memória
  -- aberta à chave pública é um histórico que ninguém decidiu publicar.
  select count(*) into n
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'event_quality_snapshots' and c.relrowsecurity;
  assert n = 1, 'event_quality_snapshots está sem RLS';

  select count(*) into n
    from pg_policies p
   where p.schemaname = 'public' and p.tablename = 'event_quality_snapshots';
  assert n = 0, 'há uma policy em event_quality_snapshots: as fotografias são só do painel';

  -- E não ganha uma coluna que identifique ninguém. A fotografia conta
  -- eventos; o dia em que alguém lhe acrescentar uma coluna de pessoa, a
  -- secção 4 do RGPD.md deixa de ser verdade sem ninguém a reler.
  select count(*), coalesce(string_agg(column_name, ', '), '')
    into n, v_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'event_quality_snapshots'
     and column_name not in ('municipality_id', 'taken_on', 'published', 'pending',
                             'in_catalogue', 'with_time', 'with_venue', 'with_image',
                             'with_description', 'with_price', 'with_coordinates');
  assert n = 0, format('event_quality_snapshots ganhou colunas fora das contagens: %s', v_cols);

  -- A restrição que recusa uma lacuna maior do que o catálogo, e que é o que
  -- impede o painel de mostrar uma percentagem acima de cem.
  select count(*) into n
    from pg_constraint
   where conrelid = 'public.event_quality_snapshots'::regclass
     and conname = 'event_quality_snapshots_dentro_do_catalogo';
  assert n = 1, 'a restrição que trava percentagens acima de cem nas fotografias desapareceu';

  -- A porta de quem decide (0151) é a segunda porta da casa, e o que a
  -- sustenta é ser mesmo só de leitura e mesmo só de uma região.
  --
  -- A tabela dos segredos não se lê por chave pública nenhuma. Se um dia se
  -- abrir, o `token_sha256` de cada região fica ao alcance de quem pedir — e
  -- com ele a porta do balanço de todas elas.
  select count(*) into n
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'region_report_tokens' and c.relrowsecurity;
  assert n = 1, 'region_report_tokens está sem RLS';

  select count(*) into n
    from pg_policies p
   where p.schemaname = 'public' and p.tablename = 'region_report_tokens';
  assert n = 0, 'há uma policy em region_report_tokens: os segredos são só da chave de serviço';

  -- Nenhuma das três funções do balanço é executável por quem entra pela
  -- chave anónima. A `regiao_do_token_de_balanco` é a que mais custaria:
  -- aberta, seria um oráculo a que qualquer pessoa podia perguntar se um
  -- segredo serve, tantas vezes quantas quisesse.
  select count(*), coalesce(string_agg(p.proname, ', '), '')
    into n, v_cols
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('criar_token_de_balanco', 'revogar_tokens_de_balanco',
                       'regiao_do_token_de_balanco')
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'));
  assert n = 0, format('funções do balanço abertas à chave pública: %s', v_cols);

  -- E o prazo é obrigatório, com a restrição que impede caducá-lo para trás
  -- por engano. Fechar um segredo faz-se revogando, e a revogação fica na
  -- auditoria; um `update` distraído ao prazo não é a mesma coisa.
  select count(*) into n
    from pg_constraint
   where conrelid = 'public.region_report_tokens'::regclass
     and conname = 'region_report_tokens_prazo_no_futuro';
  assert n = 1, 'a restrição do prazo dos segredos do balanço desapareceu';

  -- Os contadores são legíveis pelo público de propósito; escrevê-los, não.
  select count(*) into n
    from pg_policies p
   where p.schemaname = 'public'
     and p.tablename = 'event_stats'
     and p.cmd <> 'SELECT';
  assert n = 0, 'há uma policy de escrita em event_stats: qualquer visitante inflaciona os números';

  -- Uma linha por concelho, nem mais nem menos — seja qual for o número de
  -- regiões na base.
  select count(*) into n
    from public.event_stats_by_municipality() f
    full join public.municipalities m on m.id = f.municipality_id
   where f.municipality_id is null or m.id is null;
  assert n = 0, 'a agregação por concelho e a lista de concelhos divergem';

  -- Um código postal inventado é pior do que um campo vazio: quem o lê
  -- acredita, e quem o revê salta-o por parecer preenchido. A 0091 apanhou um
  -- «2300-000» publicado na ficha do Convento de Cristo — o sufixo -000 não é
  -- atribuído pelos CTT, é o que se escreve para preencher o campo.
  --
  -- São duas regras porque apanham coisas diferentes: a forma apanha o lixo,
  -- e o `-000` apanha o preenchimento de conveniência, que passaria na forma.
  select count(*), string_agg(name || ' (' || postal_code || ')', ', ' order by name)
    into n, v_cols
    from public.venues
   where postal_code is not null
     and (postal_code !~ '^\d{4}-\d{3}$' or postal_code ~ '-000$');
  assert n = 0, format('espaços com código postal que não existe: %s', v_cols);

  -- O telefone tem um formato porque há código que o parte: `telefones()`
  -- separa números por ` / ` e a extensão por ` (ext. …)` para montar o `tel:`.
  -- «249360150» continua a marcar, mas lê-se na página como um número de
  -- série. A 0050 fixou `+351 NNN NNN NNN`; a 0092 apanhou quatro fichas que
  -- tinham escapado. Esta asserção é para não haver uma quinta.
  --
  -- A regra valida só o começo: o que vem depois é a lista de números
  -- adicionais e a extensão, que são informação boa e têm forma própria.
  select count(*), string_agg(name || ' (' || phone || ')', ', ' order by name)
    into n, v_cols
    from public.venues
   where phone is not null
     and phone !~ '^\+351 \d{3} \d{3} \d{3}';
  assert n = 0, format('espaços com telefone fora do formato «+351 NNN NNN NNN»: %s', v_cols);

  -- Um subdomínio que deixou de existir é pior do que um campo vazio: a ficha
  -- convida a carregar e a ligação não leva a lado nenhum. A 0092 apanhou
  -- `museu.cm-ourem.pt`, retirado da zona do município algures antes de
  -- 28/08/2026 e ainda indexado nos motores de busca.
  --
  -- Só se lista o que se verificou estar morto. Isto não é um verificador de
  -- ligações — é a memória de um que já se fez, para o valor não voltar.
  select count(*), string_agg(name || ' (' || website_url || ')', ', ' order by name)
    into n, v_cols
    from public.venues
   where website_url ~* '(^|//|\.)(museu2?\.cm-ourem\.pt)(/|$)';
  assert n = 0, format('espaços a apontar para um domínio que não existe: %s', v_cols);

  -- Um horário sem a data em que foi lido afirma sobre hoje o que era verdade
  -- num dia que ninguém sabe qual é. A 0094 pôs a regra numa restrição da
  -- tabela; isto verifica que a restrição continua lá. Uma regra de honestidade
  -- que se possa largar com um `drop constraint` distraído não é uma regra.
  select count(*) into n
    from pg_constraint
   where conrelid = 'public.venues'::regclass
     and conname = 'venues_opening_hours_tem_data';
  assert n = 1, 'a restrição que obriga o horário a trazer a data em que foi lido desapareceu';

  select count(*), string_agg(name, ', ' order by name)
    into n, v_cols
    from public.venues
   where opening_hours is not null and opening_hours_checked_on is null;
  assert n = 0, format('espaços com horário sem data de leitura: %s', v_cols);

  -- A percentagem de `/admin/qualidade` e a lista de `/admin/eventos?falta=`
  -- contam a mesma população, ou a ligação entre as duas mente.
  --
  -- Desde a vaga 7 a percentagem **é** a porta para a lista. Se a vista
  -- contar uma coisa e o filtro do painel outra, quem vê 62% e carrega abre
  -- uma lista que não é a dos 38% que faltam — e não há erro nenhum a dar por
  -- isso, porque as duas consultas correm bem cada uma por si.
  --
  -- A 0143 alinhou «descrição»: a vista contava `is not null` e o filtro
  -- conta `is null or = ''`. Eram zero linhas nesse dia, e é essa a diferença
  -- que isto guarda a zero.
  select count(*) into n
    from public.events
   where is_canonical and status in ('published', 'draft')
     and description = '';
  assert n = 0,
    format('%s eventos com a descrição vazia: a vista conta-os como «com descrição» '
           'e a lista de trabalho abre-os como «sem» — ver a 0143', n);

  -- O mesmo facto, dito do lado da vista: a soma tem de bater com a contagem
  -- que o filtro abre. Apanha uma alteração à vista que a 0143 não previu.
  select (select coalesce(sum(with_description), 0) from public.event_quality_by_municipality)
       - (select count(*) from public.events
           where is_canonical and status in ('published', 'draft')
             and description is not null and description <> '')
    into n;
  assert n = 0,
    format('a vista de qualidade e a lista de trabalho divergem em %s eventos com descrição', n);

  -- E o preço, que a vaga 7 pôs a ligar pela primeira vez. `with_price` conta
  -- `is_free or price_min is not null`; o filtro conta o complemento exato.
  -- A conta só fecha porque `is_free` é `not null` desde a 0004 — se alguém
  -- lhe tirar o `not null`, os nulos desaparecem dos dois lados e ninguém dá
  -- por isso. Esta asserção é o aviso.
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public' and table_name = 'events'
     and column_name = 'is_free' and is_nullable = 'NO';
  assert n = 1,
    'events.is_free deixou de ser «not null»: o filtro «sem preço» de /admin/eventos '
    'passa a perder os eventos em que ela é nula, que a vista também não conta';
end
$$;

select 'todas as asserções passaram' as resultado;
