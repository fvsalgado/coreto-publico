# O que está aqui dentro e não é nosso

Inventário do material de terceiros que o repositório **contém e distribui**.
Não cobre o que o sítio vai buscar a outros servidores em tempo de execução.

Levantado a 15 de setembro de 2026, no commit `e578068`. O guião
`pnpm check:proveniencia` verifica que este documento e o disco continuam a
bater certo.

---

## O que estava errado, e como se resolveu

Este documento abria, desde o primeiro dia, com uma secção intitulada «o que
está errado hoje, e é para tratar com as mãos». Fechou a 21 de setembro de
2026, no dia em que o repositório passou a público — porque o que lá estava
não podia ser publicado.

**`instantaneos/cm-torresnovas-2026-08-29/` saiu.** Eram três páginas
completas do sítio da Câmara Municipal de Torres Novas, 309 215 bytes de HTML
com o `© 2026 Município de Torres Novas` no rodapé, mais um `plano.json` com
22 descrições de eventos copiadas à letra. Saiu da árvore **e da história**:
a reescrita de 21/09/2026 passou os 107 commits e não deixou cópia nenhuma.

**Os dois _fixtures_ que eram páginas inteiras foram reduzidos.** O
`jf-minde-agenda.html` e o `jf-minde-evento.html` tinham ~61 KB cada, com o
JavaScript, o CSS e o rodapé de reserva de direitos do sítio lá dentro. Passam
a 5 KB e 1 KB — os blocos de evento e as duas ligações por que o adaptador
confirma que a página é a agenda, que é o que a regra da pasta sempre disse.
Os 29 testes do adaptador continuam a passar; foram eles que provaram que o
recorte ficou fiel.

**O que fica por decidir não é isto.** As descrições de Torres Novas que a
migração 0061 escreveu para a base servida ao público continuam lá, ao abrigo
da autorização que o titular declarou a 15 de setembro de 2026. Essa
declaração, e a pergunta ao advogado sobre o que ela cobre, vivem no dossiê
privado.

## Marcas de terceiros

`apps/web/public/logos/medio-tejo/` — três ficheiros, com documento próprio em
[`PROVENIENCIA.md`](../apps/web/public/logos/medio-tejo/PROVENIENCIA.md).

| ficheiro                           | de quem                     | ao abrigo de quê                             |
| ---------------------------------- | --------------------------- | -------------------------------------------- |
| `cim-branco.png`, `cim-escuro.png` | CIM do Médio Tejo           | identificação da entidade promotora          |
| `cofinanciamento-centro-2030.png`  | Portugal 2030 / Centro 2030 | obrigação de publicitação do cofinanciamento |

Não são nossas e não vão na licença do resto do repositório.

## HTML capturado de sítios de terceiros

`packages/ingest/src/__fixtures__/` — 33 ficheiros, 190 720 bytes, dos quais
**30 capturados** de sítios de câmaras, juntas e teatros. Servem para calibrar
adaptadores contra páginas verdadeiras em vez de HTML imaginado.

Três são **nossos** e não de terceiros: `agenda-inventada.ics`,
`tribe-events.json` e `events-calendar.html`.

**Já não há excepções.** O `jf-minde-agenda.html` e o `jf-minde-evento.html`
eram páginas inteiras, ~61 KB cada; a 21 de setembro de 2026 foram reduzidos
aos blocos de evento, como o README da pasta sempre prometeu. Todos os
ficheiros capturados são agora recortes.

Quatro ficheiros não têm o cabeçalho de proveniência que a pasta exige.

## Dados geográficos

Migrações **0035**, **0060** e **0105** versionam os contornos dos onze
concelhos derivados do **OpenStreetMap** (18 080 bytes de coordenadas na 0105),
simplificados e confrontados com a Carta Administrativa Oficial de Portugal.

Licença **ODbL 1.0**, com a atribuição escrita no cabeçalho da migração e
repetida no comentário da coluna da base de dados — `© contribuidores do
OpenStreetMap`.

`apps/web/public/produto/mapa.webp` é uma captura da demonstração, e contém
impressa na própria imagem a atribuição `OpenFreeMap © OpenMapTiles Data from
OpenStreetMap`.

## Fotografias

