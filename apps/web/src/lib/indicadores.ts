/**
 * A ficha técnica dos indicadores do relatório mensal.
 *
 * **Porque é que isto são dados e não um documento.** Esteve em
 * `docs/INDICADORES.md`, e um documento no repositório não serve a quem precisa
 * dele: o repositório é privado, e quem tem de defender estes números numa
 * assembleia intermunicipal não o abre. A ficha é servida numa página, e daqui
 * saem as duas coisas — a página e a verificação que a prende ao código.
 *
 * **O que a amarra.** O `scripts/verificar-afirmacoes.mjs` lê os blocos e as
 * colunas que o `paraCsv` (`admin/relatorio.ts`) escreve no CSV e exige uma
 * entrada aqui por campo, e um campo por entrada. Um indicador novo sem ficha
 * faz o CI falhar; uma ficha de um indicador que já não existe, também. Sem
 * essa amarra o documento desatualiza-se em silêncio, e aí passa a mentir por
 * omissão — que é pior do que não existir.
 */

export interface CampoDoIndicador {
  /** O nome tal como sai no CSV: o bloco, um ponto, a coluna. */
  campo: string;
  /** O que conta. */
  conta: string;
  /** O que **não** conta, quando há uma armadilha a nomear. */
  naoConta?: string;
}

export interface BlocoDeIndicadores {
  /** O nome do bloco no CSV. */
  bloco: string;
  titulo: string;
  /** Uma ou duas frases sobre o que este bloco mede e a quem se aplica. */
  prosa: readonly string[];
  universo?: string;
  periodicidade?: string;
  deOndeVem?: string;
  campos: readonly CampoDoIndicador[];
}

