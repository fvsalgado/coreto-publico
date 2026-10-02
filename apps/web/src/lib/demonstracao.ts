/**
 * Os números da demonstração, lidos do estado público dela (C4-001).
 *
 * A página do produto não nomeia nenhum cliente — decisão do dono a 2 de
 * outubro de 2026 —, e a prova de que o produto funciona é a demonstração.
 * Os números dela não se escrevem à mão: um número cravado numa página de
 * venda é o primeiro a ficar velho, e é o que um decisor confere. Lêem-se do
 * `/estado.json` da demonstração, que é público e é o mesmo que a sonda
 * externa lê.
 *
 * **A página do produto não toca na base de dados** — é a que tem de aguentar
 * o dia mau (`app/pagina-do-produto/page.tsx`). Isto é um pedido HTTP a um
 * endereço público, guardado uma hora, com quatro segundos de paciência; se
 * falhar, a faixa diz onde se veem os números ao vivo, em vez de inventar uns.
 */

export interface NumerosDaDemonstracao {
  /** Eventos marcados daqui para a frente. */
  eventos: number;
  /** Concelhos e espaços no catálogo — `null` num estado anterior a estes campos. */
  concelhos: number | null;
  espacos: number | null;
  /** Quando o estado foi calculado, em ISO. */
  lidoEm: string;
}

const inteiro = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 ? valor : null;

/** O corpo do `/estado.json`, lido com desconfiança: o que não bater fica de fora. */
export function numerosDoEstado(corpo: unknown): NumerosDaDemonstracao | null {
  if (typeof corpo !== 'object' || corpo === null) return null;
  const { agenda, calculadoEm } = corpo as { agenda?: unknown; calculadoEm?: unknown };
  if (typeof agenda !== 'object' || agenda === null) return null;
  const { total, concelhos, espacos } = agenda as Record<string, unknown>;
  const eventos = inteiro(total);
  if (
    eventos === null ||
    typeof calculadoEm !== 'string' ||
    Number.isNaN(Date.parse(calculadoEm))
  ) {
    return null;
  }
  return { eventos, concelhos: inteiro(concelhos), espacos: inteiro(espacos), lidoEm: calculadoEm };
}

/** A etiqueta de cache: o `/api/revalidate` refá-la com `{"tags":["demonstracao"]}`. */
export const ETIQUETA_DA_DEMONSTRACAO = 'demonstracao';

export async function lerNumerosDaDemonstracao(
  origem: string,
): Promise<NumerosDaDemonstracao | null> {
  try {
    const resposta = await fetch(`${origem}/estado.json`, {
      next: { revalidate: 3600, tags: [ETIQUETA_DA_DEMONSTRACAO] },
      signal: AbortSignal.timeout(4000),
    });
    if (!resposta.ok) return null;
    return numerosDoEstado(await resposta.json());
  } catch {
    return null;
  }
}
