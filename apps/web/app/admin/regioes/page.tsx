import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { estadoDaLicenca } from '@/src/lib/admin/fields';
import {
  listRegionGates,
  listRegionLicenses,
  listRegionsAdmin,
  listSegredosDeBalanco,
  listSiteSectionsTodas,
  type RegionAdminRow,
} from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';
import { SECCOES_OPCIONAIS } from '@/src/lib/navegacao';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ aviso?: string }>;
}

/**
 * Os três estados de uma região, numa palavra e numa frase.
 *
 * Durante muito tempo foram dois — ligada ou desligada —, e esta coluna dizia
 * só isso. A barreira (0157) acrescentou o terceiro, que é o de uma região
 * **pronta e ainda não contratada**: de pé, a servir, e só para quem tem a
 * senha. Sem o terceiro estado escrito aqui, o painel dizia «Ligada» a uma
 * região que o público não consegue abrir — a coisa mais parecida com uma
 * mentira que um painel consegue dizer sem escrever nada de falso.
 *
 * Desligada ganha à barreira quando as duas estão: uma região fora do ar não
 * tem porta que valha a pena descrever.
 */
function estadoDaRegiao(regiao: RegionAdminRow): { rotulo: string; nota: string; alerta: boolean } {
  if (!regiao.is_enabled) {
    return {
      rotulo: 'Desligada',
      nota: 'Fora do mapa público: o domínio mostra a página do produto.',
      alerta: true,
    };
  }
  if (regiao.gate_enabled) {
    return {
      rotulo: 'Com barreira',
      nota: 'A servir, atrás de uma senha partilhada. Os feeds e a API continuam abertos.',
      alerta: true,
    };
  }
  return { rotulo: 'Aberta', nota: 'A servir, à vista de toda a gente.', alerta: false };
}

/** Um número e o que ele conta, no resumo de cima. */
function Conta({ quantas, rotulo }: { quantas: number; rotulo: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{rotulo}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{quantas}</dd>
    </div>
  );
}

/**
 * As regiões que esta instalação serve — quantas são, em que estado está cada
 * uma, e por onde se mexe em cada coisa.
 *
 * Uma região nova nasce em `/admin/regioes/nova`, pela função `create_region`
 * (migração 0121) — já com os concelhos, e com o espaço provisório e a fonte
 * desligada que as schema-checks exigem a cada um. Não é uma migração, e não
 * o era antes: uma região é um dado desta instalação, não do repositório, e
 * o CI faz nascer uma de prova em cada corrida para provar que o caminho
 * funciona (`docs/NOVA-CIM.md`). O que aqui se gere é o dia-a-dia do que já
 * nasceu: a prosa, os contactos, os logótipos, as licenças, as secções, a
 * barreira.
 *
 * **É uma lista de cartões e não uma tabela**, e a razão é o que passou a
 * caber em cada linha. Uma tabela com o estado, a licença, as secções, a porta
 * do balanço e a barreira tinha dez colunas, e num telemóvel isso é uma barra
 * de deslocação horizontal por cima de outra. Cada região é uma ficha
 * pequena; a informação que se compara entre regiões — quantas e em que
 * estado — está nas contas de cima, que é onde uma pessoa olha primeiro.
 */
