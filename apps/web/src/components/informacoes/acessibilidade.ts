import { IcOlho, IcPorFazer, IcRobo, IcTeclado, type Ponto } from './Pontos';

/**
 * De que é feita a declaração de acessibilidade: os quatro pontos do resumo,
 * o que está feito e as limitações conhecidas.
 *
 * O texto por extenso vive em `app/[regiao]/acessibilidade/page.tsx`, e só
 * lá. Os pontos estão aqui pela mesma razão dos da privacidade: a própria
 * página e o resumo de `/informacoes` mostram os mesmos quatro, e um resumo
 * que divergisse da declaração era uma declaração a dizer duas coisas.
 */
export const ACESSIBILIDADE: readonly Ponto[] = [
  {
    Icone: IcTeclado,
    titulo: 'Tudo funciona por teclado',
    texto:
      'E sem JavaScript: os filtros vivem no endereço da página. Botões e ligações têm 44 px de altura, que é a medida de um dedo.',
  },
  {
    Icone: IcOlho,
    titulo: 'Feito para se ler',
    texto:
      'Contraste mínimo de 4,5:1 nos dois temas, texto que amplia a 200% sem partir a página, e movimento que pára se o sistema pedir.',
  },
  {
    Icone: IcRobo,
    titulo: 'Verificado a cada alteração',
    texto:
      'Uma auditoria automática corre a 360 e a 1280 pixéis de largura, sempre que alguma coisa muda, sobre uma página de cada tipo que o sítio tem — incluindo uma ficha de evento, uma ficha de espaço, um concelho e um ciclo, que são as páginas que mudam de conteúdo a cada recolha.',
  },
  {
    Icone: IcPorFazer,
    titulo: 'Falta o mais importante',
    texto:
      'Não houve auditoria externa nem testes com quem usa tecnologias de apoio no dia a dia. É por isso que diz «parcialmente conforme» e não «conforme».',
  },
];

export const FEITO = [
  'Estrutura em HTML semântico, com um só cabeçalho de primeiro nível por página e uma hierarquia de cabeçalhos contínua.',
  'Ligação para saltar diretamente para o conteúdo, no primeiro foco de cada página.',
  'Navegação completa por teclado, com indicador de foco sempre visível.',
  'Contraste mínimo de 4,5:1 no texto corrente, verificado em modo claro e em modo escuro.',
  'Modo claro e modo escuro, com um botão que alterna entre seguir o sistema, forçar claro e forçar escuro. Sem escolha feita, vale a preferência do sistema operativo.',
  'Conteúdo legível com o texto ampliado a 200% e em ecrãs estreitos, sem deslocamento horizontal.',
  'No telemóvel, a navegação principal é uma barra ao alcance do polegar, com ícone e rótulo em cada destino e a página atual assinalada também para quem usa um leitor de ecrã.',
  'Botões, ligações autónomas e campos de formulário têm pelo menos 44 px de altura — o critério 2.5.5 da WCAG, que é AAA, e não apenas os 24 px que o nível AA exige. As ligações dentro de texto corrido ficam de fora, como o próprio critério ressalva: esticá-las partiria a linha.',
  'Filtros e formulários funcionam sem JavaScript: o estado vive no endereço da página.',
  'Todas as imagens têm texto alternativo; as meramente decorativas levam texto alternativo vazio para os leitores de ecrã as ignorarem. Os cartazes nas listas são decorativos por essa razão: o que eles mostram — título, data, sítio, categoria — está sempre escrito ao lado, e repeti-lo pela imagem fazia o leitor de ecrã dizer tudo duas vezes.',
  'Os mapas são um extra, e nenhum deles é o único caminho para o que mostra: a lista dos coretos vem logo a seguir ao mapa dos coretos, e a tabela concelho a concelho vem logo a seguir ao mapa da agenda — as duas em texto, com a mesma informação e sem depender de JavaScript.',
  'Animações e deslocamento suave respeitam a preferência de movimento reduzido do sistema.',
  'A distinção entre «não tem» e «não há informação» é explícita nas fichas de evento e de espaço.',
];

export const LIMITACOES = [
  'Não foi feita auditoria externa nem avaliação formal por terceiros. O que aqui se declara resulta de autoavaliação durante o desenvolvimento.',
  'O sítio não foi ainda testado com pessoas que usem tecnologias de apoio no dia a dia. É a lacuna que mais nos custa e a primeira a resolver.',
  'Os textos e as imagens dos eventos vêm dos sítios de quem organiza, e nenhuma das fontes que recolhemos descreve os seus cartazes. Um cartaz de festa costuma trazer escrito o programa todo — as bandas, as horas, o preço — e essa informação não chega a quem não vê a imagem. Enquanto não houver descrição na origem, o cartaz é tratado como decoração e o que sabemos do evento vai por escrito ao lado dele.',
  'Descrições recolhidas de fontes externas podem trazer maiúsculas a mais, abreviaturas ou formatação estranha que um leitor de ecrã não lê bem.',
  'As ligações para sítios de terceiros (bilheteiras, páginas de câmaras, cartazes em PDF) saem do nosso controlo e podem não cumprir os mesmos critérios.',
  'Não foi ainda pedido o selo de usabilidade e acessibilidade.',
];
