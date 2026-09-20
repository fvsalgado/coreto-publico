/**
 * Os destinos da navegação, e a regra de qual deles está activo.
 *
 * Vive fora do componente porque é lógica, não desenho: é testável sem
 * montar React, e é o mesmo mapa que a barra de baixo (no telemóvel) e o
 * cabeçalho (no ecrã largo) leem.
 */

/**
 * As secções que podem estar desligadas, e o que isso quer dizer.
 *
 * Quatro páginas desta casa são opcionais: os coretos, os ciclos, o «de onde
 * vêm os eventos» e as informações. Quem administra liga-as e desliga-as no
 * painel, e desligada quer dizer desligada — fora da navegação, fora do mapa
 * do sítio, e o endereço responde 404. Uma secção escondida da navegação mas
 * ainda alcançável seria meia medida: continuava indexada, continuava a
 * aparecer a quem a tivesse nos favoritos, e quem a desligou não perceberia
 * porquê.
 *
 * O que não se desliga, nem por aqui nem por lado nenhum, são os dois textos
 * legais: a política de privacidade e a declaração de acessibilidade têm
 * página própria — ver `RODAPE_ANCORAS`, que é o que as põe em todas as
 * páginas.
 *
 * Os identificadores são os mesmos da restrição `site_sections_conhecidas`, na
 * migração 0074. **Que** secções existem é do repositório; o que a base guarda
 * é só se cada uma está ligada hoje.
 */
export const SECCOES_OPCIONAIS = ['coretos', 'ciclos', 'fontes', 'informacoes'] as const;

export type SeccaoOpcional = (typeof SECCOES_OPCIONAIS)[number];

/** O que uma entrada de navegação diz sobre a secção a que pertence. */
export interface DeUmaSeccao {
  /**
   * A secção que manda nesta entrada. Sem isto, a entrada está sempre à
   * vista — é o caso da agenda, do mapa e dos espaços, que não se desligam.
   */
  seccao?: SeccaoOpcional;
}

export interface Destino extends DeUmaSeccao {
  href: string;
  label: string;
  /**
   * Endereços por baixo deste destino.
   *
   * Uma ficha de evento acende a Agenda e uma ficha de espaço acende os
   * Espaços — senão quem entra num evento a partir da agenda perde a
   * referência de onde está, que é precisamente o que a barra existe para
   * dar.
   */
  prefixos?: readonly string[];
}

export const DESTINOS: readonly Destino[] = [
  { href: '/', label: 'Início' },
  { href: '/agenda', label: 'Agenda', prefixos: ['/evento'] },
  { href: '/mapa', label: 'Mapa', prefixos: ['/concelho'] },
  { href: '/espacos', label: 'Espaços', prefixos: ['/espaco'] },
  { href: '/coretos', label: 'Coretos', seccao: 'coretos' },
];

/**
 * Os quatro que ficam à vista na barra de baixo.
 *
 * O quinto lugar do polegar era dos Coretos e passa a ser um «+». A razão é
 * de contas: a barra tem cinco lugares e a casa tem mais de cinco páginas —
 * o widget, o envio de eventos, as fontes, as informações. Com cinco
 * destinos fixos, tudo o resto só existia no rodapé, ao fim de uma página
 * inteira de deslocamento. Um botão que abre uma gaveta troca um destino por
 * seis.
 *
 * Deriva-se de `DESTINOS` para os rótulos e os prefixos serem escritos uma
 * vez só; o que se escolhe aqui é apenas quais ficam à vista.
 */
const A_VISTA = new Set(['/', '/agenda', '/mapa', '/espacos']);
export const BARRA: readonly Destino[] = DESTINOS.filter((destino) => A_VISTA.has(destino.href));

