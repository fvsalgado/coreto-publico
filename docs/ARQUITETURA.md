# Arquitetura

Este documento descreve o que existe e porquê. Não é um plano: é o estado do
código, com as razões que explicam as escolhas menos óbvias. Se uma delas
parecer uma limpeza por fazer, lê o parágrafo respetivo antes de a fazer —
quase todas estão assim por causa de um erro concreto.

## Onde vive o quê

Três camadas, e a fronteira entre elas nota-se de propósito.

| Pacote           | Responsabilidade                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `@coreto/core`   | Tipos, schemas Zod, normalização de texto, leitura de datas e preços, taxonomia, deduplicação |
| `@coreto/ingest` | Adaptadores por fonte, pipeline de recolha, acesso à base com chave de serviço                |
| `@coreto/web`    | Sítio público, feeds, widget, área de moderação                                               |
| `supabase/`      | O esquema completo, uma migração por ficheiro, verificado em CI contra um Postgres a sério    |

`core` não sabe da base de dados nem da web; `ingest` não sabe do sítio; um
adaptador de recolha nunca precisa de conhecer o esquema. O que atravessa as
camadas são dois tipos: `RawEvent`, em camelCase, é o que um adaptador devolve;
`EventRow`, em snake_case, é o espelho exato das colunas. O harmonizador é a
fronteira entre os dois.

Com o multi-inquilino, vale a pena dizer o que os adaptadores **não** são:
não são forks por região. Um adaptador é um plugin por **fonte ou por CMS** —
o Joomla das câmaras, a API de Ourém, o WordPress de um teatro — e serve
qualquer região que use essa tecnologia; a fonte diz de quem é
(`municipality_id`, ou `region_id` numa fonte regional), o adaptador não. A
mesma recolha noturna percorre as fontes de todas as regiões numa corrida
só, e identifica-se sempre da mesma maneira (o `USER_AGENT` fala do produto,
não de uma região).

Os que existem, pelo que leem e não por onde:

- **Genéricos, por formato** — servem qualquer região que o use, com uma
  linha em `sources` e sem código: `ical` (qualquer calendário público em
  iCalendar), `wordpress-events` (a API REST do The Events Calendar, o plugin
  de agenda do WordPress), `events-calendar` (qualquer página que embuta
  `schema.org/Event` em JSON-LD), `rss-eventos` (um feed em que o `pubDate` é
  o dia do evento), `generic-html` (seletores declarados na configuração) e
  `municipal-cms` (JSON-LD, microdados e seletores, por camadas).
- **Por CMS de uma família de sítios** — `joomla-eventbooking` (o Joomla das
  câmaras), `portal-freguesia` (o CMS partilhado pelas juntas de freguesia).
- **Por fonte** — `ourem-api`, `abrantes-proxy`, `caminhos`, `paraiso`,
  `teatro-virginia`: cada um sabe a forma exacta de um sítio, e é o último
  recurso.

Numa fonte nova experimenta-se por esta ordem. Um adaptador próprio só se
escreve quando nenhum genérico lê o que a fonte publica.

Tudo é TypeScript, incluindo a recolha. Não porque TypeScript seja melhor do que
outra coisa para ler HTML, mas porque as regras de normalização, de datas e de
deduplicação são as mesmas do lado do sítio e do lado da recolha — e ter duas
implementações de uma regra é ter, mais cedo ou mais tarde, duas regras.

## O modelo de dados, em duas frases

Um **evento** pertence sempre a um concelho e opcionalmente a um espaço, e as
suas datas vivem numa tabela de **sessões** — uma linha por ocorrência —, de
onde `date_start` e `date_end` são derivados por trigger para que as listagens
ordenem e filtrem sem juntar tabelas. Tudo o que entra passa por uma **fila de
submissões**, exceto o que a recolha traz com data legível e confiança
suficiente, que entra publicado.

---

## Invariantes

### A impressão digital tem de ser idêntica em TypeScript e em SQL

