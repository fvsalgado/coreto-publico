# O que está aqui dentro e não é nosso

Inventário do material de terceiros que o repositório **contém e distribui**.
Não cobre o que o sítio vai buscar a outros servidores em tempo de execução.

Levantado a 15 de setembro de 2026, no commit `e578068`. O guião
`pnpm check:proveniencia` verifica que este documento e o disco continuam a
bater certo.

---

## O que está errado hoje, e é para tratar com as mãos

Isto não se resolve com um ficheiro. Está aqui em primeiro lugar de propósito.

### `instantaneos/cm-torresnovas-2026-08-29/`

Três páginas **completas** do sítio da Câmara Municipal de Torres Novas —
`agenda.html` (107 439 B), `agenda-start-10.html` (107 806 B),
`agenda-start-20.html` (94 970 B), ao todo 309 215 bytes de HTML — gravadas do
browser porque a agenda da câmara responde 503 a quem a recolhe
automaticamente. Sem cabeçalho de proveniência dentro dos ficheiros, e com o
aviso no rodapé:

```html
<span class="sp-copyright">© 2026 Município de Torres Novas</span>
```

**E, pior, o que saiu daqui para o público.** O `plano.json` da mesma pasta tem
**22 descrições de eventos copiadas literalmente** da câmara, e a migração 0061
escreveu-as para a base de dados **servida ao público**. Não é material de
calibração guardado num canto: é texto alheio republicado pelo produto.

**O que resolve:** retirar, substituir por texto próprio, ou obter autorização
escrita da câmara — de preferência através da CIM. As três coisas servem; não
fazer nenhuma, não.

---

## Marcas de terceiros

`apps/web/public/logos/medio-tejo/` — três ficheiros, com documento próprio em
[`PROVENIENCIA.md`](../apps/web/public/logos/medio-tejo/PROVENIENCIA.md).

| ficheiro                           | de quem                     | ao abrigo de quê                             |
| ---------------------------------- | --------------------------- | -------------------------------------------- |
| `cim-branco.png`, `cim-escuro.png` | CIM do Médio Tejo           | identificação da entidade promotora          |
| `cofinanciamento-centro-2030.png`  | Portugal 2030 / Centro 2030 | obrigação de publicitação do cofinanciamento |

Não são nossas e não vão na licença do resto do repositório.

## HTML capturado de sítios de terceiros

`packages/ingest/src/__fixtures__/` — 32 ficheiros, 306 833 bytes, dos quais
**29 capturados** de sítios de câmaras, juntas e teatros. Servem para calibrar
adaptadores contra páginas verdadeiras em vez de HTML imaginado.

Três são **nossos** e não de terceiros: `agenda-inventada.ics`,
`tribe-events.json` e `events-calendar.html`.

Dois **não são recortes, são páginas inteiras**: `jf-minde-agenda.html` e
`jf-minde-evento.html`, ~61 KB cada, com ~9 KB de JavaScript e ~15 KB de CSS
próprios do sítio e o rodapé de reserva de direitos lá dentro. O README da
pasta prometia blocos de evento; estes dois desmentem-no, e o README passou a
dizê-lo.

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
sob **LGPL-3.0-or-later** — copyleft fraco ao nível da biblioteca, dependência
opcional do Next.js, distribuída como binário pré-compilado de 18,6 MB que
agrega bibliotecas C de licenças diversas e **não traz um único ficheiro de
licença na pasta**. Num modelo em que o dono aloja e não distribui ao cliente,
é dúvida para o advogado — está na pergunta 9 de
[`TITULARIDADE.md`](TITULARIDADE.md).

---

## O que este documento não cobre

O conteúdo que o produto **exibe** vindo de servidores de terceiros: os cartazes
dos eventos, que são obra gráfica com autor e não estão alojados por nós. Em
produção, 219 de 296 eventos têm imagem e **nenhum tem crédito**. É problema
real e é de outra natureza — não é o que se licencia, é o que se publica —, e
está por decidir.
