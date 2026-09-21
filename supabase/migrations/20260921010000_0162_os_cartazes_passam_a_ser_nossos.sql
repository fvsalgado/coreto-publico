-- 0162 — Os cartazes passam a ser nossos, e há como os retirar.
--
-- Até aqui o Coreto **apontava** para os cartazes: o `image_url` de um evento
-- é o endereço de uma imagem no servidor de quem a publicou, e o browser de
-- quem lê vai lá buscá-la. Isso tem três problemas de naturezas diferentes, e
-- esta migração resolve os três de uma vez porque a solução é a mesma.
--
-- **Os endereços morrem.** Num gestor de conteúdos municipal muda-se o tema,
-- arruma-se a pasta do ano, e o cartaz de julho deixa de responder. A capa
-- tipográfica foi desenhada para aguentar isso (ver `Capa.tsx`), o que quer
-- dizer que a agenda fica bonita e vazia — não que o cartaz volte.
--
-- **A agenda paga com a lentidão dos outros.** Vinte e um servidores de
-- câmaras e de juntas, alguns a responder em segundos, e um cartaz de 322 KB
-- servido a uma miniatura de 84 píxeis. Uma cópia nossa, já redimensionada, é
-- uma ordem de grandeza menos bytes e uma ligação em vez de vinte.
--
-- **E alojar é um acto que a lei vê de outra maneira.** Apontar para uma
-- imagem é ligar; guardar uma cópia é reproduzir. O `docs/TERCEIROS.md` já
-- dizia que os cartazes são obra gráfica com autor, que nenhum tem crédito, e
-- que o assunto estava «por decidir». Ficou decidido, e a decisão vem com as
-- três cautelas escritas aqui em baixo, cada uma numa peça desta migração:
-- **só de fontes oficiais**, **sempre com crédito e ligação à origem**, e
-- **com um botão que retira e faz ficar retirado**.

-- ---------------------------------------------------------------------------
-- 1. Que fontes é que podem ser copiadas.
--
-- Uma câmara municipal e uma junta de freguesia são organismos públicos: o que
-- publicam na sua agenda é comunicação institucional, e a cópia de um cartaz
-- seu com crédito e ligação à origem é o uso que essa publicação convida. Uma
-- sala privada, um santuário, um blogue ou um cineclube não são a mesma coisa,
-- e a diferença não é de tamanho — é de quem responde pela obra.
--
-- **A coluna é uma declaração e não uma inferência.** Podia ler-se o `kind` e
-- dar-se por adquirido; não se lê, porque o `kind` descreve o feitio do sítio
-- e não a natureza de quem o tem. Três das treze fontes `venue_site` estão em
-- domínios de câmara (`cineteatro.cm-tomar.pt`, `visitbarquinha.pt`) e podiam
-- muito bem ser copiáveis — mas quem diz que são é quem responde pelo sítio, a
-- olhar para elas uma a uma no painel, não um `like '%cm-%'` numa migração.
--
-- A omissão é `false`: uma fonte nova não aloja nada até alguém o dizer.
-- ---------------------------------------------------------------------------
alter table public.sources
  add column if not exists cartaz_alojavel boolean not null default false;

comment on column public.sources.cartaz_alojavel is
  'Se os cartazes desta fonte podem ser copiados para o nosso balde. Verdadeiro para câmaras e juntas — organismos públicos —, falso para tudo o resto até alguém o declarar no painel.';

-- As câmaras e as juntas ficam ligadas; as restantes ficam como estão (falso).
update public.sources
   set cartaz_alojavel = true
 where kind in ('municipal_site', 'parish_site');

-- ---------------------------------------------------------------------------
-- 2. As colunas da cópia.
--
-- **`image_url` passa a querer dizer sempre a mesma coisa: o que o sítio
-- serve.** Não é uma mudança de sentido disfarçada — é o contrário. Antes
-- `image_url` era «o endereço lá deles», e todos os leitores o usavam como
-- «o que desenhar»; as duas coisas coincidiam por falta de alternativa. Agora
-- que podem divergir, cada uma tem a sua coluna e nenhum leitor tem de saber
-- qual é qual: quem desenha lê `image_url`, quem credita lê `image_origem`.
--
-- O `update` no fim desta secção é o que faz a frase acima ser verdade para os
-- eventos que já existem: um cartaz ainda não copiado tem origem igual ao que
-- se serve, porque é o mesmo ficheiro.
--
-- **A miniatura é uma coluna e não uma convenção de nomes.** Compor
-- `${base}-400.webp` a partir do grande funcionava, e funcionava até ao dia em
-- que se mudasse a largura ou o formato: aí o sítio pedia um ficheiro que
-- nunca foi escrito e a fila de cartões ficava sem imagem nenhuma, sem um erro
-- em lado nenhum. O que existe está escrito.
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists image_origem      text,
  add column if not exists image_miniatura   text,
  add column if not exists image_guardado_em timestamptz;

