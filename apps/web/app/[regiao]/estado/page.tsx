import type { Metadata } from 'next';
import Link from 'next/link';
import { FALHAS_ATE_PAUSA, HORAS_EM_PAUSA } from '@coreto/core';
import { PageHeader } from '@/src/components/PageHeader';
import {
  avaliarAgenda,
  avaliarRecolha,
  familiasCaladas,
  fraseDaFonte,
  resumoParaQuemVisita,
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
    'Se a agenda está a ser alimentada: que agendas lemos em dia, quais não conseguimos ler e desde quando, quantos eventos há marcados e que concelhos estão sem nada.',
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

/**
 * Um contador, com o rótulo no número certo. Lê-se de seguida — «1 por ler»,
 * «31 em dia» —, e é assim que um leitor de ecrã o diz.
 *
 * O rótulo era uma sobrancelha em maiúsculas espaçadas, a mesma para os quatro
 * mosaicos: «31 EM DIA» e «9 PARADAS» com o mesmo desenho, e nada a separar o
 * que está bem do que falta (C1-024). Em caixa de frase lê-se, e a ordem dos
 * mosaicos — em dia primeiro — faz o resto sem cor nenhuma.
 */
function Numero({ valor, rotulo }: { valor: number; rotulo: readonly [string, string] }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="ct-numeral text-3xl">{valor}</p>
      <p className="mt-0.5 text-sm text-muted">{valor === 1 ? rotulo[0] : rotulo[1]}</p>
    </div>
  );
}

/**
 * O octógono da planta de um coreto, cheio para o que está em dia e só com o
 * contorno para o que falta. É enfeite — o rótulo ao lado diz tudo —, e por
 * isso fica escondido de quem ouve a página.
 */
