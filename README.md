# Coreto

Agendas culturais regionais, **um só código e uma região por domínio**. O
Coreto reúne num só sítio a programação de uma região — a que está dispersa
pelos sites municipais, por dezenas de equipamentos e por cartazes no Facebook
das coletividades — e devolve-a em formatos que qualquer um pode voltar a
usar: página, RSS, calendário, JSON e um widget para embeber.

A primeira região é o **Médio Tejo** (os onze concelhos da sua Comunidade
Intermunicipal); uma região nova entra por configuração, sem um único commit
— o processo está em [`docs/NOVA-CIM.md`](docs/NOVA-CIM.md) e o CI prova-o em
todas as corridas, fazendo nascer uma região fictícia e verificando que nem
uma letra se mistura entre as duas.

## O que é e para quem

Três públicos, por esta ordem:

- **Quem vive ou passa pela região** e quer saber o que há para fazer no fim
  de semana sem abrir onze separadores. É para esta pessoa que o sítio é
  rápido, funciona sem JavaScript para o essencial e não pede consentimento
  nenhum para nada.
- **Quem programa** — câmaras, equipamentos, filarmónicas, ranchos,
  cineclubes, comissões de festas. Podem submeter por formulário ou por email,
  e podem embeber a agenda do seu concelho no seu próprio sítio sem conta e
  sem chave.
- **Quem decide** — cada CIM e as suas autarquias, que passam a ter uma visão
  do território inteiro e números de interesse por evento que não identificam
  ninguém.

O que o Coreto **não** é: uma bilheteira, uma rede social, um sítio de
opinião, nem um negócio de dados.

## A primeira região: os onze concelhos do Médio Tejo

São onze, e todos do distrito de Santarém. A CIM do Médio Tejo — que é também a
NUTS III com o mesmo nome — integrou treze até **23 de dezembro de 2022**, data
em que a **Sertã** e **Vila de Rei** saíram para a CIM da Beira Baixa.

Este projeto teve os treze durante algum tempo, por um raciocínio que vale a
pena deixar escrito porque **parecia** ter todos os passos verdadeiros: as
listas tinham onze, a Sertã e Vila de Rei são de Castelo Branco — logo teriam
caído por distração ao confundir-se a CIM com o distrito. Não tinham. E o passo
do meio, o que dava força ao resto, era falso: o distrito de Santarém tem vinte
e um concelhos e não onze. As listas de onze estavam certas, e foram corrigidas
para errado por uma verificação que ninguém fez.

Uma contagem não é uma verificação.

| Concelho               | Distrito | Identificador            |
| ---------------------- | -------- | ------------------------ |
| Abrantes               | Santarém | `abrantes`               |
| Alcanena               | Santarém | `alcanena`               |
| Constância             | Santarém | `constancia`             |
| Entroncamento          | Santarém | `entroncamento`          |
| Ferreira do Zêzere     | Santarém | `ferreira-do-zezere`     |
| Mação                  | Santarém | `macao`                  |
| Ourém                  | Santarém | `ourem`                  |
| Sardoal                | Santarém | `sardoal`                |
| Tomar                  | Santarém | `tomar`                  |
| Torres Novas           | Santarém | `torres-novas`           |
| Vila Nova da Barquinha | Santarém | `vila-nova-da-barquinha` |

O identificador é o que aparece nos endereços (`/concelho/tomar`,
`/feed/tomar.xml`) e é a chave em toda a base de dados. As asserções do CI
exigem os onze **pelo nome e pelo distrito**, e nomeiam a Sertã e Vila de Rei
como concelhos que não podem estar — porque uma contagem sozinha volta a ser
corrigida para o número errado por quem só olhe para ela.

## Arquitetura

