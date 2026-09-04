import { cabecalhosDeDescarga, prepararExportacao } from '@/src/lib/admin/exportar-relatorio';
import { nomeDoFicheiro } from '@/src/lib/admin/relatorio';

/**
 * `GET /admin/relatorios/relatorio.json?regiao=<id>&mes=AAAA-MM` — o relatório
 * mensal tal como a base o devolve, para quem o quer tratar por código ou
 * guardar como está.
 *
 * É o JSON de `monthly_report` sem tradução nenhuma: a forma está documentada
 * na migração 0120 e em `RelatorioMensal`. Indentado, porque também se lê à
 * mão, e como descarga, porque é um documento e não uma API.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const exportacao = await prepararExportacao(request);
  if (!exportacao.ok) return exportacao.resposta;

  const { regiao, mes, relatorio } = exportacao;
  return new Response(JSON.stringify(relatorio, null, 2), {
    headers: cabecalhosDeDescarga(
      nomeDoFicheiro(regiao, mes, 'json'),
      'application/json; charset=utf-8',
    ),
  });
}
