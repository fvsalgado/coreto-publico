import type { Metadata } from 'next';
import Link from 'next/link';
import { FALHAS_ATE_PAUSA, HORAS_EM_PAUSA } from '@coreto/core';
import { PageHeader } from '@/src/components/PageHeader';
import {
  avaliarAgenda,
  avaliarRecolha,
  familiasCaladas,
  fraseDaFonte,
  veredito,
  type EstadoDaAgenda,
  type EstadoDaRecolha,
  type FonteComSaude,
} from '@/src/lib/estado';
import { formatLongDate, joinPt } from '@/src/lib/format';
import {
  countEventsByMunicipality,
  listMunicipalities,
  listPublicSources,
} from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import { reportarErro } from '@/src/lib/registo';

export const metadata: Metadata = {
  title: 'Estado',
  description:
    'Se a agenda está a ser alimentada: quando é que cada fonte foi lida com sucesso pela última vez, quantos eventos há marcados e que concelhos estão a zero.',
  alternates: { canonical: '/estado' },
  /*
   * Fora dos motores de busca, e é decisão e não esquecimento.
   *
   * Esta página muda de hora a hora e fala de avarias. Indexada, o que fica
   * guardado é um resumo com «há três fontes paradas» colado ao nome da
   * região, meses depois de estarem arranjadas — e a competir, nas buscas
   * pelo nome da CIM, com as páginas que interessam a quem procura
   * programação. Quem precisa disto chega por ligação: está no rodapé de
   * todas as páginas e no guia que se entrega a cada CIM nova.
   *
   * `follow`, porque as ligações daqui para as fontes e para os concelhos são
   * ligações boas — o que não se quer é esta página no índice, não é que ela
   * deixe de passar caminho.
   */
  robots: { index: false, follow: true },
};

/**
 * O estado da casa, à vista de quem paga por ela.
 *
 * É a primeira coisa que uma CIM procura quando desconfia de que a agenda
 * dela parou, e a alternativa a esta página é o telefone a tocar. Responde a
 * uma pergunta e a uma só: **a agenda desta região está a ser alimentada?**
 *
 * **O que esta página não pode responder — e diz que não pode.** «O sítio
 * está de pé» não se responde de dentro do sítio: se a Vercel estiver em
 * baixo, ou o DNS mal resolvido, isto não responde e o silêncio é a única
 * informação disponível. Uma página de estado alojada no que ela própria
 * vigia é uma promessa que se parte exatamente quando conta. O que vigia de
 * fora é a sonda externa (`docs/INFRAESTRUTURA.md`), e é isso que a última
 * secção manda ler em vez de deixar a ideia por dizer.
 *
 * Os números vêm da mesma cache de uma hora que as outras páginas usam, e a
 * página diz isso. Um estado que se apresenta ao segundo quando é de há
 * cinquenta minutos é pior do que um estado datado.
 */

export const revalidate = 3600;

const CAMINHO = '/estado';

/**
 * Uma linha por fonte: o nome, e o que se sabe da última leitura.
 *
 * A frase vem de `estado.ts` e é a mesma que a `/fontes` escreve, palavra a
 * palavra. Aqui esteve uma variante — «Última leitura boa a …» — que dizia
 * quase a mesma coisa noutras palavras e escondia o caso que interessa: uma
 * fonte lida todas as noites que não traz nada há duas semanas lia-se igual a
 * uma fonte que ninguém tenta ler há duas semanas.
 */
function LinhaDaFonte({ fonte }: { fonte: FonteComSaude }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border py-2 last:border-b-0">
      <span className="font-medium">{fonte.name}</span>
      <span className="text-sm text-muted">
        {fraseDaFonte(fonte, (iso) => formatLongDate(iso))}
      </span>
    </li>
  );
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="font-display text-3xl font-semibold tabular-nums">{valor}</p>
      <p className="ct-eyebrow mt-0.5">{rotulo}</p>
    </div>
  );
}

interface Lido {
  recolha: EstadoDaRecolha;
  agenda: EstadoDaAgenda;
}

