/**
 * Os onze concelhos da Comunidade Intermunicipal do Médio Tejo.
 *
 * Esta lista existe porque a mesma enumeração estava escrita à mão em três
 * páginas diferentes e divergia entre si.
 *
 * Já cá esteve com treze, e a história merece ser contada porque a correção
 * foi na direção contrária à que parecia óbvia. Onze é o número de concelhos
 * do distrito de Santarém; a Sertã e Vila de Rei são de Castelo Branco, e por
 * isso caíam sempre das listas escritas à pressa. Concluiu-se daí que faltavam
 * — e acrescentaram-se, com uma migração chamada «treze concelhos».
 *
 * Estava errado. A Sertã e Vila de Rei **saíram** da CIM do Médio Tejo a 23 de
 * dezembro de 2022, para a CIM da Beira Baixa. As listas de onze não estavam
 * desatualizadas: estavam certas, e foram corrigidas para errado.
 *
 * A lição é a que este projeto já tinha escrito noutro sítio e não aplicou a
 * si próprio: uma contagem não é uma verificação. «São treze e nós temos onze»
 * é uma inferência sobre um facto que ninguém foi confirmar.
 *
 * A base de dados continua a ser a fonte de verdade em execução. Isto é a
 * cópia que o código precisa de ter sem ir à base — a página de erro, que não
 * pode depender do que pode ter falhado, e a prosa das páginas editoriais. O
 * teste ao lado exige que as duas coincidam.
 */
export interface Municipality {
  readonly id: string;
  readonly name: string;
  readonly district: string;
}

export const MUNICIPALITIES: readonly Municipality[] = [
  { id: 'abrantes', name: 'Abrantes', district: 'Santarém' },
  { id: 'alcanena', name: 'Alcanena', district: 'Santarém' },
  { id: 'constancia', name: 'Constância', district: 'Santarém' },
  { id: 'entroncamento', name: 'Entroncamento', district: 'Santarém' },
  { id: 'ferreira-do-zezere', name: 'Ferreira do Zêzere', district: 'Santarém' },
  { id: 'macao', name: 'Mação', district: 'Santarém' },
  { id: 'ourem', name: 'Ourém', district: 'Santarém' },
  { id: 'sardoal', name: 'Sardoal', district: 'Santarém' },
  { id: 'tomar', name: 'Tomar', district: 'Santarém' },
  { id: 'torres-novas', name: 'Torres Novas', district: 'Santarém' },
  { id: 'vila-nova-da-barquinha', name: 'Vila Nova da Barquinha', district: 'Santarém' },
];

export const MUNICIPALITY_COUNT = MUNICIPALITIES.length;

/**
 * «Abrantes, Alcanena e Constância» — a enumeração como se escreve em
 * português, para a prosa não ter de repetir a lista e voltar a divergir.
 */
export function listMunicipalityNames(
  municipalities: readonly Municipality[] = MUNICIPALITIES,
): string {
  const names = municipalities.map((municipality) => municipality.name);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] as string;
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1] as string}`;
}
