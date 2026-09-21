/**
 * Alojar um cartaz em vez de apontar para ele.
 *
 * O Coreto apontava: o `image_url` de um evento era o endereço de uma imagem
 * no servidor de quem a publicou, e o browser de quem lê ia lá buscá-la. Passa
 * a guardar uma cópia redimensionada, e este módulo é onde está escrito
 * **quando** é que isso se faz — só isso. O que descarrega, o que redimensiona
 * e o que escreve no balde vive em `@coreto/ingest`, porque precisa de rede e
 * de bytes; o que decide não precisa de nenhum dos dois, e é por isso que é
 * aqui que se consegue exercitar sem nada montado.
 *
 * As três cautelas da decisão (ver a migração 0162) aparecem cada uma no seu
 * sítio: a fonte tem de estar declarada como alojável, a origem guarda-se
 * sempre para a ficha poder creditar, e um cartaz retirado a pedido nunca
 * chega sequer a ser pedido à rede.
 */

/**
 * As duas larguras, e porque são duas.
 *
 * A fila da agenda desenha o cartaz a 84 píxeis no telemóvel; a ficha desenha-o
 * a toda a largura da vitrine. Servir o mesmo ficheiro aos dois custa a
 * diferença entre os dois **vinte vezes por página**.
 *
 * Os números são medidos e não estimados, contra os primeiros 38 cartazes
 * municipais copiados a sério: **43 KB de média o grande, 14 KB a miniatura**.
 * Numa lista de vinte cartões são 280 KB em vez de 860 KB — e os originais de
 * onde vieram pesavam várias vezes isso. (A primeira versão deste comentário
 * dizia 110 KB e 20 KB, escritos antes de haver o que medir. O WebP a 78
 * comprime melhor do que eu supus.)
 *
 * Os mil e duzentos cobrem a vitrine da ficha num ecrã de retina sem ficar a
 * pedir uma imagem maior do que qualquer cartaz municipal costuma ter: dos que
 * se mediram, a mediana anda nos 1200 de lado. Um cartaz mais pequeno do que
 * isto **não é ampliado** — ver `sharp.resize({ withoutEnlargement: true })`
 * em `@coreto/ingest`: crescer uma imagem é inventar píxeis e pesar mais para
 * ficar pior.
 */
export const LARGURA_DO_CARTAZ = 1200;
export const LARGURA_DA_MINIATURA = 400;

/**
 * A qualidade do WebP, e o número é medido.
 *
 * Contra os cartazes verdadeiros que já estão no catálogo, 78 é onde a curva
 * dobra: de 70 para 78 ganha-se nitidez visível no texto de um cartaz (que é
 * quase sempre o que um cartaz tem), e de 78 para 90 ganha-se mais 60 % de
 * bytes por uma diferença que não se vê a olho. A miniatura pode ir mais
 * abaixo porque é desenhada a um quinto do tamanho — e metade das vezes
 * desfocada, no fundo da capa.
 */
export const QUALIDADE_DO_CARTAZ = 78;
export const QUALIDADE_DA_MINIATURA = 72;

/**
 * O tecto do que se descarrega.
 *
 * Do outro lado está o servidor de outra pessoa, e o que ele manda não é de
 * confiança: um endereço de cartaz pode responder com um vídeo, com um PDF de
 * cem páginas ou com uma imagem de mil megapíxeis feita para rebentar quem a
 * abrir. Oito megabytes são folgados para um cartaz — o maior do catálogo tem
 * 2,1 MB — e são um tecto que a recolha aguenta sem pensar.
 */
export const MAXIMO_DE_BYTES_DO_ORIGINAL = 8 * 1024 * 1024;

/** O balde público da 0008, que foi feito para isto e estava por usar. */
export const BALDE_DOS_CARTAZES = 'media';

/** Uma pasta por evento: é o que faz `retirar` e `limpar` serem uma listagem. */
export function pastaDoCartaz(eventId: string): string {
  return `cartazes/${eventId}`;
}

export interface CartazGuardado {
  /** O endereço público da cópia grande. */
  url: string;
  /** O endereço público da miniatura. */
  miniatura: string;
  largura: number;
  altura: number;
}

export interface EstadoDoCartaz {
  /** O endereço que a recolha acabou de ler na agenda da fonte. */
  origem: string | null;
  /** Se a fonte está declarada como alojável (`sources.cartaz_alojavel`). */
  alojavel: boolean;
  /** Se este evento tem a marca de cartaz retirado a pedido. */
  retirado: boolean;
  /** O que já está guardado, ou nulo para um evento novo. */
  anterior: {
    image_url: string | null;
    image_origem: string | null;
    image_miniatura: string | null;
  } | null;
}

