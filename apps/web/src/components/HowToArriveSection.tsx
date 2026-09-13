import { verNoGoogleMaps } from '@/src/lib/direcoes';
interface Props {
  /** Texto livre do evento ou, na falta dele, do espaço. */
  text: string | null;
  placeName: string | null;
  /**
   * O nome com que se procura o sítio num mapa de fora.
   *
   * Existe separado do `placeName` por causa da ficha de espaço: lá o nome do
   * espaço é o título da página e não se repete na morada, mas é ele que faz
   * o Google abrir a ficha do sítio em vez de largar um alfinete. Sem este
   * campo, a página onde a ligação mais vale era a única a não a ter.
   */
  searchName?: string | null;
  address: string | null;
  parish: string | null;
  municipalityName: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * «Como chegar»: a morada e o caminho até lá, sem promessas.
 *
 * O que houver, mostra-se — texto da fonte, morada, ligação para o mapa. O
 * que não houver, não se anuncia: uma secção pública não é o sítio de contar
 * o que ainda está por integrar. Quando não há mesmo nada, diz-se de quem é
 * a resposta — de quem organiza — e pronto.
 */
export function HowToArriveSection({
  text,
  placeName,
  searchName,
  address,
  parish,
  municipalityName,
  latitude,
  longitude,
}: Props) {
  const paragraphs = text
    ? text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : [];

  const where = [placeName, address, parish, municipalityName]
    .filter((part): part is string => Boolean(part))
    .filter((part, index, all) => all.indexOf(part) === index);

  const hasCoordinates = latitude !== null && longitude !== null;

  // As duas ligações de propósito: o Google Maps é o que quase toda a gente
  // tem no bolso, o OpenStreetMap é o que não pede conta nem rasto.
  //
  // O Google leva o **nome** do sítio e não a coordenada, para abrir a ficha
  // dele em vez de largar um alfinete anónimo — ver `verNoGoogleMaps`. O
  // OpenStreetMap fica na coordenada porque é o que ele sabe fazer: não tem
  // páginas de lugar, tem pontos, e um ponto exacto vale mais do que uma
  // procura por texto que ele resolve pior.
  const googleMapsHref = verNoGoogleMaps({
    nome: searchName ?? placeName,
    morada: address,
    concelho: municipalityName,
    latitude,
    longitude,
  });
  const openStreetMapHref = hasCoordinates
    ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`
    : null;

  if (paragraphs.length === 0 && where.length === 0 && !hasCoordinates) {
    return (
      <p className="mt-3 text-muted">
        A fonte não indica a morada. Quem organiza sabe dizer o ponto de encontro — vale a pena
        perguntar antes de ir.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3 text-muted">
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-ink">
          {paragraph}
        </p>
      ))}

      {where.length > 0 ? (
        <address className="not-italic">
          {where.map((part) => (
            <span key={part} className="block">
              {part}
            </span>
          ))}
        </address>
      ) : null}

      {googleMapsHref ? (
        <p className="flex flex-wrap gap-x-2 gap-y-1">
          {/*
            Os dois contam como o mesmo sinal (0141), e é de propósito: a
            pergunta que o número responde é «quantas pessoas quiseram saber
            como lá chegar», e não «qual dos dois mapas preferem». Separá-los
            dava duas contagens pequenas e nenhuma resposta.

            Esta secção também aparece na ficha de um **espaço**, e lá a marca
            não conta nada — o ouvinte que a lê está no `AnalyticsEventTracker`,
            que só a ficha de evento monta. Não é esquecimento: o contador é por
            evento, e uma ficha de espaço não tem evento a que somar. A marca
            fica inerte em vez de somar ao sítio errado.
          */}
          <a
            href={googleMapsHref}
            rel="noopener nofollow"
            data-stat-kind="directions_click"
            className="-ml-2 inline-flex min-h-11 items-center rounded px-2 text-ink underline underline-offset-4"
          >
            Abrir no Google Maps
          </a>
          {openStreetMapHref ? (
            <a
              href={openStreetMapHref}
              rel="noopener nofollow"
              data-stat-kind="directions_click"
              className="inline-flex min-h-11 items-center rounded px-2 text-ink underline underline-offset-4"
            >
              Ver no OpenStreetMap
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
