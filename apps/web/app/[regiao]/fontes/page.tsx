import type { Metadata } from 'next';
import Link from 'next/link';
import { FALHAS_ATE_PAUSA, HORAS_EM_PAUSA, USER_AGENT } from '@coreto/core';
import { PageHeader } from '@/src/components/PageHeader';
import { avaliarRecolha, fraseDaFonte } from '@/src/lib/estado';
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
    titulo: 'O robots.txt manda',
    texto:
      'Antes de pedir seja o que for — a página, o cartaz, ou o sítio para onde um redirecionamento mandar — pergunta-se ao robots.txt desse servidor se se pode. O que ele proibir não é pedido, e um bloco escrito para o nosso agente vale sozinho. Se o ficheiro não responder, não se lê nada — não consegui saber não é uma autorização.',
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

/**
 * As agendas de um concelho, por quem as publica.
 *
 * Aqui esteve uma lista só, ordenada por concelho, com as 14 câmaras, as 26
 * juntas e as salas todas misturadas. Uma câmara e uma junta de freguesia não
 * são a mesma coisa para quem lê esta página: a câmara é a agenda oficial do
 * município, a junta é a prova de que a agenda desce ao território, e a sala é
 * quem tem o detalhe que a agenda da câmara não traz. Com 26 juntas na lista,
 * as 14 câmaras desapareciam no meio.
 *
 * O `kind` é que decide, e é a 0135 que o torna possível: até lá, uma junta
 * estava escrita como `venue_site` e só se distinguia de uma sala pelo prefixo
 * do id.
 */
const INSTITUICOES = [
  {
    chave: 'municipal_site',
    titulo: 'As câmaras',
    descricao: 'A agenda oficial de cada município, lida todas as noites.',
  },
  {
    chave: 'parish_site',
    titulo: 'As juntas de freguesia',
    descricao: 'O que se passa nas aldeias e nas vilas, e que raramente chega à agenda da câmara.',
  },
  {
    chave: null,
    titulo: 'Salas, museus e coletividades',
    descricao:
      'Quem programa a sua própria casa e publica com o detalhe que a agenda do concelho não traz.',
  },
] as const;

function porInstituicao(sources: PublicSource[], chave: string | null): PublicSource[] {
  return chave === null
    ? sources.filter((source) => source.kind !== 'municipal_site' && source.kind !== 'parish_site')
    : sources.filter((source) => source.kind === chave);
}

