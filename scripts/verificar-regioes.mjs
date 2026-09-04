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
 *
 * É a versão executável da promessa comercial: a segunda CIM nasce com um
 * INSERT, e o CI faz esse INSERT todas as corridas.
 *
 * Vai por `node:http` e não por `fetch`: o `fetch` segue a especificação e a
 * especificação proíbe definir o cabeçalho Host — que é exatamente o que aqui
 * é preciso.
 */
import http from 'node:http';

const BASE = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:3000');

/** Os três chapéus com que se bate à mesma porta. */
const HOST_MT = 'coreto.mediotejo.pt';
const HOST_PROVA = 'coreto.travessia.example';
const HOST_DESCONHECIDO = 'agenda.exemplo-qualquer.pt';
const HOST_MONTRA = 'demo.coreto.org';

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
  // A paleta vermelha é da montra e de mais ninguém: uma região veste o
  // turquesa da casa, e o invólucro que muda a cor nunca pode aparecer aqui.
  afirmar(!inicio.includes('data-paleta="montra"'), `${HOST_MT}/ não veste a paleta da montra`);
  afirmar(inicio.includes('A agenda cultural do Médio Tejo'), `${HOST_MT}/ apresenta o Médio Tejo`);
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
  afirmar(
    privacidade.includes('responsável pelo tratamento'),
    `${HOST_MT}/privacidade publica a política de privacidade, com quem responde por ela`,
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
  // A montra veste vermelho, para não se confundir com a agenda de uma região:
  // o invólucro da paleta e a cor da barra do sistema têm de lá estar.
  afirmar(montra.includes('data-paleta="montra"'), `${HOST_MONTRA}/ veste a paleta da montra`);
  afirmar(
    montra.includes('content="#c2281c"'),
    `${HOST_MONTRA}/ pinta a barra do sistema de vermelho`,
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
    agendaDaMontra.includes('data-paleta="montra"'),
    `${HOST_MONTRA}/agenda veste a paleta da montra`,
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

if (falhas > 0) {
  console.error(`\n✗ ${falhas} asserções falharam — há fugas entre regiões ou identidade trocada.`);
  process.exit(1);
}
console.log('\n✓ Cada região no seu domínio, os alias a redirecionar, sem uma fuga.');
