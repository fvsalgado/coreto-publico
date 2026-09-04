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
