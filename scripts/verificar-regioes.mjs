/**
 * A prova executável do multi-inquilino: dois domínios, duas regiões, zero
 * fugas.
 *
 * Corre com o sítio já a servir (`pnpm --filter @coreto/web start`) sobre uma
 * base com as migrações E a região de prova (`supabase/ci/9000_…`). Cada
 * pedido leva o cabeçalho Host de um domínio e o script afirma três coisas:
 *
 * 1. **Cada domínio serve a sua região** — o Médio Tejo no dele, a Travessia
 *    no dela, e um Host desconhecido não serve nenhuma: vê a página do
 *    produto, sem uma letra de quem quer que seja.
 * 2. **Nem um byte de uma região dentro da outra** — a lista `FUGAS_MT` varre
 *    o corpo inteiro de cada página da Travessia; um concelho do Médio Tejo
 *    aberto no domínio da Travessia é 404, e vice-versa.
 * 3. **A identidade de máquina é a certa** — canónicos, sitemap, robots,
 *    manifesto, llms.txt, feed, API e widget anunciam a origem do seu
 *    domínio, não a do vizinho.
 * 4. **Um município sozinho escreve-se no singular e no masculino** — o
 *    Mirante (`supabase/ci/9001_…`) tem um concelho e é promovido «pelo»
 *    Município, e nenhuma página diz «um concelhos» nem «da Município».
 *
 * É a versão executável da promessa comercial: a segunda CIM nasce com um
 * INSERT, e o CI faz esse INSERT todas as corridas.
 *
 * Vai por `node:http` e não por `fetch`: o `fetch` segue a especificação e a
 * especificação proíbe definir o cabeçalho Host — que é exatamente o que aqui
 * é preciso.
 */
import http from 'node:http';
import { GLOSSARIO_INTERNO, palavraInteira } from './glossario-interno.mjs';

const BASE = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:3000');

/** Os três chapéus com que se bate à mesma porta. */
const HOST_MT = 'coreto.mediotejo.pt';
const HOST_PROVA = 'coreto.travessia.example';
const HOST_DESCONHECIDO = 'agenda.exemplo-qualquer.pt';
const HOST_MONTRA = 'demo.coreto.org';
/** Um município sozinho, promovido pela câmara (`supabase/ci/9001_…`, C1-031). */
const HOST_MUNICIPIO = 'coreto.mirante.example';

/**
 * O que nunca pode aparecer numa página da Travessia. Nomes, domínio e
 * financiador do Médio Tejo — se um dia alguém cravar um deles num
 * componente, é aqui que o CI o apanha.
 */
const FUGAS_MT = [
  'Médio Tejo',
  'mediotejo.pt',
  'Comunidade Intermunicipal do Médio Tejo',
  'Centro 2030',
];

let falhas = 0;

function pedir(caminho, host) {
  return new Promise((resolve, reject) => {
    const pedido = http.request(
      {
        hostname: BASE.hostname,
        port: BASE.port || 80,
        path: caminho,
        headers: { Host: host },
      },
      (resposta) => {
        const partes = [];
        resposta.on('data', (parte) => partes.push(parte));
        resposta.on('end', () =>
          resolve({
            estado: resposta.statusCode ?? 0,
            corpo: Buffer.concat(partes).toString('utf8'),
          }),
        );
      },
    );
    pedido.on('error', reject);
    pedido.setTimeout(30_000, () => pedido.destroy(new Error('demorou mais de 30 s')));
    pedido.end();
  });
}

function afirmar(condicao, mensagem) {
  if (condicao) {
    console.log(`✓ ${mensagem}`);
  } else {
    console.error(`✗ ${mensagem}`);
    falhas += 1;
  }
}

/** Pede e afirma o estado; devolve o corpo para as asserções de conteúdo. */
async function pagina(host, caminho, estadoEsperado = 200) {
  const { estado, corpo } = await pedir(caminho, host);
  afirmar(
    estado === estadoEsperado,
    `${host}${caminho} responde ${estadoEsperado} (veio ${estado})`,
  );
  return corpo;
}

