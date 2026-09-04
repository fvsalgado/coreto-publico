import 'server-only';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { SECCOES_OPCIONAIS, type SeccaoOpcional } from '../navegacao';
import { publicClient } from '../supabase/server';
import { CACHE_TAGS } from './events';
import { degradarForaDaCache, exigirLeitura } from './falhas';

/**
 * Que secções do sítio estão desligadas hoje.
 *
 * Lê-se em todas as páginas — é o layout de raiz que decide a navegação —, por
 * isso passa pela mesma cache com etiqueta que tudo o resto: uma leitura por
 * hora, e o interruptor do painel invalida a etiqueta na hora em que é
 * carregado. Sem isto, quatro linhas de base de dados custavam uma ida ao
 * Supabase por página servida.
 *
 * **Falha para o lado de mostrar.** Sem base de dados configurada, ou com a
 * leitura em erro, devolve «nenhuma desligada» e o sítio fica inteiro. O
 * contrário — assumir tudo desligado quando não se consegue ler — fazia
 * desaparecer quatro secções por causa de uma falha de rede, e a lição desta
 * casa é degradar em vez de rebentar.
 */
async function lerDesligadas(regiao: string): Promise<SeccaoOpcional[]> {
  const supabase = publicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('site_sections')
    .select('id')
    .eq('region_id', regiao)
    .eq('is_enabled', false);

  // A regra de cima não muda; o que muda é onde ela é aplicada. O erro sai
  // daqui, de dentro da cache, para não ficar guardado uma hora — e é o
  // `degradarForaDaCache` lá em baixo que devolve «nenhuma desligada».
  exigirLeitura('seccoesDesligadas', error);

  // Um identificador que o código não conhece é ignorado: a tabela pode ir à
  // frente do código durante um deploy, e uma secção que este build não sabe
  // desenhar não é uma secção que ele possa esconder.
  const conhecidas = new Set<string>(SECCOES_OPCIONAIS);
  return (data ?? [])
    .map((linha) => String((linha as { id: unknown }).id))
    .filter((id): id is SeccaoOpcional => conhecidas.has(id))
    .sort();
}

const lerDesligadasEmCache = unstable_cache(lerDesligadas, ['site-sections'], {
  tags: [CACHE_TAGS.sections],
  revalidate: 3600,
});

/**
 * **Degrada**, e a regra de degradação é a que já estava escrita: falha para o
 * lado de mostrar. O que se corrigiu foi o tempo de vida da falha.
 *
 * Antes, o `[]` de um erro ficava guardado uma hora como se fosse uma
 * resposta: uma CIM que acabasse de desligar a secção dos coretos via-a de
 * volta durante o resto dessa hora, sem nada na base de dados que o
 * explicasse. Agora o erro é apanhado do lado de fora: mostra-se tudo neste
 * pedido, e o pedido seguinte já volta a perguntar.
 *
 * Note-se que aqui o vazio não é uma afirmação sobre a região — é o estado
 * normal e esmagadoramente maioritário (quase nenhuma CIM desliga alguma
 * coisa). É isso que separa esta leitura das contagens que propagam.
 */
export const seccoesDesligadas = degradarForaDaCache(
  'seccoesDesligadas',
  lerDesligadasEmCache,
  () => [],
);

/** Se uma secção está de pé, na região desta página. */
export async function seccaoLigada(regiao: string, seccao: SeccaoOpcional): Promise<boolean> {
  return !(await seccoesDesligadas(regiao)).includes(seccao);
}

/**
 * O guarda de cada rota opcional, na primeira linha da página.
 *
 * Desligada quer dizer que o endereço não existe — 404 e não um aviso de
 * «página indisponível». Um 404 é a resposta verdadeira: quem desligou a
 * secção não quer que ela exista, e um motor de busca que a tenha indexada
 * tira-a do índice em vez de a manter com um recado.
 */
export async function exigirSeccao(regiao: string, seccao: SeccaoOpcional): Promise<void> {
  if (!(await seccaoLigada(regiao, seccao))) notFound();
}
