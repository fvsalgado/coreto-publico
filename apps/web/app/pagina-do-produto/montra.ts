/**
 * A origem da montra, escrita e não deduzida do ambiente.
 *
 * É o mesmo endereço que a ficha técnica declara como canónico em
 * `page.tsx` — e é essa a razão de estar escrito assim. A montra responde a
 * **qualquer** anfitrião fora do mapa das regiões, e diz a todos eles que o
 * original está aqui em vez de se esconder atrás de um `noindex`. Um sitemap
 * e um `security.txt` que anunciassem outra origem que não a do canónico
 * mandavam quem os lê para um endereço que a própria página desmente.
 *
 * `SITE_URL` seria a escolha instintiva e está errada aqui: sem
 * `NEXT_PUBLIC_SITE_URL` configurada, ela cai no domínio de uma região (ver
 * `lib/env.ts`), e a montra passava a publicar endereços de um cliente no
 * domínio do produto. Medido num arranque sem essa variável: o sitemap da
 * montra saía com `https://coreto.mediotejo.pt/`.
 *
 * Uma instalação que não seja esta muda esta linha, como muda o canónico ao
 * lado.
 */
export const ORIGEM_DA_MONTRA = 'https://coreto.org';
