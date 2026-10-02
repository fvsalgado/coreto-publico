import { BandstandMark } from '@/src/components/BandstandMark';
import { corDoEspaco } from '@/src/lib/espaco';
import { formatVenueKind } from '@/src/lib/format';

/**
 * A capa de um espaço — o chão por baixo da fotografia, e a cara de quem não
 * a tem.
 *
 * É a mesma ideia da capa tipográfica dos eventos (`Capa.tsx`): o que tem de
 * aguentar a falta de uma imagem é um desenho, e não um retângulo vazio. A
 * cor diz o que o espaço é (`corDoEspaco`), o nome do tipo escreve-o, e o
 * coreto em filigrana é a assinatura da casa (C1-017).
 *
 * Fica **sempre** desenhada, e a fotografia pousa por cima. Quando ela falha
 * — o Commons a recusar pedidos, o blogue a mudar de endereço —, o que se vê é
 * isto e não o ícone de imagem partida (C1-016). Decorativa de ponta a ponta:
 * o nome e o tipo do espaço estão sempre escritos ao lado.
 *
 * A escala é da caixa, por `@container`, como a da capa dos eventos: a mesma
 * capa serve a miniatura de 96 píxeis do cartão e a moldura larga da ficha.
 */
export function CapaDoEspaco({
  kind,
  isAssociation,
  semRotulo = false,
  className = '',
}: {
  kind: string;
  isAssociation: boolean;
  /**
   * Sem o nome do tipo: numa lista em que são todos do mesmo — o levantamento
   * dos coretos —, «Coreto» escrito em cada capa não diz nada a ninguém.
   */
  semRotulo?: boolean;
  className?: string;
}) {
  const rotulo = isAssociation ? 'Coletividade' : formatVenueKind(kind);
  return (
    <div
      aria-hidden="true"
      className={`@container absolute inset-0 overflow-hidden ${corDoEspaco(kind, isAssociation)} ${className}`}
    >
      {/* O grão vai numa caixa de dentro: `ct-grain` põe `position:
          relative`, e na mesma caixa ganhava ao `absolute` — a capa ficava
          sem altura nenhuma e não se via. */}
      <div className="ct-grain h-full w-full">
        <BandstandMark className="absolute -right-2 -bottom-2 size-16 opacity-[0.28] @min-[16rem]:-right-4 @min-[16rem]:-bottom-4 @min-[16rem]:size-40" />
        {semRotulo ? null : (
          <p className="font-display absolute top-2 right-2 left-2.5 text-[0.9375rem] leading-tight font-semibold @min-[16rem]:top-4 @min-[16rem]:left-5 @min-[16rem]:text-2xl">
            {rotulo}
          </p>
        )}
      </div>
    </div>
  );
}
