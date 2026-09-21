# Registo de tratamento de dados pessoais

Este documento cumpre a função do registo das atividades de tratamento previsto
no **artigo 30.º do Regulamento (UE) 2016/679 (RGPD)** e serve, ao mesmo tempo,
de mapa técnico: para cada tratamento diz-se onde é que os dados estão
fisicamente guardados, em que tabela e em que coluna. Quem tiver de responder a
um pedido de acesso ou a uma inspeção encontra aqui o caminho.

A política de privacidade publicada em `/privacidade` é a versão
escrita para quem visita. Este documento é a versão para quem tem de responder
por ela. **As duas têm de dizer a mesma coisa** — se divergirem, é a política
publicada que vincula, e este documento que está errado.

> **A preencher pela entidade que opera o serviço — por região**
>
> Com mais de uma região na mesma instalação, este quadro existe **uma vez
> por região**: quem responde pelos dados de cada agenda é uma decisão
> contratual entre o titular do software e cada CIM, tomada fora deste
> repositório (ver `NOVA-CIM.md`). O que a região decidir escreve-se nas
> colunas `data_controller_*` da sua linha em `regions` — sem elas, o sítio
> apresenta a CIM promotora — e a página `/privacidade` de cada domínio mostra
> o responsável **dessa** região.
>
> **As seis linhas deste quadro cabem todas na tabela desde a 0158**, e
> editam-se no painel, na ficha da região: nome, endereço, NIF, morada,
> contacto para direitos, encarregado de proteção de dados e contacto dele.
> Até lá só cabiam as duas primeiras, e por isso este quadro era um pedido sem
> sítio para onde ir. O que ficar em branco não aparece na política publicada —
> o que não se sabe não se mostra.
>
> | Campo                                     | Valor |
> | ----------------------------------------- | ----- |
> | Região                                    |       |
> | Responsável pelo tratamento (nome e NIPC) |       |
> | Morada e contactos                        |       |
> | Encarregado de proteção de dados (EPD)    |       |
> | Contacto do EPD                           |       |
> | Data da última revisão deste registo      |       |
>
> Se o responsável for uma autoridade ou organismo público — como uma
> comunidade intermunicipal ou um município —, a designação de encarregado de
> proteção de dados é **obrigatória** (artigo 37.º, n.º 1, alínea a), do RGPD) e
> o contacto tem de ser publicado e comunicado à CNPD.

Contacto para o exercício de direitos, tal como publicado no sítio: o email
da região (`regions.contact_email`) — no Médio Tejo, **coreto@mediotejo.pt**.

---

## 1. Panorama

O Coreto é uma agenda cultural. Os dados pessoais que trata são poucos, e todos
eles acessórios àquilo que faz: **publicar programação cultural**, que não é
dado pessoal de ninguém.

Há três origens, e uma quarta que se decidiu não existir:

1. **Quem submete um evento** — por email (o formulário foi retirado a
   2026-08-28; o canal público é o endereço da região — no Médio Tejo,
   coreto@mediotejo.pt). A submissão fica marcada com a região a que o email
   foi dirigido (`submissions.region_id`). É aqui que está
   praticamente tudo: um endereço de email, facultativamente um nome e uma
   organização, e o que a pessoa escrever na mensagem.
2. **Quem visita** — apenas um hash com sal do endereço IP, e apenas para travar
   abuso. O endereço nunca é escrito em claro em lado nenhum.
3. **Quem modera** — o registo de auditoria, que guarda quem fez o quê.
4. **Quem consulta a agenda: nada.** Os contadores por evento foram desenhados
   de propósito para não conterem nada de ninguém — ver a secção 4.

Não há contas de utilizador, não há perfis, não há cookies de rastreio, não há
publicidade e não há decisões automatizadas com efeitos jurídicos ou
significativos sobre ninguém (artigo 22.º do RGPD): tudo o que é submetido é
revisto por uma pessoa antes de ser publicado. A única coisa que fica gravada
no equipamento de quem visita é a escolha de tema claro ou escuro, e só se a
pessoa carregar no botão — ver a secção 2.6.

---

## 2. Atividades de tratamento

### 2.1 Submissão de eventos (email; historicamente também formulário)

