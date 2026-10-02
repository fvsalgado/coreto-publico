import Link from 'next/link';
import { FotografiaDeCartao } from '@/src/components/FotografiaDeCartao';
import { Sinal } from '@/src/components/Sinais';
import { freguesiaCurta } from '@/src/lib/espaco';
import { formatVenueKind } from '@/src/lib/format';
import type { Venue } from '@/src/lib/queries/types';

interface Props {
  venue: Venue;
  /** Eventos marcados neste espaço, daqui para a frente. */
  count: number;
  /**
   * Não se confirmou que este lugar exista.
   *
   * Vem do levantamento dos coretos (`coretos.is_confirmed`) e não do
   * `status` do espaço: `provisional` quer dizer que a ficha entrou por fonte
   * secundária e não foi verificada no terreno — o que é verdade da
   * biblioteca da Barquinha, que existe e está aberta. Escrever «por
   * confirmar» a partir do `status` era dizer ao leitor que talvez o
   * cineteatro de Abrantes não exista, o que é falso.
   */
  porConfirmar?: boolean;
}

/**
 * O cartão de um espaço — deitado no telemóvel, de pé a partir do tablet.
 *
 * A lista dos espaços tem oitenta cartões. Com a fotografia por cima do texto
 * e uma coluna só, isso dava vinte e nove mil pixéis de altura: trinta e
 * quatro ecrãs de telemóvel para percorrer uma lista. Deitado — miniatura
 * quadrada à esquerda, texto à direita — o mesmo cartão ocupa um terço, e
 * ganha o ritmo dos cartões de evento, que já eram assim.
 *
 * Num ecrã largo há colunas para a fotografia respirar, e aí volta a ficar
 * por cima: é a mesma informação, arrumada para o espaço que existe.
 */
export function VenueCard({ venue, count, porConfirmar = false }: Props) {
  const tipo = venue.is_association ? 'Coletividade' : formatVenueKind(venue.kind);

  // A moldura a tracejado é a mesma que a página dos coretos usa para o que
  // está por confirmar — a dúvida diz-se com o mesmo sinal em toda a casa.
  return (
    <li
      className={`ct-lift relative flex overflow-hidden rounded-lg border bg-surface sm:flex-col ${
        porConfirmar ? 'border-dashed border-border' : 'border-border'
      }`}
    >
      {/* A capa do espaço por baixo, a fotografia por cima — ver
          `FotografiaDeCartao`. A capa diz pela cor e pelo nome o que o espaço
          é (C1-017): era um quadrado turquesa pálido com o coreto a 12 %,
          igual para um cine-teatro, uma biblioteca e um museu, em quatro de
          cada dez cartões desta lista. */}
      <FotografiaDeCartao
        url={venue.image_url}
        kind={venue.kind}
        isAssociation={venue.is_association}
      />

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-3.5">
        <p className="font-medium leading-snug">
          {/* Sem pré-carregamento: a lista tem mais de cem cartões, e o Next
              pré-carregava a ficha de cada um que passasse pelo ecrã — cento e
              tal pedidos numa rolagem, de páginas que quase ninguém abre. Ao
              tocar, a ficha abre como sempre. */}
          <Link
            href={`/espaco/${venue.id}`}
            prefetch={false}
            className="underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {venue.name}
          </Link>
        </p>
        {/* Há uniões de freguesias com nomes de cinco linhas — «Abrantes (São
            Vicente e São João) e Alferrarede (margem norte) / São Miguel do
            Rio Torto…». Num cartão de telemóvel isso afoga o nome do espaço,
            que é o que ali se vai procurar; a ficha do espaço tem a linha
            inteira. */}
        {/* Sem fotografia, o tipo está escrito na capa ao lado, e dizê-lo
            outra vez aqui era a mesma palavra duas vezes no mesmo cartão. Fica
            para quem ouve, que não vê a capa. */}
        <p className="mt-0.5 line-clamp-2 text-sm text-muted sm:line-clamp-none">
          {venue.image_url ? (
            [tipo, freguesiaCurta(venue.parish)]
              .filter((part): part is string => Boolean(part))
              .join(' · ')
          ) : (
            <>
              <span className="sr-only">{tipo}. </span>
              {freguesiaCurta(venue.parish)}
            </>
          )}
        </p>

        {/* A apresentação do espaço, mas só a partir do tablet.
            No telemóvel o cartão é deitado e a lista tem oitenta: duas linhas
            de texto por cartão são quase três mil píxeis a mais para percorrer
            — que é exatamente o que se acabou de tirar a esta página. Em
            ecrã largo há duas ou três colunas, o custo divide-se por elas, e a
            grelha ganha o que lhe faltava: saber-se o que é cada sítio sem ter
            de abrir oitenta fichas.

            `line-clamp-2` põe `display: -webkit-box` e `hidden` põe
            `display: none`: as duas na mesma classe base decidem-se pela ordem
            do ficheiro, que não é sítio onde apoiar uma decisão. Com
            `max-sm:hidden` a que esconde é a variante, e as variantes vêm
            sempre depois — a regra é do Tailwind e não do acaso. */}
        {venue.description ? (
          <p className="mt-1.5 line-clamp-2 text-sm max-sm:hidden">{venue.description}</p>
        ) : null}

        {count > 0 || porConfirmar || venue.wheelchair_accessible === true ? (
          <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-sm">
            {/* Uma pílula e não uma frase: é o sinal que distingue os espaços
                com programação, que a lista passou a pôr primeiro (C1-017). */}
            {count > 0 ? (
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent">
                {count === 1 ? '1 evento marcado' : `${count} eventos marcados`}
              </span>
            ) : null}
            {porConfirmar ? (
              <span className="text-sm font-semibold text-muted">Por confirmar</span>
            ) : null}
            {/* O acesso que o espaço declara, com o mesmo sinal dos cartões de
                evento (C2-012). Só o «sim», como lá: a falta de declaração não
                é sinal, e o «não tem» verificado fica para a ficha. */}
            {venue.wheelchair_accessible === true ? (
              <Sinal icone="acessivel" rotulo="Acesso a cadeiras de rodas">
                Acessível
              </Sinal>
            ) : null}
          </p>
        ) : null}
      </div>
    </li>
  );
}
