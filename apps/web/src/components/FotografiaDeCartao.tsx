import { CapaDoEspaco } from '@/src/components/CapaDoEspaco';
import { fonteDaFotografia, fundoDaFotografia } from '@/src/lib/fotografia';

/**
 * A moldura de cima de um cartão de espaço ou de coreto: a capa do espaço,
 * sempre desenhada, e a fotografia por cima quando a há.
 *
 * Os cartões dos espaços, os do levantamento dos coretos e os coretos da
 * página do concelho desenhavam isto cada um à sua maneira — os coretos com um
 * `<img>`, que quando falhava punha o ícone de imagem partida no cartão (C1-016,
 * e a primeira fotografia da lista dos coretos estava assim, C2-025). Passa a
 * ser uma moldura só.
 *
 * Em fundo e não em `<img>`, pela lição que `cartaz.ts` mediu no Chromium e
 * aplicou aos cartazes: um `<img>` que falha desenha o ícone de imagem partida
 * mesmo com `alt=""`, e um `background-image` que falha não desenha nada —
 * fica a capa. A fotografia é decorativa: o nome está sempre escrito ao lado.
 *
 * Duas camadas, uma por medida — a miniatura de 96 píxeis do telemóvel e a
 * moldura de pé da grelha, até uns 330 —, e a que está `display: none` não é
 * descarregada: é assim que um fundo escolhe a medida sem `srcset`. Os
 * escalões do Commons mais próximos são 330 e 500.
 *
 * As do Commons vêm do próprio sítio (`lib/fotografia.ts`): cada uma custava
 * três viagens à Wikimedia a partir do navegador de quem visitava, e
 * deixava-lhe cookies.
 */
export function FotografiaDeCartao({
  url,
  kind,
  isAssociation,
  semRotulo = false,
}: {
  url: string | null;
  kind: string;
  isAssociation: boolean;
  /** Ver `CapaDoEspaco`. */
  semRotulo?: boolean;
}) {
  const pequena = url ? fundoDaFotografia(fonteDaFotografia(url, [330]).src) : undefined;
  const grande = url ? fundoDaFotografia(fonteDaFotografia(url, [500]).src) : undefined;

  return (
    <div className="relative aspect-square w-24 shrink-0 self-stretch overflow-hidden border-r border-border sm:aspect-[5/3] sm:w-full sm:border-r-0 sm:border-b">
      <CapaDoEspaco kind={kind} isAssociation={isAssociation} semRotulo={semRotulo} />
      {pequena ? (
        <div
          aria-hidden="true"
          style={{ backgroundImage: pequena }}
          className="absolute inset-0 bg-cover bg-center sm:hidden"
        />
      ) : null}
      {grande ? (
        <div
          aria-hidden="true"
          style={{ backgroundImage: grande }}
          className="absolute inset-0 hidden bg-cover bg-center sm:block"
        />
      ) : null}
    </div>
  );
}
