import type { Metadata } from 'next';
import Link from 'next/link';
import { FALHAS_ATE_PAUSA, HORAS_EM_PAUSA } from '@coreto/core';
import { PageHeader } from '@/src/components/PageHeader';
import { formatLongDate } from '@/src/lib/format';
import {
  countEventsBySeries,
  listMunicipalities,
  listPublicSources,
  listSeries,
  listVenues,
} from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { exigirSeccao, seccaoLigada } from '@/src/lib/queries/seccoes';
import type { PublicSource } from '@/src/lib/queries/types';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'De onde vêm os eventos',
  description:
    'As fontes que o Coreto lê, as regras da recolha, o que ainda fica de fora — e os feeds, calendários e API para levar estes dados daqui.',
  alternates: { canonical: '/fontes' },
};

/**
 * Uma página, e não duas.
 *
 * «De onde vêm» e «feeds e dados abertos» eram dois endereços a responder à
 * mesma pergunta em dois tempos: de onde vem isto, e como é que eu o levo.
 * Quem chega à primeira acaba invariavelmente na segunda — e a segunda sem a
 * primeira é uma lista de endereços sem proveniência, que é exatamente o que
 * uma agenda que pede confiança não deve dar.
 */
const REGRAS: readonly { titulo: string; texto: string }[] = [
  {
    titulo: 'Só a fonte primária',
    texto:
      'Lê-se de quem organiza ou de quem programa: a câmara, a sala, a rede intermunicipal. Nunca de agregadores nem de bilheteiras de terceiros — uma agenda feita da agenda dos outros não acrescenta nada a ninguém.',
  },
  {
    titulo: 'Nunca contra um bloqueio',
    texto:
      'Quando um servidor responde que não a quem o vem ler, pede-se autorização; não se dá a volta. Contornar um controlo de acesso sem autorização não é recolha.',
  },
  {
    titulo: 'Devagar, e identificados',
    texto:
      'Um pedido de cada vez por servidor, com um agente que diz quem é e onde nos encontrar. Do outro lado está quase sempre a máquina que também serve os balcões online do concelho.',
  },
  {
    titulo: 'Nunca fabricar',
    texto:
      'O que a fonte não diz fica por dizer. Um evento sem data não entra, um local que não vem escrito não se adivinha, uma hora que não está publicada não se inventa.',
  },
  {
    titulo: 'O espaço tem de ficar no concelho',
    texto:
      'Há nomes que se repetem na região — há um «Cine-Teatro São Pedro» em Abrantes e outro em Alcanena. Um nome que case com um espaço de outro concelho que não o do evento não casa: fica por resolver, à espera de quem o saiba desfazer. Um ponto a setenta quilómetros do sítio certo é pior do que ponto nenhum.',
  },
  {
    titulo: 'Uma pessoa antes da publicação',
    texto:
      'O que chega por email é lido por alguém antes de aparecer. E o que a recolha traz com pouca confiança vai para a mesma fila, em vez de entrar sozinho.',
  },
];

function agrupar(sources: PublicSource[]): { ligadas: PublicSource[]; desligadas: PublicSource[] } {
  return {
    ligadas: sources.filter((source) => source.is_enabled),
    desligadas: sources.filter((source) => !source.is_enabled),
  };
}

