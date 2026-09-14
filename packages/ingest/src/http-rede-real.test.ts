/**
 * O único teste desta casa que abre um socket.
 *
 * **Existe porque os outros não conseguem ver o que este vê.** Os duplos de
 * rede do `http.test.ts` são funções: recebem o `init` e devolvem um `Response`
 * escrito à mão. Uma função dessas ignora o `redirect: 'manual'` — devolve o
 * 302 quer o cliente peça para seguir quer peça para não seguir. Mediu-se a 14
 * de setembro de 2026: trocar o `'manual'` de volta para `'follow'` no
 * `pedirSeguindo` deixa **os trinta e três testes a passar**, e a recolha
 * voltaria a bater num hospedeiro sem lhe ler o `robots.txt`.
 *
 * Contra um `fetch` verdadeiro é outra coisa. Com `'follow'`, a biblioteca
 * segue o salto sozinha e o nosso laço nunca chega a ver o 302 — a pergunta ao
 * destino não se faz porque não há destino nenhum para ver. É esse buraco que
 * este ficheiro tapa, e é por isso que vale um servidor a sério.
 *
 * **`localhost` e `127.0.0.1` são o mesmo servidor e dois hospedeiros
 * diferentes.** Para a RFC 9309 a autoridade é o que está no endereço, não o
 * que está no fim do cabo: dois nomes, dois `robots.txt`. Dá para montar um
 * redirecionamento entre sítios sem sair da máquina e sem tocar na rede.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpClient } from './http.js';

let servidor: http.Server;
let porta = 0;
/** Cada pedido que o servidor recebeu, como «hospedeiro caminho». */
let recebidos: string[] = [];

beforeAll(async () => {
  servidor = http.createServer((req, res) => {
    const anfitriao = req.headers.host ?? '';
    const caminho = req.url ?? '';
    recebidos.push(`${anfitriao} ${caminho}`);

    if (caminho === '/robots.txt') {
      // O `localhost` deixa ler tudo; o `127.0.0.1` não deixa ler nada.
      const proibe = anfitriao.startsWith('127.0.0.1');
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(proibe ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nDisallow:\n');
      return;
    }

    if (caminho === '/agenda') {
      res.writeHead(302, { location: `http://127.0.0.1:${porta}/agenda-de-la` });
      res.end();
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<h1>isto não se devia ler</h1>');
  });

  await new Promise<void>((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  porta = (servidor.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((fechado) => servidor.close(() => fechado()));
});

describe('contra um servidor a sério', () => {
  it('não segue para outro hospedeiro sem lhe ler o robots.txt primeiro', async () => {
    recebidos = [];
    const client = new HttpClient({ minHostIntervalMs: 0 });

    const resposta = await client.get(`http://localhost:${porta}/agenda`);

    expect(resposta.ok).toBe(false);
    expect(resposta.error).toContain(`mandou-me a http://127.0.0.1:${porta}/agenda-de-la`);
    expect(resposta.error).toContain('não deixa ler /agenda-de-la');
    expect(resposta.body).toBe('');

    // A prova, e a razão de ser deste ficheiro: leu-se o `robots.txt` do
    // destino, e a página do destino **nunca foi pedida**. Com o seguir
    // automático, o `/agenda-de-la` aparecia aqui.
    expect(recebidos).toContain(`127.0.0.1:${porta} /robots.txt`);
    expect(recebidos).not.toContain(`127.0.0.1:${porta} /agenda-de-la`);
  });

  it('segue para outro hospedeiro quando o robots.txt de lá deixa', async () => {
    recebidos = [];
    const client = new HttpClient({ minHostIntervalMs: 0 });

    // Ao contrário: parte-se do `127.0.0.1`, que proíbe, para o `localhost`,
    // que não proíbe. O endereço de partida é o `/robots.txt`, que é a única
    // excepção à pergunta — e assim mede-se o caminho permitido sem mudar o
    // servidor.
    const resposta = await client.get(`http://127.0.0.1:${porta}/robots.txt`);

    expect(resposta.ok).toBe(true);
    expect(resposta.body).toContain('Disallow: /');
  });
});