/** Uma entrada da gaveta. `externo` é o email, que sai do sítio. */
export interface Atalho extends DeUmaSeccao {
  href: string;
  label: string;
  /** A linha por baixo do rótulo. Numa gaveta há espaço para dizer o que é. */
  nota: string;
  externo?: boolean;
  /**
   * Endereços por baixo deste atalho, pela mesma razão que em `Destino`.
   *
   * `/ciclos` é a lista e `/ciclo/caminhos` é um deles — nomes diferentes por
   * serem coisas diferentes, mas quem está num está debaixo do outro, e a
   * barra tem de o dizer.
   */
  prefixos?: readonly string[];
  /**
   * O desenho que a barra de baixo põe ao lado do rótulo.
   *
   * É um **nome** e não um componente porque este ficheiro é de lógica e não
   * desenha nada — e é **obrigatório** por uma razão medida: quando a gaveta
   * ganhou os ciclos, o mapa de ícones da barra não ganhou o desenho, e a
   * linha nova apareceu sem ícone nenhum. Sem erro, sem aviso, sem teste que
   * reprovasse. Sendo campo obrigatório, uma entrada nova não compila até
   * escolher um nome, e o mapa da barra é um `Record` desta união, que não
   * compila até esse nome ter desenho. As duas pontas ficam presas.
   */
  icone: IconeDeAtalho;
  /**
   * De quem é esta entrada.
   *
   * As duas colunas de ligações do rodapé saem daqui, e é só para isso que
   * este campo existe. Estavam escritas à mão e já tinham divergido da
   * gaveta: faltavam-lhes os Coretos e o «Escrever-nos», e tinham uma entrada
   * que a gaveta não tem. Duas listas do mesmo mapa, mantidas à mão, divergem
   * sempre — é uma questão de tempo.
   *
   * **A ordem da gaveta não muda com isto.** A gaveta é uma lista só, pela
   * ordem de quem chega e ao alcance do polegar; agrupá-la por audiência
   * empurrava o «Enviar um evento» para o fundo, que é o contrário do que ela
   * é para. O grupo serve o rodapé, onde há espaço para duas colunas.
   */
  grupo: 'visitante' | 'programar' | 'projeto';
}

/** Os desenhos que a barra de baixo sabe fazer. */
export type IconeDeAtalho =
  'coreto' | 'email' | 'ciclo' | 'favoritos' | 'fontes' | 'informacoes' | 'submeter' | 'widget';

/**
 * A gaveta do «+».
 *
 * Pela ordem de quem chega: primeiro o que se vê, depois o que se faz, e por
 * fim quem somos. O contacto fica no fim porque é o mais raro — mas fica,
 * porque é o único caminho que esta casa dá para falar com alguém.
 */
export const MAIS: readonly Atalho[] = [
  {
    href: '/favoritos',
    label: 'Guardados',
    icone: 'favoritos',
    nota: 'O que guardou neste navegador, e mais em lado nenhum.',
    grupo: 'visitante',
  },
  {
    href: '/coretos',
    seccao: 'coretos',
    label: 'Coretos',
    icone: 'coreto',
    nota: 'O levantamento dos coretos da região, com mapa.',
    grupo: 'visitante',
  },
  {
    href: '/submeter',
    label: 'Enviar um evento',
    icone: 'submeter',
    nota: 'Um email, e uma pessoa lê.',
    grupo: 'programar',
  },
  {
    href: '/ciclos',
    seccao: 'ciclos',
    label: 'Ciclos e festivais',
    icone: 'ciclo',
    nota: 'A programação que atravessa concelhos e anos.',
    prefixos: ['/ciclo'],
    grupo: 'visitante',
  },
  {
    href: '/fontes',
    seccao: 'fontes',
    label: 'De onde vêm os eventos',
    icone: 'fontes',
    nota: 'As fontes, as regras, os feeds e os dados.',
    grupo: 'projeto',
  },
  {
    href: '/levar',
    label: 'Levar a agenda',
    icone: 'widget',
    nota: 'A caixa para colar, os feeds e a API.',
    grupo: 'programar',
  },
  {
    href: '/informacoes',
    seccao: 'informacoes',
    label: 'Informações',
    icone: 'informacoes',
    nota: 'O projeto, a privacidade e a acessibilidade.',
    grupo: 'projeto',
  },
  {
    // O endereço é da região e chega na renderização, por `comEmailDaRegiao`
    // — este mapa é estrutura, e estrutura não sabe de que região é.
    href: 'mailto:',
    label: 'Escrever-nos',
    icone: 'email',
    nota: '',
    externo: true,
    grupo: 'projeto',
  },
];

/**
 * Preenche a entrada do email com o endereço da região.
 *
 * A gaveta e o rodapé desenham o mesmo mapa em regiões diferentes; o que
 * muda entre elas é só para onde se escreve. A entrada reconhece-se pelo
 * ícone, que é o campo que já existe para dizer «isto é o email».
 */
export function comEmailDaRegiao<T extends Atalho | Ancora>(
  itens: readonly T[],
  email: string,
): T[] {
  return itens.map((item) =>
    'icone' in item && item.icone === 'email'
      ? { ...item, href: `mailto:${email}`, nota: email }
      : item,
  );
}

/**
 * As duas colunas de ligações do rodapé, derivadas da gaveta.
 *
 * O rodapé é a gaveta do ecrã largo: a barra de baixo é `sm:hidden` e ali não
 * existe, por isso tudo o que não está no cabeçalho só se alcança por aqui.
 * Se as duas listas fossem escritas à parte — e eram —, um destino novo
 * entrava numa e faltava na outra, e ninguém dava por isso até alguém não o
 * encontrar.
 */
