import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { criarRegiao } from '@/src/lib/admin/actions';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

const FIELD = 'mt-1 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const LABEL = 'block text-sm font-medium';
const AJUDA = 'mt-1 text-sm text-muted';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * O exemplo que fica na caixa dos concelhos, e que se pode copiar: a Lezíria
 * do Tejo, com um concelho de outro distrito a mostrar o sexto campo.
 */
const EXEMPLO_DE_CONCELHOS = [
  'santarem | Santarém | 39.2362 | -8.6850 | https://www.cm-santarem.pt',
  'cartaxo | Cartaxo | 39.1592 | -8.7873 | https://www.cm-cartaxo.pt',
  'azambuja | Azambuja | 39.0703 | -8.8680 | https://www.cm-azambuja.pt | Lisboa',
].join('\n');

const ARTIGOS: ReadonlyArray<{ valor: string; rotulo: string }> = [
  { valor: 'o', rotulo: 'o — «o Médio Tejo»' },
  { valor: 'a', rotulo: 'a — «a Lezíria do Tejo»' },
  { valor: 'os', rotulo: 'os — «os Açores»' },
  { valor: 'as', rotulo: 'as — «as Terras de Trás-os-Montes»' },
];

/** O valor que o formulário trazia quando a ação o devolveu com um aviso. */
function texto(valor: string | string[] | undefined): string {
  return typeof valor === 'string' ? valor : '';
}

/**
 * Um campo com o rótulo e a ajuda ligados: `aria-describedby` faz o leitor de
 * ecrã ler a ajuda quando o foco entra no campo, que é quando ela faz falta.
 */