| Elemento                | Conteúdo                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalidade**          | Receber, avaliar e publicar programação cultural proposta pelo público                                                                                                                                                                                                                |
| **Titulares**           | Quem submete um evento — agentes culturais, associações, autarquias, particulares                                                                                                                                                                                                     |
| **Categorias de dados** | Endereço de email (obrigatório); nome e organização (facultativos); conteúdo da submissão; no canal por formulário, hash com sal do endereço IP e agente do utilizador — **no canal por email não**, porque o pedido chega do fornecedor de webhooks e não de quem escreveu (ver 2.2) |
| **Base legal**          | Artigo 6.º, n.º 1, alínea b) — diligências pré-contratuais a pedido do titular. Quem envia um evento pede que o tratemos e publiquemos                                                                                                                                                |
| **Onde está**           | `public.submissions` (colunas `sender_email`, `sender_name`, `sender_organisation`, `payload`, `ip_hash`, `user_agent`)                                                                                                                                                               |
| **Conservação**         | 24 meses após a data do evento                                                                                                                                                                                                                                                        |
| **Destinatários**       | Quem modera. O conteúdo do evento é publicado; **os dados de contacto de quem o envia não são publicados**                                                                                                                                                                            |

### 2.2 Submissão de eventos por email

Igual à anterior quanto à finalidade, à base legal e à conservação. As
diferenças, todas relevantes para o registo:

| Elemento                  | Conteúdo                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Categorias adicionais** | Assunto, corpo da mensagem e cabeçalhos originais; anexos (cartazes, PDF de agenda), que podem conter nomes, fotografias e contactos de terceiros                                                                                                 |
| **Onde está**             | `public.submissions` (`raw_text`, `raw_subject`, `raw_headers`); `public.submission_attachments` (metadados) e o balde privado do Storage (os ficheiros); `public.sender_quotas` (endereço do remetente **em claro**, como chave da quota diária) |
| **Nota**                  | O material em bruto é conservado de propósito: quando a leitura automática falha, é o que permite a uma pessoa tratar a submissão à mão                                                                                                           |
| **O que não se guarda**   | O hash do endereço IP e o agente do utilizador: neste canal o pedido chega do fornecedor de webhooks, e o endereço e o agente eram os dele. Guardaram-se até 19 de setembro de 2026 como se fossem de quem escreveu; deixaram de se guardar       |

**Dados de terceiros nos anexos.** Um cartaz pode trazer o nome e o contacto de
quem organiza ou de quem atua. Esses dados não foram fornecidos pelo próprio,
mas por quem submete; aplica-se o artigo 14.º do RGPD, e o dever de informação
considera-se cumprido pela publicação da política de privacidade, na medida em
que os dados constam de material que o próprio remetente destinou a divulgação
pública (artigo 14.º, n.º 5, alínea b), quando a informação individual se revele
impossível ou desproporcionada). Um pedido de oposição de um terceiro é tratado
como qualquer outro — ver a secção 6.

Ver também [`EMAIL.md`](EMAIL.md) para o funcionamento deste canal.

### 2.3 Limitação de tráfego e prevenção de abuso

| Elemento                | Conteúdo                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalidade**          | Impedir que alguém entupa a fila de moderação ou o formulário de entrada; limitar tentativas de acesso à área interna                                                                       |
| **Titulares**           | Quem submete, e quem tenta entrar na área de moderação                                                                                                                                      |
| **Categorias de dados** | Hash SHA-256 com sal do endereço IP, truncado a 32 caracteres. **O endereço em si nunca é escrito**                                                                                         |
| **Base legal**          | Artigo 6.º, n.º 1, alínea f) — interesse legítimo em manter o serviço de pé e a fila utilizável. O impacto foi ponderado, e é essa ponderação que explica o hash com sal em vez do endereço |
| **Onde está**           | `public.rate_limits` (coluna `bucket`, na forma `<rota>:<hash>`); `public.submissions.ip_hash`; `public.admin_actions.ip_hash`                                                              |
| **Conservação**         | 2 dias em `rate_limits`; nas outras tabelas, o prazo da tabela onde vive                                                                                                                    |

O sal vem da variável `IP_HASH_SALT` e é conhecido apenas pelo servidor.
Trocá-lo torna irreversível qualquer correspondência com hashes anteriores.

### 2.4 Moderação e auditoria