/** Um alias não serve: afirma o 308 e para onde ele manda. */
async function redireciona(host, caminho, destinoEsperado) {
  const pedido = await new Promise((resolve, reject) => {
    const p = http.request(
      { hostname: BASE.hostname, port: BASE.port || 80, path: caminho, headers: { Host: host } },
      (resposta) => {
        resposta.resume();
        resposta.on('end', () =>
          resolve({ estado: resposta.statusCode ?? 0, location: resposta.headers.location ?? '' }),
        );
      },
    );
    p.on('error', reject);
    p.setTimeout(30_000, () => p.destroy(new Error('demorou mais de 30 s')));
    p.end();
  });
  afirmar(
    pedido.estado === 308 && pedido.location === destinoEsperado,
    `${host}${caminho} redireciona (308) para ${destinoEsperado} ` +
      `(veio ${pedido.estado} → ${pedido.location || 'sem Location'})`,
  );
}

function semFugas(corpo, host, caminho) {
  const encontradas = FUGAS_MT.filter((fuga) => corpo.includes(fuga));
  afirmar(
    encontradas.length === 0,
    `${host}${caminho} sem uma letra do Médio Tejo` +
      (encontradas.length > 0 ? ` (fugiu: ${encontradas.join(', ')})` : ''),
  );
}

// ---- O Médio Tejo no seu domínio, e só no seu domínio ----

{
  const inicio = await pagina(HOST_MT, '/');
  // A paleta vermelha é da página do produto e de mais ninguém. O Médio Tejo
  // declara o turquesa que publica (0167), que é o `@theme` da casa: nem o
  // invólucro do produto nem o de uma cor de região aparecem aqui.
  afirmar(!inicio.includes('data-paleta="montra"'), `${HOST_MT}/ não veste a paleta da montra`);
  afirmar(
    !inicio.includes('data-paleta="regiao"') && inicio.includes('content="#40c0c4"'),
    `${HOST_MT}/ veste o turquesa que declarou, sem folha de paleta`,
  );
  afirmar(inicio.includes('A agenda cultural do Médio Tejo'), `${HOST_MT}/ apresenta o Médio Tejo`);
  // Os cartazes desenhados pela casa são da demonstração e de mais ninguém:
  // numa agenda a sério o cartaz é de quem organiza (0168).
  await pagina(HOST_MT, '/cartaz-ilustrado/qualquer-evento', 404);
  afirmar(!inicio.includes('Travessia'), `${HOST_MT}/ sem uma letra da Travessia`);

  const llms = await pagina(HOST_MT, '/llms.txt');
  afirmar(
    llms.includes('Endereço canónico: https://coreto.mediotejo.pt'),
    `${HOST_MT}/llms.txt anuncia o canónico do Médio Tejo`,
  );

  const sitemap = await pagina(HOST_MT, '/sitemap.xml');
  afirmar(
    sitemap.includes('<loc>https://coreto.mediotejo.pt/concelho/tomar</loc>'),
    `${HOST_MT}/sitemap.xml traz os concelhos do Médio Tejo na sua origem`,
  );
  afirmar(!sitemap.includes('pontezela'), `${HOST_MT}/sitemap.xml sem concelhos da Travessia`);

  await pagina(HOST_MT, '/concelho/tomar');
  // O cartaz A4 da semana (C2-032, C4-022): a folha e o QR para a agenda do
  // concelho, no domínio da região — e o de um concelho de outra é 404.
  const folha = await pagina(HOST_MT, '/cartaz-semanal/tomar');
  afirmar(
    folha.includes('Esta semana em Tomar') &&
      folha.includes('aria-label="Código QR para coreto.mediotejo.pt/concelho/tomar"'),
    `${HOST_MT}/cartaz-semanal/tomar é a folha de Tomar, com o QR para a agenda dela`,
  );
  await pagina(HOST_MT, '/cartaz-semanal/pontezela', 404);
  // A pesquisa da agenda, com acento e tudo: sem acentos e pelo radical (0116).
  await pagina(HOST_MT, '/agenda?q=concertos%20de%20ver%C3%A3o');

  // A prova positiva das fontes regionais: as da CIM do Médio Tejo (sem
  // concelho, com `sources.region_id`) continuam na página DELE. Sem isto, a
  // varredura de fugas passava por vazio — uma página de fontes em branco não
  // tem fugas nem verdade nenhuma.
  const fontes = await pagina(HOST_MT, '/fontes');
  afirmar(
    fontes.includes('CAMINHOS'),
    `${HOST_MT}/fontes lista as fontes regionais da própria CIM`,
  );

  // Os dois textos legais têm endereço próprio e não se desligam no painel:
  // a declaração de acessibilidade (Decreto-Lei n.º 83/2018) e a política de
  // privacidade respondem 200 em qualquer região, e com o texto todo. O
  // «responsável pelo tratamento» só se escreve quando a região declara um —
  // e uma linha real declara-o sempre, com a CIM por omissão.
  const acessibilidade = await pagina(HOST_MT, '/acessibilidade');
  afirmar(
    acessibilidade.includes('Decreto-Lei n.º 83/2018'),
    `${HOST_MT}/acessibilidade publica a declaração de acessibilidade`,
  );
  const privacidade = await pagina(HOST_MT, '/privacidade');
  /*
   * Duas afirmações e não uma, e a segunda é a que interessa.
   *
   * Isto procurava a frase `responsável pelo tratamento` em minúsculas, que
   * era como a política a escrevia dentro de «O responsável … é a …». A 0158
   * trocou a frase por uma lista de definições — porque o artigo cravado
   * produzia «é a Fábio Salgado» quando quem responde é uma pessoa — e o
   * rótulo passou a ter maiúscula. A asserção reprovou sobre uma página que
   * continuava a dizer exatamente o que ela queria provar.
   *
   * Aproveita-se para a pôr a perguntar o que quer mesmo: não que as palavras
   * lá estejam, mas que **esteja lá um nome**. A versão antiga passava numa
   * página que escrevesse o rótulo e não nomeasse ninguém.
   */
  afirmar(
    privacidade.includes('Responsável pelo tratamento'),
    `${HOST_MT}/privacidade publica a política de privacidade, com o rótulo de quem responde`,
  );
  afirmar(
    privacidade.includes('Comunidade Intermunicipal do Médio Tejo'),
    `${HOST_MT}/privacidade nomeia quem responde pelo tratamento, e não só o rótulo`,
  );

  // O isolamento visto do lado do Médio Tejo: um concelho da Travessia não
  // existe neste domínio.
  await pagina(HOST_MT, '/concelho/pontezela', 404);
  // E o segmento interno não é endereçável por fora.
  await pagina(HOST_MT, '/medio-tejo/agenda', 404);
  // Nem o nome interno do sitemap: o endereço público é só /sitemap.xml.
  await pagina(HOST_MT, '/sitemap-xml', 404);
  // Nem o da página do produto, que num domínio de região não é página
  // nenhuma: o endereço dela é a raiz de um anfitrião sem região, e mais
  // nenhum.
  await pagina(HOST_MT, '/pagina-do-produto', 404);
}

