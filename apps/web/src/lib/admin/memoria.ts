import { LACUNAS_COM_COLUNA, type ColunaDeQualidade } from './lacunas';
import type { QualityRow } from './queries';

/**
 * A comparação entre duas fotografias da qualidade.
 *
 * O painel respondia «62% têm hora» e nada mais. Se no mês passado eram 45%
 * ou 78%, ninguém sabia: a medida não guardava histórico, e está escrito na
 * legenda do relatório que preferia dizê-lo a fingir. A 0144 deu-lhe memória;
 * isto é o que a lê.
 *
 * **Uma percentagem a descer não é necessariamente um mês mau**, e é por isso
 * que esta comparação leva sempre os dois números. Um concelho que passe de
 * 8 eventos com hora em 10 para 25 em 40 desce de 80% para 62% — e fez 17
 * eventos com hora a mais. Mostrar só a percentagem chamava a isso uma
 * queda; mostrar só o absoluto escondia que a proporção piorou. As duas
 * juntas dizem o que aconteceu: o catálogo cresceu mais depressa do que o
 * trabalho de o preencher.
 */
export interface MedidaComparada {
  /** A lacuna, para o rótulo e a ligação para a lista de trabalho. */
  chave: string;
  rotulo: string;
  coluna: ColunaDeQualidade;
  /** Quantos tinham o campo na fotografia, e quantos têm hoje. */
  antes: number;
  agora: number;
  /** O catálogo nos dois momentos. É o denominador das percentagens. */
  catalogoAntes: number;
  catalogoAgora: number;
  /**
   * As duas percentagens, arredondadas como o resto do painel arredonda.
   * `null` quando não havia catálogo nenhum: não há percentagem de zero, e
   * zero não é o mesmo que 0%.
   */
  pcAntes: number | null;
  pcAgora: number | null;
  /**
   * A diferença, em pontos percentuais.
   *
   * Calculada **entre as duas percentagens já arredondadas**, e não a partir
   * das frações. 25 em 40 são 62,5%, que o painel escreve 63%; a diferença
   * exata contra 80% é −17,5 e a diferença entre o que está escrito é −17.
   * O número que se mostra tem de bater com os dois que estão ao lado, ou
   * quem faz a conta de cabeça conclui que a página está errada.
   */
  pontos: number | null;
}

/** Sem casas decimais, como no resto do painel: 62 e 62,4 dizem o mesmo. */
function porCento(parte: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((parte / total) * 100);
}

function somar(linhas: QualityRow[], coluna: ColunaDeQualidade | 'in_catalogue'): number {
  return linhas.reduce((soma, linha) => soma + linha[coluna], 0);
}

/**
 * As seis medidas, da fotografia para hoje.
 *
 * Soma o que se lhe der: chamada com as linhas de uma região devolve a
 * comparação dessa região; com as linhas todas, a de todas. Não filtra nada
 * por si — quem a chama já escolheu.
 *
 * Os dois lados têm de vir do mesmo conjunto de concelhos, ou a comparação é
 * entre coisas diferentes. É por isso que `comparar` recorta a fotografia
 * pelos concelhos de hoje: um concelho que entrou na região depois da
 * fotografia não tem linha lá, e um que saiu não deve contar de um lado só.
 */
export function compararQualidade(fotografia: QualityRow[], hoje: QualityRow[]): MedidaComparada[] {
  const deHoje = new Set(hoje.map((linha) => linha.id));
  const antes = fotografia.filter((linha) => deHoje.has(linha.id));
  const naFoto = new Set(antes.map((linha) => linha.id));
  const agora = hoje.filter((linha) => naFoto.has(linha.id));

  const catalogoAntes = somar(antes, 'in_catalogue');
  const catalogoAgora = somar(agora, 'in_catalogue');

  return LACUNAS_COM_COLUNA.map((lacuna) => {
    const a = somar(antes, lacuna.coluna);
    const b = somar(agora, lacuna.coluna);
    const pcAntes = porCento(a, catalogoAntes);
    const pcAgora = porCento(b, catalogoAgora);
    return {
      chave: lacuna.chave,
      rotulo: lacuna.rotulo,
      coluna: lacuna.coluna,
      antes: a,
      agora: b,
      catalogoAntes,
      catalogoAgora,
      pcAntes,
      pcAgora,
      pontos: pcAntes === null || pcAgora === null ? null : pcAgora - pcAntes,
    };
  });
}

/**
 * O dia até ao qual se procura a fotografia: o último do mês passado.
 *
 * «Memória mensal» é isto e não «há trinta dias»: o mês é a unidade em que o
 * relatório se escreve e em que o trabalho se organiza, e comparar contra uma
 * janela móvel dava um número diferente a cada dia sem nada ter mudado.
 *
 * Recebe o hoje em vez de o ler: uma função que lê o relógio dá resultados
 * que mudam sem os dados mudarem, e não se testa.
 */
export function fimDoMesPassado(hoje: Date): string {
  const primeiroDesteMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const ultimoDoPassado = new Date(primeiroDesteMes.getTime() - 86_400_000);
  return ultimoDoPassado.toISOString().slice(0, 10);
}
