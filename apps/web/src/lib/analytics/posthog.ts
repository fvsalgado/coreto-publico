import { ehCaixaEmbebida } from './caixa-embebida';

/**
 * PostHog, em modo sem cookies e sem armazenamento no equipamento.
 *
 * Porque é que isto não pede consentimento
 * ----------------------------------------
 * O artigo 5.º da Lei n.º 41/2004 exige consentimento prévio para armazenar
 * informação no equipamento terminal de quem visita, ou para lá aceder — é a
 * regra a que se chama, por atalho, «lei dos cookies», e aplica-se a cookies,
 * a `localStorage` e a tudo o que fique gravado do lado de quem visita.
 *
 * Com `persistence: 'memory'` não fica gravado nada: o identificador que a
 * biblioteca gera vive numa variável e desaparece quando o separador fecha.
 * Não há nada para ler no equipamento nem nada para lá deixar, e por isso o
 * artigo 5.º não é acionado. Fica de fora do consentimento, não por
 * interpretação generosa, mas porque a operação que a norma regula não chega
 * a acontecer.
 *
 * Do lado do RGPD, o que resta é um evento de página sem identificação de
 * pessoas e sem perfil (`person_profiles: 'never'`), tratado ao abrigo do
 * interesse legítimo — alínea f) do n.º 1 do artigo 6.º — em saber que partes
 * do sítio são usadas. Como o identificador não persiste, não há forma de
 * ligar duas visitas à mesma pessoa, o que é precisamente o que faria disto
 * um perfil.
 *
 * Esta justificação só se aguenta enquanto a configuração se aguentar. Trocar
 * `persistence` por `'localStorage'` ou `'cookie'`, ligar a gravação de sessão
 * ou o `autocapture` muda a resposta jurídica e obriga a aviso de
 * consentimento. Não é uma afinação de detalhe.
 *
 * O que o código não consegue garantir
 * ------------------------------------
 * O endereço IP chega ao PostHog com o pedido, como chega a qualquer servidor,
 * e é lá que é usado para geolocalização aproximada. Isso desliga-se nas
 * definições do projeto no PostHog («Discard client IP data»), não daqui.
 * Quem instalar isto tem de o fazer — a política de privacidade diz que está
 * feito.
 *
 * Sem chave, nada disto corre: nem um pedido, nem um script carregado.
 */

/** Europa por omissão: os dados não saem da UE sem uma decisão explícita. */
export const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';

/**
 * Lidos como literais e não de `env.ts` de propósito: só as referências
 * escritas na forma `process.env.NEXT_PUBLIC_*` é que o Next substitui pelo
 * valor no pacote que vai para o navegador. Um objeto validado no arranque do
 * servidor chegaria aqui vazio.
 */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST;

interface PostHogOptions {
  api_host: string;
  persistence: 'memory';
  disable_session_recording: true;
  disable_surveys: true;
  autocapture: false;
  capture_pageview: false;
  capture_pageleave: false;
  person_profiles: 'never';
}

interface PostHogBrowser {
  init(key: string, options: PostHogOptions): void;
  capture(name: string, properties?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    posthog?: PostHogBrowser;
  }
}

/**
 * De onde se descarrega a biblioteca.
 *
 * O PostHog serve a API e os ficheiros estáticos em domínios diferentes:
 * `eu.i.posthog.com` responde à ingestão, `eu-assets.i.posthog.com` serve o
 * script. É a mesma transformação que o excerto oficial faz. Num anfitrião
 * próprio (ou atrás de um proxy) o nome não casa com o padrão, a substituição
 * não acontece e o script vem do próprio anfitrião, que é o esperado.
 */
export function postHogScriptUrl(host: string): string {
  const base = host.replace(/\/$/, '');
  return `${base.replace('.i.posthog.com', '-assets.i.posthog.com')}/static/array.js`;
}

let pending: Promise<PostHogBrowser | null> | null = null;

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('posthog não carregou')));
    document.head.appendChild(script);
  });
}

