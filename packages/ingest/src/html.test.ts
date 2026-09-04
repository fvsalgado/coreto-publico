import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  attributeFrom,
  metaContent,
  microdataValue,
  readJsonLdEvents,
  selectAll,
  splitIsoDateTime,
  stripTags,
  textFrom,
} from './html.js';

/**
 * Uma página de agenda municipal como as que se encontram por aí: JSON-LD no
 * `<head>`, Open Graph, e uma listagem com as classes do tema. Está aqui
 * embutida de propósito — um teste de recolha que precise de rede não é um
 * teste, é um alarme que toca quando o site da câmara está em baixo.
 */
const AGENDA_HTML = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="Agenda Cultural &amp; Desportiva">
  <meta name="description" content="O que há para fazer no concelho">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "name": "Câmara Municipal" },
      {
        "@type": "MusicEvent",
        "@id": "https://cm-exemplo.pt/agenda/concerto-de-natal",
        "name": "Concerto de Natal",
        "description": "Pela Banda Filarmónica &amp; coro juvenil.",
        "url": "https://cm-exemplo.pt/agenda/concerto-de-natal",
        "startDate": "2026-12-20T21:30:00+00:00",
        "endDate": "2026-12-20T23:00:00+00:00",
        "image": ["https://cm-exemplo.pt/img/concerto.jpg"],
        "location": {
          "@type": "Place",
          "name": "Cine-Teatro Paraíso",
          "address": { "streetAddress": "Rua Serpa Pinto 1", "postalCode": "2300-000", "addressLocality": "Tomar" },
          "geo": { "@type": "GeoCoordinates", "latitude": "39.6039", "longitude": "-8.4147" }
        },
        "offers": { "@type": "Offer", "price": "10", "priceCurrency": "EUR", "url": "https://bilheteira.pt/concerto" },
        "genre": "Música, Concerto",
        "typicalAgeRange": "6-"
      },
      {
        "@type": "TheaterEvent",
        "name": "Peça Adiada",
        "startDate": "2026-11-05",
        "eventStatus": "https://schema.org/EventPostponed"
      }
    ]
  }
  </script>
</head>
<body>
  <script>var lista = "<article class=\\"evento\\">isto n&atilde;o &eacute; um evento</article>";</script>
  <section class="lista-eventos">
    <article class="evento destaque">
      <a class="evento-link" href="/agenda/concerto-de-natal">
        <img src="/img/concerto.jpg" alt="Banda no palco">
        <h3 class="titulo">Concerto de Natal</h3>
      </a>
      <time class="data" datetime="2026-12-20">20 de dezembro de 2026 &#8211; 21h30</time>
      <p class="resumo">Pela Banda Filarmónica &amp; coro juvenil.
      <div class="etiquetas"><span itemprop="genre">Música</span></div>
    </article>
    <article class="evento">
      <a class="evento-link" href="https://cm-exemplo.pt/agenda/feira-do-livro">
        <h3 class="titulo">Feira do Livro</h3>
      </a>
      <time class="data" datetime="2026-05-10">10 a 12 de maio</time>
    </article>
  </section>
