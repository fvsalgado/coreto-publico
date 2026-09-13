import { CORS_HEADERS, FEED_CACHE_CONTROL } from '@/src/lib/feeds/http';
import { dumpParaCsv } from '@/src/lib/feeds/dump';
import { carregarDump } from '@/src/lib/feeds/dump-load';
import { exigirRegiao } from '@/src/lib/queries/regioes';

/**
 * O mesmo ficheiro em CSV, para quem abre folhas de cálculo e não APIs.
 *
 * É esta a forma que uma técnica de cultura anexa a um processo, e é por isso
 * que leva BOM, ponto e vírgula e CRLF — as mesmas três decisões do relatório
 * mensal, pela mesma razão: é no Excel em português que isto é aberto.
 *
 * Os metadados vão em linhas `#` à cabeça, que é a convenção que o Excel, o
 * LibreOffice e o `pandas` sabem saltar. Sem isso, um CSV descarregado hoje e
 * aberto daqui a um ano não diz de quando é.
 */
export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await context.params;
  const regiao = await exigirRegiao(regiaoId);
  const dump = await carregarDump(regiao);

  return new Response(dumpParaCsv(dump), {
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': FEED_CACHE_CONTROL,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="coreto-${regiao.id}.csv"`,
    },
  });
}
