import { createHash } from 'node:crypto';
import { posterBackground } from '@/src/lib/cartaz';

/**
 * As fotografias dos espaços e dos coretos: na medida que a caixa pede, e sem
 * cookies de terceiros.
 *
 * **De onde vêm.** 61 das 87 fotografias do catálogo são do Wikimedia Commons,
 * guardadas como `commons.wikimedia.org/wiki/Special:FilePath/<ficheiro>`; as
 * outras são do inventário «Reanimar os Coretos em Portugal», num blogue
 * (`blogger.googleusercontent.com`), e uma do arquivo InfoPortugal.
 *
 * **O que estava mal, medido.** O navegador de quem visitava pedia cada
 * fotografia do Commons em três viagens (302, 301, 200), e as duas primeiras
 * deixavam-lhe cookies da Wikimedia — `WMF-Uniq`, `GeoIP`,
 * `NetworkProbeLimit` —, numa casa que escreve na política de privacidade que
 * não põe cookies a ninguém. A miniatura de chegada também lá está a pô-los
 * (`thumb.wikimedia.org`, verificado a 2/10/2026): não há endereço da
 * Wikimedia que não os ponha. A ficha de um espaço pedia ainda `width=1600`,
 * que o Commons arredonda para o escalão de 1920 px — 1,5 MB para um ecrã de
 * 360 (C3-005).
 *
 * **O que passa a ser.** As do Commons servem-se pelo próprio sítio, em
 * `/fotografia/<chave>/<largura>` (a rota está em
 * `app/[regiao]/fotografia/[chave]/[largura]/route.ts`): o servidor pede a
 * miniatura do tamanho certo, a rede de distribuição guarda-a, e o navegador
 * de quem visita não fala com a Wikimedia. São imagens de licença livre — é o
 * Commons que o garante, ficheiro a ficheiro —, e servi-las daqui com o
 * crédito ao lado é o uso que a licença permite.
 *
 * As do blogue e do arquivo **continuam a ser pedidas a quem as publica**, e
 * de propósito: não têm licença livre declarada — entraram com o crédito de
 * quem as tirou —, e ligar não é reproduzir. Nenhum dos dois servidores põe
 * cookies (verificado a 2/10/2026). O blogue serve a largura que se lhe pede
 * no próprio caminho (`/w640/`), e é isso que o `srcset` usa; o arquivo tem
 * uma medida só.
 */

/**
 * Os escalões de miniatura do Commons, e os únicos que se pedem.
 *
 * Desde 2025 o Commons só serve miniaturas nestas larguras: pedir 800
 * devolve 960, pedir 1600 devolve 1920 (medido a 2/10/2026 no
 * `Special:FilePath`). Pedir o escalão certo é o que faz a mesma miniatura
 * servir toda a gente — a nossa cache e a deles —, em vez de uma por cada
 * largura inventada aqui.
 */
export const LARGURAS_DA_FOTOGRAFIA = [330, 500, 960, 1280] as const;

export type LarguraDaFotografia = (typeof LARGURAS_DA_FOTOGRAFIA)[number];

/** O nome do ficheiro no Commons, como ele o escreve: espaços em `_`, sem codificação. */
export function ficheiroDoCommons(url: string): string | null {
  let endereco: URL;
  try {
    endereco = new URL(url);
  } catch {
    return null;
  }
  if (endereco.hostname !== 'commons.wikimedia.org') return null;
  const marca = '/wiki/Special:FilePath/';
  if (!endereco.pathname.startsWith(marca)) return null;

  let nome: string;
  try {
    nome = decodeURIComponent(endereco.pathname.slice(marca.length));
  } catch {
    return null;
  }
  nome = nome.replace(/ /g, '_').trim();
  // Um nome com barra não é um ficheiro do Commons, é um caminho — e um
  // caminho não entra no endereço que o servidor vai pedir.
  if (nome.length === 0 || nome.includes('/')) return null;
  return nome;
}