A chave de deduplicação é
`event_fingerprint(título normalizado, primeira data, concelho)`. Existe duas
vezes: em `packages/core/src/fingerprint.ts` e em `public.event_fingerprint`
(migração `0001`). E as duas são calculadas a sério — a recolha calcula-a em
TypeScript, a aprovação de submissões calcula-a em Postgres, dentro de
`approve_submission`.

**Se divergirem, o mesmo evento entra duas vezes.** Não com um erro: em
silêncio, com duas fichas quase iguais no sítio e ninguém a perceber porquê.

E já divergiram. O `unaccent` do Postgres **não** é o `String.normalize('NFKD')`
do JavaScript: o NFKD converte «ª» em «a» e «º» em «o»; o `unaccent` não lhes
toca e deixa-os cair na expressão regular, que os apaga. Como «2ª edição» e «3º
dia» são correntes em português, um NFKD ingénuo produzia chaves diferentes em
boa parte dos títulos com numeral ordinal. O `ß` diverge ao contrário.

A solução está em `packages/core/src/text.ts`: NFD (decomposição canónica, que
não mexe em «ª»/«º»), remoção das marcas combinatórias, e um mapa explícito para
as letras que o `unaccent` transcreve mas que o NFD não decompõe («ß» → «ss»,
«æ» → «ae»). Os testes têm valores de referência tirados de um Postgres real com
as migrações aplicadas, para que uma divergência futura falhe com o nome da
função na mão em vez de aparecer como duplicados no catálogo.

Há uma segunda regra, do mesmo tamanho: **a fórmula não se muda.** Mudá-la
reescreve a chave de todo o catálogo e faz entrar tudo outra vez como novo. Se um
dia for preciso outro critério, escreve-se uma função nova ao lado — nunca se
edita esta.

A impressão digital leva o **concelho** e não o espaço, ao contrário do que é
habitual num agregador de salas. Aqui metade da programação não tem espaço de
catálogo: tem um largo, um adro, um coreto, o salão de uma coletividade. Uma
chave que dependesse do espaço separava o que é a mesma coisa e não separava o
que é diferente.

### Quase-duplicados não são fundidos sozinhos

Há duas coisas diferentes, separadas de propósito em
`packages/core/src/dedup.ts`.

**Fusão automática**, dentro de uma recolha, só com prova da própria fonte —
três passagens, da prova mais forte para a mais fraca: mesma impressão digital
de conteúdo (título + concelho + descrição truncada); mesma base de slug com
títulos iguais e janelas de datas sobrepostas; mesma base de URL com data no fim
(`/evento/<slug>/2026-05-10/`). Isto é seguro porque a prova é a fonte a
repetir-se a si própria. Dentro de cada grupo, quem fica com a identidade é o
membro **mais rico**, não o primeiro: quando um CMS emite um `<slug>-1` magro
antes do `<slug>` completo, deixar o magro ganhar orfana a linha boa.

**Candidatos a duplicado**, entre fontes e entre canais — a câmara e a
filarmónica a anunciar o mesmo concerto com títulos diferentes — são
assinalados por semelhança de trigramas (limiar 0,55) dentro do mesmo concelho e
de uma janela de três dias, e **esperam decisão humana**
(`find_duplicate_candidates`, `duplicate_group_id`, e a ação `merge_events`).

A razão é simples de dizer e cara de aprender: fundir dois eventos parecidos que
afinal eram dois espetáculos **apaga programação**, que é exatamente o contrário
do que esta agenda existe para fazer. Um duplicado publicado é um incómodo; um
espetáculo desaparecido é uma pessoa à porta de uma sala fechada.

O limiar e a janela são os mesmos dos dois lados — em `dedup.ts` e em
`find_duplicate_candidates` — para que a recolha e a base assinalem o mesmo
conjunto.

### Uma recolha que rende pouco não escreve nada

**Um seletor que deixou de casar parece exatamente uma agenda vazia.** A
diferença entre as duas coisas é tudo: sem verificação, o dia em que uma câmara
mudasse de tema o sítio apagava a programação inteira do concelho e ninguém dava
por isso até alguém reclamar.

Há duas travas, em momentos diferentes.

