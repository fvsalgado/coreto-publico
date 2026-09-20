import { describe, expect, it } from 'vitest';
import {
  CAMINHO_DO_PORTAO,
  PORTAO_TTL_SEGUNDOS,
  criarBilhete,
  lerBilhete,
  temBarreira,
} from './portao';
import { createSessionToken, readSessionToken } from './admin/session';

const SEGREDO = 'um-segredo-de-teste-com-tamanho-que-chegue';

/**
 * O que a barreira tapa, e o que deixa passar.
 *
 * A lista do módulo é a do que fica **aberto**, e a razão é esta: uma página
 * nova nasce tapada, e o que pode correr mal é um feed novo ficar fechado —
 * que se vê e se corrige numa linha. O teste prova os dois lados, porque um
 * teste só do que fecha não dava pela lista a encolher.
 */
describe('temBarreira', () => {
  it('as páginas passam pela barreira', () => {
    for (const caminho of ['/', '/agenda', '/mapa', '/coretos', '/tomar', '/evento/abc']) {
      expect(temBarreira(caminho)).toBe(true);
    }
  });

  it('uma página que ainda não existe nasce tapada', () => {
    // O ponto da lista invertida: nada aqui sabe que `/novidade` existe, e
    // mesmo assim `/novidade` fica do lado de dentro.
    expect(temBarreira('/uma-seccao-que-ainda-nao-foi-escrita')).toBe(true);
  });

  it('a própria página da senha não se tapa a si mesma', () => {
    // Sem isto, o portão reescrevia para o portão, que reescrevia para o
    // portão: uma região tapada sem porta.
    expect(temBarreira(CAMINHO_DO_PORTAO)).toBe(false);
  });

  it('os feeds, os dados e os ficheiros de máquina ficam abertos, por escolha', () => {
    // Quem pediu a barreira escolheu cobrir só as páginas, por ser o mais
    // simples para uma coisa temporária. Está escrito no painel a quem a liga,
    // e está aqui, para não deixar de ser verdade em silêncio.
    for (const caminho of [
      '/fontes',
      '/feed.xml',
      '/agenda.ics',
      '/dados.json',
      '/dados.csv',
      '/estado.json',
      '/api/events',
      '/robots.txt',
      '/sitemap.xml',
      '/manifest.webmanifest',
      '/llms.txt',
      '/.well-known/security.txt',
      '/.well-known/mta-sts.txt',
      '/feed/tomar.xml',
      '/widget/agenda',
    ]) {
      expect(temBarreira(caminho)).toBe(false);
    }
  });

  it('um caminho que só começa igual a um aberto não passa', () => {
    // `/feed.xml.html` e `/api/eventos-todos` não são o que a lista abre, e a
    // comparação exata é o que os separa.
    expect(temBarreira('/feed.xml.html')).toBe(true);
    expect(temBarreira('/api/events/todos')).toBe(true);
    expect(temBarreira('/feed')).toBe(true);
  });
});

describe('o bilhete da barreira', () => {
  it('vai e volta, com a região dentro', async () => {
    const bilhete = await criarBilhete('medio-tejo', SEGREDO);
    const lido = await lerBilhete(bilhete, SEGREDO, 'medio-tejo');
    expect(lido?.tipo).toBe('portao');
    expect(lido?.regiao).toBe('medio-tejo');
  });

  it('dois bilhetes seguidos não são o mesmo texto', async () => {
    const [um, outro] = await Promise.all([
      criarBilhete('medio-tejo', SEGREDO),
      criarBilhete('medio-tejo', SEGREDO),
    ]);
    expect(um).not.toBe(outro);
  });

  it('o bilhete de uma região não abre outra', async () => {
    // A verificação que faltando não se via: sem ela, a senha de uma região
    // por licenciar abria todas as outras deste deployment.
    const bilhete = await criarBilhete('medio-tejo', SEGREDO);
    expect(await lerBilhete(bilhete, SEGREDO, 'travessia')).toBeNull();
  });

  it('com outro segredo não vale nada', async () => {
    const bilhete = await criarBilhete('medio-tejo', SEGREDO);
    expect(await lerBilhete(bilhete, `${SEGREDO}-outro`, 'medio-tejo')).toBeNull();
  });

  it('vale vinte e quatro horas, e nem um segundo depois', async () => {
    const agora = Date.UTC(2026, 8, 15, 12, 0, 0);
    const bilhete = await criarBilhete('medio-tejo', SEGREDO, agora);

    const quaseNoFim = agora + PORTAO_TTL_SEGUNDOS * 1000 - 1000;
    expect(await lerBilhete(bilhete, SEGREDO, 'medio-tejo', quaseNoFim)).not.toBeNull();

    const passado = agora + PORTAO_TTL_SEGUNDOS * 1000 + 1000;
    expect(await lerBilhete(bilhete, SEGREDO, 'medio-tejo', passado)).toBeNull();
  });

  it('um corpo mexido derruba a assinatura', async () => {
    const bilhete = await criarBilhete('medio-tejo', SEGREDO);
    const [corpo, assinatura] = bilhete.split('.');
    const outroCorpo = btoa(
      JSON.stringify({
        tipo: 'portao',
        regiao: 'medio-tejo',
        exp: Math.floor(Date.now() / 1000) + 99999,
        jti: 'x',
      }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(corpo).not.toBe(outroCorpo);
    expect(await lerBilhete(`${outroCorpo}.${assinatura}`, SEGREDO, 'medio-tejo')).toBeNull();
  });

  it('um lixo qualquer não é um bilhete', async () => {
    for (const texto of [undefined, '', '.', 'sem-ponto', 'a.b']) {
      expect(await lerBilhete(texto, SEGREDO, 'medio-tejo')).toBeNull();
    }
  });
});

/**
 * As duas famílias de token, assinadas com o mesmo segredo e disjuntas.
 *
 * Partilham as primitivas (`token-assinado.ts`) porque duas implementações da
 * mesma verificação divergem sempre, e uma delas acaba a aceitar o que a outra
 * recusa. O que **não** partilham é o corpo: um bilhete de barreira não tem
 * `actor`, e uma sessão de painel não tem `tipo`. Este teste é o que impede
 * que uma senha partilhada de uma região por licenciar passe a ser uma sessão
 * de administração.
 */
describe('um bilhete não é uma sessão, e uma sessão não é um bilhete', () => {
  it('o bilhete da barreira não abre o painel', async () => {
    const bilhete = await criarBilhete('medio-tejo', SEGREDO);
    expect(await readSessionToken(bilhete, SEGREDO)).toBeNull();
  });

  it('a sessão do painel não abre a barreira', async () => {
    const sessao = await createSessionToken('operador', SEGREDO);
    expect(await lerBilhete(sessao, SEGREDO, 'medio-tejo')).toBeNull();
  });
});