/** O que o MediaWiki chama `rawurlencode`: tudo o que não é letra, algarismo ou `-_.~`. */
function codificar(nome: string): string {
  return encodeURIComponent(nome).replace(
    /[!'()*]/g,
    (letra) => `%${letra.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * A miniatura de um ficheiro do Commons, na largura pedida — o endereço final,
 * sem os dois redirecionamentos do `Special:FilePath`.
 *
 * O caminho é o que o MediaWiki usa para guardar os ficheiros: as duas pastas
 * são o primeiro e os dois primeiros algarismos do MD5 do nome. Verificado
 * contra o redirecionamento do próprio Commons para as fotografias do
 * catálogo.
 *
 * Um SVG, um TIFF ou um PDF não têm miniatura com o mesmo nome — o Commons
 * desenha-os noutro formato —, e por isso não passam: devolve `null` e a
 * fotografia fica sem medida (a capa por baixo fica à vista).
 */
export function miniaturaDoCommons(ficheiro: string, largura: number): string | null {
  if (!/\.(jpe?g|png|gif|webp)$/i.test(ficheiro)) return null;
  const md5 = createHash('md5').update(ficheiro, 'utf8').digest('hex');
  const nome = codificar(ficheiro);
  return `https://thumb.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${nome}/${largura}px-${nome}`;
}

/**
 * A chave de uma fotografia na rota do sítio: dezasseis algarismos do SHA-256
 * do endereço guardado.
 *
 * O endereço e não o espaço, por duas razões. Uma rota por identificador de
 * espaço ficava a servir a fotografia antiga a quem a tivesse em cache depois
 * de alguém a trocar no painel; com a chave do endereço, trocar a fotografia
 * troca o endereço, e a cache longa deixa de ser um risco. E os coretos e os
 * espaços guardam as fotografias em tabelas diferentes: a chave do endereço
 * serve as duas sem a rota ter de saber de qual veio.
 */
export function chaveDaFotografia(url: string): string {
  return createHash('sha256').update(url, 'utf8').digest('hex').slice(0, 16);
}

/** O mesmo endereço do blogue, na largura pedida — `/s1600/` passa a `/w640/`. */
function larguraNoBlogue(url: string, largura: number): string | null {
  let endereco: URL;
  try {
    endereco = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)(googleusercontent\.com|bp\.blogspot\.com)$/.test(endereco.hostname)) return null;
  // O segmento da medida é o penúltimo, logo antes do nome do ficheiro.
  const caminho = endereco.pathname.replace(
    /\/(s|w|h)\d+(-[a-z0-9-]+)?(\/[^/]+)$/,
    `/w${largura}$3`,
  );
  if (caminho === endereco.pathname) return null;
  endereco.pathname = caminho;
  return endereco.toString();
}

/** O que um `<img>` precisa para pedir a medida certa. */
export interface FonteDaFotografia {
  src: string;
  /** Vazio quando a origem só tem uma medida. */
  srcSet?: string;
}

/**
 * Os endereços de uma fotografia, para um `<img>` ou para um fundo.
 *
 * `larguras` são as medidas que a caixa pode querer, da mais pequena para a
 * maior; o `src` é a primeira, que é o que pede quem não lê `srcset`.
 */
export function fonteDaFotografia(
  url: string,
  larguras: readonly LarguraDaFotografia[],
): FonteDaFotografia {
  const primeira = larguras[0] ?? 500;

  if (ficheiroDoCommons(url)) {
    const chave = chaveDaFotografia(url);
    const endereco = (largura: number) => `/fotografia/${chave}/${largura}`;
    return {
      src: endereco(primeira),
      srcSet:
        larguras.length > 1
          ? larguras.map((largura) => `${endereco(largura)} ${largura}w`).join(', ')
          : undefined,
    };
  }

  const doBlogue = larguraNoBlogue(url, primeira);
  if (doBlogue) {
    return {
      src: doBlogue,
      srcSet:
        larguras.length > 1
          ? larguras.map((largura) => `${larguraNoBlogue(url, largura)} ${largura}w`).join(', ')
          : undefined,
    };
  }

  return { src: url };
}

/**
 * `url("…")` para um fundo, ou `undefined`.
 *
 * Os endereços de fora passam pelo `posterBackground`, que é quem sabe
 * desconfiar deles. Os do próprio sítio são relativos — e esse recusa-os, de
 * propósito, porque um cartaz vem de fora e um caminho relativo vindo de fora
 * é suspeito. Estes não vêm: são escritos aqui, só com algarismos e a chave
 * hexadecimal, e por isso passam sem mais.
 */
export function fundoDaFotografia(src: string): string | undefined {
  if (/^\/fotografia\/[0-9a-f]{16}\/\d+$/.test(src)) return `url("${src}")`;
  return posterBackground(src);
}

/**
 * Os servidores de fora a que o navegador de quem visita pede fotografias —
 * os que não são do Commons, que se servem daqui. Para a política de
 * privacidade os nomear sem os escrever à mão: uma política que nomeia
 * servidores à mão acaba a nomear quem ninguém contacta.
 */
export function anfitrioesDeFora(urls: readonly (string | null)[]): string[] {
  const anfitrioes = new Set<string>();
  for (const url of urls) {
    if (!url || ficheiroDoCommons(url)) continue;
    try {
      anfitrioes.add(new URL(url).hostname);
    } catch {
      // Um endereço torto não é pedido a ninguém.
    }
  }
  return [...anfitrioes].sort();
}
