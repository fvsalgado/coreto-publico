import { hasAnalytics } from '@/src/lib/env';
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
 * na mesma estaria a descrever um tratamento que não existe.
 */
export const SUBCONTRATANTES = hasAnalytics
  ? 'o do alojamento do sítio, o da base de dados e o PostHog, que recebe as estatísticas de utilização em servidores na União Europeia'
  : 'o do alojamento do sítio e o da base de dados';
