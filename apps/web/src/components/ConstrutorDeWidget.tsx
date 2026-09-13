'use client';

import { useMemo, useState } from 'react';
import {
  DISPOSICOES,
  type Disposicao,
  type Escolhas,
  alturaEstimada,
  codigoDoIframe,
  codigoDoScript,
  enderecoDoWidget,
} from '@/src/lib/widget/opcoes';

/**
 * O construtor do widget.
 *
 * A página de documentação tinha uma tabela de doze atributos e uma
 * pré-visualização fixa de uma combinação que ninguém tinha escolhido. Quem
 * mantém o sítio de uma câmara não quer ler doze atributos: quer ver a caixa
 * com a cor dela, no feitio do buraco onde ela vai, e copiar.
 *
 * Por isso os controlos estão em cima, a caixa a sério — o mesmo `iframe` que
 * vai para o sítio deles — está ao lado, e o código por baixo já vem escrito
 * com o que foi escolhido. Nada aqui é uma simulação: o que se vê é o widget.
 */

interface Concelho {
  id: string;
  name: string;
}

interface Espaco {
  id: string;
  name: string;
  municipality_id: string;
}

interface Categoria {
  slug: string;
  name: string;
}

interface Ciclo {
  id: string;
  name: string;
}

interface Props {
  base: string;
  concelhos: readonly Concelho[];
  espacos: readonly Espaco[];
  ciclos: readonly Ciclo[];
  categorias: readonly Categoria[];
}

/** As larguras onde uma caixa destas costuma ir parar. */
const LARGURAS = [
  { valor: 240, etiqueta: 'Coluna estreita', nota: '240 px' },
  { valor: 340, etiqueta: 'Coluna lateral', nota: '340 px' },
  { valor: 720, etiqueta: 'Faixa larga', nota: '720 px' },
] as const;

const NOMES_DISPOSICAO: Record<Disposicao, { nome: string; nota: string }> = {
  cartazes: { nome: 'Cartazes', nota: 'Miniatura e texto ao lado. Serve quase sempre.' },
  lista: { nome: 'Lista', nota: 'Sem imagens, para colunas onde não cabem.' },
  mural: { nome: 'Mural', nota: 'Grelha de cartazes, para uma faixa larga.' },
};

/** Sugestões, não uma paleta fechada: a cor certa é a da instituição. */
const CORES_SUGERIDAS = ['#14676b', '#b0122a', '#2f6fb5', '#7a3b8f', '#a85a10', '#2d3a45'];

const rotulo = 'block text-sm font-medium';
const campo =
  'mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';

function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Sem permissão para a área de transferência — num sítio servido por
          // http, por exemplo. O código está à vista e seleciona-se à mão; não
          // se avisa de nada, porque não há nada para o leitor fazer.
        }
      }}
      className="inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent"
    >
      {copiado ? 'Copiado' : etiqueta}
      <span aria-live="polite" className="sr-only">
        {copiado ? 'Código copiado para a área de transferência.' : ''}
      </span>
    </button>
  );
}

