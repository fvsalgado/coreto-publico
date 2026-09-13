import type { Metadata } from 'next';
import { PageHeader } from '@/src/components/PageHeader';
import { StatTable, type StatColumn } from '@/src/components/StatTable';
import { listRegionsAdmin, monthlyReport } from '@/src/lib/admin/queries';
import {
  CANAIS,
  DESFECHOS,
  escolherRegiao,
  lerMes,
  mesAnterior,
  nomeDoFicheiro,
  nomeDoMes,
  porqueSemHistorico,
  type RelatorioMensal,
} from '@/src/lib/admin/relatorio';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Relatórios' };

const CAMPO = 'mt-1 min-h-11 rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const BOTAO =
  'inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium';
const ROTULO = 'block text-sm font-medium';

const numberFormat = new Intl.NumberFormat('pt-PT');

function contar(valor: number): string {
  return numberFormat.format(valor);
}

/** Sem casas decimais, pela razão da página de qualidade: 62 e 62,4 dizem o mesmo. */
function percentagem(parte: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((parte / total) * 100)}%`;
}

/** `2026-09-01T03:21:07.12+00:00` → `2026-09-01 03:21`, como na página das fontes. */
function quando(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '—';
}

type Publicado = RelatorioMensal['events']['published_in_month'][number];
type ADecorrer = RelatorioMensal['events']['happening_in_month'][number];
type Fonte = RelatorioMensal['sources'][number];
type Qualidade = RelatorioMensal['quality'][number];
type Visita = RelatorioMensal['visits']['by_municipality'][number];
type Contagem = { chave: string; rotulo: string; valor: number };

const PUBLICADOS: Array<StatColumn<Publicado>> = [
  { key: 'concelho', label: 'Concelho', isRowHeader: true, render: (l) => l.municipality_name },
  { key: 'categoria', label: 'Categoria', render: (l) => l.category_name ?? 'Sem categoria' },
  { key: 'eventos', label: 'Eventos', isNumeric: true, render: (l) => contar(l.count) },
];

const A_DECORRER: Array<StatColumn<ADecorrer>> = [
  { key: 'concelho', label: 'Concelho', isRowHeader: true, render: (l) => l.municipality_name },
  { key: 'eventos', label: 'Eventos', isNumeric: true, render: (l) => contar(l.count) },
];

const FONTES: Array<StatColumn<Fonte>> = [
  {
    key: 'fonte',
    label: 'Fonte',
    isRowHeader: true,
    render: (f) => (
      <>
        {f.name}
        {!f.is_enabled ? <span className="ml-2 text-muted">(desligada)</span> : null}
      </>
    ),
  },
  { key: 'concelho', label: 'Concelho', render: (f) => f.municipality_id ?? 'toda a região' },
  { key: 'execucoes', label: 'Execuções', isNumeric: true, render: (f) => contar(f.runs) },
  { key: 'falhas', label: 'Falhas', isNumeric: true, render: (f) => contar(f.failures) },
  {
    key: 'ultimo-sucesso',
    label: 'Último sucesso',
    render: (f) => <span className="tabular-nums">{quando(f.last_success_at)}</span>,
  },
  {
    key: 'novos',
    label: 'Itens novos',
    isNumeric: true,
    render: (f) => contar(f.items_new_in_month),
  },
];

const CONTAGENS: Array<StatColumn<Contagem>> = [
  { key: 'rotulo', label: 'Canal', isRowHeader: true, render: (c) => c.rotulo },
  { key: 'valor', label: 'Submissões', isNumeric: true, render: (c) => contar(c.valor) },
];

const DESFECHOS_COLUNAS: Array<StatColumn<Contagem>> = [
  { key: 'rotulo', label: 'Desfecho', isRowHeader: true, render: (c) => c.rotulo },
  { key: 'valor', label: 'Submissões', isNumeric: true, render: (c) => contar(c.valor) },
];

const MEDIDAS = [
  { chave: 'with_time', rotulo: 'Hora' },
  { chave: 'with_venue', rotulo: 'Espaço' },
  { chave: 'with_image', rotulo: 'Imagem' },
  { chave: 'with_description', rotulo: 'Descrição' },
  { chave: 'with_price', rotulo: 'Preço' },
  { chave: 'with_coordinates', rotulo: 'Mapa' },
] as const;

const QUALIDADE: Array<StatColumn<Qualidade>> = [
  { key: 'concelho', label: 'Concelho', isRowHeader: true, render: (q) => q.municipality_name },
  { key: 'publicados', label: 'Publicados', isNumeric: true, render: (q) => contar(q.published) },
  { key: 'pendentes', label: 'Por publicar', isNumeric: true, render: (q) => contar(q.pending) },
  ...MEDIDAS.map((medida): StatColumn<Qualidade> => ({
    key: medida.chave,
    label: medida.rotulo,
    isNumeric: true,
    render: (q) => percentagem(q[medida.chave], q.in_catalogue),
  })),
];

const VISITAS: Array<StatColumn<Visita>> = [
  { key: 'concelho', label: 'Concelho', isRowHeader: true, render: (v) => v.municipality_name },
  { key: 'aberturas', label: 'Aberturas', isNumeric: true, render: (v) => contar(v.views) },
  { key: 'bilhetica', label: 'Bilhética', isNumeric: true, render: (v) => contar(v.ticket_clicks) },
  {
    key: 'calendario',
    label: 'Calendário',
    isNumeric: true,
    render: (v) => contar(v.ical_downloads),
  },
  { key: 'partilhas', label: 'Partilhas', isNumeric: true, render: (v) => contar(v.shares) },
  { key: 'cliques', label: 'Cliques', isNumeric: true, render: (v) => contar(v.clicks) },
];

function somaQualidade(linhas: Qualidade[]): Qualidade {
  const total: Qualidade = {
    municipality_id: '',
    municipality_name: 'Total',
    published: 0,
    pending: 0,
    in_catalogue: 0,
    with_time: 0,
    with_venue: 0,
    with_image: 0,
    with_description: 0,
    with_price: 0,
    with_coordinates: 0,
  };
  for (const linha of linhas) {
    total.published += linha.published;
    total.pending += linha.pending;
    total.in_catalogue += linha.in_catalogue;
    for (const medida of MEDIDAS) total[medida.chave] += linha[medida.chave];
  }
  return total;
}

function somaVisitas(linhas: Visita[]): Visita {
  return linhas.reduce<Visita>(
    (total, v) => ({
      ...total,
      views: total.views + v.views,
      ticket_clicks: total.ticket_clicks + v.ticket_clicks,
      ical_downloads: total.ical_downloads + v.ical_downloads,
      shares: total.shares + v.shares,
      clicks: total.clicks + v.clicks,
    }),
    {
      municipality_id: '',
      municipality_name: 'Total',
      views: 0,
      ticket_clicks: 0,
      ical_downloads: 0,
      shares: 0,
      clicks: 0,
    },
  );
}

function Seccao({
  id,
  titulo,
  legenda,
  children,
}: {
  id: string;
  titulo: string;
  legenda?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mb-10">
      <h2 id={id} className="text-lg font-semibold">
        {titulo}
      </h2>
      {legenda ? <p className="mt-1 max-w-prose text-sm text-muted">{legenda}</p> : null}
      {children}
    </section>
  );
}

interface Props {
  searchParams: Promise<{ regiao?: string; mes?: string }>;
}

/**
 * O relatório mensal de uma região: o que se entrega a quem financia.
 *
 * Uma CIM presta contas ao mês, e presta-as com cinco perguntas que o painel
 * já respondia — em cinco páginas, cada uma sobre hoje. Aqui respondem-se de
 * uma vez, sobre um mês, numa página que se imprime tal como está (a barra e
 * o formulário ficam de fora, ver `globals.css`) e se descarrega em CSV e em
 * JSON pelas duas rotas ao lado.
 *
 * Tudo o que se mostra vem de `monthly_report` (0120), numa ida só à base;
 * o que não se sabe diz-se — as visitas de um mês sem duas fotografias são
 * «sem histórico», e a qualidade é a de hoje, porque não tem outra.
 */
export default async function Relatorios({ searchParams }: Props) {
  if (!hasServiceRole) {
    return (
      <>
        <PageHeader title="Relatórios" />
        <p className="text-muted">
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. Sem ela não há relatório que ler.
        </p>
      </>
    );
  }

  const params = await searchParams;
  const regioes = await listRegionsAdmin();
  const regiao = escolherRegiao(regioes, params.regiao);
  const mesPedido = lerMes(params.mes);
  const mes = mesPedido ?? mesAnterior(new Date().toISOString().slice(0, 10));
  const relatorio = regiao ? await monthlyReport(regiao, mes) : null;

  const descarga = (extensao: 'csv' | 'json') =>
    `/admin/relatorios/relatorio.${extensao}?${new URLSearchParams({ regiao: regiao ?? '', mes })}`;

  return (
    <>
      <PageHeader
        title="Relatórios"
        lead="O mês de uma região, para entregar a quem financia: o que a agenda publicou, se as fontes estiveram vivas, o que chegou por email e pelo formulário, como está o catálogo e quantas vezes foi visitado."
      />

      <form method="get" className="ct-sem-impressao mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="regiao" className={ROTULO}>
            Região
          </label>
          <select id="regiao" name="regiao" defaultValue={regiao ?? ''} className={CAMPO}>
            {regioes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.kind === 'montra' ? ' (montra)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mes" className={ROTULO}>
            Mês
          </label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className={CAMPO} required />
        </div>
        <button type="submit" className={BOTAO}>
          Ver
        </button>
      </form>

      {params.mes && !mesPedido ? (
        <p role="status" className="ct-sem-impressao mb-6 text-sm text-highlight">
          O mês <code>{params.mes}</code> não se lê — tem de ser AAAA-MM. Mostra-se o mês passado.
        </p>
      ) : null}

      {!regiao || !relatorio ? (
        <p className="text-highlight">
          {params.regiao ? (
            <>
              A região <code>{params.regiao}</code> não existe. Escolhe uma da lista.
            </>
          ) : (
            'Não há regiões na base — e sem região não há relatório.'
          )}
        </p>
      ) : (
        <>
          <p className="ct-sem-impressao mb-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <a
              href={descarga('csv')}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Descarregar CSV
            </a>
            <a
              href={descarga('json')}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              JSON
            </a>
            <span className="text-muted">
              Para imprimir, Ctrl+P — a barra e o formulário ficam de fora.
            </span>
          </p>

          <article aria-labelledby="relatorio-titulo">
            <header className="mb-8">
              <p className="ct-eyebrow mb-2">Relatório mensal</p>
              <h2 id="relatorio-titulo" className="ct-heading">
                {relatorio.region.name} — {nomeDoMes(relatorio.month)}
              </h2>
              <p className="mt-2 text-sm text-muted">
                Produzido a <span className="tabular-nums">{quando(relatorio.generated_at)}</span>{' '}
                (UTC), a partir da base de dados do Coreto. Ficheiros:{' '}
                <code>{nomeDoFicheiro(relatorio.region.id, relatorio.month, 'csv')}</code> e{' '}
                <code>{nomeDoFicheiro(relatorio.region.id, relatorio.month, 'json')}</code>.
              </p>
            </header>

            <Seccao
              id="eventos"
              titulo="Eventos"
              legenda={`Em ${nomeDoMes(relatorio.month)} foram publicados ${contar(relatorio.events.totals.published_in_month)} eventos, e ${contar(relatorio.events.totals.happening_in_month)} estiveram publicados e a acontecer. Hoje a região tem ${contar(relatorio.events.totals.published_now)} eventos publicados.`}
            >
              <h3 className="mt-4 font-semibold">Publicados no mês, por concelho e categoria</h3>
              <StatTable
                caption={`Eventos publicados em ${nomeDoMes(relatorio.month)}, por concelho e categoria. Só as combinações com pelo menos um evento.`}
                columns={PUBLICADOS}
                rows={relatorio.events.published_in_month}
                rowKey={(l) => `${l.municipality_id}/${l.category_slug ?? ''}`}
                emptyMessage="Nenhum evento foi publicado neste mês."
              />

              <h3 className="mt-6 font-semibold">A acontecer no mês, por concelho</h3>
              <StatTable
                caption={`Eventos publicados a acontecer em ${nomeDoMes(relatorio.month)}, por concelho, com todos os concelhos da região.`}
                columns={A_DECORRER}
                rows={relatorio.events.happening_in_month}
                rowKey={(l) => l.municipality_id}
                emptyMessage="A região não tem concelhos."
                totalRow={{
                  municipality_id: '',
                  municipality_name: 'Total',
                  count: relatorio.events.totals.happening_in_month,
                }}
              />
            </Seccao>

            <Seccao
              id="fontes"
              titulo="Fontes"
              legenda="As execuções da recolha começadas no mês, fonte a fonte. Uma falha é uma execução que acabou em erro; uma execução parcial — a fonte respondeu, mas com menos do que o costume — não conta como falha."
            >
              <StatTable
                caption={`As fontes da região e as suas execuções em ${nomeDoMes(relatorio.month)}.`}
                columns={FONTES}
                rows={relatorio.sources}
                rowKey={(f) => f.id}
                emptyMessage="Esta região não tem fontes de recolha."
              />
            </Seccao>

            <Seccao
              id="territorio"
              titulo="Território"
              legenda="Quanto do território publica agenda própria. As juntas ligadas são o numerador; as freguesias da região, o denominador. A fração fica por fazer de propósito: uma percentagem é uma leitura, e quem escreve o relatório anual faz a sua."
            >
              <StatTable
                caption="Concelhos, freguesias e fontes institucionais ligadas."
                columns={CONTAGENS}
                rows={[
                  {
                    chave: 'concelhos',
                    rotulo: 'Concelhos',
                    valor: relatorio.territory.municipalities,
                  },
                  {
                    chave: 'camaras',
                    rotulo: 'Câmaras com agenda lida',
                    valor: relatorio.territory.municipal_sources_enabled,
                  },
                  {
                    chave: 'juntas',
                    rotulo: 'Juntas de freguesia com agenda lida',
                    valor: relatorio.territory.parish_sources_enabled,
                  },
                ]}
                rowKey={(c) => c.chave}
                emptyMessage="A região não tem concelhos."
              />
              <p className="mt-3 text-sm text-muted">
                {relatorio.territory.parishes === null
                  ? 'Falta contar as freguesias de pelo menos um concelho desta região, por isso o denominador não aparece: «26 em 72» e «26 em 84» leem-se de maneiras diferentes, e publicar o primeiro por o segundo estar incompleto seria dizer mais do que se sabe.'
                  : `A região tem ${contar(relatorio.territory.parishes)} freguesias.`}
              </p>
            </Seccao>

            <Seccao
              id="submissoes"
              titulo="Submissões"
              legenda="O que entrou na fila de moderação no mês, por canal, e o que foi revisto no mês, pelo desfecho. «Outras» são as fundidas com um evento que já existia, as marcadas como duplicado e as que ficaram à espera de informação."
            >
              <div className="grid gap-8 sm:grid-cols-2">
                <div>
                  <h3 className="mt-4 font-semibold">
                    Recebidas: {contar(relatorio.submissions.received)}
                  </h3>
                  <StatTable
                    caption="Submissões recebidas no mês, por canal."
                    columns={CONTAGENS}
                    rows={(Object.keys(CANAIS) as Array<keyof typeof CANAIS>).map((canal) => ({
                      chave: canal,
                      rotulo: CANAIS[canal],
                      valor: relatorio.submissions.received_by_channel[canal],
                    }))}
                    rowKey={(c) => c.chave}
                    emptyMessage="Nada recebido."
                  />
                </div>
                <div>
                  <h3 className="mt-4 font-semibold">Revistas</h3>
                  <StatTable
                    caption="Submissões revistas no mês, pelo desfecho."
                    columns={DESFECHOS_COLUNAS}
                    rows={(Object.keys(DESFECHOS) as Array<keyof typeof DESFECHOS>).map(
                      (desfecho) => ({
                        chave: desfecho,
                        rotulo: DESFECHOS[desfecho],
                        valor: relatorio.submissions.reviewed[desfecho],
                      }),
                    )}
                    rowKey={(c) => c.chave}
                    emptyMessage="Nada revisto."
                  />
                </div>
              </div>
            </Seccao>

            <Seccao
              id="qualidade"
              titulo="Qualidade do catálogo"
              legenda="Quantos eventos dizem a que horas, onde e com que imagem — em percentagem do catálogo (publicados mais por publicar), como em /admin/qualidade. É o catálogo tal como está hoje, e não como estava no fim do mês: a medida de qualidade não guarda histórico, e o relatório prefere dizê-lo a fingir."
            >
              <StatTable
                caption="A qualidade do catálogo por concelho, tal como está hoje."
                columns={QUALIDADE}
                rows={relatorio.quality}
                rowKey={(q) => q.municipality_id}
                emptyMessage="A região não tem concelhos."
                totalRow={somaQualidade(relatorio.quality)}
              />
            </Seccao>

            <Seccao
              id="visitas"
              titulo="Visitas"
              legenda="Aberturas de fichas e cliques nos botões da bilhética, do calendário e da partilha, por concelho. São contagens sem identificação de ninguém — duas visitas da mesma pessoa contam duas vezes —, e o mês é a diferença entre duas fotografias diárias dos totais."
            >
              {relatorio.visits.available ? (
                <>
                  <p className="mt-2 text-sm text-muted">
                    Contadas entre a fotografia de{' '}
                    <span className="tabular-nums">{relatorio.visits.from}</span> e a de{' '}
                    <span className="tabular-nums">{relatorio.visits.to}</span>.
                  </p>
                  <StatTable
                    caption={`Visitas por concelho entre ${relatorio.visits.from} e ${relatorio.visits.to}, com o total da região na última linha.`}
                    columns={VISITAS}
                    rows={relatorio.visits.by_municipality}
                    rowKey={(v) => v.municipality_id}
                    emptyMessage="Sem contagens."
                    totalRow={somaVisitas(relatorio.visits.by_municipality)}
                  />
                </>
              ) : (
                <p className="mt-2 text-highlight">
                  Sem histórico de visitas para este mês. {porqueSemHistorico(relatorio.visits)}
                </p>
              )}
            </Seccao>

            <section
              aria-labelledby="proveniencia"
              className="border-t border-border pt-4 text-sm text-muted"
            >
              <h2 id="proveniencia" className="font-semibold text-ink">
                De onde vêm estes números
              </h2>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  Os eventos contam-se pela data em que foram publicados e pelas datas em que
                  acontecem; um evento escondido por engano não conta, um cancelado conta como
                  publicado.
                </li>
                <li>
                  As submissões atribuem-se ao concelho do evento em que resultaram e, enquanto não
                  resultam em nenhum, à região a que foram dirigidas.
                </li>
                <li>
                  As visitas são contadores do próprio sítio, sem cookies nem identificador; as
                  fotografias tiram-se de madrugada, na recolha noturna, e um mês sem fotografia de
                  um dos lados fica «sem histórico» em vez de inventado.
                </li>
                <li>As fronteiras do mês são à meia-noite UTC.</li>
              </ul>
              {/*
                Estas quatro linhas são o resumo; a ficha técnica é a versão que
                se anexa. Campo a campo, o que conta e o que não conta — porque
                quase todos estes números respondem a uma pergunta ligeiramente
                diferente da que o nome sugere, e somar colunas de blocos
                diferentes dá um número que não quer dizer nada.
              */}
              <p className="mt-3">
                A definição exata de cada campo — o que conta, o que não conta, sobre que universo —
                está em <code>docs/INDICADORES.md</code>, e o CI falha se um indicador novo aparecer
                sem lá ter entrada.
              </p>
            </section>
          </article>
        </>
      )}
    </>
  );
}
