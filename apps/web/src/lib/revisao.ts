/**
 * As datas de revisão dos textos de `/informacoes`, `/privacidade` e
 * `/acessibilidade`.
 *
 * Vivem aqui, e não dentro da página, por uma razão prática: um teste que as
 * queira ler não pode importar um `page.tsx` sem arrastar atrás o React e a
 * árvore inteira de componentes. Um módulo sem dependências lê-se num teste
 * de segundos.
 *
 * **São três e não uma.** Havia uma constante só a alimentar o «Elaborada a»
 * da declaração de acessibilidade e o «revista a» do fecho da página — e a
 * data que ela dizia já era falsa. A declaração foi elaborada a 27 de agosto
 * de 2026 (`DECLARATION_DATE` em `99003f2`); a constante única foi empurrada
 * para 28 e depois para 29 por duas passagens que mexeram no resto da página
 * e não na declaração, e o sítio passou a publicar «Elaborada a 29 de agosto»
 * — no campo exacto que o modelo da declaração reserva para a elaboração.
 * Não foi um defeito à espera de acontecer: tinha acontecido. E são mesmo
 * três coisas com ciclos diferentes:
 *
 *   * a declaração de acessibilidade compromete-se por escrito a uma revisão
 *     anual e tem regime próprio no Decreto-Lei n.º 83/2018;
 *   * a política de privacidade muda quando muda um tratamento;
 *   * `/informacoes` muda quando o sítio muda.
 */

/** O fecho de `/informacoes`: o que é o Coreto, quem o faz, como funciona. */
export const REVISAO_PAGINA = '2026-09-02';

/**
 * A política de privacidade.
 *
 * Não tinha data nenhuma até aqui — e tinha mudado nesse mesmo dia, quando o
 * mapa passou a pedir mosaicos a um terceiro. Uma política que muda sem data
 * é uma política que ninguém consegue comparar com a versão que leu.
 */
export const REVISAO_PRIVACIDADE = '2026-08-29';

/**
 * Quando a declaração de acessibilidade foi feita pela primeira vez.
 *
 * Esta data não se muda. É a data em que a declaração passou a existir, e
 * está fixada no primeiro `apps/web/app/acessibilidade/page.tsx`. Quem a
 * revir mexe em `REVISAO_ACESSIBILIDADE`, que é o campo para isso.
 */
export const ELABORACAO_ACESSIBILIDADE = '2026-08-27';

/** E quando foi revista pela última vez. Ver `PRAZO_DE_REVISAO_EM_MESES`. */
export const REVISAO_ACESSIBILIDADE = '2026-08-29';

/**
 * O prazo que a própria declaração promete: «no mínimo, uma vez por ano».
 *
 * Doze meses, e não treze por folga: uma promessa escrita com uma folga
 * escondida no teste deixa de ser a promessa que está escrita.
 */
export const PRAZO_DE_REVISAO_EM_MESES = 12;

/**
 * Meses inteiros decorridos entre duas datas `AAAA-MM-DD`.
 *
 * Conta por calendário e não por dias: «uma vez por ano» é uma obrigação de
 * calendário, e dividir dias por 30,44 dava respostas diferentes conforme o
 * mês em que se corresse o teste.
 */
export function mesesDecorridos(desde: string, ate: string): number {
  const [anoA, mesA, diaA] = desde.split('-').map(Number) as [number, number, number];
  const [anoB, mesB, diaB] = ate.split('-').map(Number) as [number, number, number];

  const meses = (anoB - anoA) * 12 + (mesB - mesA);
  // O mês só conta quando o dia chega: de 29 de agosto a 28 de agosto do ano
  // seguinte vão onze meses e vinte e nove dias, e não doze meses.
  return diaB >= diaA ? meses : meses - 1;
}

/** A declaração caducou? */
export function declaracaoCaducada(hoje: string): boolean {
  return mesesDecorridos(REVISAO_ACESSIBILIDADE, hoje) >= PRAZO_DE_REVISAO_EM_MESES;
}
