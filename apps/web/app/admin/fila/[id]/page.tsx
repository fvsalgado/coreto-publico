import { emLisboa, todayInLisbon } from '@coreto/core/dates';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CamposDoEvento } from '@/src/components/CamposDoEvento';
import { PageHeader } from '@/src/components/PageHeader';
import { PublicadoAgora } from '@/src/components/PublicadoAgora';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { approveSubmission, fundirSubmissao, rejectSubmission } from '@/src/lib/admin/actions';
import { ambitoDoPainel } from '@/src/lib/admin/ambito';
import {
  datasNovas,
  diaEHora,
  fraseDoMotivo,
  motivoForte,
  resumoDoCandidato,
} from '@/src/lib/admin/duplicados';
import { ligacoesPublicas } from '@/src/lib/admin/ligacoes';
import {
  pareceInformacaoMunicipal,
  REGRA_DO_QUE_E_PROGRAMACAO,
  textoQueARecolhaArrumou,
} from '@/src/lib/admin/moderacao';
import { pode } from '@/src/lib/admin/papeis';
import { enderecoDeEmail, mensagemAPedir, oQueFalta } from '@/src/lib/admin/pedir';
import {
  CANAL,
  confiancaEmPalavras,
  ESTADO_DA_PROPOSTA,
  LEITURA_AUTOMATICA,
  rotulo,
} from '@/src/lib/admin/rotulos';
import {
  candidatosADuplicado,
  getSubmission,
  lerEventoResumido,
  listAttachments,
  nomeDaFonte,
  sessoesDoEvento,
  signedAttachmentUrl,
} from '@/src/lib/admin/queries';
import {
  camposRecebidos,
  formaDoPayload,
  propostoEmCartaz,
  proposedFromPayload,
  proposedSessions,
} from '@/src/lib/admin/fields';
import {
  listCategories,
  listMunicipalitiesDeTodas,
  listSeriesDeTodas,
  listVenuesDeTodas,
} from '@/src/lib/queries/events';
import { hasServiceRole } from '@/src/lib/env';
import { formatLongDate } from '@/src/lib/format';
import { doNomeDaRegiao } from '@/src/lib/regiao';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Proposta' };

interface Props {
  params: Promise<{ id: string }>;
  /**
   * `decidir` e `evento` são o segundo passo dos botões de «Pode já cá estar»
   * (a confirmação); `distinto` são os parecidos que quem modera pôs de lado
   * como outro evento; `aviso` é a resposta de uma ação recusada.
   */
  searchParams: Promise<{
    aviso?: string;
    decidir?: string;
    evento?: string;
    distinto?: string;
    /** O evento que a aprovação da proposta anterior publicou (C4-013). */
    publicado?: string;
  }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Quantas datas novas a confirmação de «Fundir com este» enumera antes de resumir. */
const DATAS_A_ENUMERAR = 12;

const FIELD =
  'mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const LABEL = 'block text-sm font-medium';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export default async function RevisaoSubmissao({ params, searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Proposta" />;

  const { id } = await params;
  const query = await searchParams;
  const ambito = await ambitoDoPainel();
  const submission = await getSubmission(id);
  if (!submission) notFound();

  /*
   * Uma submissão de uma região que não é desta sessão responde como uma que
   * não existe (C4-015). Não «sem acesso»: isso dizia a quem experimenta
   * identificadores que acertou numa. A leitura já ficou registada pelo
   * `getSubmission`, que regista antes de ler — uma tentativa destas é
   * exatamente o que esse registo existe para mostrar.
   */
  const regiaoDaProposta =
    submission.region_id ??
    (submission.municipality_id ? ambito.regiaoDoConcelho.get(submission.municipality_id) : null) ??
    null;
  if (!pode(ambito.sessao, regiaoDaProposta, 'editor')) notFound();
  const regioesDaSessao = new Set(ambito.disponiveis.map((regiao) => regiao.id));

  const payload = (submission.payload ?? {}) as Record<string, unknown>;

