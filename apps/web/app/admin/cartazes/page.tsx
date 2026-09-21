import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { declararAlojamentoDaFonte, reporCartaz, retirarCartaz } from '@/src/lib/admin/actions';
import {
  contarCartazes,
  listCartazes,
  listFontesParaAlojamento,
  type CartazDoPainel,
} from '@/src/lib/admin/queries';
import { formatEventDates } from '@/src/lib/format';
import { hasServiceRole } from '@/src/lib/env';
import { todayInLisbon } from '@coreto/core';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Cartazes' };

const BOTAO =
  'inline-flex min-h-11 items-center rounded border border-field px-3 text-sm font-medium';
const BOTAO_CHEIO =
  'inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent';
const CAMPO = 'mt-1 min-h-11 rounded border border-field bg-surface px-3 py-2 text-base text-ink';

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'nossos', label: 'Cópia nossa' },
  { value: 'origem', label: 'Servidos da origem' },
  { value: 'retirados', label: 'Retirados a pedido' },
];

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * A secretária dos cartazes.
 *
 * Existe por causa de uma frase do `docs/TERCEIROS.md`: os cartazes dos
 * eventos são obra gráfica com autor, e o Coreto passou a guardar uma cópia
 * deles. Apontar para uma imagem é ligar; guardar uma cópia é reproduzir, e
 * quem reproduz obra alheia tem de conseguir parar num gesto quando o autor
 * pedir.
 *
 * **É essa a pergunta que esta página responde, e por isso está desenhada como
 * uma mesa de pedidos e não como um inventário.** A primeira coisa é a caixa
 * de procurar; a linha diz de quem é o cartaz e se a cópia é nossa; o botão
 * diz o que faz e o que acontece a seguir. Quem chega aqui chega com um email
 * aberto ao lado.
 *
 * A segunda vista — as fontes — é a outra metade da mesma decisão, e a que
 * tem de ser tomada **antes**: de quem é que se pode copiar. Fica aqui e não
 * na saúde da recolha porque é a mesma pergunta jurídica, e não uma pergunta
 * sobre se a fonte está a responder.
 */