export function ConstrutorDeWidget({ base, concelhos, espacos, ciclos, categorias }: Props) {
  const [concelho, setConcelho] = useState(concelhos[0]?.id ?? 'tomar');
  const [espaco, setEspaco] = useState('');
  const [ciclo, setCiclo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [limite, setLimite] = useState(5);
  const [gratis, setGratis] = useState(false);
  const [disposicao, setDisposicao] = useState<Disposicao>('cartazes');
  const [usarCor, setUsarCor] = useState(false);
  const [cor, setCor] = useState('#14676b');
  const [tema, setTema] = useState<'auto' | 'light' | 'dark'>('auto');
  const [letra, setLetra] = useState('');
  const [pesquisa, setPesquisa] = useState('');
  const [cabecalho, setCabecalho] = useState(true);
  const [moldura, setMoldura] = useState(true);
  const [largura, setLargura] = useState<number>(340);

  // Trocar de concelho com um espaço de outro escolhido dava uma caixa vazia
  // sem explicação. O espaço só vale enquanto for do concelho escolhido.
  const espacosDoConcelho = useMemo(
    () => espacos.filter((item) => item.municipality_id === concelho),
    [espacos, concelho],
  );
  const espacoValido = espacosDoConcelho.some((item) => item.id === espaco) ? espaco : '';

  const escolhas: Escolhas = {
    concelho,
    espaco: espacoValido || undefined,
    ciclo: ciclo || undefined,
    categoria: categoria || undefined,
    limite,
    gratis,
    disposicao,
    cor: usarCor ? cor : undefined,
    tema,
    letra: letra.trim() || undefined,
    pesquisa: pesquisa.trim() || undefined,
    cabecalho,
    moldura,
  };

  const endereco = enderecoDoWidget(base, escolhas);
  const nomeDoConcelho = concelhos.find((c) => c.id === concelho)?.name ?? concelho;
  const tituloIframe = `Agenda cultural de ${nomeDoConcelho}`;

  /*
   * `*:min-w-0` nas grelhas, e não é arrumação.
   *
   * Um filho de grelha tem `min-width: auto`, ou seja, nunca encolhe abaixo do
   * mínimo do seu conteúdo — e o bloco de código para copiar não quebra linha.
   * A coluna esticava até aos 393 px de `<script src="…/widget/embed.js">` e
   * arrastava a página inteira com ela: `/levar` era a única página pública do
   * sítio a rolar na horizontal num telemóvel (409 px de conteúdo numa janela
   * de 360; 817 numa de 320 com o texto ampliado a 200%). Com o mínimo a zero,
   * a coluna fica pela largura da janela e quem rola é o `overflow-x-auto` do
   * `<pre>`, dentro da sua própria caixa — que tem `tabIndex` para chegar lá
   * com o teclado.
   *
   * Vale o mesmo para as caixas de escolha: a largura mínima de um `select` é
   * a da opção mais comprida, e há nomes de espaços que passam dos 360 px.
   */
  return (
    <div className="mt-6 grid gap-8 *:min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div>
        <h3 className="ct-heading">Escolham</h3>

        <div className="mt-4 grid gap-4 *:min-w-0 sm:grid-cols-2">
          <div>
            <label htmlFor="w-concelho" className={rotulo}>
              Concelho
            </label>
            <select
              id="w-concelho"
              value={concelho}
              onChange={(e) => setConcelho(e.target.value)}
              className={campo}
            >
              {concelhos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="w-espaco" className={rotulo}>
              Só de um espaço
            </label>
            <select
              id="w-espaco"
              value={espacoValido}
              onChange={(e) => setEspaco(e.target.value)}
              className={campo}
            >
              <option value="">O concelho todo</option>
              {espacosDoConcelho.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          {/* Só aparece se houver ciclos: uma caixa de escolha com uma opção
              só — «Todos» — é uma pergunta sem resposta possível. */}
          {ciclos.length > 0 ? (
            <div>
              <label htmlFor="w-ciclo" className={rotulo}>
                Só de um ciclo
              </label>
              <select
                id="w-ciclo"
                value={ciclo}
                onChange={(e) => setCiclo(e.target.value)}
                className={campo}
              >
                <option value="">Todos os ciclos</option>
                {ciclos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label htmlFor="w-categoria" className={rotulo}>
              Categoria
            </label>
            <select
              id="w-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={campo}
            >
              <option value="">Todas</option>
              {categorias.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="w-limite" className={rotulo}>
              Quantos eventos: <strong>{limite}</strong>
            </label>
            <input
              id="w-limite"
              type="range"
              min={1}
              max={20}
              value={limite}
              onChange={(e) => setLimite(Number(e.target.value))}
              className="mt-3 w-full accent-accent"
            />
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium">Disposição</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {DISPOSICOES.map((item) => (
              <label
                key={item}
                className={`flex cursor-pointer flex-col gap-1 rounded border p-3 text-sm ${
                  disposicao === item ? 'border-accent bg-accent-soft' : 'border-border bg-surface'
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="w-disposicao"
                    value={item}
                    checked={disposicao === item}
                    onChange={() => setDisposicao(item)}
                    className="size-4 accent-accent"
                  />
                  {NOMES_DISPOSICAO[item].nome}
                </span>
                <span className="text-xs text-muted">{NOMES_DISPOSICAO[item].nota}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium">A vossa cor</legend>
          <label className="mt-2 flex min-h-11 items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={usarCor}
              onChange={(e) => setUsarCor(e.target.checked)}
              className="size-5 accent-accent"
            />
            Usar a cor da instituição
          </label>

          {usarCor ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                aria-label="Escolher a cor"
                className="h-11 w-14 cursor-pointer rounded border border-field bg-surface p-1"
              />
              <input
                type="text"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                aria-label="Código da cor em hexadecimal"
                spellCheck={false}
                className="min-h-11 w-28 rounded border border-field bg-surface px-3 font-mono text-sm"
              />
              <span className="flex gap-1.5">
                {CORES_SUGERIDAS.map((sugestao) => (
                  <button
                    key={sugestao}
                    type="button"
                    onClick={() => setCor(sugestao)}
                    aria-label={`Usar a cor ${sugestao}`}
                    style={{ backgroundColor: sugestao }}
                    className="size-7 rounded-full border border-border"
                  />
                ))}
              </span>
              <p className="w-full text-xs text-muted">
                Onde a cor é texto, é escurecida ou aclarada até se ler sobre o fundo. A caixa nunca
                fica ilegível por causa de uma cor de marca.
              </p>
            </div>
          ) : null}
        </fieldset>

        <div className="mt-6 grid gap-4 *:min-w-0 sm:grid-cols-2">
          <div>
            <label htmlFor="w-tema" className={rotulo}>
              Tema
            </label>
            <select
              id="w-tema"
              value={tema}
              onChange={(e) => setTema(e.target.value as typeof tema)}
              className={campo}
            >
              <option value="auto">Segue quem visita</option>
              <option value="light">Sempre claro</option>
              <option value="dark">Sempre escuro</option>
            </select>
          </div>

          <div>
            <label htmlFor="w-letra" className={rotulo}>
              A vossa letra
            </label>
            <input
              id="w-letra"
              type="text"
              value={letra}
              onChange={(e) => setLetra(e.target.value)}
              placeholder="Open Sans, sans-serif"
              spellCheck={false}
              className={campo}
            />
          </div>

          <div>
            <label htmlFor="w-pesquisa" className={rotulo}>
              Só eventos com estas palavras
            </label>
            <input
              id="w-pesquisa"
              type="search"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              placeholder="filarmónica, fado, feira…"
              maxLength={120}
              className={campo}
            />
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium">Mostrar</legend>
          <div className="mt-1 flex flex-wrap gap-x-6">
            <label className="flex min-h-11 items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={cabecalho}
                onChange={(e) => setCabecalho(e.target.checked)}
                className="size-5 accent-accent"
              />
              Título
            </label>
            <label className="flex min-h-11 items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={moldura}
                onChange={(e) => setMoldura(e.target.checked)}
                className="size-5 accent-accent"
              />
              Moldura
            </label>
            <label className="flex min-h-11 items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={gratis}
                onChange={(e) => setGratis(e.target.checked)}
                className="size-5 accent-accent"
              />
              Só entrada livre
            </label>
          </div>
        </fieldset>
      </div>

      {/* A caixa a sério, e não um desenho dela: é o mesmo `iframe` que vai
          para o sítio de quem embebe, no mesmo endereço. */}
      <div className="lg:sticky lg:top-6">
        <h3 className="ct-heading">Fica assim</h3>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {LARGURAS.map((item) => (
            <button
              key={item.valor}
              type="button"
              onClick={() => setLargura(item.valor)}
              aria-pressed={largura === item.valor}
              className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${
                largura === item.valor
                  ? 'border-accent bg-accent-soft font-medium'
                  : 'border-border bg-surface'
              }`}
            >
              {item.etiqueta}
              <span className="ml-1.5 text-xs text-muted">{item.nota}</span>
            </button>
          ))}
        </div>

        <div className="ct-grain mt-3 overflow-x-auto rounded-lg border border-dashed border-border p-3">
          <iframe
            key={endereco}
            src={endereco}
            title={`Pré-visualização: ${tituloIframe}`}
            style={{ width: `${largura}px`, height: `${alturaEstimada(escolhas)}px` }}
            className="block max-w-full"
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          A moldura a tracejado é desta página e não vai no código — está aqui para se ver onde a
          caixa acaba.
        </p>
      </div>

      <div className="lg:col-span-2">
        <h3 className="ct-heading">Copiem</h3>
        <p className="mt-2 max-w-2xl text-muted">
          Colem esta linha no sítio onde a agenda deve aparecer. A caixa ajusta a altura ao conteúdo
          sozinha.
        </p>
        <pre
          className="mt-3 overflow-x-auto rounded border border-border bg-surface p-3 text-xs leading-relaxed"
          tabIndex={0}
        >
          <code>{codigoDoScript(base, escolhas)}</code>
        </pre>
        <p className="mt-3">
          <Copiar texto={codigoDoScript(base, escolhas)} etiqueta="Copiar o código" />
        </p>

        <details className="mt-6 rounded border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">
            O nosso gestor de conteúdos não deixa colar &lt;script&gt;
          </summary>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Acontece em muitos. Usem o <code>iframe</code> diretamente — funciona igual, mas a
            altura fica fixa no valor abaixo, calculado para o que escolheram.
          </p>
          <pre
            className="mt-3 overflow-x-auto rounded border border-border bg-paper p-3 text-xs leading-relaxed"
            tabIndex={0}
          >
            <code>{codigoDoIframe(base, escolhas, tituloIframe)}</code>
          </pre>
          <p className="mt-3">
            <Copiar
              texto={codigoDoIframe(base, escolhas, tituloIframe)}
              etiqueta="Copiar o iframe"
            />
          </p>
        </details>
      </div>
    </div>
  );
}