**Antes de escrever** — `detectLayoutDrift`, em
`packages/ingest/src/pipeline.ts`. Compara o que a recolha trouxe com o que a
fonte costuma dar (`sources.baseline_item_count`) e com o mínimo declarado
(`sources.min_expected_items`). Menos de metade da linha de base, ou abaixo do
mínimo, e **não se escreve uma única linha**: a execução fica marcada como
parcial, com a contagem na nota, e alguém a vê. Linhas de base abaixo de cinco
não tiram conclusões — numa fonte com três eventos, ver um só é normal.

A linha de base é uma média móvel amortecida (`nextBaseline`, em
`packages/ingest/src/db.ts`), e **não é atualizada quando a leitura não é de
confiança**. É um detalhe que parece pequeno e não é: uma linha de base que
copiasse a última recolha habituava-se ao problema e a deteção deixava de
disparar precisamente no caso para que foi feita. A amortização também serve
para a agenda de agosto, legitimamente mais magra do que a de outubro, não
arrastar a linha de base para o mês mais fraco.

**Antes de retirar** — `reconcileDecision`, em `packages/core/src/lifecycle.ts`.
Um evento que desaparece da fonte tem de sair do Coreto: deixá-lo lá manda
alguém a uma porta fechada. Mas uma falha de rede que devolve uma lista vazia
«com sucesso» é indistinguível, do lado de cá, de uma câmara que retirou a
agenda toda — e reconciliar sobre isso apaga um concelho em três noites, sem
ninguém dar por nada. A trava: não se conta uma única falta se a recolha não
trouxe nada, ou se trouxe menos de 30% do que a fonte tinha (e a razão só se
aplica a catálogos de oito ou mais eventos, senão congelavam-se as fontes
pequenas para sempre).

A trava está em TypeScript e não em SQL de propósito, para poder ser testada sem
base de dados: é a decisão com mais consequências de toda a recolha.

Quando a reconciliação corre, `public.reconcile_source_events` (migração `0014`)
conta no máximo **uma falta por dia** — para que uma reexecução manual não
acelere a remoção —, retira ao fim de três faltas seguidas, arquiva sem
contemplações o que acabou há mais de 90 dias, e **repõe** o que voltou a
aparecer. Só repõe o que ela própria escondeu (`archived_reason` a dizê-lo): um
evento escondido por decisão de quem modera não é reposto por uma recolha, porque
essa decisão é humana e ganha. E só conta faltas a eventos de origem `scraper` —
o que entrou por email ou por formulário nunca esteve na fonte, e «não estar na
recolha» não diz nada sobre ele.

### O que uma pessoa corrigiu não volta a ser pisado

Este é o invariante que decide se há equipa de moderação ao fim de dois meses.

O problema: um editor corrige a data de um evento que a câmara publicou errada;
nessa noite a recolha corre, lê a mesma data errada e escreve-a por cima; de
manhã o erro está de volta e ninguém percebe porquê. À terceira vez, ninguém
corrige mais nada.

A resposta é a tabela `public.manual_overrides` (migração `0015`): cada campo
que uma pessoa toca fica marcado, com o valor e com quem o mudou. Marcado **o
campo**, não o evento — congelar um evento inteiro por causa de uma vírgula
corrigida seria trocar um problema por outro. A moderação chama
`lock_event_fields` ao aprovar, com os campos que o editor mudou face ao que a
fonte propunha; `locked_fields` devolve-os à recolha; `unlock_event_fields`
levanta-os. Guarda-se também o valor da fonte, para o backoffice poder mostrar «a
fonte diz X, nós dizemos Y» em vez de esconder o conflito.

Há uma segunda camada, mais grosseira e sempre ativa, em `mergeEventUpdate`
(`packages/ingest/src/db.ts`): um conjunto de campos que pertencem a quem modera
e que a recolha nunca escreve — `slug` (mudá-lo parte ligações já
partilhadas), `status` (uma recolha que o reescrevesse despublicava todas as
noites o que alguém publicou de manhã), `published_at`, `submission_id`,
`duplicate_group_id`, `is_canonical`.

### Ausência não é ordem de apagar