| Elemento                | Conteúdo                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalidade**          | Saber quem publicou, alterou, fundiu ou rejeitou o quê — e quem **leu** a fila; sem isto não há responsabilização nem forma de desfazer um erro |
| **Titulares**           | Quem modera (uma ou poucas pessoas)                                                                                                             |
| **Categorias de dados** | Identificação de quem age; ação; estado antes e depois (que pode incluir o email de quem submeteu); hash do IP; data e hora                     |
| **Base legal**          | Artigo 6.º, n.º 1, alínea f), em articulação com o princípio da responsabilidade do artigo 5.º, n.º 2                                           |
| **Onde está**           | `public.admin_actions`                                                                                                                          |
| **Conservação**         | 24 meses (ver a secção 5 — prazo a implementar)                                                                                                 |

**Desde 21 de setembro de 2026, o registo também guarda acessos, e não só
decisões.** Abrir a fila de moderação ou uma submissão escreve uma linha com a
ação prefixada por `leitura.`, quem a fez e o que pediu — o recorte da fila, ou
o identificador da submissão. Não se guarda o conteúdo lido: seria copiar
dados pessoais para uma segunda tabela, com um prazo de conservação mais longo
do que o deles. Serve para uma pergunta que antes não tinha resposta possível —
com uma sessão comprometida, **o que é que foi visto?** — e a página
`/admin/auditoria` separa as duas coisas, para o registo de decisões continuar
legível.

A área interna não tem contas: tem uma palavra-passe, guardada em hash scrypt
com sal, e um cookie de sessão assinado. Não há dados de autenticação de
pessoas identificadas. O cookie é assinado com o segredo **e** com o hash da
palavra-passe em vigor: trocar a palavra-passe fecha, no mesmo instante, todas
as sessões abertas.

### 2.5 Estatísticas de utilização do sítio

**Só existe se `NEXT_PUBLIC_POSTHOG_KEY` estiver configurada.** Sem chave, o
PostHog não é carregado e não sai do sítio um único pedido para lá — e a página
de privacidade acompanha, porque lê a configuração real em vez de descrever um
tratamento que não existe.

| Elemento                | Conteúdo                                                                                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalidade**          | Perceber que páginas são usadas                                                                                                                                                                                                                                       |
| **Categorias de dados** | Páginas vistas, a região a que a página pertence, e um identificador efémero gerado pela ferramenta                                                                                                                                                                   |
| **Base legal**          | Artigo 6.º, n.º 1, alínea f) — interesse legítimo                                                                                                                                                                                                                     |
| **Configuração**        | Sem cookies e sem armazenamento local (o identificador fica em memória e desaparece com o separador); sem gravação de sessão; sem captura automática de cliques; sem inquéritos; sem criação de perfis; com descarte do endereço IP ativado nas definições do projeto |
| **Onde está**           | Servidores do PostHog na União Europeia. Nada disto é guardado na base de dados do Coreto                                                                                                                                                                             |

**O que fica de fora, e porquê.** A área interna não é medida — quem modera
passeia por lá muitas vezes ao dia, e essas passagens não são utilização do
sítio. O widget também não: corre dentro de um `iframe` no sítio de uma
câmara, e cada visita à página dela carrega-o junto; contá-lo era contar
visitas a um sítio que não é este. Nenhuma das duas exclusões é uma opção de
configuração no PostHog — estão no código, em quem monta a medição
(`components/AnalyticsProvider.tsx`) e em `capturePageView`.

**Porque não há pedido de consentimento.** O consentimento que a lei exige para
«cookies» é, na letra do **artigo 5.º da Lei n.º 41/2004**, o consentimento para
guardar informação no equipamento do utilizador ou para lá aceder. A medição
não faz nem uma coisa nem outra: não escreve cookie, nem armazenamento local,
nem qualquer identificador que sobreviva ao fechar do separador. Não havendo
operação a consentir, um aviso de cookies só serviria para dar a entender que
há.

Se alguém alterar esta configuração — ativando cookies, gravação de sessão ou
criação de perfis —, a análise acima deixa de valer e passa a ser exigível
consentimento prévio.

### 2.6 O que fica no equipamento de quem visita: duas chaves, e mais nada

Este sítio grava **duas** chaves no `localStorage` do navegador, as duas só
depois de a pessoa carregar num botão, e nenhuma delas é lida do lado do
servidor:

| chave              | escrita quando                         | conteúdo                                                                      |
| ------------------ | -------------------------------------- | ----------------------------------------------------------------------------- |
| `coreto-theme`     | alguém carrega no botão do tema        | `light` ou `dark`                                                             |
| `coreto-favoritos` | alguém carrega no coração de um evento | a lista do que guardou: identificador, título, datas, hora e sítio de cada um |

