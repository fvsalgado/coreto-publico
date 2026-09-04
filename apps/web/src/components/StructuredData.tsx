import {
  construirConcelho,
  construirEspaco,
  construirEvento,
  construirFaq,
  construirListagem,
  construirSitio,
  type JsonLdValue,
} from '@/src/lib/dados-estruturados';
import type { Migalha } from '@/src/lib/migalhas';
import type { EventDetail, Venue } from '@/src/lib/queries/types';
import type { Regiao } from '@/src/lib/regiao';

/**
 * Os blocos `application/ld+json` que as páginas põem no HTML.
 *
 * Aqui só se serializa. O que se diz — e sobretudo o que se cala — está em
 * `src/lib/dados-estruturados.ts`, que é código puro e tem testes: este
 * ficheiro é `.tsx`, e a configuração do vitest só apanha `.test.ts`, por isso
 * um construtor escrito aqui era um construtor sem rede.
 */

function JsonLdScript({ data }: { data: JsonLdValue }) {
  return (
    <script
      type="application/ld+json"
      // O título de um evento vem de um site alheio. Se lá vier um
      // `</script>`, sem escapar o `<` esse título fechava o bloco aqui e o
      // resto passava a ser interpretado como HTML da página.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

interface Concelho {
  id: string;
  name: string;
  district?: string | null;
}

/** O sítio e quem o promove. Vai no layout da região, uma vez por página. */
export function SiteStructuredData({ regiao, origem }: { regiao: Regiao; origem: string }) {
  return <JsonLdScript data={construirSitio(regiao, origem)} />;
}

interface EventProps {
  event: EventDetail;
  url: string;
  origem: string;
  municipality: Concelho | null;
  venue: Venue | null;
  cycle: { id: string; name: string } | null;
  regiao: Regiao;
}

export function EventStructuredData({
  event,
  url,
  origem,
  municipality,
  venue,
  cycle,
  regiao,
}: EventProps) {
  const dados = construirEvento({
    evento: event,
    url,
    origem,
    concelho: municipality,
    espaco: venue,
    ciclo: cycle,
    regiao,
  });
  if (!dados) return null;
  return <JsonLdScript data={dados} />;
}

interface ListagemProps {
  nome: string;
  descricao?: string | null;
  /** O canónico da listagem, não o endereço filtrado — ver `construirListagem`. */
  url: string;
  origem: string;
  itens: ReadonlyArray<{ nome: string; url: string }>;
  total?: number;
  trilha: readonly Migalha[];
}

/** Uma página de listagem: a agenda, os espaços. */
export function ListagemStructuredData(props: ListagemProps) {
  return <JsonLdScript data={construirListagem(props)} />;
}

interface FaqProps {
  perguntas: ReadonlyArray<{ pergunta: string; resposta: string; ancora: string }>;
  nome: string;
  descricao?: string | null;
  url: string;
  origem: string;
  atualizada?: string | null;
  trilha: readonly Migalha[];
}

/**
 * Uma página de perguntas e respostas.
 *
 * Devolve `null` sem perguntas — e é o construtor que o decide, não este
 * componente: a regra de o que se cala vive com o resto delas, em código puro
 * e com testes.
 */
export function FaqStructuredData(props: FaqProps) {
  const dados = construirFaq(props);
  if (!dados) return null;
  return <JsonLdScript data={dados} />;
}

interface MunicipalityProps {
  municipality: Concelho;
  url: string;
  origem: string;
  events: ReadonlyArray<{ slug: string; title: string }>;
}

export function MunicipalityStructuredData({
  municipality,
  url,
  origem,
  events,
}: MunicipalityProps) {
  return (
    <JsonLdScript
      data={construirConcelho({ concelho: municipality, url, origem, eventos: events })}
    />
  );
}

interface PlaceProps {
  venue: Venue & { postal_code?: string | null; phone?: string | null; email?: string | null };
  url: string;
  origem: string;
  municipality: Concelho | null;
}

export function PlaceStructuredData({ venue, url, origem, municipality }: PlaceProps) {
  return (
    <JsonLdScript data={construirEspaco({ espaco: venue, url, origem, concelho: municipality })} />
  );
}