**Nenhuma fotografia de coreto ou de espaço está versionada.** As 13 imagens
que o git rastreia são marca própria, ícones ou capturas de ecrã, mais os três
logótipos acima.

As fotografias de terceiros entram **por endereço**: 60 URLs distintos de
`Special:FilePath` do Wikimedia Commons, nas migrações, cada um com o crédito e
a licença guardados ao lado — e uma asserção SQL faz a migração falhar se
houver imagem sem crédito.

## Tipos de letra

Nenhum está versionado. A letra própria do produto é a **Fraunces**,
descarregada na compilação por `next/font/google` e servida do domínio do
sítio. Distribuída sob **SIL Open Font License 1.1**.

## Dependências

`pnpm-lock.yaml` fixa as versões; as licenças são as de cada pacote.

A única dependência de produção com copyleft é **`@img/sharp-libvips-linux-x64`**,
sob **LGPL-3.0-or-later** — copyleft fraco ao nível da biblioteca, distribuída
como binário pré-compilado de 18,6 MB que agrega bibliotecas C de licenças
diversas e **não traz um único ficheiro de licença na pasta**. Num modelo em
que o dono aloja e não distribui ao cliente, é dúvida para o advogado — está na
pergunta 9 de [`TITULARIDADE.md`](TITULARIDADE.md).

**A 21 de setembro de 2026 deixou de ser só uma dependência opcional do
Next.js: o `sharp` passou a ser dependência directa de `@coreto/ingest`**, que
é quem redimensiona os cartazes copiados. A licença é a mesma e a pergunta ao
advogado é a mesma; o que muda é que já não se pode responder «vem por
arrastamento e pode sair quando o Next.js quiser». Corre na recolha, numa
máquina do GitHub, e nada do binário chega ao browser de quem lê.

---

## Os cartazes dos eventos

**Até 21 de setembro de 2026 este documento dizia que os cartazes não estavam
alojados por nós e que o assunto estava «por decidir». Ficou decidido: passam a
estar.** O que muda de natureza é o acto — apontar para uma imagem é ligar,
guardar uma cópia é reproduzir —, e é por isso que a decisão veio com três
cautelas e não com um botão.

**Só de fontes oficiais.** A coluna `sources.cartaz_alojavel` (migração 0162) é
uma declaração e não uma inferência: a migração ligou-a para as câmaras
municipais e as juntas de freguesia — organismos públicos, cuja agenda é
comunicação institucional — e deixou-a desligada para tudo o resto. Das treze
fontes `venue_site`, três estão em domínios de câmara e podiam bem ser
copiáveis; quem o diz é quem responde pelo sítio, a olhar para elas uma a uma
no painel, e não um `like '%cm-%'` numa migração. Uma fonte nova não aloja nada
até alguém o declarar.

**Sempre com crédito e ligação à origem.** A coluna `image_credit` existia
desde a 0004 e estava vazia em todos os eventos; passa a ser escrita no momento
em que a cópia se faz, com o nome de quem publicou o cartaz — que é o que se
sabe com verdade, ao contrário de quem o desenhou, que não está escrito em lado
nenhum da página de onde veio. A ficha do evento mostra-o e liga ao ficheiro
original em `image_origem`, para quem quiser ir ver o resto.

**E retira-se num gesto.** `/admin/cartazes` é a mesa de pedidos: procura-se
pelo título, carrega-se em «Retirar a pedido», e a imagem sai da página e do
balde. A parte que custou a escrever é a que garante que não volta — a recolha
corre todas as noites e ia buscá-la outra vez —, e está num gatilho da base
(`events_cartaz_retirado`) que esvazia as colunas da imagem a cada escrita,
venha ela da recolha, da moderação ou do painel. Não é a recolha que se lembra:
é a base que não deixa.

O que não muda: os cartazes continuam a ser obra gráfica com autor, e as três
cautelas são mitigações e não uma licença. A pergunta de fundo — se a cópia com
crédito de comunicação institucional municipal é uso legítimo — é a mesma mesa
da revisão jurídica do dossiê, e está na
[`TITULARIDADE.md`](TITULARIDADE.md).

## O que este documento não cobre

O que o sítio vai buscar a servidores de terceiros em tempo de execução e não
guarda: os cartazes das fontes que não estão declaradas como alojáveis, que
continuam a ser servidos de casa de quem os publicou.
