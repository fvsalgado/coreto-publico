/**
 * Os eventos que alguém guardou, no próprio aparelho.
 *
 * **Sem conta e sem servidor, e é essa a decisão de desenho.** Nantes, o
 * Fever, o I amsterdam e o wien.info têm todos uma lista de guardados, e todos
 * a pagam com uma conta. Uma agenda municipal que pedisse registo para guardar
 * um concerto estaria a pedir um nome, um email e um consentimento para
 * resolver um problema que o `localStorage` resolve sozinho — e passaria a
 * tratar dados pessoais que hoje não trata. A lista vive no navegador de quem
 * a fez: não chega aqui, não se sincroniza entre aparelhos e não aparece em
 * registo nenhum. O `docs/RGPD.md` diz isto por extenso, porque a ausência de
 * tratamento também se documenta.
 *
 * **O que se guarda é uma fotografia, não uma ligação.** Guardar só o
 * identificador obrigaria a lista a pedir cada evento ao servidor para se
 * desenhar — e uma lista de guardados que não abre sem rede é uma lista que
 * falha no sítio onde é útil, à porta do espetáculo. Guarda-se o suficiente
 * para a desenhar: título, dias, sítio. O preço disto é a fotografia
 * envelhecer, e por isso cada ficha diz o dia em que foi tirada e liga para a
 * página do evento, que é a que manda.
 *
 * **Tudo o que toca no armazenamento vai dentro de um `try`.** Numa janela
 * privada, com as cookies bloqueadas ou com a quota cheia, `localStorage`
 * lança em vez de devolver vazio — e um coração que rebenta a página é pior do
 * que um coração que não guarda.
 */

const CHAVE = 'coreto-favoritos';

/**
 * Tecto da lista.
 *
 * Não é o `localStorage` que se está a proteger — cinco megabytes dão para
 * dezenas de milhares destes —, é a página: quinhentas fichas desenhadas de
 * uma vez num telemóvel antigo é meio segundo de bloqueio. Ao chegar ao tecto
 * sai o mais antigo, que é o que quem guarda espera de uma lista de guardados.
 */
const TECTO = 200;

export interface Favorito {
  /** O identificador do evento na agenda — é por ele que se liga e se compara. */
  slug: string;
  title: string;
  /** Data ISO `AAAA-MM-DD`. */
  date_start: string | null;
  date_end: string | null;
  /** `HH:MM`, quando o cartão a sabia. */
  start_time: string | null;
  /** O sítio por extenso, como o cartão o mostrava. */
  location: string | null;
  /** Quando é que esta fotografia foi tirada, em ISO. */
  guardadoEm: string;
}

/** O que quem guarda tem de dar; o carimbo é desta casa. */
export type ParaGuardar = Omit<Favorito, 'guardadoEm'>;

const EVENTO = 'coreto:favoritos';

function ler(): Favorito[] {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return [];
    const lido: unknown = JSON.parse(cru);
    if (!Array.isArray(lido)) return [];
    /*
     * Valida-se à entrada e não à saída.
     *
     * O que está no `localStorage` foi escrito por uma versão deste sítio que
     * pode não ser esta — e, em teoria, por qualquer coisa com acesso à
     * consola. Uma ficha sem `slug` ou sem título não se desenha e não se
     * exporta; deitá-la fora aqui é mais barato do que defender cada sítio
     * onde ela passaria.
     */
    return lido.filter(
      (item): item is Favorito =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Favorito).slug === 'string' &&
        (item as Favorito).slug.length > 0 &&
        typeof (item as Favorito).title === 'string',
    );
  } catch {
    return [];
  }
}

function escrever(lista: readonly Favorito[]): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista.slice(-TECTO)));
  } catch {
    // Sem armazenamento a lista vale só até fechar a página. Continua a
    // anunciar-se a quem está a ouvir, para o coração desta sessão acender.
  }
  avisar();
}

/*
 * Quem está a ouvir.
 *
 * São dois canais e fazem falta os dois: o `storage` do navegador avisa as
 * **outras** abas e cala-se na que escreveu, e este evento avisa a própria.
 * Sem o primeiro, guardar num separador deixava o coração do outro apagado a
 * mentir; sem o segundo, o coração não acendia ao ser carregado.
 */
function avisar(): void {
  try {
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    // Fora do navegador não há quem ouça, e não há nada a fazer.
  }
}

export function subscrever(aoMudar: () => void): () => void {
  const daOutraAba = (evento: StorageEvent) => {
    if (evento.key === null || evento.key === CHAVE) aoMudar();
  };
  window.addEventListener(EVENTO, aoMudar);
  window.addEventListener('storage', daOutraAba);
  return () => {
    window.removeEventListener(EVENTO, aoMudar);
    window.removeEventListener('storage', daOutraAba);
  };
}

/*
 * A lista, memoizada para o React.
 *
 * `useSyncExternalStore` compara o que o `getSnapshot` devolve com o que
 * devolveu antes, e `JSON.parse` devolve um array novo de cada vez: sem esta
 * cache, cada render via uma lista «diferente» e o React entrava em ciclo.
 * Guarda-se o texto cru ao lado do resultado — se o texto não mudou, a lista
 * é a mesma referência.
 */
let cacheCru: string | null = null;
let cacheLista: Favorito[] = [];

export function favoritos(): Favorito[] {
  let cru: string | null = null;
  try {
    cru = localStorage.getItem(CHAVE);
  } catch {
    cru = null;
  }
  if (cru === cacheCru) return cacheLista;
  cacheCru = cru;
  cacheLista = ler();
  return cacheLista;
}

/** A lista vazia para o servidor, que não tem armazenamento nenhum. */
export const NENHUM: Favorito[] = [];

export function estaGuardado(slug: string): boolean {
  return favoritos().some((item) => item.slug === slug);
}

/**
 * Guarda ou esquece, conforme o que lá está — e devolve o estado novo.
 *
 * Guardar de novo o que já estava atualiza a fotografia em vez de duplicar a
 * ficha: quem carrega no coração de um evento que mudou de sala espera que a
 * lista passe a dizer a sala nova.
 */
export function alternar(evento: ParaGuardar): boolean {
  const lista = favoritos();
  const jaLa = lista.some((item) => item.slug === evento.slug);
  const semEste = lista.filter((item) => item.slug !== evento.slug);
  if (jaLa) {
    escrever(semEste);
    return false;
  }
  escrever([...semEste, { ...evento, guardadoEm: new Date().toISOString() }]);
  return true;
}

export function esquecer(slug: string): void {
  escrever(favoritos().filter((item) => item.slug !== slug));
}

export function esquecerTudo(): void {
  escrever([]);
}

/**
 * Os guardados por ordem de acontecimento, e não por ordem de quem os guardou.
 *
 * Uma lista de guardados serve para decidir o que fazer a seguir: o que é
 * amanhã vem antes do que é daqui a três meses. O que já passou não se apaga
 * sozinho — apagar o que alguém guardou é uma decisão que não é desta casa —,
 * mas vai para o fim, onde não estorva.
 */
export function porOrdemDeData(lista: readonly Favorito[], hoje: string): Favorito[] {
  const quando = (item: Favorito) => item.date_end ?? item.date_start ?? '';
  return [...lista].sort((a, b) => {
    const passadoA = quando(a) !== '' && quando(a) < hoje;
    const passadoB = quando(b) !== '' && quando(b) < hoje;
    if (passadoA !== passadoB) return passadoA ? 1 : -1;
    return (a.date_start ?? '9999').localeCompare(b.date_start ?? '9999');
  });
}
