import { NextResponse, type NextRequest } from 'next/server';
import {
  CAMINHO_DO_PORTAO,
  PORTAO_COOKIE_NAME,
  PORTAO_JANELA_SEGUNDOS,
  PORTAO_TENTATIVAS,
  PORTAO_TTL_SEGUNDOS,
  criarBilhete,
} from '@/src/lib/portao';
import { checkRateLimit } from '@/src/lib/rate-limit';
import { dominiosDasRegioes, regiaoDoHost } from '@/src/lib/regiao-host';
import { reportarErro } from '@/src/lib/registo';
import { adminClient } from '@/src/lib/supabase/server';
import { constantTimeEquals, sha256Hex } from '@/src/lib/token-assinado';

/**
 * A senha da barreira de uma região, verificada (0157).
 *
 * Vive em `/api/`, fora do segmento das regiões, porque o middleware não
 * reescreve a API — e porque a região a que este pedido diz respeito não vem
 * do formulário: vem do **anfitrião**. Um campo escondido com o identificador
 * da região era um campo que qualquer pessoa edita.
 *
 * O que sai daqui é sempre um 303 e nunca um corpo: a resposta a um formulário
 * é uma página, e uma página com a senha no histórico do browser não é o que se
 * quer. Certa ou errada, volta-se para onde se estava.
 */

/** Só caminhos desta origem. Um destino aberto era um redirecionamento aberto. */
function destinoSeguro(de: string | null): string {
  if (!de) return '/';
  // `//` é relativo ao protocolo e leva para fora; `/\` é o mesmo truque com a
  // barra ao contrário, que alguns browsers normalizam.
  if (!de.startsWith('/') || de.startsWith('//') || de.startsWith('/\\')) return '/';
  return de;
}

function deVolta(request: NextRequest, de: string, erro?: string): NextResponse {
  const destino = new URL(CAMINHO_DO_PORTAO, request.nextUrl.origin);
  destino.searchParams.set('de', de);
  if (erro) destino.searchParams.set('erro', erro);
  const resposta = NextResponse.redirect(destino, 303);
  resposta.headers.set('Cache-Control', 'no-store, must-revalidate');
  return resposta;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formulario = await request.formData();
  // Aparada dos dois lados — aqui e no painel que a define. Uma senha
  // copiada de um email traz quase sempre um espaço atrás, e isso não tem
  // de ser um problema de ninguém.
  const senha = String(formulario.get('senha') ?? '').trim();
  const de = destinoSeguro(String(formulario.get('de') ?? ''));

  const dominios = await dominiosDasRegioes(request.nextUrl.origin);
  const regiao = regiaoDoHost(request.headers.get('host'), dominios);
  if (regiao === null) return deVolta(request, de, 'regiao');

  /*
   * Dez tentativas por quarto de hora e por endereço.
   *
   * Uma senha partilhada é curta por desenho — é dita ao telefone —, e sem
   * limite bastava um guião a tentar palavras comuns. O balde leva a região no
   * nome: tentar no Médio Tejo não gasta as tentativas de mais ninguém.
   */
  const limite = await checkRateLimit(request, {
    route: `portao:${regiao}`,
    limit: PORTAO_TENTATIVAS,
    windowSeconds: PORTAO_JANELA_SEGUNDOS,
  });
  if (!limite.allowed) return deVolta(request, de, 'demasiadas');

  /*
   * **Sem chave de serviço, fecha.**
   *
   * A senha vive em `region_gates`, sem concessões ao `anon` — quem a lê é o
   * servidor. Sem a chave não há leitura, e sem leitura não há comparação: a
   * barreira recusa em vez de deixar passar. É a mesma regra do middleware e
   * da `guardAdmin`, e é a que mantém honesta a promessa feita a quem ligou a
   * barreira.
   */
  const supabase = adminClient();
  if (!supabase) return deVolta(request, de, 'por-configurar');

  const segredo = process.env.ADMIN_SESSION_SECRET;
  if (!segredo) return deVolta(request, de, 'por-configurar');

  const { data, error } = await supabase
    .from('region_gates')
    .select('password_sha256')
    .eq('region_id', regiao)
    .maybeSingle();

  if (error) {
    reportarErro('portao', error);
    return deVolta(request, de, 'por-configurar');
  }

  const guardado = data?.password_sha256;
  // Sem senha definida não se entra. A base já recusa ligar uma barreira
  // nestas condições (0157); isto é a segunda tranca, para o caso de alguém
  // ter mexido na tabela à mão.
  if (typeof guardado !== 'string' || guardado.length !== 64) {
    return deVolta(request, de, 'por-configurar');
  }

  if (!constantTimeEquals(await sha256Hex(senha), guardado)) {
    return deVolta(request, de, 'errada');
  }

  const resposta = NextResponse.redirect(new URL(de, request.nextUrl.origin), 303);
  resposta.cookies.set({
    name: PORTAO_COOKIE_NAME,
    value: await criarBilhete(regiao, segredo),
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: PORTAO_TTL_SEGUNDOS,
  });
  resposta.headers.set('Cache-Control', 'no-store, must-revalidate');
  return resposta;
}
