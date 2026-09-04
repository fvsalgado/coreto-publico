import { describe, expect, it } from 'vitest';
import {
  CATALOGO,
  type Escolhas,
  codigoDoScript,
  consultaDoWidget,
  enderecoDoWidget,
  lerOpcoes,
} from './opcoes';

const BASE: Escolhas = {
  concelho: 'tomar',
  limite: 5,
  gratis: false,
  disposicao: 'cartazes',
  tema: 'auto',
  cabecalho: true,
  moldura: true,
};

describe('lerOpcoes', () => {
  it('dá os valores de fábrica a uma consulta vazia', () => {
    expect(lerOpcoes({})).toMatchObject({
      limit: 5,
      free: false,
      theme: 'auto',
      layout: 'cartazes',
      header: true,
      frame: true,
    });
  });

  it('nunca parte com um valor mau — cai no de fábrica', () => {
    // O contrato de todo este módulo: um erro de escrita no sítio de uma
    // câmara vale o valor por omissão, e não um widget em branco.
    const opcoes = lerOpcoes({
      limit: 'muitos',
      theme: 'roxo',
      layout: 'carrossel',
      category: 'MÚSICA!!',
      venue: '../../etc/passwd',
    });
    expect(opcoes.limit).toBe(5);
    expect(opcoes.theme).toBe('auto');
    expect(opcoes.layout).toBe('cartazes');
    expect(opcoes.category).toBeUndefined();
    expect(opcoes.venue).toBeUndefined();
  });

  it('trava o limite nos extremos em vez de aceitar mil eventos', () => {
    expect(lerOpcoes({ limit: '0' }).limit).toBe(5);
    expect(lerOpcoes({ limit: '999' }).limit).toBe(5);
    expect(lerOpcoes({ limit: '20' }).limit).toBe(20);
    expect(lerOpcoes({ limit: '1' }).limit).toBe(1);
  });

  it('entende sim e não nas duas línguas e com acento', () => {
    expect(lerOpcoes({ header: 'nao' }).header).toBe(false);
    expect(lerOpcoes({ header: 'não' }).header).toBe(false);
    expect(lerOpcoes({ header: 'false' }).header).toBe(false);
    expect(lerOpcoes({ header: 'sim' }).header).toBe(true);
    expect(lerOpcoes({ free: 'sim' }).free).toBe(true);
    expect(lerOpcoes({ free: '1' }).free).toBe(true);
    // Um valor que não é nem uma coisa nem outra fica no de fábrica.
    expect(lerOpcoes({ header: 'talvez' }).header).toBe(true);
    expect(lerOpcoes({ free: 'talvez' }).free).toBe(false);
  });

  it('lê o primeiro valor quando o parâmetro vem repetido', () => {
    expect(lerOpcoes({ limit: ['3', '9'] }).limit).toBe(3);
  });
});

describe('consultaDoWidget', () => {
  it('não escreve nada quando tudo é de fábrica', () => {
    // Um endereço limpo é mais fácil de copiar sem estragar, e `?limit=5` e o
    // endereço nu seriam a mesma página com duas chaves de cache.
    expect(consultaDoWidget(BASE)).toBe('');
    expect(enderecoDoWidget('https://x.pt', BASE)).toBe('https://x.pt/widget/tomar');
  });

  it('escreve só o que difere', () => {
    expect(consultaDoWidget({ ...BASE, limite: 3, gratis: true })).toBe('limit=3&free=1');
    expect(consultaDoWidget({ ...BASE, disposicao: 'lista' })).toBe('layout=lista');
    expect(consultaDoWidget({ ...BASE, cabecalho: false, moldura: false })).toBe(
      'header=nao&frame=nao',
    );
  });

  it('codifica o cardinal da cor, que numa consulta corta o resto', () => {
    expect(consultaDoWidget({ ...BASE, cor: '#b0122a' })).toBe('color=%23b0122a');
  });

  it('faz uma ida e volta: o que o construtor escreve, a página lê', () => {
    const escolhas: Escolhas = {
      ...BASE,
      espaco: 'teatro-virginia',
      categoria: 'musica',
      limite: 8,
      gratis: true,
      disposicao: 'mural',
      tema: 'dark',
      letra: 'Open Sans, sans-serif',
      pesquisa: 'noite de fados & marchas',
      cabecalho: false,
      moldura: false,
    };
    const consulta = new URLSearchParams(consultaDoWidget(escolhas));
    const lido = lerOpcoes(Object.fromEntries(consulta.entries()));

    expect(lido.venue).toBe('teatro-virginia');
    expect(lido.category).toBe('musica');
    expect(lido.q).toBe('noite de fados & marchas');
    expect(lido.limit).toBe(8);
    expect(lido.free).toBe(true);
    expect(lido.layout).toBe('mural');
    expect(lido.theme).toBe('dark');
    expect(lido.font).toBe('Open Sans, sans-serif');
    expect(lido.header).toBe(false);
    expect(lido.frame).toBe(false);
  });
});

describe('codigoDoScript', () => {
  it('só escreve as linhas que fazem falta', () => {
    const codigo = codigoDoScript('https://x.pt', BASE);
    expect(codigo).toContain('data-concelho="tomar"');
    expect(codigo).not.toContain('data-limit');
    expect(codigo).not.toContain('data-tema');
    expect(codigo.trimEnd().endsWith('async></script>')).toBe(true);
  });

  it('acrescenta o que foi escolhido', () => {
    const codigo = codigoDoScript('https://x.pt', {
      ...BASE,
      espaco: 'miaa',
      cor: '#b0122a',
      disposicao: 'mural',
    });
    expect(codigo).toContain('data-espaco="miaa"');
    expect(codigo).toContain('data-cor="#b0122a"');
    expect(codigo).toContain('data-disposicao="mural"');
  });
});

describe('CATALOGO', () => {
  it('documenta cada atributo uma vez só', () => {
    const atributos = CATALOGO.map((o) => o.atributo);
    expect(new Set(atributos).size).toBe(atributos.length);
  });

  it('cobre todos os parâmetros que a página lê', () => {
    // Já houve uma opção documentada que a página não lia. O catálogo é a
    // fonte única, e este teste é o que a mantém honesta.
    const documentados = new Set(CATALOGO.map((o) => o.parametro));
    for (const parametro of [
      'venue',
      'category',
      'q',
      'limit',
      'free',
      'layout',
      'color',
      'theme',
      'font',
      'header',
      'frame',
    ]) {
      expect(documentados.has(parametro), parametro).toBe(true);
    }
  });
});

/**
 * O ciclo entrou tarde: a API aceitava `series` desde o princípio e a caixa
 * embebível não, o que deixava quem organiza um festival sem forma de mostrar
 * o programa dele no seu próprio sítio.
 */
describe('o filtro por ciclo', () => {
  it('lê `series` do endereço', () => {
    expect(lerOpcoes({ series: ' CAMINHOS ' }).series).toBe('caminhos');
  });

  it('vai na consulta e no código para colar', () => {
    const escolhas = {
      concelho: 'tomar',
      ciclo: 'caminhos',
      limite: 5,
      gratis: false,
      disposicao: 'cartazes' as const,
      tema: 'auto' as const,
      cabecalho: true,
      moldura: true,
    };
    expect(consultaDoWidget(escolhas)).toBe('series=caminhos');
    expect(codigoDoScript('https://exemplo.pt', escolhas)).toContain('data-ciclo="caminhos"');
  });
});
