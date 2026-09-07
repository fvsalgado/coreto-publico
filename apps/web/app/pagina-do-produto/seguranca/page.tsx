import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { AnalyticsProvider } from '@/src/components/AnalyticsProvider';
import { BandstandMark } from '@/src/components/BandstandMark';
import { PageHeader } from '@/src/components/PageHeader';
import { REGIAO_DA_FICHA } from '@/src/lib/analytics/posthog';
import { formatLongDate } from '@/src/lib/format';
import { CORES_DO_TOLDO } from '@/src/lib/marca';
import { PRODUTO } from '@/src/lib/produto';
import { REVISAO_DA_POLITICA, URL_DA_POLITICA } from '../politica-de-seguranca';

/**
 * A política de segurança, servida no domínio do produto.
 *
 * É o destino do campo `Policy:` de todos os `security.txt`. Apontava para o
 * `SECURITY.md` no GitHub e o repositório é privado — 404 para quem seguisse a
 * RFC 9116. O porquê de a política ser do produto e ter um endereço só está em
 * `../politica-de-seguranca.ts`.
 *
 * **É a mesma política do `SECURITY.md`, e são duas cópias.** Não há aqui um
 * gerador que leia o Markdown: o ficheiro está fora do que a aplicação leva
 * para o servidor, e uma página que dependesse de o ler era uma página que
 * desaparecia no dia do build errado. O preço é o que os textos legais desta
 * casa já pagam — quem mexer numa mexe na outra, e a data de revisão é a
 * mesma nas duas.
 *
 * Vive fora de `app/[regiao]/` porque não é de região nenhuma, e por isso traz
 * a sua moldura: por cima dela só está o esqueleto de raiz. A moldura é a
 * reduzida — a marca e o caminho de volta —, e não a da ficha técnica com o
 * botão de falar e o seletor de tema: repetir a moldura inteira por causa de
 * um texto era pôr duas cópias dela a divergir.
 */

export const metadata: Metadata = {
  title: 'Política de segurança — Coreto',
  description:
    'Como reportar uma falha de segurança no Coreto, o que acontece depois e em que prazos. O âmbito, o que está fora dele e o que já está feito.',
  alternates: { canonical: URL_DA_POLITICA },
};

/*
 * Estática a sério, como a ficha técnica ao lado: não toca na base de dados.
 * É a página que um investigador abre quando alguma coisa está a correr mal —
 * e o dia em que a base está em baixo é precisamente um desses dias.
 */
export const dynamic = 'error';