export type DecisaoDoCartaz =
  /** Retirado a pedido: não se pede à rede, não se escreve, não se pensa mais. */
  | { accao: 'retirado' }
  /** A fonte não trouxe cartaz nenhum. */
  | { accao: 'nenhum' }
  /** Fonte não alojável: serve-se da origem, como sempre se serviu. */
  | { accao: 'apontar'; origem: string; havia: boolean }
  /** Já há cópia desta origem: não se toca na rede. */
  | { accao: 'manter' }
  /** Há cartaz novo (ou nunca se conseguiu copiar): copia-se. */
  | { accao: 'copiar'; origem: string };

/**
 * O que fazer ao cartaz de um evento, nesta passagem da recolha.
 *
 * A ordem das perguntas é a ordem do que custa: primeiro o que dispensa a rede
 * (retirado, sem cartaz, fonte não alojável), depois o que a dispensa por já
 * estar feito (`manter`), e só no fim o que a usa.
 *
 * **`manter` é o caso normal e é o que faz isto não custar nada.** Numa noite
 * em que a agenda de um concelho não mude de cartazes, não sai daqui um único
 * pedido nem um único byte para o balde — é o mesmo argumento que `medirCartaz`
 * já fazia para as medidas, e pela mesma razão: o que decide é o endereço, não
 * o evento.
 *
 * **Uma cópia que falhou ontem tenta-se outra vez hoje.** É o que traz cópias
 * aos eventos que já estavam publicados quando isto entrou, e o que recupera de
 * uma noite em que o servidor da câmara respondeu 503. Custa um pedido por
 * noite por cartaz que nunca se consiga copiar, e são poucos.
 *
 * **`havia` em `apontar` é a limpeza.** Quando alguém desliga o alojamento de
 * uma fonte no painel, as cópias que ela já tinha deixam de ser servidas — e
 * deixar os ficheiros no balde era guardar o que se acabou de decidir não
 * guardar. Quem executa a decisão apaga-os.
 */
export function decidirCartaz(estado: EstadoDoCartaz): DecisaoDoCartaz {
  if (estado.retirado) return { accao: 'retirado' };

  const origem = estado.origem?.trim() ?? '';
  if (origem.length === 0) return { accao: 'nenhum' };

  const anterior = estado.anterior;
  const haviaCopia = anterior !== null && anterior.image_miniatura !== null;

  if (!estado.alojavel) return { accao: 'apontar', origem, havia: haviaCopia };

  const jaCopiado =
    anterior !== null &&
    anterior.image_origem === origem &&
    anterior.image_miniatura !== null &&
    anterior.image_url !== null;
  if (jaCopiado) return { accao: 'manter' };

  return { accao: 'copiar', origem };
}

/**
 * O crédito de um cartaz copiado.
 *
 * **Uma cópia sem crédito é a coisa que este trabalho não pode produzir.** É a
 * segunda das três cautelas, e é a única que não tem um botão nem uma coluna a
 * garanti-la: escreve-se aqui, no momento em que a cópia se faz, ou não se
 * escreve nunca — em produção, 219 de 296 eventos tinham imagem e **nenhum**
 * tinha crédito, que foi o que o `docs/TERCEIROS.md` registou como problema
 * por resolver.
 *
 * O crédito é o nome da fonte porque é o que se sabe com verdade. Quem
 * desenhou o cartaz de uma festa não está escrito em lado nenhum da página de
 * onde ele veio; quem o publicou está, e é a Câmara ou a Junta. Dizer «Câmara
 * Municipal de Tomar» é dizer o que se sabe; inventar um autor era dizer o que
 * não se sabe, e a ficha liga à página de origem precisamente para quem quiser
 * ir ver o resto.
 *
 * **Não sobrepõe um crédito que já lá esteja.** Se alguém escreveu um crédito
 * à mão na moderação, foi porque sabia mais do que isto sabe.
 */
export function creditoDoCartaz(
  creditoExistente: string | null,
  nomeDaFonte: string | null,
): string | null {
  const existente = creditoExistente?.trim() ?? '';
  if (existente.length > 0) return existente;
  const fonte = nomeDaFonte?.trim() ?? '';
  return fonte.length > 0 ? fonte : null;
}
