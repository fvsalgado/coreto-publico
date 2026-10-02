import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACAO_DA_AUDITORIA,
  acaoDaAuditoria,
  CAMPO_DO_EVENTO,
  CANAL,
  confiancaEmPalavras,
  ESTADO_DA_PROPOSTA,
  ESTADO_DA_RECOLHA,
  ESTADO_DO_EVENTO,
  LEITURA_AUTOMATICA,
  porExtenso,
  rotulo,
} from './rotulos';
import { EDITABLE_FIELDS } from './fields';

/**
 * Cada valor que as enumerações da base têm hoje tem um rótulo decidido.
 *
 * Lê os `create type … as enum` e os `alter type … add value` das migrações:
 * um estado novo que uma migração acrescente aparece aqui como falha, e quem
 * o acrescentou decide como se diz — em vez de ele aparecer cru no painel.
 */
function valoresDoEnum(nome: string): string[] {
  const pasta = fileURLToPath(new URL('../../../../../supabase/migrations/', import.meta.url));
  const sql = readdirSync(pasta)
    .filter((ficheiro) => ficheiro.endsWith('.sql'))
    .map((ficheiro) => readFileSync(pasta + ficheiro, 'utf8'))
    .join('\n');
  const criado =
    new RegExp(`create type public\\.${nome} as enum \\(([^)]*)\\)`).exec(sql)?.[1] ?? '';
  const acrescentados = [
    ...sql.matchAll(
      new RegExp(`alter type public\\.${nome} add value (?:if not exists )?'([a-z_]+)'`, 'g'),
    ),
  ].map((encontro) => encontro[1] ?? '');
  return [
    ...[...criado.matchAll(/'([a-z_]+)'/g)].map((encontro) => encontro[1] ?? ''),
    ...acrescentados,
  ];
}

describe('o dicionário dos rótulos do painel', () => {
  it.each([
    ['submission_channel', CANAL],
    ['submission_status', ESTADO_DA_PROPOSTA],
    ['event_status', ESTADO_DO_EVENTO],
    ['extraction_status', LEITURA_AUTOMATICA],
    ['run_status', ESTADO_DA_RECOLHA],
  ] as const)('%s: todos os valores da base têm rótulo', (enumeracao, dicionario) => {
    const valores = valoresDoEnum(enumeracao);
    expect(valores.length).toBeGreaterThan(1);
    for (const valor of valores) expect(Object.keys(dicionario)).toContain(valor);
  });

  it('um valor desconhecido sai tal e qual, em vez de desaparecer', () => {
    expect(rotulo(ESTADO_DO_EVENTO, 'published')).toBe('publicado');
    expect(rotulo(ESTADO_DO_EVENTO, 'novo-estado')).toBe('novo-estado');
  });

  it('a confiança só se diz onde distingue alguma coisa', () => {
    expect(confiancaEmPalavras('form', 0.6)).toBeNull();
    expect(confiancaEmPalavras('scraper', 0.9)).toBe('leitura segura');
    expect(confiancaEmPalavras('email', 0.7)).toBe('leitura razoável');
    expect(confiancaEmPalavras('scraper', 0.3)).toBe('leitura duvidosa');
    expect(confiancaEmPalavras('email', null)).toBeNull();
  });

  it('cada campo que o painel corrige tem nome, e a lista diz-se por extenso', () => {
    for (const campo of [...EDITABLE_FIELDS, 'is_ongoing', 'sessions']) {
      expect(Object.keys(CAMPO_DO_EVENTO)).toContain(campo);
    }
    expect(porExtenso(['o preço'])).toBe('o preço');
    expect(porExtenso(['o título', 'o preço', 'as datas'])).toBe('o título, o preço e as datas');
  });

  it('cada ação que as migrações escrevem na auditoria tem a sua frase', () => {
    // As que a base escreve com o nome à vista: `log_admin_action(ator,
    // 'acao', …)` e os `insert into admin_actions` com a ação literal. As
    // compostas (`'submission.' || p_status`) estão nomeadas no dicionário.
    const pasta = fileURLToPath(new URL('../../../../../supabase/migrations/', import.meta.url));
    const sql = readdirSync(pasta)
      .filter((nome) => nome.endsWith('.sql'))
      .map((nome) => readFileSync(pasta + nome, 'utf8'))
      .join('\n');
    const escritas = new Set<string>();
    for (const encontro of sql.matchAll(
      /log_admin_action\(\s*[^,]+,\s*'([a-z_]+(?:\.[a-z_]+)?)'\s*,/g,
    )) {
      escritas.add(encontro[1] ?? '');
    }
    for (const encontro of sql.matchAll(/then '([a-z]+\.[a-z_]+)' else '([a-z]+\.[a-z_]+)' end/g)) {
      escritas.add(encontro[1] ?? '');
      escritas.add(encontro[2] ?? '');
    }
    expect(escritas.size).toBeGreaterThan(5);
    for (const acao of escritas) expect(Object.keys(ACAO_DA_AUDITORIA)).toContain(acao);
    expect(acaoDaAuditoria('event.lock_fields')).toBe('trancou campos');
    expect(acaoDaAuditoria('uma_acao.nova')).toBe('uma acao nova');
  });
});