| Camada              | Tecnologia                                                                |
| ------------------- | ------------------------------------------------------------------------- |
| Sítio e moderação   | Next.js 16 (App Router), React 19, Tailwind CSS 4                         |
| Lógica partilhada   | `@coreto/core` — TypeScript estrito, Zod como única dependência           |
| Recolha             | `@coreto/ingest` — TypeScript, corre no GitHub Actions                    |
| Base de dados       | PostgreSQL 16 no Supabase, com RLS e funções `security definer`           |
| Anexos              | Supabase Storage, balde privado                                           |
| Alojamento          | Vercel, região `cdg1` (Paris) — a mais próxima de Portugal e dentro da UE |
| Medição             | contadores agregados em Postgres; PostHog na UE, sem cookies, facultativo |
| Integração contínua | GitHub Actions                                                            |

| Documento                                                            | Para quê                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)                         | As decisões e os invariantes, com a razão de cada um                                        |
| [`docs/OPERACAO.md`](docs/OPERACAO.md)                               | O que fazer quando alguma coisa corre mal                                                   |
| [`docs/BACKUPS.md`](docs/BACKUPS.md)                                 | Cópias de segurança e como testar um restauro                                               |
| [`docs/RGPD.md`](docs/RGPD.md)                                       | Registo de tratamento de dados pessoais                                                     |
| [`docs/INDICADORES.md`](docs/INDICADORES.md)                         | O que cada número do relatório mensal conta, e o que não conta                              |
| [`docs/O-QUE-FALTA-AO-DONO.md`](docs/O-QUE-FALTA-AO-DONO.md)         | O que não se resolve com código: avarias do lado de lá e decisões                           |
| [`docs/LICENCIAR.md`](docs/LICENCIAR.md)                             | O que falta para isto poder ser contratado, e o que disso é do dono                         |
| [`docs/AUDITORIA-LICENCIAMENTO.md`](docs/AUDITORIA-LICENCIAMENTO.md) | A auditoria de 19/09/2026: o que trava, o que falta, e o plano de fecho por semanas         |
| [`docs/PLANO-DE-IMPLEMENTACAO.md`](docs/PLANO-DE-IMPLEMENTACAO.md)   | O plano que sai da auditoria: fases, ficheiros, verificações, e as decisões do dono         |
| [`docs/CONFIGURACAO-DO-DONO.md`](docs/CONFIGURACAO-DO-DONO.md)       | As caixas que só quem tem as contas liga: Deploy Hook, ntfy, Better Stack, PostHog, o balde |
| [`docs/SELO.md`](docs/SELO.md)                                       | O Selo de Usabilidade e Acessibilidade: o que a máquina já prova e o que não                |
| [`docs/EMAIL.md`](docs/EMAIL.md)                                     | O canal de entrada por email                                                                |
| [`docs/DNS.md`](docs/DNS.md)                                         | DNS, certificados e autenticação de email (CAA, DNSSEC, SPF, DKIM, DMARC)                   |
| [`docs/NOVA-CIM.md`](docs/NOVA-CIM.md)                               | Como nasce uma região nova — sem um commit                                                  |
| [`docs/regioes/medio-tejo/`](docs/regioes/medio-tejo/)               | Os levantamentos do Médio Tejo (fontes, coretos, plano de dados, inventário)                |

Porque é que a impressão digital tem de ser idêntica dos dois lados, porque é
que quase-duplicados não se fundem sozinhos, o que impede uma recolha vazia de
apagar um concelho: está tudo em
[`docs/ARQUITETURA.md`](docs/ARQUITETURA.md), e vale a pena ler antes de mexer
na recolha.

## Estrutura de pastas

```
apps/web/              O sítio público e a área de moderação
  app/                 Rotas do App Router
  src/components/      Componentes de interface
  src/lib/             Consultas, feeds, submissões, moderação, ambiente
packages/core/         Tipos, schemas, normalização, datas, preços, deduplicação
packages/ingest/       Adaptadores de recolha, pipeline, cliente da base de dados
supabase/migrations/   Esquema completo, uma migração por ficheiro
scripts/               Verificação de migrações, auditoria de acessibilidade,
                       aprovisionamento, geração do hash da palavra-passe
docs/                  Arquitetura, operação, cópias de segurança, RGPD, email
.github/workflows/     CI, recolha noturna, CodeQL, cópias de segurança
```