export default async function Cartazes({ searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Cartazes" />;

  const params = await searchParams;
  const vista = params.vista === 'fontes' ? 'fontes' : 'cartazes';
  const filtro = { estado: params.estado ?? '', q: (params.q ?? '').trim() };

  const [contagens, linhas, fontes] = await Promise.all([
    contarCartazes(),
    vista === 'cartazes' ? listCartazes(filtro) : Promise.resolve([] as CartazDoPainel[]),
    vista === 'fontes' ? listFontesParaAlojamento() : Promise.resolve([]),
  ]);

  const hoje = todayInLisbon();
  const aqui = `/admin/cartazes${vista === 'fontes' ? '?vista=fontes' : ''}`;

  return (
    <>
      <PageHeader
        title="Cartazes"
        lead="Os cartazes dos eventos são obra gráfica de quem os fez. Daqui retira-se um a pedido de quem é seu autor — e um cartaz retirado não volta com a recolha da noite —, e declara-se de que fontes é que se pode guardar cópia."
      />

      {params.aviso ? (
        <p role="status" className="mb-6 rounded border border-accent/40 bg-accent-soft px-4 py-3">
          {params.aviso}
        </p>
      ) : null}

      <p className="mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          <strong className="text-ink tabular-nums">{contagens.nossos}</strong> com cópia nossa
        </span>
        <span>
          <strong className="text-ink tabular-nums">{contagens.daOrigem}</strong> servidos da origem
        </span>
        <span>
          <strong className="text-ink tabular-nums">{contagens.retirados}</strong> retirados a
          pedido
        </span>
      </p>

      <nav aria-label="Vistas" className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/cartazes"
          aria-current={vista === 'cartazes' ? 'page' : undefined}
          className={vista === 'cartazes' ? BOTAO_CHEIO : BOTAO}
        >
          Cartazes
        </Link>
        <Link
          href="/admin/cartazes?vista=fontes"
          aria-current={vista === 'fontes' ? 'page' : undefined}
          className={vista === 'fontes' ? BOTAO_CHEIO : BOTAO}
        >
          De quem se pode copiar
        </Link>
      </nav>

      {vista === 'cartazes' ? (
        <>
          <form method="get" role="search" className="mb-6 flex flex-wrap items-end gap-3">
            <label htmlFor="q" className="text-sm">
              <span className="block font-medium">Procurar pelo título</span>
              <input
                type="search"
                id="q"
                name="q"
                defaultValue={filtro.q}
                className={`${CAMPO} w-64`}
              />
            </label>
            <label htmlFor="estado" className="text-sm">
              <span className="block font-medium">Estado</span>
              <select id="estado" name="estado" defaultValue={filtro.estado} className={CAMPO}>
                {ESTADOS.map((estado) => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={BOTAO}>
              Procurar
            </button>
          </form>

          {linhas.length === 0 ? (
            <p className="rounded border border-dashed border-border px-4 py-8 text-center text-muted">
              Nada com esse nome.
            </p>
          ) : (
            <ul className="grid gap-3">
              {linhas.map((linha) => (
                <li
                  key={linha.id}
                  className="flex flex-wrap items-start justify-between gap-4 rounded border border-border bg-surface p-3"
                >
                  <div className="flex min-w-0 gap-3">
                    {/* A miniatura da nossa cópia, e só dela.
 
                        Um cartaz servido da origem não se desenha aqui: eram
                        quarenta pedidos a vinte servidores municipais cada vez
                        que alguém abrisse esta página, para uma imagem que só
                        serve para reconhecer o evento — e o título, que está
                        logo ao lado, reconhece-o melhor. */}
                    {linha.image_miniatura ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={linha.image_miniatura}
                        alt=""
                        width={48}
                        height={64}
                        className="h-16 w-12 shrink-0 rounded object-contain"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="h-16 w-12 shrink-0 rounded border border-dashed border-border"
                      />
                    )}

                    <div className="min-w-0">
                      <p className="text-sm text-muted">
                        {formatEventDates(linha.date_start, linha.date_end, hoje)} ·{' '}
                        {linha.municipality_id}
                        {linha.source_id ? ` · ${linha.source_id}` : ''}
                      </p>
                      <p className="font-medium">
                        <Link
                          href={`/evento/${linha.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-4"
                          aria-label={`${linha.title} (abre noutro separador)`}
                        >
                          {linha.title}
                        </Link>
                      </p>
                      <p className="text-xs text-muted">
                        {linha.image_retirado_em
                          ? `Retirado por ${linha.image_retirado_por ?? '—'} a ${linha.image_retirado_em.slice(0, 10)}.`
                          : linha.image_miniatura
                            ? `Cópia nossa desde ${linha.image_guardado_em?.slice(0, 10) ?? '—'}. Crédito: ${linha.image_credit ?? 'por escrever'}.`
                            : 'Servido do servidor de quem o publicou.'}
                      </p>
                      {linha.image_origem ? (
                        <p className="mt-1 truncate text-xs">
                          <a
                            href={linha.image_origem}
                            rel="noopener nofollow"
                            target="_blank"
                            className="underline underline-offset-4"
                          >
                            Ver na origem
                          </a>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {linha.image_retirado_em ? (
                      <form action={reporCartaz}>
                        <input type="hidden" name="evento" value={linha.id} />
                        <input type="hidden" name="concelho" value={linha.municipality_id} />
                        <input type="hidden" name="voltar" value={aqui} />
                        <button type="submit" className={BOTAO}>
                          Levantar a marca
                        </button>
                      </form>
                    ) : (
                      <form action={retirarCartaz}>
                        <input type="hidden" name="evento" value={linha.id} />
                        <input type="hidden" name="concelho" value={linha.municipality_id} />
                        <input type="hidden" name="voltar" value={aqui} />
                        <button type="submit" className={BOTAO}>
                          Retirar a pedido
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="mb-4 max-w-prose text-sm text-muted">
            Uma câmara municipal e uma junta de freguesia são organismos públicos, e o que publicam
            na sua agenda é comunicação institucional — a cópia de um cartaz seu, com crédito e
            ligação à origem, é o uso que essa publicação convida. Uma sala privada, um santuário ou
            um blogue não são a mesma coisa, e a diferença não é de tamanho: é de quem responde pela
            obra. Desligar uma fonte apaga as cópias que ela já tinha, na recolha seguinte.
          </p>

          <ul className="grid gap-2">
            {fontes.map((fonte) => (
              <li
                key={fonte.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {fonte.name}
                    {!fonte.is_enabled ? (
                      <span className="ml-2 text-muted">(desligada)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {fonte.kind} · {fonte.url}
                  </p>
                </div>
                <form action={declararAlojamentoDaFonte} className="flex items-center gap-3">
                  <input type="hidden" name="fonte" value={fonte.id} />
                  <input type="hidden" name="alojavel" value={fonte.cartaz_alojavel ? '' : 'sim'} />
                  <span className="text-sm text-muted">
                    {fonte.cartaz_alojavel ? 'Copiamos' : 'Só apontamos'}
                  </span>
                  <button type="submit" className={BOTAO}>
                    {fonte.cartaz_alojavel ? 'Deixar de copiar' : 'Passar a copiar'}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
