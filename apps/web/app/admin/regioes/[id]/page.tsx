import { todayInLisbon } from '@coreto/core/dates';
import { notFound } from 'next/navigation';
import { InterruptoresDeSeccoes } from '@/src/components/InterruptoresDeSeccoes';
import { PageHeader } from '@/src/components/PageHeader';
import {
  atualizarRegiao,
  criarSegredoDeBalanco,
  definirBarreira,
  registarLicenca,
  revogarSegredosDeBalanco,
} from '@/src/lib/admin/actions';
import { estadoDaLicenca } from '@/src/lib/admin/fields';
import {
  listRegionGates,
  listRegionLicenses,
  listRegionsAdmin,
  listSegredosDeBalanco,
  listSiteSections,
} from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';
import { REGIAO_PRINCIPAL } from '@/src/lib/regiao-host';

export const dynamic = 'force-dynamic';

const FIELD = 'mt-1 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const LABEL = 'block text-sm font-medium';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string; segredo?: string }>;
}

/** Um campo de texto do formulário, com o rótulo e a ajuda no sítio do costume. */
function Campo({
  nome,
  rotulo,
  valor,
  ajuda,
  obrigatorio,
  tipo,
}: {
  nome: string;
  rotulo: string;
  valor: string | number | null;
  ajuda?: string;
  obrigatorio?: boolean;
  tipo?: 'text' | 'url' | 'email' | 'number';
}) {
  return (
    <div>
      <label htmlFor={nome} className={LABEL}>
        {rotulo}
        {obrigatorio ? null : <span className="ml-1 font-normal text-muted">(opcional)</span>}
      </label>
      <input
        id={nome}
        name={nome}
        type={tipo ?? 'text'}
        defaultValue={valor ?? ''}
        required={obrigatorio}
        className={FIELD}
      />
      {ajuda ? <p className="mt-1 text-sm text-muted">{ajuda}</p> : null}
    </div>
  );
}

/** O mesmo, para os textos com parágrafos. */
function Area({
  nome,
  rotulo,
  valor,
  ajuda,
  linhas,
}: {
  nome: string;
  rotulo: string;
  valor: string | null;
  ajuda?: string;
  linhas?: number;
}) {
  return (
    <div>
      <label htmlFor={nome} className={LABEL}>
        {rotulo} <span className="font-normal text-muted">(opcional)</span>
      </label>
      <textarea
        id={nome}
        name={nome}
        rows={linhas ?? 4}
        defaultValue={valor ?? ''}
        className={FIELD}
      />
      {ajuda ? <p className="mt-1 text-sm text-muted">{ajuda}</p> : null}
    </div>
  );
}

/**
 * A ficha de uma região: o que se edita, edita-se aqui e fica na auditoria.
 *
 * O formulário fala com `update_region` (migração 0109), que tem a lista
 * fechada do que pode mudar. O que fica de fora — o identificador, o domínio,
 * o domínio dos UID, a contagem de concelhos e a caixa geográfica — mostra-se
 * num cartão só de leitura, com a razão ao lado: são encaminhamento e
 * promessas das schema-checks, e mudam por migração, seguindo o NOVA-CIM.md.
 */