## Como correr localmente

Precisas de Node 22 (há um `.nvmrc`) e de pnpm 10. Base de dados não precisas:
o sítio compila e serve sem ela, com as listagens vazias.

```bash
pnpm install
cp .env.example .env.local   # preenche o que quiseres; nada é obrigatório
pnpm dev                     # http://localhost:3000
```

Com base de dados, aplica o esquema a um projeto Supabase novo:

```bash
DATABASE_URL='postgresql://postgres.<ref>:<palavra-passe>@<host>:5432/postgres' \
  ./scripts/provision-supabase.sh
```

O script recusa-se a correr sobre uma base que já tenha tabelas, aplica todas
as migrações por ordem, corre as asserções e imprime no fim os segredos que
faltam gerar. Esses valores aparecem uma vez, na consola, e não ficam guardados
em lado nenhum.

Para entrar na área de moderação, gera o hash da palavra-passe e põe-no em
`ADMIN_PASSWORD_HASH`:

```bash
printf '%s' 'a-palavra-passe' | pnpm dlx tsx scripts/hash-password.ts
```

## Como correr as verificações

São as mesmas que o CI corre, pela mesma ordem:

```bash
pnpm format:check   # Prettier, sem escrever (pnpm format escreve)
pnpm -r typecheck   # tsc --noEmit em todos os pacotes
pnpm lint           # ESLint no sítio, tsc nos pacotes
pnpm test           # Vitest, com TZ=UTC
pnpm build          # compila os pacotes e o sítio
```

Nenhuma delas precisa de segredos, e é de propósito: se alguma passar a
precisar, o que se partiu foi a degradação graciosa.

Há mais duas, que precisam de coisas de fora:

```bash
# Aplica todas as migrações a um Postgres limpo e corre as asserções sobre
# esquema e seeds. Precisa de psql e de DATABASE_URL.
pnpm check:migrations

# Auditoria WCAG 2.1 AA com axe-core, em duas larguras, sobre o sítio a correr.
pnpm --filter @coreto/web build && pnpm --filter @coreto/web start &
pnpm check:a11y

# A mesma auditoria sobre a área interna, que o CI não vê por precisar de
# sessão. Corre à mão, contra um `next start` com a porta de administração
# configurada — o cabeçalho de scripts/check-a11y-admin.mjs diz como.
BASE_URL=http://localhost:3998 ADMIN_PASSWORD=… pnpm check:a11y:admin
```

A auditoria de acessibilidade não é um extra: a conformidade WCAG 2.1 AA é o
que o Decreto-Lei n.º 83/2018 exige a um serviço público, e é ela que sustenta
a declaração publicada em `/acessibilidade`.

## Como entra a programação

Três canais, todos a desaguar no mesmo sítio.

1. **Recolha automática.** Uma vez por noite, um adaptador por fonte lê a
   agenda de cada câmara e de cada equipamento. O que vem com data legível e
   confiança suficiente entra publicado; o resto vai para a fila. Uma fonte que
   rebente não leva as outras atrás, e uma recolha que renda muito abaixo do
   costume não escreve nada — porque um seletor que deixou de casar parece
   exatamente uma agenda vazia.
2. **Email.** Uma coletividade manda uma mensagem com o cartaz em anexo. O
   material fica guardado tal como chegou, tenta-se dele extrair os campos do
   evento e a submissão entra na fila. Este canal **nunca** escreve
   diretamente no catálogo.
3. **Envio por programa**, em `POST /api/submissions`, com limitação de
   tráfego e sem conta — para quem já tem os eventos noutro sistema. Houve
   aqui um formulário público e saiu, por decisão do editor: quem programa
   cultura já vive no email e já lá tem o cartaz, e um formulário obrigava a
   partir essa informação por campos de que só nós precisamos. O que
   `/submeter` é hoje está escrito lá — como enviar, e o que serve.

