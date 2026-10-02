import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../env';
import { baldeDoPedido } from '../ip';
import { reportarErro } from '../registo';
import { adminClient } from '../supabase/server';
import { faltaNoEsquema } from './pessoas';
import {
  LOGIN_ATTEMPT_WINDOW_SECONDS,
  LOGIN_FALHAS_POR_EMAIL,
  LOGIN_FALHAS_POR_IP,
} from './session';

/**
 * O limite de tentativas da entrada no painel: só as falhadas contam (C4-016).
 *
 * Três gestos, e a ordem é a regra inteira:
 *
 * 1. **antes** de conferir a palavra-passe, espreita-se — sem contar — se o
 *    endereço ou o email já passaram do limite (`rate_limit_peek`, 0170);
 * 2. **só se a palavra-passe falhar**, conta-se uma em cada balde
 *    (`rate_limit_hit`, a função de sempre);
 * 3. **numa entrada certa**, esquece-se o balde do endereço
 *    (`rate_limit_clear`): quem acertou não fica a pagar os enganos de quem
 *    partilha a rede com ele. O do email fica — é o que trava quem tenta
 *    adivinhar a palavra-passe de uma pessoa a partir de muitos sítios.
 *
 * **Fecha em vez de abrir**, como o limitador antigo da entrada
 * (`falhaFechada`): sem base, ou antes de a 0170 chegar e as duas funções
 * novas existirem, conta-se na memória do processo. Cada instância tem a sua e
 * um reinício esquece tudo — mas é o que separa «cinco tentativas por quarto de
 * hora» de «as que quiser».
 *
 * O email não se guarda em claro no balde, como o endereço: vai como resumo
 * com sal. A tabela `rate_limits` vive dois dias e não é sítio para uma lista
 * de emails de quem tentou entrar.
 */

const ROTA_IP = 'admin-entrada-ip';
const ROTA_EMAIL = 'admin-entrada-email';

/** O sal dos resumos de email: o dos IP, ou um efémero, como `baldeDoPedido`. */
const SAL_EFEMERO = randomBytes(16).toString('hex');

function resumoDoEmail(email: string): string {
  return createHash('sha256')
    .update(`${env.IP_HASH_SALT ?? SAL_EFEMERO}|email|${email.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);
}

interface Balde {
  chave: string;
  limite: number;
}

function baldes(request: Request, email: string): [Balde, Balde] {
  return [
    { chave: `${ROTA_IP}:${baldeDoPedido(request)}`, limite: LOGIN_FALHAS_POR_IP },
    { chave: `${ROTA_EMAIL}:${resumoDoEmail(email)}`, limite: LOGIN_FALHAS_POR_EMAIL },
  ];
}

export interface EstadoDoLimite {
  permitido: boolean;
  /** Quando se pode voltar a tentar, se não é já. */
  repoeEm: string | null;
}

/* ------------------------------------------------------------------ memória */

interface Contagem {
  inicio: number;
  falhas: number;
}

const MEMORIA = new Map<string, Contagem>();

function janelaDe(agora: number): number {
  const janela = LOGIN_ATTEMPT_WINDOW_SECONDS * 1000;
  return Math.floor(agora / janela) * janela;
}

function lerDaMemoria(chave: string, agora: number): number {
  const contagem = MEMORIA.get(chave);
  if (!contagem || contagem.inicio !== janelaDe(agora)) return 0;
  return contagem.falhas;
}

function contarNaMemoria(chave: string, agora: number): void {
  const inicio = janelaDe(agora);
  const contagem = MEMORIA.get(chave);
  if (!contagem || contagem.inicio !== inicio) {
    // Antes de abrir um balde novo, saem os de janelas passadas: um mapa que
    // só cresce é uma fuga de memória com outro nome.
    if (MEMORIA.size > 5_000) {
      for (const [outra, valor] of MEMORIA) if (valor.inicio !== inicio) MEMORIA.delete(outra);
    }
    MEMORIA.set(chave, { inicio, falhas: 1 });
    return;
  }
  contagem.falhas += 1;
}

/** Só para os testes: o processo de testes partilha a memória entre casos. */
export function esquecerMemoriaDaEntrada(): void {
  MEMORIA.clear();
}

function repoeEm(agora: number): string {
  return new Date(janelaDe(agora) + LOGIN_ATTEMPT_WINDOW_SECONDS * 1000).toISOString();
}

/* -------------------------------------------------------------- os 3 gestos */

/** Espreita, sem contar, se esta tentativa ainda pode ser feita. */
export async function consultarLimiteDaEntrada(
  request: Request,
  email: string,
  agora = Date.now(),
): Promise<EstadoDoLimite> {
  const lista = baldes(request, email);
  const supabase = adminClient();

  if (supabase) {
    const respostas = await Promise.all(
      lista.map((balde) =>
        supabase.rpc('rate_limit_peek', {
          p_bucket: balde.chave,
          p_window_seconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
        }),
      ),
    );
    const erro = respostas.find((resposta) => resposta.error)?.error;
    if (!erro) {
      const cheio = respostas.find((resposta, indice) => {
        const linha = (Array.isArray(resposta.data) ? resposta.data[0] : resposta.data) as {
          hits: number;
          reset_at: string;
        } | null;
        return (linha?.hits ?? 0) >= (lista[indice]?.limite ?? 0);
      });
      if (!cheio) return { permitido: true, repoeEm: null };
      const linha = (Array.isArray(cheio.data) ? cheio.data[0] : cheio.data) as {
        reset_at: string;
      } | null;
      return { permitido: false, repoeEm: linha?.reset_at ?? repoeEm(agora) };
    }
    // Antes da 0170 a função não existe, e isso não é avaria: conta-se na
    // memória, como sem base. Outra coisa qualquer é, e regista-se.
    if (!faltaNoEsquema(erro)) reportarErro('rate_limit_peek', erro);
  }

  const cheio = lista.some((balde) => lerDaMemoria(balde.chave, agora) >= balde.limite);
  return cheio ? { permitido: false, repoeEm: repoeEm(agora) } : { permitido: true, repoeEm: null };
}

/** Conta uma tentativa falhada, nos dois baldes. */
export async function registarFalhaDaEntrada(
  request: Request,
  email: string,
  agora = Date.now(),
): Promise<void> {
  const lista = baldes(request, email);
  // Na memória sempre: é por ela que se espreita quando a base não sabe.
  for (const balde of lista) contarNaMemoria(balde.chave, agora);

  const supabase = adminClient();
  if (!supabase) return;
  const respostas = await Promise.all(
    lista.map((balde) =>
      supabase.rpc('rate_limit_hit', {
        p_bucket: balde.chave,
        p_window_seconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
        p_limit: balde.limite,
      }),
    ),
  );
  for (const resposta of respostas) {
    if (resposta.error) reportarErro('rate_limit_hit (entrada)', resposta.error);
  }
}

/** Uma entrada certa esquece o balde do endereço. */
export async function limparLimiteDoEndereco(request: Request): Promise<void> {
  const chave = `${ROTA_IP}:${baldeDoPedido(request)}`;
  MEMORIA.delete(chave);
  const supabase = adminClient();
  if (!supabase) return;
  const { error } = await supabase.rpc('rate_limit_clear', { p_bucket: chave });
  if (error && !faltaNoEsquema(error)) reportarErro('rate_limit_clear', error);
}