Regra irmã da anterior, e a mais usada de todas: **um valor preenchido nunca é
substituído por vazio**. Uma recolha em que o seletor da descrição deixou de
casar traz `null` em todas as descrições — e sem esta regra apagava, de
madrugada e sem ninguém ver, o texto de todos os eventos do concelho.

O preço é tratado em bloco e não campo a campo: se a recolha não trouxe preço
nenhum, fica o que lá estava por inteiro, `is_free` incluído. De outra maneira um
evento gratuito passava a pago — ou o contrário — só por o seletor do preço ter
mudado de nome.

A confiança sobe com revisão humana e com campos resolvidos, e **nunca desce**
por a recolha de hoje ter visto menos do que a de ontem.

Perder informação é o único erro que esta casa não sabe desfazer.

### Nunca fabricar: um intervalo não é uma lista

«10 **a** 12 de junho» e «10, 11 **e** 12 de junho» parecem-se e significam o
oposto. O primeiro é uma coisa contínua — uma exposição, uma temporada em
cartaz. O segundo são três sessões.

Um leitor de datas que expanda os dois da mesma maneira faz entrar uma exposição
anunciada «de 1 a 30 de junho» com **trinta sessões**: trinta factos que ninguém
afirmou, e um sítio a prometer alguma coisa todas as noites num sítio onde está
uma exposição aberta. Por isso um intervalo materializa-se como exatamente dois
extremos mais `is_ongoing`; uma lista dá uma sessão por dia; uma corrida diária
com mais de 45 dias degrada para os extremos.

A mesma disciplina vale para a taxonomia: catálogo fechado, aliases explícitos,
e as etiquetas sem correspondência registadas em `unknown_tags` para revisão.
**Nunca se adivinha uma categoria** — uma categoria errada é pior do que
nenhuma, porque desvia o evento do filtro onde as pessoas o procuram.

### Um espaço só casa se ficar no concelho do evento

Há nomes que se repetem na região: há um «Cine-Teatro São Pedro» em Abrantes e
outro em Alcanena, e a tabela `venue_aliases` tem uma linha por nome e nenhuma
coluna de concelho. Um cartaz que diga só o nome curto casava sempre com o
primeiro que ali tivesse ficado — e foi o que aconteceu a um espetáculo do
CAMINHOS feito em Alcanena e guardado no teatro de Abrantes, com a morada e as
coordenadas de setenta quilómetros ao lado.

`resolveVenueInMunicipality` (`packages/core/src/harmonize.ts`) recusa a
ligação quando o concelho do espaço é conhecido e não é o do evento. O nome
fica por resolver, vai para `unresolved_venues` e espera por um alias — que é
o que essa fila existe para ser. Não se aplica ao `venueId` que um adaptador
escreva à mão, porque há programação em rede que atravessa concelhos de
propósito; nem quando o concelho do espaço é desconhecido, porque silêncio não
é contradição. A migração `0064` deixa uma asserção a segurar a regra: nenhum
evento pode estar num espaço de outro concelho.

### Disciplina de colunas

Nenhuma listagem faz `select('*')`. As consultas selecionam listas de colunas
declaradas em `apps/web/src/lib/queries/fields.ts`: `CARD_EVENT_FIELDS` para
cartões, `DETAIL_EVENT_FIELDS` para a ficha. Um cartão precisa de dezasseis
colunas; a tabela tem mais de sessenta, várias delas texto longo e uma delas o
`raw` original da fonte, que é JSON aos megabytes.

Puxar tudo em listas de cem custa largura de banda a cada visita, memória no
servidor e nada em troca. A mesma regra vale do lado da recolha: `STORED_KEYS`
em `packages/ingest/src/db.ts` é a lista do que se lê antes de escrever, e é
curta pela mesma razão.

Isto não é micro-otimização. É a diferença entre uma página que abre num
telemóvel com rede fraca no meio do Médio Tejo e uma que não abre.

### O caderno de trabalho não vai para a rua

Três tabelas têm duas colunas de texto com nomes parecidos e destinos
opostos. `description` é o que o público lê; `notes` é o caderno de quem
trabalha nelas — proveniência, força da prova, homónimos a evitar, a data em
que se mudou de ideias, o estado HTTP da última avaria. As listas de colunas
em `fields.ts` selecionam sempre a primeira e nunca a segunda.

