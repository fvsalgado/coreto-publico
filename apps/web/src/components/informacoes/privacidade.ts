import { hasAnalytics, hasExtraction } from '@/src/lib/env';
import { IcCarta, IcContagem, IcSemRasto, IcTema, type Ponto } from './Pontos';

/**
 * De que é feita a política de privacidade: os quatro pontos do resumo e a
 * lista de subcontratantes.
 *
 * O texto por extenso vive em `app/[regiao]/privacidade/page.tsx`, e só lá.
 * Os pontos estão aqui porque duas páginas os mostram — a própria, à frente
 * do texto, e `/informacoes`, no resumo que aponta para ela — e o resumo de
 * uma política tem de dizer o mesmo que a política.
 */
export const PRIVACIDADE: readonly Ponto[] = [
  {
    Icone: IcSemRasto,
    titulo: 'Ninguém é seguido',
    texto:
      'Não há cookies de rastreio, publicidade nem botões de redes sociais. Nem de página em página, nem entre sítios.',
  },
  {
    Icone: IcTema,
    titulo: 'Uma só coisa fica no seu equipamento',
    texto:
      'A escolha de tema claro ou escuro, e só se carregar no botão. Não sai do seu navegador, não é lida por nós e não identifica ninguém.',
  },
  {
    Icone: IcContagem,
    titulo: 'Contam-se eventos, não pessoas',
    texto:
      'Cada ficha tem quatro contadores. São números por evento — sem endereço, sem sessão, sem hora. Servem para mostrar a quem programa que houve quem olhasse.',
  },
  {
    Icone: IcCarta,
    titulo: 'Quem envia um evento dá-nos um email',
    texto:
      'Serve para falarmos sobre o que foi enviado e nunca é publicado. Para o ver, corrigir ou apagar, basta escrever.',
  },
];

/**
 * A lista de subcontratantes acompanha a configuração real desta instalação:
 * sem chave do PostHog, o PostHog não corre — e uma política que o listasse
 * na mesma estaria a descrever um tratamento que não existe. O mesmo para o
 * serviço que lê os emails: até 19 de setembro de 2026 a lista só sabia do
 * PostHog, e com `EXTRACTION_API_KEY` configurada o assunto e o corpo de cada
 * email iam para um fornecedor fora da União Europeia que a política não
 * nomeava. O que se envia, e o que se corta antes de enviar, está em
 * `lib/intake/extract.ts`; o registo de tratamentos é o `docs/RGPD.md` §7.
 */
export const SUBCONTRATANTES = [
  'o do alojamento do sítio',
  'o da base de dados',
  hasAnalytics
    ? 'o PostHog, que recebe as estatísticas de utilização em servidores na União Europeia'
    : null,
  hasExtraction
    ? 'a Anthropic, que recebe o assunto e o texto de cada email enviado à agenda — sem o endereço de quem o enviou, e com as citações e a assinatura cortadas antes — para propor os campos do evento, em servidores fora da União Europeia'
    : null,
]
  .filter((parte): parte is string => parte !== null)
  .join(', ')
  .replace(/, ([^,]*)$/, ' e $1');
