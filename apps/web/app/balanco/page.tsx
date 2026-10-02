import { todayInLisbon } from '@coreto/core/dates';
import type { Metadata } from 'next';
import { notFound, unauthorized } from 'next/navigation';
import { BandstandMark } from '@/src/components/BandstandMark';
import { BotaoDeImprimir } from '@/src/components/BotaoDeImprimir';
import { listRegionLicenses, monthlyReport, listRegionsAdmin } from '@/src/lib/admin/queries';
import { lerMes, mesAnterior, mesDoDia, mesSeguinte, nomeDoMes } from '@/src/lib/admin/relatorio';
import { porNome } from '@/src/lib/artigos';
import { quemAbre } from '@/src/lib/balanco/guarda';
import { numerosDoBalanco } from '@/src/lib/balanco/numeros';
import { formatLongDate } from '@/src/lib/format';
import { PRODUTO } from '@/src/lib/produto';
import { doNomeDaRegiao } from '@/src/lib/regiao';

export const dynamic = 'force-dynamic';

/**
 * Nunca indexado, nunca em cache de ninguém.
 *
 * O endereço traz um segredo na barra. Um motor de busca que o siga põe-no num
 * índice; uma cache partilhada põe o balanço de uma região ao alcance de quem
 * pedir a seguir. As duas coisas se resolvem aqui e no cabeçalho que o
 * middleware acrescenta — duas redes, porque uma esquece-se.
 */
export const metadata: Metadata = {
  title: 'Balanço',
  robots: { index: false, follow: false, nocache: true },
};

interface Props {
  searchParams: Promise<{ chave?: string; regiao?: string; mes?: string }>;
}

/**
 * O balanço de uma região, para quem decide se renova.
 *
 * **Esta é a segunda porta da casa, e a regra escrita diz «uma palavra-passe,
 * sem contas».** A regra foi escrita para a moderação, onde há um operador só.
 * Quem entra aqui é outro: não modera, não escreve, e o que vê já é do
 * território dele. Está argumentado na 0151 e no plano — e o que impede isto
 * de ser uma exceção que cresce é o que **não** está nesta página: nenhuma
 * ligação daqui chega ao painel, e não há nada para carregar que escreva
 * seja o que for.
 *
 * Sem chave, 401. Com a chave de outra região, 404 — e não 403, que dizia a
 * quem tenta que acertou no segredo e errou na região.
 */
