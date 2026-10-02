'use client';

// O que os dois mapas desta casa — o dos eventos e o dos coretos — têm em
// comum: a biblioteca, os mosaicos, o tema, a espera e a pergunta à rede.
//
// Vive num módulo só pela mesma razão por que o `carregarMapLibre` sempre
// guardou a promessa: o `setWorkerUrl` tem de acontecer uma vez e antes do
// primeiro mapa, e duas cópias desta função — uma por mapa — eram duas
// promessas e dois `setWorkerUrl`, que é precisamente o que o comentário dela
// diz que não pode haver.
//
// A versão 6 do MapLibre, e as duas coisas que ela obriga a fazer.
//
// **Esta casa ficou na 5 de propósito, e a razão estava escrita aqui.** Dizia,
// à letra: a 6 deriva o endereço do seu processador de `import.meta.url` e
// desiste em silêncio quando ele não é um `http(s)` — que é o que acontece
// depois de um empacotador inlinar a biblioteca; o resultado é
// `new Worker('')`, nenhuma fonte carrega, e o mapa fica um retângulo vazio
// sem um único erro na consola. A análise estava certa: a 19 de setembro de
// 2026 subiu-se à 6 por causa de uma vulnerabilidade crítica na 5 e
// reencontrou-se exatamente isso, num Chromium, contra a compilação de
// produção.
//
// O que mudou não foi o diagnóstico: foi haver saída. A 6 expõe
// `setWorkerUrl`, e o processador passa a ser servido por nós, de
// `public/maplibre/<versão>/` (ver `scripts/copiar-maplibre.mjs`) — dito em
// vez de descoberto. A versão vai no caminho para que a cache de um navegador
// nunca junte um processador antigo a um módulo principal novo.
//
// **E a biblioteca carrega-se dentro de uma função, não no topo.** A 6 é ESM
// puro, e um `import` estático punha-a no pacote comum a todas as páginas:
// medido, a entrada — que não tem mapa nenhum — passou de 144 kB de JavaScript
// para 357, contra um tecto de 170. Um `await import()` devolve-a ao seu
// próprio pedaço, pedido só por quem abre um mapa. O `dynamic()` dos dois
// invólucros não chegava para isso: separa o componente, não o que ele importa
// estaticamente.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { estaEscuro } from '@/src/lib/tema';

/**
 * A biblioteca, carregada uma vez e guardada.
 *
 * `import()` é ele próprio memoizado pelo navegador, mas guardar a promessa
 * aqui poupa a segunda travessia do módulo e, mais importante, deixa dito num
 * sítio só que isto se carrega uma vez: o `setWorkerUrl` tem de acontecer
 * antes do primeiro `new Map` e nunca mais, e amarrá-lo ao carregamento é o
 * que o garante sem uma bandeira à parte.
 */
let biblioteca: Promise<typeof import('maplibre-gl')> | null = null;

export function carregarMapLibre(): Promise<typeof import('maplibre-gl')> {
  biblioteca ??= import('maplibre-gl').then((modulo) => {
    modulo.setWorkerUrl(`/maplibre/${modulo.getVersion()}/maplibre-gl-worker.mjs`);
    return modulo;
  });
  return biblioteca;
}

/**
 * Os mosaicos do OpenFreeMap, um por tema.
 *
 * «Positron» e «dark matter» são estilos feitos para serem o fundo de outra
 * coisa: cinzentos, sem cor a competir com as marcas. Um mapa de base colorido
 * faz um mapa de eventos mau, porque as marcas deixam de ser a primeira coisa
 * que se vê.
 */
export const ESTILOS_DO_MAPA = {
  claro: 'https://tiles.openfreemap.org/styles/positron',
  escuro: 'https://tiles.openfreemap.org/styles/dark',
} as const;

/**
 * As cores dos contornos, lidas dos tokens do próprio sítio.
 *
 * O MapLibre pinta num `canvas` e não sabe o que é uma variável de CSS, por
 * isso o valor tem de ser lido e passado. Lê-se da caixa do mapa, e não do
 * `documentElement`: uma variável herda-se, e é na caixa que ela chega já
 * resolvida — com o tema, e com a paleta do sítio onde o mapa está (a
 * demonstração veste outra cor por um invólucro, e o `<html>` não sabe disso).
 * Assim o mapa muda de cor com o tema em vez de ter uma cor escrita à mão que
 * fica ilegível metade do dia.
 */
export function corDoTema(caixa: Element | null, nome: string, alternativa: string): string {
  if (typeof window === 'undefined' || !caixa) return alternativa;
  const valor = getComputedStyle(caixa).getPropertyValue(nome).trim();
  return valor || alternativa;
}

/**
 * O tema, lido como o CSS o lê: atributo explícito primeiro, sistema depois.
 *
 * Fica em estado porque muda enquanto a página está aberta — pelo botão do
 * cabeçalho ou pelo anoitecer. `null` até se saber: o servidor não sabe o tema
 * de quem pede, e um mapa montado no tema errado era um mapa montado duas
 * vezes.
 */
export function useTemaEscuro(): boolean | null {
  const [escuro, setEscuro] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const ler = () =>
      setEscuro(estaEscuro(document.documentElement.dataset['theme'], media.matches));
    ler();

    const observador = new MutationObserver(ler);
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    media.addEventListener('change', ler);
    return () => {
      observador.disconnect();
      media.removeEventListener('change', ler);
    };
  }, []);

  return escuro;
}

