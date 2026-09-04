import { aliasesDasRegioes, listRegioes } from '@/src/lib/queries/regioes';

/**
 * O mapa das regiões, para o middleware.
 *
 * É por aqui que o Host vira região: o middleware pede esta rota, guarda o
 * mapa cinco minutos (`regiao-host.ts`) e reescreve cada pedido para o
 * segmento da sua região. Uma CIM nova entra em produção com um INSERT — o
 * mapa refaz-se sozinho, sem deploy.
 *
 * Só o que o encaminhamento precisa: identificador, domínio canónico e os
 * alias que lhe redirecionam (0111). O resto da identidade da região é lido
 * por quem desenha páginas, não por quem as encaminha.
 */

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const [regioes, aliases] = await Promise.all([listRegioes(), aliasesDasRegioes()]);
  return Response.json(
    regioes.map((regiao) => ({
      id: regiao.id,
      domain: regiao.dominio,
      aliases: aliases[regiao.id] ?? [],
    })),
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