  // O que a fonte propôs, venha ela da extração de email ou da recolha — são
  // duas formas de payload na mesma coluna, e ler só uma delas era o que
  // servia o formulário em branco a quem vinha resolver um candidato da noite.
  const proposed = proposedFromPayload(payload, {
    municipality_id: submission.municipality_id,
    venue_id: submission.venue_id,
  });
  const proposedDates = proposedSessions(payload);

  const municipalityId = proposed.municipality_id;
  const title = proposed.title;

  /** A submissão veio da recolha, e não de uma pessoa a escrever. */
  const daRecolha = submission.channel === 'scraper';
  /** O texto da fonte, quando a recolha o arrumou antes de o propor (C2-022). */
  const arrumado = daRecolha ? textoQueARecolhaArrumou(payload) : null;
  /** Chegou por programa, já em campos: não há texto nem extração. */
  const porPrograma = formaDoPayload(payload) === 'programa';
  const raw = (payload.raw ?? {}) as Record<string, unknown>;

  /*
   * Os parecidos procuram-se no concelho da proposta — e só se ele é de uma
   * região desta sessão: um concelho de outra região, vindo do que a fonte
   * propôs, punha aqui títulos da agenda da vizinha.
   *
   * Pelo espaço, pelo dia e pela hora da primeira data, e não só pelo título
   * (0172): o duplicado que mais acontece é o mesmo espetáculo com outro nome
   * (C4-014).
   */
  const concelhoDaSessao = Boolean(
    municipalityId && regioesDaSessao.has(ambito.regiaoDoConcelho.get(municipalityId) ?? ''),
  );
  const [
    attachments,
    todosOsConcelhos,
    categories,
    todosOsEspacos,
    todosOsCiclos,
    parecidos,
    fonte,
  ] = await Promise.all([
    listAttachments(id),
    listMunicipalitiesDeTodas(),
    listCategories(),
    listVenuesDeTodas(),
    listSeriesDeTodas(),
    title && municipalityId && concelhoDaSessao
      ? candidatosADuplicado({
          title,
          date: proposedDates[0]?.date || null,
          municipalityId,
          venueId: proposed.venue_id || null,
          startTime: proposedDates[0]?.start || null,
        })
      : Promise.resolve([]),
    nomeDaFonte(submission.source_id),
  ]);

  // «Não é — é outro evento» tira o parecido da lista desta página. Não fica
  // guardado em lado nenhum, e não precisa: o que fica é a decisão que se
  // tomar a seguir — publicar, recusar ou fundir.
  const distintos = new Set((query.distinto ?? '').split(',').filter((valor) => UUID.test(valor)));
  const candidatos = parecidos.filter((candidato) => !distintos.has(candidato.event_id));
  const decidir =
    query.decidir === 'duplicada' || query.decidir === 'fundir' ? query.decidir : null;
  // A confirmação só para um evento que está na lista: um identificador
  // trazido na barra não escolhe nada que a página não tenha mostrado.
  const escolhido =
    decidir && query.evento
      ? (candidatos.find((candidato) => candidato.event_id === query.evento) ?? null)
      : null;
  const novas =
    escolhido && decidir === 'fundir'
      ? datasNovas(proposedDates, await sessoesDoEvento(escolhido.event_id))
      : [];
  const ligacoes = ligacoesPublicas(
    ambito.disponiveis,
    ambito.regiaoDoConcelho,
    (await headers()).get('host'),
  );
  /** Esta ficha, com os parecidos postos de lado e o que mais se pedir. */
  const estaFicha = (extra: Record<string, string> = {}, ancora = ''): string => {
    const parametros = new URLSearchParams();
    if (distintos.size > 0) parametros.set('distinto', [...distintos].join(','));
    for (const [chave, valor] of Object.entries(extra)) parametros.set(chave, valor);
    const texto = parametros.toString();
    return `/admin/fila/${encodeURIComponent(submission.id)}${texto ? `?${texto}` : ''}${ancora}`;
  };

