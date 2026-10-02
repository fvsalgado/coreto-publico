import { USER_AGENT } from '@coreto/core';
import {
  LARGURAS_DA_FOTOGRAFIA,
  chaveDaFotografia,
  ficheiroDoCommons,
  miniaturaDoCommons,
} from '@/src/lib/fotografia';
import { listCoretos, listVenues } from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';

/**
 * Uma fotografia do Commons, servida pelo próprio sítio — `/fotografia/<chave>/<largura>`.
 *
 * Existe para que o navegador de quem visita não fale com a Wikimedia, que lhe
 * deixava cookies a cada fotografia (o porquê inteiro está em
 * `lib/fotografia.ts`). Quem pede é o servidor, identificado com o mesmo
 * agente da recolha, e só a medida que a página pediu.
 *
 * **Lista fechada, e não um intermediário aberto.** A chave tem de ser a de
 * uma fotografia que esta região mostra — de um espaço ou de um coreto — e a
 * largura tem de ser um dos escalões do Commons. Tudo o resto é 404: um
 * endereço que buscasse qualquer imagem que lhe pedissem punha este domínio a
 * servir o que ninguém aqui escolheu.
 *
 * **A cache é longa porque o endereço muda quando a fotografia muda**: a
 * chave é do endereço guardado, e trocar a fotografia no painel troca a chave.
 * A rede de distribuição guarda a resposta um ano; o servidor da Wikimedia vê
 * um pedido por fotografia e por medida, e não um por visita.
 *
 * **Uma falha não se guarda como se fosse a fotografia.** Responde 502, que a
 * rede guarda dez minutos — o bastante para não martelar a Wikimedia quando
 * ela está a recusar pedidos, e pouco para a fotografia voltar sozinha. Na
 * página, a capa que está por baixo fica à vista.
 */

/** O tecto do que se aceita do outro lado — o mesmo dos cartazes. */
const MAXIMO_DE_BYTES = 8 * 1024 * 1024;

const UM_ANO = 60 * 60 * 24 * 365;

/** Os formatos que uma miniatura do Commons pode ter, e só esses. Um SVG nunca. */
const TIPOS_ACEITES = /^image\/(jpeg|png|gif|webp)$/;

function naoHa(): Response {
  return new Response('Não há esta fotografia.\n', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
}

function falhou(): Response {
  return new Response('A fotografia não chegou da origem.\n', {
    status: 502,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600',
    },
  });
}

/**
 * Os parâmetros declarados à mão, e não com o `RouteContext` que o Next gera
 * — pela razão escrita em `app/[regiao]/agenda/[municipality]/route.ts`.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ regiao: string; chave: string; largura: string }> },
): Promise<Response> {
  const { regiao: regiaoId, chave, largura: larguraPedida } = await context.params;
  const largura = LARGURAS_DA_FOTOGRAFIA.find((escalao) => String(escalao) === larguraPedida);
  if (!/^[0-9a-f]{16}$/.test(chave) || largura === undefined) return naoHa();

  const regiao = await exigirRegiao(regiaoId);
  const [espacos, coretos] = await Promise.all([listVenues(regiao.id), listCoretos(regiao.id)]);
  const endereco = [
    ...espacos.map((espaco) => espaco.image_url),
    ...coretos.map((coreto) => coreto.photo_url),
  ].find((url): url is string => url !== null && chaveDaFotografia(url) === chave);
  if (!endereco) return naoHa();

  const ficheiro = ficheiroDoCommons(endereco);
  const alvo = ficheiro ? miniaturaDoCommons(ficheiro, largura) : null;
  if (!alvo) return naoHa();

  let resposta: Response;
  try {
    resposta = await fetch(alvo, {
      headers: { 'user-agent': USER_AGENT, accept: 'image/webp,image/jpeg,image/png,image/*' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return falhou();
  }

  const tipo = (resposta.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  const declarado = Number(resposta.headers.get('content-length') ?? '0');
  if (!resposta.ok || !TIPOS_ACEITES.test(tipo) || declarado > MAXIMO_DE_BYTES) return falhou();

  const corpo = await resposta.arrayBuffer();
  if (corpo.byteLength === 0 || corpo.byteLength > MAXIMO_DE_BYTES) return falhou();

  return new Response(corpo, {
    headers: {
      'Content-Type': tipo,
      'Content-Length': String(corpo.byteLength),
      'Cache-Control': `public, max-age=${UM_ANO}, s-maxage=${UM_ANO}, immutable`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
