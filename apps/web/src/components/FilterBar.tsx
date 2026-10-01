import Link from 'next/link';
import type { EventFilter } from '@coreto/core';
import {
  FAMILIA,
  buildHref,
  eixosDoFormulario,
  nomesDosEixos,
  type EixoDeAcessibilidade,
} from '@/src/lib/agenda';
import { comInicialMaiuscula } from '@/src/lib/regiao';
import type { Category, Municipality } from '@/src/lib/queries/types';
import { ReporAoVoltar } from './ReporAoVoltar';

interface Props {
  filter: EventFilter;
  municipalities: Municipality[];
  categories: Category[];
  /** Endereço da própria listagem — é para lá que o formulário submete. */
  action: string;
  /** Quantos filtros estão a valer, para o resumo dizer o que esconde. */
  activeCount?: number;
  /**
   * Quantos eventos declaram cada eixo de acessibilidade, dado o resto do
   * filtro — ou `null` quando não se contou. Um eixo a zero não se oferece.
   */
  eixosDeAcessibilidade?: Readonly<Record<string, number>> | null;
  /**
   * O mesmo, na agenda inteira e sem filtro nenhum — para dizer que nenhum
   * evento desta agenda declara um eixo, em vez de esconder a caixa calado
   * (C2-010). `null` quando não se contou, e aí não se diz nada.
   */
  eixosDaAgenda?: Readonly<Record<string, number>> | null;
  /** Quantos eventos tem a lista à vista — num recorte vazio não se fala de eixos. */
  total?: number | null;
}

// `border-field` e não `border-border`: a moldura de um campo identifica um
// controlo e tem de ter 3:1 contra o fundo (WCAG 1.4.11). `text-base` evita
// que o Safari do iPhone dê zoom ao focar o campo.
const FIELD_CLASS =
  'mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const LABEL_CLASS = 'block text-sm font-medium';

/**
 * Filtros em formulário GET.
 *
 * O estado vive nos parâmetros do endereço, não no cliente: a página filtrada
 * funciona sem JavaScript, é partilhável tal como está e o botão de retroceder
 * do navegador faz o que se espera. Sem `page` no formulário de propósito —
 * mudar um filtro tem de voltar à primeira página, senão cai-se num «sem
 * resultados» que é só a página 7 de uma lista que agora tem duas.
 *
 * **Recolhido em qualquer largura** desde 20/09/2026. Em secretária abria
 * por inteiro e empurrava o primeiro evento para fora do ecrã; o que
 * interessa ter à vista — as datas, os concelhos, as categorias — está em
 * pílulas por cima deste formulário (`FilaDePilulas`). O concelho e a
 * categoria ficam também aqui como listas, de propósito: as pílulas são
 * ligações e as listas são campos, e quem prefere um controlo só — ou quem
 * navega com leitor de ecrã pela lista de campos do formulário — encontra
 * tudo no mesmo sítio. Escrevem no mesmo endereço.
 */