  // As escolhas do formulário são só das regiões onde esta sessão modera: um
  // concelho, um espaço ou um ciclo de outra região punham o evento na agenda
  // da vizinha. A ação volta a verificá-lo do lado dela.
  const municipalities = todosOsConcelhos.filter((concelho) =>
    regioesDaSessao.has(concelho.region_id),
  );
  const concelhosDaSessao = new Set(municipalities.map((concelho) => concelho.id));
  const venues = todosOsEspacos.filter((espaco) => concelhosDaSessao.has(espaco.municipality_id));
  const ciclos = todosOsCiclos.filter((ciclo) => regioesDaSessao.has(ciclo.region_id));
  const nomeDaRegiao = new Map(ambito.disponiveis.map((regiao) => [regiao.id, regiao.name]));

  const attachmentLinks = await Promise.all(
    attachments.map(async (attachment) => ({
      ...attachment,
      url: await signedAttachmentUrl(attachment.storage_path),
    })),
  );

  const isResolved = submission.status !== 'pending' && submission.status !== 'needs_info';
  // Numa proposta resolvida, o evento em que ela deu: o publicado, ou aquele
  // de que era duplicada. A ligação «evento criado» levava de volta à fila.
  const eventoDaDecisao = isResolved
    ? await lerEventoResumido(
        submission.resulting_event_id ?? submission.duplicate_of_event_id ?? '',
      )
    : null;
  const fichaDaDecisao =
    eventoDaDecisao?.status === 'published'
      ? ligacoes.doConcelho(eventoDaDecisao.municipality_id, `/evento/${eventoDaDecisao.slug}`)
      : null;

  /*
   * Pedir o que falta (C4-030): o que a ficha pública não vai saber dizer, e a
   * mensagem a quem enviou, já escrita — no nome da agenda que essa pessoa
   * conhece, e assinada por quem modera.
   */
  const falta = oQueFalta(proposed, proposedDates, propostoEmCartaz(payload));
  const regiaoDaFicha = ambito.disponiveis.find((regiao) => regiao.id === regiaoDaProposta);
  const agenda = regiaoDaFicha
    ? `a agenda ${doNomeDaRegiao(regiaoDaFicha.article, regiaoDaFicha.name)}`
    : 'a agenda';
  const mensagem = mensagemAPedir({
    titulo: title,
    falta,
    agenda,
    assinatura: ambito.sessao.tipo === 'pessoa' ? ambito.sessao.pessoa.nome : `A equipa d${agenda}`,
  });
  const escreverA = submission.sender_email
    ? enderecoDeEmail(submission.sender_email, mensagem.assunto, mensagem.corpo)
    : null;
  const chegou = formatLongDate(emLisboa(Date.parse(submission.created_at)).date);
  const confianca = confiancaEmPalavras(submission.channel, submission.confidence);

