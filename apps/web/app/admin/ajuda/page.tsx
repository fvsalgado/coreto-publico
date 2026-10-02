import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { ambitoDoPainel } from '@/src/lib/admin/ambito';
import { exigirSessao } from '@/src/lib/admin/auth';
import { O_QUE_E_PROGRAMACAO, O_QUE_NAO_E_PROGRAMACAO } from '@/src/lib/admin/moderacao';
import { DE_QUEM_OPERA, PAPEIS, papelNaRegiao, type Papel } from '@/src/lib/admin/papeis';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Ajuda' };

const LIGACAO = 'underline underline-offset-4';

/**
 * A ajuda do painel: o que o papel de quem entra abre, e como se modera
 * (C4-025).
 *
 * O guia para a CIM (`docs/ENTRADA.md`) é para quem decide quem modera; esta
 * página é para quem modera, e está onde essa pessoa já está. Não repete o
 * guia: diz a cada pessoa o papel que tem em cada região, o que esse papel
 * abre — pelas mesmas palavras do guia, que vivem em `PAPEIS` —, e os quatro
 * gestos de todos os dias, cada um com a ligação para o sítio onde se faz.
 *
 * Não pede papel nenhum: uma conta ainda sem região também cá chega, e é a
 * essa que mais falta faz saber o que pedir e a quem.
 */
export default async function Ajuda() {
  const sessao = await exigirSessao();
  const dono = sessao.tipo === 'dono';

  // As regiões da pessoa, com o papel em cada uma. O dono vê tudo e não
  // precisa da lista; sem a chave de serviço só o dono entra.
  const regioes: Array<{ id: string; nome: string; papel: Papel }> = [];
  if (!dono && hasServiceRole) {
    const ambito = await ambitoDoPainel();
    for (const regiao of ambito.disponiveis) {
      const papel = papelNaRegiao(sessao.papeis, regiao.id);
      if (papel) regioes.push({ id: regiao.id, nome: regiao.name, papel });
    }
  }
  const gereAlguma = dono || regioes.some((regiao) => regiao.papel === 'gestor');

  return (
    <>
      <PageHeader
        title="Ajuda"
        lead="O que o teu papel abre, e como se modera. Tudo o que fazes no painel fica na auditoria, com o teu nome e o teu email."
      />

      <section aria-labelledby="o-teu-papel" className="mb-8 max-w-3xl">
        <h2 id="o-teu-papel" className="text-lg font-semibold">
          O teu papel
        </h2>
        {dono ? (
          <p className="mt-2">
            Entraste com a chave de quem opera o Coreto: vês e mexes em tudo, em todas as regiões.
          </p>
        ) : regioes.length === 0 ? (
          <p className="mt-2">
            Esta conta ainda não tem papel em nenhuma região. Pede um a quem te convidou para o
            painel — de editor, para moderar, ou de gestor, para gerir a região.
          </p>
        ) : (
          <dl className="mt-3 divide-y divide-border rounded border border-border">
            {regioes.map((regiao) => (
              <div key={regiao.id} className="grid gap-1 px-3 py-3 sm:grid-cols-[12rem_1fr]">
                <dt className="font-medium">
                  {regiao.nome}
                  <span className="block text-sm font-normal text-muted">
                    {PAPEIS[regiao.papel].nome}
                  </span>
                </dt>
                <dd className="text-sm">{PAPEIS[regiao.papel].pormenor}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="todos-os-dias" className="mb-8 max-w-3xl">
        <h2 id="todos-os-dias" className="text-lg font-semibold">
          Todos os dias
        </h2>
        <ul className="mt-2 space-y-3">
          <li>
            <Link href="/admin/fila" className={`font-medium ${LIGACAO}`}>
              A fila
            </Link>
            <p className="text-sm">
              O que chegou e ainda não está na agenda: por email, por programa, ou da recolha quando
              ela não se atreveu a publicar sozinha — o motivo está escrito em cada proposta. Abres
              uma, confrontas o que chegou com o formulário, e decides: publicar, fundir com um
              evento que já lá está, pedir o que falta a quem enviou, ou recusar.
            </p>
          </li>
          <li>
            <Link href="/admin/eventos" className={`font-medium ${LIGACAO}`}>
              Os eventos
            </Link>
            <p className="text-sm">
              Cada título abre a ficha do evento, onde se corrige o que está publicado, se tira da
              agenda e se junta um repetido. O que corriges fica trancado: a recolha seguinte não o
              volta a escrever por cima.
            </p>
          </li>
          <li>
            <Link href="/admin/fontes" className={`font-medium ${LIGACAO}`}>
              As fontes
            </Link>
            <p className="text-sm">
              As agendas que se leem, uma vez por dia, e o que se passa com cada uma.{' '}
              {gereAlguma
                ? 'Na ficha de uma fonte pões-na em pausa até um dia — o motivo aparece na página pública do estado —, voltas a tentá-la, ou desliga-la.'
                : 'Pôr uma fonte em pausa, voltar a tentá-la ou desligá-la é de quem gere a região: se uma precisar, diz-lho.'}
            </p>
          </li>
          <li>
            <Link href="/admin/espacos" className={`font-medium ${LIGACAO}`}>
              Os espaços
            </Link>
            <p className="text-sm">
              Os nomes de sítio que a recolha não reconheceu. Ligar um nome a um espaço que já
              existe faz-se uma vez, e os eventos que estavam à espera ganham mapa e ficha.
            </p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="a-regra" className="mb-8 max-w-3xl">
        <h2 id="a-regra" className="text-lg font-semibold">
          O que entra na agenda
        </h2>
        <p className="mt-2 text-sm">
          A agenda é de cultura. {O_QUE_E_PROGRAMACAO} Não entra a informação municipal —{' '}
          {O_QUE_NAO_E_PROGRAMACAO} —, que está nas agendas das câmaras e não é agenda cultural.
          Quando um título tem ar de aviso, a recolha não o publica sozinha: manda-o para a fila, e
          a proposta lembra a regra.
        </p>
        <p className="mt-2 text-sm text-muted">
          Quando a recolha arruma o texto de uma descrição — o título repetido, a tabela de datas —,
          o texto como veio da fonte está por baixo do campo, para comparares.
        </p>
      </section>

      <section aria-labelledby="de-quem-opera" className="max-w-3xl">
        <h2 id="de-quem-opera" className="text-lg font-semibold">
          O que é de quem opera o Coreto
        </h2>
        <p className="mt-2 text-sm">{DE_QUEM_OPERA}</p>
        {dono ? null : (
          <p className="mt-2 text-sm">
            Uma conta nova, uma fonte nova, um espaço que o catálogo não tem, um logótipo: pede-o a
            quem te convidou para o painel.
          </p>
        )}
      </section>
    </>
  );
}
