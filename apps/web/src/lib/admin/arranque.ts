/**
 * A lista de arranque de uma região: o que está feito e o que falta para a
 * agenda abrir ao público (C4-031).
 *
 * O nascimento de uma região é bom — a prosa compõe, os concelhos aparecem a
 * zero com o convite certo, o estado vazio é honesto —, mas o que faltava
 * vivia em sete sítios: a cor no formulário, os logótipos num commit, as
 * fontes na página delas, os coretos na secção, a licença mais abaixo. Quem
 * opera tinha de os percorrer de cabeça, e quem mostra a agenda à CIM no
 * primeiro dia («olhem, já existe») não tinha uma folha para lhe mostrar.
 * Esta é essa folha: uma linha por passo, com o estado e o que fazer.
 *
 * Função pura do que a ficha da região já leu: não vai à base.
 */

export type EstadoDoPasso = 'feito' | 'por-fazer' | 'nota';

export interface PassoDeArranque {
  chave: string;
  rotulo: string;
  estado: EstadoDoPasso;
  texto: string;
}

export interface DadosDoArranque {
  /** A cor da região, e a do produto, que é a omissão (0167). */
  cor: string | null;
  corPorOmissao: string;
  temLogotipo: boolean;
  /** Os concelhos da região, e as fontes ligadas de cada um. */
  concelhos: number;
  concelhosComFonteLigada: number;
  fontesLigadas: number;
  coretos: number;
  seccaoDosCoretosLigada: boolean;
  /** A frase da licença em vigor (`estadoDaLicenca`), e se há alguma. */
  licenca: { texto: string; alerta: boolean; existe: boolean };
  barreiraLigada: boolean;
  temResponsavelProprio: boolean;
  dominio: string;
}

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`;
}

export function passosDeArranque(dados: DadosDoArranque): PassoDeArranque[] {
  const passos: PassoDeArranque[] = [];

  passos.push(
    dados.cor && dados.cor !== dados.corPorOmissao
      ? { chave: 'cor', rotulo: 'Cor', estado: 'feito', texto: `A da região, ${dados.cor}.` }
      : {
          chave: 'cor',
          rotulo: 'Cor',
          estado: 'por-fazer',
          texto: 'Veste ainda o vermelho do produto. A cor da região escolhe-se em «Cor», abaixo.',
        },
  );

  passos.push(
    dados.temLogotipo
      ? { chave: 'logotipo', rotulo: 'Logótipo', estado: 'feito', texto: 'Assina com o logótipo.' }
      : {
          chave: 'logotipo',
          rotulo: 'Logótipo',
          estado: 'por-fazer',
          texto:
            'Assina em texto, com o nome do promotor. Os ficheiros pedem-se à CIM: um a branco e um escuro.',
        },
  );

  const todos = dados.concelhos > 0 && dados.concelhosComFonteLigada === dados.concelhos;
  passos.push({
    chave: 'fontes',
    rotulo: 'Agendas lidas',
    estado: todos ? 'feito' : 'por-fazer',
    texto:
      dados.fontesLigadas === 0
        ? 'Nenhuma ligada ainda: o que entrar chega por email. O estado público di-lo assim, sem alarme.'
        : `${plural(dados.fontesLigadas, 'fonte ligada', 'fontes ligadas')}; ` +
          `${dados.concelhosComFonteLigada} de ${plural(dados.concelhos, 'concelho', 'concelhos')} com pelo menos uma.`,
  });

  passos.push(
    dados.coretos > 0
      ? {
          chave: 'coretos',
          rotulo: 'Coretos',
          estado: 'feito',
          texto: `${plural(dados.coretos, 'coreto', 'coretos')} no levantamento.`,
        }
      : dados.seccaoDosCoretosLigada
        ? {
            chave: 'coretos',
            rotulo: 'Coretos',
            estado: 'por-fazer',
            texto:
              'O levantamento está vazio e a secção está ligada: quem a abrir encontra uma página por fazer. Desligue-a nas secções até haver coretos.',
          }
        : {
            chave: 'coretos',
            rotulo: 'Coretos',
            estado: 'feito',
            texto: 'Secção desligada até haver levantamento.',
          },
  );

  passos.push({
    chave: 'licenca',
    rotulo: 'Licença',
    estado: dados.licenca.existe && !dados.licenca.alerta ? 'feito' : 'por-fazer',
    texto: dados.licenca.texto,
  });

  passos.push({
    chave: 'barreira',
    rotulo: 'Porta',
    estado: 'nota',
    texto: dados.barreiraLigada
      ? 'Fechada com senha: só entra quem a tiver. Abre-se quando a CIM disser.'
      : 'Aberta: quem souber o endereço vê a agenda.',
  });

  passos.push({
    chave: 'responsavel',
    rotulo: 'Dados pessoais',
    estado: 'nota',
    texto: dados.temResponsavelProprio
      ? 'A política de privacidade nomeia o responsável que a região declarou.'
      : 'A política de privacidade nomeia o promotor como responsável, por omissão.',
  });

  passos.push({
    chave: 'dominio',
    rotulo: 'Endereço',
    estado: 'nota',
    texto: `https://${dados.dominio} — o DNS e o certificado são do operador (docs/NOVA-CIM.md, passo 2).`,
  });

  return passos;
}