export const INDICADORES: readonly BlocoDeIndicadores[] = [
  {
    bloco: 'relatorio',
    titulo: 'Quem, e quando',
    prosa: [
      'Não são indicadores: são as etiquetas que impedem dois relatórios de se confundirem numa pasta.',
    ],
    campos: [
      { campo: 'relatorio.regiao_id', conta: 'O identificador da região.' },
      { campo: 'relatorio.regiao', conta: 'O nome da região por extenso.' },
      { campo: 'relatorio.mes', conta: 'O mês do relatório, no formato AAAA-MM.' },
      {
        campo: 'relatorio.gerado_em',
        conta: 'O instante em que a base produziu estes números, com fuso.',
        naoConta:
          'Dois relatórios do mesmo mês gerados em dias diferentes podem divergir — o catálogo mexe-se.',
      },
      {
        campo: 'relatorio.qualidade_de',
        conta:
          'O dia da fotografia que o bloco «qualidade» traz: o último do mês em que foi medida.',
        naoConta:
          'Vazio quando não houve fotografia nesse mês — e aí a qualidade é a de hoje, não a do mês. Meses anteriores a setembro de 2026 ficam sempre vazios: a medida só passou a guardar memória então, e recuar a de hoje seria escrever sobre um mês um número que ninguém leu nele.',
      },
      {
        campo: 'relatorio.observado_desde',
        conta:
          'O primeiro dia em que esta região passou a ser observada: o mais antigo entre o primeiro evento, a primeira submissão e a primeira execução de uma fonte sua. Uma recolha que não trouxe nada conta na mesma — estávamos a olhar.',
        naoConta:
          'Não é a data em que a região aderiu, nem a do primeiro evento publicado. É o que decide quais das janelas do bloco «comparacao» existem: um mês que começou antes disto foi visto em parte.',
      },
    ],
  },
  {
    bloco: 'eventos_publicados_no_mes',
    titulo: 'O que foi ao ar',
    prosa: [
      'Conta a **decisão de publicar**: os eventos cuja data de publicação caiu no mês, por concelho e por categoria.',
      'Conta os que entretanto foram arquivados — um evento publicado em março continua a ter sido publicado em março, e tirá-lo de março reescrevia a história.',
    ],
    universo: 'Eventos canónicos dos concelhos da região.',
    periodicidade: 'Do mês.',
    deOndeVem: 'Migração 0120, secção «Eventos».',
    campos: [
      { campo: 'eventos_publicados_no_mes.concelho_id', conta: 'O concelho.' },
      { campo: 'eventos_publicados_no_mes.concelho', conta: 'O nome do concelho.' },
      {
        campo: 'eventos_publicados_no_mes.categoria_id',
        conta: 'A categoria, ou vazio quando o evento não tem nenhuma.',
      },
      { campo: 'eventos_publicados_no_mes.categoria', conta: 'O nome da categoria.' },
      {
        campo: 'eventos_publicados_no_mes.eventos',
        conta: 'Quantos.',
        naoConta:
          'Só aparecem as combinações que existem: um concelho sem nada publicado no mês não tem linha. E não contam rascunhos nem escondidos.',
      },
    ],
  },
  {
    bloco: 'eventos_a_decorrer_no_mes',
    titulo: 'O que esteve em cartaz',
    prosa: [
      'Conta a **programação**: os eventos publicados cujo período tocou o mês, ainda que tenham começado antes ou acabem depois. Uma exposição de junho a setembro conta nos quatro meses.',
      'É coisa diferente do bloco anterior. Somá-los é somar duas coisas que não são a mesma.',
    ],
    universo: 'Eventos canónicos e publicados.',
    periodicidade: 'Do mês.',
    deOndeVem: 'Migração 0120, secção «Eventos».',
    campos: [
      { campo: 'eventos_a_decorrer_no_mes.concelho_id', conta: 'O concelho.' },
      { campo: 'eventos_a_decorrer_no_mes.concelho', conta: 'O nome do concelho.' },
      {
        campo: 'eventos_a_decorrer_no_mes.eventos',
        conta:
          'Quantos. Aparecem todos os concelhos da região, mesmo a zero — um concelho sem programação é informação, e escondê-lo era deixar de a dar.',
        naoConta: 'Rascunhos, escondidos e arquivados.',
      },
    ],
  },
  {
    bloco: 'totais',
    titulo: 'As três somas',
    prosa: ['Duas somam blocos acima; a terceira não é do mês, e diz-se porquê.'],
    campos: [
      { campo: 'totais.publicados_no_mes', conta: 'O total de «o que foi ao ar».' },
      { campo: 'totais.a_decorrer_no_mes', conta: 'O total de «o que esteve em cartaz».' },
      {
        campo: 'totais.publicados_hoje',
        conta:
          'Quantos eventos canónicos estão publicados no instante em que o relatório foi gerado.',
        naoConta:
          'Não tem histórico: é «agora», e não «no fim do mês». Um relatório de março gerado em setembro traz o número de setembro. É a única linha que não respeita o mês, e está aqui porque responde à pergunta que todos fazem primeiro — «quanto é que isto tem?».',
      },
    ],
  },
  {
    bloco: 'fontes',
    titulo: 'A recolha, fonte a fonte',
    prosa: ['Uma linha por fonte, com o que a recolha fez no mês.'],
    universo:
      'As fontes da região, pelo concelho; sem concelho, pela região declarada na própria fonte.',
    periodicidade: 'Execuções começadas no mês.',
    deOndeVem: 'Migração 0120, secção «Fontes».',
    campos: [
      { campo: 'fontes.fonte_id', conta: 'O identificador da fonte.' },
      { campo: 'fontes.fonte', conta: 'O nome da fonte.' },
      { campo: 'fontes.concelho_id', conta: 'O concelho, ou vazio numa fonte regional.' },
      {
        campo: 'fontes.ligada',
        conta: 'Se a fonte está ligada hoje.',
        naoConta: 'Não diz se esteve ligada durante o mês.',
      },
      { campo: 'fontes.execucoes', conta: 'Quantas vezes a recolha correu esta fonte no mês.' },
      {
        campo: 'fontes.falhas',
        conta: 'Execuções que acabaram em erro.',
        naoConta:
          'Não conta as parciais. Uma fonte que respondeu e trouxe menos do que o costume é uma execução parcial, não uma falha — e uma fonte que não respondeu a pedido nenhum passou a contar como falha desde setembro de 2026, precisamente porque antes era contada como parcial.',
      },
      {
        campo: 'fontes.ultimo_sucesso',
        conta: 'Quando esta fonte foi lida com sucesso pela última vez, em qualquer altura.',
        naoConta:
          'Não se limita ao mês: uma fonte parada há meio ano traz aqui a data de há meio ano, que é o que interessa saber.',
      },
      {
        campo: 'fontes.itens_novos_no_mes',
        conta: 'A soma dos itens novos de todas as execuções do mês.',
        naoConta:
          'Não é «eventos publicados»: um item novo pode ir para a fila de moderação e nunca ser publicado.',
      },
    ],
  },
  {
    bloco: 'territorio',
    titulo: 'Quanto do território publica',
    prosa: [
      'O numerador e o denominador de «X das Y juntas já publicam na agenda regional». A divisão fica por fazer de propósito: uma percentagem é uma leitura, e quem escreve o relatório faz a sua.',
    ],
    universo: 'Os concelhos da região.',
    periodicidade: 'O estado no instante da geração.',
    deOndeVem: 'Migração 0137.',
    campos: [
      { campo: 'territorio.concelhos', conta: 'Quantos concelhos tem a região.' },
      {
        campo: 'territorio.freguesias',
        conta: 'Quantas freguesias têm, ao todo, os concelhos da região.',
        naoConta:
          'Fica vazio se um único concelho ainda não tiver as freguesias contadas. Somar só os que têm dava um denominador silenciosamente menor — e uma fração com o denominador a menos faz o numerador parecer maior sem ninguém escrever nada de falso.',
      },
      {
        campo: 'territorio.camaras_ligadas',
        conta: 'Fontes ligadas do tipo «câmara» com concelho da região.',
        naoConta: 'Fontes desligadas, e fontes regionais sem concelho.',
      },
      {
        campo: 'territorio.juntas_ligadas',
        conta: 'Fontes ligadas do tipo «junta de freguesia». É o numerador da fração.',
        naoConta: 'Fontes desligadas, e fontes regionais sem concelho.',
      },
    ],
  },
  {
    bloco: 'submissoes_recebidas',
    titulo: 'O que chegou à fila de moderação',
    prosa: ['Por onde entrou, e quantas.'],
    universo:
      'Submissões da região — pelo concelho do evento que originaram e, não o havendo, pela região a que foram dirigidas.',
    periodicidade: 'Pela data de chegada, dentro do mês.',
    deOndeVem: 'Migração 0120, secção «Submissões».',
    campos: [
      {
        campo: 'submissoes_recebidas.canal',
        conta: 'Por onde entrou: recolha automática, email ou formulário público.',
      },
      { campo: 'submissoes_recebidas.recebidas', conta: 'Quantas chegaram no mês.' },
    ],
  },
  {
    bloco: 'submissoes_revistas',
    titulo: 'O que a moderação decidiu',
    prosa: [
      'Pela data da revisão, e não pela da chegada. As duas tabelas não fecham uma na outra, e não é erro.',
    ],
    universo: 'As mesmas submissões.',
    periodicidade: 'Pela data da revisão, dentro do mês.',
    deOndeVem: 'Migração 0120, secção «Submissões».',
    campos: [
      {
        campo: 'submissoes_revistas.desfecho',
        conta:
          'Aprovada, rejeitada, ou «outras» — as fundidas com um evento que já existia, as marcadas como duplicado e as que ficaram à espera de informação.',
      },
      {
        campo: 'submissoes_revistas.revistas',
        conta: 'Quantas foram revistas no mês.',
        naoConta:
          'Não é o desfecho das que chegaram no mês. Uma submissão que chegou a 28 de junho e foi revista a 2 de julho conta nas recebidas de junho e nas revistas de julho.',
      },
    ],
  },
  {
    bloco: 'qualidade',
    titulo: 'O que o catálogo sabe de cada evento',
    prosa: [
      'Mede o **catálogo** — publicados mais por publicar —, e não o que está na rua. É por isso que o denominador de todas as colunas é «no catálogo» e não «publicados»: o que a recolha produz é o catálogo; publicar é uma escolha posterior, e tem coluna própria.',
      'Todos os concelhos aparecem, mesmo a zero.',
    ],
    universo:
      'Eventos canónicos, publicados ou por publicar. Escondidos e arquivados ficam de fora.',
    periodicidade:
      'Uma fotografia por noite desde setembro de 2026. O relatório de um mês leva a última tirada dentro dele — o estado com que o mês fechou —, e `relatorio.qualidade_de` diz de que dia é. Meses sem fotografia levam o estado de hoje, e esse campo fica vazio.',
    deOndeVem:
      'A tabela `event_quality_snapshots`, alimentada todas as noites a partir da vista `event_quality_by_municipality`. Sem fotografia no mês, a vista diretamente.',
    campos: [
      { campo: 'qualidade.concelho_id', conta: 'O concelho.' },
      { campo: 'qualidade.concelho', conta: 'O nome do concelho.' },
      { campo: 'qualidade.publicados', conta: 'Eventos com estado «publicado».' },
      { campo: 'qualidade.por_publicar', conta: 'Eventos com estado «rascunho».' },
      {
        campo: 'qualidade.no_catalogo',
        conta: 'A soma dos dois anteriores. É o denominador de todas as colunas seguintes.',
      },
      {
        campo: 'qualidade.com_hora',
        conta: 'Eventos com pelo menos uma sessão com hora de início.',
        naoConta: 'Um evento de três dias em que só o primeiro dia tem hora conta como «com hora».',
      },
      {
        campo: 'qualidade.com_espaco',
        conta: 'Eventos ligados a um espaço do catálogo.',
        naoConta: 'Não conta os que só têm o nome do sítio escrito à mão.',
      },
      { campo: 'qualidade.com_imagem', conta: 'Eventos com cartaz.' },
      { campo: 'qualidade.com_descricao', conta: 'Eventos com descrição, por curta que seja.' },
      {
        campo: 'qualidade.com_preco',
        conta: 'Eventos de entrada livre ou com preço mínimo.',
        naoConta:
          'Um evento cujo preço não se conseguiu ler não conta — «não consegui saber» não é «entrada livre».',
      },
      { campo: 'qualidade.com_coordenadas', conta: 'Eventos com coordenadas.' },
    ],
  },
  {
    bloco: 'comparacao',
    titulo: 'As mesmas medidas noutras janelas',
    prosa: [
      'Uma linha por janela — o mês, o mês anterior, o mês homólogo, e o acumulado do ano —, com as mesmas cinco medidas em todas. As cinco saem da mesma expressão de base de dados chamada quatro vezes: uma comparação em que os dois lados são contados de maneiras diferentes é uma comparação entre duas perguntas.',
      '**Uma janela que não se pode comparar não aparece no ficheiro.** Não vem a zero: um zero num CSV lê-se como uma medição, e um mês que começou antes de `relatorio.observado_desde` foi visto em parte. Comparar contra ele mede a data em que o projeto começou, não a agenda de ninguém.',
      'As datas de cada janela vão nas colunas `de` e `ate`, e não são decorativas: o acumulado do ano começa a 1 de janeiro **ou** no dia em que a região passou a ser observada, o que for mais tarde.',
    ],
    universo:
      'A mesma região do relatório. Eventos canónicos; sessões não canceladas de eventos publicados.',
    periodicidade: 'Calculado no instante da geração, sobre janelas fechadas de datas.',
    deOndeVem: 'A função `report_totals`, uma vez por janela.',
    campos: [
      {
        campo: 'comparacao.janela',
        conta: 'Qual das quatro: «mes», «mes_anterior», «homologo» ou «acumulado_do_ano».',
        naoConta: 'As janelas ausentes são as que não se podem comparar — não são linhas perdidas.',
      },
      { campo: 'comparacao.de', conta: 'O primeiro dia dentro da janela.' },
      { campo: 'comparacao.ate', conta: 'O último dia dentro da janela.' },
      {
        campo: 'comparacao.eventos_publicados',
        conta:
          'Eventos cuja **decisão de publicar** caiu dentro da janela, arquivados incluídos: um evento publicado em julho e arquivado em agosto foi publicado em julho.',
        naoConta: 'Não é o que estava à vista na janela — essa é a coluna ao lado.',
      },
      {
        campo: 'comparacao.eventos_a_decorrer',
        conta: 'Eventos publicados cuja programação tocou a janela, ainda que por um dia.',
        naoConta:
          'Um evento que atravessa dois meses conta nos dois. Somar meses dá mais do que o acumulado, e o acumulado é que está certo.',
      },
      {
        campo: 'comparacao.sessoes',
        conta:
          'Sessões não canceladas, de eventos publicados, com data dentro da janela. É a unidade que o INE usa em espetáculos ao vivo: um festival de três dias é um evento e três sessões.',
        naoConta:
          'Uma sessão cancelada não conta — não foi um espetáculo. E um evento sem sessões gravadas não aparece aqui, ainda que apareça em «eventos a decorrer».',
      },
      {
        campo: 'comparacao.submissoes_recebidas',
        conta: 'Submissões que **chegaram** dentro da janela, por qualquer canal.',
      },
      {
        campo: 'comparacao.submissoes_aprovadas',
        conta: 'Submissões **revistas e aprovadas** dentro da janela.',
        naoConta:
          'Não são as aprovadas de entre as recebidas na janela: uma submissão que chegou em agosto e foi aprovada em setembro conta na recebida de agosto e na aprovada de setembro.',
      },
    ],
  },
  {
    bloco: 'compromissos',
    titulo: 'O que a casa promete, medido',
    prosa: [
      'Cinco famílias que respondem aos compromissos escritos do projeto: a coesão do território, a cauda longa associativa, a entrada livre, a acessibilidade declarada e a programação em rede. **Quase todas começam baixas, e é para isso que servem** — um compromisso sem medida é uma intenção; com medida, é trabalho por fazer, à vista.',
      '**A base é o que foi programado, e não o que está publicado hoje.** Um evento arquivado conta: o CAMINHOS uniu dez concelhos entre abril e maio de 2026 e os seus eventos estão hoje arquivados, pelo que um relatório de abril que contasse só os publicados diria 5 eventos e 0 em rede — quando foram 13 e 4, em 4 concelhos. Um indicador de coesão que esquece o programa que uniu a região, por ele ter acabado, mede a data em que se abriu o relatório.',
      '**Por isso `compromissos.programados` não é `comparacao.eventos_a_decorrer`**, e os dois não se somam: em setembro de 2026 são 104 e 101. São a mesma agenda vista por duas perguntas — «o que foi programado» e «o que estava publicado a decorrer».',
      '**Tudo isto mede o que a agenda conseguiu recolher, e não o que aconteceu no território.** Confundir as duas coisas é acusar um município de não fazer nada quando o que ele não faz é publicar num sítio que responda — e à data em que isto se escreve há oito câmaras cujo sítio não responde a um único pedido.',
    ],
    universo:
      'Eventos canónicos, nem rascunho nem escondidos, com a programação a tocar o mês. Arquivados incluídos.',
    periodicidade: 'Calculado no instante da geração, sobre a janela do mês.',
    deOndeVem: 'A função `report_promises`.',
    campos: [
      { campo: 'compromissos.de', conta: 'O primeiro dia da janela.' },
      { campo: 'compromissos.ate', conta: 'O último dia da janela.' },
      {
        campo: 'compromissos.programados',
        conta: 'O total sobre o qual as famílias contam.',
        naoConta:
          'Não é `comparacao.eventos_a_decorrer`: este inclui os arquivados, aquele não. Somar os dois dá um terceiro número que não quer dizer nada.',
      },
      { campo: 'compromissos.concelhos', conta: 'Quantos concelhos tem a região.' },
      {
        campo: 'compromissos.concelhos_com_programacao',
        conta: 'Quantos deles tiveram pelo menos um evento programado no mês.',
      },
      {
        campo: 'compromissos.quota_do_maior',
        conta:
          'A fração da programação do mês que coube ao concelho com mais, entre 0 e 1. Quanto mais perto de 1, mais concentrada está a agenda.',
        naoConta:
          'Não diz qual é esse concelho, de propósito: uma lista de municípios da mesma CIM por ordem de programação é uma tabela classificativa, e uma tabela classificativa não é um instrumento de coesão. Vazia quando não houve programação — não há quota de zero.',
      },
      {
        campo: 'compromissos.mediana_por_concelho',
        conta:
          'A mediana de eventos por concelho, contando **todos** os concelhos da região — os que ficaram a zero incluídos, porque é esse o achado.',
      },
      {
        campo: 'compromissos.concelhos_abaixo_de_metade_da_mediana',
        conta:
          'Quantos concelhos ficaram abaixo de metade da mediana. É a cauda a que falta trabalho.',
      },
      {
        campo: 'compromissos.em_espaco_de_coletividade',
        conta:
          'Eventos num espaço do catálogo marcado como coletividade (`venues.is_association`).',
        naoConta:
          'Não é «organizado por uma coletividade»: o modelo não tem organizador. Um evento de uma associação numa sala municipal conta como equipamento.',
      },
      {
        campo: 'compromissos.em_equipamento',
        conta: 'Eventos num espaço do catálogo que não é coletividade.',
      },
      {
        campo: 'compromissos.sem_espaco_do_catalogo',
        conta:
          'Eventos que dizem onde são por escrito mas não estão ligados a um espaço. Hoje é a maior das três de longe — não é um defeito das coletividades, é o estado do catálogo.',
      },
      { campo: 'compromissos.entrada_livre', conta: 'Eventos marcados como gratuitos.' },
      { campo: 'compromissos.com_preco', conta: 'Eventos com preço mínimo escrito.' },
      {
        campo: 'compromissos.sem_dizer_o_preco',
        conta: 'Eventos que não dizem se é pago nem quanto custa.',
        naoConta:
          'Não é «pago» nem «grátis». Arrumá-lo numa das outras duas era inventar o preço destes eventos, e são a maioria.',
      },
      {
        campo: 'compromissos.com_acesso_declarado',
        conta:
          'Eventos que declaram pelo menos uma das quatro condições. Com `sem_acesso_declarado`, soma o total.',
      },
      {
        campo: 'compromissos.sem_acesso_declarado',
        conta: 'Eventos que não declaram nenhuma.',
        naoConta:
          'Não quer dizer que não sejam acessíveis: quer dizer que ninguém escreveu que são.',
      },
      {
        campo: 'compromissos.cadeira_de_rodas',
        conta:
          'Eventos com acesso a cadeira de rodas — o do evento, ou o do espaço quando o evento não diz, que é o que o público lê na ficha.',
        naoConta:
          'As quatro condições **sobrepõem-se** e por isso não somam entre si: um evento com língua gestual e cadeira de rodas conta nas duas.',
      },
      {
        campo: 'compromissos.lingua_gestual',
        conta: 'Eventos com interpretação em língua gestual.',
      },
      { campo: 'compromissos.audiodescricao', conta: 'Eventos com audiodescrição.' },
      {
        campo: 'compromissos.sessao_relaxada',
        conta: 'Eventos marcados como sessão relaxada.',
        naoConta:
          'Não há contagem de legendagem: `events` não tem coluna nenhuma para ela, e contar uma quinta condição que não existe era publicar um zero que se lê como «ninguém legenda».',
      },
      {
        campo: 'compromissos.em_serie_regional',
        conta: 'Eventos de uma série marcada como regional — programação que atravessa concelhos.',
      },
      {
        campo: 'compromissos.concelhos_tocados_em_rede',
        conta: 'Quantos concelhos distintos essa programação tocou.',
      },
    ],
  },
  {
    bloco: 'visitas',
    titulo: 'Se houve com que comparar',
    prosa: [
      'As visitas de um mês são a **diferença entre duas fotografias diárias** dos contadores: a última tirada até ao primeiro dia do mês, e a última tirada até ao primeiro dia do mês seguinte.',
    ],
    universo: 'Os contadores por evento, somados por concelho.',
    periodicidade: 'A diferença entre duas fotografias.',
    deOndeVem: 'Migração 0120, secção «Visitas».',
    campos: [
      {
        campo: 'visitas.disponivel',
        conta: 'Se houve duas fotografias distintas para comparar.',
        naoConta:
          'A falso, as linhas por concelho estão **ausentes** e não a zero: zero seria afirmar que ninguém abriu nada; ausente é dizer que não se mediu.',
      },
      { campo: 'visitas.fotografia_de', conta: 'O dia da primeira fotografia.' },
      { campo: 'visitas.fotografia_ate', conta: 'O dia da segunda.' },
      {
        campo: 'visitas.cliques_desde',
        conta:
          'O dia da primeira fotografia que traz os dois contadores mais recentes — «página oficial» e «como chegar».',
        naoConta:
          'Antes dessa data os dois saem **vazios** e não a zero: zero dizia que ninguém carregou, e ninguém carregou porque não havia botão que contasse. Vazio enquanto não houver uma única fotografia com eles.',
      },
    ],
  },
  {
    bloco: 'visitas_por_concelho',
    titulo: 'As aberturas e os cliques',
    prosa: [
      'São contagens sem identificação de ninguém: duas aberturas da mesma pessoa contam duas vezes, e o Coreto não sabe — nem quer saber — que eram a mesma.',
    ],
    universo: 'Os contadores por evento, somados por concelho.',
    periodicidade: 'A diferença entre as duas fotografias acima.',
    deOndeVem: 'Migração 0120, secção «Visitas».',
    campos: [
      { campo: 'visitas_por_concelho.concelho_id', conta: 'O concelho.' },
      { campo: 'visitas_por_concelho.concelho', conta: 'O nome do concelho.' },
      {
        campo: 'visitas_por_concelho.aberturas',
        conta: 'Fichas de evento abertas.',
        naoConta:
          'Não são visitantes nem sessões. Um evento apagado a meio do mês leva os seus contadores atrás, e a diferença é aparada a zero — nunca aparece um número negativo.',
      },
      { campo: 'visitas_por_concelho.bilhetica', conta: 'Cliques no botão de bilhetes.' },
      {
        campo: 'visitas_por_concelho.calendario',
        conta: 'Descarregamentos do calendário de um evento.',
      },
      { campo: 'visitas_por_concelho.partilhas', conta: 'Partilhas a partir da ficha.' },
      {
        campo: 'visitas_por_concelho.pagina_oficial',
        conta:
          'Cliques na ligação para a página de quem organiza. É a prova de retorno que a agenda dá a quem lhe dá programação: «a agenda mandou 340 pessoas ao vosso portal em setembro».',
        naoConta:
          'Vazio, e não zero, num mês cujas duas fotografias não o tinham as duas — ver `visitas.cliques_desde`. Um total da região só aparece se todos os concelhos o tiverem medido.',
      },
      {
        campo: 'visitas_por_concelho.como_chegar',
        conta:
          'Cliques em «Abrir no Google Maps» ou «Ver no OpenStreetMap» a partir de uma ficha de evento. Os dois contam como um: a pergunta é quantas pessoas quiseram saber como lá chegar, não qual dos mapas preferem.',
        naoConta:
          'Os mesmos botões na ficha de um **espaço** não contam: o contador é por evento, e uma ficha de espaço não tem evento a que somar. E vazio, e não zero, pela mesma razão da coluna anterior.',
      },
      {
        campo: 'visitas_por_concelho.cliques',
        conta:
          'A soma das três colunas anteriores — bilhética, calendário e partilhas. É uma coluna gerada na base, e não uma contagem própria.',
        naoConta:
          'Não são cliques na ligação para a página oficial: essa ligação não é contada. E não se soma às outras três num total, porque **é** essa soma.',
      },
    ],
  },
];