export default async function EstadoPage({ params }: { params: Promise<{ regiao: string }> }) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  /*
   * Sem `exigirSeccao`: esta página não é de secção nenhuma e não se desliga.
   * Uma CIM que desligue as fontes no painel continua a precisar de saber se a
   * agenda dela está a encher — e é ela quem desliga, não quem se esconde.
   */
  const haFontes = await seccaoLigada(regiao.id, 'fontes');

  /*
   * **A leitura falhar é uma resposta, não um 500.**
   *
   * Todas as outras páginas desta casa podem rebentar quando a base não
   * responde — é o comportamento certo lá, porque uma agenda vazia por avaria
   * mente a quem visita. Aqui é ao contrário: «não consigo ler a base de
   * dados» é literalmente o estado que esta página existe para publicar, e um
   * 500 no seu lugar é a página a falhar precisamente na hora em que alguém
   * foi lá ver o que se passava.
   */
  let lido: Lido | null = null;
  try {
    const [fontes, concelhos, contagens] = await Promise.all([
      listPublicSources(regiao.id),
      listMunicipalities(regiao.id),
      countEventsByMunicipality(regiao.id),
    ]);
    lido = { recolha: avaliarRecolha(fontes), agenda: avaliarAgenda(concelhos, contagens) };
  } catch (causa) {
    reportarErro('EstadoPage', causa, { regiao: regiao.id });
  }

  const migalhas = [
    { href: '/', label: 'Coreto' },
    { href: CAMINHO, label: 'Estado' },
  ];

  if (!lido) {
    return (
      <article className="max-w-2xl">
        <PageHeader
          title="Estado"
          eyebrow="O funcionamento"
          lead={`Se a agenda ${regiao.doNome} está a ser alimentada.`}
          migalhas={migalhas}
        />
        <div className="rounded-lg border-2 border-border bg-surface p-5">
          <p className="ct-eyebrow">Sem resposta</p>
          <p className="font-display mt-1 text-xl font-semibold">
            A base de dados não respondeu a esta página.
          </p>
          <p className="mt-3 text-muted">
            É a própria avaria a ser publicada: não há números para mostrar porque não foi possível
            lê-los. As páginas da agenda podem estar a servir o que já tinham em cache — o que não
            está garantido é que estejam a mostrar o que a base tem hoje.
          </p>
          {regiao.email ? (
            <p className="mt-3 text-muted">
              Se isto se mantiver, escreva para{' '}
              <a href={`mailto:${regiao.email}`} className="underline underline-offset-4">
                {regiao.email}
              </a>
              .
            </p>
          ) : null}
        </div>
      </article>
    );
  }

  const { recolha, agenda } = lido;
  const parecer = veredito(recolha, agenda);
  const porArranjar = [...recolha.paradas, ...recolha.atrasadas];
  /*
   * Os leitores cujas fontes se calaram quase todas ao mesmo tempo.
   *
   * Isto está acima do «o que está por ler» de propósito, e fala antes de a
   * saúde individual falar: `DIAS_ATE_ATRASO` tolera duas noites falhadas — e
   * faz bem, uma noite não é uma avaria —, mas foi essa tolerância que deixou
   * esta página chamar «em dia» a oito fontes que não respondiam a pedido
   * nenhum havia duas noites. Oito domínios a calarem-se na mesma noite não são
   * oito avarias: é uma.
   */
  const familias = familiasCaladas(recolha);

  return (
    <article className="max-w-2xl">
      <PageHeader
        title="Estado"
        eyebrow="O funcionamento"
        lead={`Se a agenda ${regiao.doNome} está a ser alimentada: quando é que cada fonte foi lida pela última vez, e quanta programação há daqui para a frente.`}
        migalhas={migalhas}
      />

      {/*
       * O veredito não se diz só pela cor — nem sequer tem cor. É uma regra de
       * acessibilidade (WCAG 1.4.1: a cor nunca é o único portador de
       * significado) e é também o que esta paleta permite: a casa não tem
       * vermelho nem verde de estado, e inventá-los aqui era abrir um caminho
       * que o resto do sítio não segue. A palavra em cima diz tudo o que a cor
       * diria, e a moldura mais grossa marca o que precisa de alguém.
       */}
      <div
        className={`rounded-lg bg-surface p-5 ${parecer.grau === 'bom' ? 'border border-border' : 'border-2 border-ink'}`}
      >
        <p className="ct-eyebrow">
          {parecer.grau === 'bom' ? 'Em ordem' : parecer.grau === 'atencao' ? 'Atenção' : 'Parado'}
        </p>
        <p className="font-display mt-1 text-xl font-semibold">{parecer.frase}</p>
      </div>

      <section aria-labelledby="recolha" className="mt-10">
        <h2 id="recolha" className="ct-heading">
          A recolha
        </h2>
        {/*
         * A cadência conta-se em dias, e a diferença não é de estilo.
         *
         * Aqui prometia-se uma recolha noturna. O cron do `scrape.yml` está às
         * 03:20 UTC, mas a fila de execuções agendadas do GitHub atrasa-o
         * horas — as execuções medidas arrancaram às 07:58, 08:26, 10:11 e
         * 15:28 UTC. Numa página cujo trabalho inteiro é dizer a verdade sobre
         * o estado da agenda, uma frase que a produção desmente desconta todas
         * as que estão ao lado. A cadência cumpre-se e escreve-se; a hora não
         * se promete enquanto o disparo não for nosso (ver `docs/OPERACAO.md`).
         */}
        <p className="mt-2 text-muted">
          A recolha corre uma vez por dia. Uma fonte que falhe {FALHAS_ATE_PAUSA} dias seguidos
          entra em pausa e volta a ser tentada {HORAS_EM_PAUSA} horas depois — é o que impede um
          portal em manutenção de se tornar um portal esquecido.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero valor={recolha.emDia.length} rotulo="em dia" />
          <Numero valor={recolha.atrasadas.length} rotulo="atrasadas" />
          <Numero valor={recolha.paradas.length} rotulo="paradas" />
          <Numero valor={recolha.porEstrear.length} rotulo="por estrear" />
        </div>

        {familias.length > 0 ? (
          <div className="mt-6 rounded-lg border-2 border-ink bg-surface p-5">
            <p className="ct-eyebrow">Um padrão, e não uma lista</p>
            {familias.map((familia) => (
              <p key={familia.adapter} className="mt-2">
                <span className="font-medium">
                  {familia.caladas} das {familia.total} fontes lidas por{' '}
                  <code className="font-mono text-[0.95em]">{familia.adapter}</code> foram tentadas
                  e não trouxeram nada.
                </span>{' '}
                {joinPt(familia.nomes)}. Quando fontes que não têm nada em comum senão o produto que
                as serve se calam ao mesmo tempo, o mais provável é o problema estar de um lado só —
                e isso resolve-se a falar com quem as publica, não a insistir daqui.
              </p>
            ))}
          </div>
        ) : null}

        {porArranjar.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-base font-semibold">O que está por ler</h3>
            <ul className="mt-2">
              {porArranjar.map((fonte) => (
                <LinhaDaFonte key={fonte.id} fonte={fonte} />
              ))}
            </ul>
          </div>
        ) : null}

        {recolha.porEstrear.length > 0 ? (
          <p className="mt-4 text-sm text-muted">
            «Por estrear» são fontes ligadas que ainda não tiveram uma leitura boa — normal numa
            região acabada de nascer, e um sinal se durar. Não são fontes paradas: nunca chegaram a
            arrancar.
          </p>
        ) : null}

        {haFontes ? (
          <p className="mt-4 text-sm text-muted">
            A lista completa, com o endereço de cada uma, está em{' '}
            <Link href="/fontes" className="underline underline-offset-4">
              de onde vêm os eventos
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section aria-labelledby="agenda" className="mt-12">
        <h2 id="agenda" className="ct-heading">
          A agenda
        </h2>
        <p className="mt-2 text-muted">
          É a outra metade da pergunta, e a que apanha o que a primeira deixa passar: uma fonte pode
          ser lida todos os dias com sucesso e trazer zero eventos porque a página da câmara mudou
          de forma. A recolha diz «li»; só a contagem diz «li e não veio nada».
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Numero valor={agenda.total} rotulo="eventos por vir" />
          <Numero valor={agenda.vazios.length} rotulo="concelhos a zero" />
        </div>

        {agenda.vazios.length > 0 ? (
          <p className="mt-4">Sem nada marcado daqui para a frente: {joinPt(agenda.vazios)}.</p>
        ) : null}
      </section>

      <section aria-labelledby="limites" className="mt-12 border-t border-border pt-6">
        <h2 id="limites" className="ct-heading">
          O que esta página não sabe
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            <strong className="text-ink">Não diz se o sítio está de pé.</strong> Está alojada nos
            mesmos servidores que vigia: se eles caírem, esta página cai com eles, e o silêncio é a
            única informação que sobra. Quem vigia de fora é uma sonda independente, que corre de
            cinco em cinco minutos e avisa por outro caminho — não por aqui.
          </p>
          <p>
            <strong className="text-ink">Os números são de há menos de uma hora</strong>, não deste
            instante. Vêm da mesma cache que serve o resto do sítio; recarregar não os aproxima.
          </p>
          <p>
            <strong className="text-ink">Fontes desligadas não contam.</strong> Uma fonte desligada
            no painel é uma decisão de quem administra — o portal fechou, o município pediu —, e não
            uma avaria. Contá-la como parada era encher esta página de alarmes que ninguém vai
            arranjar.
          </p>
          <p>
            <strong className="text-ink">Isto também se lê por máquina.</strong> Os mesmos números
            estão em{' '}
            <a href="/estado.json" className="underline underline-offset-4">
              /estado.json
            </a>
            , com os nomes dos campos fixos — é o que uma sonda de vigilância consome sem depender
            das palavras desta página. Responde 503, e não 200, quando não consegue ler a base.
          </p>
        </div>
      </section>
    </article>
  );
}
