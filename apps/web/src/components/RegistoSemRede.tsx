'use client';

import { useEffect } from 'react';
import { favoritos, subscrever } from '@/src/lib/favoritos';

/** O prefixo das caches do service worker — ver `app/[regiao]/sw.js/route.ts`. */
const PREFIXO_DA_CACHE = 'coreto-sem-rede';

/**
 * Instala o service worker a quem o pediu, e tira-o a quem deixou de o pedir.
 *
 * **Pediu quem guardou um evento, ou quem instalou a aplicação.** É a regra que
 * esta casa já segue para o que fica no equipamento de quem visita: as duas
 * chaves do `localStorage` só se escrevem depois de a pessoa carregar num botão
 * (`docs/RGPD.md` §2.6), e é por isso que não há aviso de cookies — o artigo
 * 5.º da Lei n.º 41/2004 ressalva o armazenamento estritamente necessário a um
 * serviço que a pessoa pediu. Os guardados existem para se verem mais tarde, e
 * a página sem rede é o que os deixa ver onde não há rede; a aplicação
 * instalada é um pedido de aplicação, e uma aplicação que não abre sem rede
 * parece avariada. Quem só passa pela agenda não fica com nada.
 *
 * **E sai quando o pedido acaba.** «Esquecer tudo» numa página aberta no
 * navegador tira o service worker e apaga a casca que ele guardou: a promessa
 * de que limpar os guardados limpa o que o sítio deixou no aparelho continua
 * verdadeira.
 *
 * Só na compilação de produção: em desenvolvimento os ficheiros mudam a cada
 * gravação, e uma casca guardada servia uma versão que já não existe.
 */
export function RegistoSemRede() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const instalada =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    const decidir = () => {
      if (instalada || favoritos().length > 0) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
          // Uma região tapada pela barreira responde à página da senha, e não
          // ao código: sem bilhete não há service worker, e não faz falta.
        });
        return;
      }
      void navigator.serviceWorker
        .getRegistration('/')
        .then((registo) => registo?.unregister())
        .then(() => caches.keys())
        .then((nomes) =>
          Promise.all(
            nomes
              .filter((nome) => nome.startsWith(PREFIXO_DA_CACHE))
              .map((nome) => caches.delete(nome)),
          ),
        )
        .catch(() => {});
    };

    decidir();
    return subscrever(decidir);
  }, []);

  return null;
}