/** O que o navegador diz da ligação, onde o diz — o Chromium diz, o Safari e o Firefox não. */
interface LigacaoDoNavegador {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * A ligação é lenta, ou quem visita pediu para poupar dados?
 *
 * Um mapa custa cerca de um megabyte — a biblioteca, os mosaicos, as letras do
 * mapa de base —, e numa rede móvel lenta levava dez a catorze segundos a
 * ficar útil, com o telemóvel preso enquanto arrancava (C3-012). Nesses casos
 * não se monta sozinho: pergunta-se. Sem a informação, monta-se, como sempre
 * se montou — não se adivinha que a rede é má.
 *
 * **O «3g» não conta, e foi medido.** A estimativa do Chromium vem da latência
 * que ele próprio observou, de todos os pedidos da sessão: numa máquina rápida
 * atrás de um procurador lento chegou a dizer «3g» ao fim de uma volta pelo
 * sítio, e o mapa ficou escondido atrás do botão sem a rede ser lenta. O
 * pedido de poupar dados é uma escolha de quem visita, e o «2g» é lento a
 * sério; abaixo disso, um falso alarme custava o mapa a quem não precisava.
 */
function ligacaoLenta(): boolean {
  const ligacao = (navigator as Navigator & { connection?: LigacaoDoNavegador }).connection;
  if (!ligacao) return false;
  return ligacao.saveData === true || ['slow-2g', '2g'].includes(ligacao.effectiveType ?? '');
}

/**
 * A resposta da primeira vez, e mais nenhuma.
 *
 * A ligação muda enquanto a página está aberta — entra-se num túnel, sai-se
 * dele —, e um mapa que já se montou não se desmonta por isso. Decide-se uma
 * vez por visita.
 */
let lentaNaPrimeiraVez: boolean | null = null;
function ligacaoLentaUmaVez(): boolean {
  lentaNaPrimeiraVez ??= ligacaoLenta();
  return lentaNaPrimeiraVez;
}

/** Não há a que subscrever: a decisão é tomada uma vez (ver acima). */
function semSubscricao(): () => void {
  return () => {};
}

/**
 * Monta-se o mapa já, pergunta-se primeiro, ou ainda não se sabe?
 *
 * `null` no servidor e no primeiro desenho do cliente, que tem de ser igual ao
 * do servidor — o servidor não sabe a rede de quem pede. Lida por
 * `useSyncExternalStore`, que é a forma de o React ler o que vive fora dele sem
 * um estado a mais.
 */
export function useMontarOMapa(): { montar: boolean | null; pedir: () => void } {
  const lenta = useSyncExternalStore(semSubscricao, ligacaoLentaUmaVez, () => null);
  const [pedido, setPedido] = useState(false);
  return {
    montar: lenta === null ? null : pedido || !lenta,
    pedir: () => setPedido(true),
  };
}

/** A altura da caixa do mapa, a mesma na espera e no mapa: trocar uma pela outra não salta. */
export const ALTURA_DO_MAPA = 'h-[60vh] max-h-[560px] min-h-[320px]';

/**
 * O lugar do mapa enquanto ele não chega — dito, e não só desenhado.
 *
 * Era um bloco cinzento a pulsar, escondido de quem ouve e mudo para quem vê:
 * numa rede móvel ficava assim dez segundos, e quem lá estava não sabia se a
 * página tinha parado (C3-012). Agora diz o que está a acontecer.
 */
export function EsperaDoMapa({ altura = ALTURA_DO_MAPA }: { altura?: string }) {
  return (
    <div
      role="status"
      className={`ct-grain grid ${altura} w-full place-items-center rounded-lg border border-border bg-paper px-4 text-center text-sm text-muted`}
    >
      A carregar o mapa…
    </div>
  );
}

/**
 * A pergunta, quando a rede é lenta: o mapa pesa, e a página tem o mesmo sem
 * ele. `alternativa` diz onde — a tabela, a lista —, porque a frase só é útil
 * se mandar para algum lado.
 */
export function PerguntaDoMapa({
  alternativa,
  onPedir,
}: {
  alternativa: string;
  onPedir: () => void;
}) {
  return (
    <div className="grid min-h-[200px] w-full place-items-center rounded-lg border border-border bg-paper px-4 py-8 text-center">
      <div className="max-w-sm">
        <p className="text-sm text-muted">
          O mapa pesa cerca de 1 MB, e a sua ligação parece lenta ou a poupar dados. {alternativa}
        </p>
        <button
          type="button"
          onClick={onPedir}
          className="mt-3 inline-flex min-h-11 items-center rounded bg-accent px-5 text-sm font-medium text-on-accent"
        >
          Mostrar o mapa
        </button>
      </div>
    </div>
  );
}

/**
 * De onde vem o mapa, por extenso.
 *
 * O controlo de atribuição do MapLibre já o diz, recolhido num «i» no canto;
 * a licença do OpenStreetMap pede que se diga onde se vê, e esta linha é isso.
 */
export function AtribuicaoDoMapa() {
  return (
    <p className="mt-1.5">
      Mapa de{' '}
      <a
        href="https://openfreemap.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4"
      >
        OpenFreeMap
      </a>
      , com dados dos{' '}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4"
      >
        contribuidores do OpenStreetMap
      </a>
      .
    </p>
  );
}