export default async function FichaDaRegiao({ params, searchParams }: Props) {
  const [{ id }, { aviso, segredo }] = await Promise.all([params, searchParams]);

  if (!hasServiceRole) {
    return (
      <>
        <PageHeader title="Região" />
        <p className="text-muted">
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. Sem ela o backoffice não lê nada.
        </p>
      </>
    );
  }

  const [regioes, seccoes, todasAsLicencas, segredos, barreiras] = await Promise.all([
    listRegionsAdmin(),
    listSiteSections(id),
    listRegionLicenses(),
    listSegredosDeBalanco(),
    listRegionGates(),
  ]);
  const regiao = regioes.find((linha) => linha.id === id);
  if (!regiao) notFound();

  // Já vêm por ordem decrescente de início — a mais recente manda no estado.
  const licencas = todasAsLicencas.filter((linha) => linha.region_id === id);
  const licenca = estadoDaLicenca(licencas, todayInLisbon());
  // No máximo um por região: a 0151 revoga o anterior ao criar o seguinte.
  const segredoDaRegiao = segredos.find((linha) => linha.region_id === id);
  // Se há senha de barreira guardada — e desde quando. O hash nunca chega cá.
  const barreira = barreiras.find((linha) => linha.region_id === id);

  return (
    <>
      <PageHeader
        title={regiao.name}
        lead="Tudo o que este formulário grava passa pela função da base e deixa linha na auditoria, com o antes e o depois de cada campo."
      />

      {aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {aviso}
        </p>
      ) : null}

      <section aria-labelledby="fixos" className="mb-8">
        <h2 id="fixos" className="text-lg font-semibold">
          O que não se edita aqui
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          O identificador é a chave de tudo; o domínio é encaminhamento; o domínio dos UID é o
          espaço de nomes permanente dos calendários subscritos; a contagem de concelhos e a caixa
          geográfica são as promessas que as schema-checks verificam. Mudam por migração, com o guia{' '}
          <code>docs/NOVA-CIM.md</code> ao lado.
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted">Identificador</dt>
            <dd>
              <code>{regiao.id}</code>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Domínio</dt>
            <dd>{regiao.domain}</dd>
          </div>
          <div>
            <dt className="text-muted">Domínio dos UID iCal</dt>
            <dd>{regiao.ical_uid_domain}</dd>
          </div>
          <div>
            <dt className="text-muted">Concelhos esperados</dt>
            <dd>{regiao.expected_municipality_count}</dd>
          </div>
          <div>
            <dt className="text-muted">Caixa geográfica</dt>
            <dd>
              {regiao.bbox_lat_min}–{regiao.bbox_lat_max} N · {regiao.bbox_lon_min}–
              {regiao.bbox_lon_max} E
            </dd>
          </div>
        </dl>
      </section>

      <form action={atualizarRegiao} className="max-w-2xl space-y-8">
        <input type="hidden" name="id" value={regiao.id} />

        <fieldset>
          <legend className="text-lg font-semibold">Identidade</legend>
          <div className="mt-3 space-y-4">
            <Campo nome="name" rotulo="Nome da região" valor={regiao.name} obrigatorio />
            <Campo
              nome="article"
              rotulo="Artigo do nome"
              valor={regiao.article}
              obrigatorio
              ajuda={`«o» ou «a», para as frases saírem certas: ${regiao.article} ${regiao.name}.`}
            />
            <Campo
              nome="tagline"
              rotulo="Lema"
              valor={regiao.tagline}
              ajuda="A frase curta debaixo do nome, na página de entrada. Em branco, sai a frase neutra do produto."
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Prosa das informações</legend>
          <div className="mt-3 space-y-4">
            <Area
              nome="about_intro"
              rotulo="Apresentação"
              valor={regiao.about_intro}
              linhas={3}
              ajuda="O primeiro parágrafo das informações. Em branco, gera-se uma frase neutra com o nome da região e os concelhos."
            />
            <Area
              nome="about_story"
              rotulo="História"
              valor={regiao.about_story}
              linhas={6}
              ajuda="O resto da conversa: de onde vem o projeto nesta região. Em branco, o bloco não sai."
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Promotor e contacto</legend>
          <div className="mt-3 space-y-4">
            <Campo nome="cim_name" rotulo="Nome do promotor" valor={regiao.cim_name} obrigatorio />
            <Campo
              nome="cim_url"
              rotulo="Endereço do promotor"
              valor={regiao.cim_url}
              obrigatorio
              tipo="url"
            />
            <Campo
              nome="contact_email"
              rotulo="Email da região"
              valor={regiao.contact_email}
              obrigatorio
              tipo="email"
              ajuda="É para onde o rodapé aponta e por onde entram os eventos por email."
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Financiamento</legend>
          <p className="mt-1 text-sm text-muted">
            Sem declaração, o bloco de financiamento não aparece nas informações — é assim que uma
            região sem programa financiador simplesmente não fala dele.
          </p>
          <div className="mt-3 space-y-4">
            <Area
              nome="funding_statement"
              rotulo="Declaração"
              valor={regiao.funding_statement}
              linhas={2}
            />
            <Campo
              nome="funding_logo_path"
              rotulo="Caminho do logótipo"
              valor={regiao.funding_logo_path}
              ajuda="Um caminho dentro do sítio, por exemplo /logos/medio-tejo/centro2030.svg. O ficheiro versiona-se no repositório, em public/."
            />
            <Campo
              nome="funding_logo_alt"
              rotulo="Texto alternativo do logótipo"
              valor={regiao.funding_logo_alt}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                nome="funding_logo_width"
                rotulo="Largura (px)"
                valor={regiao.funding_logo_width}
                tipo="number"
              />
              <Campo
                nome="funding_logo_height"
                rotulo="Altura (px)"
                valor={regiao.funding_logo_height}
                tipo="number"
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Logótipos e imagem de partilha</legend>
          <p className="mt-1 text-sm text-muted">
            Caminhos dentro do sítio; os ficheiros versionam-se no repositório, em{' '}
            <code>public/logos/</code> e <code>public/og/</code>. Em branco, o cabeçalho escreve o
            nome por extenso e a partilha usa o cartaz neutro do produto.
          </p>
          <div className="mt-3 space-y-4">
            <Campo
              nome="logo_on_graphite_path"
              rotulo="Logótipo sobre grafite"
              valor={regiao.logo_on_graphite_path}
              ajuda="A variante para fundos escuros — o cabeçalho e o rodapé."
            />
            <Campo
              nome="logo_on_brand_path"
              rotulo="Logótipo sobre a cor da marca"
              valor={regiao.logo_on_brand_path}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                nome="logo_width"
                rotulo="Largura (px)"
                valor={regiao.logo_width}
                tipo="number"
              />
              <Campo
                nome="logo_height"
                rotulo="Altura (px)"
                valor={regiao.logo_height}
                tipo="number"
              />
            </div>
            <Campo
              nome="og_image_path"
              rotulo="Imagem de partilha"
              valor={regiao.og_image_path}
              ajuda="A imagem que sai quando alguém partilha o sítio, por exemplo /og/medio-tejo.png."
            />
            <Campo
              nome="og_image_alt"
              rotulo="Texto alternativo da imagem de partilha"
              valor={regiao.og_image_alt}
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Responsável pelo tratamento (RGPD)</legend>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Quem responde pelos dados pessoais nesta região. <strong>Com o nome em branco</strong>,
            a política de privacidade usa o nome e o endereço do promotor, e mais nada — é a omissão
            desde a 0101. Quem é o responsável é decisão contratual, CIM a CIM — ver{' '}
            <code>docs/RGPD.md</code>.
          </p>
          {/*
            A lista do que falta, no sítio onde se preenche.
            -----------------------------------------------------------------
            Vivia no `docs/RGPD.md` e no `docs/LICENCIAR.md`, que é onde tem de
            estar por extenso — e não no ecrã de quem a vai escrever. O aviso
            só aparece quando há responsável declarado: sem ele não há
            obrigação por cumprir, há uma decisão por tomar.
          */}
          {regiao.data_controller_name ? (
            <p className="mt-2 max-w-xl rounded border border-border bg-surface px-3 py-2 text-sm">
              O que a lei pede a uma região contratada: nome, NIF, morada e contacto. E, se quem
              responde for uma autoridade ou organismo público — uma CIM, uma câmara —, também o{' '}
              <strong>encarregado de proteção de dados</strong> e o contacto dele, que o artigo
              37.º, n.º 7, do RGPD manda publicar. O que ficar em branco não aparece na política:
              não se mostra o que não se sabe.
            </p>
          ) : null}
          <div className="mt-3 space-y-4">
            <Campo
              nome="data_controller_name"
              rotulo="Nome"
              valor={regiao.data_controller_name}
              ajuda="Em branco, vale o promotor. Preenchido, é este nome que a política publica — e o endereço abaixo deixa de herdar o do promotor."
            />
            <Campo
              nome="data_controller_url"
              rotulo="Endereço"
              valor={regiao.data_controller_url}
              tipo="url"
              ajuda="O sítio de quem responde. Uma pessoa singular não tem, e em branco o nome sai sem ligação — que é o certo."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                nome="data_controller_nif"
                rotulo="NIF ou NIPC"
                valor={regiao.data_controller_nif}
              />
              <Campo
                nome="data_controller_email"
                rotulo="Contacto para direitos"
                valor={regiao.data_controller_email}
                tipo="email"
                ajuda="Em branco, vale o email da região."
              />
            </div>
            <Area
              nome="data_controller_address"
              rotulo="Morada"
              valor={regiao.data_controller_address}
              linhas={3}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                nome="data_controller_dpo"
                rotulo="Encarregado de proteção de dados"
                valor={regiao.data_controller_dpo}
              />
              <Campo
                nome="data_controller_dpo_contact"
                rotulo="Contacto do encarregado"
                valor={regiao.data_controller_dpo_contact}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Estado e ordem</legend>
          <div className="mt-3 space-y-4">
            {/*
              A região principal do deployment não leva interruptor:
              desligada, o sítio inteiro caía no esqueleto neutro de recurso,
              em silêncio. A ação recusa na mesma um pedido forjado — isto é
              só a porta a dizer a verdade antes de alguém a empurrar.
            */}
            {regiao.id === REGIAO_PRINCIPAL ? (
              <p className="max-w-xl text-sm text-muted">
                Esta é a <strong>região principal</strong> do deployment: é dela a identidade que o
                sítio veste — canónicos, feeds, sitemap e painel — e por isso não se desliga daqui.
                Para a tirar do ar, o deployment tem primeiro de passar o papel a outra região.
              </p>
            ) : (
              <>
                {/*
                  A caixa desmarcada não viaja no POST — é o feitio dos
                  checkboxes — e o campo escondido diz à ação que o formulário
                  a trazia.
                */}
                <input type="hidden" name="is_enabled_presente" value="1" />
                <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="is_enabled"
                    defaultChecked={regiao.is_enabled}
                    className="h-5 w-5 rounded border-field"
                  />
                  Região ligada
                </label>
                <p className="text-sm text-muted">
                  Desligada, a região sai do mapa público: o domínio dela deixa de ser de alguém e
                  passa a mostrar a página do produto, e as páginas dela deixam de existir. É o
                  interruptor de arranque — liga-se quando os dados estiverem prontos para gente.
                </p>
              </>
            )}
            <div className="max-w-40">
              <Campo
                nome="sort_order"
                rotulo="Ordem"
                valor={regiao.sort_order}
                obrigatorio
                tipo="number"
                ajuda="Ordena as listas onde as regiões aparecem juntas."
              />
            </div>
          </div>
        </fieldset>

        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm font-medium hover:bg-surface"
        >
          Guardar alterações
        </button>
      </form>

      {/*
        A barreira temporária (0157).
        ---------------------------------------------------------------------
        O terceiro estado de uma região: de pé, a servir, e só para quem tem a
        senha. Vive fora do formulário da ficha porque formulários não se
        aninham, e porque não é um campo da região como os outros — o que aqui
        se escreve nunca chega à base: o que segue é o sha256.

        **O cartão diz o que a barreira não cobre, e é de propósito.** Quem a
        pediu escolheu tapar só as páginas, por ser o mais simples para uma
        coisa temporária; com os feeds abertos, a agenda continua legível por
        quem souber o endereço do `feed.xml`. É uma escolha informada — e uma
        escolha informada só é informada se estiver escrita onde se faz.
      */}
      <section aria-labelledby="barreira" className="mt-10 max-w-2xl">
        <h2 id="barreira" className="text-lg font-semibold">
          Barreira temporária
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Uma senha partilhada, para uma região pronta e ainda não contratada: o sítio fica de pé e
          só entra quem a souber. Não é uma conta — não há registo, não há nomes, e nada se guarda
          sobre quem entra. Cada entrada vale um dia.
        </p>

        <p className={`mt-3 text-sm ${regiao.gate_enabled ? 'text-highlight' : ''}`}>
          <strong>{regiao.gate_enabled ? 'Ligada.' : 'Desligada.'}</strong>{' '}
          <span className="text-muted">
            {barreira
              ? `Senha definida a ${barreira.updated_at.slice(0, 10).split('-').reverse().join('/')}${
                  barreira.updated_by ? `, por ${barreira.updated_by}` : ''
                }.`
              : 'Não há senha definida — e sem senha a barreira não se liga.'}
          </span>
        </p>

        <div className="mt-3 max-w-xl rounded border border-border bg-surface px-3 py-2 text-sm">
          <p className="font-medium">A barreira cobre as páginas, e só as páginas.</p>
          <p className="mt-1 text-muted">
            Continuam a responder a quem souber o endereço: <code>/feed.xml</code>,{' '}
            <code>/agenda.ics</code>, <code>/dados.json</code>, <code>/dados.csv</code>,{' '}
            <code>/estado.json</code>, <code>/api/events</code>, o widget e os ficheiros de máquina
            (<code>robots.txt</code>, <code>sitemap.xml</code>, <code>security.txt</code>). Foi a
            escolha pedida — a mais simples, para uma coisa temporária. Quem quiser a região mesmo
            fechada desliga-a no formulário acima, e aí não responde nada.
          </p>
        </div>

        <form action={definirBarreira} className="mt-4 space-y-4">
          <input type="hidden" name="region_id" value={regiao.id} />

          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              name="ligada"
              defaultChecked={regiao.gate_enabled}
              className="h-5 w-5 rounded border-field"
            />
            Barreira ligada
          </label>

          <div>
            <label htmlFor="senha" className={LABEL}>
              Senha nova{' '}
              <span className="font-normal text-muted">(em branco: fica a que já lá está)</span>
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              className={FIELD}
            />
            <p className="mt-1 text-sm text-muted">
              Oito caracteres à mínima. Escreva-a onde a possa voltar a ler antes de gravar: a base
              guarda só uma impressão dela, e nem esta página a consegue reconstruir. Trocar a senha
              não expulsa quem já entrou — quem tem um dia por gastar continua lá dentro até ele
              acabar.
            </p>
          </div>

          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm font-medium hover:bg-surface"
          >
            Guardar barreira
          </button>
        </form>

        <p className="mt-2 max-w-xl text-xs text-muted">
          Desligar não apaga a senha: a região volta a fechar-se com a mesma no dia seguinte, sem a
          ter de combinar outra vez com quem já a tem. Ligar, desligar e trocar ficam na auditoria,
          sem a senha e sem a impressão dela. Uma mudança pode demorar até cinco minutos a valer em
          todos os servidores — é o tempo que o mapa das regiões vale em cada um.
        </p>
      </section>

      {/*
        A porta de quem decide.
        ---------------------------------------------------------------------
        Um segredo por região que abre `/balanco` em leitura, sem sessão de
        administração e sem acesso a mais nada. **É a segunda porta da casa**,
        e a regra escrita diz «uma palavra-passe, sem contas»: a regra foi
        escrita para a moderação, onde há um operador só, e quem entra por
        aqui não modera, não escreve, e o que vê já é do território dele. O
        argumento está por extenso na 0151.

        O segredo aparece **uma vez**, logo a seguir a ser criado, e mais
        nunca: a base guarda o sha256 e o painel não tem por onde o
        reconstruir. Recarregar esta página perde-o.
      */}
      <section aria-labelledby="balanco" className="mt-10 max-w-2xl">
        <h2 id="balanco" className="text-lg font-semibold">
          A porta de quem decide
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Um endereço de leitura desta região — seis números sobre o mês, com o que cada um mede e o
          que não mede escrito ao lado. Abre sem sessão de administração e não dá acesso a mais
          nada: nem à fila, nem à auditoria, nem às licenças.
        </p>

        {segredo ? (
          <div
            role="status"
            className="mt-4 rounded border border-highlight bg-surface px-3 py-3 text-sm"
          >
            <p className="font-medium">O endereço, uma vez.</p>
            <p className="mt-1 text-muted">
              Copie-o agora. Não volta a aparecer: a base guarda só uma impressão dele, e nem esta
              página o consegue reconstruir. Se o perder, crie outro — o novo fecha este.
            </p>
            <p className="mt-2 break-all font-mono text-xs">
              /balanco?chave={segredo}&amp;regiao={regiao.id}
            </p>
          </div>
        ) : null}

        {segredoDaRegiao ? (
          <p className="mt-3 text-sm">
            Há uma porta aberta desde{' '}
            <span className="tabular-nums">{segredoDaRegiao.created_at.slice(0, 10)}</span>, criada
            por {segredoDaRegiao.created_by}, com prazo até{' '}
            <span className="tabular-nums">{segredoDaRegiao.expires_on}</span>.{' '}
            {segredoDaRegiao.last_used_on
              ? `Usada pela última vez a ${segredoDaRegiao.last_used_on}.`
              : 'Ainda não foi usada.'}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">Não há porta aberta para esta região.</p>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <form action={criarSegredoDeBalanco} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="region_id" value={regiao.id} />
            <div>
              <label htmlFor="dias-do-balanco" className={LABEL}>
                Prazo, em dias
              </label>
              <input
                id="dias-do-balanco"
                name="dias"
                type="number"
                min={1}
                max={1095}
                defaultValue={180}
                className={`${FIELD} w-32`}
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium"
            >
              {segredoDaRegiao ? 'Criar uma nova (fecha a atual)' : 'Criar'}
            </button>
          </form>

          {segredoDaRegiao ? (
            <form action={revogarSegredosDeBalanco}>
              <input type="hidden" name="region_id" value={regiao.id} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium"
              >
                Fechar a porta
              </button>
            </form>
          ) : null}
        </div>
        <p className="mt-2 max-w-xl text-xs text-muted">
          Criar uma nova fecha a anterior no pedido seguinte — não no fim do prazo. A criação e o
          fecho ficam na auditoria, com o identificador e nunca com o segredo.
        </p>
      </section>

      {/*
        As licenças vivem fora do formulário da ficha: formulários não se
        aninham, e um contrato não é um campo da região — é história que se
        acrescenta, nunca se reescreve.
      */}
      <section aria-labelledby="licencas" className="mt-10 max-w-2xl">
        <h2 id="licencas" className="text-lg font-semibold">
          Licenças
        </h2>
        <p className={`mt-1 text-sm ${licenca.alerta ? 'text-highlight' : 'text-muted'}`}>
          {licenca.texto}
        </p>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Uma linha por contrato ou renovação — corrigir é acrescentar outra, com nota. Expirar
          avisa no painel e não desliga nada: o corte é o interruptor da região, um gesto humano.
        </p>

        {licencas.length > 0 ? (
          <ul className="mt-3 border-y border-border">
            {licencas.map((linha) => (
              <li key={linha.id} className="border-b border-border py-2 text-sm last:border-b-0">
                <span className="font-medium">{linha.kind}</span>{' '}
                <span className="text-muted">
                  · {linha.starts_on.split('-').reverse().join('/')} —{' '}
                  {linha.ends_on ? linha.ends_on.split('-').reverse().join('/') : 'sem prazo'} ·
                  registada por {linha.created_by}
                </span>
                {linha.notes ? <p className="mt-0.5 text-sm text-muted">{linha.notes}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}

        <form action={registarLicenca} className="mt-4 space-y-4">
          <input type="hidden" name="regiao" value={regiao.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="starts_on" className={LABEL}>
                Início
              </label>
              <input id="starts_on" name="starts_on" type="date" required className={FIELD} />
            </div>
            <div>
              <label htmlFor="ends_on" className={LABEL}>
                Fim <span className="font-normal text-muted">(em branco: sem prazo)</span>
              </label>
              <input id="ends_on" name="ends_on" type="date" className={FIELD} />
            </div>
          </div>
          <div>
            <label htmlFor="kind" className={LABEL}>
              Tipo
            </label>
            <input id="kind" name="kind" required className={FIELD} />
            <p className="mt-1 text-sm text-muted">«contrato», «piloto», «demo», «cortesia»…</p>
          </div>
          <div>
            <label htmlFor="notes" className={LABEL}>
              Notas <span className="font-normal text-muted">(opcional)</span>
            </label>
            <textarea id="notes" name="notes" rows={2} className={FIELD} />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm font-medium hover:bg-surface"
          >
            Registar licença
          </button>
        </form>
      </section>

      <section aria-labelledby="seccoes" className="mt-10">
        <h2 id="seccoes" className="text-lg font-semibold">
          Secções do sítio
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Desligada, a secção sai da navegação e do mapa do sítio desta região, e o endereço passa a
          responder 404. Não se perde nada: o que se desliga é a porta, e voltar a ligar repõe a
          página como estava.
        </p>
        <InterruptoresDeSeccoes regiao={regiao.id} seccoes={seccoes} />
      </section>
    </>
  );
}