Não é uma preocupação teórica: aconteceu duas vezes. Os espaços publicaram
sondagens de fontes como se fossem a apresentação da sala, e os coretos
publicaram o levantamento inteiro — «é a prova mais frágil», «atenção ao
homónimo», o endereço da pesquisa do site municipal — na página que uma
pessoa abre para saber se há coreto na sua terra. Das duas vezes foi preciso
alguém dar por ela numa página já publicada.

As fontes (`0048`, `0049`) levaram a mesma separação e mais uma tranca: a
tabela `sources` guarda o cabeçalho `Origin` combinado com a câmara de
Abrantes, por isso a chave pública não lê a tabela — lê nove colunas dela, por
`grant select (...)`. Há duas asserções a segurar isto: uma em
`scripts/schema-checks.sql`, que falha se aparecer uma décima coluna
concedida, e um teste em `fields.test.ts`, que compara a lista pedida pelo
código com a lista concedida pela migração. Pedir uma coluna a mais não
devolve essa coluna a null: faz o PostgREST recusar o pedido inteiro, e a
página fica vazia sem dizer porquê — em produção, e só em produção.

### O telemóvel tem a sua própria navegação, e não é a de secretária encolhida

**A navegação principal é uma barra ao fundo do ecrã no telemóvel e o
cabeçalho a partir do tablet — a mesma lista, em `src/lib/navegacao.ts`, lida
pelos dois.** O cabeçalho tinha sido desenhado para uma linha larga; num
telemóvel partia-se em três e ocupava trezentos dos oitocentos e quarenta
pixéis do primeiro ecrã.

Cinco destinos, com ícone **e** rótulo (um ícone sozinho obriga a adivinhar), a
página actual assinalada com `aria-current="page"`, e uma almofada de
`env(safe-area-inset-bottom)` para os rótulos não ficarem debaixo da faixa do
indicador de início do iPhone — o que exige `viewportFit: 'cover'` no layout,
sem o qual esse `env()` responde sempre zero. A barra não se esconde ao
deslizar: devolveria uns pixéis e tiraria a referência.

O que decide qual dos cinco acende é lógica testada, não uma comparação de
texto no meio do JSX: `/agendamento` começa por `/agenda` e não é a agenda, e
o `/` engana-se sozinho porque qualquer endereço começa por uma barra.

O par disto é `.ct-recolhivel` em `globals.css`: um bloco recolhido no
telemóvel e aberto a partir do tablet, **sem uma linha de JavaScript** — duas
regras de CSS para as duas gerações de `<details>` (o `::details-content` dos
browsers novos e o filho escondido pelo agente do utilizador nos antigos).
É o que salva a agenda: o formulário de filtros ocupava dois ecrãs e empurrava
o primeiro evento para os mil e quatrocentos pixéis.

### Degradação graciosa

**Cada dependência externa degrada para inação; uma falha nunca derruba uma
página.** É o princípio que faz o sítio compilar e servir sem base de dados e
sem chaves — em CI, num fork, num arranque a frio.

Na prática:

- Sem credenciais do Supabase, as listagens ficam vazias e as páginas
  continuam a servir. `pnpm build` passa sem um único segredo, e o job
  `qualidade` do CI existe para isso não se perder.
- Sem `REVALIDATE_SECRET`, a rota de invalidação responde 503 e a cache expira
  sozinha ao fim de uma hora. As alterações demoram mais a aparecer; nada
  rebenta.
- Sem chave de extração, sem orçamento ou com a quota do remetente esgotada, a
  submissão fica guardada em bruto e alguém trata dela à mão. Foi assim que
  isto se fez por inteiro antes de haver extração automática, e continua a ser
  um caminho que funciona.
- Sem chave do PostHog, não sai daqui um único pedido para lá — e a política de
  privacidade acompanha, porque a página lê a configuração real em vez de
  descrever um tratamento que não existe.
