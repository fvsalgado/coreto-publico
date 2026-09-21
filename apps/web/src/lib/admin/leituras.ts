import 'server-only';
import { requireAdmin } from './auth';
import { requireAdminClient } from '../supabase/server';

/**
 * O rasto de quem **leu** a fila, e não só de quem lá mexeu.
 *
 * A 0006 escreveu a regra das escritas com todas as letras: «não há caminho
 * para publicar que não deixe rasto». Das leituras não dizia nada, e isso era
 * uma lacuna real, porque a fila de moderação é o sítio desta casa onde estão
 * os dados pessoais: o endereço de quem enviou, o texto em bruto do email, o
 * hash do IP, os anexos. Abrir uma submissão, ler o email de quem a mandou e
 * fechar a página não deixava vestígio nenhum — e uma sessão roubada, ou uma
 * palavra-passe partilhada de mais, não deixava forma de saber **o que é que
 * foi visto**. Com o registo, a pergunta passa a ter resposta.
 *
 * O prefixo `leitura.` não é cosmético: é o que separa, na auditoria, o
 * registo de acessos do registo de decisões. Uma fila aberta vinte vezes por
 * dia afogaria as ações de moderação se ambos vivessem na mesma lista sem
 * distinção — e uma auditoria ilegível é uma auditoria que não se abre.
 *
 * **Regista-se o pedido, antes da leitura, e não o resultado.** É o que um
 * registo de acessos faz: guarda quem pediu o quê. Assim há rasto mesmo
 * quando a leitura falha a seguir, e uma tentativa de ler uma submissão que
 * não existe — que é como se sonda uma base à mão — fica registada na mesma.
 * O que não se guarda é o conteúdo lido: seria copiar os dados pessoais para
 * uma segunda tabela, com um prazo de conservação mais longo do que o deles.
 */
export const PREFIXO_DE_LEITURA = 'leitura.';

/**
 * Escreve a linha de acesso, ou impede a leitura.
 *
 * **Fecha em vez de degradar, e é uma decisão.** A regra da casa é a do
 * middleware — «o público degrada, a segurança fecha» —, e um registo de
 * acessos que se salta a si próprio quando a base tropeça é um registo que não
 * se pode usar para responder à única pergunta que justifica tê-lo. O custo é
 * pequeno e conhecido: as leituras do painel já atiram quando a base falha
 * (`exigirLeitura`), o erro sobe ao `app/admin/error.tsx`, que mostra a
 * mensagem e oferece «tentar de novo». E a base é a mesma para as duas coisas
 * — se o registo não escreve, a leitura a seguir também não ia ler.
 *
 * O `requireAdmin()` aqui é a terceira barreira, depois do middleware e do
 * layout, e é a primeira que as **leituras** têm do seu lado: até aqui só as
 * escritas a tinham. Não é desconfiança das outras duas — é a mesma doutrina
 * que pôs o layout a reverificar o que o middleware já tinha verificado.
 */
export async function registarLeitura(
  acao: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const { error } = await supabase.rpc('log_admin_action', {
    p_actor: actor,
    p_action: `${PREFIXO_DE_LEITURA}${acao}`,
    p_entity_type: entityType,
    p_entity_id: entityId,
  });

  if (error) throw new Error(`não foi possível registar a leitura: ${error.message}`);
}

/**
 * O que se guarda como «entidade» de uma leitura da fila: o recorte pedido.
 *
 * Uma lista não tem identificador, e inventar um («fila») dizia menos do que
 * o nada. O recorte diz o que a pessoa foi ver — `status=pending` é a fila de
 * trabalho, `status=approved&channel=email` é alguém a rever o que já passou —
 * e cabe numa coluna de texto.
 */
export function recorteDaFila(status: string | undefined, channel: string | undefined): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (channel) params.set('channel', channel);
  return params.toString() || 'tudo';
}
