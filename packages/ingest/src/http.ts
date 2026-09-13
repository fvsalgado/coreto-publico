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
    await this.throttle(url);
    try {
      const response = await this.fetchImpl(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
        headers: {
          'user-agent': this.userAgent,
          accept: 'image/*',
          range: `bytes=0-${bytes - 1}`,
          ...options.headers,
        },
      });
      this.responses += 1;
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

  async get(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    let last: HttpResponse = { ok: false, status: 0, body: '', error: 'pedido não executado', url };

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
      const response = await this.fetchImpl(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': this.userAgent,
          accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'accept-language': 'pt-PT,pt;q=0.9',
          ...options.headers,
        },
      });

      this.responses += 1;
      const finalUrl = response.url || url;
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
