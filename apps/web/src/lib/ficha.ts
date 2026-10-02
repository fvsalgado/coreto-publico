import {
  formatLongDate,
  formatShortDate,
  formatTime,
  formatWeekdayDate,
  horaDeInicioConhecida,
  joinPt,
} from './format';

/**
 * As perguntas que a ficha de um evento responde no primeiro ecrã.
 *
 * Quem aterra numa ficha — vindo do WhatsApp, de uma pesquisa, do widget da
 * câmara — quer quatro respostas: quando, onde, quanto custa e se ainda vai a
 * tempo. A página tinha-as todas e dava-as a dois e três ecrãs do título (a hora
 * em «Quando», depois da sinopse inteira; o preço em «Detalhes», no fim), e
 * algumas não as dava de todo: um evento que já passou parecia por acontecer, e
 * a falta de preço não se dizia (C1-011, C2-003, C3-016, C2-005, C2-014).
 *
 * Vive aqui, e não na página, pela razão que está escrita no `agrupar.ts`: o
 * `vitest` desta casa não resolve o atalho `@/`, e o que se decide sem tocar na
 * base nem no React é o que se pode testar. A página só desenha o que sai daqui.
 */

/** O que uma ficha precisa de saber de cada sessão. */
export interface SessaoDaFicha {
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  is_cancelled: boolean;
}

export interface EventoDaFicha {
  status: string;
  date_start: string | null;
  date_end: string | null;
  is_ongoing: boolean;
  sessions: readonly SessaoDaFicha[];
}

/**
 * Em que pé está o evento, do ponto de vista de quem lê hoje.
 *
 * - `cancelado` e `adiado` são decisões de uma pessoa (0163) — e também conta
 *   como cancelado o evento cujas sessões foram todas canceladas, que é o que
 *   os dados estruturados já diziam a uma máquina.
 * - `ja-aconteceu` é o arquivo **ou** o que tem o último dia antes de hoje. A
 *   ficha decidia só pelo arquivo, e um evento de há doze dias que a recolha
 *   ainda não arquivou abria com a data em destaque e «Adicionar ao
 *   calendário» (C2-005, C1-014). A data decide quando o estado ainda não
 *   decidiu; o contrário não — um arquivado com data futura (há-os) continua a
 *   ser registo, que é o que a recolha escreveu.
 */
export type EstadoDaFicha = 'por-acontecer' | 'ja-aconteceu' | 'cancelado' | 'adiado';

/** O último dia em que o evento acontece, ou `null` quando não se sabe. */
export function ultimoDia(evento: EventoDaFicha): string | null {
  const dias = [evento.date_end, evento.date_start, ...evento.sessions.map((s) => s.session_date)]
    .filter((dia): dia is string => Boolean(dia))
    .sort();
  return dias.at(-1) ?? null;
}

/**
 * O dia do evento, quando é um só e ainda está por vir — para o planeador de
 * transportes abrir as ligações desse dia (`irDeTransportes`).
 *
 * Um só dia de propósito: numa exposição de três meses, ou num ciclo com
 * sessões em quatro sábados, não há «o dia» — e escolher o primeiro mandava
 * quem lê para uma data que talvez não seja a dele. Aí o planeador parte
 * «agora», e o dia escolhe-se lá. Hoje também fica de fora: «agora» é o que
 * serve a quem lê a ficha no próprio dia, e `dia` sem hora começava à meia-noite.
 */
export function diaUnicoPorVir(evento: EventoDaFicha, hoje: string): string | null {
  if (evento.is_ongoing || estadoDaFicha(evento, hoje) !== 'por-acontecer') return null;
  const vivas = evento.sessions.filter((sessao) => !sessao.is_cancelled);
  const dias = new Set(
    vivas.length > 0
      ? vivas.map((sessao) => sessao.session_date)
      : [evento.date_start, evento.date_end].filter((dia): dia is string => Boolean(dia)),
  );
  if (dias.size !== 1) return null;
  const [dia] = [...dias];
  return dia !== undefined && dia > hoje ? dia : null;
}

export function estadoDaFicha(evento: EventoDaFicha, hoje: string): EstadoDaFicha {
  if (evento.status === 'cancelled') return 'cancelado';
  if (evento.status === 'postponed') return 'adiado';
  if (evento.sessions.length > 0 && evento.sessions.every((sessao) => sessao.is_cancelled)) {
    return 'cancelado';
  }
  if (evento.status === 'archived') return 'ja-aconteceu';
  const ultimo = ultimoDia(evento);
  return ultimo !== null && ultimo < hoje ? 'ja-aconteceu' : 'por-acontecer';
}