- Se o limitador de tráfego estiver em baixo, deixa passar. A alternativa era
  uma falha de infraestrutura transformar-se numa negação de serviço feita por
  nós.
- Uma fonte que rebente não leva as outras atrás; um evento que rebente ao ser
  gravado não leva atrás os que faltam da mesma fonte.

A exceção é deliberada e uma só: sem `INBOUND_MAIL_SECRET`, o webhook de email
recusa tudo com 503 em vez de degradar. Um endereço que cria submissões sem
verificar quem as manda é uma fila de moderação inundada, e uma fila inundada é
uma fila que ninguém lê.

### Um componente de cliente paga tudo o que importa — e um barril importa tudo

O que um ficheiro com `'use client'` importa viaja para o navegador por
inteiro, incluindo o que esse componente não usa e o que vem de segunda mão.
A regra prática que daí sai: **um ficheiro partilhado pelos dois lados não pode
importar um barril.**

Custou duas vezes, das duas por Zod:

- O `analytics/kinds.ts` tinha ao lado os _schemas_ do corpo do pedido a
  `POST /api/stats`. Como o `AnalyticsProvider` está no layout da região, a
  biblioteca ia para o navegador em **todas** as páginas do sítio, para o
  cliente usar quatro constantes. Os _schemas_ mudaram-se para `request.ts`,
  que só o servidor importa, e o `kinds.ts` ficou sem uma única dependência.
- O `lib/format.ts` importava `isoWeekday` e `weekdayName` do barril
  `@coreto/core`, que reexporta os `schemas`. Como o `Destaques` e o
  `MapaDosEventos` são componentes de cliente e ambos formatam datas, a mesma
  biblioteca viajava outra vez — 214 kB na entrada e no mapa. O `dates.ts` não
  tem dependências e passou a ser importado directamente, por
  `@coreto/core/dates`; é para isso que o `@coreto/core` declara subcaminhos no
  `exports` além do barril.

O segundo só se descobriu porque o `scripts/check-desempenho.mjs` reprovou uma
subida de versão do Zod. O defeito era anterior e valia quase o mesmo com a
versão antiga: o tecto tinha sido calibrado por cima dele. **Um orçamento
semeado de uma medição real herda o que essa medição já tinha de errado** — e
é a razão pela qual os tectos das quatro rotas comuns são hoje o mesmo número.

---

## Cache e invalidação

Quase tudo o que é público é servido de cache com etiquetas
(`unstable_cache` + `revalidateTag`), com uma hora de validade. O cliente
Supabase do servidor **não lê cookies de propósito**: é isso que permite servir
praticamente tudo estático.

Quando a recolha ou a moderação mudam alguma coisa, chamam
`POST /api/revalidate` com as etiquetas a purgar, e a alteração aparece em
segundos em vez de esperar pela hora. O segredo é comparado em tempo constante.
Sem segredo configurado, a rota devolve 503 — e o sítio limita-se a ser uma hora
mais lento a reagir.

## Os três canais de entrada

| Canal    | Como entra                                        | Vai direto ao catálogo?                 |
| -------- | ------------------------------------------------- | --------------------------------------- |
| Recolha  | `pnpm ingest`, uma vez por noite                  | Sim, com data legível e confiança ≥ 0,5 |
| Email    | `POST /api/intake/email`, com assinatura HMAC     | Nunca                                   |
| Programa | `POST /api/submissions`, com limitação de tráfego | Nunca                                   |

O canal de email tem uma regra própria que vale a pena conhecer: **a submissão
é criada antes de se tentar ler seja o que for**, e **a um webhook válido
responde-se sempre 200**. Uma extração que rebente a meio custa um campo por
preencher; um email perdido custa a programação de um mês e ninguém a manda
outra vez. E um 500 faz o fornecedor voltar a entregar o mesmo email, e outra
vez, até haver três submissões iguais na fila.

## Isolamento e saúde da recolha

Cada execução fica registada em `source_runs`, com o que aconteceu e sobretudo
com o que não aconteceu. A distinção mais útil é entre **pedidos que tiveram
resposta** e **pedidos que nem isso** (`http_responses` / `http_failures`): é o
que separa «esta sala não tem nada em cartaz» de «este site está em baixo».

