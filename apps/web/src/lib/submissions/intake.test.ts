import { describe, expect, it } from 'vitest';
import { publicSubmissionSchema } from '@coreto/core';
import { fieldErrorsFrom } from './intake';

/**
 * As mensagens de erro do formulário, contra o schema a sério.
 *
 * Existe por causa da subida do Zod 3 para o 4, que mudou por baixo os códigos
 * dos problemas de validação — o `invalid_string` com `validation` passou a
 * `invalid_format` com `format`, e o tipo recebido passou a vir em `input`. A
 * tradução para português lia esses campos, e nada nos 1374 testes tocava nela:
 * o teste da rota faz mock do `receiveSubmission`, portanto passava a verde com
 * as mensagens todas partidas.
 *
 * Por isso as entradas aqui são inválidas de verdade e as mensagens saem do
 * schema partilhado, e não de um objecto de problemas escrito à mão. Um objecto
 * escrito à mão continuaria a passar depois de a biblioteca mudar de forma, que
 * é exactamente o que este teste existe para apanhar.
 */
function errosDe(entrada: Record<string, unknown>) {
  const resultado = publicSubmissionSchema.safeParse(entrada);
  if (resultado.success) throw new Error('a entrada devia ser inválida');
  return fieldErrorsFrom(resultado.error.issues);
}

const VALIDA = {
  title: 'Concerto no coreto',
  description: 'Uma tarde de música no jardim.',
  categorySlug: 'musica',
  startDate: '2027-06-01',
  municipalityId: 'tomar',
  contactEmail: 'quem@envia.pt',
  consent: true,
};

describe('mensagens de erro do formulário público', () => {
  it('um campo obrigatório em falta diz que falta preencher', () => {
    const erros = errosDe({ ...VALIDA, title: undefined });
    expect(erros.title).toBe('Falta preencher este campo.');
  });

  it('um endereço mal escrito diz o que se espera dele', () => {
    const erros = errosDe({ ...VALIDA, ticketingUrl: 'www.bilhetes.pt' });
    expect(erros.ticketingUrl).toBe('Tem de ser um endereço completo, a começar por https://.');
  });

  it('um texto demasiado longo diz quantos caracteres cabem', () => {
    const erros = errosDe({ ...VALIDA, title: 'a'.repeat(500) });
    expect(erros.title).toMatch(/Não pode passar dos \d+ caracteres\./);
  });

  it('um email inválido usa a mensagem que o schema já escreve', () => {
    const erros = errosDe({ ...VALIDA, contactEmail: 'não é um email' });
    expect(erros.contactEmail).toBe('Endereço de email inválido.');
  });

  it('o consentimento por dar tem a mensagem escrita no schema', () => {
    const erros = errosDe({ ...VALIDA, consent: false });
    expect(erros.consent).toBe('É preciso aceitar a política de privacidade.');
  });
});