/**
 * A nova data de um evento adiado, quando a base a tem — e `null` quando não.
 *
 * Não há coluna para «a nova data», e não se inventa uma: lê-se o que as
 * sessões já dizem. Um adiamento com data nova escreve-se como a recolha e o
 * painel escrevem qualquer mudança de data — a sessão antiga cancelada, a nova
 * de pé —, e é só esse desenho que conta: pelo menos uma sessão cancelada e
 * uma viva **depois** dela. Um adiado sem nada cancelado tem as sessões que
 * estavam marcadas, e a data que mostram é a antiga, não a nova.
 */
export function novaDataDoAdiado(evento: EventoDaFicha): string | null {
  if (evento.status !== 'postponed') return null;
  const canceladas = evento.sessions.filter((sessao) => sessao.is_cancelled);
  if (canceladas.length === 0) return null;
  const ultimaCancelada = canceladas
    .map((sessao) => sessao.session_date)
    .sort()
    .at(-1) as string;
  const novas = evento.sessions
    .filter((sessao) => !sessao.is_cancelled && sessao.session_date > ultimaCancelada)
    .map((sessao) => sessao.session_date)
    .sort();
  return novas[0] ?? null;
}

/** «3 de outubro» — e «3 de outubro de 2027» quando não é deste ano. */
function dataLonga(iso: string, hoje: string): string {
  const semAno = formatLongDate(iso).replace(/ de \d{4}$/, '');
  return iso.slice(0, 4) === hoje.slice(0, 4) ? semAno : `${semAno} de ${iso.slice(0, 4)}`;
}

/** «Sábado, 3 de outubro» — e «…de 2027» quando não é deste ano. */
export function diaPorExtenso(iso: string, hoje: string): string {
  const texto = formatWeekdayDate(iso);
  const comAno = iso.slice(0, 4) === hoje.slice(0, 4) ? texto : `${texto} de ${iso.slice(0, 4)}`;
  return `${comAno.charAt(0).toUpperCase()}${comAno.slice(1)}`;
}

/** As horas conhecidas de um dia, por ordem: «10h30 e 16h30». */
function horasDoDia(sessoes: readonly SessaoDaFicha[]): string | null {
  const horas = sessoes
    .map((sessao) => horaDeInicioConhecida(sessao.start_time, sessao.end_time))
    .filter((hora): hora is string => hora !== null)
    .sort()
    .map((hora) => formatTime(hora))
    .filter((hora): hora is string => hora !== null);
  const unicas = [...new Set(horas)];
  return unicas.length > 0 ? joinPt(unicas) : null;
}

export interface QuandoDaFicha {
  /** «Sábado, 3 de outubro · 10h30» — a linha principal. */
  texto: string;
  /** O que vai no `dateTime` do `<time>`, quando há um dia (ou um instante). */
  dateTime: string | null;
  /**
   * Sem hora conhecida num dia que ainda vem aí: a ficha diz «hora por
   * confirmar», à parte e apagado. Num dia que já passou a hora já não é a
   * pergunta, e não se diz.
   */
  horaPorConfirmar: boolean;
  /** «Também a 12 de outubro, às 21h» ou «E mais 3 datas»; `null` quando não há. */
  outras: string | null;
}

/**
 * A linha «Quando» do bloco do primeiro ecrã.
 *
 * **Um período é um período.** Uma exposição patente diz até quando se pode ir
 * («Em cartaz até 22 de outubro»), como o cartão já dizia: a hora da sessão de
 * abertura é um horário de abertura, e não a hora de nada.
 *
 * **Uma lista de sessões é a próxima sessão.** A de hoje ou a seguinte — com
 * todas as horas desse dia, porque duas sessões no mesmo dia são a resposta a
 * «a que horas posso ir» e não uma escolha a fazer por quem lê. Os outros dias
 * dizem-se numa linha à parte («Também a 12 de outubro, às 21h»), e não num
 * intervalo: «4–12 out» lia-se como «todos os dias de 4 a 12», e eram duas
 * sessões (C2-013, C1-029). A lista completa continua em «Quando», mais abaixo.
 *
 * **O que já passou diz-se no passado** quando é tudo passado; a faixa do
 * estado, por cima, é que diz que passou — esta linha diz quando foi.
 */
