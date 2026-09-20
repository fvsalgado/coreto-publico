'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { Icone } from '@/src/components/Sinais';
import {
  NENHUM,
  esquecer,
  esquecerTudo,
  favoritos,
  porOrdemDeData,
  subscrever,
  type Favorito,
} from '@/src/lib/favoritos';
import { formatEventDates, formatShortDate, formatTime } from '@/src/lib/format';

interface Props {
  /** O endereço público desta região, para os `.ics` e as ligações do ficheiro. */
  origem: string;
  nomeDoSitio: string;
  /** Hoje em Lisboa, vindo do servidor: o cliente não decide que dia é. */
  hoje: string;
}

const ACAO =
  'inline-flex min-h-11 items-center gap-2 rounded border border-border bg-surface px-4 text-sm font-medium underline-offset-4 hover:underline';

/**
 * A lista de guardados deste navegador.
 *
 * Toda de cliente, porque o que ela mostra nunca sai deste aparelho — o
 * servidor não sabe o que aqui está e não tem como saber. No primeiro render,
 * e no HTML que o servidor manda, a lista está vazia: é a única coisa
 * verdadeira que se pode dizer antes de ler o armazenamento.
 *
 * **A fotografia pode ter envelhecido, e isso diz-se.** Cada ficha traz o dia
 * em que foi guardada e liga para a página do evento; se a sessão mudou de
 * hora, é lá que está a verdade. Esconder a data seria deixar a lista passar
 * por atual.
 */
export function ListaDeFavoritos({ origem, nomeDoSitio, hoje }: Props) {
  const guardados = useSyncExternalStore(subscrever, favoritos, () => NENHUM);
  const [aExportar, setAExportar] = useState(false);

  if (guardados.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <p className="text-muted">
          Ainda não guardou nada. O coração de cada evento na agenda guarda-o aqui — sem conta e sem
          sair deste navegador.
        </p>
        <Link
          href="/agenda"
          className="mt-4 inline-flex min-h-11 items-center rounded bg-accent px-5 text-sm font-medium text-on-accent"
        >
          Ver a agenda
        </Link>
      </div>
    );
  }

  const ordenados = porOrdemDeData(guardados, hoje);

  /*
   * O ficheiro nasce e morre no navegador.
   *
   * Um `Blob` com um endereço temporário, um clique num `<a download>` que
   * nunca esteve no documento, e o endereço libertado a seguir. Nada disto
   * passa pelo servidor — nem podia: a lista não está lá. O construtor de
   * iCalendar vem por `import()` para as trezentas linhas dele não pesarem
   * em quem nunca carrega neste botão.
   */
  const descarregar = async () => {
    setAExportar(true);
    try {
      const { calendarioDosFavoritos } = await import('@/src/lib/favoritos-calendario');
      const texto = calendarioDosFavoritos(ordenados, origem, nomeDoSitio);
      const endereco = URL.createObjectURL(new Blob([texto], { type: 'text/calendar' }));
      const ligacao = document.createElement('a');
      ligacao.href = endereco;
      ligacao.download = 'guardados.ics';
      ligacao.click();
      URL.revokeObjectURL(endereco);
    } finally {
      setAExportar(false);
    }
  };

  const comData = ordenados.filter((item) => item.date_start !== null).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void descarregar()}
          disabled={aExportar}
          className={ACAO}
        >
          <Icone nome="calendario" />
          {aExportar ? 'A preparar…' : 'Guardar tudo no calendário'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('Esquecer os eventos guardados neste navegador?')) esquecerTudo();
          }}
          className="inline-flex min-h-11 items-center rounded px-3 text-sm underline underline-offset-4"
        >
          Esquecer tudo
        </button>
      </div>

      {comData < ordenados.length ? (
        <p className="mt-2 text-sm text-muted">
          {ordenados.length - comData === 1
            ? 'Um dos guardados não tem data e por isso não entra no ficheiro de calendário.'
            : `${ordenados.length - comData} dos guardados não têm data e por isso não entram no ficheiro de calendário.`}
        </p>
      ) : null}

      <ul className="mt-6 grid gap-3">
        {ordenados.map((favorito) => (
          <Ficha key={favorito.slug} favorito={favorito} hoje={hoje} />
        ))}
      </ul>
    </>
  );
}

function Ficha({ favorito, hoje }: { favorito: Favorito; hoje: string }) {
  const hora = formatTime(favorito.start_time);
  const quando = favorito.date_start
    ? formatEventDates(favorito.date_start, favorito.date_end, hoje)
    : 'Sem data';
  const passou = (favorito.date_end ?? favorito.date_start ?? '') < hoje;

  return (
    <li className="relative flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="min-w-0">
        <p className="text-sm text-muted">
          <span className={passou ? '' : 'font-medium text-highlight'}>{quando}</span>
          {hora ? ` · ${hora}` : ''}
          {passou ? ' · já passou' : ''}
        </p>
        <h2 className="font-display mt-1 text-lg leading-snug font-semibold">
          <Link
            href={`/evento/${favorito.slug}`}
            className="underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {favorito.title}
          </Link>
        </h2>
        {favorito.location ? <p className="mt-1 text-sm text-muted">{favorito.location}</p> : null}
        <p className="mt-2 text-xs text-muted">
          Guardado a {formatShortDate(favorito.guardadoEm.slice(0, 10))}. A página do evento é a que
          manda.
        </p>
      </div>

      <button
        type="button"
        onClick={() => esquecer(favorito.slug)}
        aria-label={`Esquecer «${favorito.title}»`}
        className="relative z-10 inline-flex min-h-11 shrink-0 items-center rounded px-3 text-sm underline underline-offset-4"
      >
        Esquecer
      </button>
    </li>
  );
}