A **moderação** vive em `/admin`: uma fila com o motivo à vista, candidatos a
duplicado assinalados por semelhança, e um registo de auditoria de quem fez o
quê. Todas as escritas passam por funções SQL (`approve_submission`,
`reject_submission`, `merge_events`) — não há caminho de escrita sem rasto.

Um campo corrigido por uma pessoa fica bloqueado: a recolha da noite seguinte
atualiza tudo o resto e não lhe toca. É o que evita que um erro corrigido
reapareça de manhã, que é o que faz uma equipa desistir de moderar.

## Widget e feeds

Tudo aberto, sem chave e sem registo. A documentação viva está em `/levar`.

```html
<script
  src="https://coreto.mediotejo.pt/widget/embed.js"
  data-concelho="tomar"
  data-limit="5"
  async
></script>
```

| Endereço                 | O que devolve                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `/feed.xml`              | RSS 2.0 com os próximos 50 eventos                                                                   |
| `/feed/<concelho>.xml`   | O mesmo, de um concelho                                                                              |
| `/agenda.ics`            | Calendário iCalendar com os próximos 100 eventos                                                     |
| `/agenda/<concelho>.ics` | O mesmo, de um concelho                                                                              |
| `/api/events`            | JSON com filtros, CORS aberto                                                                        |
| `/widget/<concelho>`     | A caixa embebível, com CSP própria (é o que corre dentro do iframe; quem a monta faz-lo em `/levar`) |

O widget existe para uma câmara o adotar numa tarde: uma linha colada no seu
sítio e acabou. O script está escrito para nunca partir a página de quem o
embebeu — se falhar, o pior que acontece é não aparecer.

## Como contribuir

Lê [`CONTRIBUTING.md`](CONTRIBUTING.md). Em resumo: identificadores e nomes de
ficheiro em inglês, texto visível e comentários em português de Portugal,
TypeScript estrito sem `any`, Zod em todo o input externo, e acessibilidade
WCAG 2.1 AA como requisito e não como intenção.

Falhas de segurança não se reportam por issue: ver
[`SECURITY.md`](SECURITY.md).

A contribuição mais valiosa não é código. É corrigir um coreto que já não
existe, confirmar um espaço marcado como provisório, ou dizer-nos que a agenda
de um concelho deixou de ser lida.

## Autoria e licença

O Coreto é desenvolvido por **Fábio Salgado**
([salgado.zip](https://salgado.zip)). Cada região é promovida pela sua
Comunidade Intermunicipal — no Médio Tejo, pela CIM do Médio Tejo —, e essa
distinção está escrita no próprio sítio, em `/informacoes`.

**O software é [AGPL-3.0-only](LICENSE).** Quem correr uma versão modificada
deste sítio, ainda que só a sirva pela rede, tem de disponibilizar o código
correspondente. É uma escolha deliberada: isto foi feito para um território e
paga-se a devolver ao comum.

**A compilação de dados da agenda é CC BY 4.0**, e é o que o produto já diz ao
utilizador no rodapé, nos feeds e no ficheiro de dados. **A marca «Coreto» não
é coberta por nenhuma das duas.**

Aqui esteve escrito que ele «é o titular dos direitos», sem reserva nenhuma, e
esta secção era uma segunda fonte de verdade sobre um assunto que não pode ter
duas. Passou a haver uma só, e mais honesta: **[`AUTORIA.md`](AUTORIA.md)** diz
o que é reclamado e o que não é; **[`docs/TERCEIROS.md`](docs/TERCEIROS.md)**
inventaria o que está aqui dentro e é de outros; e
**[`docs/TITULARIDADE.md`](docs/TITULARIDADE.md)** mostra como esta obra foi
produzida — com assistência de IA, com os números medidos e as fontes citadas —
e o que fica por confirmar com um advogado.
