# Como contribuir

> **Antes de tudo o resto:** este repositório é o espelho público, e é
> reconstruído de raiz a cada sincronização — o `main` é substituído com um
> `push --force`. **Nenhum PR é fundido aqui**, porque desapareceria. Abre-o na
> mesma: é lido e discutido neste repositório, e o que for aceite entra pelo
> repositório de desenvolvimento e volta por cima, com a autoria intacta. O
> `README.md` explica a relação entre os dois.

Obrigado pelo interesse. Este documento diz o que é preciso saber antes de
abrir um PR, e algumas regras que aqui não são preferências de estilo — são
invariantes que já custaram a aprender.

## O que ajuda mais

Por ordem de utilidade real, e não de dificuldade:

1. **Corrigir dados.** Um coreto que já não existe, um espaço marcado como
   provisório que alguém confirmou no terreno, uma morada errada, um concelho
   cuja agenda deixou de ser lida. Abre um issue com o que sabes; não é preciso
   escrever código nenhum.
2. **Escrever um adaptador de recolha** para uma fonte que ainda não está
   coberta. É o trabalho com melhor relação entre esforço e programação que
   passa a aparecer.
3. **Acessibilidade.** Se encontrares alguma coisa que não funciona só com o
   teclado, que o leitor de ecrã anuncia mal ou que não se lê com pouco
   contraste, isso é um defeito, não um pedido de melhoria.
4. **Código.** O resto.

## Antes de começar

Abre um issue antes de um PR grande. Não por burocracia: metade do que este
projeto faz de maneira pouco óbvia está assim por uma razão escrita algures, e
vale a pena encontrá-la antes de escrever trezentas linhas.

## Preparar a máquina

Node 22 (há um `.nvmrc`) e pnpm 10. Base de dados não é preciso: o sítio
compila e serve sem ela.

```bash
pnpm install
./scripts/instalar-hooks.sh
cp .env.example .env.local
pnpm dev
```

O segundo comando liga os hooks do repositório (`core.hooksPath` — opção do
git, sem pacote novo). O que eles fazem antes de cada commit: varrem o que vai
entrar à procura de segredos, e verificam a formatação. Correr uma vez por
clone chega; `git config --unset core.hooksPath` desliga.