/** «cm-tomar.pt/comunicacao/agenda» é mais legível do que o endereço inteiro. */
function encurtar(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

/**
 * A linha de estado de cada fonte, decidida onde a `/estado` a decide.
 *
 * **O que aqui esteve e mentia.** «Lida com sucesso a {data}» era escrito
 * diretamente de `last_success_at`, sem classificar coisa nenhuma: a mesma
 * frase para uma fonte lida ontem e para uma fonte parada há três semanas, só
 * com a data a mudar — e ninguém compara uma data com o dia de hoje de
 * cabeça enquanto lê oitenta cartões. Duas páginas a ler a mesma coluna e a
 * dizer coisas diferentes sobre ela é como se perde a confiança nas duas.
 *
 * Agora quem decide é `estado.ts`, e é o mesmo módulo que a `/estado` usa.
 */
function SourceCard({
  source,
  where,
  estado,
}: {
  source: PublicSource;
  where: string | null;
  /** A frase de `estado.ts`; `null` numa fonte desligada, que não está avariada. */
  estado: string | null;
}) {
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
      {estado ? <p className="mt-auto pt-1.5 text-xs text-muted">{estado}</p> : null}
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

  /*
   * A frase de estado de cada fonte, decidida pelo mesmo módulo que decide a
   * página /estado — e só para as ligadas, que são as únicas de que se pode
   * dizer que estão atrasadas. Uma fonte desligada é uma decisão de quem
   * administra e não uma avaria; escrever-lhe «sem leitura com sucesso desde»
   * era transformar a decisão num alarme, que é o mesmo engano que a /estado
   * evita ao não as contar.
   */
  const estadoPorFonte = new Map(
    avaliarRecolha(sources).vigiadas.map((fonte) => [
      fonte.id,
      fraseDaFonte(fonte, (iso) => formatLongDate(iso)),
    ]),
  );

  const regionais = ligadas.filter((source) => source.municipality_id === null);
  const locais = ligadas.filter((source) => source.municipality_id !== null);

  /*
   * O denominador de «X das Y juntas», e `null` quando ele não existe.
   *
   * «Não consegui saber» e «não há» são duas respostas diferentes: um concelho
   * sem `parish_count` faz a fração inteira desaparecer, em vez de a publicar
   * a menos de um concelho. É a regra que as schema-checks já exigem a
   * qualquer região que se declare completa (0136) — aqui é a cintura, para o
   * dia em que uma região nova ainda esteja a nascer.
   */
  const freguesias = municipalities.every((municipality) => municipality.parish_count !== null)
    ? municipalities.reduce((total, municipality) => total + (municipality.parish_count ?? 0), 0)
    : null;

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
          {ligadas.length} fontes ligadas, {municipalities.length} concelhos, uma recolha por dia.
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
          A câmara de cada município, as juntas de freguesia que publicam agenda própria, e as salas
          que publicam a sua programação com detalhe que a agenda da câmara não traz.
        </p>

        {INSTITUICOES.map((instituicao) => {
          const doGrupo = porInstituicao(locais, instituicao.chave)
            .slice()
            .sort((a, b) =>
              (municipalityNames[a.municipality_id ?? ''] ?? '').localeCompare(
                municipalityNames[b.municipality_id ?? ''] ?? '',
                'pt',
              ),
            );
          if (doGrupo.length === 0) return null;

          return (
            <div key={instituicao.titulo} className="mt-8 first:mt-6">
              <h3 className="ct-eyebrow">{instituicao.titulo}</h3>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                {instituicao.descricao}
                {instituicao.chave === 'parish_site' && freguesias !== null
                  ? ` São ${doGrupo.length} das ${freguesias} freguesias da região.`
                  : null}
              </p>
              <ul className="mt-3 grid auto-rows-fr gap-3 sm:grid-cols-2">
                {doGrupo.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    where={municipalityNames[source.municipality_id ?? ''] ?? null}
                    estado={estadoPorFonte.get(source.id) ?? null}
                  />
                ))}
              </ul>
            </div>
          );
        })}

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
                estado={estadoPorFonte.get(source.id) ?? null}
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
                estado={estadoPorFonte.get(source.id) ?? null}
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
        {/*
         * «Falhe» era vago, e a vagueza escondia um laço.
         *
         * Esta frase dizia «uma fonte que falhe cinco dias seguidos fica em
         * pausa». Enquanto «falhar» quis dizer as duas coisas — não responder,
         * e responder com menos —, a promessa era verdadeira e a casa estava
         * partida: a Câmara do Sardoal publicou seis eventos, depois cinco,
         * depois quatro, depois três, e ao fim de cinco leituras assim o
         * disjuntor abriu. O concelho deixou de ser lido por ter menos
         * programação, e a saída estava fechada por dentro — para voltar a
         * «normal» a contagem precisava dos itens que já não existiam.
         *
         * O disjuntor passou a contar só o que não se conseguiu ler. A frase
         * diz agora a mesma coisa que o código faz, e a segunda metade é nova
         * porque a garantia é nova.
         */}
        {/*
         * A cadência diz-se, a hora não se promete.
         *
         * Estas duas frases prometiam a madrugada e contavam em noites a pausa
         * de uma fonte que falha. O cron do `scrape.yml` está às
         * 03:20 UTC, mas a fila de execuções agendadas do GitHub atrasa-o
         * horas — medido às 07:58, 08:26, 10:11 e 15:28. Esta é a página que
         * presta contas de onde vem cada linha da agenda: uma frase falsa aqui
         * desconta as verdadeiras que estão à volta dela.
         */}
        <div className="mt-4 max-w-2xl space-y-3 text-muted">
          <p>
            Uma vez por dia, cada fonte é lida por sua vez. O que vem é normalizado — datas, horas,
            concelho, categoria — e comparado com o que já cá está, para não haver duplicados quando
            o mesmo evento aparece em duas fontes.
          </p>
          <p>
            Uma recolha que traga muito menos do que o costume não escreve nada: é o sinal de que o
            site mudou de forma, e nesse caso é preferível manter o que se tinha ontem a esvaziar a
            página. Uma fonte que <strong className="font-semibold text-fg">não responda</strong>{' '}
            {FALHAS_ATE_PAUSA} dias seguidos fica em pausa {HORAS_EM_PAUSA} horas e volta a ser
            tentada sozinha depois disso — o erro fica guardado, para quem for ver saber o que
            aconteceu. Uma fonte que responda e traga menos eventos do que o costume não é posta em
            pausa nenhuma: continua a ser lida todos os dias, e o que se vê fica registado.
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
       * A secção para quem está do outro lado do fio.
       *
       * Esta página é o endereço que o agente da recolha traz dentro de si, e
       * até aqui não dizia nada a quem segue esse endereço. Quem o segue não
       * vem propor uma fonte: vem de um registo de acessos, com uma linha que
       * não reconhece, a decidir se aquilo se bloqueia.
       *
       * Deixou de ser hipótese. A 12 e 13 de setembro de 2026, oito fontes do
       * Médio Tejo calaram-se ao mesmo tempo — e as oito resolvem para a mesma
       * máquina. Do executor do GitHub Actions a ligação morre com
       * `ECONNRESET`; de uma ligação móvel portuguesa o mesmo endereço abre.
       * É bloqueio por origem, e a casa não lhe dá a volta. O que resta é
       * pedir — e um pedido vale mais se a página que o agente aponta
       * responder às perguntas de quem o recebe, em vez de só falar para
       * quem quer acrescentar uma agenda.
       *
       * A linha do agente é lida de `@coreto/core` e não escrita aqui: quem
       * for confrontá-la com os registos dele tem de encontrar carácter a
       * carácter o que esta página lhe promete.
       */}
      <section aria-labelledby="registos" className="mt-12 border-t border-border pt-8">
        <h2 id="registos" className="ct-heading">
          Encontrou-nos nos registos do seu servidor
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          Se administra o sítio de uma câmara, de uma junta ou de uma sala desta região, é provável
          que tenha chegado aqui por esta linha — é ela que trazemos em cada pedido, e é por ela que
          nos encontra:
        </p>
        {/*
         * Quebra a linha, não a põe a deslocar.
         *
         * Esteve aqui `overflow-x-auto`, que é o que a casa usa nas tabelas e
         * nos blocos de código do `/levar`. O `axe` recusou-o, e com razão:
         * `scrollable-region-focusable`, no telemóvel e só no telemóvel, que é
         * a largura onde estes 76 caracteres transbordam. Uma região que se
         * desloca tem de se alcançar pelo teclado.
         *
         * O remédio da casa nesses outros sítios é `tabIndex={0}`, e aqui
         * seria pior do que a doença. Isto é uma linha, não uma tabela: quem a
         * lê está a compará-la, caractere a caractere, com o que tem nos
         * registos do servidor dele — e mandá-lo arrastar na horizontal, num
         * telemóvel, para ver o resto de uma cadeia que tem de conferir, é
         * dar-lhe uma paragem de teclado em vez de lhe dar a linha. `break-all`
         * mostra-a inteira de uma vez, e a seleção para copiar continua a
         * trazer a cadeia sem as quebras que só existem no ecrã.
         */}
        <p className="mt-3 max-w-2xl rounded border border-border bg-surface px-3 py-2 font-mono text-sm break-all">
          {USER_AGENT}
        </p>
        <dl className="mt-5 max-w-2xl space-y-4">
          <div className="border-b border-border pb-4">
            <dt className="font-semibold">O que fazemos</dt>
            <dd className="mt-1.5 text-muted">
              Uma vez por dia lemos a página da agenda — o endereço, ou os poucos endereços de
              listagem, que estão escritos na configuração desta fonte, nunca descobertos por
              varrimento — e seguimos a ligação de cada evento para a ficha dele, que é onde estão a
              data, a hora e o local. Mais nada: não percorremos o resto do sítio, não adivinhamos
              endereços, não procuramos ficheiros. Um pedido de cada vez, com pelo menos um segundo
              entre pedidos ao mesmo servidor. As imagens não são copiadas — continuam a ser
              servidas por si, a partir do seu endereço.
            </dd>
          </div>
          <div className="border-b border-border pb-4">
            <dt className="font-semibold">Para que serve</dt>
            <dd className="mt-1.5 text-muted">
              Para que o que a sua casa programa apareça numa agenda da região, com o nome da fonte
              e uma ligação de volta à sua página. Não há publicidade, não se revende o conteúdo, e
              cada evento diz de onde veio.
            </dd>
          </div>
          <div className="border-b border-border pb-4">
            <dt className="font-semibold">Se quiser que abrandemos, ou que paremos</dt>
            <dd className="mt-1.5 text-muted">
              Escreva{' '}
              {EMAIL ? (
                <a
                  href={`mailto:${EMAIL}?subject=${encodeURIComponent('Recolha do Coreto')}`}
                  className="font-medium underline underline-offset-4"
                >
                  {EMAIL}
                </a>
              ) : (
                'à equipa'
              )}{' '}
              e diga o domínio: desligamos a fonte no mesmo dia, ou espaçamos a leitura para o ritmo
              que lhe servir. Não é preciso justificar.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Se já nos bloqueou</dt>
            <dd className="mt-1.5 text-muted">
              Fica bloqueado. Não trocamos de agente, não usamos intermediários e não voltamos a
              bater de outra morada para contornar a regra — contornar um controlo de acesso não é
              recolha. Se o bloqueio foi para travar um robô a mais e não a nós, basta dizer-nos.
            </dd>
          </div>
        </dl>
        {/*
         * O `robots.txt` passou de confissão a promessa, e foi medido antes.
         *
         * Esta página dizia, por escrito, que a recolha **não** lia o
         * `robots.txt` de ninguém. Era verdade e era pouco, e ficou assim de
         * propósito enquanto a decisão de o cumprir estivesse por tomar — um
         * agente bem-comportado costuma lê-lo, e quem chega aqui assume que
         * sim; deixar a suposição de pé era a frase falsa mais fácil desta
         * página inteira, porque ninguém precisava de a escrever para ela
         * enganar.
         *
         * A decisão foi tomada, e veio depois da conta. A 14 de setembro de
         * 2026 leu-se o `robots.txt` das quarenta fontes: **trinta e duas
         * responderam e as trinta e duas deixam ler a agenda**. Zero fontes
         * perdidas. As outras oito estão bloqueadas pela máquina da CIM e não
         * se conseguiu saber — que é resposta diferente de «não há», e fica
         * dita como tal.
         *
         * O que a casa faz com um ficheiro que não responde está no
         * `packages/ingest/src/http.ts` e afasta-se da RFC 9309 de propósito:
         * a norma manda ler um 5xx como proibição total, e aqui a fonte falha
         * à vista em vez de emudecer. Uma proibição silenciosa é
         * indistinguível de uma agenda vazia, e é por aí que se perdem
         * concelhos sem ninguém dar por isso.
         */}
        <p className="mt-5 max-w-2xl text-muted">
          <strong className="font-semibold text-fg">
            Lemos o seu <code>robots.txt</code>, e obedecemos-lhe.
          </strong>{' '}
          Antes de pedir qualquer página perguntamos ao ficheiro do seu servidor se podemos, uma vez
          por dia e por servidor. O que ele proibir não é pedido. Se escrever um bloco{' '}
          <code>User-agent: Coreto</code>, é esse que vale — e vale sozinho, mesmo que seja mais
          largo do que o que escreveu para toda a gente.
        </p>
        <p className="mt-3 max-w-2xl text-muted">
          Se o ficheiro não existir, lemos a agenda: não haver ficheiro é não haver regras. Se o seu
          servidor não conseguir responder com ele,{' '}
          <strong className="font-semibold text-fg">não lemos nada</strong> e a falha fica registada
          do nosso lado — não tratamos «não consegui saber» como se fosse uma autorização. E o email
          acima continua a funcionar no mesmo dia, para o que o <code>robots.txt</code> não souber
          dizer.
        </p>
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
