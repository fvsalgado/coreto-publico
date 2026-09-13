/**
 * Disciplina de colunas.
 *
 * Nenhuma listagem faz `select('*')`. Um cartão de evento precisa das colunas
 * que estão em `CARD_EVENT_FIELDS` aqui em baixo — dezassete; a tabela tem
 * mais de sessenta, e várias são texto longo. Puxar tudo em listas de cem
 * custa largura de banda a cada visita e não serve para nada — a ficha do
 * evento é que pede o resto.
 *
 * O `is_ongoing` é a mais recente e a mais barata — um booleano — e está cá
 * porque sem ele os feeds não conseguem distinguir duas sessões que são dois
 * concertos de duas sessões que são as pontas de uma exposição. O calendário
 * escrevia dois compromissos para o que é um período só; ver
 * `feeds/build.ts`.
 */

export const CARD_EVENT_FIELDS = [
  'id',
  'slug',
  'title',
  'description_short',
  'municipality_id',
  'venue_id',
  'location_name',
  'category_slug',
  'date_start',
  'date_end',
  'is_ongoing',
  'is_free',
  'price_display',
  'image_url',
  'image_alt',
  /*
   * O nome fica, a coluna muda: passa a vir a resolvida da 0129.
   *
   * **Porquê a troca.** O cartão lia `events.wheelchair_accessible`, que está
   * a nulo em quase todos os eventos porque as câmaras não a preenchem;
   * enquanto isso, a ficha caía para o acesso do **espaço** quando o evento
   * se calava. Vinte e sete eventos do Médio Tejo tinham ficha a dizer
   * «Acessível» e cartão calado, e o filtro «Acessível» devolvia zero de 128.
   * A coluna resolvida é essa mesma regra materializada na base —
   * `coalesce(evento, espaço)` — e agora as três leituras dão a mesma
   * resposta.
   *
   * **Porquê um alias e não o nome novo.** `wheelchair_accessible` é um campo
   * **publicado**: sai em `/api/events`, está documentado em `/levar` com
   * exemplo, e há quem já o leia. A pergunta que ele responde não mudou — «dá
   * para entrar numa cadeira de rodas?» —, mudou só a forma de a responder,
   * e uma mudança de implementação não tem de partir o contrato de ninguém.
   * O alias é a forma de dizer isso numa linha: por dentro lê-se a coluna
   * derivada, por fora continua a chamar-se o que sempre se chamou.
   */
  'wheelchair_accessible:wheelchair_accessible_resolved',
  'audience',
].join(', ');

/**
 * O que o mapa precisa, e nada mais.
 *
 * Um ponto no mapa é uma data, um título, um sítio e um endereço para onde ir.
 * As coordenadas não entram no cartão de evento: só uma minoria dos eventos as
 * traz da fonte — a esmagadora maioria dos pontos exactos do mapa vem do espaço
 * do catálogo e não do evento —, e pedi-las em cada listagem seria pagar duas
 * colunas em todas as páginas para servir uma. (A proporção exacta muda a cada
 * recolha; não a escrevemos aqui por isso. Quem a quiser ver, vê-a na linha por
 * baixo do mapa, que a conta do que tem à frente.)
 */
export const MAP_EVENT_FIELDS = [
  'id',
  'slug',
  'title',
  'municipality_id',
  'venue_id',
  'location_name',
  'date_start',
  'date_end',
  'latitude',
  'longitude',
  // A capa, a ligação oficial e a categoria entram porque o painel do mapa
  // mostra o evento e não só o seu nome: sem elas, carregar numa marca dava
  // uma lista de títulos onde a agenda dá cartazes.
  'image_url',
  'image_alt',
  'category_slug',
  'source_url',
].join(', ');

/**
 * O que a página de um ciclo precisa.
 *
 * É quase o cartão, mais o `status` e o `source_url`. O `status` porque a
 * página mostra o que já passou ao lado do que vem aí e tem de saber
 * distinguir.
 *
 * O `source_url` tinha aqui outra justificação, e ela caiu: dizia que «um
 * evento arquivado não tem ficha própria no Coreto». Desde a 0132 tem — o
 * registo do que aconteceu abre, com o seu endereço de sempre. O cartão do
 * ciclo continua a ligar à página oficial, e essa é agora uma escolha
 * editorial por rever, e não uma consequência de não haver para onde ligar.
 */