  return (
    <>
      <PageHeader title={title || submission.raw_subject || 'Proposta sem título'}>
        {/* Na língua de quem modera (C4-011): dizia «form · pending ·
            confiança 0.6», e o 0,6 era o mesmo para todas as propostas do
            envio por programa — não distinguia nada. */}
        <p className="mt-1 text-sm text-muted">
          {rotulo(CANAL, submission.channel)} · {rotulo(ESTADO_DA_PROPOSTA, submission.status)}
          {submission.sender_email && escreverA ? (
            <>
              {' · de '}
              <a href={escreverA} className="underline underline-offset-4">
                {submission.sender_email}
              </a>
            </>
          ) : null}
          {` · chegou a ${chegou}`}
          {confianca ? ` · ${confianca}` : ''}
        </p>
      </PageHeader>

      <PublicadoAgora
        eventoId={query.publicado}
        ambito={ambito}
        ligacoes={ligacoes}
        voltar={`/admin/fila/${encodeURIComponent(submission.id)}`}
      />

      {query.aviso ? (
        <p role="alert" className="mb-6 rounded border border-highlight px-3 py-2 text-sm">
          {query.aviso}
        </p>
      ) : null}

      {/* Porque é que isto está na fila. Estava guardado em `review_notes`
          desde o início e nunca aparecia — quem abria a página via o estado e
          a confiança, e tinha de adivinhar o que faltava. */}
      {!isResolved && submission.review_notes ? (
        <p className="mb-6 rounded border border-highlight px-3 py-2 text-sm text-highlight">
          <strong>
            {submission.status === 'needs_info' ? 'À espera de resposta:' : 'Está na fila porque:'}
          </strong>{' '}
          {submission.review_notes}
        </p>
      ) : null}

      {/* A regra do que é programação (C2-022), onde a decisão se toma. */}
      {!isResolved && pareceInformacaoMunicipal(title) ? (
        <p className="mb-6 rounded border border-highlight px-3 py-2 text-sm">
          <strong>A regra da agenda:</strong> {REGRA_DO_QUE_E_PROGRAMACAO} Se não é, recusa com «Não
          serve para a agenda».
        </p>
      ) : null}

      {isResolved ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          Esta proposta já foi decidida:{' '}
          <strong>{rotulo(ESTADO_DA_PROPOSTA, submission.status)}</strong>
          {eventoDaDecisao ? (
            <>
              {submission.status === 'approved' ? ' — ' : ', de '}
              {fichaDaDecisao ? (
                <a
                  href={fichaDaDecisao}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  «{eventoDaDecisao.title}»
                  <span className="sr-only"> (abre a ficha pública noutro separador)</span>
                </a>
              ) : (
                <>«{eventoDaDecisao.title}»</>
              )}
            </>
          ) : null}
          .
        </p>
      ) : (
        // O botão de aprovar também no cimo (C4-013): a ficha tem dois ecrãs
        // de formulário, e numa proposta boa não há nada para mudar. No
        // telemóvel é a barra fixa do fundo que o faz.
        <div className="mb-6 hidden flex-wrap gap-2 sm:flex">
          <button
            type="submit"
            form="aprovar"
            className="inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent"
          >
            Aprovar e publicar
          </button>
          <button
            type="submit"
            form="aprovar"
            name="seguinte"
            value="1"
            className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium"
          >
            Aprovar e abrir a seguinte
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* O material em bruto fica sempre visível ao lado do que se edita:
            é a única maneira de confirmar que a extração não inventou nada. */}
        <section aria-labelledby="bruto">
          <h2 id="bruto" className="text-lg font-semibold">
            O que chegou
          </h2>

          {submission.raw_subject ? (
            <p className="mt-2 text-sm">
              <span className="text-muted">Assunto:</span> {submission.raw_subject}
            </p>
          ) : null}

          {/* A extração é o passo que lê prosa de um email e propõe campos.
              Quem vem da recolha nunca passa por lá — o adaptador já leu a
              página estruturada — e dizer-lhe «skipped, preenche à mão» era
              mandar reescrever à mão o que já estava lido. */}
          {/* E quem chega por programa também não: os campos vêm escritos por
              quem envia, e «preenche à mão» mandava reescrever o que já cá
              está — ao lado de um formulário que, até 1 de outubro de 2026,
              os deixava cair. */}
          {!daRecolha && !porPrograma && submission.extraction_status !== 'ok' ? (
            <p className="mt-2 rounded border border-highlight px-3 py-2 text-sm text-highlight">
              Leitura automática: {rotulo(LEITURA_AUTOMATICA, submission.extraction_status)}
              {submission.extraction_error ? ` — ${submission.extraction_error}` : ''}
              {submission.extraction_status === 'skipped'
                ? '. O texto está aqui em baixo: preenche à mão.'
                : ''}
              {/* `unverified` não é uma falha: a proposta está toda no
                  formulário. O que falta é alguém confrontar os campos que a
                  frase nomeia com o texto, que está logo por baixo. */}
              {submission.extraction_status === 'unverified'
                ? '. A proposta está preenchida; confirma esses campos contra o texto aqui em baixo.'
                : ''}
            </p>
          ) : null}

          {/* A recolha primeiro: numa proposta dela, o `raw_text` é só o
              endereço da página lida (`saveSubmission`), e mostrava-se um
              endereço num bloco de texto em vez do que o adaptador leu. */}
          {daRecolha ? (
            // Não há prosa nenhuma para mostrar, e não é falta: é o que o
            // adaptador leu, ao lado do formulário já preenchido com isso, e
            // com a ligação à página de origem para se confirmar sem sair
            // daqui. É o mesmo fim que o texto em bruto serve num email.
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted">Fonte</dt>
                <dd>
                  {fonte ?? submission.source_id ?? 'sem fonte'}
                  {str(raw.sourceUrl) ? (
                    <>
                      {' · '}
                      <a
                        href={str(raw.sourceUrl)}
                        rel="noopener noreferrer"
                        target="_blank"
                        aria-label="Página do evento na fonte (abre noutro separador)"
                        className="underline underline-offset-4"
                      >
                        página do evento
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
              {str(raw.title) ? (
                <div>
                  <dt className="text-muted">Título lido</dt>
                  <dd>{str(raw.title)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted">Sítio lido</dt>
                <dd>{str(raw.venueName) || <span className="text-muted">nenhum</span>}</dd>
              </div>
              {proposedDates.length > 0 ? (
                <div>
                  <dt className="text-muted">Datas lidas</dt>
                  <dd>
                    {proposedDates
                      .filter((sessao) => sessao.date)
                      .map((sessao) => diaEHora(sessao.date, sessao.start))
                      .join(' · ')}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : submission.raw_text ? (
            <pre
              tabIndex={0}
              className="mt-3 max-h-96 overflow-auto rounded border border-border bg-surface p-3 text-sm whitespace-pre-wrap"
            >
              {submission.raw_text}
            </pre>
          ) : porPrograma ? (
            // Sem prosa, e não é falta: chegou já em campos. A lista é o que a
            // pessoa enviou, e é contra ela que se confere o formulário ao
            // lado — era a única maneira de ver o que a aprovação perdia.
            <>
              <p className="mt-2 text-sm text-muted">
                Enviado por programa, já em campos — sem texto para ler.
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                {camposRecebidos(payload, {
                  municipios: Object.fromEntries(municipalities.map((m) => [m.id, m.name])),
                  categorias: Object.fromEntries(categories.map((c) => [c.slug, c.name])),
                  espacos: Object.fromEntries(venues.map((v) => [v.id, v.name])),
                }).map((campo) => (
                  <div key={campo.rotulo}>
                    <dt className="text-muted">{campo.rotulo}</dt>
                    <dd className="break-words">{campo.valor}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Sem texto.</p>
          )}

          {attachmentLinks.length > 0 ? (
            <>
              <h3 className="mt-4 font-medium">Anexos</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {attachmentLinks.map((attachment) => (
                  <li key={attachment.id}>
                    {attachment.url ? (
                      <a
                        href={attachment.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        aria-label={`${attachment.filename ?? attachment.storage_path} (abre noutro separador)`}
                        className="underline underline-offset-4"
                      >
                        {attachment.filename ?? attachment.storage_path}
                      </a>
                    ) : (
                      (attachment.filename ?? attachment.storage_path)
                    )}{' '}
                    <span className="text-muted">
                      ({attachment.mime_type}, {Math.round(attachment.size_bytes / 1024)} kB)
                    </span>
                    {attachment.ocr_text ? (
                      <details className="mt-1">
                        <summary className="min-h-11 cursor-pointer py-2.5 text-muted">
                          Texto extraído
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap text-xs">
                          {attachment.ocr_text}
                        </pre>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {candidatos.length > 0 && candidatos[0] ? (
            <section
              aria-labelledby="duplicados"
              className="mt-6 rounded border-2 border-highlight p-4"
            >
              <h3 id="duplicados" className="font-semibold text-highlight">
                Pode já cá estar
                {motivoForte(candidatos[0]) ? ` — ${fraseDoMotivo(candidatos[0])}` : ''}
              </h3>
              <p className="mt-1 text-sm text-muted">
                Nada se junta sozinho: vê cada um e decide aqui.
              </p>
              <ul className="mt-3 space-y-5">
                {candidatos.map((candidato) => {
                  const fichaPublica =
                    candidato.slug && candidato.status === 'published'
                      ? ligacoes.doConcelho(municipalityId, `/evento/${candidato.slug}`)
                      : null;
                  const aDecidir = escolhido?.event_id === candidato.event_id ? decidir : null;
                  return (
                    <li key={candidato.event_id}>
                      <p className="font-medium">
                        {fichaPublica ? (
                          <a
                            href={fichaPublica}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${candidato.title} (abre a ficha pública noutro separador)`}
                            className="underline underline-offset-4"
                          >
                            {candidato.title}
                          </a>
                        ) : (
                          candidato.title
                        )}
                      </p>
                      <p className="text-sm text-muted">
                        {resumoDoCandidato(candidato)} · {fraseDoMotivo(candidato)}
                      </p>

                      {!isResolved && !aDecidir ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link
                            href={estaFicha(
                              { decidir: 'duplicada', evento: candidato.event_id },
                              '#decidir',
                            )}
                            className="inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent"
                          >
                            É este — recusar como duplicada
                          </Link>
                          <Link
                            href={estaFicha(
                              { decidir: 'fundir', evento: candidato.event_id },
                              '#decidir',
                            )}
                            className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium"
                          >
                            Fundir com este
                          </Link>
                          <Link
                            href={estaFicha(
                              { distinto: [...distintos, candidato.event_id].join(',') },
                              '#duplicados',
                            )}
                            className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium"
                          >
                            Não é — é outro evento
                          </Link>
                        </div>
                      ) : null}

                      {/* O segundo passo: o que vai acontecer, dito antes de
                          acontecer, e o botão que o faz. O identificador vai
                          num campo escondido — escolhido da lista, nunca
                          escrito por uma pessoa (C4-029). */}
                      {aDecidir && !isResolved ? (
                        <div
                          id="decidir"
                          role="group"
                          aria-labelledby="decidir-titulo"
                          className="mt-3 rounded border border-border bg-surface p-3"
                        >
                          <p id="decidir-titulo" className="font-medium">
                            {aDecidir === 'fundir'
                              ? `Fundir esta proposta com «${candidato.title}»?`
                              : `Recusar esta proposta como duplicada de «${candidato.title}»?`}
                          </p>
                          {aDecidir === 'duplicada' ? (
                            <p className="mt-1 text-sm">
                              Nada é publicado, e o evento fica como está. A proposta sai da fila
                              marcada como duplicada.
                            </p>
                          ) : novas.length > 0 ? (
                            <>
                              <p className="mt-1 text-sm">
                                {novas.length === 1
                                  ? 'Junta-se ao evento uma data que ele ainda não tem:'
                                  : `Juntam-se ao evento ${novas.length} datas que ele ainda não tem:`}
                              </p>
                              <ul className="mt-1 list-disc pl-5 text-sm">
                                {novas.slice(0, DATAS_A_ENUMERAR).map((data) => (
                                  <li key={`${data.date}|${data.start}`}>
                                    {diaEHora(data.date, data.start)}
                                  </li>
                                ))}
                              </ul>
                              {novas.length > DATAS_A_ENUMERAR ? (
                                <p className="text-sm">e mais {novas.length - DATAS_A_ENUMERAR}.</p>
                              ) : null}
                              <p className="mt-1 text-sm text-muted">
                                Nada do evento é apagado, e a proposta sai da fila marcada como
                                duplicada.
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-sm">
                              O evento já tem todas as datas desta proposta: fundir é o mesmo que
                              recusar como duplicada, e nada do evento muda.
                            </p>
                          )}
                          <form
                            action={aDecidir === 'fundir' ? fundirSubmissao : rejectSubmission}
                            className="mt-3 flex flex-wrap gap-2"
                          >
                            <input type="hidden" name="submission_id" value={submission.id} />
                            {aDecidir === 'fundir' ? (
                              <input type="hidden" name="evento" value={candidato.event_id} />
                            ) : (
                              <>
                                <input type="hidden" name="status" value="duplicate" />
                                <input
                                  type="hidden"
                                  name="duplicate_of"
                                  value={candidato.event_id}
                                />
                              </>
                            )}
                            <button
                              type="submit"
                              className="inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent"
                            >
                              {aDecidir === 'fundir'
                                ? 'Confirmar: fundir'
                                : 'Confirmar: é duplicada'}
                            </button>
                            <Link
                              href={estaFicha({}, '#duplicados')}
                              className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium"
                            >
                              Voltar sem decidir
                            </Link>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {distintos.size > 0 ? (
            <p className="mt-4 text-sm text-muted">
              {distintos.size === 1
                ? 'Puseste de lado um evento parecido, como outro evento.'
                : `Puseste de lado ${distintos.size} eventos parecidos, como outros eventos.`}{' '}
              <Link
                href={`/admin/fila/${encodeURIComponent(submission.id)}#duplicados`}
                className="underline underline-offset-4"
              >
                Voltar a mostrá-los
              </Link>
            </p>
          ) : null}
        </section>

        <section aria-labelledby="editar">
          <h2 id="editar" className="text-lg font-semibold">
            Publicar
          </h2>

          <form id="aprovar" action={approveSubmission} className="mt-3 space-y-4">
            <input type="hidden" name="submission_id" value={submission.id} />

            <CamposDoEvento
              valores={proposed}
              sessoes={proposedDates}
              // As duas formas do payload: aninhado quando vem da recolha, liso
              // quando vem da extração. Isto lia só a forma lisa, e as 49
              // submissões que este sistema recebeu eram todas da recolha — a
              // caixa vinha desmarcada mesmo para os períodos.
              emCartaz={propostoEmCartaz(payload)}
              concelhos={municipalities}
              categorias={categories}
              espacos={venues}
              ciclos={ciclos}
              nomeDaRegiao={nomeDaRegiao}
              contexto="aprovar"
              notaDaDescricao={
                arrumado ? (
                  <div className="mt-2 rounded border border-border p-3 text-sm">
                    <p>
                      A recolha arrumou o texto que leu na fonte: tira o título repetido, a tabela
                      de datas e rótulos soltos. Confirma que não cortou de mais — o que corrigires
                      aqui fica trancado contra a recolha.
                    </p>
                    <details className="mt-1">
                      <summary className="min-h-11 cursor-pointer py-2.5 font-medium">
                        Ver o texto como veio da fonte
                      </summary>
                      <pre
                        tabIndex={0}
                        className="mt-1 max-h-64 overflow-auto rounded bg-surface p-2 whitespace-pre-wrap"
                      >
                        {arrumado.lido}
                      </pre>
                    </details>
                  </div>
                ) : undefined
              }
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isResolved}
                aria-describedby="aprovar-ajuda"
                className="inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
              >
                Aprovar e publicar
              </button>
              <button
                type="submit"
                name="seguinte"
                value="1"
                disabled={isResolved}
                aria-describedby="aprovar-ajuda"
                className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium disabled:opacity-50"
              >
                Aprovar e abrir a seguinte
              </button>
            </div>
            <p id="aprovar-ajuda" className="text-sm text-muted">
              Os campos que corrigires ficam trancados: a recolha seguinte não os volta a escrever
              por cima.
            </p>
          </form>

          {!isResolved ? (
            <section aria-labelledby="pedir" className="mt-8 border-t border-border pt-6">
              <h3 id="pedir" className="font-medium">
                Pedir o que falta
              </h3>
              {falta.length > 0 ? (
                <p className="mt-1 text-sm">
                  A ficha pública ainda não ia saber dizer: {falta.join(' · ')}.
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  Nada de essencial parece faltar. Se quiseres perguntar alguma coisa, a mensagem
                  abre já com o assunto escrito.
                </p>
              )}
              {escreverA && submission.sender_email ? (
                <>
                  <a
                    href={escreverA}
                    className="mt-3 inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium"
                  >
                    Escrever a {submission.sender_email}
                  </a>
                  <p className="mt-1 text-sm text-muted">
                    Abre o teu programa de email com a mensagem já escrita — revê-a antes de enviar.
                  </p>
                  {/* O registo do pedido, com a data e o que se pediu: é o
                      que a vista «À espera de resposta» mostra, e o que
                      permite responder «perguntámos a 2 de outubro». */}
                  <form action={rejectSubmission} className="mt-3">
                    <input type="hidden" name="submission_id" value={submission.id} />
                    <input type="hidden" name="status" value="needs_info" />
                    <input
                      type="hidden"
                      name="notes"
                      value={`Pedido por email a ${formatLongDate(todayInLisbon())}${
                        falta.length > 0 ? `: ${falta.join('; ')}` : ''
                      }.`}
                    />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium"
                    >
                      Já perguntei — fica à espera de resposta
                    </button>
                  </form>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  {daRecolha
                    ? 'Veio da recolha, da página da própria fonte: não há a quem escrever daqui. Completa à mão o que souberes, ou recusa.'
                    : 'Quem enviou não deixou email, e não há a quem perguntar: publica com o que tem, ou recusa.'}
                </p>
              )}
            </section>
          ) : null}

          <form action={rejectSubmission} className="mt-8 space-y-3 border-t border-border pt-6">
            <input type="hidden" name="submission_id" value={submission.id} />
            <div>
              <label htmlFor="status" className={LABEL}>
                Não publicar porque
              </label>
              <select id="status" name="status" className={FIELD} defaultValue="rejected">
                <option value="rejected">Não serve para a agenda</option>
                <option value="duplicate">Já está na agenda — é duplicada</option>
                <option value="needs_info">Falta informação — vou perguntar</option>
              </select>
            </div>
            {/* Nenhum campo pede um identificador (C4-014, C4-029): o evento
                de que a proposta é duplicada escolhe-se em «Pode já cá estar»,
                ou diz-se pelo endereço da ficha pública — que é o que quem
                modera tem aberto no outro separador. */}
            <div>
              <label htmlFor="duplicate_url" className={LABEL}>
                Se já está na agenda: o endereço da ficha do evento
              </label>
              <input
                id="duplicate_url"
                name="duplicate_url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="duplicate-url-ajuda"
                className={FIELD}
              />
              <p id="duplicate-url-ajuda" className="mt-1 text-sm text-muted">
                Abre o evento no sítio e copia o endereço da barra — acaba em /evento/…. Se ele
                aparece em «Pode já cá estar», basta o botão de lá.
              </p>
            </div>
            <div>
              <label htmlFor="notes" className={LABEL}>
                Notas
              </label>
              <textarea id="notes" name="notes" rows={2} className={FIELD} />
            </div>
            <button
              type="submit"
              disabled={isResolved}
              className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium disabled:opacity-50"
            >
              Registar decisão
            </button>
          </form>
        </section>
      </div>

      {!isResolved ? (
        <>
          {/* O espaço que a barra ocupa, para ela não tapar o fim da página. */}
          <div aria-hidden="true" className="h-20 sm:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-paper px-4 py-3 sm:hidden">
            <button
              type="submit"
              form="aprovar"
              className="inline-flex min-h-11 w-full items-center justify-center rounded bg-accent px-4 text-sm font-medium text-on-accent"
            >
              Aprovar e publicar
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