function Campo({
  nome,
  rotulo,
  valor,
  ajuda,
  opcional,
  tipo,
  exemplo,
}: {
  nome: string;
  rotulo: string;
  valor: string;
  ajuda?: string;
  opcional?: boolean;
  tipo?: 'text' | 'url' | 'email';
  exemplo?: string;
}) {
  const idDaAjuda = ajuda ? `${nome}-ajuda` : undefined;
  return (
    <div>
      <label htmlFor={nome} className={LABEL}>
        {rotulo}
        {opcional ? <span className="ml-1 font-normal text-muted">(opcional)</span> : null}
      </label>
      <input
        id={nome}
        name={nome}
        type={tipo ?? 'text'}
        defaultValue={valor}
        required={!opcional}
        placeholder={exemplo}
        aria-describedby={idDaAjuda}
        className={FIELD}
      />
      {ajuda ? (
        <p id={idDaAjuda} className={AJUDA}>
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Uma região nova, sem SQL.
 *
 * O formulário fala com `create_region` (migração 0121), que faz nascer tudo
 * de uma vez ou nada: a linha da região — com a contagem de concelhos e a
 * caixa geográfica calculadas da lista —, os concelhos pela ordem em que se
 * escreveram, e por concelho um espaço provisório e uma fonte desligada, que
 * são o mínimo que as schema-checks exigem a um concelho vivo. O que fica
 * para depois está escrito ao fundo, e no guia `docs/NOVA-CIM.md`.
 *
 * Um erro devolve o formulário preenchido, com o aviso a dizer a linha: a
 * lista de concelhos é longa, e uma vírgula no lugar do ponto não pode custar
 * a lista inteira.
 */
export default async function NovaRegiao({ searchParams }: Props) {
  const params = await searchParams;

  if (!hasServiceRole) {
    return (
      <>
        <PageHeader title="Nova região" />
        <p className="text-muted">
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. Sem ela o backoffice não escreve nada.
        </p>
      </>
    );
  }

  const aviso = texto(params.aviso);

  return (
    <>
      <PageHeader
        title="Nova região"
        lead="Uma CIM nova entra sem um único commit: preenche-se o que a região é e a lista dos concelhos, e a base faz nascer tudo de uma vez — a linha da região, os concelhos, e por concelho um espaço provisório e uma fonte desligada. O domínio no Vercel e no DNS é o passo seguinte."
      />

      {aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {aviso}
        </p>
      ) : null}

      <form action={criarRegiao} className="max-w-2xl space-y-8">
        <fieldset>
          <legend className="text-lg font-semibold">Identidade</legend>
          <div className="mt-3 space-y-4">
            <Campo
              nome="id"
              rotulo="Identificador"
              valor={texto(params.id)}
              exemplo="leziria-do-tejo"
              ajuda="Um slug curto e permanente — minúsculas, algarismos e hífenes. Entra em endereços internos e chaves, e não muda depois."
            />
            <Campo
              nome="name"
              rotulo="Nome da região"
              valor={texto(params.name)}
              exemplo="Lezíria do Tejo"
              ajuda="Sem artigo: o artigo escolhe-se a seguir, e a prosa compõe com ele «da Lezíria», «na Lezíria»."
            />
            <div>
              <label htmlFor="article" className={LABEL}>
                Artigo do nome
              </label>
              <select
                id="article"
                name="article"
                required
                defaultValue={texto(params.article)}
                aria-describedby="article-ajuda"
                className={FIELD}
              >
                <option value="">Escolhe o artigo…</option>
                {ARTIGOS.map((artigo) => (
                  <option key={artigo.valor} value={artigo.valor}>
                    {artigo.rotulo}
                  </option>
                ))}
              </select>
              <p id="article-ajuda" className={AJUDA}>
                Nenhuma heurística acerta nos topónimos portugueses, por isso a região declara o
                artigo e o resto deriva: «do», «da», «dos», «das».
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Promotor e contacto</legend>
          <div className="mt-3 space-y-4">
            <Campo
              nome="cim_name"
              rotulo="Nome do promotor"
              valor={texto(params.cim_name)}
              exemplo="Comunidade Intermunicipal da Lezíria do Tejo"
            />
            <Campo
              nome="cim_url"
              rotulo="Endereço do promotor"
              valor={texto(params.cim_url)}
              tipo="url"
              exemplo="https://cimlt.pt"
              ajuda="O sítio da CIM, completo, com https://."
            />
            <Campo
              nome="contact_email"
              rotulo="Email da região"
              valor={texto(params.contact_email)}
              tipo="email"
              exemplo="coreto@cimlt.pt"
              ajuda="Tem de ser exatamente o endereço que reencaminha para o webhook de submissões: é por ele que uma submissão fica marcada com a região (docs/EMAIL.md)."
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Encaminhamento</legend>
          <div className="mt-3 space-y-4">
            <Campo
              nome="domain"
              rotulo="Domínio"
              valor={texto(params.domain)}
              exemplo="coreto.cimlt.pt"
              ajuda="O Host que resolve para esta região — só o nome, sem https:// nem barras. Uma região sem domínio próprio usa o subdomínio de produto, <slug>.coreto.org."
            />
            <Campo
              nome="ical_uid_domain"
              rotulo="Domínio dos UID iCal"
              valor={texto(params.ical_uid_domain)}
              opcional
              exemplo="coreto.cimlt.pt"
              ajuda="Em branco fica igual ao domínio. É definitivo: depois de haver um calendário subscrito nunca mais muda, porque mudá-lo duplicava a agenda de toda a gente."
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Concelhos</legend>
          <div className="mt-3 space-y-4">
            <Campo
              nome="district"
              rotulo="Distrito"
              valor={texto(params.district)}
              opcional
              exemplo="Santarém"
              ajuda="O distrito da maior parte dos concelhos — é público, na ficha de cada um. Um concelho de outro distrito diz o seu na própria linha, como sexto campo."
            />
            <div>
              <label htmlFor="municipalities" className={LABEL}>
                Lista de concelhos
              </label>
              <textarea
                id="municipalities"
                name="municipalities"
                rows={12}
                required
                defaultValue={texto(params.municipalities)}
                placeholder={EXEMPLO_DE_CONCELHOS}
                aria-describedby="municipalities-ajuda"
                spellCheck={false}
                className={`${FIELD} font-mono text-sm`}
              />
              <div id="municipalities-ajuda" className={AJUDA}>
                <p>
                  Um concelho por linha, pela ordem em que a região os quer ver nas listas:{' '}
                  <code>slug | Nome | latitude | longitude | sítio</code>. O sítio é opcional; o
                  sexto campo, também opcional, é o distrito de um concelho que não é do distrito da
                  região. As coordenadas são as da sede, em graus decimais, com a longitude
                  negativa. Os slugs dos concelhos são um espaço global do produto — um nome
                  repetido desambigua-se com a terra. Por exemplo:
                </p>
                <pre className="mt-2 overflow-x-auto rounded border border-border bg-paper p-3 text-xs">
                  {EXEMPLO_DE_CONCELHOS}
                </pre>
              </div>
            </div>
          </div>
        </fieldset>

        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm font-medium hover:bg-surface"
        >
          Criar a região
        </button>
      </form>

      <section aria-labelledby="o-que-nasce" className="mt-10 max-w-2xl">
        <h2 id="o-que-nasce" className="text-lg font-semibold">
          O que nasce, e o que fica para depois
        </h2>
        <p className="mt-1 text-sm text-muted">
          A região nasce ligada, com a contagem de concelhos e a caixa geográfica calculadas da
          lista — as promessas que as schema-checks verificam todas as noites. Cada concelho nasce
          com um espaço provisório, «Câmara Municipal de …», no centro do concelho e com a nota a
          dizer que está por confirmar; e com uma fonte desligada, a apontar ao sítio do município,
          que se liga quando se souber o que ler e como. Existem porque nenhum concelho pode ficar
          sem espaço nem sem fonte; o catálogo verdadeiro entra depois, por migração, com
          proveniência.
        </p>
        <p className="mt-2 text-sm text-muted">
          A seguir: a ficha da região, para a prosa, os logótipos, a licença e as secções; e o
          domínio no Vercel e no DNS, que continua a ser o passo 2 do guia{' '}
          <code>docs/NOVA-CIM.md</code>. Enquanto o DNS não resolve, a região responde a quem lhe
          puser o cabeçalho <code>Host</code>.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/admin/regioes" className="underline underline-offset-4">
            Voltar às regiões
          </Link>
        </p>
      </section>
    </>
  );
}