export const RODAPE_VISITANTE: readonly Atalho[] = MAIS.filter(
  (atalho) => atalho.grupo === 'visitante',
);
export const RODAPE_PROGRAMAR: readonly Atalho[] = MAIS.filter(
  (atalho) => atalho.grupo === 'programar',
);
export const RODAPE_PROJETO: readonly Atalho[] = MAIS.filter(
  (atalho) => atalho.grupo === 'projeto',
);

/**
 * As ligações que cada coluna do rodapé leva a mais, além da gaveta.
 *
 * Não são destinos da gaveta, e é de propósito que não saem de `MAIS`: são as
 * duas páginas legais, que não pertencem a secção nenhuma e não se desligam.
 * Ficam aqui, à parte e nomeadas, em vez de ficarem escritas no meio do
 * desenho do rodapé.
 *
 * Foram âncoras — `/informacoes#privacidade` e `/informacoes#acessibilidade`
 * — e é daí que vem o nome. Deixaram de o ser quando as informações passaram
 * a desligar-se no painel: desligada a página, as duas âncoras apontavam a um
 * 404, e um 404 num texto legal não é uma escolha que um painel possa dar. O
 * Decreto-Lei n.º 83/2018 quer a declaração de acessibilidade alcançável de
 * qualquer página; o RGPD quer a informação sobre o tratamento à vista de
 * quem dá os dados. Hoje são páginas próprias, sem `seccao`, e o rodapé —
 * que está em todas as páginas — é o que as torna alcançáveis de qualquer
 * uma. Quem desliga as informações no painel lê lá que estas duas ficam.
 */
export const RODAPE_ANCORAS: { programar: readonly Ancora[]; projeto: readonly Ancora[] } = {
  // A coluna de quem programa deixou de precisar de âncora: «Levar a agenda»
  // é hoje um destino da gaveta, e está na lista como os outros.
  programar: [],
  projeto: [
    { href: '/privacidade', label: 'Privacidade' },
    { href: '/acessibilidade', label: 'Acessibilidade' },
    /*
     * O estado, e é aqui que ele tem de estar.
     *
     * A página diz se a agenda está a ser alimentada, e quem a procura é uma
     * CIM que desconfia de que a dela parou — muitas vezes a partir de uma
     * página qualquer do sítio, não da entrada. O rodapé é o único sítio que
     * está em todas. Fora da gaveta de propósito: a gaveta é de quem visita à
     * procura de programação, e um «Estado» ao lado de «Enviar um evento»
     * assusta sem servir. Sem `seccao`, como as duas de cima: uma região que
     * desligue as fontes no painel continua a precisar de saber se está a
     * receber alguma coisa.
     */
    { href: '/estado', label: 'Estado' },
  ],
};

/**
 * Uma ligação a mais do rodapé: uma página fora da gaveta.
 *
 * O nome ficou de quando eram âncoras dentro de `/informacoes` — ver
 * `RODAPE_ANCORAS`. Herda `DeUmaSeccao` para passar por `semAsDesligadas`
 * com o resto; hoje nenhuma declara `seccao`, e é isso que as deixa sempre
 * de pé.
 */
export interface Ancora extends DeUmaSeccao {
  href: string;
  label: string;
}

/**
 * O que fica de pé depois de tirar as secções desligadas.
 *
 * Uma função só, para os quatro sítios onde a navegação se desenha — o
 * cabeçalho, a gaveta do «+», o rodapé e as âncoras do rodapé. Uma entrada
 * sem `seccao` é de uma página que não se desliga, e passa sempre.
 *
 * Recebe uma lista e não um `Set` porque quem lha dá é um componente de
 * servidor a passar dados para um componente de cliente, e um `Set` não
 * atravessa essa fronteira.
 */
export function semAsDesligadas<T extends DeUmaSeccao>(
  itens: readonly T[],
  desligadas: readonly SeccaoOpcional[],
): T[] {
  if (desligadas.length === 0) return [...itens];
  const fora = new Set<SeccaoOpcional>(desligadas);
  return itens.filter((item) => item.seccao === undefined || !fora.has(item.seccao));
}

