import { cabecalhosDeDescarga, prepararExportacao } from '@/src/lib/admin/exportar-relatorio';
import {
  nomeDoFicheiro,
  nomeDoFicheiroDaTabela,
  paraCsv,
  csvDeUmaTabela,
  tabelasDoRelatorio,
} from '@/src/lib/admin/relatorio';

/**
 * `GET /admin/relatorios/relatorio.csv?regiao=<id>&mes=AAAA-MM[&tabela=<chave>]`
 * — o relatório mensal em CSV, para anexar ao que se manda a quem financia.
 *
 * Com `tabela`, uma tabela só, com os cabeçalhos em português corrente e os
 * concelhos pelo nome — a que a página oferece, uma por ficheiro (C4-033).
 * Sem ela, o ficheiro por blocos, com os nomes de coluna que a ficha técnica
 * documenta: é o das máquinas, e quem já o lê continua a lê-lo.
 *
 * A sessão, o mês e a região tratam-se em `exportar-relatorio.ts`, que é o
 * mesmo caminho da rota em JSON; aqui só se escreve o ficheiro.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const exportacao = await prepararExportacao(request);
  if (!exportacao.ok) return exportacao.resposta;

  const { regiao, mes, relatorio } = exportacao;
  const pedida = new URL(request.url).searchParams.get('tabela');
  if (pedida !== null) {
    const tabela = tabelasDoRelatorio(relatorio).find((linha) => linha.chave === pedida);
    if (!tabela) {
      return Response.json(
        { erro: 'tabela desconhecida' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return new Response(csvDeUmaTabela(tabela), {
      headers: cabecalhosDeDescarga(
        nomeDoFicheiroDaTabela(regiao, mes, tabela.chave),
        'text/csv; charset=utf-8',
      ),
    });
  }
  return new Response(paraCsv(relatorio), {
    headers: cabecalhosDeDescarga(nomeDoFicheiro(regiao, mes, 'csv'), 'text/csv; charset=utf-8'),
  });
}