export function quandoDaFicha(evento: EventoDaFicha, hoje: string): QuandoDaFicha {
  if (evento.is_ongoing && evento.date_start) {
    const fim = evento.date_end && evento.date_end > evento.date_start ? evento.date_end : null;
    const longo = (iso: string) => dataLonga(iso, hoje);
    let texto: string;
    if (!fim) texto = `Em cartaz desde ${longo(evento.date_start)}`;
    else if (fim < hoje) texto = `Esteve em cartaz de ${longo(evento.date_start)} a ${longo(fim)}`;
    else if (evento.date_start <= hoje) texto = `Em cartaz até ${longo(fim)}`;
    else texto = `Em cartaz de ${longo(evento.date_start)} a ${longo(fim)}`;
    return { texto, dateTime: evento.date_start, horaPorConfirmar: false, outras: null };
  }

  const vivas = evento.sessions.filter((sessao) => !sessao.is_cancelled);
  const dias = [...new Set(vivas.map((sessao) => sessao.session_date))].sort();

  if (dias.length > 0) {
    // A de hoje ou a seguinte; tudo passado, a última — que é quando foi.
    const dia = dias.find((d) => d >= hoje) ?? (dias.at(-1) as string);
    const doDia = vivas.filter((sessao) => sessao.session_date === dia);
    const horas = horasDoDia(doDia);
    const primeira = doDia
      .map((sessao) => horaDeInicioConhecida(sessao.start_time, sessao.end_time))
      .filter((hora): hora is string => hora !== null)
      .sort()[0];
    const seguintes = dias.filter((d) => d > dia);

    let outras: string | null = null;
    if (seguintes.length === 1) {
      const proximo = seguintes[0] as string;
      const horasDoProximo = horasDoDia(vivas.filter((sessao) => sessao.session_date === proximo));
      outras = `Também a ${dataLonga(proximo, hoje)}${horasDoProximo ? `, às ${horasDoProximo}` : ''}`;
    } else if (seguintes.length > 1) {
      outras = `E mais ${seguintes.length} datas`;
    }

    return {
      texto: horas ? `${diaPorExtenso(dia, hoje)} · ${horas}` : diaPorExtenso(dia, hoje),
      dateTime: primeira ? `${dia}T${primeira.slice(0, 5)}` : dia,
      horaPorConfirmar: horas === null && dia >= hoje,
      outras,
    };
  }

  // Sem sessões de pé: as datas do evento, que é o que a fonte afirmou.
  if (evento.date_start) {
    const fim = evento.date_end && evento.date_end > evento.date_start ? evento.date_end : null;
    const texto = fim
      ? `De ${dataLonga(evento.date_start, hoje)} a ${dataLonga(fim, hoje)}`
      : diaPorExtenso(evento.date_start, hoje);
    return {
      texto,
      dateTime: evento.date_start,
      horaPorConfirmar: (fim ?? evento.date_start) >= hoje,
      outras: null,
    };
  }

  return { texto: 'Data por confirmar', dateTime: null, horaPorConfirmar: false, outras: null };
}

export interface PrecoDaFicha {
  texto: string;
  /** `livre` destaca-se; `nao-indicado` sai apagado — é uma falta, e diz-se como tal. */
  tom: 'livre' | 'valor' | 'nao-indicado';
}

/**
 * O preço, sempre dito — e a falta dele também (C2-014).
 *
 * Sessenta e cinco dos oitenta e cinco eventos não diziam nem «entrada livre»
 * nem preço, e a ficha calava-se: a secção «Detalhes» ficava um título vazio, e
 * «quanto custa» ficava sem resposta e sem sinal de que a resposta faltava. A
 * falta é uma informação — «a fonte não disse» — e escreve-se, apagada, com o
 * caminho para a página oficial quando ela existe. Um «Pago» sem valor é o que
 * a fonte escreveu, e diz-se que o valor ficou por dizer.
 */
export function precoDaFicha(evento: {
  is_free: boolean;
  /** O rótulo já resolvido — `price_display` ou o que `formatPrice` escreve. */
  preco: string | null;
  temPaginaOficial: boolean;
}): PrecoDaFicha {
  if (evento.is_free) return { texto: 'Entrada livre', tom: 'livre' };
  const preco = evento.preco?.trim() ?? '';
  if (preco && /^pago\.?$/i.test(preco)) {
    return { texto: 'Pago — o valor não foi indicado', tom: 'valor' };
  }
  if (preco) return { texto: preco, tom: 'valor' };
  return {
    texto: evento.temPaginaOficial
      ? 'Não indicado — confirme na página oficial'
      : 'Não indicado pela fonte',
    tom: 'nao-indicado',
  };
}