/**
 * As colunas de ligações do rodapé, já sem o que está desligado.
 *
 * Duas audiências davam duas colunas bem cheias enquanto todas as páginas
 * existiam. Com as quatro secções desligadas no painel, «O projeto» chegou a
 * ficar com uma entrada só — o «Escrever-nos»: um título com um órfão por
 * baixo, que se lê como coisa partida. Quando alguma das duas fica assim,
 * juntam-se numa coluna só, com um nome que serve às duas.
 *
 * Esse estado deixou de acontecer por interruptor: a privacidade e a
 * acessibilidade eram âncoras de `/informacoes` e caíam com ela, e hoje são
 * páginas que não se desligam — «O projeto» nunca desce de três. A regra fica
 * na mesma, porque é ela que garante o que o teste afirma para todas as
 * combinações, e porque uma coluna que perca uma entrada fixa amanhã não deve
 * partir o rodapé.
 *
 * Vive aqui e não no componente porque é uma regra e não um desenho: assim
 * tem teste, e o rodapé fica só com o trabalho de a desenhar.
 */
export interface ColunaDoRodape {
  titulo: string;
  itens: ReadonlyArray<Atalho | Ancora>;
}

export function colunasDoRodape(
  desligadas: readonly SeccaoOpcional[],
  email: string,
): ColunaDoRodape[] {
  const coluna = (fonte: readonly (Atalho | Ancora)[]) =>
    comEmailDaRegiao(semAsDesligadas<Atalho | Ancora>([...fonte], desligadas), email);

  const visitante = coluna(RODAPE_VISITANTE);
  const programar = coluna([...RODAPE_PROGRAMAR, ...RODAPE_ANCORAS.programar]);
  const projeto = coluna([...RODAPE_PROJETO, ...RODAPE_ANCORAS.projeto]);

  /*
   * Três colunas quando as três se aguentam de pé, e uma quando não.
   *
   * A regra de nunca deixar uma coluna com uma linha só continua a valer, e
   * continua pela razão que a trouxe: um título com uma linha por baixo lê-se
   * como coisa partida. O que mudou foi haver um terceiro assunto — o que é de
   * quem visita: o que guardou, os coretos, os ciclos. Estava disperso pela
   * coluna «O projeto», que é onde se diz quem somos, e não é a mesma pergunta.
   *
   * Com as quatro secções desligadas, «Para si» fica só com os guardados e as
   * três colunas deixam de se aguentar: juntam-se todas, como sempre se
   * juntaram. Uma coluna honesta e sem nome próprio é melhor do que três com
   * uma linha cada.
   */
  const colunas = [
    { titulo: 'Para si', itens: visitante },
    { titulo: 'Para quem programa', itens: programar },
    { titulo: 'O projeto', itens: projeto },
  ];

  if (colunas.every((c) => c.itens.length >= 2)) return colunas;

  const juntas = colunas.flatMap((c) => c.itens);
  return juntas.length > 0 ? [{ titulo: 'No sítio', itens: juntas }] : [];
}

/**
 * O caminho como o público o vê, sem o segmento interno da região.
 *
 * O `usePathname` devolve coisas diferentes conforme o lado: no navegador é o
 * endereço público (`/espacos` — a reescrita do middleware é invisível), mas
 * na pré-geração é o caminho da rota (`/medio-tejo/espacos`, com o segmento
 * `[regiao]` dentro). Sem esta normalização, o destino aceso da navegação
 * saía apagado no HTML servido e acendia-se na hidratação — um erro de
 * hidratação em todas as páginas. Tira-se o prefixo apenas quando é o da
 * região desta página, que o layout conhece e passa.
 */
export function caminhoPublico(pathname: string, regiao: string): string {
  const prefixo = `/${regiao}`;
  if (pathname === prefixo) return '/';
  if (pathname.startsWith(`${prefixo}/`)) return pathname.slice(prefixo.length);
  return pathname;
}

/**
 * Compara por segmento e não por texto.
 *
 * `/agendamento` começa por `/agenda` e não é a agenda; e o `/` é o caso que
 * se engana sozinho, porque qualquer endereço começa por uma barra — daí a
 * igualdade em vez do prefixo.
 */
export function estaEm(pathname: string, destino: Destino): boolean {
  const casa = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  if (destino.href === '/') return pathname === '/';
  return casa(destino.href) || (destino.prefixos ?? []).some(casa);
}

/**
 * O «+» acende quando a página aberta está lá dentro.
 *
 * Sem isto, quem entra nos coretos pela gaveta fica sem nenhum lugar aceso na
 * barra — e uma barra que não diz onde estamos deixa de ser uma referência.
 */
export function estaEmMais(pathname: string): boolean {
  const casa = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  return MAIS.filter((atalho) => !atalho.externo).some(
    (atalho) => casa(atalho.href) || (atalho.prefixos ?? []).some(casa),
  );
}
