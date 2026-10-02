/**
 * Levar quem lê até à porta.
 *
 * O Coreto sabe onde o evento é; a partir daí, quem escolhe como lá chegar é
 * quem vai. Daí serem três e não uma: pôr só o Google Maps é decidir por
 * alguém qual é a aplicação de mapas da vida dele, e num sítio público isso
 * não se faz. Nenhuma destas ligações carrega nada: são endereços que a
 * aplicação do telefone abre.
 *
 * Só se oferecem direções para um ponto que se saiba mesmo. Mandar alguém para
 * o centro geométrico de um concelho, com ar de morada, é pior do que não
 * mandar para lado nenhum — chega lá e não está lá nada.
 *
 * **Direções e «ver o sítio» não são a mesma pergunta**, e por isso não levam
 * o mesmo endereço. Quem carrega em «Google Maps» aqui em cima quer ser
 * levado à porta, e para isso a coordenada é insubstituível: leva ao metro e
 * não depende de o sítio existir no catálogo de ninguém. Quem carrega em
 * «Abrir no Google Maps» na secção de cima quer **olhar** para o sítio —
 * fotografias, horário, o que lá está à volta —, e para isso um alfinete
 * anónimo largado numas coordenadas não serve de nada. É o `verNoGoogleMaps`
 * que trata dessa segunda pergunta.
 */

export interface Direcao {
  nome: string;
  href: string;
}

/** Cinco casas decimais chegam para uma porta: cerca de um metro. */
function coordenada(valor: number): string {
  return valor.toFixed(5);
}

export function direcoesPara(latitude: number, longitude: number, nome?: string): Direcao[] {
  const ponto = `${coordenada(latitude)},${coordenada(longitude)}`;
  const etiqueta = nome ? encodeURIComponent(nome) : '';

  return [
    {
      nome: 'Google Maps',
      href: `https://www.google.com/maps/dir/?api=1&destination=${ponto}`,
    },
    {
      // `daddr` com as coordenadas e `q` com o nome: o Apple Maps mostra o nome
      // no destino em vez de repetir os números.
      nome: 'Apple Maps',
      href: `https://maps.apple.com/?daddr=${ponto}${etiqueta ? `&q=${etiqueta}` : ''}`,
    },
    {
      nome: 'Waze',
      href: `https://waze.com/ul?ll=${ponto}&navigate=yes`,
    },
  ];
}

/** O que se sabe de um sítio para o procurar num mapa de fora. */
export interface SitioParaMapa {
  nome: string | null;
  morada: string | null;
  concelho: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * O endereço que abre a **página** do sítio no Google Maps, e não um alfinete.
 *
 * A diferença conta-se pelo que a pessoa vê ao chegar lá. Com
 * `query=39.46157,-8.19832` o Google mostra um ponto sem nome no meio de uma
 * rua: nem fotografias, nem horário, nem sequer a certeza de se estar no
 * sítio certo. Com `query=Teatro Virgínia, Largo José Lopes dos Santos,
 * Torres Novas` mostra a ficha do teatro.
 *
 * Por isso a regra é: **havendo nome, procura-se pelo nome.** A morada e o
 * concelho vão atrás para ancorar a procura — sem eles, «Jardim da República»
 * existe em meia dúzia de cidades do país. A freguesia fica de fora de
 * propósito: «União das freguesias de Torres Novas (Santa Maria, Salvador e
 * Santiago)» não ajuda um motor de procura, atrapalha-o.
 *
 * A coordenada só entra quando não há nome nenhum — e aí é ela que salva a
 * ligação, porque procurar por «Abrantes» e mais nada mandava a pessoa para o
 * meio da cidade.
 *
 * **Perde-se pontaria e ganha-se identificação, e é a troca certa aqui**: o
 * ponto exacto continua a ser servido pelas direções, que é onde ele faz
 * falta. Para um coreto de aldeia, que o Google não tem como lugar, a procura
 * pelo nome e morada cai na rua certa — a poucos metros do alfinete, e com
 * nome.
 */
/**
 * Tira do nome o parêntesis que só serve dentro do catálogo.
 *
 * Um terço dos espaços tem nome construído para desfazer ambiguidade numa
 * lista — «Convento de Cristo (Castelo Templário e Convento de Cristo)»,
 * «Museu Nacional Ferroviário (Fundação Museu Nacional Ferroviário Armando
 * Ginestal Machado)». Na ficha isso é útil; numa caixa de procura é ruído, e
 * nestes dois casos é o nome repetido a competir consigo próprio.
 *
 * Tira-se **só** o que está entre parêntesis. O travessão fica: em «MIAA —
 * Museu Ibérico de Arqueologia e Arte» ou «CCLT — Complexo Cultural da Levada
 * de Tomar» é a sigla que vem à frente, e cortar por aí deixava a procura com
 * quatro letras. O que vem depois do travessão é o nome por extenso, e é ele
 * que faz o Google acertar.
 */
function nomeParaProcura(nome: string): string {
  return nome
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function verNoGoogleMaps(sitio: SitioParaMapa): string | null {
  const partes = [sitio.nome ? nomeParaProcura(sitio.nome) : null, sitio.morada, sitio.concelho]
    .map((parte) => parte?.trim())
    .filter((parte): parte is string => Boolean(parte))
    .filter((parte, indice, todas) => todas.indexOf(parte) === indice);

  if (partes.length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partes.join(', '))}`;
  }

  if (sitio.latitude !== null && sitio.longitude !== null) {
    const ponto = `${coordenada(sitio.latitude)},${coordenada(sitio.longitude)}`;
    return `https://www.google.com/maps/search/?api=1&query=${ponto}`;
  }

