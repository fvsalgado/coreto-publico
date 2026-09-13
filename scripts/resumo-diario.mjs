#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

/**
 * Transforma o resumo da base num corpo de notificação — ou em nada.
 *
 * Lê o JSON de `daily_digest` na entrada e escreve na saída o que cabe num
 * ecrã bloqueado. **Escreve vazio quando não há nada a fazer**, e é o vazio
 * que manda o `resumo-diario.sh` não enviar: um aviso diário sobre uma fila
 * vazia aprende-se a ignorar em duas semanas, e aí deixa de servir também nos
 * dias em que havia alguma coisa.
 *
 * Fica num ficheiro próprio, e não dentro do `.sh`, por duas razões: para
 * poder ser testado sem base nenhuma — é uma função pura de JSON para texto —
 * e porque montar texto com acentos e plurais em `bash` é como se escrevem os
 * erros que ninguém revê.
 */

/** Uma linha por facto, e só os factos que pedem alguma coisa a alguém. */
export function linhasDoResumo(resumo) {
  const linhas = [];
  const pendentes = resumo?.pending?.total ?? 0;
  const canais = resumo?.pending?.by_channel ?? {};

  if (pendentes > 0) {
    // O canal diz de quem é a expectativa: quem preencheu um formulário está à
    // espera de resposta, e a recolha automática não está à espera de nada.
    const porCanal = [
      ['formulário', canais.form ?? 0],
      ['email', canais.email ?? 0],
      ['recolha', canais.scraper ?? 0],
    ]
      .filter(([, n]) => n > 0)
      .map(([nome, n]) => `${n} por ${nome}`)
      .join(', ');
    linhas.push(`${pendentes} por rever${porCanal ? ` (${porCanal})` : ''}`);
  }

  const urgentes = resumo?.pending_within_7_days ?? 0;
  if (urgentes > 0) {
    linhas.push(`${urgentes} ${urgentes === 1 ? 'acontece' : 'acontecem'} nos próximos 7 dias`);
  }

  // As que já passaram não urgem — deixaram de valer. Dizem-se para a fila
  // poder ser limpa, e não a par das que ainda dá para salvar.
  const passadas = resumo?.pending_already_past ?? 0;
  if (passadas > 0) {
    linhas.push(`${passadas} ${passadas === 1 ? 'já passou' : 'já passaram'}`);
  }

  const paradas = resumo?.pending_stale ?? 0;
  if (paradas > 0) {
    linhas.push(`${paradas} na fila há dias`);
  }

  const caladas = resumo?.silent_sources ?? 0;
  if (caladas > 0) {
    linhas.push(
      `${caladas} ${caladas === 1 ? 'fonte correu e não trouxe nada' : 'fontes correram e não trouxeram nada'}`,
    );
  }

  const amanha = resumo?.tomorrow_incomplete ?? 0;
  if (amanha > 0) {
    linhas.push(`${amanha} ${amanha === 1 ? 'evento de amanhã' : 'eventos de amanhã'} sem hora`);
  }

  for (const licenca of resumo?.licenses_ending ?? []) {
    linhas.push(`licença ${licenca.kind} acaba a ${licenca.ends_on}`);
  }

  return linhas;
}

/** O corpo inteiro, ou cadeia vazia quando não há nada a dizer. */
export function corpoDoResumo(resumo) {
  const linhas = linhasDoResumo(resumo);
  if (linhas.length === 0) return '';
  return linhas.join('\n');
}

// Só corre como programa quando é invocado como programa: importado por um
// teste, exporta as funções e não fica à espera de uma entrada que nunca vem.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const entrada = [];
  process.stdin.on('data', (bloco) => entrada.push(bloco));
  process.stdin.on('end', () => {
    const texto = entrada.join('').trim();
    if (!texto) process.exit(0);
    let resumo;
    try {
      resumo = JSON.parse(texto);
    } catch {
      // Uma resposta ilegível não é «não há nada a fazer»: é não saber. Sai a
      // um, e o `.sh` conta-a como falha de leitura.
      process.stderr.write('resposta ilegível da base\n');
      process.exit(1);
    }
    process.stdout.write(corpoDoResumo(resumo));
  });
}