O varrimento de segredos precisa do [gitleaks](https://github.com/gitleaks/gitleaks)
instalado — sem ele o hook avisa e deixa passar, e quem apanha o caso é o CI.
A diferença não é de detalhe: **o CI apanha o segredo já commitado**, e um
segredo commitado roda-se, não se apaga.

## Antes de submeter

Corre as mesmas verificações que o CI corre:

```bash
pnpm format:check
pnpm -r typecheck
pnpm lint
pnpm test
pnpm build
```

Se mexeste em `supabase/migrations/`, corre também `pnpm check:migrations` (
precisa de `psql` e de `DATABASE_URL` a apontar para um Postgres descartável).
Se mexeste em interface, corre a auditoria de acessibilidade com o sítio a
servir:

```bash
pnpm --filter @coreto/web build && pnpm --filter @coreto/web start &
pnpm check:a11y
```

## Regras que não são negociáveis

### Língua

Identificadores, nomes de ficheiro, nomes de tabelas e de colunas em **inglês**.
Texto visível, comentários, mensagens de erro e documentação em **português de
Portugal**. Não é uma preferência: é o que mantém o código legível para quem
vem de fora e o produto legível para quem o usa.

Texto visível — no sítio, num email a uma câmara, num dossiê — sai de
a bíblia da língua, que vive no dossiê privado: a frase de posicionamento, o tom, o
tratamento, as palavras proibidas e os dois glossários. O glossário interno é o
que mais importa aqui: «montra», «gaveta», «toldo» e «lambrequim» são nomes
desta casa e já escorregaram para páginas públicas, uma delas um documento
legal.

### TypeScript

Estrito, com `noUncheckedIndexedAccess` ligado. Sem `any`, sem `as any`, sem
`@ts-ignore` e sem `@ts-expect-error`. Se o tipo não fecha, o problema costuma
ser o desenho e não o compilador.

### Validação

Todo o input externo passa por Zod — o que chega por HTTP, o que vem de um site
que se recolhe, e também o que vem da própria base de dados quando foi escrito à
mão em SQL (a coluna `config` das fontes, por exemplo). Uma gralha aí tem de dar
uma mensagem legível, não um `undefined` três camadas mais à frente.

### Comentários

Só onde a intenção não é óbvia, e a explicar **porquê**, não **o quê**. Um
comentário que repete a linha seguinte é ruído que envelhece mal. Um comentário
que explica que a fórmula da impressão digital não se pode mudar poupa a alguém
um dia mau.

### Segredos

Nunca escrevas num ficheiro versionado um literal com ar de palavra-passe, de
segredo ou de chave — **nem em testes**. Gera-os em tempo de execução com
`randomBytes`. Já houve aqui um varrimento de segredos a falhar por causa de
literais de teste, e a resposta certa foi mudar os testes, não silenciar o
varrimento (ver `.gitguardian.yaml`).

### Acessibilidade

WCAG 2.1 AA é requisito. HTML semântico, `alt` em todas as imagens com
conteúdo, navegação só com teclado, contraste suficiente. Em campos de
formulário usa a classe `border-field` e nunca `border-border`, que é decorativa
e não passa o critério 1.4.11.

Os tokens de cor disponíveis são `paper`, `surface`, `ink`, `muted`, `accent`,
`accent-soft`, `accent-deep`, `on-accent`, `on-deep-muted`, `brand`,
`on-brand`, `highlight`, `border`, `field` e `focus`, mais os oito `cat-*` dos
pontos de categoria. Usa-os em vez de valores literais.

Três deles andam aos pares e não se trocam: sobre `accent-deep` (o grafite do
rodapé, da barra de baixo e do visor) escreve-se a branco ou a
`on-deep-muted`; sobre `brand` (o turquesa do cabeçalho) escreve-se a
`on-brand`, porque o branco ali dá 2,2:1; e `brand` como **texto** não se usa
de todo em fundo claro — para isso existe `accent`, que é o mesmo tom
escurecido até se ler.

### Migrações

Uma migração por ficheiro, com o padrão `AAAAMMDDHHMMSS_NNNN_descricao.sql`.
**Nunca se edita uma migração já aplicada** — corrige-se com uma nova. Seeds
idempotentes. Alterações aditivas sempre que possível: uma coluna que desaparece
parte a recolha noturna antes de partir o sítio. Ver
`supabase/migrations/README.md`.

### Dados pessoais

Se o que estás a escrever guarda, transporta ou expõe alguma coisa sobre uma
pessoa concreta — um endereço, um remetente, um identificador de visitante —
para e lê [`docs/RGPD.md`](docs/RGPD.md) antes de continuar. Uma coluna nova
nesse território não é uma coluna: é uma alteração ao registo de tratamentos.

## Commits e PRs

Mensagens de commit em português, no imperativo e a dizer o efeito («acrescenta
o feed iCal por concelho»), não o processo. Um PR por assunto. Na descrição, diz
o que muda para quem usa o sítio, não só o que muda no código.

O PR tem de passar o CI: qualidade, migrações e acessibilidade. O job de
acessibilidade não é opcional e não leva `continue-on-error` — se falhar, a
declaração publicada em `/acessibilidade` deixou de ser verdade.

Uma nota para quem contribui a partir de um fork: os jobs de qualidade e de
migrações correm sem qualquer segredo, mas o de acessibilidade precisa das
credenciais públicas de leitura da base de dados, porque sem catálogo as páginas
de concelho não existem e ficavam de fora da auditoria. Num fork esse job não
passa. Corre a auditoria localmente com os comandos acima e diz no PR que o
fizeste.

## Licença, e o que aceitas ao contribuir

Isto aqui esteve escrito só até metade. Dizia que o teu contributo **sai** sob
AGPL-3.0-only — o que é verdade e continua a ser — e não dizia nada sobre o que
**entra**. Uma licença de saída não dá ao projeto título sobre o teu trabalho,
e quem licencia fora da AGPL ou vende exceções tem de deter o copyright. É a
própria Free Software Foundation a escrevê-lo: «Only the copyright holder can
grant that.»

Nunca foi problema até hoje, e isso está apurado: em todas as referências deste
repositório existem cinco identidades de autor — duas do dono, uma da IA que o
assiste e dois robôs. **Nunca ninguém de fora contribuiu.** Não há dívida para
trás; há uma porta por fechar antes de alguém entrar por ela, e é isto.

Ao abrir um PR, declaras e aceitas três coisas:

1. **Que tens o direito de contribuir o que contribuis** — que é teu, ou que
   tens autorização de quem o fez. Se trouxeres código, texto, imagem ou dados
   de outra origem, dizes de onde vêm e sob que licença, e isso entra em
   [`docs/TERCEIROS.md`](docs/TERCEIROS.md).
2. **Que o teu contributo é distribuído sob [AGPL-3.0-only](LICENSE)**, como o
   resto do projeto.
3. **Que concedes ao titular** — Fábio Salgado, ver [`AUTORIA.md`](AUTORIA.md) —
   **uma licença perpétua, mundial, irrevogável e isenta de royalties para usar,
   modificar e relicenciar o teu contributo, incluindo sob termos diferentes da
   AGPL.** Sem isto, uma única contribuição de fora impediria para sempre o
   licenciamento comercial do produto — não por má-fé de ninguém, mas porque a
   AGPL não se pode levantar sobre trabalho alheio sem autorização de quem o
   fez.

Continuas titular do que escreveste. O ponto 3 é uma licença ao projeto, não
uma cessão: não te tira nada, e permite ao produto ser vendido a uma câmara sem
que o teu adaptador tenha de ser arrancado.

Se alguma destas três te incomodar, abre um issue antes de escrever código — é
melhor discutir isso do que descobri-lo depois de teres trabalho feito.

A redação definitiva desta cláusula está por confirmar com advogado; a pergunta
está escrita no dossiê de titularidade, §5.5 — fora deste repositório.
