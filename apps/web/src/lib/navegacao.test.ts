import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  BARRA,
  DESTINOS,
  MAIS,
  RODAPE_ANCORAS,
  RODAPE_PROGRAMAR,
  RODAPE_PROJETO,
  RODAPE_VISITANTE,
  SECCOES_OPCIONAIS,
  caminhoPublico,
  colunasDoRodape,
  comEmailDaRegiao,
  estaEm,
  estaEmMais,
  semAsDesligadas,
} from './navegacao';

/**
 * Qual dos cinco destinos acende na navegação.
 *
 * Dois casos que se enganam sozinhos e que este teste existe para segurar:
 * o `/`, porque qualquer endereço começa por uma barra; e `/agendamento`,
 * que começa pelo mesmo texto que `/agenda` e não é a agenda.
 */
function acende(pathname: string): string | null {
  const activos = DESTINOS.filter((destino) => estaEm(pathname, destino));
  expect(activos.length).toBeLessThanOrEqual(1);
  return activos[0]?.label ?? null;
}

describe('a navegação principal', () => {
  it('acende o destino da própria página', () => {
    expect(acende('/')).toBe('Início');
    expect(acende('/agenda')).toBe('Agenda');
    expect(acende('/mapa')).toBe('Mapa');
    expect(acende('/espacos')).toBe('Espaços');
    expect(acende('/coretos')).toBe('Coretos');
  });

  it('acende o destino das páginas por baixo', () => {
    expect(acende('/evento/festa-de-cem-soldos-abc123')).toBe('Agenda');
    expect(acende('/concelho/tomar')).toBe('Mapa');
    expect(acende('/espaco/cine-teatro-paraiso')).toBe('Espaços');
  });

  it('não acende o Início em todas as páginas', () => {
    expect(acende('/informacoes')).toBeNull();
    expect(acende('/fontes')).toBeNull();
    expect(acende('/submeter')).toBeNull();
  });

  it('não confunde um endereço que começa pelo mesmo texto', () => {
    expect(acende('/agendamento')).toBeNull();
    expect(acende('/espacosinho')).toBeNull();
  });

  it('tem cinco destinos, que é o que cabe num polegar', () => {
    expect(DESTINOS).toHaveLength(5);
    expect(new Set(DESTINOS.map((destino) => destino.href)).size).toBe(5);
  });
});

