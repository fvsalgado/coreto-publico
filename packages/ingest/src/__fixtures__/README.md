# Fixtures

Páginas verdadeiras, capturadas dos sites das câmaras e reduzidas ao mínimo.

Existem porque a alternativa é pior. Sem elas, um adaptador é testado contra
HTML escrito à mão dentro do próprio teste — o site que o autor imaginou, e não
o que a câmara publica. Foi assim que `MUNICIPAL_DEFAULTS` acabou com oito
seletores de lista e nenhum deles a casar com o que estes sites servem.

## O que está aqui, e o que não está

Não são as páginas: são os **blocos de evento** — **com duas exceções, e vale
a pena sabê-las antes de confiar nesta frase.** O `jf-minde-agenda.html` e o
`jf-minde-evento.html` são páginas inteiras, cerca de 61 KB cada, com o
JavaScript e o CSS do sítio e o rodapé de reserva de direitos lá dentro.
Entraram antes de esta regra existir e ficaram. E quatro ficheiros não têm o
cabeçalho de proveniência que se descreve abaixo.

Num dossiê de titularidade, um documento que descreve mal o que guarda faz pior
do que não existir — ver [`docs/TERCEIROS.md`](../../../../docs/TERCEIROS.md).

**Isto é material de terceiros.** O HTML aqui guardado é de quem serve as
páginas: câmaras, juntas e teatros. Está aqui para calibrar adaptadores contra
páginas verdadeiras em vez de HTML imaginado, e não vai na licença do resto do
repositório.

O extrator
(`scripts/extrair-fixtures.py`) guarda no máximo seis por fonte, com a data e o
endereço de origem em cabeçalho. Nenhuma imagem é guardada — fica o `src`, que
é o que o adaptador lê, e não o ficheiro.

Guardar obra de terceiros num repositório não é isento, e por isso guarda-se o
mínimo que serve para o fim: calibrar e testar um adaptador de interoperação
com dados que a própria câmara publica em aberto.

## Como se regeneram

Pelo workflow **Capturar fixtures**, à mão. Ele sonda, reduz, e escreve um ramo
se alguma coisa mudou.

**Uma fixture que deixa de bater certo com o site não é um problema a esconder:
é o aviso a funcionar.** Quando um teste falhar por causa disto, o que mudou
foi o site, e o adaptador precisa de atenção antes que a recolha noturna traga
lixo ou nada.

## As três que são inventadas

`agenda-inventada.ics`, `tribe-events.json` e `events-calendar.html` não são
capturas: foram escritas à mão, com eventos, sítios e endereços que não
existem. É de propósito. O que os leitores `ical`, `wordpress-events` e
`events-calendar` leem não é a marcação de um sítio — é um formato publicado
(a RFC 5545, a API do The Events Calendar, o `schema.org/Event`), igual em
todas as instalações, e é o formato que está em prova. Cada ficheiro o diz no
cabeçalho. Não há aí conteúdo de terceiros, e nunca se regeneram.
