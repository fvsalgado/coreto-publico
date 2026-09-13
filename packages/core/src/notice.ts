/**
 * O que parece informação municipal, e não um evento.
 *
 * As agendas das câmaras misturam programação com avisos: o horário da
 * piscina, a época balnear, a reunião de câmara, as inscrições num serviço.
 * Publicar isso numa agenda cultural é ruído — mas apagá-lo às cegas seria
 * pior, porque «Inscrições abertas para a oficina de teatro» pode ser a única
 * forma que uma fonte tem de anunciar a oficina.
 *
 * Por isso a resposta não é recusar: é **nunca publicar sem uma pessoa ver**.
 * O detetor manda o candidato para a fila de moderação com o motivo à vista,
 * e quem modera decide. Um aviso que já esteja no catálogo não é tocado —
 * despublicar é decisão humana, não da recolha.
 */

import { slugify } from './text';

/** Começos de título que denunciam um aviso. Comparados por palavra inteira. */
const NOTICE_PREFIXES: readonly string[] = [
  'piscina-municipal',
  'piscinas-municipais',
  'epoca-balnear',
  'horario',
  'horarios',
  'inscricoes',
  'edital',
  'aviso',
  'anuncio',
  'reuniao-camara',
  'reuniao-de-camara',
  'reuniao-publica',
  'assembleia-municipal',
  'municipio-promove',
  'municipio-informa',
  'concurso-publico',
  'hasta-publica',
  'oferta-de-emprego',
  'ofertas-de-emprego',
  'recrutamento',
  // Saúde pública e campanhas de serviço: entram nas agendas municipais como
  // se fossem programação, e não são. «Vacinação Antirrábica» esteve
  // publicado na agenda de Tomar como um evento cultural.
  'vacinacao',
];

/** Expressões que denunciam um aviso em qualquer ponto do título. */
const NOTICE_ANYWHERE: readonly string[] = [
  'epoca-balnear',
  'horario-de-funcionamento',
  'horarios-de-funcionamento',
  'inscricoes-abertas',
  'candidaturas-abertas',
  'reuniao-de-camara',
  'assembleia-municipal',
  'concurso-publico',
  'hasta-publica',
  // Uma campanha de sensibilização é um aviso de serviço público — não tem
  // sala, nem bilhete, nem hora a que se chega tarde. A de Assentiz, sobre
  // bem-estar animal, esteve publicada como programação.
  'campanha-de-sensibilizacao',
];

function hasPrefix(slug: string, prefix: string): boolean {
  return slug === prefix || slug.startsWith(`${prefix}-`);
}

function hasPhrase(slug: string, phrase: string): boolean {
  return `-${slug}-`.includes(`-${phrase}-`);
}

/**
 * O título parece um aviso municipal?
 *
 * A comparação é feita sobre o slug (minúsculas, sem acentos, palavras
 * separadas por hífen) para que «Época Balnear», «época balnear» e «EPOCA
 * BALNEAR» caiam na mesma rede — e para que «horário» não apanhe
 * «coreografia», porque a fronteira é a palavra, não a substring.
 */
export function looksLikeMunicipalNotice(title: string | null | undefined): boolean {
  const slug = slugify(title);
  if (slug.length === 0) return false;
  return (
    NOTICE_PREFIXES.some((prefix) => hasPrefix(slug, prefix)) ||
    NOTICE_ANYWHERE.some((phrase) => hasPhrase(slug, phrase))
  );
}

/**
 * O título casa com uma exclusão configurada na fonte?
 *
 * As exclusões vivem em `sources.config.excludeTitles` e são expressões
 * simples («piscina municipal», «fábrica das artes»), comparadas com a mesma
 * normalização do detetor. Servem para o que uma pessoa já decidiu que não é
 * um evento **naquela fonte** — a recolha salta-o sem gastar a fila de
 * moderação com a mesma decisão todas as noites.
 */
export function matchesExcludedTitle(
  title: string | null | undefined,
  excludeTitles: readonly string[] | undefined,
): boolean {
  if (!excludeTitles || excludeTitles.length === 0) return false;
  const slug = slugify(title);
  if (slug.length === 0) return false;
  return excludeTitles.some((pattern) => {
    const patternSlug = slugify(pattern);
    return patternSlug.length > 0 && hasPhrase(slug, patternSlug);
  });
}
