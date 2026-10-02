import type { VenueKind } from '@coreto/core';

/**
 * O que se pode esperar de um espaço, consoante o que ele é.
 *
 * A ficha de espaço era a mesma para todos: um coreto de ferro fundido num
 * jardim recebia o mesmo esqueleto que um museu — «Contactos», «Como chegar»,
 * «Acessibilidade» — e como o coreto não tem telefone nem bilheteira, o que
 * sobrava era uma página em que duas das três secções falavam do que faltava.
 * Uma ficha que se envergonha do espaço que apresenta.
 *
 * O género do espaço não muda os dados; muda o que é razoável esperar deles.
 * Um coreto sem telefone está completo. Um cine-teatro sem telefone tem uma
 * lacuna. É essa diferença que este módulo escreve, e é só essa: nada aqui
 * inventa informação — apenas decide o que se diz sobre a que falta.
 */
export interface PerfilEspaco {
  /** «neste coreto», «nesta biblioteca» — para as frases da página. */
  locativo: string;
  /** Está ao ar livre: o acesso é o caminho, e não a porta. */
  aoArLivre: boolean;
  /** Tem porta, horário e alguém do outro lado do telefone. */
  temBalcao: boolean;
}

/**
 * O locativo de cada género, com o artigo certo — «neste museu», «nesta
 * biblioteca». Sai numa frase e tem de soar a português, por isso é escrito e
 * não derivado do rótulo: derivá-lo obrigava a guardar o género de cada
 * palavra, que é a mesma tabela por outro nome e com mais um passo para
 * enganar-se.
 */
const LOCATIVOS: Record<VenueKind, string> = {
  theatre: 'neste teatro',
  cinema: 'neste cinema',
  museum: 'neste museu',
  library: 'nesta biblioteca',
  gallery: 'nesta galeria',
  cultural_centre: 'neste centro cultural',
  auditorium: 'neste auditório',
  bandstand: 'neste coreto',
  heritage: 'neste monumento',
  religious: 'neste espaço',
  association: 'nesta coletividade',
  market: 'neste mercado',
  outdoor: 'neste espaço',
  education: 'nesta escola',
  other: 'neste espaço',
};

/** Os que não têm porta: o coreto do jardim, o parque, a praia fluvial. */
const AO_AR_LIVRE: ReadonlySet<VenueKind> = new Set<VenueKind>(['bandstand', 'outdoor']);

export function perfilDoEspaco(kind: VenueKind, isAssociation: boolean): PerfilEspaco {
  const aoArLivre = AO_AR_LIVRE.has(kind);
  return {
    // Uma coletividade é sempre coletividade, seja qual for a casa onde
    // ensaia — é assim que ela se apresenta e é assim que a região lhe chama.
    locativo: isAssociation ? LOCATIVOS.association : (LOCATIVOS[kind] ?? LOCATIVOS.other),
    aoArLivre,
    temBalcao: !aoArLivre,
  };
}

/**
 * A cor da capa de um espaço sem fotografia, pelo que ele é — e a tinta que
 * vai por cima dela.
 *
 * Quatro em cada dez cartões de «Espaços» eram o mesmo quadrado turquesa
 * pálido com o coreto a 12 %, para um cine-teatro, uma biblioteca e um museu
 * (C1-017): uma grelha que parecia um catálogo por preencher. A capa passa a
 * dizer pela cor o que o espaço é, como a capa tipográfica dos eventos diz a
 * categoria.
 *
 * As cores são as das famílias de categoria (`globals.css`), escolhidas pelo
 * que se faz lá dentro: o palco para os teatros e os auditórios, as
 * exposições para os museus, as galerias e o património, a palavra para as
 * bibliotecas e as escolas, a festa para as coletividades e os mercados, a
 * música para os centros culturais, o ar livre para os parques. O coreto
 * leva a cor da casa, que é o desenho dele. Todas têm o par de contraste
 * medido no `cores.test.ts` — `on-cat` por cima das famílias, `on-accent` por
 * cima do turquesa —, e por isso não há uma cor nova a validar.
 *
 * As classes escrevem-se por extenso, e não compostas: o Tailwind só gera o
 * que encontra escrito no código.
 */
const CORES_DOS_ESPACOS: Record<VenueKind, string> = {
  theatre: 'bg-cat-palco text-on-cat',
  auditorium: 'bg-cat-palco text-on-cat',
  cinema: 'bg-cat-cinema text-on-cat',
  museum: 'bg-cat-exposicoes text-on-cat',
  gallery: 'bg-cat-exposicoes text-on-cat',
  heritage: 'bg-cat-exposicoes text-on-cat',
  library: 'bg-cat-palavra text-on-cat',
  education: 'bg-cat-palavra text-on-cat',
  association: 'bg-cat-festa text-on-cat',
  market: 'bg-cat-festa text-on-cat',
  cultural_centre: 'bg-cat-musica text-on-cat',
  outdoor: 'bg-cat-arlivre text-on-cat',
  bandstand: 'bg-accent text-on-accent',
  religious: 'bg-cat-outros text-on-cat',
  other: 'bg-cat-outros text-on-cat',
};

