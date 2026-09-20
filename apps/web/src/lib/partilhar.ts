/**
 * Partilhar uma página — o menu do sistema quando há, a área de transferência
 * quando não há.
 *
 * Vive fora dos componentes porque passou a haver dois sítios a partilhar: o
 * botão da ficha e o de cada cartão da agenda. A regra é a mesma nos dois e
 * está escrita uma vez.
 *
 * O endereço pode vir relativo: o cartão só sabe `/evento/<slug>`, e é o
 * navegador que sabe em que domínio está. Resolve-se aqui, antes de partilhar,
 * porque o que se cola numa mensagem tem de ser um endereço inteiro.
 */
export type ResultadoDaPartilha = 'partilhado' | 'copiado' | 'falhou';

export async function partilhar(titulo: string, endereco: string): Promise<ResultadoDaPartilha> {
  const url = new URL(endereco, window.location.href).toString();

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: titulo, url });
    } catch {
      // Desistir a meio do menu de partilha do sistema é uma decisão de quem
      // visita, não um erro: não se avisa nem se tenta outra coisa.
    }
    return 'partilhado';
  }

  try {
    await navigator.clipboard.writeText(url);
    return 'copiado';
  } catch {
    return 'falhou';
  }
}
