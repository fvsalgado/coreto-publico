import 'server-only';
import { regiaoDoSegredoDeBalanco } from '../admin/queries';
import { hasServiceRole } from '../env';
import { impressaoDoSegredo } from './token';

/**
 * Quem pode ver o balanço de que região.
 *
 * Três respostas e três códigos, e a diferença entre eles é o contrato de
 * segurança desta porta:
 *
 * - **Sem segredo → 401.** Não é «não existe»: é «falta a chave».
 * - **Com um segredo que não abre nada → 401.** O mesmo que sem segredo, de
 *   propósito. Um 403 dizia a quem tenta que o segredo existe e não serve
 *   aqui, e um 404 dizia que não existe — as duas são informação.
 * - **Com um segredo que abre outra região → 404 nessa outra.** Quem tem a
 *   chave do Médio Tejo e pede o Vale do Coreto recebe a mesma resposta que
 *   receberia se o Vale do Coreto não existisse. É o que impede a porta de
 *   ser um enumerador de regiões.
 *
 * O segredo em claro nunca sai daqui: o que segue para a base é a impressão.
 */
export type Veredicto =
  { estado: 'sem-chave' } | { estado: 'abre'; regiao: string } | { estado: 'outra-regiao' };

export async function quemAbre(
  segredo: string | null | undefined,
  regiaoPedida: string | null | undefined,
): Promise<Veredicto> {
  // Sem chave de serviço não há como confirmar nada, e não confirmar é não
  // deixar entrar. Uma porta que abre porque não conseguiu perguntar é pior
  // do que uma porta fechada.
  if (!hasServiceRole) return { estado: 'sem-chave' };

  const impressao = impressaoDoSegredo(segredo);
  if (!impressao) return { estado: 'sem-chave' };

  const regiao = await regiaoDoSegredoDeBalanco(impressao);
  if (!regiao) return { estado: 'sem-chave' };

  // Sem região pedida, abre a do segredo. É o caso normal: o endereço que se
  // envia por email já traz as duas coisas, mas o segredo é que manda.
  if (!regiaoPedida || regiaoPedida === regiao) return { estado: 'abre', regiao };

  return { estado: 'outra-regiao' };
}