function Marca({ cheia }: { cheia: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5 shrink-0 text-accent">
      <polygon
        points="3,0.75 7,0.75 9.25,3 9.25,7 7,9.25 3,9.25 0.75,7 0.75,3"
        fill={cheia ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

interface Lido {
  recolha: EstadoDaRecolha;
  agenda: EstadoDaAgenda;
  concelhos: Array<{ id: string; name: string }>;
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
    lido = {
      recolha: avaliarRecolha(fontes),
      agenda: avaliarAgenda(concelhos, contagens),
      concelhos,
    };
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
          <p className="font-display mt-1 text-xl leading-relaxed font-semibold">
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
  const resumo = resumoParaQuemVisita(recolha, agenda, lido.concelhos, {
    demonstracao: regiao.tipo === 'montra',
  });
  /*
   * Todas as que não estão em dia, e não só as que alguém tem de arranjar.
   *
   * A lista dizia «o que está por ler» e mostrava as paradas e as atrasadas;
   * as por estrear e as em pausa ficavam de fora, e o motivo de uma pausa —
   * que é a única coisa que quem lê quer saber dela — não aparecia em lado
   * nenhum. O resumo de cima manda para aqui, e aqui estão as quatro.
   */
  const porLer = [
    ...recolha.paradas,
    ...recolha.atrasadas,
    ...recolha.porEstrear,
    ...recolha.emPausa,
  ];
  /*
   * As agendas que se calaram quase todas ao mesmo tempo.
   *
   * Fala antes da lista de propósito: `DIAS_ATE_ATRASO` tolera duas noites
   * falhadas — e faz bem, uma noite não é uma avaria —, mas foi essa
   * tolerância que deixou esta página chamar «em dia» a oito fontes que não
   * respondiam a pedido nenhum havia duas noites. Oito domínios a calarem-se
   * na mesma noite não são oito avarias: é uma.
   */
  const familias = familiasCaladas(recolha);
  const porLerComMarca = new Set(['por-ler', 'incompleto', 'sem-nada', 'em-pausa']);

  return (
    <article className="max-w-2xl">
      <PageHeader
        title="Estado"
        eyebrow="O funcionamento"
        lead={`Se a agenda ${regiao.doNome} está a ser alimentada: que agendas lemos em dia, quais não conseguimos ler, e quanta programação há daqui para a frente.`}
        migalhas={migalhas}
      />

      {/*
       * O resumo, por esta ordem: quanta programação há, o que está em dia, e
       * só depois o que falta — dito pelo efeito em quem procura programação.
       *
       * Era uma caixa de moldura preta de dois píxeis com «PARADO» por cima e
       * a frase do alarme de quem administra («A pausa de 8 fontes acabou e
       * ninguém as renovou»), a moldura mais forte do sítio para uma frase que
       * soava a abandono (C4-023, C1-024). O alarme continua no `/estado.json`,
       * que é para onde a sonda olha; aqui fala-se a quem visita. Sem cor de
       * estado — a casa não a tem, e a cor nunca é o único portador de
       * significado (WCAG 1.4.1): o rótulo de cada linha diz o que ela é, e
       * o que falta leva um marcador ao lado do rótulo.
       */}
      <section aria-labelledby="resumo" className="rounded-lg border border-border bg-surface p-5">
        <h2 id="resumo" className="font-display text-xl leading-snug font-semibold">
          {resumo.titulo}
        </h2>
        {resumo.linhas.length > 0 ? (
          <dl className="mt-4 space-y-3 border-t border-border pt-4">
            {resumo.linhas.map((linha) => (
              <div key={linha.rotulo} className="sm:grid sm:grid-cols-[13rem_1fr] sm:gap-x-4">
                <dt className="flex items-baseline gap-2 font-medium">
                  <Marca cheia={!porLerComMarca.has(linha.tipo)} />
                  {linha.rotulo}
                </dt>
                <dd className="mt-0.5 text-muted sm:mt-0">
                  {linha.texto.charAt(0).toUpperCase() + linha.texto.slice(1)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {regiao.tipo === 'montra' && recolha.vigiadas.length === 0 ? null : (
        <section aria-labelledby="recolha" className="mt-10">
          <h2 id="recolha" className="ct-heading">
            As agendas que lemos
          </h2>
          {/*
           * A cadência conta-se em dias, e a diferença não é de estilo.
           *
           * Aqui prometia-se uma recolha noturna. O cron do `scrape.yml` está
           * às 03:20 UTC, mas a fila de execuções agendadas do GitHub atrasa-o
           * horas — as execuções medidas arrancaram às 07:58, 08:26, 10:11 e
           * 15:28 UTC. Numa página cujo trabalho inteiro é dizer a verdade
           * sobre o estado da agenda, uma frase que a produção desmente
           * desconta todas as que estão ao lado. A cadência cumpre-se e
           * escreve-se; a hora não se promete enquanto o disparo não for nosso
           * (ver `docs/OPERACAO.md`).
           */}
          <p className="mt-2 text-muted">
            Lemos as agendas das câmaras, das juntas de freguesia e das salas uma vez por dia. Uma
            agenda que falhe {FALHAS_ATE_PAUSA} dias seguidos descansa {HORAS_EM_PAUSA} horas e
            volta a ser tentada — é o que impede um sítio em manutenção de ficar esquecido.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Numero valor={recolha.emDia.length} rotulo={['em dia', 'em dia']} />
            <Numero
              valor={recolha.paradas.length + recolha.atrasadas.length + recolha.porEstrear.length}
              rotulo={['por ler', 'por ler']}
            />
            {recolha.emPausa.length > 0 ? (
              <Numero valor={recolha.emPausa.length} rotulo={['em pausa', 'em pausa']} />
            ) : null}
          </div>

          {familias.length > 0 ? (
            <div className="mt-6 border-l-2 border-highlight pl-4">
              <h3 className="text-base font-semibold">Uma causa só, e não várias avarias</h3>
              {familias.map((familia) => (
                <p key={familia.adapter} className="mt-2">
                  {familia.caladas === familia.total
                    ? `As ${familia.total} agendas que usam o mesmo sistema de publicação`
                    : `${familia.caladas} das ${familia.total} agendas que usam o mesmo sistema de publicação`}{' '}
                  deixaram de nos dar eventos ao mesmo tempo: {joinPt(familia.nomes)}. Quando
                  agendas que só têm em comum o sistema em que são publicadas se calam juntas, a
                  causa costuma ser uma só, do lado de quem as publica — e resolve-se a falar com
                  quem as gere, não a insistir daqui.
                </p>
              ))}
            </div>
          ) : null}

          {porLer.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-base font-semibold">O que está por ler</h3>
              <ul className="mt-2">
                {porLer.map((fonte) => (
                  <LinhaDaFonte key={fonte.id} fonte={fonte} />
                ))}
              </ul>
            </div>
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
      )}

      <section aria-labelledby="agenda" className="mt-12">
        <h2 id="agenda" className="ct-heading">
          A agenda
        </h2>
        <p className="mt-2 text-muted">
          É a outra metade da pergunta: uma agenda pode ser lida todos os dias e não trazer eventos,
          porque a página de quem a publica mudou de forma. Por isso contamos também o que está
          marcado.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Numero valor={agenda.total} rotulo={['evento por vir', 'eventos por vir']} />
          <Numero
            valor={agenda.vazios.length}
            rotulo={['concelho sem nada marcado', 'concelhos sem nada marcado']}
          />
        </div>
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
            <strong className="text-ink">Agendas desligadas não contam.</strong> Desligar uma agenda
            é uma decisão de quem administra — o sítio fechou, o município pediu —, e não uma
            avaria. Contá-la como por ler era encher esta página de alarmes que ninguém vai
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
