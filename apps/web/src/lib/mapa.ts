/**
 * Onde é que cada evento da agenda cai no mapa.
 *
 * O problema é este: uma boa parte dos eventos sabe onde é ao metro — acontece
 * num espaço do catálogo, e o espaço tem coordenadas — e a outra parte não tem
 * espaço nenhum, porque a fonte disse «Minde» ou «Constância» e mais nada.
 * A proporção move-se todas as noites, à medida que a recolha entra e que os
 * espaços do catálogo ganham nome, e por isso não fica escrita aqui: **quem a
 * diz é a própria página do mapa**, que a conta do que tem à frente e a publica
 * numa linha por baixo do mapa. Um número escrito num comentário para explicar
 * um desenho é um número que envelhece em silêncio — este já esteve aqui a
 * dizer «noventa e sete eventos» muito depois de serem cento e dezanove.
 *
 * Havia duas saídas fáceis e ambas mentem. Desenhar só os que têm morada faz um
 * mapa que esconde metade da agenda. Espalhá-los todos como se soubéssemos onde
 * são põe pontos em sítios que ninguém afirmou, e um ponto no mapa é uma
 * promessa de morada.
 *
 * A saída honesta é dizer as duas coisas ao mesmo tempo: quem tem espaço vai
 * para o espaço, quem não tem vai para o centro do concelho — e o mapa mostra a
 * diferença, em vez de a apagar. Um ponto exacto é um sítio; um ponto de
 * concelho é «algures neste concelho», e assim está escrito.
 */

/** O que o mapa precisa de saber de um evento. */
export interface EventoNoMapa {
  id: string;
  slug: string;
  title: string;
  municipality_id: string;
  venue_id: string | null;
  location_name: string | null;
  date_start: string | null;
  date_end: string | null;
  latitude: number | null;
  longitude: number | null;
  /** A capa, e o que a capa tipográfica desenha quando não há cartaz. */
  image_url: string | null;
  image_alt: string | null;
  category_slug: string | null;
  /** A página de quem organiza. É a ligação para quem quer confirmar. */
  source_url: string | null;
}