Sem essas escolhas feitas não fica lá nada: o tema vale pela preferência do
sistema operativo, que o navegador anuncia sozinho pelo `prefers-color-scheme`,
e a lista de guardados está vazia.

**Os guardados não são um tratamento de dados pessoais desta casa, e a razão
é que nunca chegam cá.** A lista é escrita e lida pelo navegador de quem a
fez, não é enviada para o servidor, não entra em nenhuma tabela, não é
sincronizada entre aparelhos e não tem conta associada — não há conta
nenhuma. Do lado do Coreto não existe forma de saber que alguém guardou o quê:
não há o que consultar, o que exportar nem o que apagar a pedido, porque o
próprio titular apaga tudo ao limpar os dados do sítio ou ao carregar em
«Esquecer tudo». É deliberado que assim seja: a alternativa — a lista guardada
do nosso lado — obrigaria a pedir um email e a criar um tratamento onde hoje
não há nenhum.

Nenhum dos valores distingue uma pessoa de outra para nós: não são lidos, não
saem do navegador, e dois visitantes com o tema escuro são indistinguíveis.

**Não pede consentimento** porque o **artigo 5.º da Lei n.º 41/2004**, a par
de exigir consentimento para guardar informação no equipamento, ressalva o
armazenamento estritamente necessário para prestar um serviço expressamente
solicitado pelo utilizador. Uma preferência de visualização que
a pessoa acabou de escolher, ela mesma, ao carregar num botão, é o exemplo de
manual dessa ressalva — é a mesma categoria da escolha de idioma. Pedir
consentimento para executar a escolha que se acabou de fazer seria perguntar
duas vezes a mesma coisa.

A mesma ressalva cobre a lista de guardados, pela mesma razão e com mais
força: guardar um evento **é** o serviço pedido, e é pedido com um clique
inequívoco num coração que diz o que faz.

**Isto muda se** qualquer uma das chaves passar a ser lida pelo servidor,
enviada para fora do navegador ou associada a outro dado — nesse momento
deixa de ser armazenamento necessário e passa a ser identificação, e esta
secção deixa de descrever a realidade.

### 2.7 Registos técnicos do alojamento

O fornecedor de alojamento mantém, como qualquer alojamento, registos técnicos
de acesso para segurança e diagnóstico, sujeitos à sua própria política de
retenção. Não são consultados nem usados por nós para analisar comportamentos.
Base legal: artigo 6.º, n.º 1, alínea f).

---

## 3. Onde estão os dados, em concreto

Para quem tiver de responder a um pedido de acesso ou de apagamento, esta é a
lista completa dos sítios onde pode estar alguma coisa de alguém:

| Tabela / balde                   | O que lá está de pessoal                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `public.submissions`             | Email, nome e organização de quem submeteu; texto original; cabeçalhos; hash do IP; agente do utilizador        |
| `public.submission_attachments`  | Metadados dos anexos e o texto deles extraído                                                                   |
| Balde privado do Storage         | Os ficheiros anexados (cartazes, PDF)                                                                           |
| `public.sender_quotas`           | Endereço de email do remetente, em claro, como chave                                                            |
| `public.rate_limits`             | Hash com sal do IP, dentro da chave do balde                                                                    |
| `public.admin_actions`           | Quem moderou, e o estado antes/depois das ações                                                                 |
| `public.events`                  | Conteúdo publicado. **Não contém dados de contacto de quem submeteu**                                           |
| `public.event_stats`             | **Nada.** Ver a secção 4                                                                                        |
| `public.event_stats_snapshots`   | **Nada.** Uma fotografia diária dos mesmos totais, por concelho. Ver a secção 4                                 |
| `public.event_quality_snapshots` | **Nada.** Uma fotografia diária de quantos eventos do catálogo público dizem a que horas, onde e com que imagem |

---

## 4. Os contadores por evento não são dados pessoais

Esta secção existe porque é a pergunta que um jurista faz primeiro.

Cada evento tem seis contadores: aberturas da ficha, cliques na bilhética,
descarregamentos do calendário, partilhas, cliques na página oficial do evento e
cliques em «como chegar». A tabela `public.event_stats` tem **sete colunas de
dados e mais nada**: o identificador do evento, os seis contadores, a soma
materializada dos três primeiros cliques e a data da última atualização.

