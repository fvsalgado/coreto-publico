'use client';

import { useState, useSyncExternalStore } from 'react';
import { BotaoFavorito } from '@/src/components/BotaoFavorito';
import { Icone } from '@/src/components/Sinais';
import { recordStat } from '@/src/lib/analytics/beacon';
import { partilhar, type ResultadoDaPartilha } from '@/src/lib/partilhar';

interface Props {
  eventId: string;
  slug: string;
  title: string;
  /**
   * A fotografia que o coração guarda. Vem do cartão porque é o cartão que
   * já a tem desenhada — pedir de novo ao servidor o que está no ecrã seria
   * um pedido por cada coração de uma lista de quarenta.
   */
  paraGuardar: {
    date_start: string | null;
    date_end: string | null;
    start_time: string | null;
    location: string | null;
  };
}

const ACAO =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium leading-none underline-offset-4 hover:border-accent/40 hover:underline';

/** «Já estamos no navegador?» — a pergunta que `useSyncExternalStore` responde sem render a mais. */
function useNoNavegador(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * As três coisas que se fazem a um evento sem o abrir: guardar para depois,
 * pôr no calendário e avisar alguém.
 *
 * A Viral Agenda e a OpenAgenda têm-nas em cada cartão; aqui só existiam na
 * ficha, e decidir ir a um evento obrigava a abri-lo primeiro. O `.ics` já
 * existia por evento (`/evento/<slug>/agenda.ics`); o que faltava era a porta.
 *
 * O cartão inteiro é uma ligação esticada (ver `EventCard`), e estes dois
 * ficam por cima dela com `relative z-10` — senão o clique caía no título. Os
 * nomes acessíveis levam o título do evento: numa lista de quarenta cartões,
 * «Calendário, Calendário, Calendário» não diz a quem ouve de qual se trata.
 *
 * Guardar é uma âncora e funciona sem JavaScript; partilhar só aparece no
 * navegador, porque sem JavaScript era um botão que não fazia nada.
 */
export function AcoesDoCartao({ eventId, slug, title, paraGuardar }: Props) {
  const noNavegador = useNoNavegador();
  const [resultado, setResultado] = useState<ResultadoDaPartilha | null>(null);

  const aoPartilhar = async () => {
    recordStat(eventId, 'share');
    setResultado(null);
    setResultado(await partilhar(title, `/evento/${slug}`));
  };

  return (
    <div className="relative z-10 mt-2.5 flex flex-wrap items-center gap-2">
      <BotaoFavorito evento={{ slug, title, ...paraGuardar }} />
      <a
        href={`/evento/${slug}/agenda.ics`}
        aria-label={`Guardar «${title}» no calendário`}
        onClick={() => recordStat(eventId, 'ical_download')}
        className={ACAO}
      >
        <Icone nome="calendario" />
        Calendário
      </a>
      {noNavegador ? (
        <button
          type="button"
          aria-label={`Partilhar «${title}»`}
          onClick={() => void aoPartilhar()}
          className={ACAO}
        >
          <Icone nome="partilhar" />
          Partilhar
        </button>
      ) : null}
      <span aria-live="polite" className="text-xs text-muted">
        {resultado === 'copiado' ? 'Ligação copiada.' : null}
        {resultado === 'falhou' ? 'Não foi possível copiar.' : null}
      </span>
    </div>
  );
}
