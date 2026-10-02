# Autoria e direitos

Copyright © 2026 Fábio Salgado &lt;fabio@coreto.org&gt;

Este é o sítio canónico desta afirmação. Onde houver divergência entre este
ficheiro e qualquer outro texto do repositório, vale este.

## O que é reclamado

O código dos três espaços de trabalho (`apps/web`, `packages/core`,
`packages/ingest`), as migrações da base de dados, o desenho do produto, a
prosa da documentação, e a compilação de dados da agenda.

## O que não é reclamado

Isto vai dentro do repositório e **não é nosso**. O inventário com origem,
licença e data está em [`docs/TERCEIROS.md`](docs/TERCEIROS.md); aqui fica a
lista curta:

| o quê                                                   | onde                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| Marcas da CIM do Médio Tejo e do cofinanciamento        | `apps/web/public/logos/medio-tejo/`                        |
| HTML capturado de sítios de câmaras, juntas e teatros   | `packages/ingest/src/__fixtures__/`                        |
| Contornos dos concelhos, do OpenStreetMap, sob ODbL 1.0 | migrações 0035, 0060, 0105                                 |
| Fotografias do Wikimedia Commons                        | por endereço, com crédito e licença ao lado, nas migrações |
| `pnpm-lock.yaml` e o que for gerado                     | —                                                          |

## Duas licenças, e o que cada uma cobre

O repositório declara duas coisas em sítios diferentes, e nunca dissera qual
cobre o quê. Fica dito:

- **O software** — todo o código, as migrações e a documentação — é
  [AGPL-3.0-only](LICENSE). É o que o `LICENSE` e os `package.json` declaram.
- **A compilação de dados da agenda** é CC BY 4.0. É a nota que o produto já
  publica ao utilizador, no rodapé do sítio, nos feeds, no `llms.txt` e no
  ficheiro de dados: «Compilação sob CC BY 4.0. Descrições e imagens pertencem
  a quem organiza.» Cobre a **compilação** — a escolha, a organização e a
  verificação —, não o software e não os textos e cartazes de cada evento, que
  são de quem os fez.
- **A marca «Coreto»** não é coberta por nenhuma das duas. A licença dá
  direitos sobre o software, não sobre a identidade com que ele se apresenta.

## Uma reserva, escrita sem eufemismo

**Este ficheiro não torna ninguém titular de coisa nenhuma.** A titularidade
nasce da criação e da lei, não de um documento no repositório. O que aqui está
é uma posição, datada e verificável por quem a queira contestar.

O apuramento que a sustenta — como a obra foi produzida, com que números, sob
que termos e ao abrigo de que enquadramento legal — está em
o dossiê de titularidade, fora deste repositório, com as perguntas que ficam por
responder e que são para um advogado, não para um ficheiro.

A declaração legível por máquina está em [`REUSE.toml`](REUSE.toml).

---

Reporta-se ao commit `e578068`, a 15 de setembro de 2026.