Os dois últimos contadores entraram na migração 0141, e entraram por esta porta:
a lista fechada das `schema-checks` recusou-os até alguém — eu — ir escrever aqui
e na página publicada o que passava a ser contado. É o comportamento pretendido,
e está escrito porque a próxima pessoa a acrescentar um contador vai bater na
mesma porta.

Não há linha por visita. Não há identificador de sessão, de visitante ou de
dispositivo. Não há endereço IP — nem em claro nem em hash. Não há data e hora
de cada visita, apenas do último incremento. O que se pode responder é «esta
ficha foi aberta 412 vezes»; o que **nunca** se pode responder é «por quem».

A tabela `public.event_stats_snapshots` guarda, uma vez por dia e por
concelho, a soma destes mesmos totais — uma fotografia dos contadores, para o
relatório mensal poder dizer quanto cresceram num mês. São agregados de
agregados: continuam a não ter linha por visita, identificador nem data de
visita (só o dia em que a soma foi lida), não identificam ninguém, e as mesmas
asserções de `scripts/schema-checks.sql` recusam-lhes qualquer coluna
identificadora.

Não sendo os dados relacionáveis com uma pessoa singular identificada ou
identificável, não são dados pessoais na aceção do artigo 4.º, n.º 1, do RGPD, e
o Regulamento não se lhes aplica. Daí decorre também que não é possível
satisfazer sobre eles um pedido de acesso ou de apagamento individual —
situação expressamente prevista no **artigo 11.º do RGPD**, e que a política de
privacidade explica a quem visita.

No momento em que uma contagem é enviada, o endereço IP é usado uma única vez e
já em hash com sal, apenas para travar quem tente inflacionar os contadores. Não
fica guardado com a contagem.

**Esta escolha é defendida por código.** As asserções de
`scripts/schema-checks.sql`, que correm em cada alteração ao repositório,
recusam qualquer coluna nova em `event_stats` — por lista fechada e também pelo
nome, com uma expressão que apanha `ip`, `user`, `session`, `visitor`, `device`,
`agent`, `referrer`, `cookie`, `fingerprint`, `email` e `hash`. Acrescentar uma
coluna dessas faz falhar a verificação com uma mensagem a dizer porquê, e obriga
a rever este documento e a política publicada antes de qualquer outra coisa.

---

## 5. Prazos de conservação

| Dados                                | Prazo                            | Como é executado               |
| ------------------------------------ | -------------------------------- | ------------------------------ |
| `rate_limits` (hashes de IP)         | 2 dias                           | `public.prune_rate_limits()`   |
| Submissões e anexos                  | 24 meses após a data do evento   | `public.prune_submissions()`   |
| `sender_quotas` (email do remetente) | 24 meses após a última submissão | `public.prune_sender_quotas()` |
| `admin_actions`                      | 24 meses                         | `public.prune_admin_actions()` |
| Eventos publicados                   | Arquivo sem prazo                | `status = 'archived'`          |
| `event_stats`                        | Apagados com o evento            | `on delete cascade`            |

**Eventos publicados.** O conteúdo de um evento é conservado indefinidamente em
arquivo: a memória da programação cultural de um território tem valor próprio, e
o artigo 5.º, n.º 1, alínea e), do RGPD ressalva expressamente a conservação para
fins de arquivo de interesse público, com as garantias do artigo 89.º. Os eventos
publicados não contêm dados de contacto de quem os submeteu.

**Como é executado.** As quatro funções correm todas as noites, pela mesma
porta e com a mesma chave de serviço que a recolha — o passo «Expurgo de
retenção» de `.github/workflows/scrape.yml`. Nenhuma delas é executável por
`anon` nem por `authenticated` (migração 0133, mesma regra da 0007).

**De onde sai «após a data do evento».** O prazo das submissões não conta da
chegada: conta do fim do evento. A data está dentro do `payload`, e cada canal
grava-a numa forma diferente — a recolha aninhada em `event`, o formulário
lisa, e o email em `dates: [{ date, startTime }]`, que é o formato do
`ExtractedEvent` e não tem `date_start` nenhum. A
`public.data_do_evento_na_submissao()` lê os três; quando a submissão já deu
origem a um evento, manda a data do evento, que é a que a moderação corrigiu.
Sem data legível em sítio nenhum, o prazo conta da revisão e, em último caso,
da chegada. Uma versão desta função que soubesse ler só duas das três formas
apagaria as submissões de email 24 meses depois de **chegarem** — podendo ser
dois anos antes de o evento acontecer, e é o canal que traz `sender_email`,
`ip_hash` e `raw_text`. `scripts/verificar-afirmacoes.mjs` guarda essa costura
e a de uma função de expurgo ficar escrita sem ninguém a chamar.

