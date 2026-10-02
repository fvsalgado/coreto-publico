import { describe, expect, it } from 'vitest';
import {
  anfitrioesDeFora,
  chaveDaFotografia,
  ficheiroDoCommons,
  fonteDaFotografia,
  fundoDaFotografia,
  miniaturaDoCommons,
} from './fotografia';

const VIRGINIA =
  'https://commons.wikimedia.org/wiki/Special:FilePath/Teatro_Virg%C3%ADnia.jpg?width=1600';
const BLOGUE =
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjl6Ad0/s1600/HPIM6453+-+Espite.JPG';
const ARQUIVO = 'https://cms.infoportugal.info/media/fotos/final/Tomar/TOM9276.jpg';

describe('ficheiroDoCommons', () => {
  it('lê o nome do ficheiro do endereço guardado, descodificado', () => {
    expect(ficheiroDoCommons(VIRGINIA)).toBe('Teatro_Virgínia.jpg');
  });

  it('não confunde um endereço de outra casa com o Commons', () => {
    expect(ficheiroDoCommons(BLOGUE)).toBeNull();
    expect(ficheiroDoCommons(ARQUIVO)).toBeNull();
    expect(ficheiroDoCommons('')).toBeNull();
    expect(ficheiroDoCommons('/imagens/local.jpg')).toBeNull();
  });

  it('recusa um nome que traz um caminho escondido', () => {
    expect(
      ficheiroDoCommons('https://commons.wikimedia.org/wiki/Special:FilePath/a%2F..%2Fb.jpg'),
    ).toBeNull();
  });
});

describe('miniaturaDoCommons', () => {
  /*
   * Os dois casos verificados contra o redirecionamento do próprio Commons a
   * 2/10/2026 (os 58 endereços distintos do catálogo bateram todos certo): o
   * MD5 do nome dá as duas pastas, e o nome vai codificado como o MediaWiki o
   * codifica — a vírgula em `%2C`, o apóstrofo em `%27`.
   */
  it('dá o endereço final da miniatura, com as pastas do MD5', () => {
    expect(miniaturaDoCommons('Teatro_Virgínia.jpg', 500)).toBe(
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Teatro_Virg%C3%ADnia.jpg/500px-Teatro_Virg%C3%ADnia.jpg',
    );
    expect(
      miniaturaDoCommons(
        'Vista_aproximada_para_fachada_principal_do_Cine-Teatro_Paraíso,_em_Tomar.jpg',
        960,
      ),
    ).toBe(
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Vista_aproximada_para_fachada_principal_do_Cine-Teatro_Para%C3%ADso%2C_em_Tomar.jpg/960px-Vista_aproximada_para_fachada_principal_do_Cine-Teatro_Para%C3%ADso%2C_em_Tomar.jpg',
    );
  });

  it('codifica o apóstrofo como o MediaWiki', () => {
    expect(miniaturaDoCommons("Biblioteca_Alexandre_O'Neill.jpg", 330)).toContain(
      '/330px-Biblioteca_Alexandre_O%27Neill.jpg',
    );
  });

  it('não inventa miniatura para um formato que o Commons desenha noutro', () => {
    expect(miniaturaDoCommons('Planta.svg', 500)).toBeNull();
    expect(miniaturaDoCommons('Digitalizacao.tif', 500)).toBeNull();
  });
});

describe('fonteDaFotografia', () => {
  it('serve as do Commons pelo próprio sítio, com uma medida por escalão', () => {
    const chave = chaveDaFotografia(VIRGINIA);
    const fonte = fonteDaFotografia(VIRGINIA, [500, 960, 1280]);
    expect(fonte.src).toBe(`/fotografia/${chave}/500`);
    expect(fonte.srcSet).toBe(
      `/fotografia/${chave}/500 500w, /fotografia/${chave}/960 960w, /fotografia/${chave}/1280 1280w`,
    );
  });

  it('não aponta nada à Wikimedia: o navegador de quem visita não lhe pede coisa nenhuma', () => {
    const fonte = fonteDaFotografia(VIRGINIA, [330, 500]);
    expect(`${fonte.src} ${fonte.srcSet}`).not.toMatch(/wikimedia|wikipedia/);
  });

  it('pede ao blogue a largura no próprio caminho', () => {
    const fonte = fonteDaFotografia(BLOGUE, [330, 960]);
    expect(fonte.src).toBe(
      'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjl6Ad0/w330/HPIM6453+-+Espite.JPG',
    );
    expect(fonte.srcSet).toContain('/w960/HPIM6453+-+Espite.JPG 960w');
  });

  it('deixa intacto o que só tem uma medida', () => {
    expect(fonteDaFotografia(ARQUIVO, [330, 500])).toEqual({ src: ARQUIVO });
  });

  it('dá chaves diferentes a fotografias diferentes, e a mesma à mesma', () => {
    expect(chaveDaFotografia(VIRGINIA)).toMatch(/^[0-9a-f]{16}$/);
    expect(chaveDaFotografia(VIRGINIA)).toBe(chaveDaFotografia(VIRGINIA));
    expect(chaveDaFotografia(VIRGINIA)).not.toBe(chaveDaFotografia(BLOGUE));
  });
});

describe('fundoDaFotografia', () => {
  it('aceita o caminho do próprio sítio, e só esse, como relativo', () => {
    const src = fonteDaFotografia(VIRGINIA, [330]).src;
    expect(fundoDaFotografia(src)).toBe(`url("${src}")`);
    expect(fundoDaFotografia('/outra/coisa.jpg')).toBeUndefined();
    expect(fundoDaFotografia('javascript:alert(1)')).toBeUndefined();
  });

  it('passa os de fora pela mesma desconfiança dos cartazes', () => {
    expect(fundoDaFotografia(ARQUIVO)).toBe(`url("${ARQUIVO}")`);
  });
});

describe('anfitrioesDeFora', () => {
  it('nomeia só os servidores a que o navegador ainda pede fotografias', () => {
    expect(anfitrioesDeFora([VIRGINIA, BLOGUE, ARQUIVO, null, BLOGUE, 'não é endereço'])).toEqual([
      'blogger.googleusercontent.com',
      'cms.infoportugal.info',
    ]);
  });
});