export default async function Balanco({ searchParams }: Props) {
  const params = await searchParams;
  const veredicto = await quemAbre(params.chave, params.regiao);

  // 404 para a chave de outra região, e **não 403**: um 403 dizia a quem
  // tenta que acertou no segredo e errou só na região, que são as duas
  // metades do que ele estava a tentar descobrir. Aqui a região pedida passa
  // a ser indistinguível de uma que não existe.
  if (veredicto.estado === 'outra-regiao') notFound();

  // 401 e não 200 com uma página a dizer que falta a chave: o código é parte
  // da resposta, e uma porta fechada que responde 200 é uma porta que os
  // registos de quem opera contam como aberta. A mensagem está em
  // `unauthorized.tsx` — é o Next que a serve, com o 401.
  //
  // A mesma resposta para quem não traz chave nenhuma e para quem traz uma
  // que não abre: distingui-las dizia a quem tenta que acertou em metade.
  if (veredicto.estado === 'sem-chave') unauthorized();

  const { regiao } = veredicto;
  // O mês que acabou, como em `/admin/relatorios`: quem abre isto no dia 2
  // quer o mês fechado, não o que começou anteontem. Um `mes` que não tenha a
  // forma `AAAA-MM` é ignorado em vez de rejeitado — a página serve o mês por
  // omissão, e não um erro sobre um parâmetro que alguém truncou no email.
  const mes = lerMes(params.mes) ?? mesAnterior(todayInLisbon());
  const [relatorio, licencas, regioes] = await Promise.all([
    monthlyReport(regiao, mes),
    listRegionLicenses(),
    listRegionsAdmin(),
  ]);

  const linha = regioes.find((r) => r.id === regiao);
  const nome = linha?.name ?? regiao;
  // A licença em vigor: a que já começou e ainda não acabou. Sem prazo conta
  // como em vigor — é a montra e os pilotos abertos, que a 0112 deixa sem fim.
  const hoje = todayInLisbon();
  const licenca = licencas.find(
    (l) =>
      l.region_id === regiao && l.starts_on <= hoje && (l.ends_on === null || l.ends_on >= hoje),
  );

  const numeros = numerosDoBalanco(relatorio);

  /*
   * O mês anterior e o seguinte, como ligações (C4-028). A página pedia a
   * quem decide que trocasse o `mes` no endereço, no formato AAAA-MM — que é
   * pedir a um vereador que edite um URL. O seguinte só existe até ao mês que
   * está a correr: um balanço de um mês que ainda não começou é uma página
   * de zeros que se lê como uma agenda parada.
   */
  const hrefDoMes = (outro: string) =>
    `/balanco?chave=${encodeURIComponent(params.chave ?? '')}&regiao=${encodeURIComponent(regiao)}&mes=${outro}`;
  const anterior = mesAnterior(`${mes}-01`);
  const seguinte = mesSeguinte(mes);
  const haSeguinte = seguinte <= mesDoDia(hoje);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header>
        {/*
          De quem é isto, à cabeça (C4-028): a página não dizia o nome do
          produto nem de quem promove a agenda, e lia-se como uma nota interna
          — e é a página que a CIM leva à reunião de renovação.
        */}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <BandstandMark className="size-5 text-ink" />
          <span>
            <span className="font-semibold text-ink">{PRODUTO.nome}</span> · balanço mensal da
            agenda cultural {linha ? doNomeDaRegiao(linha.article, linha.name) : nome}
          </span>
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          {nome} · {nomeDoMes(mes)}
        </h1>
        {linha ? (
          <p className="mt-1 text-sm text-muted">
            {`Promovida ${porNome(linha.cim_name, linha.cim_article ?? 'a')}.`}
          </p>
        ) : null}
        <p className="mt-3 max-w-prose text-muted">
          Seis números sobre o mês, cada um com o que mede e o que não mede escrito ao lado. Todos
          contam o que a agenda conseguiu recolher — não o que aconteceu no território.
        </p>
        {licenca ? (
          <p className="mt-3 text-sm text-muted">
            {/* As datas por extenso e o nome da licença como foi registada:
                «demo, desde 2026-10-01» lia-se como uma linha de base de
                dados. */}
            {`Licença em vigor: ${licenca.kind}, ${
              licenca.ends_on
                ? `de ${formatLongDate(licenca.starts_on)} a ${formatLongDate(licenca.ends_on)}`
                : `desde ${formatLongDate(licenca.starts_on)}, sem prazo`
            }.`}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Não há licença em vigor registada para esta região.
          </p>
        )}

        <nav
          aria-label="Outros meses"
          className="ct-sem-impressao mt-4 flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          <a
            href={hrefDoMes(anterior)}
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            ‹ {nomeDoMes(anterior)}
          </a>
          {haSeguinte ? (
            <a
              href={hrefDoMes(seguinte)}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              {nomeDoMes(seguinte)} ›
            </a>
          ) : null}
          <BotaoDeImprimir>Imprimir ou guardar em PDF</BotaoDeImprimir>
        </nav>
      </header>

      <section aria-labelledby="numeros" className="mt-8">
        <h2 id="numeros" className="sr-only">
          Os números do mês
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {numeros.map((n) => (
            <li key={n.chave} className="rounded border border-border px-4 py-3">
              <p className="text-sm text-muted">{n.rotulo}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{n.valor}</p>
              <p className="mt-2 max-w-prose text-sm">{n.frase}</p>
              {n.ressalva ? (
                <p className="mt-2 max-w-prose text-xs text-muted">{n.ressalva}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/*
        Sem ligação nenhuma para fora, e é deliberado. Um menu daqui para o
        painel transformava a chave de leitura num caminho para a moderação —
        e a mesma chave num sítio onde se escreve é uma porta diferente da que
        está argumentada.
      */}
      <footer className="mt-10 max-w-prose border-t border-border pt-4 text-sm text-muted">
        <p>
          Os números vêm da base no instante em que esta página foi aberta, e os outros meses estão
          nas ligações lá em cima.
        </p>
        <p className="mt-2">
          Este endereço é só de leitura e só desta região. Não dá acesso a mais nada, e não indexa.
        </p>
      </footer>
    </main>
  );
}
