import { todayInLisbon } from '@coreto/core/dates';
import 'server-only';
import { hasServiceRole } from '../env';
import { requireAdmin } from './auth';
import { listRegionsAdmin, monthlyReport } from './queries';
import { escolherRegiao, lerMes, mesAnterior, type RelatorioMensal } from './relatorio';

/**
 * O que as duas rotas de exportação do relatório — `relatorio.csv` e
 * `relatorio.json`, debaixo de `/admin/relatorios` — têm em comum: a sessão,
 * a chave, o mês, a região e a leitura. Só o formato é de cada uma.
 *
 * São as primeiras rotas de servidor debaixo de `/admin`, e por isso pedem a
 * sessão do seu lado. O middleware já manda para a entrada quem não a tem,
 * mas é a primeira barreira e não a única — «uma verificação só à porta é
 * uma verificação que um dia alguém contorna» —, e o layout, que é a segunda
 * barreira das páginas, não envolve rotas. `requireAdmin()` rebenta sem
 * sessão, como nas ações de moderação; aqui a exceção vira um 401 em JSON e
 * não um redirecionamento, porque quem pede um ficheiro pode não ser um
 * navegador a ver páginas, e um redirecionamento para a entrada, guardado
 * como `relatorio.csv`, é um ficheiro que não abre e não diz porquê.
 *
 * O mês e a região seguem a regra da página: sem mês, o anterior; sem região,
 * a primeira que não é a montra; um mês que não se lê ou uma região que não
 * existe recusam-se, em vez de se corrigirem em silêncio para um relatório
 * de outra coisa com o nome certo.
 */

export type Exportacao =
  | { ok: true; regiao: string; mes: string; relatorio: RelatorioMensal }
  | { ok: false; resposta: Response };

/** Nada do que sai daqui pode ficar em cache de ninguém. */
const SEM_CACHE = { 'Cache-Control': 'no-store' } as const;

function recusa(status: number, erro: string): Response {
  return Response.json({ erro }, { status, headers: SEM_CACHE });
}

export async function prepararExportacao(request: Request): Promise<Exportacao> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, resposta: recusa(401, 'sessão de administração em falta') };
  }
  if (!hasServiceRole) return { ok: false, resposta: recusa(503, 'falta a chave de serviço') };

  const params = new URL(request.url).searchParams;
  const mesPedido = params.get('mes');
  const mes = mesPedido ? lerMes(mesPedido) : mesAnterior(todayInLisbon());
  if (!mes) return { ok: false, resposta: recusa(400, 'o mês tem de ser AAAA-MM') };

  const regiao = escolherRegiao(await listRegionsAdmin(), params.get('regiao'));
  if (!regiao) return { ok: false, resposta: recusa(404, 'região desconhecida') };

  return { ok: true, regiao, mes, relatorio: await monthlyReport(regiao, mes) };
}

/** Os cabeçalhos de um ficheiro que se descarrega e não se guarda em cache. */
export function cabecalhosDeDescarga(nome: string, tipo: string): Record<string, string> {
  return {
    'Content-Type': tipo,
    'Content-Disposition': `attachment; filename="${nome}"`,
    ...SEM_CACHE,
  };
}
