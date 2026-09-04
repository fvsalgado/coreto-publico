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

function semAcentos(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