> ### O que isto ainda não faz
>
> Escrito aqui de propósito, para não passar por decisão o que é trabalho por
> fazer.
>
> 1. **Os bytes dos anexos não saem por SQL.** O balde `intake` é privado e os
>    ficheiros só se apagam pela API do Storage. A `prune_submissions()` recusa-se
>    a apagar a linha de metadados enquanto o ficheiro lá estiver — apagá-la
>    deixava os bytes órfãos, sem ninguém que soubesse o caminho, que é
>    exatamente o que o expurgo existe para evitar. Essas submissões ficam
>    contadas em `retidas`, e a execução noturna fica vermelha até alguém tirar
>    os ficheiros à mão (`public.expired_intake_objects()` diz quais).
> 2. **`sender_quotas` continua a guardar o endereço em claro** como chave
>    primária enquanto a linha existe. O que mudou é que a linha deixa de ser
>    eterna; a forma como está guardada, não.
> 3. **Uma linha de `admin_actions` de uma submissão já expurgada só é anonimizada
>    se a submissão passar pelo expurgo.** Se a submissão for apagada por outra
>    via — como a 0030 apagou as dos dois concelhos que saíram da CIM —, a
>    fotografia em `before` fica com os dados de contacto até aos 24 meses da
>    própria ação.
>
> **Nada disto já aconteceu.** Medido a 13 de setembro de 2026 em produção: 49
> submissões, 0 anexos, 0 quotas de remetente, 185 ações de moderação — e **zero
> linhas fora de prazo em qualquer uma das tabelas**. A linha de dados pessoais
> mais antiga é de 2026-08-28, portanto a primeira coisa que pode caducar caduca
> a 2028-08-28. As funções vão devolver zero todas as noites durante dois anos, e
> é para isso que existem: um prazo que só se escreve no dia em que a primeira
> linha o ultrapassa é um prazo que já foi ultrapassado.

---

## 6. Direitos dos titulares

Quem submeteu um evento — ou quem apareça nos dados enviados por outra pessoa —
tem direito a:

| Direito       | Artigo | Como se satisfaz aqui                                                                                                                                     |
| ------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acesso        | 15.º   | Cópia das submissões associadas ao endereço de email indicado                                                                                             |
| Retificação   | 16.º   | Correção do que estiver errado, na submissão e no evento publicado                                                                                        |
| Apagamento    | 17.º   | Apagamento das submissões e dos anexos. O evento publicado é apreciado caso a caso: se o conteúdo não identificar ninguém, não há dados pessoais a apagar |
| Limitação     | 18.º   | Suspensão do tratamento enquanto se aprecia uma contestação                                                                                               |
| Portabilidade | 20.º   | Exportação em JSON das submissões associadas ao endereço                                                                                                  |
| Oposição      | 21.º   | Aplicável ao que se funda em interesse legítimo (secções 2.3, 2.4 e 2.5)                                                                                  |

**Como se exerce.** Basta escrever para **coreto@mediotejo.pt**. Não é exigido
formulário nem documento de identificação: pede-se apenas a confirmação de que
se tem acesso ao endereço de email em causa, o que é proporcionado e suficiente
para identificar o titular neste contexto (artigo 12.º, n.º 6).

**Prazo de resposta:** um mês a contar da receção, prorrogável por dois meses em
caso de complexidade, com informação ao titular dentro do primeiro mês (artigo
12.º, n.º 3).

**Reclamação:** junto da **Comissão Nacional de Proteção de Dados (CNPD)**, sem
prejuízo de qualquer outra via administrativa ou judicial.

**Limite.** Sobre os contadores por evento não é possível satisfazer pedidos
individuais, por não haver forma de os atribuir a ninguém (artigo 11.º). É dito
a quem visita, na política publicada, e não é uma recusa: é uma consequência de
se ter escolhido a forma que não identifica.

---

## 7. Subcontratantes e transferências

