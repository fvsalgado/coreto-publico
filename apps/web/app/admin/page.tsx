import type { Metadata } from 'next';
import Link from 'next/link';
import { InterruptoresDeSeccoes } from '@/src/components/InterruptoresDeSeccoes';
import { PageHeader } from '@/src/components/PageHeader';
import { actualizarSitio } from '@/src/lib/admin/actions';
import { estadoDaLicenca } from '@/src/lib/admin/fields';
import {
  dashboardCounts,
  listRegionLicenses,
  listRegionsAdmin,
  listSiteSections,
  STALE_SOURCE_HOURS,
} from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';
import { REGIAO_PRINCIPAL } from '@/src/lib/regiao-host';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Painel' };

const CHANNEL_LABELS: Record<string, string> = {
  scraper: 'Recolha',
  email: 'Email',
  form: 'Formulário',
};

interface Props {
  searchParams: Promise<{ aviso?: string }>;
}

export default async function AdminDashboard({ searchParams }: Props) {
  const params = await searchParams;

  if (!hasServiceRole) {
    return (
      <>
        <PageHeader title="Painel" />
        <p className="text-muted">
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. Sem ela o backoffice não lê nada.
        </p>
      </>
    );
  }

  const [{ pendingByChannel, publishedByMunicipality, brokenSources }, seccoes, regioes, licencas] =
    await Promise.all([
      dashboardCounts(),
      listSiteSections(REGIAO_PRINCIPAL),
      listRegionsAdmin(),
      listRegionLicenses(),
    ]);
  const totalPending = Object.values(pendingByChannel).reduce((sum, n) => sum + n, 0);

  // Só as que pedem atenção: prazo a 30 dias ou já passado. Uma região sem
  // licença registada não grita daqui — a ficha dela di-lo, sem alarme.
  const hoje = new Date().toISOString().slice(0, 10);
  const licencasEmAlerta = regioes
    .map((regiao) => ({
      regiao,
      estado: estadoDaLicenca(
        licencas.filter((linha) => linha.region_id === regiao.id),
        hoje,
      ),
    }))
    .filter(({ estado }) => estado.alerta);

  return (
    <>
      <PageHeader title="Painel" />

      {params.aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {params.aviso}
        </p>
      ) : null}

      {licencasEmAlerta.length > 0 ? (
        <section aria-labelledby="licencas-em-alerta" className="mb-8">
          <h2 id="licencas-em-alerta" className="text-lg font-semibold text-highlight">
            Licenças a precisar de atenção
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {licencasEmAlerta.map(({ regiao, estado }) => (
              <li key={regiao.id}>
                <Link
                  href={`/admin/regioes/${encodeURIComponent(regiao.id)}`}
                  className="underline underline-offset-4"
                >
                  {regiao.name}
                </Link>{' '}
                <span className="text-muted">{estado.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        Os interruptores das secções.

        Ficam no painel e não numa página só deles: são quatro booleanos que se
        carregam de meio em meio ano, e uma décima entrada na barra da
        administração para quatro botões era arrumação a mais.

        E ao lado deles vai o SQL que reproduz o estado de hoje — o mesmo que a
        página dos espaços faz com os alias. A regra da casa é que a base se
        reconstrói do repositório; um interruptor na web abre uma porta a isso
        deixar de ser verdade, e mostrar aqui as linhas que o repõem é o que
        mantém o caminho de volta aberto.
      */}
      <section aria-labelledby="seccoes" className="mb-8">
        <h2 id="seccoes" className="text-lg font-semibold">
          Secções do sítio
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Desligada, a secção sai da navegação e do mapa do sítio, e o endereço passa a responder
          404. Não se perde nada: o que se desliga é a porta, e voltar a ligar repõe a página como
          estava. Estes interruptores são da região principal (<code>{REGIAO_PRINCIPAL}</code>); as
          outras regiões têm os seus na página das{' '}
          <Link href="/admin/regioes" className="underline underline-offset-4">
            Regiões
          </Link>
          .
        </p>

        <InterruptoresDeSeccoes regiao={REGIAO_PRINCIPAL} seccoes={seccoes} />
      </section>

      {/*
        O botão que descarta a cache.

        Fica logo a seguir aos interruptores porque é o mesmo tipo de gesto —
        raro, deliberado, sobre o sítio inteiro — e porque é a seguir a mexer na
        base que dá jeito tê-lo à mão.

        A frase diz quando é que ele serve, e sobretudo quando não serve: as
        acções deste painel já invalidam o que mexem, e a recolha noturna
        invalida no fim. O que sobra é a escrita feita por fora — uma migração
        de dados, uma correção à mão no Supabase —, e é só para isso que este
        botão existe.
      */}
      <section aria-labelledby="cache" className="mb-8">
        <h2 id="cache" className="text-lg font-semibold">
          Actualizar o sítio
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          As páginas públicas guardam-se por uma hora. As acções deste painel e a recolha da
          madrugada já as actualizam sozinhas — este botão é para quando se escreve na base por
          fora, numa migração ou à mão, e o sítio ainda mostra o que havia antes. Não apaga nada:
          obriga a próxima visita a ir buscar à base o que a base já diz.
        </p>
        <form action={actualizarSitio} className="mt-3">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm font-medium hover:bg-surface"
          >
            Actualizar o sítio agora
          </button>
        </form>
      </section>

      <section aria-labelledby="fila" className="mb-8">
        <h2 id="fila" className="text-lg font-semibold">
          Por rever
        </h2>
        {totalPending === 0 ? (
          <p className="mt-2 text-muted">Nada à espera.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-4 text-sm">
            {Object.entries(pendingByChannel).map(([channel, count]) => (
              <li key={channel}>
                <Link
                  href={`/admin/fila?channel=${channel}`}
                  className="inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  {CHANNEL_LABELS[channel] ?? channel}: <strong>{count}</strong>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="fontes" className="mb-8">
        <h2 id="fontes" className="text-lg font-semibold">
          Fontes com problemas
        </h2>
        {brokenSources.length === 0 ? (
          <p className="mt-2 text-muted">
            Todas as fontes correram com sucesso nas últimas {STALE_SOURCE_HOURS} horas.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {brokenSources.map((source) => (
              <li key={source.id}>
                <Link href="/admin/fontes" className="underline underline-offset-4">
                  {source.name}
                </Link>{' '}
                <span className="text-muted">
                  {source.breaker_open
                    ? 'disjuntor aberto'
                    : source.consecutive_failures > 0
                      ? `${source.consecutive_failures} falhas seguidas`
                      : 'sem sucesso recente'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="publicados">
        <h2 id="publicados" className="text-lg font-semibold">
          Publicados por concelho
        </h2>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(publishedByMunicipality)
            .sort(([, a], [, b]) => b - a)
            .map(([id, count]) => (
              <li key={id} className="flex justify-between border-b border-border py-1">
                <span>{id}</span>
                <span className={count === 0 ? 'text-highlight' : 'text-muted'}>{count}</span>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}
