/**
 * As primitivas de um token assinado, num sítio só.
 *
 * Nasceram dentro do `admin/session.ts`, que as escreveu sobre a Web Crypto
 * por uma razão que continua de pé: o middleware corre no runtime de edge,
 * onde `node:crypto` não existe, e o próprio ficheiro avisava que **ter duas
 * implementações da mesma verificação era garantir que um dia divergiam e uma
 * delas passava a aceitar o que a outra recusa**.
 *
 * Quando a barreira das regiões (0157) precisou de um segundo cookie assinado,
 * esse aviso passou de hipótese a decisão: as primitivas saíram para aqui e
 * são as mesmas para os dois. O que **não** saiu foi o formato de cada token —
 * a sessão do painel continua a construir o dela exatamente como sempre, para
 * não invalidar as sessões abertas de quem estiver a trabalhar no dia em que
 * isto for a produção.
 *
 * **Os dois formatos não se confundem, e é de propósito.** Ambos são assinados
 * com o mesmo segredo, mas os corpos são disjuntos: o da sessão do painel leva
 * `actor` e o leitor dele recusa um token sem `actor`; o da barreira leva
 * `tipo: 'portao'` e uma região, e o leitor dele recusa tudo o que não traga as
 * duas coisas. Um bilhete de barreira apresentado como sessão de painel é
 * recusado por falta de `actor`; uma sessão de painel apresentada como bilhete
 * é recusada por falta de `tipo`.
 */

export function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function assinar(value: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(value),
  );
  return base64url(signature);
}

/** Comparação sem sair mais cedo, para o tempo de resposta não dizer nada. */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * O sha256 de um texto, em hexadecimal minúsculo.
 *
 * É o que a base guarda da senha de uma barreira (`region_gates`), e é o único
 * sítio onde se calcula: o painel envia o hash, a base recebe o hash, e a senha
 * em claro nunca sai do formulário de quem a escreveu.
 *
 * **Não é para palavras-passe de contas.** A do painel usa scrypt
 * (`admin/password.ts`), que é o certo para um segredo por pessoa. A barreira
 * é outra coisa — uma senha partilhada, dita ao telefone, que só tapa uma
 * região por licenciar — e um sha256 com comparação em tempo constante é a
 * medida dela. Quem confundir as duas está a usar a ferramenta errada, e a
 * migração 0157 di-lo com todas as letras.
 */
export async function sha256Hex(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
