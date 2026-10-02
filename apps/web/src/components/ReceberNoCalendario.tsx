import { BotaoDeCopiar } from '@/src/components/BotaoDeCopiar';
import type { EnderecosDoCalendario } from '@/src/lib/subscrever';

/** Um calendário com uma marca de mais, no traço da casa. */
function IconeDoCalendario({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M12 13.5v5M9.5 16h5" />
    </svg>
  );
}

/**
 * O botão que subscreve — o `webcal:` do calendário.
 *
 * É a ação de quem quer «a agenda de Tomar no telemóvel» e não sabe o que é
 * um `.ics`: no iPhone e no Mac abre a caixa de subscrição do Calendário, que
 * se atualiza sozinha todas as noites. O nome diz o que acontece, e não o
 * formato (C2-033): chamava-se «Calendário iCal».
 */
export function BotaoDeSubscrever({
  nome,
  enderecos,
  className = '',
}: {
  /** «Tomar» — de quem é a agenda que se recebe. */
  nome: string;
  enderecos: EnderecosDoCalendario;
  className?: string;
}) {
  return (
    <a
      href={enderecos.webcal}
      className={`inline-flex min-h-11 items-center gap-2 rounded bg-accent px-4 text-sm font-semibold text-on-accent ${className}`}
    >
      <IconeDoCalendario className="size-5 shrink-0" />
      Receber a agenda de {nome} no calendário
    </a>
  );
}

/**
 * Receber a agenda no calendário, com as alternativas todas.
 *
 * O botão de cima serve quem tem iPhone, iPad ou Mac. Os outros precisam de
 * outra porta, e é para isso que este bloco existe: o Google Calendar só
 * subscreve por endereço, e no computador; o Outlook tem a mesma caixa noutro
 * menu. Por isso o endereço vai à vista e com botão de copiar.
 *
 * O ficheiro para descarregar fica no fim, e dito pelo que é: uma fotografia
 * do dia, que não se atualiza. Era a única coisa que a página oferecia.
 */
export function ReceberNoCalendario({
  nome,
  enderecos,
  caminho,
}: {
  nome: string;
  enderecos: EnderecosDoCalendario;
  /** O caminho do `.ics` neste sítio, para o descarregar sem sair daqui. */
  caminho: string;
}) {
  return (
    <div className="max-w-2xl rounded-lg border border-border bg-surface p-4 sm:p-5">
      <p className="text-sm">
        Uma subscrição atualiza-se sozinha: o que entrar na agenda de {nome} aparece no seu
        calendário, sem ter de voltar aqui.
      </p>
      <BotaoDeSubscrever nome={nome} enderecos={enderecos} className="mt-3" />
      <p className="mt-2 text-sm text-muted">
        No iPhone, no iPad e no Mac, o botão abre a subscrição no Calendário; no computador, também
        no Outlook e no Thunderbird.
      </p>

      <ul className="mt-4 space-y-2 text-sm">
        <li>
          <strong className="font-semibold">Google Calendar e Android</strong> — a subscrição faz-se
          no computador:{' '}
          <a href={enderecos.google} rel="noopener" className="underline underline-offset-4">
            abrir no Google Calendar
          </a>
          , ou em «Outros calendários», «A partir do URL», colar o endereço que está em baixo.
        </li>
        <li>
          <strong className="font-semibold">Outlook na Web</strong> — «Adicionar calendário»,
          «Subscrever a partir da Web», e colar o endereço.
        </li>
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="min-w-0 rounded bg-accent-soft px-2 py-1 text-sm break-all">
          {enderecos.https}
        </code>
        <BotaoDeCopiar
          texto={enderecos.https}
          etiqueta="Copiar o endereço"
          anuncio="Endereço do calendário copiado."
        />
      </div>

      <p className="mt-4 text-sm text-muted">
        Para guardar só o que há hoje, sem atualizações,{' '}
        <a href={caminho} className="underline underline-offset-4">
          descarregar o ficheiro do calendário
        </a>
        .
      </p>
    </div>
  );
}