// ---- Um anfitrião que não é de ninguém: o produto, e nada de ninguém ----

{
  // A regra que substituiu a região de omissão: um Host fora do mapa não vê a
  // agenda de uma CIM real — vê a página estática do produto, que não toca na
  // base de dados. A varredura de fugas é aqui a prova que interessa.
  const produto = await pagina(HOST_DESCONHECIDO, '/');
  afirmar(
    produto.includes('Toda a programação cultural do seu território, numa agenda só.'),
    'um Host desconhecido vê a página do produto',
  );
  afirmar(produto.includes('versão 2.1'), `${HOST_DESCONHECIDO}/ anuncia a versão do produto`);
  // O primeiro gesto é ver, e o segundo é falar (C4-003, C4-002): a
  // demonstração no primeiro ecrã, e um caminho de compra sem preço inventado.
  afirmar(
    produto.includes('Ver a demonstração') && produto.includes('Pedir proposta'),
    `${HOST_DESCONHECIDO}/ convida a ver a demonstração e a pedir proposta`,
  );
  const contacto = await pagina(HOST_DESCONHECIDO, '/contacto');
  afirmar(
    contacto.includes('Falar connosco') && /mailto:[^"]+\?subject=/.test(contacto),
    `${HOST_DESCONHECIDO}/contacto escreve o endereço e abre o correio com assunto`,
  );
  semFugas(contacto, HOST_DESCONHECIDO, '/contacto');
  afirmar(produto.includes('Fábio Salgado'), `${HOST_DESCONHECIDO}/ diz quem faz`);
  // E veste o vermelho da montra, com a barra do sistema a condizer.
  afirmar(
    produto.includes('data-paleta="montra"'),
    `${HOST_DESCONHECIDO}/ veste a paleta da montra`,
  );
  afirmar(
    produto.includes('content="#c2281c"'),
    `${HOST_DESCONHECIDO}/ pinta a barra do sistema de vermelho`,
  );
  semFugas(produto, HOST_DESCONHECIDO, '/');
  afirmar(!produto.includes('Travessia'), `${HOST_DESCONHECIDO}/ sem uma letra da Travessia`);
  /*
   * E não nomeia cliente nenhum, o que é mais forte do que parece.
   *
   * A ficha técnica chegou a apontar para a agenda real do Médio Tejo — a
   * demonstração mais forte que há. Esta varredura recusou, e tinha razão:
   * esta página responde a **qualquer** anfitrião fora do mapa, incluindo o
   * domínio de um cliente apontado para cá antes de a região dele existir.
   * Nomear uma CIM aqui é mostrá-la a quem quer que apareça. A demonstração
   * que a página pode oferecer é a inventada, que não é de ninguém.
   */
  afirmar(
    produto.includes('demo.coreto.org'),
    `${HOST_DESCONHECIDO}/ oferece a demonstração inventada`,
  );
  // A página é de venda e fala a municípios, regiões e associações por igual:
  // não se apresenta «região a região», e não nomeia a licença nem o
  // repositório — quem compra fala com quem faz, não com um ficheiro.
  afirmar(
    !produto.includes('região a região'),
    `${HOST_DESCONHECIDO}/ não se apresenta como um produto de regiões`,
  );
  afirmar(!/AGPL/i.test(produto), `${HOST_DESCONHECIDO}/ não nomeia a licença`);
  afirmar(!produto.includes('github.com'), `${HOST_DESCONHECIDO}/ não aponta ao repositório`);
  // E não convida a ver uma demonstração que neste domínio não existe.
  afirmar(
    !produto.includes('Ver a montra a funcionar'),
    `${HOST_DESCONHECIDO}/ não promete uma agenda que não tem`,
  );

  // Este anfitrião tem uma página e é aquela: nem agenda, nem feeds, nem
  // sitemap. Um 200 em qualquer um deles era conteúdo de alguém a aparecer
  // onde não devia.
  await pagina(HOST_DESCONHECIDO, '/agenda', 404);
  await pagina(HOST_DESCONHECIDO, '/concelho/tomar', 404);
  await pagina(HOST_DESCONHECIDO, '/pagina-do-produto', 404);
}

// ---- A Travessia no seu domínio: a região que nasceu de um INSERT ----

{
  const inicio = await pagina(HOST_PROVA, '/');
  afirmar(!inicio.includes('data-paleta="montra"'), `${HOST_PROVA}/ não veste a paleta da montra`);
  // Uma região que nasce sem dizer a cor nasce com o vermelho do produto, e
  // não com o turquesa do Médio Tejo (C4-006, 0167): a cor é dela, numa folha
  // própria, e a barra do sistema acompanha-a.
  afirmar(
    inicio.includes('data-paleta="regiao"') &&
      inicio.includes('--color-brand:#c2281c') &&
      inicio.includes('content="#c2281c"'),
    `${HOST_PROVA}/ nasce com o vermelho do produto, e não com a cor de outra CIM`,
  );
  afirmar(
    inicio.includes('A agenda cultural da Travessia do Zêzere'),
    `${HOST_PROVA}/ apresenta a Travessia — com o artigo dela`,
  );
  afirmar(inicio.includes('dois concelhos'), `${HOST_PROVA}/ conta os concelhos por extenso`);
  semFugas(inicio, HOST_PROVA, '/');

  for (const caminho of [
    '/agenda',
    '/espacos',
    '/mapa',
    '/submeter',
    '/levar',
    '/informacoes',
    '/privacidade',
    '/acessibilidade',
    '/ciclos',
    '/coretos',
    '/fontes',
  ]) {
    const corpo = await pagina(HOST_PROVA, caminho);
    semFugas(corpo, HOST_PROVA, caminho);
  }

  const concelho = await pagina(HOST_PROVA, '/concelho/pontezela');
  afirmar(
    concelho.includes('Pontezela'),
    `${HOST_PROVA}/concelho/pontezela é a página de Pontezela`,
  );
  semFugas(concelho, HOST_PROVA, '/concelho/pontezela');

  // O isolamento a sério: um endereço do Médio Tejo aberto no domínio da
  // Travessia é um 404, não um empréstimo de conteúdo.
  await pagina(HOST_PROVA, '/concelho/tomar', 404);

  const folha = await pagina(HOST_PROVA, '/cartaz-semanal/pontezela');
  afirmar(
    folha.includes('Esta semana em Pontezela'),
    `${HOST_PROVA}/cartaz-semanal/pontezela é a folha de Pontezela`,
  );
  semFugas(folha, HOST_PROVA, '/cartaz-semanal/pontezela');

  const sitemap = await pagina(HOST_PROVA, '/sitemap.xml');
  afirmar(
    sitemap.includes('<loc>https://coreto.travessia.example/concelho/pontezela</loc>'),
    `${HOST_PROVA}/sitemap.xml anuncia a Travessia na origem dela`,
  );
  afirmar(!sitemap.includes('tomar'), `${HOST_PROVA}/sitemap.xml sem concelhos do Médio Tejo`);
  semFugas(sitemap, HOST_PROVA, '/sitemap.xml');

  const robots = await pagina(HOST_PROVA, '/robots.txt');
  afirmar(
    robots.includes('Sitemap: https://coreto.travessia.example/sitemap.xml'),
    `${HOST_PROVA}/robots.txt aponta ao sitemap do seu domínio`,
  );

  const manifesto = await pagina(HOST_PROVA, '/manifest.webmanifest');
  afirmar(
    manifesto.includes('Coreto — a agenda cultural da Travessia do Zêzere'),
    `${HOST_PROVA}/manifest.webmanifest instala-se com o nome da Travessia`,
  );
  semFugas(manifesto, HOST_PROVA, '/manifest.webmanifest');

  const llms = await pagina(HOST_PROVA, '/llms.txt');
  afirmar(
    llms.includes('Endereço canónico: https://coreto.travessia.example'),
    `${HOST_PROVA}/llms.txt anuncia o canónico da Travessia`,
  );
  semFugas(llms, HOST_PROVA, '/llms.txt');

  const feed = await pagina(HOST_PROVA, '/feed.xml');
  afirmar(
    feed.includes('https://coreto.travessia.example/feed.xml'),
    `${HOST_PROVA}/feed.xml declara-se na origem da Travessia`,
  );
  semFugas(feed, HOST_PROVA, '/feed.xml');

  const calendario = await pagina(HOST_PROVA, '/agenda.ics');
  afirmar(
    calendario.includes('Coreto — Travessia do Zêzere'),
    `${HOST_PROVA}/agenda.ics tem o nome da Travessia`,
  );
  semFugas(calendario, HOST_PROVA, '/agenda.ics');

  const api = await pagina(HOST_PROVA, '/api/events?limit=1');
  afirmar(
    api.includes('https://coreto.travessia.example/levar#dados'),
    `${HOST_PROVA}/api/events documenta-se na origem da Travessia`,
  );
  semFugas(api, HOST_PROVA, '/api/events');

  // A pesquisa por texto (0116) corre no Postgres, na configuração
  // `portugues`, por `textSearch` do PostgREST — e é aqui, com um PostgREST a
  // sério, que a sintaxe da consulta e o nome da configuração se provam.
  const pesquisa = await pagina(HOST_PROVA, '/api/events?q=fado%20noite');
  afirmar(pesquisa.includes('"events"'), `${HOST_PROVA}/api/events?q= responde à pesquisa`);
  semFugas(pesquisa, HOST_PROVA, '/api/events?q=');
  await pagina(HOST_PROVA, '/agenda?q=virg%C3%ADnia');

  const script = await pagina(HOST_PROVA, '/widget/embed.js');
  afirmar(
    script.includes('var ORIGIN = "https://coreto.travessia.example"'),
    `${HOST_PROVA}/widget/embed.js aponta a caixa ao domínio da Travessia`,
  );
  semFugas(script, HOST_PROVA, '/widget/embed.js');

  // O ciclo da prova tem página, no domínio da prova.
  const ciclo = await pagina(HOST_PROVA, '/ciclo/encontros-da-travessia');
  afirmar(ciclo.includes('Encontros da Travessia'), `${HOST_PROVA} serve o ciclo da Travessia`);
  semFugas(ciclo, HOST_PROVA, '/ciclo/encontros-da-travessia');
}

// ---- O Mirante: um município sozinho, no singular e no masculino ----

{
  /*
   * O produto licencia-se a uma câmara sozinha, e as duas regiões de cima
   * não o provavam: onze concelhos e dois, ambas de uma Comunidade (C1-031).
   * Com um concelho, as frases que contavam diziam «Um concelhos, um palco» e
   * «os um concelhos», e o rodapé tinha o «da» escrito à mão: «a agenda dos
   * um concelhos da Município…». O Mirante tem um concelho e um promotor no
   * masculino (0169), e é aqui que essas frases voltariam a aparecer.
   */
  // As frases partidas, e só elas: «dá-nos um email» é português, «nos um
  // concelhos» não é.
  const PARTIDAS =
    /\bum concelhos\b|\b(?:os|dos|nos|aos) um concelho|\b(?:da|pela|na|à) Município\b/i;
  const semFrasesPartidas = (corpo, caminho) => {
    const partida = corpo.match(PARTIDAS);
    afirmar(
      partida === null,
      `${HOST_MUNICIPIO}${caminho} concorda com um concelho e com «o Município»` +
        (partida ? ` (leu-se «${partida[0]}»)` : ''),
    );
  };

  const inicio = await pagina(HOST_MUNICIPIO, '/');
  afirmar(
    inicio.includes('Um concelho, um palco') && inicio.includes('A agenda cultural do Mirante'),
    `${HOST_MUNICIPIO}/ conta um concelho no singular, com o artigo do Mirante`,
  );
  afirmar(
    inicio.includes('A agenda cultural do concelho do Município do Mirante.') &&
      inicio.includes('Promovido pelo'),
    `${HOST_MUNICIPIO}/ diz no rodapé «do concelho do Município» e «Promovido pelo»`,
  );
  semFrasesPartidas(inicio, '/');
  semFugas(inicio, HOST_MUNICIPIO, '/');
  afirmar(!inicio.includes('Travessia'), `${HOST_MUNICIPIO}/ sem uma letra da Travessia`);

  const informacoes = await pagina(HOST_MUNICIPIO, '/informacoes');
  afirmar(
    informacoes.includes('É a agenda cultural do concelho do Município do Mirante'),
    `${HOST_MUNICIPIO}/informacoes apresenta-se com o artigo do promotor`,
  );
  semFrasesPartidas(informacoes, '/informacoes');

  const concelho = await pagina(HOST_MUNICIPIO, '/concelho/mirante');
  afirmar(
    concelho.includes('no Município do Mirante.'),
    `${HOST_MUNICIPIO}/concelho/mirante diz «no Município», e não «na»`,
  );
  semFrasesPartidas(concelho, '/concelho/mirante');

  const acessibilidade = await pagina(HOST_MUNICIPIO, '/acessibilidade');
  afirmar(
    acessibilidade.includes('promovido pelo Município do Mirante'),
    `${HOST_MUNICIPIO}/acessibilidade diz «promovido pelo Município»`,
  );

  const manifesto = await pagina(HOST_MUNICIPIO, '/manifest.webmanifest');
  afirmar(
    manifesto.includes('O concelho e o que está marcado nele.'),
    `${HOST_MUNICIPIO}/manifest.webmanifest descreve o mapa no singular`,
  );

  const llms = await pagina(HOST_MUNICIPIO, '/llms.txt');
  afirmar(
    llms.includes('A agenda cultural do concelho do Município do Mirante') &&
      llms.includes('Promovido pelo Município do Mirante'),
    `${HOST_MUNICIPIO}/llms.txt concorda com um concelho e com «o Município»`,
  );

  for (const caminho of [
    '/agenda',
    '/espacos',
    '/mapa',
    '/submeter',
    '/levar',
    '/fontes',
    '/feed.xml',
  ]) {
    const corpo = await pagina(HOST_MUNICIPIO, caminho);
    semFrasesPartidas(corpo, caminho);
    semFugas(corpo, HOST_MUNICIPIO, caminho);
  }
}

// ---- A montra (0110) e os alias (0111): a terceira região e os 308 ----

{
  /*
   * A montra mudou de casa (0127), e com ela mudou o que cada endereço prova.
   *
   * Era o `coreto.org`: a entrada dele era a página do produto e o resto do
   * domínio a demonstração — o produto e a agenda a fingir no mesmo sítio.
   * Agora são dois endereços, e é isso que aqui se afirma:
   *
   *   coreto.org       não é de região nenhuma → a ficha técnica
   *   demo.coreto.org  é a montra → a demonstração, a começar na agenda
   */
  const fichaNoApex = await pagina('coreto.org', '/');
  afirmar(fichaNoApex.includes('versão 2.1'), 'coreto.org/ é a ficha técnica do produto');
  /*
   * E não é a agenda da demonstração, que era o que aqui estava até à 0127.
   *
   * A prova não pode ser a ausência do nome «Vale do Coreto»: a ficha
   * oferece a demonstração e nomeia-a, de propósito. O que a separa da
   * agenda é o programa inventado — se o `coreto.org` mostrar um título da
   * montra, a montra voltou a servir aqui.
   */
  afirmar(
    !fichaNoApex.includes('A Charamela Perdida'),
    'coreto.org/ não é a agenda da montra — a demonstração saiu daqui',
  );
  semFugas(fichaNoApex, 'coreto.org', '/');

  // A demonstração abre na agenda, e não numa página de texto: quem escreve
  // `demo.` já sabe o que isto é e vem ver a coisa a mexer.
  const montra = await pagina(HOST_MONTRA, '/');
  afirmar(montra.includes('Vale do Coreto'), `${HOST_MONTRA}/ apresenta a montra`);
  afirmar(!montra.includes('versão 2.1'), `${HOST_MONTRA}/ é a demonstração, não a ficha técnica`);
  // A demonstração veste a cor do seu promotor (0168), e não a do produto: é
  // a prova de que a cor muda e o produto fica. A folha da paleta e a barra do
  // sistema têm de lá estar.
  afirmar(montra.includes('data-paleta="regiao"'), `${HOST_MONTRA}/ veste a sua paleta`);
  afirmar(
    montra.includes('--color-brand:#1f5c4a') && montra.includes('content="#1f5c4a"'),
    `${HOST_MONTRA}/ veste o verde do seu promotor, e a barra do sistema também`,
  );
  // E diz que é demonstração (C4-008), com o promotor inventado, e mostra os
  // cartazes desenhados para ela (C1-025): servidos pelo próprio sítio.
  afirmar(
    montra.includes('Demonstração do Coreto: território, promotor e eventos inventados.') &&
      montra.includes('<aside aria-label="Demonstração"'),
    `${HOST_MONTRA}/ diz que é uma demonstração, num marco com nome`,
  );
  // E manda conhecer o produto à origem dele, e não ao `SITE_URL` do
  // deployment — que pode ser o domínio de uma região.
  afirmar(
    /<aside aria-label="Demonstração"[^]*?href="https:\/\/coreto\.org"/.test(montra),
    `${HOST_MONTRA}/ aponta «Conhecer o produto» ao coreto.org`,
  );
  afirmar(
    montra.includes('Comunidade Intermunicipal do Vale do Coreto'),
    `${HOST_MONTRA}/ é promovida pelo promotor inventado, e não pela equipa do produto`,
  );
  afirmar(
    montra.includes('/cartaz-ilustrado/'),
    `${HOST_MONTRA}/ mostra os cartazes desenhados para a demonstração`,
  );
  semFugas(montra, HOST_MONTRA, '/');

  // A montra tem programa (0119), inventado de propósito e com datas
  // relativas: um título da agenda e o festival da página dos ciclos. Se a
  // renovação parar e as datas ficarem para trás, é a primeira destas que cai.
  const agendaDaMontra = await pagina(HOST_MONTRA, '/agenda');
  afirmar(
    agendaDaMontra.includes('A Charamela Perdida'),
    `${HOST_MONTRA}/agenda mostra o programa inventado da montra`,
  );
  afirmar(
    agendaDaMontra.includes('data-paleta="regiao"'),
    `${HOST_MONTRA}/agenda veste a sua paleta`,
  );
  semFugas(agendaDaMontra, HOST_MONTRA, '/agenda');
  const ciclosDaMontra = await pagina(HOST_MONTRA, '/ciclos');
  afirmar(
    ciclosDaMontra.includes('Festival do Bombo'),
    `${HOST_MONTRA}/ciclos lista o festival inventado da montra`,
  );
  semFugas(ciclosDaMontra, HOST_MONTRA, '/ciclos');
  // E as outras secções da demonstração, sem uma letra de uma região a sério.
  for (const caminho of ['/coretos', '/espacos', '/mapa']) {
    const corpo = await pagina(HOST_MONTRA, caminho);
    semFugas(corpo, HOST_MONTRA, caminho);
  }

  // Os alias das migrações e do seed de prova: nenhum serve, todos mandam
  // para o canónico da sua região, caminho e query intactos.
  //
  // O `www.coreto.org` saiu desta lista na 0127, e não por descuido. Um alias
  // pertence a uma região, e o `coreto.org` deixou de ter uma: mantê-lo aqui
  // mandava o `www` para a demonstração, que é o contrário do que quem o
  // escreve quer. Passou a redirecionamento de anfitrião no painel de domínios
  // da Vercel, resolvido antes de o pedido chegar à aplicação — e por isso
  // fora do alcance deste guião, que fala com o servidor directamente.
  await redireciona('mediotejo.coreto.org', '/agenda', 'https://coreto.mediotejo.pt/agenda');
  await redireciona(
    'travessia.coreto.example',
    '/agenda?categoria=musica',
    'https://coreto.travessia.example/agenda?categoria=musica',
  );
}

// ---- O glossário interno não chega ao texto servido (C1-005, C2-042, C4-009) ----

/**
 * O texto que uma pessoa chega a ler numa página — ou a ouvir, ou a ver por
 * baixo de uma ligação partilhada: o corpo sem guiões nem estilos, o título,
 * as descrições de partilha e os atributos que um leitor de ecrã diz.
 */
function textoServido(html) {
  const atributos = [
    ...html.matchAll(/<title>([^<]*)<\/title>/g),
    ...html.matchAll(/<meta\s[^>]*(?:name|property)="[^"]*description"[^>]*content="([^"]*)"/g),
    ...html.matchAll(/\s(?:aria-label|alt|title)="([^"]*)"/g),
  ].map((achado) => achado[1]);
  const corpo = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [...atributos, corpo]
    .join(' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(
      /&(?:quot|amp|lt|gt|nbsp|apos);/g,
      (e) =>
        ({ '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&apos;': "'" })[
          e
        ],
    )
    .replace(/\s+/g, ' ');
}

{
  /*
   * «Montra» é como a casa chama, por dentro, à demonstração e à página do
   * produto, e chegou ao público por três caminhos: um componente (a entrada
   * dizia «Todos na mesma montra»), uma migração (o lema da demonstração, que é
   * a descrição de partilha dela) e a declaração de acessibilidade («a gaveta
   * de navegação»). O `check:afirmacoes` vê o primeiro e não vê o segundo,
   * porque lê o código e não a base. Aqui lê-se o que o sítio serve, com a base
   * que as migrações constroem — os três caminhos de uma vez.
   *
   * Só as páginas cujo texto é da casa: as que mostram o que quem organiza
   * escreveu (a ficha, o espaço, os coretos) ficam de fora, porque «uma
   * história guardada numa gaveta» é português, e «rematada a lambrequim» é a
   * arquitetura de um coreto. A lista é a do `scripts/glossario-interno.mjs`.
   */
  const DA_CASA = [
    '/',
    '/agenda',
    '/informacoes',
    '/acessibilidade',
    '/privacidade',
    '/fontes',
    '/estado',
    '/levar',
    '/submeter',
    '/favoritos',
    '/sem-rede',
    '/esta-pagina-nao-existe',
  ];
  const alvos = [
    ...[HOST_MT, HOST_PROVA, HOST_MONTRA].map((host) => ({ host, caminhos: DA_CASA })),
    { host: HOST_DESCONHECIDO, caminhos: ['/', '/fontes', '/seguranca'] },
  ];
  for (const { host, caminhos } of alvos) {
    const achados = [];
    for (const caminho of caminhos) {
      const { corpo } = await pedir(caminho, host);
      const texto = textoServido(corpo);
      for (const termo of GLOSSARIO_INTERNO) {
        const achado = texto.match(palavraInteira(termo));
        if (!achado) continue;
        const i = achado.index ?? 0;
        achados.push(`${caminho} «${texto.slice(Math.max(0, i - 40), i + 40).trim()}»`);
      }
    }
    afirmar(
      achados.length === 0,
      `${host}: nenhum termo do glossário interno no texto servido de ${caminhos.length} páginas` +
        (achados.length > 0 ? ` (encontrei: ${achados.join(' · ')})` : ''),
    );
  }
}

if (falhas > 0) {
  console.error(`\n✗ ${falhas} asserções falharam — há fugas entre regiões ou identidade trocada.`);
  process.exit(1);
}
console.log('\n✓ Cada região no seu domínio, os alias a redirecionar, sem uma fuga.');