/** O que o mapa precisa de saber de um espaço. */
export interface EspacoNoMapa {
  id: string;
  name: string;
  municipality_id: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * O anel exterior de um concelho: pares [longitude, latitude], fechado.
 *
 * É a forma da coluna `municipalities.boundary` (migração 0105) — a mesma que
 * o módulo gerado `fronteiras.ts` tinha quando a geografia vivia no código de
 * um só inquilino.
 */
export type AnelDeFronteira = readonly (readonly [number, number])[];

/** O que o mapa precisa de saber de um concelho. */
export interface ConcelhoNoMapa {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  /** Sem contorno o mapa degrada para o centro — nunca deixa de se desenhar. */
  boundary?: AnelDeFronteira | null;
}

/**
 * Quanto se sabe sobre onde o evento é.
 *
 * `exacta` — o ponto é o sítio. `concelho` — o ponto é o centro do concelho, e
 * o evento é algures ali. Nunca se mistura: são desenhados de maneira
 * diferente e ditos de maneira diferente.
 */
export type Precisao = 'exacta' | 'concelho';

/** O mesmo, mais o caso de uma marca que junta lugares dos dois tipos. */
export type PrecisaoDaMarca = Precisao | 'mista';

export interface Lugar {
  /** Estável entre recolhas: é o que o botão do mapa usa como identidade. */
  id: string;
  nome: string;
  concelhoId: string;
  concelhoNome: string;
  latitude: number;
  longitude: number;
  precisao: Precisao;
  eventos: EventoNoMapa[];
}

/**
 * Junta os eventos por lugar.
 *
 * Dois eventos no mesmo teatro são um ponto com dois eventos, e não dois
 * pontos sobrepostos — o mapa fica legível e o clique deixa de ser uma lotaria
 * sobre qual dos dois está por cima.
 *
 * A ordem de preferência das coordenadas é: as do próprio evento, depois as do
 * espaço, e por fim o centro do concelho. As do evento são raras e são as
 * melhores quando existem — a API de Ourém dá o ponto do evento, que é mais
 * fino do que o do equipamento onde ele acontece.
 */
export function agruparEmLugares(
  eventos: readonly EventoNoMapa[],
  espacos: readonly EspacoNoMapa[],
  concelhos: readonly ConcelhoNoMapa[],
): Lugar[] {
  const espacoPorId = new Map(espacos.map((espaco) => [espaco.id, espaco]));
  const concelhoPorId = new Map(concelhos.map((concelho) => [concelho.id, concelho]));
  const lugares = new Map<string, Lugar>();

  for (const evento of eventos) {
    const concelho = concelhoPorId.get(evento.municipality_id);
    const espaco = evento.venue_id ? espacoPorId.get(evento.venue_id) : undefined;

    const exacto = pontoExacto(evento, espaco);
    const chave = exacto
      ? // Um evento com coordenadas próprias mas sem espaço é o seu próprio
        // lugar: juntá-lo ao concelho perdia a precisão que a fonte deu.
        (espaco?.id ?? `ponto:${exacto.latitude},${exacto.longitude}`)
      : `concelho:${evento.municipality_id}`;

    const existente = lugares.get(chave);
    if (existente) {
      existente.eventos.push(evento);
      continue;
    }

    const ponto = exacto ?? centroDoConcelho(concelho);
    // Sem coordenadas de lado nenhum não há ponto que se desenhe. O evento
    // continua na tabela por concelho, que é onde está tudo.
    if (!ponto) continue;

    lugares.set(chave, {
      id: chave,
      nome: espaco?.name ?? evento.location_name ?? concelho?.name ?? evento.municipality_id,
      concelhoId: evento.municipality_id,
      concelhoNome: concelho?.name ?? evento.municipality_id,
      latitude: ponto.latitude,
      longitude: ponto.longitude,
      precisao: exacto ? 'exacta' : 'concelho',
      eventos: [evento],
    });
  }

  // Os lugares com mais programação desenham-se por baixo: um ponto pequeno
  // sobreposto a um grande continua a poder clicar-se.
  return [...lugares.values()].sort((a, b) => b.eventos.length - a.eventos.length);
}

interface Ponto {
  latitude: number;
  longitude: number;
}

function pontoExacto(evento: EventoNoMapa, espaco: EspacoNoMapa | undefined): Ponto | null {
  if (evento.latitude !== null && evento.longitude !== null) {
    return { latitude: evento.latitude, longitude: evento.longitude };
  }
  if (espaco && espaco.latitude !== null && espaco.longitude !== null) {
    return { latitude: espaco.latitude, longitude: espaco.longitude };
  }
  return null;
}

function centroDoConcelho(concelho: ConcelhoNoMapa | undefined): Ponto | null {
  if (!concelho || concelho.latitude === null || concelho.longitude === null) return null;
  return { latitude: concelho.latitude, longitude: concelho.longitude };
}

/**
 * Os limites da região, para o mapa abrir enquadrado nela.
 *
 * Vem dos **contornos** e não dos centros dos concelhos: com os centros,
 * metade de Abrantes e metade de Ourém ficavam de fora do enquadramento,
 * porque o centro de um concelho está longe da sua fronteira.
 *
 * Devolve `[[oeste, sul], [este, norte]]`, que é a ordem que o MapLibre pede.
 */
export function limitesDaRegiao(
  concelhos: readonly ConcelhoNoMapa[],
): [[number, number], [number, number]] | null {
  const pontos: Ponto[] = concelhos.flatMap((concelho) =>
    (concelho.boundary ?? []).map(([longitude, latitude]) => ({ latitude, longitude })),
  );

  if (pontos.length === 0) {
    for (const concelho of concelhos) {
      if (concelho.latitude === null || concelho.longitude === null) continue;
      pontos.push({ latitude: concelho.latitude, longitude: concelho.longitude });
    }
  }
  if (pontos.length === 0) return null;

  const latitudes = pontos.map((ponto) => ponto.latitude);
  const longitudes = pontos.map((ponto) => ponto.longitude);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}

/** O contorno de um concelho como `Feature` de GeoJSON. */
export interface ContornoGeoJson {
  type: 'Feature';
  properties: { id: string; nome: string; eventos: number };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

export interface ContornosGeoJson {
  type: 'FeatureCollection';
  features: ContornoGeoJson[];
}

/**
 * Os concelhos da região como GeoJSON, para assentarem por cima do mapa de
 * ruas.
 *
 * O mapa de base mostra Portugal; esta camada mostra **a região**. Sem ela,
 * quem chega à página vê ruas e não sabe onde a região acaba — e a região é
 * a única coisa que esta agenda cobre. Os contornos vêm da base
 * (`municipalities.boundary`), dentro dos próprios concelhos.
 *
 * Um concelho sem nada marcado entra na mesma, mais claro. Apagá-lo dizia que
 * não existe, quando o que não existe é programação publicada onde a possamos
 * ler.
 */
export function contornosDosConcelhos(
  concelhos: readonly ConcelhoNoMapa[],
  eventosPorConcelho: Readonly<Record<string, number>> = {},
): ContornosGeoJson {
  const features: ContornoGeoJson[] = [];

  for (const concelho of concelhos) {
    const anel = concelho.boundary;
    if (!anel || anel.length < 3) continue;

    // O GeoJSON pede o anel fechado: o último par igual ao primeiro. A
    // migração 0105 garante-o na base, mas um contorno que venha aberto
    // desenha uma fatia em falta que ninguém vê até estar publicada.
    const pontos = anel.map(([longitude, latitude]) => [longitude, latitude]);
    const primeiro = pontos[0]!;
    const ultimo = pontos[pontos.length - 1]!;
    if (primeiro[0] !== ultimo[0] || primeiro[1] !== ultimo[1]) pontos.push([...primeiro]);

    features.push({
      type: 'Feature',
      properties: {
        id: concelho.id,
        nome: concelho.name,
        eventos: eventosPorConcelho[concelho.id] ?? 0,
      },
      geometry: { type: 'Polygon', coordinates: [pontos] },
    });
  }

  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Marcas: os lugares que o ecrã não consegue separar
// ---------------------------------------------------------------------------

/**
 * O alvo de toque de uma marca, em pixéis. É o mínimo que esta casa aceita
 * para o polegar, e por isso é também a distância abaixo da qual duas marcas
 * deixam de poder ser carregadas uma a uma.
 */
export const ALVO_EM_PIXEIS = 44;

/** Uma marca no mapa: um ou mais lugares que, neste nível de zoom, coincidem. */
export interface Marca {
  id: string;
  /** Onde a marca se desenha: o ponto do lugar com mais programação. */
  latitude: number;
  longitude: number;
  lugares: Lugar[];
  /** Quantos eventos ao todo. É isto que a marca escreve. */
  eventos: number;
  /**
   * `exacta` quando todos os lugares têm morada, `concelho` quando nenhum tem,
   * `mista` quando a marca junta os dois casos.
   *
   * Os três estados existem porque dois mentiam. Chamar `concelho` a uma marca
   * que junta o cine-teatro com o centro do concelho apagava a morada que se
   * sabe; chamar-lhe `exacta` prometia uma morada a metade dos eventos que não
   * a tem. A marca mista diz as duas coisas, e o painel diz qual é qual.
   */
  precisao: PrecisaoDaMarca;
}

/**
 * O que a marca diz a quem a ouve em vez de a ver.
 *
 * Uma marca pode ser um sítio ou meia dúzia deles apertados no mesmo pixel, e a
 * diferença tem de estar dita: «Cine-Teatro Paraíso — 3 eventos» e «4 sítios em
 * Tomar — 9 eventos» são duas coisas, e o número sozinho não é nenhuma.
 *
 * **E a junção não respeita fronteiras.** `agruparNoEcra` junta por distância
 * em pixéis, e nada a impede de apanhar o centro do Entroncamento e o de Torres
 * Novas na mesma marca — são concelhos vizinhos e, afastado o mapa, caem a
 * menos de quarenta e quatro pixéis um do outro. Dizer «4 sítios em Tomar»
 * porque Tomar é o concelho do primeiro lugar da lista é afirmar de três
 * sítios uma coisa que não se verificou. Contam-se os concelhos: um, diz-se
 * qual; dois, dizem-se os dois; mais, diz-se quantos são.
 */
export function nomeDaMarca(marca: Marca): string {
  const eventos = marca.eventos === 1 ? '1 evento' : `${marca.eventos} eventos`;
  const primeiro = marca.lugares[0]!;

  if (marca.lugares.length > 1) {
    const concelhos = [...new Set(marca.lugares.map((lugar) => lugar.concelhoNome))];
    const onde =
      concelhos.length === 1
        ? `em ${concelhos[0]}`
        : concelhos.length === 2
          ? `em ${concelhos[0]} e ${concelhos[1]}`
          : `em ${concelhos.length} concelhos`;
    return `${marca.lugares.length} sítios ${onde} — ${eventos}`;
  }
  const onde =
    primeiro.precisao === 'exacta' ? primeiro.nome : `Algures em ${primeiro.concelhoNome}`;
  return `${onde} — ${eventos}`;
}

/**
 * Junta os lugares que, no ecrã, ficariam por cima uns dos outros.
 *
 * **Não é enfeite: sem isto há marcas que ninguém consegue carregar.** Dois
 * espaços a duzentos metros um do outro, num mapa de cinquenta quilómetros,
 * caem no mesmo pixel — e a de baixo fica inalcançável, ao rato e ao dedo.
 * Foi assim que a primeira versão deste mapa ficou, e foi a auditoria de
 * acessibilidade que o disse: «intercepts pointer events».
 *
 * A conta é em pixéis do ecrã e refaz-se a cada zoom, que é a diferença entre
 * isto e uma junção fixa: aproximando, os lugares separam-se e as marcas
 * abrem-se sozinhas. É para isso que um mapa tem zoom.
 *
 * Guloso e por ordem de quantidade: a marca com mais programação é a âncora e
 * fica onde está, e as vizinhas encostam-se-lhe. Uma âncora que fosse o centro
 * de massa punha a marca num sítio onde não há nada.
 */
export function agruparNoEcra(
  lugares: readonly Lugar[],
  paraOEcra: (lugar: Lugar) => { x: number; y: number },
  raio: number = ALVO_EM_PIXEIS,
): Marca[] {
  const marcas: Marca[] = [];
  const ancoras: { x: number; y: number }[] = [];

  // Do mais cheio para o mais vazio: `agruparEmLugares` já devolve assim, mas
  // esta função não pode depender disso para estar certa.
  const porQuantidade = [...lugares].sort((a, b) => b.eventos.length - a.eventos.length);

  for (const lugar of porQuantidade) {
    const ponto = paraOEcra(lugar);

    let juntou = false;
    for (let i = 0; i < marcas.length; i += 1) {
      const ancora = ancoras[i]!;
      if (Math.hypot(ancora.x - ponto.x, ancora.y - ponto.y) > raio) continue;

      const marca = marcas[i]!;
      marca.lugares.push(lugar);
      marca.eventos += lugar.eventos.length;
      if (marca.precisao !== lugar.precisao) marca.precisao = 'mista';
      juntou = true;
      break;
    }
    if (juntou) continue;

    marcas.push({
      id: lugar.id,
      latitude: lugar.latitude,
      longitude: lugar.longitude,
      lugares: [lugar],
      eventos: lugar.eventos.length,
      precisao: lugar.precisao,
    });
    ancoras.push(ponto);
  }

  return marcas;
}