/** A barra do sistema no telemóvel: o vermelho da montra, como na ficha. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: CORES_DO_TOLDO.montra },
    { media: '(prefers-color-scheme: dark)', color: CORES_DO_TOLDO.montra },
  ],
};

export default function PaginaDaPoliticaDeSeguranca() {
  return (
    <div data-paleta="montra" className="contents">
      <AnalyticsProvider regiao={REGIAO_DA_FICHA} />
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>

      <header className="ct-bloco-marca ct-grain bg-brand text-on-brand">
        <div className="ct-goteira relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-x-3 py-3.5">
          <Link
            href="/"
            className="font-display flex min-h-11 items-center gap-2.5 text-2xl font-semibold tracking-tight"
          >
            <BandstandMark className="size-7" />
            {PRODUTO.nome}
          </Link>
        </div>
      </header>
      <div className="ct-lambrequim ct-lambrequim-marca" aria-hidden="true" />

      <main id="conteudo" className="ct-goteira mx-auto w-full max-w-5xl flex-1 py-8 sm:py-10">
        <article className="max-w-2xl">
          <PageHeader
            title="Política de segurança"
            eyebrow="O produto"
            lead="Onde reportar uma falha do Coreto, o que acontece a seguir e em que prazos. Vale para o software e para todas as agendas que ele serve."
          />

          <h2 className="ct-heading mt-8">Como reportar</h2>
          <p className="mt-3 text-muted">
            <strong className="text-ink">Não abra um issue público</strong> para uma falha de
            segurança.
          </p>
          <p className="mt-3 text-muted">
            Escreva para{' '}
            <a href={`mailto:${PRODUTO.email}`} className="underline underline-offset-4">
              {PRODUTO.email}
            </a>{' '}
            com <code className="rounded bg-accent-soft px-1">[segurança]</code> no assunto. É o
            contacto de quem escreve e corrige o software — uma falha no Coreto é uma falha em todas
            as regiões ao mesmo tempo. O contacto da agenda por onde chegou, que está no{' '}
            <code className="rounded bg-accent-soft px-1">security.txt</code> do domínio dela, fica
            como alternativa.
          </p>
          <p className="mt-3 text-muted">
            Se a falha envolver dados pessoais de alguém, diga-o na primeira linha: muda a ordem
            pela qual as coisas são tratadas e os prazos que a lei impõe.
          </p>
          <p className="mt-3 text-muted">Ajuda muito incluir:</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
            <li>o que se consegue fazer que não se devia conseguir;</li>
            <li>os passos para lá chegar, com o endereço concreto;</li>
            <li>
              a data e a hora aproximadas em que tentou, para se poderem encontrar os registos;
            </li>
            <li>se chegou a dados de alguém — e, se sim, que não ficou com cópia.</li>
          </ul>

          <h2 className="ct-heading mt-8">O que esperar</h2>
          <dl className="mt-3 space-y-3 text-muted">
            <div>
              <dt className="font-medium text-ink">Em 72 horas</dt>
              <dd>Acusamos a receção e dizemos se conseguimos reproduzir.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Em 30 dias</dt>
              <dd>Falha confirmada corrigida, ou uma data com fundamento para o ser.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Depois</dt>
              <dd>Publicamos o que se passou, e o seu nome se o quiser.</dd>
            </div>
          </dl>
          <p className="mt-3 text-muted">
            Este é um projeto pequeno, com poucas pessoas e sem programa de recompensas. Os prazos
            acima são um compromisso honesto, não um contrato comercial.
          </p>

          <h2 className="ct-heading mt-8">Âmbito</h2>
          <p className="mt-3 text-muted">Interessa-nos, por esta ordem:</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
            <li>
              qualquer caminho que leia ou escreva dados de submissões — endereços de email de quem
              submete, anexos, hashes de IP — sem passar pela moderação;
            </li>
            <li>
              qualquer forma de entrar na área de moderação sem a palavra-passe, ou de correr uma
              ação de moderação sem sessão;
            </li>
            <li>
              exposição da chave de serviço da base de dados, ou escrita em tabelas que a política
              de leitura devia proteger;
            </li>
            <li>injeção em SQL, em HTML ou nos feeds gerados;</li>
            <li>
              falhas na caixa incorporável que permitam correr código no sítio de quem a embebeu.
            </li>
          </ul>

          <h2 className="ct-heading mt-8">O que não é falha</h2>
          <p className="mt-3 text-muted">
            Fora de âmbito, e escrito para poupar tempo a quem reporta: resultados brutos de
            varredores automáticos sem impacto demonstrado; a ausência de cabeçalhos que não mudam
            nada neste contexto; o CORS aberto em{' '}
            <code className="rounded bg-accent-soft px-1">/api/events</code> e nos feeds, que é
            deliberado — os dados são públicos e existem para ser reutilizados; e os contadores por
            evento poderem ser inflacionados por quem insista, que é um custo conhecido da decisão
            de não identificar quem visita.
          </p>

          <h2 className="ct-heading mt-8">O que já está feito</h2>
          <p className="mt-3 text-muted">Para não gastar tempo a confirmar o que já se sabe:</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
            <li>
              <strong className="text-ink">Não há contas de utilizador.</strong> A área de moderação
              tem uma palavra-passe, guardada em hash scrypt com sal, e um cookie de sessão assinado
              com HMAC, <code className="rounded bg-accent-soft px-1">httpOnly</code> e{' '}
              <code className="rounded bg-accent-soft px-1">sameSite=strict</code>. As tentativas de
              entrada são limitadas por IP.
            </li>
            <li>
              <strong className="text-ink">A chave de serviço nunca chega ao navegador.</strong> O
              que vai para o cliente é a chave pública de leitura, e o que ela pode ler é o que a
              política de leitura da base deixa.
            </li>
            <li>
              <strong className="text-ink">
                Todas as escritas de moderação passam por funções SQL
              </strong>{' '}
              com auditoria, com a execução revogada a quem lê do lado público.
            </li>
            <li>
              <strong className="text-ink">Endereços IP nunca são guardados em claro</strong> — só
              um hash com sal, e o registo que serve para limitar tentativas é apagado ao fim de
              dois dias.
            </li>
            <li>
              <strong className="text-ink">O webhook de email exige assinatura HMAC</strong>; sem
              segredo configurado, recusa tudo.
            </li>
            <li>
              <strong className="text-ink">A CSP é restritiva</strong>, com{' '}
              <code className="rounded bg-accent-soft px-1">frame-ancestors &apos;none&apos;</code>{' '}
              em todo o lado exceto na caixa incorporável, que existe para ser embebida. Uma
              exceção, e está aqui escrita por ser exceção:{' '}
              <code className="rounded bg-accent-soft px-1">script-src</code> leva{' '}
              <code className="rounded bg-accent-soft px-1">&apos;unsafe-inline&apos;</code>, porque
              a hidratação arranca com scripts inline e a alternativa canónica obrigava a
              renderização dinâmica em todas as páginas. O risco aceite: um script inline só corre
              se alguém conseguir injetar HTML.
            </li>
            <li>
              <strong className="text-ink">Há varrimento de segredos em cada alteração</strong>, sem
              exceções silenciosas, e análise estática do código e dos próprios workflows.
            </li>
          </ul>

          <h2 className="ct-heading mt-8">Divulgação</h2>
          <p className="mt-3 text-muted">
            Pedimos divulgação coordenada: dê-nos a hipótese de corrigir antes de tornar público. Em
            troca, mantemo-lo a par e damos-lhe crédito no aviso, se quiser.
          </p>

          <p className="mt-8 border-t border-border pt-4 text-sm text-muted">
            Política revista a {formatLongDate(REVISAO_DA_POLITICA)}. O endereço de máquina que
            aponta para aqui é{' '}
            <code className="rounded bg-accent-soft px-1">/.well-known/security.txt</code>, em cada
            um dos domínios do Coreto.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/" className="underline underline-offset-4">
              Voltar à ficha técnica do Coreto
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