/**
 * Carrega e arranca o PostHog uma única vez.
 *
 * Devolve `null` — sem erro e sem aviso — quando não há chave configurada,
 * quando isto corre no servidor ou quando o script não chega a carregar
 * (rede, bloqueador de conteúdos). O sítio funciona igual nos três casos.
 */
export function startPostHog(): Promise<PostHogBrowser | null> {
  if (pending) return pending;
  if (!POSTHOG_KEY || typeof window === 'undefined') return Promise.resolve(null);

  pending = loadScript(postHogScriptUrl(POSTHOG_HOST))
    .then(() => {
      const client = window.posthog;
      if (!client) return null;
      client.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST.replace(/\/$/, ''),
        persistence: 'memory',
        disable_session_recording: true,
        disable_surveys: true,
        autocapture: false,
        // As vistas de página são enviadas por nós: com navegação de cliente,
        // a captura automática só apanharia o primeiro carregamento.
        capture_pageview: false,
        capture_pageleave: false,
        person_profiles: 'never',
      });
      return client;
    })
    .catch(() => null);

  return pending;
}

/**
 * O valor de `regiao` para o que responde no `coreto.org`.
 *
 * A ficha técnica não é de região nenhuma — é isso que a define — mas é um
 * sítio, e um sítio fora dos números é um sítio sobre o qual ninguém consegue
 * dizer se é visto. Leva um nome que nenhuma região pode ter: os
 * identificadores de região vêm da base, e não há nenhuma assim chamada.
 */
export const REGIAO_DA_FICHA = 'ficha-tecnica';

/**
 * As propriedades de uma vista de página.
 *
 * Separado da captura para poder ser verificado, porque é aqui que está o
 * nome `regiao` — trocá-lo não parte a compilação, parte os painéis, e só se
 * dá por isso semanas depois.
 *
 * **A região vai por extenso e não se deduz do anfitrião.** A biblioteca
 * junta a qualquer evento o `$host` e o `$current_url`, e hoje esses bastavam
 * para separar os três domínios. Mas o domínio é do cliente e muda: no dia em
 * que uma CIM levar a agenda para o nome dela, o histórico partia-se em dois
 * sem forma de o voltar a colar. O identificador da região é que não muda, e
 * é por isso que é ele o eixo.
 */
export function propriedadesDaVista(path: string, regiao: string): Record<string, string> {
  return { $pathname: path, regiao };
}

/**
 * O que corre dentro do `iframe` de outra pessoa não é uma visita a este
 * sítio.
 *
 * O widget vive no sítio de uma câmara, e carrega com ele: cada visita à
 * página dela contaria como uma visita à agenda. Não seria um erro pequeno —
 * o número passaria a crescer com o trânsito do sítio da câmara e não com o
 * nosso, e mais gente «visitaria» a agenda do que alguma vez a abriu.
 *
 * O caminho aqui é o público, o que está na barra do navegador dentro do
 * `iframe` (`/widget/tomar`) — o mesmo que a barra de navegação lê para não
 * se acender lá dentro, ver `lib/navegacao.ts`.
 *
 * **A função mudou de casa e continua a ser chamada aqui.** Vive agora em
 * `caixa-embebida.ts`, sozinha e sem dependências, para o `AnalyticsProvider`
 * a poder perguntar sem importar este ficheiro — que traz a chave e a
 * biblioteca atrás dele, e ia parar ao `iframe` de cada câmara. A guarda fica
 * aqui na mesma, e é de propósito: quem chamar `capturePageView` por outro
 * caminho continua protegido por ela.
 */
export { ehCaixaEmbebida } from './caixa-embebida';

/** Uma vista de página. Não faz nada quando o PostHog não está configurado. */
export async function capturePageView(path: string, regiao: string): Promise<void> {
  if (ehCaixaEmbebida(path)) return;
  const client = await startPostHog();
  client?.capture('$pageview', propriedadesDaVista(path, regiao));
}