describe('a gaveta do «+»', () => {
  it('deixa quatro destinos à vista e o quinto lugar para o botão', () => {
    expect(BARRA).toHaveLength(4);
    expect(BARRA.map((destino) => destino.href)).toEqual(['/', '/agenda', '/mapa', '/espacos']);
  });

  it('não perde nenhum destino pelo caminho', () => {
    // A troca do quinto lugar por um botão só é legítima se o que saiu da
    // barra tiver ficado algures. Quem acrescentar um destino e se esquecer
    // da gaveta é apanhado aqui, e não em produção.
    const alcancaveis = new Set([...BARRA, ...MAIS].map((entrada) => entrada.href));
    for (const destino of DESTINOS) {
      expect(alcancaveis.has(destino.href), destino.href).toBe(true);
    }
  });

  it('leva a todas as páginas que não são destinos', () => {
    const gaveta = new Set(MAIS.map((atalho) => atalho.href));
    for (const pagina of ['/submeter', '/fontes', '/levar', '/informacoes', '/ciclos']) {
      expect(gaveta.has(pagina), pagina).toBe(true);
    }
  });

  it('acende o «+» quando a página aberta está lá dentro', () => {
    expect(estaEmMais('/coretos')).toBe(true);
    expect(estaEmMais('/informacoes')).toBe(true);
    expect(estaEmMais('/levar')).toBe(true);
    expect(estaEmMais('/agenda')).toBe(false);
    expect(estaEmMais('/')).toBe(false);
  });

  it('não acende o «+» dentro da caixa embebida', () => {
    // `/widget/tomar` não é uma página deste sítio: é a caixa que corre dentro
    // do iframe do sítio de uma câmara, com a sua própria política de conteúdo
    // e sem a nossa navegação à volta. Enquanto `/widget` esteve na gaveta, a
    // barra acendia lá dentro — o que era uma barra a dizer «estás no Coreto»
    // a quem está no sítio da câmara.
    expect(estaEmMais('/widget/tomar')).toBe(false);
  });

  it('acende o «+» na ficha de um ciclo, que não vive debaixo da lista', () => {
    // `/ciclos` é a lista e `/ciclo/caminhos` é um deles: o segundo não começa
    // pelo primeiro, e sem o prefixo declarado a barra ficava apagada numa
    // página que veio da gaveta.
    expect(estaEmMais('/ciclos')).toBe(true);
    expect(estaEmMais('/ciclo/caminhos')).toBe(true);
  });

  it('não acende o «+» num endereço que só começa pelo mesmo texto', () => {
    expect(estaEmMais('/coretosinho')).toBe(false);
    expect(estaEmMais('/ciclotipo')).toBe(false);
  });

  it('cada entrada escolhe um desenho', () => {
    // O tipo já obriga a que o campo exista e a que o mapa da barra tenha o
    // desenho. O que este teste segura é a outra metade: dois atalhos com o
    // mesmo ícone davam uma gaveta onde duas linhas se confundem.
    const icones = MAIS.map((atalho) => atalho.icone);
    expect(new Set(icones).size, `ícones repetidos: ${icones.join(', ')}`).toBe(MAIS.length);
  });

  it('não deixa o email tentar acender coisa nenhuma', () => {
    // `estaEmMais` compara com `pathname`, e um `mailto:` nunca é um
    // caminho — mas a lista tem uma entrada externa e vale a pena que o
    // filtro que a exclui esteja preso por um teste.
    const externos = MAIS.filter((atalho) => atalho.externo);
    expect(externos).toHaveLength(1);
    expect(externos[0]?.href.startsWith('mailto:')).toBe(true);
    expect(estaEmMais('mailto:coreto@exemplo.pt')).toBe(false);
  });

  it('o endereço da região entra pela entrada do email, e só por ela', () => {
    // O mapa é estrutura e não sabe de que região é; `comEmailDaRegiao`
    // preenche a única entrada que muda de CIM para CIM.
    const preenchidos = comEmailDaRegiao(MAIS, 'coreto@exemplo.pt');
    const email = preenchidos.find((atalho) => atalho.icone === 'email');
    expect(email?.href).toBe('mailto:coreto@exemplo.pt');
    expect(email?.nota).toBe('coreto@exemplo.pt');
    expect(preenchidos.filter((a) => a.href.includes('exemplo.pt'))).toHaveLength(1);
  });

  it('não repete entradas', () => {
    const hrefs = MAIS.map((atalho) => atalho.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

/**
 * O rodapé é a gaveta do ecrã largo.
 *
 * A barra de baixo é `sm:hidden`: num computador a gaveta do «+» **não
 * existe**, e tudo o que não está no cabeçalho só se alcança pelo rodapé. As
 * duas listas eram escritas em ficheiros diferentes e tinham divergido — ao
 * rodapé faltavam os Coretos e o «Escrever-nos», e chamava «O que é o Coreto»
 * ao que a gaveta chama «Informações». Quem procurasse no computador uma coisa
 * que viu no telemóvel não a encontrava.
 */
describe('o rodapé e a gaveta', () => {
  it('mostram exactamente os mesmos destinos', () => {
    const naGaveta = new Set(MAIS.map((atalho) => atalho.href));
    const noRodape = new Set(
      [...RODAPE_VISITANTE, ...RODAPE_PROGRAMAR, ...RODAPE_PROJETO].map((item) => item.href),
    );
    expect(noRodape).toEqual(naGaveta);
  });

  it('não repetem um destino em duas colunas nem o deixam fora das duas', () => {
    const colunas = [...RODAPE_VISITANTE, ...RODAPE_PROGRAMAR, ...RODAPE_PROJETO].map(
      (item) => item.href,
    );
    expect(colunas).toHaveLength(MAIS.length);
    expect(new Set(colunas).size).toBe(colunas.length);
  });

  it('chamam a cada página o mesmo nome nas duas superfícies', () => {
    // «Coretos» no cabeçalho e «Coretos da região» na gaveta eram dois nomes
    // para o mesmo sítio, e quem carrega tem de reconhecer onde chegou pelo
    // nome por que veio.
    const rotuloNaGaveta = new Map(MAIS.map((atalho) => [atalho.href, atalho.label]));
    for (const item of [...RODAPE_VISITANTE, ...RODAPE_PROGRAMAR, ...RODAPE_PROJETO]) {
      expect(item.label, item.href).toBe(rotuloNaGaveta.get(item.href));
    }
    for (const destino of DESTINOS) {
      const naGaveta = rotuloNaGaveta.get(destino.href);
      if (naGaveta) expect(naGaveta, destino.href).toBe(destino.label);
    }
  });

  it('a declaração de acessibilidade continua alcançável de qualquer página', () => {
    // O Decreto-Lei n.º 83/2018 quer-a alcançável de qualquer página, e o
    // rodapé é a única superfície que está em todas. A política de
    // privacidade vai ao lado, pela mesma porta.
    const ligacoes = RODAPE_ANCORAS.projeto.map((item) => item.href);
    expect(ligacoes).toContain('/acessibilidade');
    expect(ligacoes).toContain('/privacidade');
  });

  it('as páginas legais não têm interruptor', () => {
    // Foram âncoras de `/informacoes` e caíam com ela: desligada a página, o
    // rodapé apontava a um 404 num texto que a lei quer sempre de pé. Uma
    // `seccao` aqui era o mesmo erro a voltar.
    const todas = [...RODAPE_ANCORAS.programar, ...RODAPE_ANCORAS.projeto];
    expect(todas.length).toBeGreaterThan(0);
    for (const item of todas) expect(item.seccao, item.href).toBeUndefined();
  });

  it('as ligações a mais do rodapé não repetem a gaveta', () => {
    // O que está aqui é o que a gaveta não tem. Uma entrada que também
    // estivesse em `MAIS` aparecia duas vezes na mesma coluna.
    const naGaveta = new Set(MAIS.map((atalho) => atalho.href));
    const todas = [...RODAPE_ANCORAS.programar, ...RODAPE_ANCORAS.projeto];
    for (const item of todas) expect(naGaveta.has(item.href), item.href).toBe(false);
  });
});

describe('as secções que se desligam no painel', () => {
  it('são quatro, e cada uma tem uma entrada na gaveta', () => {
    // O painel desenha os interruptores a partir de `MAIS` — é de lá que sai o
    // nome e a linha de cada um. Uma secção declarada aqui e ausente da gaveta
    // era um interruptor sem rótulo, ou pior: uma secção que ninguém consegue
    // voltar a ligar.
    const naGaveta = MAIS.filter((atalho) => atalho.seccao !== undefined).map(
      (atalho) => atalho.seccao,
    );
    expect([...naGaveta].sort()).toEqual([...SECCOES_OPCIONAIS].sort());
  });

  it('marcam a mesma página com a mesma secção nas duas superfícies', () => {
    // Os Coretos estão no cabeçalho e na gaveta. Marcar um e esquecer o outro
    // dava um cabeçalho a oferecer o que a gaveta já escondeu.
    const naGaveta = new Map(MAIS.map((atalho) => [atalho.href, atalho.seccao]));
    for (const destino of DESTINOS) {
      if (!naGaveta.has(destino.href)) continue;
      expect(destino.seccao, destino.href).toBe(naGaveta.get(destino.href));
    }
  });

  it('não desligam nada que a agenda precise', () => {
    // A agenda, o mapa, os espaços e o envio de eventos são a casa. Se alguma
    // vez ganharem uma secção, é porque alguém se enganou a escrever.
    const sempre = ['/', '/agenda', '/mapa', '/espacos', '/submeter', '/levar'];
    for (const item of [...DESTINOS, ...MAIS]) {
      if (sempre.includes(item.href)) expect(item.seccao, item.href).toBeUndefined();
    }
  });
});

describe('o que fica de pé com uma secção desligada', () => {
  it('sem nada desligado, devolve tudo', () => {
    expect(semAsDesligadas(MAIS, [])).toHaveLength(MAIS.length);
    expect(semAsDesligadas(DESTINOS, [])).toHaveLength(DESTINOS.length);
  });

  it('tira o destino do cabeçalho e a entrada da gaveta ao mesmo tempo', () => {
    expect(semAsDesligadas(DESTINOS, ['coretos']).map((d) => d.href)).not.toContain('/coretos');
    expect(semAsDesligadas(MAIS, ['coretos']).map((a) => a.href)).not.toContain('/coretos');
  });

  it('não toca no que não tem secção', () => {
    const restantes = comEmailDaRegiao(
      semAsDesligadas(MAIS, [...SECCOES_OPCIONAIS]),
      'coreto@exemplo.pt',
    ).map((atalho) => atalho.href);
    // Os guardados não são uma secção que se desligue: vivem no navegador de
    // quem visita e não dependem de nada que a base sirva.
    expect(restantes).toEqual(['/favoritos', '/submeter', '/levar', 'mailto:coreto@exemplo.pt']);
  });

  it('deixa de pé a privacidade e a acessibilidade quando as informações se apagam', () => {
    // A política e a declaração viveram dentro de `/informacoes`, e desligar
    // a página levava-as para um 404 — um texto que a lei quer alcançável de
    // qualquer página. Hoje têm endereço próprio e não há interruptor que as
    // apague: sai a página das informações, ficam as duas.
    const rodape = semAsDesligadas([...RODAPE_PROJETO, ...RODAPE_ANCORAS.projeto], ['informacoes']);
    const hrefs = rodape.map((item) => item.href);
    expect(hrefs).not.toContain('/informacoes');
    expect(hrefs).toContain('/privacidade');
    expect(hrefs).toContain('/acessibilidade');
    // Os coretos são de quem visita e mudaram de coluna; continuam de pé.
    expect(semAsDesligadas(RODAPE_VISITANTE, ['informacoes']).map((i) => i.href)).toContain(
      '/coretos',
    );
  });

  it('devolve uma lista nova e não a original', () => {
    const saida = semAsDesligadas(MAIS, []);
    expect(saida).not.toBe(MAIS);
  });
});

describe('as colunas do rodapé', () => {
  it('são três enquanto as três audiências têm de que falar', () => {
    // A terceira coluna nasceu com os guardados: o que é de quem visita — o
    // que guardou, os coretos, os ciclos — estava dentro de «O projeto», que
    // é onde se diz quem somos, e não é a mesma pergunta.
    const colunas = colunasDoRodape([], 'coreto@exemplo.pt');
    expect(colunas.map((c) => c.titulo)).toEqual(['Para si', 'Para quem programa', 'O projeto']);
    expect(colunas.every((c) => c.itens.length >= 2)).toBe(true);
    expect(colunas[0]?.itens.map((i) => i.href)).toEqual(['/favoritos', '/coretos', '/ciclos']);
  });

  it('juntam-se numa só com tudo desligado, porque «Para si» fica com uma linha', () => {
    // A regra de nunca deixar uma coluna com uma linha só é a mesma de
    // sempre: um título com uma linha por baixo lê-se como coisa partida.
    // Com as quatro secções desligadas caem os coretos e os ciclos, «Para si»
    // fica com os guardados e mais nada, e as três juntam-se — sem perder um
    // único destino, que é o que este teste segura.
    const colunas = colunasDoRodape([...SECCOES_OPCIONAIS], 'coreto@exemplo.pt');
    expect(colunas.map((c) => c.titulo)).toEqual(['No sítio']);
    expect(colunas[0]?.itens.map((i) => i.href)).toEqual([
      '/favoritos',
      '/submeter',
      '/levar',
      'mailto:coreto@exemplo.pt',
      '/privacidade',
      '/acessibilidade',
      '/estado',
    ]);
  });

  it('levam as páginas legais em todas as combinações', () => {
    // «Alcançável de qualquer página» quer dizer em qualquer estado do
    // painel, e não só no de hoje.
    for (let mascara = 0; mascara < 1 << SECCOES_OPCIONAIS.length; mascara += 1) {
      const desligadas = SECCOES_OPCIONAIS.filter((_, i) => (mascara >> i) & 1);
      const noRodape = colunasDoRodape([...desligadas], 'coreto@exemplo.pt').flatMap((c) =>
        c.itens.map((i) => i.href),
      );
      expect(noRodape, desligadas.join(',')).toContain('/privacidade');
      expect(noRodape, desligadas.join(',')).toContain('/acessibilidade');
    }
  });

  it('nunca deixam um título sem nada por baixo', () => {
    // Toda a combinação possível de secções desligadas, e não só as que
    // alguém se lembrou de experimentar.
    const combinacoes = [];
    for (let mascara = 0; mascara < 1 << SECCOES_OPCIONAIS.length; mascara += 1) {
      combinacoes.push(SECCOES_OPCIONAIS.filter((_, i) => (mascara >> i) & 1));
    }
    for (const desligadas of combinacoes) {
      for (const coluna of colunasDoRodape([...desligadas], 'coreto@exemplo.pt')) {
        expect(
          coluna.itens.length,
          `${coluna.titulo} com ${desligadas.join(',')}`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('não perdem nenhuma ligação pelo caminho', () => {
    // Juntar duas colunas numa não pode ser uma desculpa para deixar cair uma
    // entrada: o que sobrevive ao interruptor tem de aparecer.
    const desligadas = ['coretos', 'ciclos', 'fontes'] as const;
    const naGaveta = comEmailDaRegiao(
      semAsDesligadas(MAIS, [...desligadas]),
      'coreto@exemplo.pt',
    ).map((a) => a.href);
    const noRodape = colunasDoRodape([...desligadas], 'coreto@exemplo.pt').flatMap((c) =>
      c.itens.map((i) => i.href),
    );
    for (const href of naGaveta) expect(noRodape, href).toContain(href);
  });
});

describe('a auditoria de acessibilidade sabe quais são as secções', () => {
  it('a lista do script coincide com a do código', () => {
    /*
     * `scripts/check-a11y.mjs` é um script de Node solto — não passa pelo
     * empacotador e não importa TypeScript daqui —, por isso repete os quatro
     * identificadores à mão. Repetidos sem cadeado, divergiam: uma secção nova
     * ficaria a reprovar a auditoria no dia em que alguém a desligasse.
     */
    const script = readFileSync('scripts/check-a11y.mjs', 'utf8');
    const bloco = script.match(/const ROTAS_DE_SECCAO = \[([^\]]*)\]/)?.[1] ?? '';
    const rotas = [...bloco.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(rotas).toEqual(SECCOES_OPCIONAIS.map((s) => `/${s}`).sort());
  });
});

describe('caminhoPublico', () => {
  /*
   * O que isto protege: na pré-geração o `usePathname` traz o caminho
   * interno, com o segmento `[regiao]` dentro; no navegador traz o público.
   * A navegação tem de acender o mesmo destino nos dois lados, senão o HTML
   * servido discorda da hidratação.
   */
  it('tira o segmento da região quando ele lá está', () => {
    expect(caminhoPublico('/medio-tejo/espacos', 'medio-tejo')).toBe('/espacos');
    expect(caminhoPublico('/medio-tejo', 'medio-tejo')).toBe('/');
  });

  it('deixa em paz um caminho que já é público', () => {
    expect(caminhoPublico('/espacos', 'medio-tejo')).toBe('/espacos');
    expect(caminhoPublico('/', 'medio-tejo')).toBe('/');
  });

  it('não confunde um prefixo parecido com o segmento', () => {
    // «/medio-tejo-norte/…» não é o segmento «medio-tejo»: compara-se por
    // segmento inteiro, não por texto.
    expect(caminhoPublico('/medio-tejo-norte/espacos', 'medio-tejo')).toBe(
      '/medio-tejo-norte/espacos',
    );
  });

  it('acende o mesmo destino visto dos dois lados', () => {
    const interno = caminhoPublico('/medio-tejo/agenda', 'medio-tejo');
    const publico = caminhoPublico('/agenda', 'medio-tejo');
    expect(interno).toBe(publico);
  });
});