  return null;
}

/** O que a ficha sabe para abrir o planeador de transportes com o destino. */
export interface ViagemDeTransportes {
  /** O endereço do planeador que a região declarou (0164). */
  planeador: string;
  latitude: number | null;
  longitude: number | null;
  /** O nome a mostrar no destino — o do espaço, ou o do sítio que a fonte deu. */
  nome: string | null;
  /** `AAAA-MM-DD`, só quando o evento é num dia só e ainda está por vir. */
  dia?: string | null;
}

/**
 * «Ir de transportes públicos», com o destino já escrito.
 *
 * O planeador da casa (a Paragem.pt) lê a viagem do endereço — a forma está em
 * `docs/ENDERECOS.md` do repositório dela: `para=<latitude>,<longitude>` é um
 * ponto qualquer, que ele trata como trata uma rua (a pé até à paragem mais
 * perto), e `nome` é o que mostra no campo do destino. Antes disso aceitava só
 * o nome exato de uma paragem, e a ficha abria o planeador vazio e pedia a quem
 * carregava que escrevesse lá o destino — um espaço cultural, que o planeador
 * não conhecia pelo nome.
 *
 * **Só com coordenadas.** Sem elas não há destino que se escreva: um nome de
 * espaço como `para` aparecia no planeador como «ponta que não se reconhece», e
 * é pior do que um campo vazio. Nesse caso a ligação abre o planeador como
 * antes, e `comDestino` diz à ficha que tem de explicar o resto.
 *
 * **O dia vai quando ajuda.** Sem `dia` o planeador parte «agora», que é o que
 * serve a quem lê a ficha no dia do evento; para um concerto de sábado lido na
 * quarta, `dia` abre as ligações desse sábado. A hora fica de fora: o planeador
 * pergunta a hora de partida, e a ficha só sabe a de chegada.
 *
 * O nome perde o parêntesis de catálogo, como na procura do Google — o campo do
 * planeador corta aos 80 carateres, e «Convento de Cristo (Castelo Templário e
 * Convento de Cristo)» é o nome repetido a ocupar o lugar.
 */
export function irDeTransportes(viagem: ViagemDeTransportes): {
  href: string;
  comDestino: boolean;
} {
  const { planeador, latitude, longitude } = viagem;
  if (latitude === null || longitude === null) return { href: planeador, comDestino: false };
  let endereco: URL;
  try {
    endereco = new URL(planeador);
  } catch {
    return { href: planeador, comDestino: false };
  }
  endereco.searchParams.set('para', `${coordenada(latitude)},${coordenada(longitude)}`);
  const nome = viagem.nome ? nomeParaProcura(viagem.nome) : '';
  if (nome) endereco.searchParams.set('nome', nome);
  if (viagem.dia && /^\d{4}-\d{2}-\d{2}$/.test(viagem.dia)) {
    endereco.searchParams.set('dia', viagem.dia);
  }
  return { href: endereco.toString(), comDestino: true };
}