export default async function Regioes({ searchParams }: Props) {
  const params = await searchParams;

  if (!hasServiceRole) {
    return (
      <>
        <PageHeader title="Regiões" />
        <p className="text-muted">
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. Sem ela o backoffice não lê nada.
        </p>
      </>
    );
  }

  const [regioes, seccoes, licencas, segredos, barreiras] = await Promise.all([
    listRegionsAdmin(),
    listSiteSectionsTodas(),
    listRegionLicenses(),
    listSegredosDeBalanco(),
    listRegionGates(),
  ]);

  const hoje = new Date().toISOString().slice(0, 10);
  const comSenha = new Set(barreiras.map((linha) => linha.region_id));
  const abertas = regioes.filter((r) => r.is_enabled && !r.gate_enabled).length;
  const tapadas = regioes.filter((r) => r.is_enabled && r.gate_enabled).length;
  const desligadas = regioes.filter((r) => !r.is_enabled).length;

  return (
    <>
      <PageHeader
        title="Regiões"
        lead="Cada cartão é uma CIM servida por esta instalação, no seu domínio. Uma região nova nasce em «Nova região», já com os concelhos — e o domínio entra depois, pelo guia docs/NOVA-CIM.md."
      >
        <p className="mt-4">
          <Link
            href="/admin/regioes/nova"
            className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm font-medium hover:bg-surface"
          >
            Nova região
          </Link>
        </p>
      </PageHeader>

      {params.aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {params.aviso}
        </p>
      ) : null}

      <section aria-labelledby="quantas" className="mb-8">
        <h2 id="quantas" className="sr-only">
          Quantas regiões, e em que estado
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Conta quantas={regioes.length} rotulo="Regiões" />
          <Conta quantas={abertas} rotulo="Abertas" />
          <Conta quantas={tapadas} rotulo="Com barreira" />
          <Conta quantas={desligadas} rotulo="Desligadas" />
        </dl>
      </section>

      <ul className="space-y-6">
        {regioes.map((regiao) => {
          const estado = estadoDaRegiao(regiao);
          const licenca = estadoDaLicenca(
            licencas.filter((linha) => linha.region_id === regiao.id),
            hoje,
          );
          const desligadasAqui = seccoes.filter(
            (linha) => linha.region_id === regiao.id && !linha.is_enabled,
          );
          const segredoDaRegiao = segredos.find((linha) => linha.region_id === regiao.id);
          const ficha = `/admin/regioes/${encodeURIComponent(regiao.id)}`;

          return (
            <li key={regiao.id} className="rounded border border-border p-4">
              <h2 className="text-lg font-semibold">
                <Link href={ficha} className="underline underline-offset-4">
                  {regiao.name}
                </Link>{' '}
                <span className="font-normal text-muted">{regiao.id}</span>
                {regiao.kind === 'montra' ? (
                  <span className="ml-1 text-sm font-normal text-muted">(montra)</span>
                ) : null}
              </h2>

              <p className={`mt-1 text-sm ${estado.alerta ? 'text-highlight' : ''}`}>
                <strong>{estado.rotulo}.</strong> <span className="text-muted">{estado.nota}</span>
              </p>

              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-muted">Domínio</dt>
                  <dd className="break-all">{regiao.domain}</dd>
                </div>
                <div>
                  <dt className="text-muted">Contacto</dt>
                  <dd className="break-all">{regiao.contact_email}</dd>
                </div>
                <div>
                  <dt className="text-muted">Concelhos</dt>
                  <dd className="tabular-nums">{regiao.expected_municipality_count}</dd>
                </div>
                <div>
                  <dt className="text-muted">Ordem</dt>
                  <dd className="tabular-nums">{regiao.sort_order}</dd>
                </div>
              </dl>

              <ul className="mt-3 space-y-1 text-sm">
                <li className={licenca.alerta ? 'text-highlight' : 'text-muted'}>
                  {licenca.texto}
                </li>
                <li className="text-muted">
                  Secções:{' '}
                  {desligadasAqui.length === 0
                    ? `as ${SECCOES_OPCIONAIS.length} ligadas`
                    : `${SECCOES_OPCIONAIS.length - desligadasAqui.length} de ${SECCOES_OPCIONAIS.length} ligadas — sem ${desligadasAqui.map((linha) => linha.id).join(', ')}`}
                </li>
                <li className="text-muted">
                  {segredoDaRegiao
                    ? `Porta do balanço aberta, com prazo até ${segredoDaRegiao.expires_on.split('-').reverse().join('/')}.`
                    : 'Sem porta do balanço aberta.'}
                </li>
                <li className="text-muted">
                  {regiao.gate_enabled
                    ? 'Barreira ligada.'
                    : comSenha.has(regiao.id)
                      ? 'Barreira desligada, com senha guardada para a próxima.'
                      : 'Sem barreira e sem senha definida.'}
                </li>
              </ul>

              {/*
                Os atalhos apontam para os títulos da ficha, que é onde cada
                coisa se mexe. Um painel que só diz «Editar» obriga a procurar
                a barreira no fim de um formulário de trinta campos.
              */}
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <Link href={ficha} className="underline underline-offset-4">
                  Ficha
                </Link>
                <Link href={`${ficha}#barreira`} className="underline underline-offset-4">
                  Barreira
                </Link>
                <Link href={`${ficha}#seccoes`} className="underline underline-offset-4">
                  Secções
                </Link>
                <Link href={`${ficha}#licencas`} className="underline underline-offset-4">
                  Licenças
                </Link>
                <Link href={`${ficha}#balanco`} className="underline underline-offset-4">
                  Balanço
                </Link>
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
