import { ORIGEM_DA_MONTRA } from './montra';

/**
 * A política de segurança é do produto, e por isso mora com a página dele.
 *
 * O campo `Policy:` de todos os `security.txt` apontava para o `SECURITY.md`
 * no GitHub, e o repositório é privado — `api.github.com/repos/fvsalgado/coreto`
 * responde `"private": true`, e o endereço do `Policy:` responde 404. Quem
 * seguisse a RFC 9116 ficava sem o âmbito e sem os prazos, que é exatamente o
 * que aquele campo existe para dar.
 *
 * Podia resolver-se abrindo o repositório, e essa decisão é do dono. A
 * política não pode ficar à espera dela: passou a ser servida no próprio
 * domínio, o que funciona com o repositório aberto ou fechado.
 *
 * **Um endereço só, e não um por região.** O que está escrito na política — o
 * âmbito, os prazos, o que já está feito, o que não é falha — é do software e
 * é igual nas três origens; três cópias da mesma política são três cópias a
 * divergir. O que é da região é o contacto, e esse vai no `security.txt` dela.
 */
export const CAMINHO_DA_POLITICA = '/seguranca';

/** O endereço público da política — ver `ORIGEM_DA_MONTRA` para a origem. */
export const URL_DA_POLITICA = `${ORIGEM_DA_MONTRA}${CAMINHO_DA_POLITICA}`;

/**
 * Quando a política foi revista pela última vez.
 *
 * Um texto destes sem data é um texto que ninguém consegue comparar com a
 * versão que leu — é a mesma razão pela qual a política de privacidade ganhou
 * a dela. Vive aqui e não em `src/lib/revisao.ts` porque aquela lista é dos
 * textos da região, com ciclos de revisão próprios, e esta política é do
 * produto; quem um dia as juntar não perde nada.
 *
 * Muda com o `SECURITY.md`, que é a outra cópia: as duas mudam ao mesmo tempo
 * ou passam a dizer coisas diferentes.
 */
export const REVISAO_DA_POLITICA = '2026-09-19';

/**
 * A validade do `security.txt`, ancorada no primeiro dia de um mês seis meses
 * à frente.
 *
 * Ancorada e não «agora mais seis meses» porque uma data que muda a cada
 * pedido faz o ficheiro diferir entre duas leituras da mesma hora, e um
 * `security.txt` que nunca é byte a byte igual a si próprio é um ficheiro que
 * nenhuma cache e nenhum varredor conseguem comparar.
 *
 * Vive aqui, e não em cada uma das duas rotas que o servem, porque duas
 * validades calculadas de maneiras parecidas são duas validades que um dia
 * discordam.
 */
export function validadeDoSecurityTxt(agora: Date): string {
  const mes = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 6, 1, 0, 0, 0);
  return new Date(mes).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