| Subcontratante                                                 | Para quê                                                                                                                                               | Onde trata                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Fornecedor da base de dados e do armazenamento (Supabase)      | Guardar tudo o que está na secção 3                                                                                                                    | Região da União Europeia, escolhida no aprovisionamento |
| Fornecedor de alojamento (Vercel)                              | Servir o sítio e correr as funções de servidor                                                                                                         | Região `cdg1` (Paris), fixada em `vercel.json`          |
| Fornecedor de estatísticas (PostHog)                           | Estatísticas de utilização, se ativadas                                                                                                                | Servidores na União Europeia                            |
| Serviço de leitura de emails (Anthropic, PBC — Estados Unidos) | Propor os campos de um evento a partir do assunto e do texto de um email, e do texto extraído dos anexos, quando `EXTRACTION_API_KEY` está configurada | Servidores fora da União Europeia — ver abaixo          |

Todos os tratamentos acima ocorrem em infraestrutura localizada na **União
Europeia**. A escolha da região não é acessória: é o que mantém este quadro
verdadeiro, e um balde ou uma região fora da UE, ainda que por engano, acrescenta
uma transferência internacional a este registo.

**Sobre as entidades.** Os fornecedores indicados são sociedades constituídas
fora do Espaço Económico Europeu, ainda que os dados sejam tratados em
infraestrutura na UE. O acesso remoto das respetivas equipas de apoio técnico
constitui transferência para país terceiro e tem de estar coberto pelas
**cláusulas contratuais-tipo** aprovadas pela Comissão Europeia (Decisão de
Execução (UE) 2021/914) e pelas medidas suplementares que resultem da avaliação
de impacto da transferência. Os contratos de subcontratação (artigo 28.º, n.º 3)
devem ser conservados junto deste registo.

> **Serviço de leitura de emails — inscrito a 19 de setembro de 2026**
>
> Enquanto `EXTRACTION_API_KEY` não estiver configurada, este tratamento **não
> existe**: as submissões ficam em bruto e são lidas por uma pessoa. Com a
> chave configurada — e está, por decisão do responsável nesse dia —, o que
> sai é o **assunto e o texto do email, e o texto extraído dos anexos**, para
> a API da Anthropic, PBC (Estados Unidos). O ponto de entrada no código é
> `apps/web/src/lib/intake/extract.ts`.
>
> **O que não sai, por desenho** (`minimizarTexto`, no mesmo ficheiro, com
> testes): o endereço de quem enviou nunca faz parte do pedido; as mensagens
> citadas (a partir de «Em … escreveu:» ou da primeira linha com `>`) e a
> assinatura (a partir do separador `-- ` ou de «Enviado do meu …») são
> cortadas antes; e os endereços de email que restem no corpo são trocados
> por `[email]`. O que resta pode ainda conter dados pessoais que o próprio
> remetente pôs no corpo do anúncio — o nome de quem atua, um telefone de
> contacto —, e é por isso que o fornecedor está inscrito como subcontratante
> e a política de privacidade o nomeia.
>
> **O que fica do lado do responsável pelo tratamento, e não do código:** o
> contrato de subcontratação do artigo 28.º com o fornecedor e as cláusulas
> contratuais-tipo para a transferência (os termos comerciais da Anthropic
> incluem um _Data Processing Addendum_ com as cláusulas 2021/914, que tem
> de ser aceite na conta e guardado junto deste registo); a confirmação de
> que o conteúdo enviado **não é usado para treinar modelos** nos termos
> desses termos comerciais; e o prazo de retenção do lado do fornecedor,
> a inscrever aqui quando confirmado. Enquanto estas três linhas não
> estiverem preenchidas, o registo está incompleto e diz que está.

---

## 8. Medidas de segurança (artigo 32.º)

- **Segurança do transporte:** HTTPS obrigatório, com HSTS e pré-carregamento.
- **Minimização por desenho:** o endereço IP nunca é escrito em claro; os
  contadores por evento não têm nenhuma coluna que identifique; as listagens
  selecionam colunas declaradas e nunca `select *`.
- **Segregação de credenciais:** a chave que chega ao navegador só lê o que as
  políticas de segurança ao nível da linha (RLS) permitem; a chave de serviço,
  que passa por cima do RLS, vive apenas em processos que nunca são expostos.