Ao fim de cinco falhas seguidas, o **disjuntor** de uma fonte abre por 24 horas
e ela deixa de ser tentada. Não é castigo: é impedir que um site em baixo consuma
a janela de recolha toda e enterre os erros das outras fontes no ruído. A fonte
saltada não conta como sucesso nem como falha.

Uma execução é «parcial», e não «falhada», quando não trouxe nada ou quando
recusou mais do que escreveu. Um ou dois itens sem data por agenda municipal é
normal e vai para a fila; se isso bastasse para marcar a execução como parcial, o
painel de saúde ficava permanentemente amarelo e ninguém lhe dava atenção no dia
em que interessasse.

### Os cartazes medem-se uma vez, e não todas as noites

A recolha, além da página da agenda, vai buscar os **primeiros 32 KB** de cada
cartaz para lhe ler as medidas do cabeçalho (`medidasDaImagem`, em
`@coreto/core`). É o que permite à ficha de evento declarar `width` e `height`
no `<img>` e o navegador reservar a caixa exacta antes de a imagem existir — o
salto de layout que o cartaz provocava era a única métrica de desempenho desta
casa que se **sentia** em vez de se medir. Hoje mede-se: o
`scripts/check-desempenho.mjs` reprova acima de 0,02 de salto acumulado, ao
lado dos tectos de peso e das fronteiras (sem terceiros, sem nada guardado no
equipamento, e o essencial a funcionar sem JavaScript).

**O que trava o custo é o endereço, não o evento.** Um cartaz cujo endereço não
mudou e que já tem medidas guardadas não é pedido outra vez: numa noite em que
os cartazes de um concelho não mudem, não sai daqui um único pedido. O que
continua a ser pedido todas as noites é o punhado de cartazes que nunca se
conseguem ler — um SVG, um servidor em baixo há semanas —, e isso é deliberado:
é o mesmo caminho por onde um cartaz recupera quando o servidor voltar. Guardar
«já se tentou» era uma coluna a mais para poupar meia dúzia de pedidos.

O pedido passa pelo mesmo estrangulamento por hospedeiro que o resto da recolha
— um de cada vez, com intervalo —, porque do outro lado é a mesma máquina que
serve os balcões online do concelho. E não repete: um cartaz que não responda
hoje mede-se amanhã, e a página entretanto reserva a vitrine à antiga.

## Segurança e fronteiras

- A **chave de serviço** passa por cima do RLS e por isso vive apenas em
  processos que nunca são expostos: a recolha e o servidor. O que chega ao
  navegador é a chave pública de leitura, e o que ela lê é o que o RLS deixa.
- O que a chave pública lê de `public.events` são **duas** políticas, e não
  uma. A `events_public_read` (migração `0007`) deixa passar
  `status = 'published'`. A `events_past_series_read` (migração `0064`) deixa
  passar um evento arquivado quando as três condições valem ao mesmo tempo:
  `archived_reason = 'passado'`, `series_id is not null` e `is_canonical`. É o
  que torna legível a edição passada de um ciclo — o CAMINHOS de 2026 vive
  disto — sem abrir o resto do arquivo: o que foi arquivado por estar errado,
  por ser duplicado ou por ter desaparecido da fonte continua invisível.
- **Todas as escritas de moderação passam por funções SQL** — `approve_submission`,
  `reject_submission`, `merge_events` — que são o único caminho de escrita e as
  que registam a auditoria. Uma escrita fora delas seria uma ação sem rasto, e o
  registo de quem fez o quê é metade do que torna esta fila confiável.
- As funções `security definer` têm o `execute` **revogado** a `public`, `anon` e
  `authenticated`, e concedido só a `service_role`.
- A área interna não tem contas: uma palavra-passe em hash scrypt e um cookie de
  sessão assinado com HMAC. O middleware é a primeira barreira, mas **cada ação
  volta a exigir a sessão do seu lado** — uma verificação só à porta é uma
  verificação que um dia alguém contorna com um pedido direto.
