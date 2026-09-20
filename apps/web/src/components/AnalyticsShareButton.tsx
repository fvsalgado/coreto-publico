'use client';

import { useState, useSyncExternalStore } from 'react';
import { recordStat } from '@/src/lib/analytics/beacon';
import { partilhar, type ResultadoDaPartilha } from '@/src/lib/partilhar';

interface Props {
  eventId: string;
  title: string;
  url: string;
}

/**
 * Partilhar um evento — e contar que foi partilhado.
 *
 * Só aparece depois de a página ganhar vida no navegador. Sem JavaScript, um
 * botão destes seria um controlo que não faz nada, e um controlo que não faz
 * nada é pior do que não existir: quem navega com leitor de ecrã anuncia-o,
 * carrega, e não acontece coisa nenhuma.
 *
 * O que se conta é o clique, não a partilha concluída — o sistema operativo
 * não diz se a pessoa chegou a enviar a mensagem depois de abrir o menu. A
 * página de estatísticas e a política de privacidade dizem exatamente isto,
 * para o número não ser lido como aquilo que não é.
 */
/**
 * `useSyncExternalStore` e não `useState` mais `useEffect`.
 *
 * A pergunta «já estamos no navegador?» responde-se com um valor diferente no
 * servidor e no cliente, que é exatamente para isto que este gancho serve.
 * Fazê-lo com um estado que um efeito escreve provoca um segundo render em
 * cascata logo a seguir ao primeiro — e o React 19 assinala-o como erro, com
 * razão.
 */
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function AnalyticsShareButton({ eventId, title, url }: Props) {
  const isClient = useIsClient();
  const [feedback, setFeedback] = useState<ResultadoDaPartilha | null>(null);

  if (!isClient) return null;

  // A regra de partilhar — menu do sistema, senão copiar — está em
  // `lib/partilhar.ts`, que os cartões da agenda também usam.
  const share = async (): Promise<void> => {
    recordStat(eventId, 'share');
    setFeedback(null);
    setFeedback(await partilhar(title, url));
  };

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-11 items-center rounded border border-field bg-surface px-4 text-sm font-medium underline-offset-4 hover:underline"
      >
        Partilhar
      </button>
      <span aria-live="polite" className="text-sm text-muted">
        {feedback === 'copiado' ? 'Ligação copiada.' : null}
        {feedback === 'falhou' ? 'Não foi possível copiar. Copie o endereço da barra.' : null}
      </span>
    </span>
  );
}
