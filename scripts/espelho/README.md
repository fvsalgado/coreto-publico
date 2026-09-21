# O espelho público

O Coreto desenvolve-se aqui, num repositório privado que serve o sítio e tem
os segredos. O [`fvsalgado/coreto-publico`](https://github.com/fvsalgado/coreto-publico)
é a cópia publicada, e esta pasta é a receita que a produz.

```sh
./scripts/espelho/sincronizar.sh              # ensaia, não empurra
./scripts/espelho/sincronizar.sh --empurrar   # empurra se tudo passar
```

Precisa do `git-filter-repo` (`pip install git-filter-repo`) e do `pnpm`.

## Porque é um repositório à parte, e não um ramo

Um `push --force` tira as referências mas **não apaga os objetos**: no GitHub,
o que já lá esteve continua a poder ser puxado pelo SHA. Reescrever a história
deste repositório para o abrir deixaria o material retirado ao alcance de quem
soubesse um identificador. Um repositório novo nasce com uma história que
nunca o conteve.

Daí também que o espelho se **reconstrua do zero** de cada vez, em vez de
receber commits. É uma função deste repositório; quem lhe escrever por cima à
mão perde-o na sincronização seguinte, e é o que se quer — uma cópia que possa
divergir deixa de ser uma cópia.

## As peças

| ficheiro             | o que faz                                                   |
| -------------------- | ----------------------------------------------------------- |
| `remover.txt`        | os caminhos que saem de **todos** os commits                |
| `mailmap`            | reescreve o autor dos commits                               |
| `substituir.txt`     | reescreve o **conteúdo** dos ficheiros ao longo da história |
| `apresentavel.patch` | o que muda por o repositório passar a ser público           |
| `apagar.txt`         | os guiões que liam documentos que já não vão                |
| `mensagem.txt`       | a mensagem do commit único que fecha a limpeza              |

O `mailmap` e o `substituir.txt` são duas coisas diferentes, e a distinção
custou um susto: o `mailmap` só toca nos **metadados** dos commits. As versões
antigas do `AUTORIA.md` continuavam a trazer o endereço pessoal dentro do
ficheiro, visíveis num `git log -p`, até o `--replace-text` entrar na receita.

## O que **não** está aqui, de propósito

As guardas dos guiões de verificação. O `verificar-afirmacoes.mjs` e o
`verificar-proveniencia.mjs` leem a marca `.espelho-publico` — que o
`sincronizar.sh` escreve — e dizem «não se mediu» nas afirmações que precisam
do que vive no dossiê privado.

Já estiveram no `apresentavel.patch`, e eram **metade dele**: 230 linhas num
ficheiro de 2700 que muda todas as semanas. Um patch dessa dimensão entra em
conflito à terceira sincronização, e o remédio passa a ser pior do que a
doença. Uma condição escrita no sítio certo não entra em conflito nunca.

A marca é um ficheiro e não uma dedução, e isso também é deliberado: deduzir
«isto é o espelho porque não tem o documento X» faria qualquer apagamento por
engano passar por publicação deliberada. Sem marca, um documento em falta
reprova, como deve.

## Quando o patch deixar de aplicar

Acontece: o `apresentavel.patch` toca em onze ficheiros deste repositório, e um
deles mudar na região tocada faz o `git apply -3` recusar. O guião pára aí e
não empurra nada. Para regenerar:

1. corre o guião em ensaio e deixa-o parar;
2. aplica à mão, no clone que ele deixou, o que o patch já não consegue;
3. `git diff` desse clone contra o commit anterior, sem as secções dos dois
   guiões de verificação — essas vivem no privado.

## A auditoria

Corre sempre, antes do empurrão, e o que ela recusa não se publica. Cada linha
dela apanhou alguma coisa a sério, e é por isso que lá está:

- **nenhum endereço pessoal nos metadados nem no conteúdo de nenhum blob** — o
  `mailmap` sozinho deixava passar o segundo;
- **nenhum segredo em nenhum blob**, em toda a história;
- **nenhum `node_modules`** — o `.gitignore` diz `node_modules/` com barra, e
  uma barra só casa com diretórios: um _symlink_ com esse nome passou por baixo
  da regra e foi parar a um commit;
- **nenhum dos caminhos retirados sobrevive em commit nenhum** — verifica-se
  contra a história inteira, porque é a ponta que engana;
- **nenhuma workflow agendada** além do CodeQL, que não precisa de segredos:
  no espelho, uma workflow agendada falharia todas as noites.
