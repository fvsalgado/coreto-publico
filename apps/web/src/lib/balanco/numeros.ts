import type { RelatorioMensal } from '../admin/relatorio';

/**
 * O punhado de números que se leva a uma reunião de renovação.
 *
 * **Não é o painel do operador, e é essa a razão de isto existir.** Dar hoje
 * o relatório à técnica de cultura de uma CIM é dar-lhe a fila de moderação,
 * o registo de auditoria, a edição de regiões e as licenças comerciais — logo
 * ninguém lho dá. Aqui vão seis números, cada um com uma frase, e nada mais.
 *
 * Cada um traz **o que mede** e, quando é preciso, **o que não mede**: é a
 * mesma regra da ficha técnica de `/indicadores`, aplicada onde o número vai
 * ser lido por quem decide se paga.
 */
export interface NumeroDoBalanco {
  chave: string;
  rotulo: string;
  valor: string;
  frase: string;
  /** Escrito quando o número é fácil de ler a mais do que ele diz. */
  ressalva?: string;
}

function contar(n: number): string {
  return n.toLocaleString('pt-PT');
}

/**
 * Os seis, por esta ordem: território, rede, devolução, saídas, entrada pela
 * porta da frente, e o que está à espera de quem publica.
 *
 * É uma função pura do relatório do mês. Recebe-o já lido e não vai à base:
 * a página faz uma ida só, como o resto da casa.
 */
export function numerosDoBalanco(r: RelatorioMensal): NumeroDoBalanco[] {
  const p = r.promises;
  const visitas = r.visits;

  const concelhos: NumeroDoBalanco = {
    chave: 'territorio',
    rotulo: 'Concelhos com programação',
    valor: `${contar(p.cohesion.municipalities_with_programming)} de ${contar(p.cohesion.municipalities)}`,
    frase:
      'Concelhos da região com pelo menos um evento programado neste mês. É a medida de coesão que não castiga os pequenos: conta se há agenda, não quanta.',
    ressalva:
      'Mede o que a agenda conseguiu recolher. Um concelho a zero pode estar a programar e a publicá-lo num sítio que não responde.',
  };

  const rede: NumeroDoBalanco = {
    chave: 'rede',
    rotulo: 'Programação em rede',
    valor:
      p.network.events === 0
        ? 'nenhuma neste mês'
        : `${contar(p.network.events)} em ${contar(p.network.municipalities_touched)} concelhos`,
    frase:
      'Eventos de séries que atravessam concelhos, tornados legíveis no mesmo sítio que o resto. É o que uma agenda regional faz e a soma de onze agendas municipais não faz.',
  };

  // A soma dos cliques que devolvem alguém ao sítio de quem organiza. É a
  // única das seis que pode vir a nulo — os dois contadores nasceram na
  // 0141, e antes da primeira fotografia que os traz não há diferença
  // nenhuma para calcular.
  const devolvidos = (visitas.by_municipality ?? []).reduce<number | null>((soma, linha) => {
    if (soma === null) return null;
    const oficial = linha.source_clicks;
    const chegar = linha.directions_clicks;
    if (oficial === null || chegar === null) return null;
    return soma + oficial + chegar;
  }, 0);

  const devolucao: NumeroDoBalanco = {
    chave: 'devolucao',
    rotulo: 'Cliques devolvidos a quem organiza',
    valor: !visitas.available || devolvidos === null ? 'sem medição neste mês' : contar(devolvidos),
    frase:
      'Vezes que alguém saiu daqui para a página oficial do evento ou para o mapa de como lá chegar. A agenda não retém ninguém: encaminha.',
    ressalva:
      visitas.clicks_since && devolvidos === null
        ? `Estes dois contadores existem a partir de ${visitas.clicks_since}. Antes disso não há número — e um zero lia-se como «ninguém carregou».`
        : undefined,
  };

  const aberturas = (visitas.by_municipality ?? []).reduce((soma, l) => soma + l.views, 0);
  const saidas: NumeroDoBalanco = {
    chave: 'saidas',
    rotulo: 'Fichas de evento abertas',
    valor: visitas.available ? contar(aberturas) : 'sem medição neste mês',
    frase:
      'Aberturas de uma ficha de evento no mês, somadas por concelho. Sem cookies e sem identificar ninguém — é uma contagem, não um público.',
  };

  const submissoes: NumeroDoBalanco = {
    chave: 'entrada',
    rotulo: 'Eventos entrados por email ou formulário e aprovados',
    valor: contar(r.submissions.received_by_channel.email + r.submissions.received_by_channel.form),
    frase:
      'Eventos que chegaram porque alguém os mandou, e não porque um leitor os foi buscar. É a parte da agenda que nenhuma recolha automática traria.',
    ressalva:
      'Não é «eventos que só existem aqui». O Coreto sabe de onde trouxe cada evento; não sabe que ele não estava em mais lado nenhum, e dizê-lo seria fabricar o argumento de venda.',
  };

  const porPublicar: NumeroDoBalanco = {
    chave: 'catalogo',
    rotulo: 'No catálogo, à espera de revisão',
    valor: contar(r.quality.reduce((soma, q) => soma + q.pending, 0)),
    frase:
      'Eventos recolhidos e ainda por aprovar. Um número alto aqui é trabalho de moderação, não uma agenda pobre.',
  };

  return [concelhos, rede, devolucao, saidas, submissoes, porPublicar];
}