- **Controlo de acessos:** a área de moderação está atrás de palavra-passe em
  hash scrypt com sal, com cookie de sessão assinado (`httpOnly`,
  `sameSite=strict`) e limitação de tentativas por IP. O cookie é assinado com
  o segredo e com o hash da palavra-passe, e por isso **trocar a palavra-passe
  revoga as sessões abertas** — o que, até 21 de setembro de 2026, o utilitário
  prometia e não acontecia.
- **Rasto de auditoria:** todas as escritas de moderação passam por funções SQL
  que registam o antes e o depois. Não há caminho de escrita sem rasto — e,
  desde 21 de setembro de 2026, também não há caminho de **leitura** da fila
  sem rasto: as duas consultas que trazem dados pessoais registam o acesso
  antes de ler, e recusam ler se não conseguirem registá-lo.
- **Anexos em balde privado**, com o tipo real apurado pela assinatura do
  ficheiro e não pelo que o remetente declara, e tecto de 10 MB por anexo.
- **Verificação de origem** no canal de email, por assinatura HMAC. Sem segredo
  configurado, o canal recusa tudo.
- **Política de segurança de conteúdo** restritiva — com uma exceção, dita
  por ser exceção: `script-src` leva `'unsafe-inline'`, porque a hidratação do
  App Router arranca com scripts inline e a alternativa (um _nonce_ por
  pedido) obriga a renderização dinâmica e deitava fora o ISR. O raciocínio
  está em `apps/web/next.config.ts` e no `SECURITY.md`.
- **Verificação contínua:** varrimento de segredos em cada alteração, sem
  exceções silenciosas; análise estática de segurança (CodeQL) **quando o
  repositório for público** — em repositório privado não corre, e o
  `codeql.yml` explica porquê; auditoria automática de
  acessibilidade; e asserções sobre o esquema que impedem, entre outras coisas,
  que a tabela dos contadores ganhe uma coluna identificadora.
- **Cópias de segurança** cifradas e guardadas fora do fornecedor da base de
  dados — ver [`BACKUPS.md`](BACKUPS.md).

---

## 9. Violações de dados pessoais

Se houver acesso indevido, perda ou divulgação não autorizada:

1. **Contenção primeiro.** Rodar as credenciais afetadas — chave de serviço,
   `ADMIN_SESSION_SECRET`, `INBOUND_MAIL_SECRET`, `IP_HASH_SALT` — e fechar o
   caminho de entrada.
2. **Apurar o âmbito**: que tabelas, que colunas, quantos titulares, que período.
   As tabelas da secção 3 são a lista por onde começar.
3. **Notificar a CNPD em 72 horas** a contar do conhecimento, salvo se for
   improvável que a violação resulte em risco para os direitos e liberdades dos
   titulares (artigo 33.º). O atraso, se houver, é fundamentado.
4. **Comunicar aos titulares** se o risco for elevado (artigo 34.º).
5. **Documentar tudo**, mesmo o que não for notificado — o registo interno é
   obrigatório (artigo 33.º, n.º 5).

O procedimento técnico de resposta está em [`OPERACAO.md`](OPERACAO.md); as
falhas de segurança reportam-se pelo canal descrito em
[`SECURITY.md`](../SECURITY.md).

---

## 10. Avaliação de impacto sobre a proteção de dados

Não é exigida uma avaliação de impacto nos termos do artigo 35.º. Os critérios
que a tornariam obrigatória não se verificam:

- não há tratamento em larga escala de categorias especiais de dados (artigo
  9.º) nem de dados relativos a condenações penais;
- não há controlo sistemático de uma zona acessível ao público;
- não há avaliação sistemática e completa de aspetos pessoais baseada em
  tratamento automatizado, nem criação de perfis, nem decisões automatizadas com
  efeitos jurídicos ou significativos (artigo 22.º) — tudo o que é submetido é
  revisto por uma pessoa;
- o volume é reduzido e os dados são acessórios à finalidade do serviço.

**Isto muda se** passar a haver identificação de quem visita — um cookie de
sessão de análise, um identificador persistente, ou uma coluna em `event_stats`
que permita ligar contagens a uma pessoa. Nesse caso, a avaliação de impacto
passa a ser o primeiro passo, antes de qualquer código.

---

## 11. Revisão

Este registo é revisto quando o funcionamento do serviço mudar, e pelo menos uma
vez por ano. Um pedido de alteração que toque em dados pessoais — uma coluna
nova, um subcontratante novo, uma finalidade nova — só está completo quando este
documento e a política publicada em `/privacidade` estiverem
atualizados.
