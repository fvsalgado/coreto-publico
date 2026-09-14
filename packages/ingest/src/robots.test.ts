import { describe, expect, it } from 'vitest';
import { caminhoDe, lerRobots, podeLer, robotsDe, SEM_RESTRICOES } from './robots.js';

/** Lê e pergunta de uma vez, que é como isto se usa. */
function deixa(ficheiro: string, caminho: string, produto?: string): boolean {
  return podeLer(lerRobots(ficheiro, produto), caminho);
}

describe('lerRobots — escolher o grupo', () => {
  it('sem ficheiro nenhum, não há restrições', () => {
    expect(lerRobots('')).toEqual(SEM_RESTRICOES);
    expect(deixa('', '/qualquer/coisa')).toBe(true);
  });

  it('usa o grupo do «*» quando não há nenhum para nós', () => {
    const regras = lerRobots('User-agent: *\nDisallow: /privado/');
    expect(regras.grupo).toBe('*');
    expect(podeLer(regras, '/privado/x')).toBe(false);
    expect(podeLer(regras, '/publico/x')).toBe(true);
  });

  /**
   * Vale um grupo só, e é o mais específico.
   *
   * É a regra que mais custa a quem a ignora: um sítio que escreve um grupo
   * para nós, mais permissivo do que o do `*`, espera que a gente leia o
   * nosso. Somar os dois seria obedecer a uma ordem que não nos foi dada.
   */
  it('quando há um grupo com o nosso nome, o do «*» deixa de contar', () => {
    const ficheiro = ['User-agent: *', 'Disallow: /', '', 'User-agent: Coreto', 'Disallow:'].join(
      '\n',
    );
    expect(lerRobots(ficheiro).grupo).toBe('coreto');
    expect(deixa(ficheiro, '/agenda')).toBe(true);
  });

  it('e o inverso também: um grupo para nós mais apertado do que o do «*»', () => {
    const ficheiro = [
      'User-agent: *',
      'Disallow:',
      '',
      'User-agent: Coreto',
      'Disallow: /agenda/',
    ].join('\n');
    expect(deixa(ficheiro, '/agenda/setembro')).toBe(false);
    expect(deixa(ficheiro, '/noticias')).toBe(true);
  });

  it('o nome do agente não é sensível a maiúsculas', () => {
    expect(lerRobots('User-agent: CORETO\nDisallow: /x').grupo).toBe('coreto');
    expect(lerRobots('user-AGENT: Coreto\nDisallow: /x').grupo).toBe('coreto');
  });

  /**
   * Um grupo escrito para outro agente não é para nós, mesmo que se pareça.
   *
   * Sem isto, «CoretoBot» — que é outra coisa, de outra gente — passava a
   * mandar nesta casa. E «Core», que é um prefixo do nosso nome, também.
   */
  it('não apanha grupos de nomes parecidos', () => {
    expect(lerRobots('User-agent: CoretoBot\nDisallow: /').grupo).toBe(null);
    expect(lerRobots('User-agent: Core\nDisallow: /').grupo).toBe(null);
    expect(deixa('User-agent: CoretoBot\nDisallow: /', '/agenda')).toBe(true);
  });

  it('duas linhas de agente seguidas partilham as mesmas regras', () => {
    const ficheiro = ['User-agent: Coreto', 'User-agent: OutroQualquer', 'Disallow: /x'].join('\n');
    expect(deixa(ficheiro, '/x')).toBe(false);
  });

  it('mas uma linha de agente depois de uma regra começa outro grupo', () => {
    const ficheiro = [
      'User-agent: OutroQualquer',
      'Disallow: /',
      'User-agent: Coreto',
      'Disallow: /so-isto/',
    ].join('\n');
    expect(deixa(ficheiro, '/agenda')).toBe(true);
    expect(deixa(ficheiro, '/so-isto/x')).toBe(false);
  });

  it('o mesmo agente em dois blocos soma as regras dos dois', () => {
    const ficheiro = [
      'User-agent: Coreto',
      'Disallow: /um/',
      '',
      'User-agent: Coreto',
      'Disallow: /dois/',
    ].join('\n');
    expect(deixa(ficheiro, '/um/x')).toBe(false);
    expect(deixa(ficheiro, '/dois/x')).toBe(false);
    expect(deixa(ficheiro, '/tres/x')).toBe(true);
  });
});

