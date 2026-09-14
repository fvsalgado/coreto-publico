/**
 * O invólucro do widget: uma página que não parece uma página.
 *
 * Isto vive dentro de um `iframe` no sítio de uma câmara, e o que lá tem de
 * aparecer é a lista e mais nada — o cabeçalho e o rodapé do Coreto dentro do
 * sítio de outra pessoa seriam duas navegações a competir uma com a outra.
 *
 * O App Router só admite um `layout` de raiz (o `<html>` e o `<body>` são
 * dele), por isso a maneira honesta de tirar a moldura é esconder o que o
 * layout de raiz desenhou. O estilo está aqui, ao lado do que o usa, e não em
 * `globals.css`: fora do widget, esta regra não faz sentido nenhum.
 *
 * Repara em onde este ficheiro está: em `[municipality]`, e não em `/widget`.
 * A página de documentação é uma página normal do sítio e fica com a moldura.
 */

const BARE_PAGE = `
  /*
   * Tudo o que o layout de raiz desenha à volta do conteúdo sai daqui — e a
   * regra é pela negativa de propósito. Enumerar o cabeçalho e o rodapé
   * deixava passar o que viesse a seguir, e foi o que aconteceu por duas
   * vezes: a faixa decorativa do topo apareceu como uma fita escura no
   * topo do sítio da câmara, e a barra de navegação do telemóvel apareceu-lhe
   * colada ao fundo do ecrã. Assim, o que for acrescentado à casa fica de
   * fora do widget sem ninguém se lembrar de vir aqui.
   *
   * O anunciador de rotas do Next fica: é uma região viva para os leitores
   * de ecrã e não se vê.
   */
  body > *:not(main#conteudo):not(next-route-announcer) { display: none; }

  body > main#conteudo {
    max-width: none;
    padding: 0;
    margin: 0;
  }

  /* Transparente para o fundo do sítio anfitrião passar; quem pinta é o widget. */
  html, body { background-color: transparent; }
`;

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        `href` e `precedence` fazem o React içar o estilo para o `<head>`. Sem
        isso, a folha fica onde está escrita — dentro do `<main>`, depois do
        cabeçalho — e há um instante em que a navegação do Coreto pisca dentro
        do sítio de outra pessoa antes de desaparecer.
      */}
      <style href="coreto-widget-bare" precedence="high">
        {BARE_PAGE}
      </style>
      {children}
    </>
  );
}