comment on column public.events.image_origem is
  'O endereço de onde o cartaz veio, no servidor de quem o publicou. Igual a image_url enquanto não houver cópia nossa; é sempre este que a ficha credita e liga.';
comment on column public.events.image_miniatura is
  'A cópia pequena do cartaz (400 px), para as miniaturas das listas. Nula quando não há cópia nossa.';
comment on column public.events.image_guardado_em is
  'Quando a cópia foi feita. Nula quando o cartaz é servido da origem.';

update public.events
   set image_origem = image_url
 where image_url is not null
   and image_origem is null;

-- ---------------------------------------------------------------------------
-- 3. Retirar, e ficar retirado.
--
-- É a cautela que dá sentido às outras duas. Quem é autor de um cartaz pede
-- que se retire, e o pedido tem de ser cumprido num gesto — não numa
-- investigação sobre que processo é que o volta a pôr lá.
--
-- **E há um processo que o volta a pôr lá.** A recolha corre todas as noites,
-- lê a agenda da câmara, encontra o mesmo cartaz e escreve-o outra vez. Um
-- botão que apagasse as colunas devolvia a imagem ao sítio dentro de horas, e
-- o pedido ficava por cumprir sem ninguém dar por isso — que é a pior forma de
-- não cumprir um pedido destes.
--
-- Por isso a marca não é a ausência das colunas: é uma coluna própria, e um
-- gatilho que as esvazia **a cada escrita**. Não é a recolha que tem de se
-- lembrar; é a base que não deixa. Vale para a recolha, para a moderação
-- (`approve_submission`), para o painel e para o que ainda não foi escrito —
-- que é a parte que interessa, porque é a que ninguém se lembraria de rever.
--
-- O `image_credit` e o `image_alt` ficam onde estão: sem imagem não são
-- desenhados por ninguém, e apagá-los perdia o nome de quem é autor da obra
-- exactamente no registo que existe por causa dele.
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists image_retirado_em  timestamptz,
  add column if not exists image_retirado_por text;

comment on column public.events.image_retirado_em is
  'Quando o cartaz foi retirado a pedido. Enquanto não for nula, nenhum processo consegue voltar a pôr imagem neste evento — ver o gatilho events_cartaz_retirado.';
comment on column public.events.image_retirado_por is
  'Quem retirou, para a auditoria do painel saber de quem foi o gesto.';

create or replace function public.cartaz_retirado_fica_retirado()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.image_retirado_em is not null then
    new.image_url       := null;
    new.image_origem    := null;
    new.image_miniatura := null;
    new.image_width     := null;
    new.image_height    := null;
    new.image_guardado_em := null;
  end if;
  return new;
end;
$function$;

comment on function public.cartaz_retirado_fica_retirado() is
  'Um cartaz retirado a pedido não volta. Esvazia as colunas da imagem a cada escrita, venha ela da recolha, da moderação ou do painel.';

drop trigger if exists events_cartaz_retirado on public.events;

create trigger events_cartaz_retirado
  before insert or update on public.events
  for each row
  execute function public.cartaz_retirado_fica_retirado();

-- ---------------------------------------------------------------------------
-- 3b. As duas funções do botão.
--
-- **O painel não escreve em `events` à mão, e a regra não é decorativa.** Toda
-- a escrita de moderação passa por uma função SQL — `approve_submission`,
-- `reject_submission`, `merge_events` — porque é a função que grava a
-- auditoria. Um `update` a partir do painel era uma decisão sem rasto, e esta
-- é a decisão que mais precisa de rasto que há nesta base: alguém disse que
-- uma obra sua não devia estar aqui, e daqui a dois anos tem de ser possível
-- mostrar quando é que foi cumprido e por quem.
--
-- A `repor_cartaz` existe porque a `retirar_cartaz` é um botão, e um botão
-- carrega-se sem querer. O que ela faz é levantar a marca; a imagem só volta
-- na recolha seguinte, que vai buscá-la à fonte como sempre fez.
-- ---------------------------------------------------------------------------
create or replace function public.retirar_cartaz(
  p_event_id uuid,
  p_actor text,
  p_ip_hash text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_antes jsonb;
begin
  select jsonb_build_object('image_url', image_url, 'image_origem', image_origem,
                            'image_credit', image_credit)
    into v_antes
    from public.events where id = p_event_id;
  if v_antes is null then
    raise exception 'evento % não existe', p_event_id;
  end if;

  -- As outras colunas ficam para o gatilho. Escrevê-las aqui também era ter a
  -- regra em dois sítios, e o dia em que uma delas ganhasse uma irmã só um
  -- deles se lembraria dela.
  update public.events
     set image_retirado_em = now(),
         image_retirado_por = p_actor,
         updated_at = now()
   where id = p_event_id;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after, ip_hash)
  values (p_actor, 'retirar_cartaz', 'event', p_event_id::text, v_antes,
          jsonb_build_object('image_url', null), p_ip_hash);
