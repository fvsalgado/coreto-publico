# De onde vieram estes ficheiros

Marcas de terceiros, usadas ao abrigo da obrigação de publicitação do
cofinanciamento e da identificação da entidade promotora. Não são nossas e
não vão na licença do resto do repositório.

| Ficheiro                          | Origem                                                                                                                                                     | Recolhido  | Tratamento                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `cim-medio-tejo-branco.png`       | `https://mediotejo.pt/images/logos/logo02.png` — versão a branco publicada pela própria CIM do Médio Tejo                                                  | 2026-08-29 | Margens transparentes aparadas; reduzido de 2027 px para 608 px de largura; guardado em `LA`     |
| `cim-medio-tejo-escuro.png`       | O mesmo ficheiro acima, com a tinta trocada                                                                                                                | 2026-08-29 | Canal de tinta posto a `0x18` — a mesma máscara alfa, pixel a pixel; nada da marca se redesenhou |
| `cofinanciamento-centro-2030.png` | `https://mediotejo.pt/images/2026/06/22/centro2030_barracofinan_ass_white_2600px.png` — barra de cofinanciamento a branco publicada pela CIM do Médio Tejo | 2026-08-29 | Margens transparentes aparadas; reduzido de 2356 px para 1200 px de largura; guardado em `LA`    |

## Porque é a barra do CENTRO 2030 e não a do CENTRO 2020

A referência que deu origem a esta secção do rodapé foi a tira de
`agenda.mediotejo.pt`, a agenda intermunicipal anterior, que traz
CENTRO 2020 / PORTUGAL 2020 / União Europeia. A CIM ainda publica essa tira
na sua página de entrada (`/images/banners/pocentro_pt2020_feder_bom1.png`),
ao lado da tira do CENTRO 2030 — mas há três razões para usar a nova:

1. **É o quadro em vigor.** O Portugal 2020 encerrou; um projeto que nasce em
   2026 é cofinanciado ao abrigo do Portugal 2030.
2. **O bloco de marca está completo.** A tira de 2020 que a CIM publica traz a
   bandeira sem a menção «União Europeia» nem o nome do fundo, que o
   Regulamento de Execução (UE) n.º 821/2014 exigia; a de 2030 traz
   «Cofinanciado pela União Europeia», tal como o artigo 47.º do Regulamento
   (UE) 2021/1060 pede.
3. **Existe a branco.** O bloco onde a tira assenta — a caixa «Quem faz e quem
   financia», em `/informacoes` — é grafite nos dois temas. A versão a branco
   assenta nele sem caixa nem plinto — e a bandeira em monocromático é uma
   das formas que as normas da União preveem justamente para fundos escuros.

## Porque há uma versão escura da marca da CIM

O cabeçalho do sítio deixou de ser grafite e passou a ser o turquesa da própria
CIM. A marca a branco sobre esse turquesa dá 2,2:1 — está lá e não se vê. A
forma da marca vive toda no canal alfa (foi verificado: **todos** os 37 897
pixéis com alfa acima de zero têm a tinta exactamente em 255), por isso a
versão escura é a mesma máscara com o canal de tinta posto a `0x18`. Não é um
redesenho nem uma reinterpretação: é o mesmo ficheiro, noutra tinta — a
reprodução a uma cor que as normas de qualquer marca institucional preveem. A
tinta escolhida é o cinzento equivalente ao grafite que a própria CIM publica
(`--headings_color: #181921`), que é a mesma tinta com que o resto do cabeçalho
está escrito.

Se a CIM publicar uma versão escura oficial, troca-se o ficheiro e mais nada:
o caminho está escrito uma vez só — na linha da região (`public.regions`,
colunas `logo_*`), desde que a identidade passou a vir da base.

## Porque é que estão em `LA` e não em `RGBA`

A tinta destes ficheiros é uma só — branco puro, ou o grafite da versão escura
—, verificada pixel a pixel antes da conversão e não por suposição. Três canais
a dizer sempre a mesma coisa são três canais a ocupar espaço; em tons de
cinzento mais alfa não se perde um pixel de qualidade e o conjunto cai para
cerca de metade. O cabeçalho é servido em todas as páginas do sítio.

São os mesmos três logótipos que a referência mostra — CENTRO, PORTUGAL,
União Europeia —, na forma atual. Se a operação que financia o Coreto for
mesmo do quadro anterior, troca-se o ficheiro e a linha que o nomeia em
`apps/web/app/informacoes/page.tsx`.

## Onde é que estes ficheiros aparecem

O logótipo da CIM aparece em dois sítios, e os dois vão buscar o caminho, as
medidas e o nome ao mesmo lado — a linha da região (`public.regions`, lida por
`apps/web/src/lib/regiao.ts`). A tinta é que muda, porque o fundo muda:

- na assinatura «Promovido por» do cabeçalho, em todas as páginas, sobre o
  turquesa do toldo — `cim-medio-tejo-escuro.png`, o `sobreMarca`;
- no bloco «Quem faz e quem financia», em `/informacoes`, sobre o grafite —
  `cim-medio-tejo-branco.png`, o `sobreGrafite`.

A tira do cofinanciamento aparece só no segundo. A razão está escrita ao lado
do bloco, em `apps/web/app/informacoes/page.tsx`.
