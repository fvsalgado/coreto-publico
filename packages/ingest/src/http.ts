/**
 * Cliente HTTP da recolha.
 *
 * Do outro lado destes pedidos está o servidor de uma câmara municipal, quase
 * sempre partilhado com os serviços online do concelho. Recolher uma agenda
 * não pode parecer um ataque: agente identificável, um pedido de cada vez por
 * hospedeiro, e recuo quando o servidor pede para abrandar.
 *
 * Nada aqui atira exceções. Um site em baixo é o funcionamento normal desta
 * casa, não um caso excecional — quem chama olha para `ok` e decide.
 */

/**
 * Quem bate à porta, e onde se lhe responde.
 *
 * A linha vive em `@coreto/core`, ao lado das outras regras da recolha que o
 * sítio publica por escrito, e é reexportada aqui porque é daqui que ela sai
 * para a rede. A razão da mudança de casa está escrita lá: a página `/fontes`
 * — que é o endereço que esta linha traz dentro — passou a mostrar ao
 * administrador de sistemas do outro lado exatamente o que lhe vai aparecer
 * nos registos, e duas cópias da mesma frase divergem sempre.
 */
import { USER_AGENT } from '@coreto/core';
import {
  autoridadeDe,
  caminhoDe,
  lerRobots,
  MAX_ROBOTS_BYTES,
  podeLer,
  PRODUTO,
  robotsDe,
  SEM_RESTRICOES,
  type RegrasDoRobots,
} from './robots.js';

export { USER_AGENT };

export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_HOST_INTERVAL_MS = 1_000;

/**
 * Espera máxima que se aceita de um `Retry-After`.
 *
 * Há servidores que respondem «volta daqui a uma hora» a um 429. Esperar uma
 * hora seguraria a recolha das outras dez câmaras; mais vale desistir desta
 * fonte e voltar amanhã.
 */
const MAX_RETRY_AFTER_MS = 30_000;

/** Uma agenda em HTML não tem 4 MB. O que passa disto é ficheiro, não página. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Quantos «vai antes ali» se seguem antes de desistir.
 *
 * Cinco é o costume da web e chega de sobra: a 14 de setembro de 2026 mediram-se
 * as quarenta fontes desta casa e as trinta e duas alcançáveis respondem **sem
 * um único salto**. O número existe para o dia em que alguém encadeie um ciclo,
 * não para os endereços de hoje.
 */
const MAX_REDIRECIONAMENTOS = 5;

/** Os códigos que mandam ir buscar a mesma coisa a outro sítio. */
const REDIRECIONAMENTOS = new Set([301, 302, 303, 307, 308]);

/**
 * Para onde este redirecionamento aponta, ou `null` se não for um.
 *
 * Um 3xx sem `Location` não é um destino — é um servidor a responder mal, e
 * lê-se como resposta final em vez de se adivinhar para onde ele queria mandar.
 * Um `Location` que não dá endereço válido tem o mesmo fim, pela mesma razão.
 */
function destinoDe(response: Response, origem: string): string | null {
  if (!REDIRECIONAMENTOS.has(response.status)) return null;
  const location = response.headers.get('location');
  if (!location) return null;
  try {
    return new URL(location, origem).toString();
  } catch {
    return null;
  }
}

export interface HttpResponse {
  ok: boolean;
  /** Zero quando o pedido nem chegou a ter resposta (DNS, TLS, tempo esgotado). */
  status: number;
  body: string;
  error: string | null;
  /** Endereço final, já com redirecionamentos seguidos. */
  url: string;
}

export interface HttpCounters {
  /** Pedidos que tiveram resposta, seja ela qual for. */
  responses: number;
  /** Pedidos que não chegaram a ter resposta. */
  failures: number;
}

export interface HttpClientOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  minHostIntervalMs?: number;
  userAgent?: string;
  /** Injetáveis para os testes correrem sem rede e sem esperar de verdade. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Estados que merecem outra tentativa.
 *
 * Tudo o resto na gama 4xx é uma resposta definitiva: repetir um 404 só gasta
 * a paciência do servidor e o tempo da recolha.
 */
const RETRYABLE_STATUS = new Set([408, 425, 429]);