/**
 * O enviesamento conhecido, dito antes de alguém o descobrir.
 *
 * É a diferença entre um número que resiste a uma pergunta numa assembleia e
 * um número que se desfaz à primeira. Cada um destes foi verificado no código
 * que produz a contagem, e não deduzido.
 */
export const ENVIESAMENTOS: readonly { titulo: string; texto: string }[] = [
  {
    titulo: 'As aberturas subcontam quem navega sem JavaScript',
    texto:
      'A contagem parte de um ouvinte no navegador (`AnalyticsEventTracker`, um componente de cliente) e viaja em `sendBeacon`. Sem JavaScript — um leitor de texto, um navegador com bloqueador agressivo, uma pré-visualização — a página serve-se por inteiro e não conta nada. O número é um piso, nunca um teto.',
  },
  {
    titulo: 'Não há como descontar um robô que ignore as regras',
    texto:
      'A rota que recebe as contagens limita o tráfego por IP e recusa pedidos de outra origem, e mais nada: não há lista de robôs nem leitura do agente. Um automatismo que execute JavaScript e se apresente como navegador é contado como uma pessoa. O `robots.txt` pede-lhes que não o façam; pedir não é impedir.',
  },
  {
    titulo: 'O contador próprio e uma ferramenta de medição externa não se comparam',
    texto:
      'São duas contagens com perdas de origens diferentes e em proporções diferentes: as listas de bloqueio mais usadas travam os anfitriões conhecidos de medição e não têm regra para uma rota do próprio sítio. Pôr os dois números lado a lado num relatório sugere uma discrepância que é dos instrumentos, e não da audiência.',
  },
  {
    titulo: 'A cobertura mede o que se conseguiu recolher, não o que existe no território',
    texto:
      'Um concelho a zero num mês pode ter tido programação que nenhuma fonte publicou, ou que uma fonte publicou num formato que a recolha não lê. A `/fontes` de cada região diz o que fica de fora e porquê; este relatório conta o que entrou.',
  },
];

/** O que o relatório não diz — e é preciso dizê-lo. */
export const O_QUE_NAO_DIZ: readonly { titulo: string; texto: string }[] = [
  {
    titulo: 'Não há percentagens',
    texto:
      'Todos os números são contagens. A percentagem é uma leitura, e quem recebe o ficheiro faz a sua — uma percentagem publicada sem o denominador ao lado é a forma mais barata de enganar com números verdadeiros.',
  },
  {
    titulo: 'Não há comparação com o mês anterior',
    texto:
      'Cada relatório é de um mês e fecha-se em si. Quem quiser a variação tira dois e subtrai.',
  },
  {
    titulo: 'Não há visitantes',
    texto:
      'O Coreto não identifica quem abre as páginas, e por isso não consegue — nem quer — dizer «visitantes únicos». Diz aberturas.',
  },
  {
    titulo: 'O universo de cada bloco é diferente',
    texto:
      'A qualidade conta o catálogo; «o que esteve em cartaz» conta só o que está publicado; «o que foi ao ar» conta também o que já foi arquivado. Comparar colunas de blocos diferentes exige ler as três definições primeiro — é para isso que esta página existe.',
  },
];
