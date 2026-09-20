import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { Pontos } from '@/src/components/informacoes/Pontos';
import { PorExtenso } from '@/src/components/informacoes/PorExtenso';
import { PRIVACIDADE, SUBCONTRATANTES } from '@/src/components/informacoes/privacidade';
import { postHogScriptUrl } from '@/src/lib/analytics/posthog';
import { env, hasAnalytics } from '@/src/lib/env';
import { formatLongDate } from '@/src/lib/format';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import { REVISAO_PRIVACIDADE } from '@/src/lib/revisao';

/*
 * Os dois nomes que a página escreve são derivados da mesma variável de onde
 * a CSP tira os dela (ver `next.config.ts`). Escritos à mão, uma mudança de
 * região da ferramenta — `eu` para `us` — deixava a política a nomear
 * servidores que já ninguém contacta, e uma política que nomeia o servidor
 * errado é pior do que uma que não nomeia nenhum.
 */
const ANFITRIAO_DA_MEDICAO = new URL(env.NEXT_PUBLIC_POSTHOG_HOST).host;
const ANFITRIAO_DO_SCRIPT = new URL(postHogScriptUrl(env.NEXT_PUBLIC_POSTHOG_HOST)).host;

export const metadata: Metadata = {
  title: 'Privacidade',
  description:
    'O que o Coreto faz com os seus dados, e o que não faz: sem cookies de rastreio, sem conta, sem perfis. A política de privacidade por extenso, em português simples.',
  alternates: { canonical: '/privacidade' },
};

/**
 * A política de privacidade, com endereço próprio.
 *
 * Viveu dentro de `/informacoes`, e a fusão fazia sentido: quem quer saber o
 * que é isto quer saber, no mesmo momento, se pode confiar. Deixou de fazer
 * no dia em que as informações passaram a ser uma secção que se desliga no
 * painel: desligada, a página responde 404 — e levava consigo a única
 * descrição do que o sítio faz com o email de quem envia um evento. O RGPD
 * (artigo 13.º) quer essa informação à vista de quem dá os dados, e
 * `/submeter` pede um email em qualquer região, com as informações ligadas ou
 * não. Um 404 num texto legal não é uma escolha que um painel possa dar.
 *
 * Por isso esta página não tem `exigirSeccao`: não pertence a secção nenhuma
 * e não há interruptor que a apague. O resumo em quatro pontos continua em
 * `/informacoes#privacidade`, a apontar para aqui; o texto por extenso está
 * só aqui, para não haver duas cópias a divergir.
 */