export function isRetryableStatus(status: number): boolean {
  return status >= 500 || RETRYABLE_STATUS.has(status);
}

/** Recuo exponencial: 1s antes da segunda tentativa, 2s antes da terceira, 4s da quarta. */
export function backoffMs(attempt: number): number {
  return 1_000 * 2 ** Math.max(0, attempt - 1);
}

/** Lê `Retry-After` em segundos ou em data HTTP. Devolve milissegundos. */
export function parseRetryAfter(value: string | null | undefined, nowMs: number): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1_000;
  const asDate = Date.parse(trimmed);
  if (!Number.isFinite(asDate)) return null;
  return Math.max(0, asDate - nowMs);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return url;
  }
}

/**
 * O que correu mal, dito com o detalhe que serve para agir.
 *
 * **Esta função deitava fora a única informação que interessava.** O `fetch`
 * do Node põe `fetch failed` em **todos** os erros de rede — DNS que não
 * resolve, ligação recusada, ligação cortada a meio do aperto de mão TLS,
 * certificado expirado, protocolo incompatível. São cinco avarias diferentes,
 * com cinco respostas diferentes, e todas chegavam à base com a mesma frase.
 *
 * A causa verdadeira está em `error.cause`, com um `code` do sistema
 * operativo. Nunca lhe tocávamos.
 *
 * **O que isso custou, medido:** a 12 e 13 de setembro de 2026, oito fontes do
 * Médio Tejo gravaram `fetch failed` em `source_runs.warnings`, duas noites
 * seguidas. Para saber o que era foi preciso ir de fora, à mão, bater a cada
 * domínio com o `curl` — e o que lá estava era `SSL_ERROR_SYSCALL`, a ligação
 * a ser cortada antes de o TLS acabar. Era a diferença entre «alguém nos
 * bloqueou» e «aquela máquina partiu-se», e esteve dentro do processo, todas
 * as noites, a ser apagada nesta linha.
 *
 * O código do sistema vai **à frente** da mensagem porque é o que se procura:
 * `ECONNRESET` diz mais a quem lê do que a frase inteira à volta dele.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  if (error.name === 'TimeoutError' || error.name === 'AbortError')
    return 'tempo de resposta esgotado';

  const base = error.message || error.name;

  // `cause` pode ser um erro dentro de outro — o `undici` embrulha, e há casos
  // com dois níveis: `fetch failed` → `socket hang up` → `EPROTO`. Quatro
  // níveis chegam, e o contador evita o ciclo que um `cause` circular faria.
  //
  // **O código ganha a qualquer profundidade, e a ordem importa.** Uma
  // primeira versão devolvia a mensagem do nível de cima assim que encontrava
  // uma diferente, e parava aí — o que dava `fetch failed (socket hang up)` e
  // deixava o `EPROTO` do fundo por dizer. Percorre-se tudo à procura do
  // código **primeiro**; a mensagem é o que fica quando não há código nenhum.
  const mensagens: string[] = [];
  let causa: unknown = error.cause;
  for (let i = 0; i < 4 && causa instanceof Error; i += 1) {
    const codigo = (causa as { code?: unknown }).code;
    if (typeof codigo === 'string' && codigo) {
      // `ECONNRESET: fetch failed` em vez de `fetch failed`. O que muda é
      // tudo: com o código, a noite seguinte diz por si o que aconteceu.
      const detalhe = [...mensagens, causa.message].filter((m) => m && m !== base);
      return detalhe.length ? `${codigo}: ${base} (${detalhe.join(' → ')})` : `${codigo}: ${base}`;
    }
    if (causa.message) mensagens.push(causa.message);
    causa = causa.cause;
  }

  const extra = mensagens.filter((m) => m !== base);
  return extra.length ? `${base} (${extra.join(' → ')})` : base;
}

export class HttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly minHostIntervalMs: number;
  /**
   * O `robots.txt` de cada hospedeiro, lido uma vez por recolha.
   *
   * Guarda-se a promessa e não o resultado: dois pedidos ao mesmo hospedeiro
   * lançados ao mesmo tempo esperam pela mesma leitura em vez de pedirem o
   * ficheiro duas vezes. Uma recolha toca cada hospedeiro muitas vezes — a
   * listagem e uma ficha por evento — e um pedido a mais por cada uma delas
   * seria dobrar o que se pede a uma câmara.
   */
  private readonly robotsPorHospedeiro = new Map<string, Promise<RegrasDoRobots>>();
  private readonly userAgent: string;

  /** Hospedeiro → instante a partir do qual o próximo pedido pode sair. */
  private readonly nextAllowedAt = new Map<string, number>();

  private responses = 0;
  private failures = 0;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? (() => Date.now());
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    this.minHostIntervalMs = options.minHostIntervalMs ?? DEFAULT_HOST_INTERVAL_MS;
    this.userAgent = options.userAgent ?? USER_AGENT;
  }

  counters(): HttpCounters {
    return { responses: this.responses, failures: this.failures };
  }

  /**
   * Os primeiros bytes de um ficheiro, para lhe ler o cabeçalho.
   *
   * Serve as medidas dos cartazes (`medidasDaImagem`, em `@coreto/core`), e é
   * método à parte e não uma opção do `get` por três razões que puxam todas no
   * mesmo sentido.
   *
   * **Devolve bytes.** O `get` devolve texto, e um JPEG passado por
   * `response.text()` volta com os bytes trocados por U+FFFD — o cabeçalho
   * deixa de ser legível antes de chegar a quem o lê.
   *
   * **Não repete.** O `get` tenta três vezes porque a agenda de um concelho
   * depende daquela resposta. Aqui não depende nada: um cartaz que não se mede
   * hoje mede-se amanhã, e a página entretanto reserva a vitrine como sempre
   * reservou. Insistir era triplicar os pedidos ao servidor da câmara por uma
   * altura de caixa.
   *
   * **Pede só o princípio.** `Range` corta a transferência nos primeiros
   * kilobytes; o servidor responde 206 com essa fatia. Quem ignorar o
   * cabeçalho manda o ficheiro inteiro, e por isso o corte repete-se deste
   * lado, na leitura.
   *
   * Passa pelo mesmo estrangulamento por hospedeiro que o resto — um pedido de
   * cada vez, com intervalo — porque do outro lado é a mesma máquina.
   */
  async cabecalho(
    url: string,
    bytes: number,
    options: RequestOptions = {},
  ): Promise<Uint8Array | null> {
    // Um cartaz é um ficheiro no servidor de outra pessoa como qualquer outro.
    // Até 14 de setembro de 2026 este caminho não perguntava nada ao
    // `robots.txt` — ficou escrito como limite conhecido no PR #160, e é aqui
    // que fecha. Um `Disallow` que apanhe a pasta dos cartazes passa a valer,
    // e o efeito é o mesmo de qualquer cartaz que não se consegue medir: a
    // vitrine reserva o espaço como sempre reservou.
    const recusa = await this.porqueNaoPode(url);
    if (recusa) return null;

    await this.throttle(url);
    try {
      const seguido = await this.pedirSeguindo(
        url,
        {
          'user-agent': this.userAgent,
          accept: 'image/*',
          range: `bytes=0-${bytes - 1}`,
          ...options.headers,
        },
        options.timeoutMs ?? this.timeoutMs,
        () => {
          this.responses += 1;
        },
      );
      if (!('response' in seguido)) return null;
      const { response } = seguido;
      // 206 é o corte pedido; 200 é o servidor a ignorar o `Range` e a mandar
      // tudo. Os dois servem — o que não serve é um 404 ou um 503, e desses
      // não se lê nada.
      if (!response.ok) return null;
      const recebido = new Uint8Array(await response.arrayBuffer());
      return recebido.length > bytes ? recebido.subarray(0, bytes) : recebido;
    } catch {
      // Um cartaz que não responde não é uma falha da recolha: não conta para
      // `failures`, que é o contador que decide se uma FONTE está partida.
      return null;
    }
  }

  /**
   * O `robots.txt` do hospedeiro deste endereço, lido uma vez e guardado.
   *
   * **O que se faz com cada desfecho, e porquê.**
   *
   * *Respondeu.* Lê-se e obedece-se. É o caso das quarenta fontes desta casa:
   * a 14 de setembro de 2026 mediram-se as trinta e duas alcançáveis, e as
   * trinta e duas deixam ler a agenda. Cumprir não custou uma fonte.
   *
   * *404, ou qualquer outro 4xx.* Não há ficheiro, e não haver ficheiro é não
   * haver restrições. É o que a norma manda e é o que o Ourém e o Abrantes
   * servem.
   *
   * *5xx, ou a ligação não chega lá.* A RFC 9309 manda ler isto como proibição
   * total. **Aqui não se faz assim, e a diferença é deliberada.** Uma proibição
   * silenciosa é indistinguível de uma agenda vazia, e foi exatamente por aí
   * que dezassete fontes gravaram sucesso sem lerem um byte, a 5 e a 9 de
   * setembro. Nesta casa «não consegui saber» não se arruma como se fosse
   * «não»: atira-se, a fonte falha à vista, e a agenda de ontem fica de pé.
   * O efeito prático é o mesmo da norma — não se lê nada —, mas fica escrito
   * porquê em vez de desaparecer.
   *
   * *E o erro vai inteiro.* Se a ligação morrer, a mensagem leva o código de
   * sistema que o `describeError` extraiu — `ECONNRESET`, `ENOTFOUND`, o que
   * for. Sem isso, o pedido do `robots.txt` passava a falhar primeiro e a
   * tapar o diagnóstico do que vem a seguir: são esses códigos que sustentam
   * a carta às oito fontes caladas do Médio Tejo.
   */
  private async regrasDoRobots(url: string): Promise<RegrasDoRobots> {
    // Chaveia pela autoridade e não pelo hospedeiro: `http://x.pt` e
    // `https://x.pt` são autoridades diferentes para a norma, e partilhar a
    // entrada fazia o ficheiro de uma mandar na outra.
    const autoridade = autoridadeDe(url);
    const guardado = this.robotsPorHospedeiro.get(autoridade);
    if (guardado) return guardado;

    const endereco = robotsDe(url);
    if (!endereco) return SEM_RESTRICOES;

    const promessa = (async (): Promise<RegrasDoRobots> => {
      await this.throttle(endereco);
      let resposta: Response;
      try {
        // Aqui **segue-se** automaticamente, ao contrário do resto do
        // ficheiro. Não é descuido: a §2.3.1.2 manda seguir pelo menos cinco
        // redirecionamentos a caminho do `robots.txt`, e perguntar ao
        // `robots.txt` do destino se se pode ler o `robots.txt` do destino não
        // teria fim.
        resposta = await this.fetchImpl(endereco, {
          redirect: 'follow',
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: { 'user-agent': this.userAgent, accept: 'text/plain,*/*;q=0.8' },
        });
      } catch (error) {
        throw new Error(`não consegui ler o ${endereco} — ${describeError(error)}`);
      }

      if (resposta.status >= 500) {
        throw new Error(`não consegui ler o ${endereco}: o servidor deu ${resposta.status}`);
      }
      // 4xx é ausência de ficheiro, e ausência de ficheiro é ausência de
      // regras. É a leitura da norma, e é a única que não inventa proibições.
      if (!resposta.ok) return SEM_RESTRICOES;

      // Não se lê um ficheiro inteiro de sete megabytes vindo de uma máquina
      // que não é nossa: a §2.5 manda analisar pelo menos 512 KiB, e o `slice`
      // do `lerRobots` corta aí.
      const texto = (await resposta.text()).slice(0, MAX_ROBOTS_BYTES);
      // Um 200 que devolve HTML não é um `robots.txt`: é a página de erro de
      // quem não sabe dar 404. Lê-la como regras seria ler tags como caminhos.
      if (/^\s*<(?:!doctype|html)\b/i.test(texto)) return SEM_RESTRICOES;

      return lerRobots(texto, PRODUTO);
    })();

    this.robotsPorHospedeiro.set(autoridade, promessa);
    // Uma leitura falhada não fica guardada como veredicto: fica guardada a
    // promessa, e quem lhe pegar a seguir recebe o mesmo erro. É o que impede
    // quarenta fontes de baterem quarenta vezes no mesmo ficheiro em baixo.
    return promessa;
  }

  /**
   * A razão por que este endereço não se pode pedir, ou `null` se se pode.
   *
   * **Vive à parte porque tem três sítios a chamá-la, e não um.** A pergunta
   * era feita uma vez, no `get`, antes do primeiro pedido — e isso deixava
   * dois caminhos por perguntar: o destino de um redirecionamento, e as
   * medidas dos cartazes. Os dois estavam escritos como limites conhecidos no
   * PR #160, e é isto que os fecha.
   *
   * O `/robots.txt` é a única excepção: perguntar-lhe a ele se pode ser lido
   * não teria fim, e a §2.2.2 diz o mesmo — «The /robots.txt URI is
   * implicitly allowed».
   *
   * Devolve texto e não um booleano de propósito. «Não deixa» e «não consegui
   * saber» são duas respostas diferentes, e quem chama escreve-as as duas na
   * mesma linha de erro — a primeira com o grupo que decidiu, a segunda com o
   * código de sistema que o `describeError` extraiu.
   */
  private async porqueNaoPode(url: string): Promise<string | null> {
    if (caminhoDe(url) === '/robots.txt') return null;

    let regras: RegrasDoRobots;
    try {
      regras = await this.regrasDoRobots(url);
    } catch (error) {
      return describeError(error);
    }

    if (podeLer(regras, caminhoDe(url))) return null;
    return `o robots.txt deste sítio não deixa ler ${caminhoDe(url)}${
      regras.grupo ? ` (grupo «${regras.grupo}»)` : ''
    }`;
  }

  /**
   * Faz o pedido e segue os «vai antes ali» à mão, perguntando ao `robots.txt`
   * de cada destino **antes** de lá bater.
   *
   * **Porque é que não se usa `redirect: 'follow'`.** Porque o seguir
   * automático é cego: bate no destino e só depois é que se sabe onde se
   * foi parar. Se o destino for outro hospedeiro, o pedido já saiu quando
   * ainda ninguém leu o `robots.txt` de lá — e um ficheiro que se lê depois
   * de já se ter pedido a página não é uma regra, é um relatório.
   *
   * **O que isto custa hoje: nada.** Mediram-se as quarenta fontes a 14 de
   * setembro de 2026 e as trinta e duas que respondem chegam ao destino em
   * zero saltos. Não há aqui um pedido a mais nem um segundo de espera a
   * mais do que havia — há a garantia para o dia em que uma câmara mudar a
   * agenda de casa.
   *
   * Cada salto passa pelo estrangulamento do hospedeiro novo, porque do outro
   * lado é outra máquina e ela não tem culpa de nós já termos batido à porta
   * do vizinho.
   *
   * Não conta respostas nem falhas, e não apanha exceções: quem chama é que
   * sabe se um cartaz que não responde conta para o mesmo sítio que uma
   * agenda que não responde. (Não conta.)
   */
  private async pedirSeguindo(
    url: string,
    headers: Record<string, string>,
    timeoutMs: number,
    conta: () => void,
  ): Promise<{ response: Response; url: string } | { recusa: string; url: string }> {
    let atual = url;

    for (let salto = 0; salto <= MAX_REDIRECIONAMENTOS; salto += 1) {
      const response = await this.fetchImpl(atual, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers,
      });
      conta();

      const destino = destinoDe(response, atual);
      if (!destino) return { response, url: atual };

      const recusa = await this.porqueNaoPode(destino);
      if (recusa) return { recusa: `mandou-me a ${destino}, e ${recusa}`, url: destino };

      await this.throttle(destino);
      atual = destino;
    }

    // Um ciclo não se desfaz com paciência. Quem chama não volta a tentar.
    return {
      recusa: `mais de ${MAX_REDIRECIONAMENTOS} redirecionamentos a partir de ${url}`,
      url: atual,
    };
  }

  async get(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    let last: HttpResponse = { ok: false, status: 0, body: '', error: 'pedido não executado', url };

    // Antes de pedir a página, perguntar se se pode.
    //
    // **Devolve, não atira.** A primeira versão disto atirava quando o
    // `robots.txt` não respondia, e partia a promessa que está no topo deste
    // ficheiro: «nada aqui atira exceções». Onze chamadas a `get` nos
    // adaptadores foram escritas contra essa promessa — `if (!resposta.ok) {
    // log.warn; continue; }` — e uma exceção a sair do meio delas leva a
    // fonte inteira abaixo por causa de uma ficha de detalhe alojada noutro
    // sítio.
    //
    // Não é preciso atirar para a fonte falhar à vista. Uma listagem que
    // devolve `ok: false` faz o adaptador cair na guarda do `responderam === 0`
    // — a que se acrescentou a 14 de setembro, depois de dezassete fontes
    // gravarem sucesso sem lerem um byte — e essa guarda atira. A fonte falha,
    // com a razão escrita, e um detalhe que não se pode ler continua a custar
    // a descrição e não o evento.
    const recusa = await this.porqueNaoPode(url);
    if (recusa) return { ok: false, status: 0, body: '', error: recusa, url };

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.throttle(url);
      const result = await this.attempt(url, options);
      last = result.response;

      if (result.response.ok) return result.response;
      if (attempt === this.maxAttempts) break;
      if (!result.retryable) break;

      const wait = result.retryAfterMs ?? backoffMs(attempt);
      if (wait > MAX_RETRY_AFTER_MS) {
        return {
          ...result.response,
          error: `${result.response.error ?? 'sem detalhe'} (pediu ${Math.round(wait / 1000)}s de espera)`,
        };
      }
      await this.sleep(wait);
    }

    return last;
  }

  /**
   * Segura o pedido até ter passado o intervalo mínimo desde o anterior ao
   * mesmo hospedeiro.
   *
   * A próxima janela é reservada antes da espera, e não depois: dois pedidos
   * lançados ao mesmo tempo têm de se pôr em fila, não de partilhar a mesma
   * janela e sair os dois na mesma altura.
   */
  private async throttle(url: string): Promise<void> {
    if (this.minHostIntervalMs <= 0) return;
    const host = hostOf(url);
    const now = this.now();
    const earliest = this.nextAllowedAt.get(host) ?? 0;
    this.nextAllowedAt.set(host, Math.max(now, earliest) + this.minHostIntervalMs);
    const wait = earliest - now;
    if (wait > 0) await this.sleep(wait);
  }

  private async attempt(
    url: string,
    options: RequestOptions,
  ): Promise<{ response: HttpResponse; retryable: boolean; retryAfterMs: number | null }> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;

    try {
      const seguido = await this.pedirSeguindo(
        url,
        {
          'user-agent': this.userAgent,
          accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'accept-language': 'pt-PT,pt;q=0.9',
          ...options.headers,
        },
        timeoutMs,
        () => {
          this.responses += 1;
        },
      );

      // O caminho parou a meio: ou o destino tem um `robots.txt` que o proíbe,
      // ou os saltos não acabavam. Houve resposta — conta como resposta, e é
      // por isso que o `status` fica a zero e não a 200: não se leu página
      // nenhuma.
      if (!('response' in seguido)) {
        return {
          response: { ok: false, status: 0, body: '', error: seguido.recusa, url: seguido.url },
          retryable: false,
          retryAfterMs: null,
        };
      }

      const { response } = seguido;
      const finalUrl = seguido.url;
      const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'), this.now());

      const declared = Number(response.headers.get('content-length') ?? '0');
      if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
        return {
          response: {
            ok: false,
            status: response.status,
            body: '',
            error: `resposta demasiado grande (${declared} bytes)`,
            url: finalUrl,
          },
          retryable: false,
          retryAfterMs: null,
        };
      }

      const text = await response.text();
      const body = text.length > MAX_BODY_BYTES ? text.slice(0, MAX_BODY_BYTES) : text;

      if (!response.ok) {
        return {
          response: {
            ok: false,
            status: response.status,
            body,
            error: `HTTP ${response.status}`,
            url: finalUrl,
          },
          retryable: isRetryableStatus(response.status),
          retryAfterMs,
        };
      }

      return {
        response: { ok: true, status: response.status, body, error: null, url: finalUrl },
        retryable: false,
        retryAfterMs: null,
      };
    } catch (error) {
      // Sem resposta: DNS, TLS, ligação cortada ou tempo esgotado. É o caso
      // que distingue «a agenda está vazia» de «o site não existe».
      this.failures += 1;
      return {
        response: { ok: false, status: 0, body: '', error: describeError(error), url },
        retryable: true,
        retryAfterMs: null,
      };
    }
  }
}