describe('podeLer — qual das regras ganha', () => {
  it('«Disallow:» sem valor não proíbe nada', () => {
    expect(deixa('User-agent: *\nDisallow:', '/seja-o-que-for')).toBe(true);
  });

  it('«Disallow: /» proíbe tudo', () => {
    expect(deixa('User-agent: *\nDisallow: /', '/')).toBe(false);
    expect(deixa('User-agent: *\nDisallow: /', '/agenda')).toBe(false);
  });

  /** É a forma da RFC: entre duas que casam, ganha a mais comprida. */
  it('ganha a regra mais comprida, não a que vem primeiro', () => {
    const ficheiro = ['User-agent: *', 'Disallow: /pasta/', 'Allow: /pasta/agenda'].join('\n');
    expect(deixa(ficheiro, '/pasta/agenda')).toBe(true);
    expect(deixa(ficheiro, '/pasta/outra-coisa')).toBe(false);
  });

  it('e a ordem inversa dá o mesmo, porque não é a ordem que decide', () => {
    const ficheiro = ['User-agent: *', 'Allow: /pasta/agenda', 'Disallow: /pasta/'].join('\n');
    expect(deixa(ficheiro, '/pasta/agenda')).toBe(true);
  });

  /**
   * Empate ganha o `Allow`.
   *
   * Quem escreveu as duas regras exatamente para o mesmo caminho quis deixar
   * passar — e na dúvida, a leitura que não inventa uma proibição é a certa.
   */
  it('em empate, o «Allow» ganha ao «Disallow»', () => {
    expect(deixa('User-agent: *\nDisallow: /x\nAllow: /x', '/x')).toBe(true);
    expect(deixa('User-agent: *\nAllow: /x\nDisallow: /x', '/x')).toBe(true);
  });

  it('o «*» casa qualquer sequência', () => {
    const ficheiro = 'User-agent: *\nDisallow: /*/privado';
    expect(deixa(ficheiro, '/a/privado')).toBe(false);
    expect(deixa(ficheiro, '/a/b/c/privado')).toBe(false);
    expect(deixa(ficheiro, '/privado')).toBe(true);
  });

  it('o «$» prende o fim do caminho', () => {
    const ficheiro = 'User-agent: *\nDisallow: /agenda$';
    expect(deixa(ficheiro, '/agenda')).toBe(false);
    expect(deixa(ficheiro, '/agenda/setembro')).toBe(true);
    expect(deixa(ficheiro, '/agenda?mes=9')).toBe(true);
  });

  /**
   * Um caminho verdadeiro traz pontos, parênteses e sinais de mais, e nenhum
   * deles quer dizer numa regra o que quer dizer numa expressão regular. Sem
   * escape, «/index.php» passava a casar «/indexXphp».
   */
  it('não confunde pontuação do caminho com sintaxe de expressão', () => {
    expect(deixa('User-agent: *\nDisallow: /index.php', '/indexXphp')).toBe(true);
    expect(deixa('User-agent: *\nDisallow: /index.php', '/index.php')).toBe(false);
    expect(deixa('User-agent: *\nDisallow: /a+b', '/aab')).toBe(true);
    expect(deixa('User-agent: *\nDisallow: /a(b)', '/a(b)')).toBe(false);
  });

  it('a regra casa por prefixo, que é como o ficheiro a escreve', () => {
    expect(deixa('User-agent: *\nDisallow: /admin', '/administrator/x')).toBe(false);
    expect(deixa('User-agent: *\nDisallow: /admin/', '/administrator/x')).toBe(true);
  });

  it('os comentários não fazem parte do valor', () => {
    expect(deixa('User-agent: *  # toda a gente\nDisallow: /x  # a pasta velha', '/x')).toBe(false);
    expect(deixa('# só um comentário\nUser-agent: *\nDisallow: /x', '/y')).toBe(true);
  });

  it('linhas sem dois pontos e campos que não conhecemos são ignorados', () => {
    const ficheiro = [
      'Sitemap: https://exemplo.pt/sitemap.xml',
      'Crawl-delay: 10',
      'isto não é uma linha válida',
      'User-agent: *',
      'Disallow: /x',
    ].join('\n');
    expect(deixa(ficheiro, '/x')).toBe(false);
    expect(deixa(ficheiro, '/y')).toBe(true);
  });

  it('uma regra antes de qualquer agente não pertence a ninguém', () => {
    expect(deixa('Disallow: /x\nUser-agent: *\nDisallow: /y', '/x')).toBe(true);
    expect(deixa('Disallow: /x\nUser-agent: *\nDisallow: /y', '/y')).toBe(false);
  });
});