end;
$function$;

create or replace function public.repor_cartaz(
  p_event_id uuid,
  p_actor text,
  p_ip_hash text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.events
     set image_retirado_em = null,
         image_retirado_por = null,
         updated_at = now()
   where id = p_event_id;

  insert into public.admin_actions (actor, action, entity_type, entity_id, before, after, ip_hash)
  values (p_actor, 'repor_cartaz', 'event', p_event_id::text, null, null, p_ip_hash);
end;
$function$;

revoke all on function public.retirar_cartaz(uuid, text, text) from public, anon, authenticated;
revoke all on function public.repor_cartaz(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. O balde já existe.
--
-- A 0008 criou o `media` — público, 5 MB por ficheiro, só imagens — e ficou
-- sem ninguém a escrever lá dentro durante cento e cinquenta e quatro
-- migrações. É este o uso para que foi feito, e não precisa de mudar nada: as
-- cópias saem em WebP, que está na lista, e uma cópia de 1200 px de um cartaz
-- municipal fica nas dezenas de kilobytes, duas ordens de grandeza abaixo do
-- limite.
--
-- A política de leitura pública (`media_public_read`, na 0008) é o que faz um
-- cartaz copiado ser servível sem chave. Escrever continua a ser só da chave
-- de serviço: escreve a recolha, e apaga o painel.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- As asserções.
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_concelho text;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'sources'
       and column_name = 'cartaz_alojavel'
  ) then
    raise exception 'a coluna cartaz_alojavel não ficou criada';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'events'
       and column_name in ('image_origem', 'image_miniatura', 'image_guardado_em',
                           'image_retirado_em', 'image_retirado_por')
    having count(*) <> 5
  ) then
    raise exception 'faltam colunas do cartaz em events';
  end if;

  /*
   * O gatilho prova-se a funcionar e não a existir.
   *
   * É o contrário do que a 0126 argumentou para o seu `check`, e de propósito:
   * ali a asserção era sobre uma definição que o Postgres cumpre por nós, e
   * montar um evento inteiro para a testar trazia mais formas de falhar por
   * engano do que de falhar a sério. Aqui o que se afirma é uma regra nossa,
   * escrita em `plpgsql`, e a única maneira de saber que ela apanha uma
   * escrita é fazer uma escrita e ver o que lá ficou.
   *
   * Corre dentro de uma transação que a migração já tem, e a linha de prova é
   * apagada no fim. O concelho é o primeiro que houver — a chave estrangeira
   * exige um que exista, e qual deles é indiferente.
   */
  select id into v_concelho from public.municipalities order by id limit 1;
  if v_concelho is null then
    raise exception 'sem concelhos para montar a prova do gatilho';
  end if;

  -- O `location_name` não é enchimento: a restrição `events_has_location` (0026)
  -- exige sítio, e a primeira versão desta prova esqueceu-o e rebentou aqui. É
  -- exactamente o custo que a 0126 nomeou ao recusar provas por comportamento —
  -- pago de boa vontade, porque o que se afirma aqui é uma regra nossa.
  v_id := gen_random_uuid();
  insert into public.events (id, slug, title, municipality_id, location_name, fingerprint,
                             image_url, image_origem, status)
  values (v_id, 'prova-do-gatilho-0162-' || substr(v_id::text, 1, 8),
          'Prova do gatilho 0162', v_concelho, 'Sítio da prova',
          'prova-0162-' || v_id::text,
          'https://exemplo.invalid/cartaz.jpg', 'https://exemplo.invalid/cartaz.jpg',
          'draft');

  update public.events
     set image_retirado_em = now(), image_retirado_por = 'prova'
   where id = v_id;

  if (select image_url from public.events where id = v_id) is not null then
    raise exception 'o gatilho não esvaziou o image_url ao retirar';
  end if;

  -- E a recolha da noite seguinte não o traz de volta.
  update public.events
     set image_url = 'https://exemplo.invalid/cartaz.jpg',
         image_miniatura = 'https://exemplo.invalid/pequeno.webp'
   where id = v_id;

  if (select image_url from public.events where id = v_id) is not null
     or (select image_miniatura from public.events where id = v_id) is not null then
    raise exception 'o gatilho deixou uma escrita posterior repor o cartaz';
  end if;

  delete from public.events where id = v_id;

  -- E as duas funções do botão existem, com a assinatura por que o painel
  -- chama. Um `rpc` com um argumento a mais devolve 404 no PostgREST, e o
  -- botão ficava a dizer «não foi possível» sem dizer porquê.
  if to_regprocedure('public.retirar_cartaz(uuid, text, text)') is null then
    raise exception 'a retirar_cartaz não ficou criada com a assinatura esperada';
  end if;
  if to_regprocedure('public.repor_cartaz(uuid, text, text)') is null then
    raise exception 'a repor_cartaz não ficou criada com a assinatura esperada';
  end if;
end
$$;