- A CSP é restritiva com uma exceção: `script-src` leva `'unsafe-inline'`,
  porque a hidratação do App Router arranca com scripts inline e um _nonce_
  por pedido obrigava a renderização dinâmica (o porquê inteiro está em
  `apps/web/next.config.ts`). `frame-ancestors 'none'` em todo o lado exceto
  no widget, que existe para viver dentro de um `iframe` alheio.

## Acessibilidade e privacidade como requisitos de arquitetura

Não são camadas por cima: são restrições que moldam o desenho.

A conformidade **WCAG 2.1 AA** é o que o Decreto-Lei n.º 83/2018 exige a um
serviço público. Está verificada em CI, sobre o sítio a correr, em duas larguras,
sobre as páginas fixas e uma ficha de cada tipo (`scripts/check-a11y.mjs`). A
verificação não é opcional: se falhar, a declaração publicada em
`/acessibilidade` deixou de ser verdade.

Do lado da **privacidade**, a decisão estruturante está na migração `0017`: os
contadores por evento guardam quatro números por evento e mais nada — sem linha
por visita, sem identificador de sessão, sem IP nem sequer em hash. O que se pode
responder é «esta ficha foi aberta 412 vezes»; o que nunca se pode responder é
«por quem». As asserções do CI recusam qualquer coluna nova nessa tabela, pelo
nome e por lista. Ver [`RGPD.md`](RGPD.md).

## O que ainda não está ligado

Nada. A secção esteve aqui com três coisas por fazer e ficou vazia a 5 de
setembro de 2026: a recolha passou a consultar os bloqueios manuais, a
reconciliação passou a ser invocada pelo pipeline, e as duas versões de
`detectLayoutDrift` e `nextBaseline` passaram a ser uma só em `@coreto/core`.

Fica o título, e não se apaga: é aqui que se escreve o que é trabalho por
fazer, para não passar por decisão. Vazio é uma afirmação — e das três, duas
estiveram escritas aqui como pendentes muito depois de terem sido feitas.

## O GitHub é um ponto único de falha, e é uma decisão

O código, a recolha noturna, a vigilância de hora a hora, as cópias de
segurança e o ensaio de restauro correm todos em GitHub Actions. Isso quer
dizer uma coisa que convém estar escrita em vez de se descobrir num mau dia:
**se o GitHub estiver em baixo, o Coreto pode estar em baixo sem ninguém
saber** — é o mesmo fornecedor a alojar o que corre e o que vigia o que corre.

Fica assim de propósito, e as razões são três. A vigilância não é o que mantém
o sítio de pé: o Vercel serve páginas em cache sem depender de nada disto, e
uma agenda que serve a programação de ontem durante duas horas não é uma
avaria. As cópias de segurança saem para armazenamento fora do fornecedor
(`docs/BACKUPS.md`), que é onde o ponto único de falha custaria a sério. E um
segundo executor — uma máquina, um cron noutro sítio — é uma segunda coisa para
manter, com as suas próprias chaves e o seu próprio dia em que ninguém reparou
que parou.

O que reduz o risco sem pagar esse preço é um vigia externo e independente
(UptimeRobot, Better Stack) a bater à porta de cinco em cinco minutos: fica
fora do GitHub, e é o que fecha a única parte que dói — o sítio em baixo sem
sinal. Está por fazer, e é configuração e não código.

## O que ficou de fora, de propósito

- **Contas de utilizador e backoffice por município.** As câmaras e os espaços
  consomem (widget, feeds) e submetem (email, formulário); não gerem. Menos
  código e muito menos superfície de ataque. Acrescenta-se quando houver mais do
  que uma pessoa a moderar — não antes.
- **Redis ou serviço externo para limitação de tráfego.** Uma tabela e uma função
  que incrementa e devolve a contagem numa só ida chegam para o que isto tem de
  aguentar. Uma dependência a menos é uma coisa a menos para falhar às três da
  manhã.
- **Bilingue.** O Coreto serve onze concelhos portugueses; é `pt-PT` e mais
  nada. Se um dia houver inglês, entra como rota, não como reescrita.
- **Tabela de opções de funcionalidade.** Com um operador, é cerimónia.
