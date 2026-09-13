import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { LACUNAS_COM_COLUNA, listaDeTrabalho } from '@/src/lib/admin/lacunas';
import { compararQualidade, fimDoMesPassado, type MedidaComparada } from '@/src/lib/admin/memoria';
import {
  listEventsWithoutTime,
  qualityByMunicipality,
  qualityBySource,
  qualitySnapshotAte,
  type EventWithoutTimeRow,
  type QualityRow,
} from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Qualidade' };

/**
 * Sem casas decimais, de propósito.
 *
 * A decisão que estes números informam é «onde é que vale a pena mexer», e
 * para isso 62 e 62,4 dizem exatamente o mesmo. Uma casa decimal aqui é falsa
 * precisão sobre um catálogo que ainda está a encher.
 */
function percentagem(parte: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((parte / total) * 100)}%`;
}

/**
 * Uma célula que se pode carregar.
 *
 * A percentagem respondia a «como está?» e ficava por aí; a pergunta seguinte,
 * «então quais são os outros 38%?», não tinha resposta sem percorrer o
 * catálogo à mão. Agora a percentagem é a porta: leva à lista daqueles que
 * faltam, já recortada pelo concelho ou pela fonte da linha.
 *
 * Três casos, e nenhum deles é uma ligação:
 *
 * - **Sem catálogo** — a linha não tem eventos nenhuns. `—`, como antes.
 * - **Sem lacuna** — está tudo preenchido. Uma ligação para uma lista vazia
 *   parece uma avaria; sem ela, 100% lê-se como o que é.
 * - **Sem coluna de destino** — não acontece hoje, e o tipo garante que não
 *   passa a acontecer sem alguém dar por isso.
 *
 * O nome acessível não é «62%»: é «Hora, Tomar: 12 por corrigir de 32». Quem
 * navega por teclado ou lê a tabela com um leitor de ecrã recebe uma lista de
 * ligações, e uma lista de percentagens soltas não diz para onde nenhuma vai.
 */
function Celula({
  linha,
  lacuna,
  recorte,
}: {
  linha: QualityRow;
  lacuna: (typeof LACUNAS_COM_COLUNA)[number];
  recorte: 'concelho' | 'fonte';
}) {
  if (linha.in_catalogue === 0) return <span className="text-muted">—</span>;

  const tem = linha[lacuna.coluna];
  const falta = linha.in_catalogue - tem;
  const texto = percentagem(tem, linha.in_catalogue);
  if (falta <= 0) return <span className="text-muted">{texto}</span>;

  return (
    <Link
      href={listaDeTrabalho(lacuna.chave, { [recorte]: linha.id })}
      className="underline underline-offset-4"
      aria-label={`${lacuna.rotulo}, ${linha.name}: ${falta} por corrigir de ${linha.in_catalogue}`}
    >
      {texto}
    </Link>
  );
}

function Tabela({
  id,
  titulo,
  legenda,
  linhas,
  recorte,
}: {
  id: string;
  titulo: string;
  legenda: string;
  linhas: QualityRow[];
  recorte: 'concelho' | 'fonte';
}) {
  const total = linhas.reduce((soma, linha) => soma + linha.in_catalogue, 0);

  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-lg font-semibold">
        {titulo}
      </h2>
      <p className="mt-1 max-w-prose text-muted">{legenda}</p>

      <div
        className="mt-3 overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela, deslocável na horizontal"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">{legenda}</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2 pr-4">
                Nome
              </th>
              <th scope="col" className="py-2 pr-4">
                <abbr title="Eventos no sítio, à vista do público" className="no-underline">
                  Publicados
                </abbr>
              </th>
              <th scope="col" className="py-2 pr-4">
                <abbr
                  title="Recolhidos e à espera de que alguém os aprove. As percentagens contam sobre publicados mais estes."
                  className="no-underline"
                >
                  Por publicar
                </abbr>
              </th>
              {LACUNAS_COM_COLUNA.map((coluna) => (
                <th key={coluna.chave} scope="col" className="py-2 pr-4">
                  <abbr title={coluna.ajuda} className="no-underline">
                    {coluna.rotulo}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.id} className="border-b border-border">
                <th scope="row" className="py-2 pr-4 text-left font-normal">
                  {linha.name}
                </th>
                <td className="py-2 pr-4 tabular-nums">{linha.published}</td>
                <td className="py-2 pr-4 tabular-nums">{linha.pending}</td>
                {LACUNAS_COM_COLUNA.map((coluna) => (
                  <td key={coluna.chave} className="py-2 pr-4 tabular-nums">
                    <Celula linha={linha} lacuna={coluna} recorte={recorte} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-2 pr-4 text-left font-semibold">
                Total
              </th>
              <td className="py-2 pr-4 font-semibold tabular-nums">
                {linhas.reduce((soma, linha) => soma + linha.published, 0)}
              </td>
              <td className="py-2 pr-4 font-semibold tabular-nums">
                {linhas.reduce((soma, linha) => soma + linha.pending, 0)}
              </td>
              {/*
                O total não liga a lado nenhum, de propósito. Na tabela por
                fonte a soma deixa de fora os eventos sem fonte — a submissão
                por formulário não tem adaptador por trás —, e uma lista sem
                recorte traria esses também: mais linhas do que o número
                prometia, que é exatamente o defeito que estas ligações vieram
                fechar.
              */}
              {LACUNAS_COM_COLUNA.map((coluna) => (
                <td key={coluna.chave} className="py-2 pr-4 font-semibold tabular-nums">
                  {percentagem(
                    linhas.reduce((soma, linha) => soma + linha[coluna.coluna], 0),
                    total,
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/*
        A única coluna cuja lista não abre o que a percentagem conta. Dizer a
        diferença aqui é mais barato do que fazer quem clica descobri-la a
        contar linhas — e a `ressalva` vem de `lacunas.ts`, pelo que uma
        divergência nova tem de ser escrita antes de existir.
      */}
      {LACUNAS_COM_COLUNA.filter((coluna) => coluna.ressalva).map((coluna) => (
        <p key={coluna.chave} className="mt-2 max-w-prose text-sm text-muted">
          <strong className="font-medium">{coluna.rotulo}:</strong> {coluna.ressalva}
        </p>
      ))}
    </section>
  );
}

/**
 * Como estava no fim do mês passado, e como está hoje.
 *
 * A percentagem sozinha não responde a «está a melhorar?»: 62% só quer dizer
 * alguma coisa contra o 62% anterior, e antes da 0144 não havia anterior
 * nenhum. Agora há uma fotografia por noite, e esta secção compara a última
 * do mês passado com o catálogo de hoje.
 *
 * **Os dois números vão sempre juntos, e é o que faz isto ser honesto.** Uma
 * proporção a descer com o absoluto a subir é um catálogo a crescer mais
 * depressa do que o trabalho de o preencher — não é uma queda, e uma seta
 * vermelha sozinha chamava-lhe uma. Quem lê precisa dos dois para saber o que
 * aconteceu.
 */
function Memoria({ medidas, desde }: { medidas: MedidaComparada[]; desde: string }) {
  return (
    <section aria-labelledby="memoria" className="mt-8">
      <h2 id="memoria" className="text-lg font-semibold">
        Desde o fim do mês passado
      </h2>
      <p className="mt-1 max-w-prose text-muted">
        A fotografia de <span className="tabular-nums">{desde}</span> ao lado do catálogo de hoje. O
        catálogo passou de <span className="tabular-nums">{medidas[0]?.catalogoAntes ?? 0}</span>{' '}
        para <span className="tabular-nums">{medidas[0]?.catalogoAgora ?? 0}</span> eventos — e é
        por isso que a percentagem pode descer sem nada ter piorado.
      </p>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {medidas.map((medida) => (
          <li key={medida.chave} className="rounded border border-border px-3 py-2 text-sm">
            <span className="font-medium">{medida.rotulo}</span>{' '}
            <span className="tabular-nums">
              {medida.antes} → {medida.agora}
            </span>
            {medida.pcAntes === null || medida.pcAgora === null || medida.pontos === null ? null : (
              <>
                {/*
                  As duas percentagens à vista, e não só a diferença: quem faz
                  a conta de cabeça tem de chegar ao número que está escrito.
                  A diferença sai destas duas já arredondadas, pela mesma
                  razão — 62,5% escreve-se 63%, e −17 é o que se lê aqui.
                */}
                <span className="ml-2 text-muted tabular-nums">
                  {medida.pcAntes}% → {medida.pcAgora}%
                </span>
                <span className="ml-2 tabular-nums">
                  {/* O sinal escrito, e não uma seta: uma seta a vermelho num
                      número que subiu em absoluto lê-se como avaria. */}
                  {medida.pontos > 0 ? '+' : ''}
                  {medida.pontos} p.p.
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A percentagem diz se a agenda está a melhorar; não diz quais são os eventos
 * que faltam. Este é o número absoluto — só dos que ainda vão acontecer,
 * porque corrigir a hora de um que já passou não leva ninguém a lado nenhum —
 * e a ligação leva à lista, pronta a corrigir. É o passo entre saber e
 * resolver.
 */
function SemHora({ linhas, nomes }: { linhas: EventWithoutTimeRow[]; nomes: Map<string, string> }) {
  const porConcelho = new Map<string, number>();
  for (const linha of linhas) {
    porConcelho.set(linha.municipality_id, (porConcelho.get(linha.municipality_id) ?? 0) + 1);
  }
  const repartidos = [...porConcelho]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${nomes.get(id) ?? id} ${n}`)
    .join(' · ');

  return (
    <section aria-labelledby="sem-hora" className="mt-8">
      <h2 id="sem-hora" className="text-lg font-semibold">
        Sem hora
      </h2>
      {linhas.length === 0 ? (
        <p className="mt-1 max-w-prose text-muted">
          Todos os eventos que ainda vão acontecer dizem a que horas são.
        </p>
      ) : (
        <>
          <p className="mt-1 max-w-prose">
            <span className="font-semibold tabular-nums">{linhas.length}</span>{' '}
            {linhas.length === 1 ? 'evento' : 'eventos'} por vir sem hora em sessão nenhuma —
            publicados e por publicar.
          </p>
          <p className="mt-1 max-w-prose text-sm text-muted tabular-nums">{repartidos}</p>
          <p className="mt-2">
            <Link
              href="/admin/eventos?falta=hora&estado=todos"
              className="underline underline-offset-4"
            >
              Ver a lista, pronta a corrigir →
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

export default async function Qualidade() {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Qualidade" />;

  const fimDoPassado = fimDoMesPassado(new Date());
  const [porConcelho, porFonte, semHora, fotografia] = await Promise.all([
    qualityByMunicipality(),
    qualityBySource(),
    listEventsWithoutTime(),
    qualitySnapshotAte(fimDoPassado),
  ]);

  // Sem fotografia não há secção. Um mês sem memória escreve-se com a data da
  // primeira noite que a tirou, mais abaixo, em vez de aqui um zero que se
  // lia como «não mudou nada».
  const memoria = fotografia.length > 0 ? compararQualidade(fotografia, porConcelho) : null;

  return (
    <>
      <PageHeader
        title="Qualidade"
        lead="Não quantos eventos há — quantos deles dizem a que horas, onde e com que imagem. É a diferença entre uma montra e um depósito."
      />

      {/*
        Um concelho com quarenta eventos sem hora é pior do que um com dez que
        dizem a que horas. Sem esta medida os dois pareciam iguais, e a única
        pergunta que o projeto sabia responder era «quantos?».
      */}
      <Tabela
        id="por-concelho"
        titulo="Por concelho"
        legenda="O que está preenchido no catálogo, concelho a concelho — publicado e por publicar, porque a recolha escreve rascunhos e é uma pessoa que os aprova. Um concelho a zero não é um defeito escondido: é o que ainda não entrou. Cada percentagem abre a lista dos que faltam nesse concelho."
        linhas={porConcelho}
        recorte="concelho"
      />

      <Tabela
        id="por-fonte"
        titulo="Por fonte"
        legenda="A mesma medida por fonte. É por aqui que se vê qual adaptador está a deixar por trazer um campo que a página do lado de lá tem — e por isso conta o catálogo todo: um adaptador não aprova nada. Cada percentagem abre a lista dos que faltam nessa fonte."
        linhas={porFonte}
        recorte="fonte"
      />

      {memoria ? (
        <Memoria medidas={memoria} desde={fotografia[0]?.taken_on ?? fimDoPassado} />
      ) : (
        <section aria-labelledby="memoria" className="mt-8">
          <h2 id="memoria" className="text-lg font-semibold">
            Desde o fim do mês passado
          </h2>
          <p className="mt-1 max-w-prose text-muted">
            Ainda não há fotografia nenhuma até {fimDoPassado}. A medida de qualidade passou a
            guardar uma por noite a partir da migração 0144; os meses anteriores ficam sem memória,
            e recuar a de hoje para eles era escrever sobre um mês um número que ninguém leu nele.
          </p>
        </section>
      )}

      <SemHora
        linhas={semHora}
        nomes={new Map(porConcelho.map((linha) => [linha.id, linha.name]))}
      />
    </>
  );
}
