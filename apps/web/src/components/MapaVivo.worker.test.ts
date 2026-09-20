import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O processador do mapa em `public/` é o do pacote instalado, byte a byte.
 *
 * O `MapaVivo` diz ao MapLibre que o processador está em
 * `/maplibre/<versão>/maplibre-gl-worker.mjs`, e quem o põe lá é
 * `scripts/copiar-maplibre.mjs`, no `postinstall` e antes de cada build. Este
 * teste é o que apanha um `pnpm add maplibre-gl@…` seguido de um `vitest`
 * sem o script ter corrido — e, mais importante, uma cópia de outra versão:
 * os dois lados de um Worker que não são da mesma versão falham de maneiras
 * que não dizem porquê.
 */
const require = createRequire(import.meta.url);
const pacote = require.resolve('maplibre-gl/package.json');
const { version } = JSON.parse(readFileSync(pacote, 'utf8')) as { version: string };
const dist = join(dirname(pacote), 'dist');
const publico = join(__dirname, '..', '..', 'public', 'maplibre', version);

describe('o processador do MapLibre em public/', () => {
  it.each(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'])(
    '%s está na pasta da versão instalada e é igual ao do pacote',
    (nome) => {
      const copia = join(publico, nome);
      expect(
        existsSync(copia),
        `${copia} não existe — corre node scripts/copiar-maplibre.mjs`,
      ).toBe(true);
      expect(readFileSync(copia)).toEqual(readFileSync(join(dist, nome)));
    },
  );

  it('o processador importa o módulo partilhado ao lado, por caminho relativo', () => {
    // É isto que obriga a servir os dois da mesma pasta, e que o empacotador
    // partia ao tratá-los como recursos soltos com nomes com hash.
    const worker = readFileSync(join(publico, 'maplibre-gl-worker.mjs'), 'utf8');
    expect(worker).toContain('from"./maplibre-gl-shared.mjs"');
  });
});
