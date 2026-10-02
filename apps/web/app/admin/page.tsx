import { todayInLisbon } from '@coreto/core/dates';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { ambitoDoPainel } from '@/src/lib/admin/ambito';
import { estadoDaLicenca } from '@/src/lib/admin/fields';
import { pode, primeiroNome, regioesComPapel } from '@/src/lib/admin/papeis';
import { listRegionLicenses, resumoDaEntrada } from '@/src/lib/admin/queries';
import { mesAnterior, nomeDoMes } from '@/src/lib/admin/relatorio';
import { hasServiceRole } from '@/src/lib/env';
import { emNome } from '@/src/lib/artigos';
import { formatLongDate } from '@/src/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Painel' };

interface Props {
  searchParams: Promise<{ aviso?: string; regiao?: string }>;
}

/** «Bom dia», «Boa tarde» ou «Boa noite», pela hora de Lisboa. */
function cumprimento(agora = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat('pt-PT', {
      timeZone: 'Europe/Lisbon',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(agora),
  );
  if (hora < 13) return 'Bom dia';
  if (hora < 20) return 'Boa tarde';
  return 'Boa noite';
}

/** O dia da semana e a data, como se escreve no cimo de uma página. */
function hojePorExtenso(hoje: string): string {
  const dia = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${hoje}T12:00:00Z`),
  );
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${formatLongDate(hoje)}`;
}

function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString('pt-PT')} ${n === 1 ? um : varios}`;
}

const CARTAO = 'rounded border border-border bg-surface p-4';
const BOTAO_CHEIO =
  'inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent';
const BOTAO =
  'inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium hover:bg-surface';

/**
 * A entrada do painel: o que há para fazer, na região de quem entra (C4-018).
 *
 * Abria com os interruptores das secções, com o SQL que os repõe e com um
 * botão para descartar a cache — três gestos de meio em meio ano, de quem
 * opera o produto —, e só lá em baixo dizia quantas propostas estavam por
 * rever. Quem modera abre o painel de manhã para saber o que tem à frente.
 * Agora é isso que vem primeiro; as definições da região têm a página delas, e
 * o que é do produto está nas páginas do dono.
 */
export default async function AdminDashboard({ searchParams }: Props) {
  const params = await searchParams;

  if (!hasServiceRole) {
    return (
      <>
        <PageHeader title="Painel" />
        <p className="text-muted">
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. Sem ela o painel não lê nada.
        </p>
      </>
    );
  }

  const ambito = await ambitoDoPainel({ pedida: params.regiao });
  const { sessao, escolhida } = ambito;
  const dono = sessao.tipo === 'dono';
  const hoje = todayInLisbon();
  const titulo = dono
    ? `${cumprimento()}.`
    : `${cumprimento()}, ${primeiroNome(sessao.pessoa.nome)}.`;

  if (ambito.disponiveis.length === 0) {
    return (
      <>
        <PageHeader title={titulo} eyebrow={hojePorExtenso(hoje)} />
        <p className="max-w-prose">
          Esta conta ainda não tem papel em nenhuma região, e por isso ainda não há nada para te
          mostrar. Pede um a quem te convidou para o painel — de editor, para moderar, ou de gestor,
          para gerir a região. O que cada um abre está na{' '}
          <Link href="/admin/ajuda" className="underline underline-offset-4">
            Ajuda
          </Link>
          .
        </p>
      </>
    );
  }

  const [resumo, licencas] = await Promise.all([
    resumoDaEntrada(ambito, {
      contarOutrasRegioes: dono && escolhida !== null,
      concelhos: ambito.concelhos ?? undefined,
    }),
    dono ? listRegionLicenses() : Promise.resolve([]),
  ]);

  // «no Médio Tejo», «na Travessia»: as contrações saem do artigo que a região
  // declara, como no resto do sítio.
  const onde = escolhida ? ` ${emNome(escolhida.name, escolhida.article)}` : '';
  const comRegiao = (caminho: string) =>
    escolhida
      ? `${caminho}${caminho.includes('?') ? '&' : '?'}regiao=${encodeURIComponent(escolhida.id)}`
      : caminho;

  const concelhosDoAmbito = Object.keys(resumo.publicadosPorConcelho).sort((a, b) =>
    (ambito.nomeDoConcelho.get(a) ?? a).localeCompare(ambito.nomeDoConcelho.get(b) ?? b, 'pt'),
  );
  const eventosDaSemana = Object.values(resumo.semanaPorConcelho).reduce((soma, n) => soma + n, 0);
  const semNadaNaSemana = concelhosDoAmbito.filter((id) => !resumo.semanaPorConcelho[id]).length;

  const regiaoDoRelatorio =
    escolhida && pode(sessao, escolhida.id, 'gestor')
      ? escolhida
      : (ambito.disponiveis.find((regiao) => pode(sessao, regiao.id, 'gestor')) ?? null);
  const mesDoRelatorio = mesAnterior(hoje);

  // Só as que pedem atenção: prazo a 30 dias ou já passado. Uma região sem
  // licença registada não grita daqui — a ficha dela di-lo, sem alarme.
  const licencasEmAlerta = dono
    ? ambito.disponiveis
        .map((regiao) => ({
          regiao,
          estado: estadoDaLicenca(
            licencas.filter((linha) => linha.region_id === regiao.id),
            hoje,
          ),
        }))
        .filter(({ estado }) => estado.alerta)
    : [];

  const geridas = regioesComPapel(sessao, 'gestor');
  const definicoes =
    escolhida && pode(sessao, escolhida.id, 'gestor')
      ? `/admin/regioes/${encodeURIComponent(escolhida.id)}`
      : geridas === 'todas'
        ? '/admin/regioes'
        : geridas[0]
          ? `/admin/regioes/${encodeURIComponent(geridas[0])}`
          : null;

  return (
    <>
      <PageHeader title={titulo} eyebrow={hojePorExtenso(hoje)} />

      {params.aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {params.aviso}
        </p>
      ) : null}

      <section
        aria-labelledby="por-rever"
        className="mb-6 rounded border border-border border-l-4 border-l-accent p-4 sm:p-5"
      >
        <h2 id="por-rever" className="ct-heading">
          {resumo.porRever === 0
            ? `Nada por rever${onde}`
            : `${plural(resumo.porRever, 'proposta por rever', 'propostas por rever')}${onde}`}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {[
            resumo.porRever > 0
              ? resumo.proximos7 === 0
                ? 'nenhuma acontece nos próximos 7 dias'
                : `${plural(resumo.proximos7, 'acontece', 'acontecem')} nos próximos 7 dias`
              : null,
            resumo.aEsperaDeResposta > 0
              ? `${plural(resumo.aEsperaDeResposta, 'está', 'estão')} à espera de resposta`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') ||
            'A fila está vazia: o que chegar por email, por programa ou pela recolha aparece aqui.'}
        </p>
        {resumo.noutrasRegioes ? (
          <p className="mt-1 text-sm">
            Noutras regiões há{' '}
            {plural(resumo.noutrasRegioes, 'proposta por rever', 'propostas por rever')} — escolhe
            «Todas as regiões» no cimo para as ver.
          </p>
        ) : null}
        <p className="mt-4 flex flex-wrap gap-3">
          <Link href="/admin/fila" className={BOTAO_CHEIO}>
            Abrir a fila
          </Link>
          <Link href="/admin/eventos?estado=published" className={BOTAO}>
            Corrigir um evento publicado
          </Link>
        </p>
      </section>

      {licencasEmAlerta.length > 0 ? (
        <section aria-labelledby="licencas-em-alerta" className="mb-6">
          <h2 id="licencas-em-alerta" className="text-lg font-semibold text-highlight">
            Licenças a precisar de atenção
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {licencasEmAlerta.map(({ regiao, estado }) => (
              <li key={regiao.id}>
                <Link
                  href={`/admin/regioes/${encodeURIComponent(regiao.id)}#licencas`}
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

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <section aria-labelledby="fontes-paradas" className={CARTAO}>
          <h2 id="fontes-paradas" className="font-semibold">
            Fontes paradas
          </h2>
          {resumo.fontes.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Ainda não há fontes nesta região.</p>
          ) : resumo.fontesParadas.length === 0 ? (
            <p className="mt-1 text-sm text-muted">
              {resumo.fontes.length === 1
                ? 'Nenhuma: a única fonte está a ser lida, ou em pausa com data para voltar.'
                : `Nenhuma: as ${resumo.fontes.length.toLocaleString('pt-PT')} fontes estão a ser lidas, ou em pausa com data para voltar.`}
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                {resumo.fontesParadas.length} de {resumo.fontes.length} não estão a ser lidas.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {resumo.fontesParadas.slice(0, 4).map((fonte) => (
                  <li key={fonte.id}>
                    <Link
                      href={`/admin/fontes/${encodeURIComponent(fonte.id)}`}
                      className="underline underline-offset-4"
                    >
                      {fonte.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-sm">
            <Link
              href="/admin/fontes"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Ver as fontes{onde ? ' desta região' : ''}
            </Link>
          </p>
        </section>

        <section aria-labelledby="semana" className={CARTAO}>
          <h2 id="semana" className="font-semibold">
            Esta semana na agenda
          </h2>
          <p className="mt-1 text-sm text-muted">
            {plural(eventosDaSemana, 'evento publicado', 'eventos publicados')} nos próximos 7 dias
            {semNadaNaSemana > 0
              ? ` · ${plural(semNadaNaSemana, 'concelho sem nada marcado', 'concelhos sem nada marcado')}`
              : ''}
            .
          </p>
          <p className="mt-3 text-sm">
            <Link
              href={comRegiao('/admin/qualidade')}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              O que falta preencher
            </Link>
          </p>
        </section>

        {regiaoDoRelatorio ? (
          <section aria-labelledby="relatorio" className={CARTAO}>
            <h2 id="relatorio" className="font-semibold">
              Relatório de {nomeDoMes(mesDoRelatorio).split(' de ')[0]}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {regiaoDoRelatorio.name}: pronto para enviar a quem financia.
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 text-sm">
              <Link
                href={`/admin/relatorios?${new URLSearchParams({ regiao: regiaoDoRelatorio.id, mes: mesDoRelatorio })}`}
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                Abrir
              </Link>
            </p>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="publicados" className="mb-8">
        <h2 id="publicados" className="text-lg font-semibold">
          Publicados por concelho
        </h2>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {concelhosDoAmbito
            .sort(
              (a, b) =>
                (resumo.publicadosPorConcelho[b] ?? 0) - (resumo.publicadosPorConcelho[a] ?? 0),
            )
            .map((id) => {
              const n = resumo.publicadosPorConcelho[id] ?? 0;
              return (
                <li key={id} className="flex justify-between border-b border-border py-1">
                  <span>{ambito.nomeDoConcelho.get(id) ?? id}</span>
                  <span className={n === 0 ? 'text-highlight' : 'text-muted'}>{n}</span>
                </li>
              );
            })}
        </ul>
      </section>

      <p className="text-sm text-muted">
        {dono ? (
          <>
            As secções, a barreira, as licenças e o botão que atualiza o sítio estão em{' '}
            <Link href="/admin/regioes" className="underline underline-offset-4">
              Regiões
            </Link>
            ; quem entra no painel, em{' '}
            <Link href="/admin/pessoas" className="underline underline-offset-4">
              Pessoas
            </Link>
            .
          </>
        ) : definicoes ? (
          <>
            As secções do sítio, os textos, a cor e os destaques da entrada estão em{' '}
            <Link href={definicoes} className="underline underline-offset-4">
              Definições da região
            </Link>
            ; o que o teu papel abre, na{' '}
            <Link href="/admin/ajuda" className="underline underline-offset-4">
              Ajuda
            </Link>
            .
          </>
        ) : (
          <>
            As definições da região são de quem a gere. O que o teu papel abre está na{' '}
            <Link href="/admin/ajuda" className="underline underline-offset-4">
              Ajuda
            </Link>
            .
          </>
        )}
      </p>
    </>
  );
}