export const SERIES_EVENT_FIELDS = [CARD_EVENT_FIELDS, 'status', 'source_url', 'series_id'].join(
  ', ',
);

export const DETAIL_EVENT_FIELDS = [
  CARD_EVENT_FIELDS,
  /*
   * O estado, porque a ficha passou a desenhar duas coisas diferentes.
   *
   * Até à 0132 a ficha só existia para o que vem aí, e o `status` era uma
   * pergunta sem sentido: a consulta filtrava `published` e mais nada chegava
   * cá. Agora chega o arquivo do que aconteceu, e a página tem de saber qual
   * dos dois tem à frente — para não oferecer um calendário para abril nem
   * anunciar bilhetes de um concerto que já se fez.
   *
   * Só o `status`: a política garante que arquivado implica
   * `archived_reason = 'passado'`, por isso pedir também a razão era pedir uma
   * coluna que ninguém lê.
   */
  'status',
  'subtitle',
  'description',
  'location_address',
  'parish',
  'latitude',
  'longitude',
  'how_to_arrive',
  'series_id',
  'tags',
  'min_age',
  // `is_ongoing` não está aqui: já vem do cartão. Uma coluna repetida no
  // `select` do PostgREST é um pedido malformado, não uma redundância inócua.
  'duration_minutes',
  'price_min',
  'price_max',
  'price_raw',
  'ticketing_url',
  'has_sign_language',
  'has_audio_description',
  'has_subtitles',
  'is_relaxed_performance',
  'accessibility_notes',
  'image_credit',
  // As medidas do cartaz: é com elas que a ficha reserva a caixa certa antes
  // de a imagem chegar. Só a ficha as pede — um cartão de listagem desenha a
  // capa numa moldura de proporção fixa, e aí não há salto para matar.
  'image_width',
  'image_height',
  'origin',
  'source_url',
  'updated_at',
].join(', ');

export const VENUE_FIELDS = [
  'id',
  'name',
  'municipality_id',
  'parish',
  'kind',
  'status',
  'is_association',
  'address',
  'latitude',
  'longitude',
  'how_to_arrive',
  'website_url',
  'wheelchair_accessible',
  'accessibility_notes',
  'image_url',
  /*
   * `description`, e nunca `notes`: as notas dos espaços são de trabalho —
   * sondagens de fontes, decisões de recolha — e chegaram a aparecer na
   * página pública como se fossem a apresentação do espaço. O que o público
   * lê é a descrição editorial; as notas ficam para a moderação.
   */
  'description',
].join(', ');

export const CORETO_FIELDS = [
  'id',
  'name',
  'parish',
  'municipality_id',
  'latitude',
  'longitude',
  'year_built',
  'is_confirmed',
  'venue_id',
  'photo_url',
  'photo_credit',
  /*
   * `description`, e nunca `notes` — pela mesma razão dos espaços, e com a
   * mesma história: as notas de um coreto são o caderno de quem faz o
   * levantamento («a prova mais frágil», «atenção ao homónimo», a data em que
   * se mudou de ideias) e estiveram a ser publicadas na página como se fossem
   * a apresentação do coreto. O público lê a descrição; o caderno fica para a
   * moderação.
   */
  'description',
].join(', ');

/**
 * As colunas das fontes que a chave pública consegue ler.
 *
 * Tem de bater certo com o `grant select (...)` da 0049 — pedir uma coluna a
 * mais faz o PostgREST recusar o pedido inteiro com «permission denied», e a
 * página das fontes ficava vazia sem dizer porquê. É de propósito que fica
 * escrita aqui, ao lado das outras: quem acrescentar uma coluna à lista tem
 * de acrescentá-la também à migração.
 */
export const PUBLIC_SOURCE_FIELDS = [
  'id',
  'name',
  'kind',
  'municipality_id',
  'region_id',
  'venue_id',
  'url',
  'is_enabled',
  'last_success_at',
  // Quando foi tentada, e não só quando correu bem (0128). É o que separa
  // «ninguém a leu há cinco dias» de «é lida todas as noites e não traz
  // nada»: um cron parado e uma câmara que mudou de tema parecem iguais se só
  // se olhar para a data da última leitura boa.
  'last_run_at',
  'public_note',
].join(', ');
