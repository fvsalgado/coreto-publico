import type { NomeDeIcone } from '../components/Sinais';

/**
 * O que é sinalizável, e como se diz.
 *
 * Separado do desenho porque é regra de negócio, não apresentação: qual é o
 * rótulo completo de cada marca, qual é a palavra curta que se vê, e — a parte
 * que interessa — o que **não** se assinala.
 *
 * A tentação era assinalar as três coisas: tem, não tem, não se sabe. O sítio
 * fazia-o por extenso e ficava uma frase de trinta palavras a explicar que não
 * havia informação. Não se sabe não é um estado que valha tinta: quem lê uma
 * agenda assume, e bem, que o que não está marcado não está garantido. A única
 * ausência que se marca é a verificada — «não tem acesso a cadeiras de rodas»
 * poupa uma viagem, e por isso paga o espaço que ocupa.
 */

export interface Descritor {
  icone: NomeDeIcone;
  /** O significado inteiro, para leitores de ecrã e para o `title`. */
  rotulo: string;
  /** A palavra ou sigla que se vê. */
  curto: string;
  tom?: 'normal' | 'destaque' | 'apagado';
}

export interface FonteDeAcessibilidade {
  wheelchair_accessible: boolean | null;
  has_sign_language?: boolean;
  has_audio_description?: boolean;
  has_subtitles?: boolean;
  is_relaxed_performance?: boolean;
}

/**
 * As marcas de acessibilidade declaradas.
 *
 * As colunas booleanas da base são falsas por omissão, por isso um `false` só
 * se pode ler como silêncio da fonte e nunca como «não tem» — a única que
 * distingue os três estados é o acesso a cadeiras de rodas, que é anulável.
 */
export function sinaisDeAcessibilidade(fonte: FonteDeAcessibilidade): Descritor[] {
  const sinais: Descritor[] = [];

  if (fonte.wheelchair_accessible === true) {
    sinais.push({ icone: 'acessivel', rotulo: 'Acesso a cadeiras de rodas', curto: 'Acessível' });
  } else if (fonte.wheelchair_accessible === false) {
    sinais.push({
      icone: 'acessivel',
      rotulo: 'Sem acesso a cadeiras de rodas',
      curto: 'Sem acesso',
      tom: 'apagado',
    });
  }

  if (fonte.has_sign_language) {
    sinais.push({
      icone: 'lgp',
      rotulo: 'Com interpretação em Língua Gestual Portuguesa',
      curto: 'LGP',
    });
  }
  if (fonte.has_audio_description) {
    sinais.push({ icone: 'audiodescricao', rotulo: 'Com audiodescrição', curto: 'AD' });
  }
  if (fonte.has_subtitles) {
    sinais.push({ icone: 'legendagem', rotulo: 'Com legendagem', curto: 'Legendado' });
  }
  if (fonte.is_relaxed_performance) {
    sinais.push({
      icone: 'relaxada',
      rotulo: 'Sessão relaxada: som e luz mais suaves, com liberdade para entrar e sair',
      curto: 'Relaxada',
    });
  }

  return sinais;
}

/** O preço, quando se sabe. Entrada livre destaca-se; o resto é informação a par das outras. */
export function sinalDePreco(evento: {
  is_free: boolean;
  price_display: string | null;
}): Descritor | null {
  if (evento.is_free) {
    return {
      icone: 'bilhete',
      rotulo: 'Entrada livre',
      curto: 'Entrada livre',
      tom: 'destaque',
    };
  }
  if (evento.price_display) {
    return { icone: 'bilhete', rotulo: evento.price_display, curto: evento.price_display };
  }
  return null;
}