export default async function PrivacidadePage({ params }: { params: Promise<{ regiao: string }> }) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  // O texto nomeia páginas que se desligam no painel; nomeia-as só quando
  // existem. A página das informações é o contexto de onde isto veio, e a
  // ligação de volta só se desenha quando há para onde voltar.
  const [haCoretos, haInformacoes] = await Promise.all([
    seccaoLigada(regiao.id, 'coretos'),
    seccaoLigada(regiao.id, 'informacoes'),
  ]);
  const EMAIL = regiao.email;
  const responsavel = regiao.responsavelPeloTratamento;
  // O contacto próprio do responsável ganha ao da região: são a mesma coisa
  // na esmagadora maioria dos casos, e quando não são é porque alguém tomou a
  // decisão de os separar.
  const contactoDeDireitos = responsavel?.email ?? EMAIL;

  return (
    <article className="max-w-2xl">
      <PageHeader
        title="Privacidade"
        eyebrow="O projeto"
        lead="O que o Coreto faz com os seus dados, e o que não faz. Primeiro em quatro pontos; a política por extenso logo a seguir."
      />

      <p className="text-muted">
        O Coreto é uma agenda de eventos, não um negócio de dados. Recolhe o mínimo para funcionar —
        e o mínimo é isto:
      </p>
      <Pontos pontos={PRIVACIDADE} />

      <PorExtenso titulo="A política de privacidade por extenso">
        {/*
          Quem responde pelo tratamento é a região que o declara — a coluna
          `data_controller_*`, com a CIM como omissão. O MODELO (a CIM como
          responsável, o Coreto como quem opera) é uma decisão contratual do
          dono do software, CIM a CIM, e não deste código: o código limita-se
          a mostrar o que a linha da região diz. Ver docs/RGPD.md.
        */}
        {responsavel ? (
          <>
            <h2 className="font-semibold">Quem responde pelo tratamento</h2>
            <p>Quem responde pelos dados pessoais recolhidos por este sítio, e como se contacta:</p>
            {/*
              Uma lista e não uma frase, por duas razões.
              -------------------------------------------------------------
              A primeira é gramática: a frase era «…é a <nome>», com o artigo
              cravado. Serve para «a Comunidade Intermunicipal do Médio Tejo»
              e produz «é a Fábio Salgado» no dia em que quem responde é uma
              pessoa — que é o caso da região de montra. Um artigo por nome
              não se adivinha, e o `regions.article` é o da região, não o de
              quem responde.

              A segunda é que o RGPD quer mais do que um nome. O que aqui
              aparece é o que a linha da região tiver: o que não estiver
              preenchido não se desenha, e não se inventa.
            */}
            <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
              <dt className="font-medium">Responsável pelo tratamento</dt>
              <dd>
                {responsavel.url ? (
                  <a
                    href={responsavel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {responsavel.nome}
                  </a>
                ) : (
                  responsavel.nome
                )}
              </dd>

              {responsavel.nif ? (
                <>
                  <dt className="font-medium">NIF</dt>
                  <dd>{responsavel.nif}</dd>
                </>
              ) : null}

              {responsavel.morada ? (
                <>
                  <dt className="font-medium">Morada</dt>
                  <dd className="whitespace-pre-line">{responsavel.morada}</dd>
                </>
              ) : null}

              {contactoDeDireitos ? (
                <>
                  <dt className="font-medium">Contacto para os seus direitos</dt>
                  <dd>
                    <a
                      href={`mailto:${contactoDeDireitos}`}
                      className="underline underline-offset-4"
                    >
                      {contactoDeDireitos}
                    </a>
                  </dd>
                </>
              ) : null}

              {/*
                O EPD é obrigatório quando quem responde é uma autoridade ou
                organismo público (artigo 37.º, n.º 1, alínea a)), e o n.º 7
                manda publicar o contacto. Não se desenha quando não há: uma
                linha vazia com este rótulo parecia uma obrigação por cumprir
                num sítio onde ela pode simplesmente não existir.
              */}
              {responsavel.epd ? (
                <>
                  <dt className="font-medium">Encarregado de proteção de dados</dt>
                  <dd>{responsavel.epd}</dd>
                </>
              ) : null}

              {responsavel.epdContacto ? (
                <>
                  <dt className="font-medium">Contacto do encarregado</dt>
                  <dd>
                    {responsavel.epdContacto.includes('@') ? (
                      <a
                        href={`mailto:${responsavel.epdContacto}`}
                        className="underline underline-offset-4"
                      >
                        {responsavel.epdContacto}
                      </a>
                    ) : (
                      responsavel.epdContacto
                    )}
                  </dd>
                </>
              ) : null}
            </dl>
          </>
        ) : null}

        <h2 className={regiao.responsavelPeloTratamento ? 'pt-2 font-semibold' : 'font-semibold'}>
          Não há aviso de cookies, e porquê
        </h2>
        <p>
          O artigo 5.º da Lei n.º 41/2004 exige consentimento para guardar informação no equipamento
          de quem visita — mas ressalva o armazenamento estritamente necessário para um serviço que
          a pessoa pediu. Uma preferência de visualização que alguém acabou de escolher, ela mesma,
          ao carregar num botão, é precisamente isso. Pedir consentimento para cumprir a escolha que
          se acabou de fazer seria perguntar duas vezes a mesma coisa.
        </p>
        <p>
          A preferência fica no <i lang="en">localStorage</i> do navegador, na chave{' '}
          <code className="rounded bg-accent-soft px-1">coreto-theme</code>, com o valor{' '}
          <code className="rounded bg-accent-soft px-1">light</code> ou{' '}
          <code className="rounded bg-accent-soft px-1">dark</code>. Enquanto não carregar no botão
          não fica lá nada. Para a apagar, basta limpar os dados deste sítio no navegador. O único
          cookie que o sítio pode criar é o de sessão da área de moderação, e só para quem tenha
          credenciais.
        </p>
        <p>
          A segunda chave é a dos eventos que guardar: o coração de cada evento escreve{' '}
          <code className="rounded bg-accent-soft px-1">coreto-favoritos</code> no mesmo{' '}
          <i lang="en">localStorage</i>, com o título, as datas e o sítio de cada um.{' '}
          <strong>Essa lista nunca chega até nós</strong> — não é enviada para o servidor, não tem
          conta associada, não passa para outro aparelho, e do nosso lado não há forma de saber que
          alguém guardou o quê. Apaga-se em «Esquecer tudo», na página dos guardados, ou limpando os
          dados do sítio no navegador.
        </p>

        <h2 className="pt-2 font-semibold">Que dados são recolhidos</h2>
        <p>
          <strong>De quem envia um evento:</strong> o endereço de email, que é obrigatório — sem ele
          não há como pedir um esclarecimento nem avisar que o evento foi publicado —, o nome e a
          organização se os quiser dar, e os dados do evento, incluindo anexos como cartazes ou
          agendas em PDF. O mesmo vale para o que chega ao endereço de submissões: guardamos o
          remetente, o assunto, o corpo e os anexos.
        </p>
        <p>
          <strong>Para travar abuso:</strong> um hash com sal do endereço IP de quem submete, nunca
          o endereço em si. Serve para contar quantos pedidos vêm do mesmo sítio numa janela de
          tempo. Não permite reconstruir o endereço nem identificar ninguém, e é apagado ao fim de
          dois dias.
        </p>
        {/*
          Esta frase disse «nada» durante o tempo em que o PostHog já corria em
          produção — e uma frase falsa numa política desconta as verdadeiras que
          estão ao lado dela. Agora segue a configuração: sem chave não sai
          daqui um evento e «nada» volta a ser verdade.
        */}
        <p>
          <strong>De quem só visita:</strong>{' '}
          {hasAnalytics ? (
            <>
              um evento por cada página aberta, sem identificação de quem a abriu. Leva o caminho da
              página, o identificador da região e o que a ferramenta de medição junta a qualquer
              evento — o endereço da página, o navegador e o sistema, e a página de onde se veio.
              Leva também um identificador que existe só na memória do separador e desaparece quando
              ele fecha: liga as páginas de uma mesma visita e nunca duas visitas diferentes. Não
              leva nome, conta nem endereço de email, e o que fica de fora está mais abaixo, em
              «Como é medida a utilização».
            </>
          ) : (
            'nada.'
          )}{' '}
          O fornecedor de alojamento mantém, como qualquer alojamento, registos técnicos de acesso
          para segurança e diagnóstico; esses registos não são usados por nós para analisar
          comportamentos.
        </p>

        <h2 className="pt-2 font-semibold">O que sai daqui para fora</h2>
        {/*
          O número é contado pela configuração e não à mão. À mão dizia «três»
          com quatro na página: o PostHog entrou e a contagem ficou para trás,
          que é o engano que uma frase presa à configuração não deixa repetir.
        */}
        <p>
          <strong>
            {hasAnalytics ? 'Quatro coisas' : 'Três coisas'}, e vale a pena dizer quais e onde.
          </strong>{' '}
          Nenhuma delas leva cookies nem identificadores nossos; todas elas revelam o seu endereço
          IP ao servidor a que o navegador se liga, como acontece com qualquer conteúdo servido por
          terceiros.
        </p>
        <p>
          <strong>Os pedaços do mapa</strong>, e só em <Link href="/mapa">/mapa</Link>. O mapa da
          agenda desenha ruas, e as ruas vêm do{' '}
          <a
            href="https://openfreemap.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            OpenFreeMap
          </a>
          , um serviço gratuito que publica dados do{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            OpenStreetMap
          </a>
          . Ao abrir aquela página, e só então, o seu navegador pede os pedaços de mapa a{' '}
          <code>tiles.openfreemap.org</code>, o que revela a esse servidor que pedaços do mapa está
          a ver. Nada do que se passa no mapa volta para nós. Os contornos dos concelhos, esses, são
          nossos: estão no repositório e desenham-se sem pedir nada a ninguém.
        </p>
        <p>
          <strong>As fotografias dos espaços e dos coretos</strong>, servidas pelo{' '}
          <a
            href="https://commons.wikimedia.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Wikimedia Commons
          </a>
          . São imagens de licença livre, e ficam onde estão em vez de serem copiadas para cá: é o
          que mantém a atribuição ligada ao autor. Aparecem em <Link href="/espacos">/espacos</Link>
          , na ficha de cada espaço
          {haCoretos ? (
            <>
              , em <Link href="/coretos">/coretos</Link>
            </>
          ) : null}{' '}
          e na página de cada concelho, e é aí que o seu navegador pede a imagem a{' '}
          <code>commons.wikimedia.org</code>. A{' '}
          <a
            href="https://foundation.wikimedia.org/wiki/Policy:Privacy_policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            política de privacidade da Fundação Wikimedia
          </a>{' '}
          diz o que essa fundação faz com o que recebe.
        </p>
        <p>
          <strong>Os cartazes dos eventos</strong>, que vêm do sítio de quem organiza — as câmaras e
          as juntas de freguesia da região, cada evento do seu. Pela mesma razão: um cartaz é de
          quem o fez, e ligá-lo é mais honesto do que copiá-lo. Aparece onde o evento aparecer: na
          agenda, na página inicial, no mapa e na ficha.
        </p>
        {hasAnalytics ? (
          <p>
            <strong>A medição de utilização</strong>, em todas as páginas menos na caixa que uma
            câmara embebe no sítio dela. É a única desta lista que não é uma imagem e a única que
            existe para nos dizer alguma coisa a nós: em cada página aberta, o navegador vai buscar
            o programa da ferramenta a <code>{ANFITRIAO_DO_SCRIPT}</code> e envia-lhe o evento da
            página para <code>{ANFITRIAO_DA_MEDICAO}</code>. De dentro da caixa embebida não sai um
            único pedido para lá, porque o que ali se passa é trânsito do sítio da câmara e não
            deste. O que vai no evento está já a seguir.
          </p>
        ) : null}

        <h2 className="pt-2 font-semibold">Como é medida a utilização</h2>
        <p>
          Cada ficha de evento tem seis contadores: quantas vezes foi aberta e quantas vezes se
          carregou em «Bilhetes e reservas», em «Adicionar ao calendário», em «Partilhar», em
          «Página oficial» e em «como chegar». A tabela onde ficam não tem coluna nenhuma que
          identifique quem visitou: nem endereço IP, nem identificador de sessão ou de dispositivo,
          nem sequer a data e a hora de cada visita. Respondem a «esta ficha foi aberta 412 vezes» e
          nunca a «por quem». Estes totais são públicos, precisamente porque não há neles nada de
          ninguém.
        </p>
        {hasAnalytics ? (
          <p>
            Para além dos contadores, o sítio usa o PostHog para saber que páginas são usadas. Corre
            sem cookies e sem <i lang="en">localStorage</i> — o identificador que a ferramenta gera
            fica só em memória e desaparece quando o separador fecha —, sem gravação de sessão, sem
            captura automática de cliques, sem inquéritos e sem criação de perfis. Os dados ficam em
            servidores na União Europeia. O endereço IP chega ao PostHog com o pedido, como chega a
            qualquer servidor, e é lá descartado pela opção «descartar dados de IP do cliente». Essa
            opção é uma definição do projeto no painel do PostHog, ligada por quem instala esta
            agenda, e não uma linha deste código: é a única afirmação desta página que não se pode
            confirmar a partir do repositório.
          </p>
        ) : (
          <p>
            Não corre aqui nenhuma ferramenta de estatísticas de terceiros. O código prevê o PostHog
            em modo sem cookies, mas sem chave configurada não é carregado: não sai daqui um único
            pedido para lá.
          </p>
        )}
        <p>
          Como estas contagens não permitem identificar ninguém, também não há maneira de as separar
          por pessoa: não conseguimos dizer-lhe quais são as suas nem apagá-las isoladamente, porque
          não sabemos quais são (artigo 11.º do RGPD). Se preferir não ser contado, qualquer
          bloqueador de conteúdos trava estes pedidos, e o sítio continua a funcionar na mesma.
        </p>

        <h2 className="pt-2 font-semibold">Com que fundamento</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Submissões de eventos</strong> — diligências a pedido do titular dos dados,
            alínea b) do n.º 1 do artigo 6.º do RGPD. Quem envia um evento pede que o tratemos e
            publiquemos.
          </li>
          <li>
            <strong>Hash do IP e limitação de tráfego</strong> — interesse legítimo, alínea f) do
            n.º 1 do artigo 6.º: manter o serviço de pé. Pesámos o impacto na privacidade, e foi por
            isso que o endereço nunca é guardado em claro.
          </li>
          <li>
            <strong>Contadores e estatísticas</strong> — o mesmo interesse legítimo: saber que
            programação interessa, para o devolver a quem organiza. Contam-se acontecimentos, não
            pessoas.
          </li>
        </ul>
        <p>
          O conteúdo do evento é publicado — é para isso que é enviado. Os dados de contacto de quem
          o envia <strong>não são publicados</strong>: ficam na área de moderação.
        </p>

        <h2 className="pt-2 font-semibold">Como é tratado o que nos enviam</h2>
        <p>
          O que chega é processado automaticamente para dele se extraírem os campos do evento e é
          sempre revisto por uma pessoa antes de ser publicado. Nenhuma decisão com efeitos sobre
          quem submete é tomada sem intervenção humana. Quando a leitura automática está ligada, o
          que sai para o serviço que a faz é o assunto e o texto da mensagem — sem o endereço de
          quem a enviou, e com as mensagens citadas e a assinatura cortadas antes de sair; o
          fornecedor está nomeado abaixo, em «Quem tem acesso». Quando a extração falha, a mensagem
          original fica guardada tal como chegou para que alguém a possa tratar à mão.
        </p>

        <h2 className="pt-2 font-semibold">Durante quanto tempo</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Registos de limitação de tráfego</strong> (hashes de IP): apagados ao fim de
            dois dias.
          </li>
          <li>
            <strong>Submissões e emails recebidos</strong>, com os contactos de quem os enviou: até
            24 meses após a data do evento.
          </li>
          <li>
            <strong>Eventos publicados</strong>: ficam em arquivo, porque a memória da programação
            de uma região tem valor próprio. Não contêm dados de contacto.
          </li>
          <li>
            <strong>Contadores por evento</strong>: duram o que durar o evento no catálogo e são
            apagados com ele.
          </li>
        </ul>

        <h2 className="pt-2 font-semibold">Quem tem acesso</h2>
        <p>
          Apenas quem faz a moderação do Coreto, e apenas ao que precisa de ver para decidir se um
          evento é publicado. Não vendemos, não trocamos nem cedemos dados a terceiros para fins
          comerciais. Há fornecedores que atuam como subcontratantes e apenas segundo as nossas
          instruções: {SUBCONTRATANTES}. Se algum deles tratar dados fora do Espaço Económico
          Europeu, fá-lo ao abrigo das cláusulas contratuais-tipo aprovadas pela Comissão Europeia.
        </p>

        <h2 className="pt-2 font-semibold">Os seus direitos</h2>
        <p>
          Tem direito a pedir o acesso aos seus dados, a retificação do que estiver errado, o
          apagamento, a limitação do tratamento e a portabilidade, e a opor-se ao tratamento fundado
          em interesse legítimo. Basta escrever para{' '}
          {EMAIL ? (
            <a href={`mailto:${EMAIL}`} className="underline underline-offset-4">
              {EMAIL}
            </a>
          ) : (
            'o email da agenda'
          )}
          ; respondemos no prazo de um mês. Se entender que os seus dados não estão a ser tratados
          como deviam, pode reclamar junto da Comissão Nacional de Proteção de Dados (CNPD).
        </p>

        <h2 className="pt-2 font-semibold">Quando esta política mudou</h2>
        <p>
          Última alteração a{' '}
          <time dateTime={REVISAO_PRIVACIDADE}>{formatLongDate(REVISAO_PRIVACIDADE)}</time>: o mapa
          da agenda passou a pedir os pedaços de mapa a um serviço de fora, e isso passou a estar
          dito acima. Esta data muda quando mudar um tratamento — não quando mudar o resto da
          página.
        </p>
      </PorExtenso>

      <p className="mt-10 text-sm text-muted">
        A declaração de acessibilidade tem a sua própria página, em{' '}
        <Link href="/acessibilidade" className="underline underline-offset-4">
          /acessibilidade
        </Link>
        {haInformacoes ? (
          <>
            . O que é o Coreto, porque se chama assim e quem o faz está nas{' '}
            <Link href="/informacoes" className="underline underline-offset-4">
              informações
            </Link>
          </>
        ) : null}
        .
      </p>
    </article>
  );
}
