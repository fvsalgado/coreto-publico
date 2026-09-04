/**
 * Claro ou escuro, decidido da mesma maneira que o CSS decide.
 *
 * O CSS desta casa tem três estados e não dois: `data-theme="light"` e
 * `data-theme="dark"` são escolhas explícitas de quem visita, e a **ausência**
 * do atributo quer dizer «o que o sistema disser». Quem precise de saber a cor
 * do tema em JavaScript — o mapa, que tem de escolher os mosaicos — tem de
 * aplicar exatamente esta regra, ou o mapa fica claro num sítio escuro.
 *
 * A função é pura de propósito: o `data-theme` e o `prefers-color-scheme`
 * entram como argumentos, e é isso que a torna verificável sem um navegador.
 */
export function estaEscuro(atributo: string | undefined, sistemaEscuro: boolean): boolean {
  if (atributo === 'dark') return true;
  if (atributo === 'light') return false;
  return sistemaEscuro;
}