/**
 * O `robots.txt` fala de caminhos, e a consulta faz parte do caminho.
 *
 * A agenda de Ourém é `\/api\/index.php?service=list_eventos`. Deitar fora a
 * interrogação faria uma regra escrita para aquela consulta deixar de casar —
 * e uma proibição que não casa é uma proibição que se desobedece sem dar por
 * isso.
 */
describe('caminhoDe e robotsDe', () => {
  it('o caminho leva a consulta atrás', () => {
    expect(caminhoDe('https://servicos.ourem.pt/api/index.php?service=list_eventos')).toBe(
      '/api/index.php?service=list_eventos',
    );
  });

  it('uma raiz sem caminho é «/»', () => {
    expect(caminhoDe('https://exemplo.pt')).toBe('/');
  });

  it('o robots.txt é sempre o da raiz do hospedeiro, e não o da pasta', () => {
    expect(robotsDe('https://exemplo.pt/uma/pasta/funda?x=1')).toBe(
      'https://exemplo.pt/robots.txt',
    );
    expect(robotsDe('https://exemplo.pt:8443/x')).toBe('https://exemplo.pt:8443/robots.txt');
  });

  it('um endereço que não se percebe não rebenta', () => {
    expect(robotsDe('nem endereço é')).toBe(null);
    expect(caminhoDe('nem endereço é')).toBe('/');
  });
});

/**
 * Os ficheiros verdadeiros das fontes desta casa, medidos a 14/09/2026.
 *
 * A decisão de cumprir o `robots.txt` foi tomada depois de se contar o que
 * custava: das quarenta fontes, trinta e duas responderam e **as trinta e duas
 * deixam ler a agenda**. Zero perdidas. As outras oito estão bloqueadas pela
 * máquina da CIM e não se conseguiu saber — que é resposta diferente de «não
 * há».
 *
 * Estes três são os moldes que cobrem trinta e nove das quarenta: Joomla nas
 * câmaras e no Teatro Virgínia, o portal das juntas, e WordPress no Centro
 * Cultural Gil Vicente. Se algum dia o molde mudar e passar a proibir, é aqui
 * que se vê primeiro.
 */
describe('os ficheiros que as fontes servem de facto', () => {
  it('o Joomla das câmaras proíbe a administração e deixa a agenda', () => {
    const joomla = [
      '# If the Joomla site is installed within a folder',
      'User-agent: *',
      'Disallow: /administrator/',
      'Disallow: /api/',
      'Disallow: /bin/',
      'Disallow: /cache/',
      'Disallow: /cli/',
      'Disallow: /components/',
      'Disallow: /includes/',
      'Disallow: /installation/',
      'Disallow: /language/',
      'Disallow: /layouts/',
      'Disallow: /libraries/',
      'Disallow: /logs/',
      'Disallow: /modules/',
      'Disallow: /plugins/',
      'Disallow: /tmp/',
    ].join('\n');

    expect(deixa(joomla, '/comunicacao/agenda')).toBe(true);
    expect(deixa(joomla, '/index.php/comunicacao/agenda')).toBe(true);
    expect(deixa(joomla, '/index.php/cinema/cinema')).toBe(true);
    // E a administração continua fora, que é o que o ficheiro quer dizer.
    expect(deixa(joomla, '/administrator/index.php')).toBe(false);
    expect(deixa(joomla, '/cache/x')).toBe(false);
  });

  it('o portal das juntas não impõe nada', () => {
    expect(deixa('User-agent: *\nDisallow:', '/freguesia/agenda')).toBe(true);
  });

  it('o WordPress do Gil Vicente deixa a programação', () => {
    const wp = [
      'User-agent: *',
      'Disallow: /wp-admin/',
      'Allow: /wp-admin/admin-ajax.php',
      '',
      'Sitemap: https://ccgv.sardoal.pt/sitemap_index.xml',
    ].join('\n');

    expect(deixa(wp, '/programacao/')).toBe(true);
    expect(deixa(wp, '/wp-admin/')).toBe(false);
    // A excepção do próprio ficheiro, que é o caso do `Allow` mais comprido.
    expect(deixa(wp, '/wp-admin/admin-ajax.php')).toBe(true);
  });
});
