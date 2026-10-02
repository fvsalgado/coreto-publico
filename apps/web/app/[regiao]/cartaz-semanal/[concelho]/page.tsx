import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { janelaDaSemana, todayInLisbon } from '@coreto/core';
import { BotaoDeImprimir } from '@/src/components/BotaoDeImprimir';
import { FolhaDaSemana } from '@/src/components/FolhaDaSemana';
import { PageHeader } from '@/src/components/PageHeader';
import { montarCartazDaSemana } from '@/src/lib/cartaz-semanal';
import { SITE_URL } from '@/src/lib/env';
import { listFeedSessions } from '@/src/lib/feeds/data';
import { migalhasDoConcelho } from '@/src/lib/migalhas';
import { listEvents, listMunicipalities, listVenueNames } from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import type { EventCard } from '@/src/lib/queries/types';
import { aNome, deNome, urlDoSitio } from '@/src/lib/regiao';

/**
 * O cartaz A4 da semana de um concelho (C2-032, C4-022; plano 05, medida 14).
 *
 * `/cartaz-semanal/tomar` respondia 404, e imprimir a semana de um concelho
 * dava três a sete folhas de interface com os cartazes em caixas vazias. Esta
 * é a folha para a porta do café, da junta e da biblioteca: no ecrã, a
 * pré-visualização com o botão de imprimir; em papel, só a folha.
 *
 * A semana é a dos «Próximos 7 dias» da agenda, de hoje a daqui a seis dias
 * (`janelaDaSemana`) — a mesma janela do atalho, para a folha e a página dizerem
 * o mesmo. A folha guarda-se uma hora, como a página do concelho.
 */
export const revalidate = 3600;

interface Props {
  params: Promise<{ regiao: string; concelho: string }>;
}

/** Quantos eventos se leem de cada vez (o máximo que a leitura aceita). */
const POR_PAGINA = 100;
/** E até onde se vai: três páginas são trezentos eventos numa semana de um concelho. */
const PAGINAS = 3;

/**
 * A partir de quantas linhas a semana deixa de caber numa folha — à letra da
 * folha, em duas colunas, são umas quarenta. É uma conta por baixo, só para
 * avisar; quem decide as quebras é o navegador.
 */
const LINHAS_PARA_DUAS_FOLHAS = 40;

async function encontrarConcelho(regiaoId: string, id: string) {
  const concelhos = await listMunicipalities(regiaoId);
  return concelhos.find((concelho) => concelho.id === id) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId, concelho: id } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const concelho = await encontrarConcelho(regiao.id, id);
  if (!concelho) return { title: 'Concelho não encontrado' };
  return {
    title: `Cartaz da semana ${deNome(concelho.name, concelho.article)}`,
    description: `A programação dos próximos sete dias ${deNome(concelho.name, concelho.article)} numa folha A4, para imprimir e afixar, com o código QR para a agenda.`,
    // É a página do concelho em forma de folha: quem procura chega à página
    // do concelho, que é a que se mantém e a que se partilha.
    robots: { index: false, follow: true },
    alternates: { canonical: `/cartaz-semanal/${concelho.id}` },
  };
}

/** Os eventos da semana, todos — a folha não se corta para caber (ver `cartaz-semanal.ts`). */
async function eventosDaSemana(
  regiaoId: string,
  concelhoId: string,
  janela: { from: string; to: string },
): Promise<EventCard[]> {
  const eventos: EventCard[] = [];
  for (let pagina = 1; pagina <= PAGINAS; pagina++) {
    const { events, total } = await listEvents(regiaoId, {
      municipality: concelhoId,
      from: janela.from,
      to: janela.to,
      page: pagina,
      limit: POR_PAGINA,
    });
    eventos.push(...events);
    if (eventos.length >= total || events.length === 0) break;
  }
  return eventos;
}

export default async function CartazSemanalPage({ params }: Props) {
  const { regiao: regiaoId, concelho: id } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const concelho = await encontrarConcelho(regiao.id, id);
  if (!concelho) notFound();

  const hoje = todayInLisbon();
  const janela = janelaDaSemana(hoje);
  const [eventos, nomesDosEspacos] = await Promise.all([
    eventosDaSemana(regiao.id, concelho.id, janela),
    listVenueNames(regiao.id),
  ]);
  const sessoes = await listFeedSessions(
    eventos.map((evento) => evento.id),
    janela.from,
  );
  const cartaz = montarCartazDaSemana(eventos, sessoes, janela, nomesDosEspacos);
  const endereco = `${urlDoSitio(regiao, SITE_URL)}/concelho/${concelho.id}`;
  const deConcelho = deNome(concelho.name, concelho.article);

  return (
    <>
      <div className="ct-sem-impressao">
        <PageHeader
          migalhas={[
            ...migalhasDoConcelho(concelho),
            { href: `/cartaz-semanal/${concelho.id}`, label: 'Cartaz da semana' },
          ]}
          title={`Cartaz da semana ${deConcelho}`}
          lead="Uma folha A4 com o que há nos próximos sete dias, para afixar no café, na junta, na biblioteca ou no lar — com o código QR para a agenda, que está sempre atualizada."
        >
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <BotaoDeImprimir>Imprimir a folha</BotaoDeImprimir>
            <Link
              href={`/concelho/${concelho.id}`}
              className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            >
              Voltar {aNome(concelho.name, concelho.article)}
            </Link>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Imprime-se pelo menu do navegador, ou com Ctrl+P (⌘P num Mac): sai só a folha, a preto e
            branco.
            {cartaz.linhas > LINHAS_PARA_DUAS_FOLHAS
              ? ' É uma semana cheia: a folha continua numa segunda, e nada se corta para caber.'
              : ''}
          </p>
        </PageHeader>
      </div>

      <div className="mt-6 print:mt-0">
        <FolhaDaSemana
          regiao={regiao}
          concelho={concelho}
          cartaz={cartaz}
          endereco={endereco}
          hoje={hoje}
        />
      </div>
    </>
  );
}