export function FilterBar({
  filter,
  municipalities,
  categories,
  action,
  activeCount = 0,
  eixosDeAcessibilidade = null,
  eixosDaAgenda = null,
  total = null,
}: Props) {
  // Que caixas se oferecem, e o que se diz das que não — a regra e as razões
  // estão em `eixosDoFormulario`.
  const {
    oferecidos: eixos,
    nenhumNaAgenda,
    nenhumNoRecorte,
  } = eixosDoFormulario(filter, eixosDeAcessibilidade, eixosDaAgenda, total);
  const outros = eixos.filter((eixo) => eixo.chave !== 'accessible');

  return (
    <details className="ct-recolhivel ct-recolhivel-sempre rounded border border-border bg-surface">
      {/* A pesquisa saiu daqui para a caixa à vista (`CaixaDePesquisa`), e o
          resumo diz só o que fica. Sem `aria-label`: o `<details>` já se
          anuncia aberto ou fechado, e um nome que não contém o texto à vista
          é um botão que quem usa a voz não consegue chamar (WCAG 2.5.3). O
          número diz-se por extenso a quem ouve. */}
      <summary>
        <span>Filtrar</span>
        {activeCount > 0 ? (
          <>
            <span
              aria-hidden="true"
              className="ct-octagon grid size-6 shrink-0 place-items-center bg-accent text-xs font-semibold text-on-accent"
            >
              {activeCount}
            </span>
            <span className="sr-only">
              {activeCount === 1 ? ', 1 filtro ativo' : `, ${activeCount} filtros ativos`}
            </span>
          </>
        ) : null}
      </summary>

      <form
        key={buildHref(filter, 1)}
        method="get"
        action={action}
        role="search"
        aria-label="Filtrar a agenda"
        className="px-4 pt-1 pb-4"
      >
        {/* O espaço, o ciclo e a pesquisa não têm campo aqui, mas quem chega
          por uma ligação com eles não os pode perder ao carregar em
          «Filtrar». */}
        {filter.q ? <input type="hidden" name="q" value={filter.q} /> : null}
        {filter.venue ? <input type="hidden" name="venue" value={filter.venue} /> : null}
        {filter.series ? <input type="hidden" name="series" value={filter.series} /> : null}
        <ReporAoVoltar />

        {/* Estava no cabeçalho da página, antes de tudo; aqui é onde faz
            sentido — é sobre isto que fala. */}
        <p className="mb-3 text-sm text-muted">
          Cada filtro é uma ligação — dá para guardar nos favoritos e para partilhar tal como está.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="filtro-de" className={LABEL_CLASS}>
              De
            </label>
            <input
              type="date"
              id="filtro-de"
              name="from"
              defaultValue={filter.from ?? ''}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="filtro-ate" className={LABEL_CLASS}>
              Até
            </label>
            <input
              type="date"
              id="filtro-ate"
              name="to"
              defaultValue={filter.to ?? ''}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="filtro-concelho" className={LABEL_CLASS}>
              Concelho
            </label>
            <select
              id="filtro-concelho"
              name="municipality"
              defaultValue={filter.municipality ?? ''}
              className={FIELD_CLASS}
            >
              <option value="">Todos os concelhos</option>
              {municipalities.map((municipality) => (
                <option key={municipality.id} value={municipality.id}>
                  {municipality.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filtro-categoria" className={LABEL_CLASS}>
              Categoria
            </label>
            <select
              id="filtro-categoria"
              name="category"
              defaultValue={filter.category ?? ''}
              className={FIELD_CLASS}
            >
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="sm:col-span-2 lg:col-span-2">
            <legend className={LABEL_CLASS}>Mostrar apenas</legend>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {/* O rótulo leva a altura toda: a caixa desenhada tem 20 px, mas
                o alvo do dedo é a linha inteira. */}
              <label
                htmlFor="filtro-gratuito"
                className="flex min-h-11 items-center gap-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  id="filtro-gratuito"
                  name="free"
                  value="1"
                  defaultChecked={filter.free === true}
                  className="size-5 accent-accent"
                />
                Entrada livre
              </label>

              <label
                htmlFor="filtro-familia"
                className="flex min-h-11 items-center gap-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  id="filtro-familia"
                  name="familia"
                  value="1"
                  defaultChecked={filter.familia === true}
                  className="size-5 accent-accent"
                />
                {FAMILIA.rotulo}
              </label>

              {eixos.map((eixo) => (
                <label
                  key={eixo.chave}
                  htmlFor={`filtro-${eixo.chave}`}
                  className="flex min-h-11 items-center gap-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    id={`filtro-${eixo.chave}`}
                    name={eixo.chave}
                    value="1"
                    defaultChecked={filter[eixo.chave as EixoDeAcessibilidade] === true}
                    aria-describedby={
                      eixo.chave === 'accessible' ? 'filtro-acessivel-nota' : 'filtro-eixos-nota'
                    }
                    className="size-5 accent-accent"
                  />
                  {eixo.rotulo}
                </label>
              ))}
            </div>
            {/* Uma nota por regra, e cada caixa ligada à sua por
                `aria-describedby` (C2-011, C3-004). A nota que aqui estava
                valia para os cinco eixos e dizia «sem declaração, o evento fica
                de fora mesmo que o espaço o ofereça» — verdade nos quatro que
                só leem o evento, e o contrário do que faz, desde a 0129, a das
                cadeiras de rodas: essa lê o evento ou, quando ele se cala, o
                espaço. Uma frase que contradiz o filtro tira confiança a tudo
                o resto, e é nesta que quem usa cadeira de rodas confia para
                decidir. As notas não dizem quantos são, que é contagem que
                muda de região para região; dizem o que cada caixa faz. */}
            {eixos.some((eixo) => eixo.chave === 'accessible') ? (
              <p id="filtro-acessivel-nota" className="mt-2 text-sm text-muted">
                A caixa das cadeiras de rodas inclui os eventos em espaços que declaram acesso. Se o
                evento não for no próprio espaço, confirme com quem organiza.
              </p>
            ) : null}
            {outros.length > 0 ? (
              <p id="filtro-eixos-nota" className="mt-2 text-sm text-muted">
                {/* Numa cadeia só, para a frase não se partir a meio: o
                    `check:afirmacoes` procura-a inteira numa linha. */}
                {`${comInicialMaiuscula(nomesDosEixos(outros, 'conjunction'))}: só os eventos que o declaram — sem declaração, o evento fica de fora.`}
              </p>
            ) : null}
            {/* O que não tem caixa também se diz (C2-010): esconder a caixa
                evitava o zero, e trocava-o por silêncio. */}
            {nenhumNaAgenda.length > 0 ? (
              <p className="mt-2 text-sm text-muted">
                Por agora, nenhum evento desta agenda declara {nomesDosEixos(nenhumNaAgenda)}. Se
                organiza um,{' '}
                <Link href="/submeter" className="underline underline-offset-4">
                  diga-nos
                </Link>{' '}
                — aparece aqui.
              </p>
            ) : null}
            {nenhumNoRecorte.length > 0 ? (
              <p className="mt-2 text-sm text-muted">
                Com estes filtros, nenhum evento declara {nomesDosEixos(nenhumNoRecorte)}. Sem eles,
                há.
              </p>
            ) : null}
          </fieldset>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="min-h-11 rounded bg-accent px-5 text-sm font-medium text-on-accent"
          >
            Filtrar
          </button>
          <Link
            href={action}
            className="inline-flex min-h-11 items-center rounded px-3 text-sm underline underline-offset-4"
          >
            Limpar filtros
          </Link>
        </div>
      </form>
    </details>
  );
}
