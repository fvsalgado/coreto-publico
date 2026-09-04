import { describe, expect, it } from 'vitest';
import { ADMIN_LOGIN_PATH, adminLoginPath, barreiraDoLayout } from './guarda';

describe('adminLoginPath', () => {
  it('guarda o caminho a que a pessoa ia', () => {
    expect(adminLoginPath('/admin/fila')).toBe('/admin/entrar?destino=%2Fadmin%2Ffila');
  });

  // O painel é para onde a entrada vai dar; repeti-lo no `destino` não
  // acrescenta nada.
  it('não guarda destino para o painel', () => {
    expect(adminLoginPath('/admin')).toBe(ADMIN_LOGIN_PATH);
  });

  it('não manda a entrada para si própria', () => {
    expect(adminLoginPath(ADMIN_LOGIN_PATH)).toBe(ADMIN_LOGIN_PATH);
  });
});

describe('barreiraDoLayout', () => {
  it('deixa passar quem tem sessão', () => {
    expect(barreiraDoLayout(true, '/admin/fila')).toBeNull();
  });

  // A leitura que estava aberta: sem sessão, a fila de moderação não se serve.
  it('barra uma leitura sem sessão, e leva o destino consigo', () => {
    expect(barreiraDoLayout(false, '/admin/auditoria')).toBe(
      '/admin/entrar?destino=%2Fadmin%2Fauditoria',
    );
  });

  // O erro que esta função existe para não se cometer: o layout envolve
  // também a página de entrada, e barrá-la mandava-a para si própria.
  it('nunca barra a própria página de entrada', () => {
    expect(barreiraDoLayout(false, ADMIN_LOGIN_PATH)).toBeNull();
  });

  // Sem cabeçalho o layout não sabe onde está. Barrar às cegas era arriscar o
  // ciclo; nesse cenário quem barra é o middleware.
  it('não barra quando o middleware não disse nada', () => {
    expect(barreiraDoLayout(false, null)).toBeNull();
  });
});
