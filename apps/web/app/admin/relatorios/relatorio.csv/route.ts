import { cabecalhosDeDescarga, prepararExportacao } from '@/src/lib/admin/exportar-relatorio';
import { nomeDoFicheiro, paraCsv } from '@/src/lib/admin/relatorio';

/**
 * `GET /admin/relatorios/relatorio.csv?regiao=<id>&mes=AAAA-MM` — o relatório
 * mensal em CSV, para anexar ao que se manda a quem financia.
 *
 * A sessão, o mês e a região tratam-se em `exportar-relatorio.ts`, que é o
 * mesmo caminho da rota em JSON; aqui só se escreve o ficheiro. O formato do
 * CSV — ponto e vírgula, BOM, blocos — está explicado em `paraCsv`.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const exportacao = await prepararExportacao(request);
  if (!exportacao.ok) return exportacao.resposta;

  const { regiao, mes, relatorio } = exportacao;
  return new Response(paraCsv(relatorio), {
    headers: cabecalhosDeDescarga(nomeDoFicheiro(regiao, mes, 'csv'), 'text/csv; charset=utf-8'),
  });
}