/**
 * Os nomes que, sozinhos, não dizem onde é: a vila, o concelho, a freguesia.
 *
 * «Onde: Constância» numa aula de yoga «nas instalações da Junta de Freguesia
 * de Constância» manda alguém para a vila inteira (C2-015). Quando o único sítio
 * que a fonte deu é uma terra, a ficha di-lo: o local exato não foi indicado.
 */
export function localSoATerra(
  localizacao: string | null,
  terras: readonly (string | null)[],
): boolean {
  if (!localizacao) return false;
  const normal = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  const alvo = normal(localizacao);
  return terras.some((terra) => terra !== null && normal(terra) === alvo);
}

/**
 * O título e a descrição de partilha: o quando e o onde à frente (C3-014).
 *
 * Um evento com cartaz partilhava-se com o título e as primeiras palavras da
 * sinopse — num grupo da terra, «domingo, 21h, Cine-Teatro Paraíso» é o que
 * decide o clique, e uma sinopse de filme não. O evento **sem** cartaz
 * partilhava-se melhor, porque o cartão desenhado pela casa leva a data e o
 * sítio. A imagem continua a ser o cartaz de quem organiza; o texto ao lado é
 * que passa a dizer quando e onde.
 */
export function partilhaDoEvento(entrada: {
  titulo: string;
  quando: string | null;
  onde: string | null;
  preco: string | null;
  resumo: string | null;
}): { titulo: string; descricao: string } {
  const titulo = entrada.quando ? `${entrada.titulo} — ${entrada.quando}` : entrada.titulo;
  const factos = [entrada.onde, entrada.preco].filter((parte): parte is string => Boolean(parte));
  const cabeca = factos.length > 0 ? `${factos.join(' · ')}.` : '';
  const corpo = entrada.resumo?.trim() ?? '';
  const descricao = [cabeca, corpo].filter(Boolean).join(' ');
  return { titulo, descricao: cortar(descricao, 200) };
}

function cortar(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo - 1);
  const espaco = corte.lastIndexOf(' ');
  return `${(espaco > maximo * 0.6 ? corte.slice(0, espaco) : corte).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/** «4 out, 21h30» — a forma curta que cabe num título de partilha. */
export function quandoCurto(evento: EventoDaFicha, hoje: string): string | null {
  if (evento.is_ongoing && evento.date_start) {
    const fim = evento.date_end && evento.date_end > evento.date_start ? evento.date_end : null;
    if (fim && evento.date_start <= hoje && fim >= hoje) return `até ${formatShortDate(fim)}`;
    return fim
      ? `${formatShortDate(evento.date_start)} – ${formatShortDate(fim)}`
      : formatShortDate(evento.date_start);
  }
  const vivas = evento.sessions.filter((sessao) => !sessao.is_cancelled);
  const dias = [...new Set(vivas.map((sessao) => sessao.session_date))].sort();
  const dia = dias.find((d) => d >= hoje) ?? dias.at(-1) ?? evento.date_start;
  if (!dia) return null;
  const horas = horasDoDia(vivas.filter((sessao) => sessao.session_date === dia));
  const semana = formatWeekdayDate(dia).split(',')[0] ?? '';
  return `${semana}, ${formatShortDate(dia)}${horas ? `, ${horas}` : ''}`;
}

/**
 * O pedido de correção já com o evento lá dentro (C2-031).
 *
 * «Corrigir» levava a `/submeter`, que só fala de enviar eventos novos: quem
 * reparou que a hora estava errada tinha de escrever um email de raiz e dizer
 * de que evento falava. As correções de quem sabe são a melhor fonte de
 * qualidade que esta casa tem, e cada passo a mais é uma que não chega.
 */
export function pedidoDeCorrecao(entrada: {
  email: string;
  titulo: string;
  quando: string | null;
  endereco: string;
}): string {
  const assunto = `Correção: ${entrada.titulo}${entrada.quando ? ` (${entrada.quando})` : ''}`;
  const corpo = [
    `A ficha: ${entrada.endereco}`,
    '',
    'O que está errado:',
    '',
    'O que devia dizer (e onde o leu, se souber):',
    '',
  ].join('\n');
  return `mailto:${entrada.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