export function corDoEspaco(kind: string, isAssociation: boolean): string {
  // Uma coletividade é coletividade seja qual for a casa onde ensaia — a
  // mesma regra do locativo, lá em cima.
  if (isAssociation) return CORES_DOS_ESPACOS.association;
  return CORES_DOS_ESPACOS[kind as VenueKind] ?? CORES_DOS_ESPACOS.other;
}

/**
 * A freguesia, para a linha de um cartão: sem o «União das freguesias de».
 *
 * Num cartão de 96 píxeis de miniatura, «União das freguesias de Torres Novas
 * (Santa Maria, Salvador e Santiago)» gastava as duas linhas que o cartão tem
 * a dizer o tipo de divisão administrativa, por baixo de um cabeçalho que já
 * diz o concelho (C1-017). Tira-se o prefixo e mais nada: os parênteses ficam,
 * porque às vezes são eles que dizem a aldeia — «Malhou, Louriceira e
 * Espinheiro (Louriceira)». A ficha do espaço tem o nome inteiro.
 */
export function freguesiaCurta(parish: string | null): string | null {
  if (!parish) return null;
  const curta = parish.replace(/^uni[aã]o das freguesias d[eao]s?\s+/i, '').trim();
  return curta.length > 0 ? curta : parish;
}

/**
 * A ordem dos espaços dentro de um concelho: os que têm alguma coisa marcada
 * primeiro, as coletividades a seguir, e o nome por fim.
 *
 * Quem abre a lista dos espaços quer, quase sempre, saber onde há alguma
 * coisa — e os que tinham programação estavam baralhados no meio dos que não
 * têm (C1-017). **Sim ou não, e não quantos**: ordenar pela contagem punha o
 * cine-teatro com quarenta datas à frente da filarmónica com duas, e esta casa
 * escreveu que nada na interface premeia quem publica mais.
 *
 * As coletividades continuam à frente dentro de cada um dos dois grupos, pela
 * razão de sempre: numa lista alfabética a filarmónica fica atrás do centro
 * cultural, e a filarmónica é metade da razão de esta agenda existir.
 */
export function ordenarEspacos<T extends { id: string; name: string; is_association: boolean }>(
  espacos: readonly T[],
  eventosPorEspaco: Readonly<Record<string, number>>,
): T[] {
  const temEventos = (espaco: T) => (eventosPorEspaco[espaco.id] ?? 0) > 0;
  return espacos
    .slice()
    .sort(
      (a, b) =>
        Number(temEventos(b)) - Number(temEventos(a)) ||
        Number(b.is_association) - Number(a.is_association) ||
        a.name.localeCompare(b.name, 'pt'),
    );
}

/**
 * Procurar um espaço pelo nome, sem acentos e sem caixa.
 *
 * Oitenta e nove espaços em dezasseis ecrãs de rolagem: quem sabe o nome do
 * teatro e não sabe o concelho não tinha por onde lá chegar. Havia salto por
 * concelho e filtro por tipo, e nenhum dos dois responde a «Virgínia».
 *
 * Sem acentos porque quem escreve à pressa num telemóvel escreve «virginia»,
 * e recusar-lhe o teatro por causa de um til seria um filtro a servir-se a si
 * próprio. Por conter e não por começar, porque metade destes nomes começa
 * pelo género — «Cine-Teatro», «Biblioteca Municipal», «Sociedade
 * Filarmónica» — e o que a pessoa tem na cabeça é o que vem depois.
 */
export function nomeCasaCom(nome: string, procura: string): boolean {
  const limpo = semAcentos(procura).trim();
  if (limpo === '') return true;
  return semAcentos(nome).includes(limpo);
}

/** Os filtros da lista dos espaços, já lidos do endereço. */
export interface FiltroDosEspacos {
  procura: string;
  /** O género escolhido, ou `null` para todos. */
  tipo: string | null;
  soColetividades: boolean;
  /** Só os que declaram acesso a cadeiras de rodas (C2-012). */
  soAcessiveis: boolean;
}

/**
 * Os espaços que passam os filtros da lista.
 *
 * O acesso é **a declaração do espaço e mais nada**: um espaço que não diz
 * fica de fora, tal como um que diz que não. Não se infere acesso do género —
 * um coreto ao nível do chão parece acessível e pode ter três degraus —, e a
 * nota da caixa di-lo a quem a usa.
 */
export function filtrarEspacos<
  T extends {
    name: string;
    kind: string;
    is_association: boolean;
    wheelchair_accessible: boolean | null;
  },
>(espacos: readonly T[], filtro: FiltroDosEspacos): T[] {
  return espacos.filter((espaco) => {
    if (!nomeCasaCom(espaco.name, filtro.procura)) return false;
    if (filtro.tipo && espaco.kind !== filtro.tipo) return false;
    if (filtro.soColetividades && !espaco.is_association) return false;
    if (filtro.soAcessiveis && espaco.wheelchair_accessible !== true) return false;
    return true;
  });
}

function semAcentos(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