/** «cm-tomar.pt/comunicacao/agenda» é mais legível do que o endereço inteiro. */
function encurtar(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

function SourceCard({ source, where }: { source: PublicSource; where: string | null }) {
  return (
    <li className="flex h-full flex-col rounded-lg border border-border bg-surface px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-display text-lg font-semibold">{source.name}</p>
        {where ? <p className="ct-eyebrow">{where}</p> : null}
      </div>
      {source.public_note ? <p className="mt-1.5 text-sm">{source.public_note}</p> : null}
      <p className="mt-2 text-sm">
        <a
          href={source.url}
          rel="noopener nofollow"
          className="inline-flex min-h-11 items-center font-mono text-xs break-all underline underline-offset-4 sm:min-h-0"
        >
          {encurtar(source.url)} ↗
        </a>
      </p>
      {source.is_enabled ? (
        <p className="mt-auto pt-1.5 text-xs text-muted">
          {source.last_success_at
            ? `Lida com sucesso a ${formatLongDate(source.last_success_at.slice(0, 10))}.`
            : 'Ainda não foi lida com sucesso.'}
        </p>
      ) : null}
    </li>
  );
}

export default async function SourcesPage({ params }: { params: Promise<{ regiao: string }> }) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  // Desligada no painel, esta página não existe. O guarda vem antes de
  // qualquer leitura: não vale a pena ir à base buscar o que não se mostra.
  await exigirSeccao(regiao.id, 'fontes');
  const haCiclos = await seccaoLigada(regiao.id, 'ciclos');

  const [sources, municipalities, venues, series, contagemPorCiclo] = await Promise.all([
    listPublicSources(regiao.id),
    listMunicipalities(regiao.id),
    listVenues(regiao.id),
    listSeries(regiao.id),
    countEventsBySeries(regiao.id),
  ]);
  const EMAIL = regiao.email;

  const municipalityNames: Record<string, string> = Object.fromEntries(
    municipalities.map((municipality) => [municipality.id, municipality.name]),
  );
  const { ligadas, desligadas } = agrupar(sources);

  const regionais = ligadas.filter((source) => source.municipality_id === null);
  const locais = ligadas.filter((source) => source.municipality_id !== null);

  // Concelhos sem fonte ligada: hoje nenhum, e a página tem de continuar a
  // dizê-lo se um dia deixar de ser verdade.
  const cobertos = new Set(locais.map((source) => source.municipality_id));
  const semFonte = municipalities.filter((municipality) => !cobertos.has(municipality.id));

  // Espaços com sítio próprio que ninguém lê diretamente. Não é uma falha da
  // recolha — é o mapa do que falta, e é a lista por onde se continua.
  const comFonteDireta = new Set(
    ligadas.map((source) => source.venue_id).filter((id): id is string => id !== null),
  );
  const porLer = venues.filter(
    (venue) => venue.website_url !== null && !comFonteDireta.has(venue.id),
  );

  // Destes, os que já foram sondados um a um e têm ficha aqui em cima, com o
  // que publicam e o que falta para os ler. Contar sem distinguir dizia que
  // são todos um mistério, e já não são.
  const identificados = new Set(
    desligadas.map((source) => source.venue_id).filter((id): id is string => id !== null),
  );
  const sondados = porLer.filter((venue) => identificados.has(venue.id)).length;

  // Os ciclos que já têm programação registada — e, por isso, página própria.
  // A lista é derivada e não escrita à mão: no dia em que o VOLver ou o Bons
  // Sons passarem a ser lidos, esta secção aponta-lhes sozinha.
  const ciclosComPagina = series
    .filter((ciclo) => (contagemPorCiclo[ciclo.id]?.total ?? 0) > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  return (
    <>
      <PageHeader
        title="De onde vêm os eventos"
        eyebrow="A cozinha"
        lead="Esta agenda não organiza nada: recolhe. Aqui está de onde, com que regras, o que ainda fica de fora — e como levar estes dados daqui para outro sítio."
      />

      <p className="max-w-2xl rounded border border-border bg-accent-soft p-4 text-sm">
        <strong>
          {ligadas.length} fontes ligadas, {municipalities.length} concelhos, uma recolha por noite.
        </strong>{' '}
        Cada evento <em>recolhido</em> guarda o endereço de onde veio e leva-o na ficha, no botão
        «Página oficial» — a agenda não se põe à frente de quem faz o trabalho. O que chega por
        email não tem página de origem para apontar: tem quem o enviou, e passa por uma pessoa antes
        de aparecer.
      </p>

      <section aria-labelledby="por-concelho" className="mt-10">
        <h2 id="por-concelho" className="ct-heading">
          As agendas de cada concelho
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Uma por município, mais as salas que publicam a sua própria programação com detalhe que a
          agenda da câmara não traz.
        </p>

        <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2">
          {locais
            .slice()
            .sort((a, b) =>
              (municipalityNames[a.municipality_id ?? ''] ?? '').localeCompare(
                municipalityNames[b.municipality_id ?? ''] ?? '',
                'pt',
              ),
            )
            .map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                where={municipalityNames[source.municipality_id ?? ''] ?? null}
              />
            ))}
        </ul>

        {semFonte.length > 0 ? (
          <p className="mt-4 max-w-2xl rounded border border-dashed border-border px-4 py-3 text-sm">
            Sem fonte automática de momento:{' '}
            {semFonte.map((municipality) => municipality.name).join(', ')}. O que houver nestes
            concelhos entra por email, e continua a aparecer na agenda como o resto.
          </p>
        ) : (
          <p className="mt-4 max-w-2xl text-sm text-muted">
            Os {municipalities.length} concelhos têm hoje, todos, pelo menos uma fonte ligada.
          </p>
        )}
      </section>

      {regionais.length > 0 ? (
        <section aria-labelledby="regionais" className="mt-12">
          <h2 id="regionais" className="ct-heading">
            Programação em rede
          </h2>
          <p className="mt-2 max-w-2xl text-muted">
            Programação que já nasce intermunicipal e que, repartida por {municipalities.length}{' '}
            agendas, nunca se lê como o que é.
          </p>
          <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2">
            {regionais.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                where={`Os ${municipalities.length} concelhos`}
              />
            ))}
          </ul>

          {/* Sem a secção dos ciclos não há página de ciclo nenhuma, e um
              parágrafo inteiro de ligações mortas é pior do que não o ter. */}
          {haCiclos && ciclosComPagina.length > 0 ? (
            <p className="mt-4 max-w-2xl text-sm text-muted">
              O que já saiu daqui lê-se por inteiro, edição a edição —{' '}
              {ciclosComPagina.map((ciclo, indice) => (
                <span key={ciclo.id}>
                  {indice > 0 ? (indice === ciclosComPagina.length - 1 ? ' e ' : ', ') : null}
                  <Link href={`/ciclo/${ciclo.id}`} className="underline underline-offset-4">
                    {ciclo.name}
                  </Link>
                </span>
              ))}
              . Uma edição que já aconteceu não desaparece: fica, porque é o melhor argumento para a
              próxima.{' '}
              <Link href="/ciclos" className="underline underline-offset-4">
                Os ciclos todos estão aqui
              </Link>
              , incluindo os que sabemos existir e ainda não conseguimos ler.
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="fora" className="mt-12">
        <h2 id="fora" className="ct-heading">
          O que ainda não entra
        </h2>

        {desligadas.length > 0 ? (
          <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2">
            {desligadas.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                where={
                  source.municipality_id
                    ? (municipalityNames[source.municipality_id] ?? null)
                    : 'A região'
                }
              />
            ))}
          </ul>
        ) : null}

        <p className="mt-6 max-w-2xl">
          Há ainda <strong>{porLer.length} espaços</strong> com sítio próprio que não são lidos
          diretamente — coletividades, museus, bibliotecas, juntas.{' '}
          {sondados > 0 ? (
            <>
              De <strong>{sondados}</strong> deles há ficha aqui em cima, com o endereço e a razão
              por que ainda não são lidos. Os outros foram vistos um a um no levantamento dos
              espaços, mas ainda não têm ficha aqui: o que fazem só chega à agenda se a câmara o
              publicar ou se alguém o enviar.
            </>
          ) : (
            <>O que eles fazem só chega aqui se a câmara o publicar ou se alguém o enviar.</>
          )}{' '}
          Não é uma falha da recolha: é o mapa do que falta.{' '}
          <Link href="/espacos" className="underline underline-offset-4">
            A lista dos espaços está aqui
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="regras" className="mt-12">
        <h2 id="regras" className="ct-heading">
          Com que regras
        </h2>
        <dl className="mt-4 max-w-2xl space-y-4">
          {REGRAS.map((regra) => (
            <div key={regra.titulo} className="border-b border-border pb-4 last:border-b-0">
              <dt className="flex items-center gap-2.5 font-semibold">
                <span aria-hidden="true" className="ct-octagon size-2 shrink-0 bg-highlight" />
                {regra.titulo}
              </dt>
              <dd className="mt-1.5 pl-[1.15rem] text-muted">{regra.texto}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 max-w-2xl space-y-3 text-muted">
          <p>
            De madrugada, uma vez por noite, cada fonte é lida por sua vez. O que vem é normalizado
            — datas, horas, concelho, categoria — e comparado com o que já cá está, para não haver
            duplicados quando o mesmo evento aparece em duas fontes.
          </p>
          <p>
            Uma recolha que traga muito menos do que o costume não escreve nada: é o sinal de que o
            site mudou de forma, e nesse caso é preferível manter o que se tinha ontem a esvaziar a
            página. Uma fonte que falhe {FALHAS_ATE_PAUSA} noites seguidas fica em pausa{' '}
            {HORAS_EM_PAUSA} horas e volta a ser tentada sozinha depois disso — o erro fica
            guardado, para quem for ver saber o que aconteceu.
          </p>
          <p>
            Um evento que acontece não é apagado: é arquivado. Sai da agenda, dos feeds e do mapa,
            que são do que está para vir, e deixa de ter ficha própria. A excepção é a programação
            que pertence a um ciclo com nome — essa fica legível na página do ciclo, porque uma
            edição que já aconteceu é o melhor argumento para a próxima. O que for arquivado por
            estar errado, por ser duplicado ou por ter desaparecido da fonte não volta a ver-se.
          </p>
        </div>
      </section>

      {/*
       * O poste que fica onde a secção esteve.
       *
       * `/dados` foi um endereço público e é hoje um 308; a âncora `#dados`
       * desta página foi publicada em muitos sítios — inclusive no campo
       * `documentation` da própria API, em respostas já servidas e guardadas
       * em cache. **Uma âncora não se redirecciona**: o fragmento nunca chega
       * ao servidor, e por isso nenhum 308 o pode apanhar. Quem chegar aqui
       * por um desses endereços tem de encontrar uma frase a dizer para onde
       * é que aquilo se mudou, e não um sítio onde já não está nada.
       */}
      <section aria-labelledby="dados" className="mt-14 border-t border-border pt-8">
        <h2 id="dados" className="ct-heading scroll-mt-6">
          Levar estes dados daqui
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Os feeds, o calendário, a API e a caixa para colar no vosso sítio passaram a viver todos
          na mesma página, porque são a mesma pergunta:{' '}
          <Link href="/levar" className="font-medium underline underline-offset-4">
            Levar a agenda
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="falta" className="mt-12 border-t border-border pt-6">
        <h2 id="falta" className="ct-heading">
          Falta aqui uma fonte
        </h2>
        <p className="mt-3 max-w-2xl">
          Falta de certeza — sobretudo das coletividades, que são metade da programação desta região
          e quase nada dos portais oficiais. Se organiza, programa ou apenas sabe de uma agenda que
          devia ser lida, diga. Se um evento que aparece aqui estiver errado, o mais provável é que
          esteja errado também na origem — mas escreva na mesma: corrige-se aqui e avisa-se lá.
        </p>
        <p className="mt-4 flex flex-wrap gap-3">
          {/* Sem base não há endereço, e uma ligação sem texto é uma barreira. */}
          {EMAIL ? (
            <a
              href={`mailto:${EMAIL}?subject=${encodeURIComponent('Uma fonte para o Coreto')}`}
              className="inline-flex min-h-11 items-center rounded bg-accent px-5 text-sm font-medium text-on-accent"
            >
              {EMAIL}
            </a>
          ) : null}
          <Link
            href="/submeter"
            className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm font-medium underline-offset-4 hover:underline"
          >
            Enviar um evento
          </Link>
        </p>
      </section>
    </>
  );
}