</body>
</html>`;

describe('selectAll', () => {
  it('apanha os itens da listagem sem apanhar o que está dentro deles', () => {
    const items = selectAll(AGENDA_HTML, '.lista-eventos .evento');
    expect(items).toHaveLength(2);
    expect(items[0]?.tag).toBe('article');
    expect(items[0]?.attributes['class']).toBe('evento destaque');
  });

  it('ignora marcação que só existe dentro de um <script>', () => {
    // O `<article class="evento">` da cadeia de JavaScript não é um evento.
    expect(selectAll(AGENDA_HTML, 'article.evento')).toHaveLength(2);
  });

  it('lê atributos com um seletor de atributo', () => {
    const links = selectAll(AGENDA_HTML, 'a[class="evento-link"]');
    expect(links.map((link) => link.attributes['href'])).toEqual([
      '/agenda/concerto-de-natal',
      'https://cm-exemplo.pt/agenda/feira-do-livro',
    ]);
  });
});

describe('textFrom e attributeFrom', () => {
  const item = selectAll(AGENDA_HTML, '.evento')[0]?.inner ?? '';

  it('cai para o seletor seguinte quando o primeiro não casa', () => {
    expect(textFrom(item, ['.nao-existe', 'h3.titulo'])).toBe('Concerto de Natal');
  });

  it('descodifica entidades e fecha um <p> sem fecho', () => {
    expect(textFrom(item, ['.resumo'])).toBe('Pela Banda Filarmónica & coro juvenil.');
  });

  it('lê o endereço da imagem e o texto alternativo', () => {
    expect(attributeFrom(item, ['img'], 'src')).toBe('/img/concerto.jpg');
    expect(attributeFrom(item, ['img'], 'alt')).toBe('Banda no palco');
  });
});

describe('stripTags', () => {
  it('deixa o conteúdo de <script> de fora', () => {
    const text = stripTags(AGENDA_HTML);
    expect(text).toContain('Concerto de Natal');
    expect(text).not.toContain('var lista');
  });

  it('descodifica entidades numéricas e nomeadas', () => {
    expect(stripTags('<p>Sess&atilde;o &#8211; 21h30</p>')).toBe('Sessão – 21h30');
  });
});

describe('metadados', () => {
  it('lê Open Graph e a descrição', () => {
    expect(metaContent(AGENDA_HTML, 'og:title')).toBe('Agenda Cultural & Desportiva');
    expect(metaContent(AGENDA_HTML, 'description')).toBe('O que há para fazer no concelho');
  });

  it('lê microdados por itemprop', () => {
    expect(microdataValue(AGENDA_HTML, 'genre')).toBe('Música');
  });
});

describe('readJsonLdEvents', () => {
  const events = readJsonLdEvents(AGENDA_HTML);

  it('desdobra o @graph e fica só com os Event', () => {
    expect(events.map((event) => event.name)).toEqual(['Concerto de Natal', 'Peça Adiada']);
  });

  it('parte a data ISO em dia e hora', () => {
    expect(events[0]?.startDate).toBe('2026-12-20');
    expect(events[0]?.startTime).toBe('21:30');
    expect(events[0]?.endTime).toBe('23:00');
  });

  it('lê local, coordenadas, preço e etiquetas', () => {
    const event = events[0];
    expect(event?.locationName).toBe('Cine-Teatro Paraíso');
    expect(event?.address).toBe('Rua Serpa Pinto 1, 2300-000, Tomar');
    expect(event?.latitude).toBeCloseTo(39.6039);
    expect(event?.priceRaw).toBe('10 €');
    expect(event?.ticketingUrl).toBe('https://bilheteira.pt/concerto');
    expect(event?.categories).toEqual(['Música', 'Concerto']);
  });

  it('marca o que a própria fonte diz estar adiado ou cancelado', () => {
    expect(events[1]?.isCancelled).toBe(true);
    expect(events[0]?.isCancelled).toBe(false);
  });
});

describe('splitIsoDateTime', () => {
  it('aceita data com e sem hora e recusa o resto', () => {
    expect(splitIsoDateTime('2026-05-10')).toEqual({ date: '2026-05-10', time: null });
    expect(splitIsoDateTime('2026-05-10T21:30')).toEqual({ date: '2026-05-10', time: '21:30' });
    expect(splitIsoDateTime('10 de maio')).toEqual({ date: null, time: null });
  });
});

describe('absoluteUrl', () => {
  it('resolve endereços relativos e recusa esquemas que não são http', () => {
    expect(absoluteUrl('https://cm-exemplo.pt/agenda', '/evento/1')).toBe(
      'https://cm-exemplo.pt/evento/1',
    );
    expect(absoluteUrl('https://cm-exemplo.pt/agenda', 'javascript:alert(1)')).toBeNull();
    expect(absoluteUrl('https://cm-exemplo.pt/agenda', null)).toBeNull();
  });
});
