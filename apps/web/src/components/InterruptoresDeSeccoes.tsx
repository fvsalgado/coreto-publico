import { alternarSeccao } from '@/src/lib/admin/actions';
import type { SiteSectionRow } from '@/src/lib/admin/queries';
import { MAIS, type SeccaoOpcional } from '@/src/lib/navegacao';

/**
 * Os interruptores das secções de uma região, para o backoffice.
 *
 * Desenham-se em dois sítios — o painel de entrada, para a região principal,
 * e a página de cada região — e são o mesmo componente de propósito: dois
 * blocos de formulários mantidos à mão divergiam no dia em que um ganhasse um
 * aviso que o outro não tem. Quem muda de sítio é só o campo `regiao`, que a
 * ação usa para escrever na linha certa e para voltar à página certa.
 */

/**
 * As secções que se ligam e desligam, com o nome e a linha que a gaveta do
 * telemóvel já lhes dá.
 *
 * Sai de `MAIS` e não de uma lista escrita aqui: são as mesmas quatro páginas,
 * com os mesmos nomes, e duas listas do mesmo mapa mantidas à mão divergem
 * sempre — é o engano que o rodapé já cometeu uma vez.
 */
const SECCOES = MAIS.filter(
  (atalho): atalho is (typeof MAIS)[number] & { seccao: SeccaoOpcional } =>
    atalho.seccao !== undefined,
);

/**
 * O aviso que só uma delas leva.
 *
 * As informações são a única secção cujo conteúdo não desaparece todo com o
 * interruptor. A declaração de acessibilidade e a política de privacidade
 * viveram lá dentro, e este aviso dizia que desligar as escondia — o
 * Decreto-Lei n.º 83/2018 quer a declaração alcançável de qualquer página, e
 * o RGPD quer a informação de tratamento à vista de quem envia um email. Hoje
 * têm página própria, `/privacidade` e `/acessibilidade`, sem interruptor; e
 * a menção do cofinanciamento passa para o rodapé quando a página não existe.
 * Quem carrega no botão deve saber o que esconde e o que fica de pé, e não
 * descobri-lo depois.
 */
const AVISOS: Partial<Record<SeccaoOpcional, string>> = {
  informacoes:
    'Desligar esconde o que é o Coreto, o nome, como funciona e o contacto; a menção do ' +
    'cofinanciamento passa para o rodapé. A política de privacidade e a declaração de ' +
    'acessibilidade não se desligam: ficam em /privacidade e em /acessibilidade.',
};

function quandoEQuem(linha: { updated_at: string; updated_by: string | null }): string {
  const dia = linha.updated_at.slice(0, 10).split('-').reverse().join('/');
  return linha.updated_by ? `${dia}, por ${linha.updated_by}` : dia;
}

/*
 * O bloco «O SQL que repõe este estado» saiu daqui (C4-018): era a primeira
 * coisa técnica que o painel punha à frente de quem gere uma região, e a quem
 * opera serve-lhe melhor uma consulta que o gera a partir da base — está em
 * `docs/OPERACAO.md`, «Semear numa migração o estado das secções».
 */
interface Props {
  regiao: string;
  seccoes: SiteSectionRow[];
}

export function InterruptoresDeSeccoes({ regiao, seccoes }: Props) {
  const estadoDaSeccao = new Map(seccoes.map((linha) => [linha.id, linha]));

  return (
    <>
      <ul className="mt-3 border-y border-border">
        {SECCOES.map((seccao) => {
          const linha = estadoDaSeccao.get(seccao.seccao);
          const ligada = linha?.is_enabled ?? true;
          const aviso = AVISOS[seccao.seccao];

          return (
            <li
              key={seccao.seccao}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {seccao.label} <span className="text-muted">{seccao.href}</span>
                </p>
                <p className="text-sm text-muted">{seccao.nota}</p>
                {!ligada && linha ? (
                  <p className="text-sm text-highlight">Desligada em {quandoEQuem(linha)}.</p>
                ) : null}
                {aviso ? <p className="mt-0.5 max-w-xl text-sm text-muted">{aviso}</p> : null}
              </div>

              <form action={alternarSeccao} className="flex items-center gap-3">
                <input type="hidden" name="seccao" value={seccao.seccao} />
                <input type="hidden" name="ligar" value={ligada ? '0' : '1'} />
                <input type="hidden" name="regiao" value={regiao} />
                <span className={`text-sm ${ligada ? '' : 'text-highlight'}`}>
                  {ligada ? 'Ligada' : 'Desligada'}
                </span>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center rounded border border-border px-3 text-sm font-medium hover:bg-surface"
                >
                  {ligada ? 'Desligar' : 'Ligar'}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
