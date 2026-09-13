import {
  avaliarAgenda,
  avaliarRecolha,
  saudeDaFonte,
  veredito,
  type SaudeDaFonte,
} from '@/src/lib/estado';
import {
  countEventsByMunicipality,
  listMunicipalities,
  listPublicSources,
} from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { reportarErro } from '@/src/lib/registo';

/**
 * O `/estado` numa forma que uma máquina lê.
 *
 * A página existe para uma CIM saber se a agenda dela está a ser alimentada.
 * Isto responde à mesma pergunta para quem não tem olhos: a sonda externa
 * (`scripts/vigiar-sitio.sh`), um painel de terceiros, um script de quem
 * instalou isto noutro sítio.
 *
 * **Porque não bastava raspar o HTML.** A sonda fazia-o — procurava textos na
 * página — e isso amarra a vigilância à redação: mudar «Em ordem» para «Está
 * tudo bem» partia o alarme sem partir teste nenhum, e um alarme partido
 * descobre-se no dia em que devia tocar. Um contrato explícito é uma coisa que
 * se pode mudar de propósito.
 *
 * **O que este endereço não responde é o mesmo que a página não responde:** se
 * o sítio está de pé. Vive nos servidores que descreve. Um `503` daqui é
 * informação; o silêncio também é, e é a única que sobra quando a plataforma
 * cai — por isso quem vigia a sério vigia de fora, e este endereço é o que ele
 * lê quando o sítio responde.
 *
 * O corpo é estável de propósito: os nomes dos campos são contrato, e a ordem
 * das listas é a alfabética que a página já usa. Acrescentar um campo é
 * seguro; mudar o nome de um é partir a sonda de alguém.
 */

export const revalidate = 3600;

/** O corpo, escrito uma vez para se poder verificar sem servir nada. */
export interface EstadoEmJson {
  regiao: string;
  /** `bom`, `atencao` ou `mau` — o mesmo veredito que a página mostra em cima. */
  grau: 'bom' | 'atencao' | 'mau';
  /** A frase do veredito, em português, palavra a palavra igual à da página. */
  resumo: string;
  recolha: {
    /** Fontes ligadas. As desligadas não entram, como na página. */
    vigiadas: number;
    emDia: number;
    atrasadas: number;
    paradas: number;
    porEstrear: number;
    /** As que precisam de alguém, pelo id, por ordem alfabética. */
    porArranjar: Array<{ id: string; nome: string; saude: SaudeDaFonte; dias: number | null }>;
  };
  agenda: {
    /** Eventos por vir na região inteira. */
    total: number;
    /** Os concelhos sem nada marcado, pelo id, por ordem alfabética. */
    concelhosAZero: string[];
  };
  /**
   * Quando isto foi calculado.
   *
   * Vem com o corpo porque a resposta é servida de cache com uma hora de
   * validade: sem a data, um vigilante não distingue «está tudo bem» de «está
   * tudo bem há cinquenta minutos», e a diferença é a que interessa quando a
   * pergunta é se alguma coisa acabou de partir.
   */
  calculadoEm: string;
}

function json(corpo: unknown, status: number): Response {
  return new Response(JSON.stringify(corpo, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // A mesma hora da página, e dita ao intermediário: quem vigia de dois em
      // dois minutos não deve gerar um cálculo por pedido.
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);

  /*
   * **A leitura falhar é uma resposta, não um 500 — e aqui tem código
   * próprio.**
   *
   * A página escreve «a base de dados não respondeu» e serve-a com 200, que é
   * o certo para quem lê com os olhos. Uma máquina precisa de o saber pelo
   * código: um vigilante que só olhe para o 200 dava por bom o dia em que a
   * base morresse. 503 é o código de «isto existe e não está a servir agora»,
   * e é o que a sonda tem de ver.
   */
  try {
    const [fontes, concelhos, contagens] = await Promise.all([
      listPublicSources(regiao.id),
      listMunicipalities(regiao.id),
      countEventsByMunicipality(regiao.id),
    ]);

    const recolha = avaliarRecolha(fontes);
    const agenda = avaliarAgenda(concelhos, contagens);
    const parecer = veredito(recolha, agenda);
    const porArranjar = [...recolha.paradas, ...recolha.atrasadas]
      .map((fonte) => ({
        id: fonte.id,
        nome: fonte.name,
        saude: saudeDaFonte(fonte.last_success_at, new Date()),
        dias: fonte.dias,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const corpo: EstadoEmJson = {
      regiao: regiao.id,
      grau: parecer.grau,
      resumo: parecer.frase,
      recolha: {
        vigiadas: recolha.vigiadas.length,
        emDia: recolha.emDia.length,
        atrasadas: recolha.atrasadas.length,
        paradas: recolha.paradas.length,
        porEstrear: recolha.porEstrear.length,
        porArranjar,
      },
      agenda: {
        total: agenda.total,
        concelhosAZero: concelhos
          .filter((concelho) => (contagens[concelho.id] ?? 0) === 0)
          .map((concelho) => concelho.id)
          .sort(),
      },
      calculadoEm: new Date().toISOString(),
    };

    return json(corpo, 200);
  } catch (causa) {
    reportarErro('EstadoJson', causa, { regiao: regiao.id });
    return json(
      {
        regiao: regiao.id,
        grau: 'mau',
        resumo: 'A base de dados não respondeu a este pedido.',
        calculadoEm: new Date().toISOString(),
      },
      503,
    );
  }
}
