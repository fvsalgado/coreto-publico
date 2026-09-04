-- 0092 — Uma ligação morta sai da ficha, e treze espaços ficam mais completos.
--
-- Passagem a todas as 106 fichas de espaço, campo a campo, com pesquisa nas
-- fontes oficiais de cada concelho. O que se segue é o que ficou provado.
--
-- ## O achado que obrigou a esta migração
--
-- **`museu.cm-ourem.pt` não existe.** Está publicado na ficha do Museu
-- Municipal de Ourém como o sítio oficial do museu, e quem lá carrega não
-- chega a lado nenhum. Não é uma indisponibilidade passageira nem uma recusa
-- ao nosso agente: o resolvedor público da Google devolve NXDOMAIN, e a zona
-- `cm-ourem.pt` responde com série SOA de 28/08/2026 — está viva e actual, e
-- o subdomínio do museu foi retirado dela. `museu2.cm-ourem.pt`, que aparece
-- nos motores de busca, também já não resolve.
--
-- Passa a apontar para a página do museu no sítio do município, que resolve.
--
-- ## Como se descobriu, e o que mais se aprendeu
--
-- Testaram-se as 55 ligações que publicamos, uma a uma. Quarenta e cinco
-- respondem 200. Das dez que não:
--
--   · **Uma está morta** — a de cima, e é a única que se corrige aqui.
--   · **Uma falha a validação do certificado** (`bibliotecas.constancia.pt`).
--     Troca-se pela página da biblioteca no sítio do município, que responde
--     200 e é igualmente oficial. Não se afirma aqui que o certificado da
--     Constância está caducado: afirma-se que a ligação falha a partir daqui,
--     e escolhe-se a que não falha.
--   · **Seis recusam o nosso agente** (Torres Novas, Ourém, SCOCS) — a WAF de
--     Torres Novas já era conhecida. Ficam como estão: recusar um robô não é
--     estar morto, e num telemóvel abrem.
--   · **Duas devolvem 503 em duas tentativas** (`bmab.cm-abrantes.pt`,
--     `rbe.cm-vnbarquinha.pt`), ambas catálogos de biblioteca. Ficam como
--     estão, e ficam apontadas para nova verificação: um 503 repetido não é
--     prova de morte, é motivo de suspeita.
--
-- ## O que se preenche
--
-- Treze fichas ganham campos, todos com fonte:
--
--   · **quARTel de Abrantes** ganha o ponto no mapa — o GPS está publicado
--     pelo próprio museu — e o email dos Museus de Abrantes.
--   · **CIRA (Tramagal)** ganha morada e ponto. O centro fica na antiga
--     escola primária do Crucifixo, e o ponto é o do lugar, não o da porta.
--   · **Museu dos Rios (Constância)** ganha sítio próprio, freguesia e o
--     telefone no formato da casa.
--   · **Mercado de Ferreira do Zêzere** ganha morada e telefone; **a
--     biblioteca do mesmo concelho** ganha email.
--   · **Mercado de Alcanena** ganha telefone.
--   · **Galeria Municipal do Entroncamento**, que não tinha nada, ganha
--     descrição e a linha da cultura do município.
--   · **Auditório do Edifício Pirâmide** ganha descrição.
--   · **Centro Cultural Elvino Pereira** ganha morada.
--
-- ## O que se recusou preencher, e porquê
--
-- Isto é metade do trabalho. Três coisas apareceram e não entram:
--
--   · **O código postal do mercado de Ferreira do Zêzere.** O TUR4all diz
--     2240-342, o Nominatim diz 2240-341 para a mesma praça. Um dígito de
--     diferença num código postal é um código postal errado, e a 0091 já nos
--     ensinou o que isso custa. Fica a morada, que as duas fontes confirmam.
--   · **A morada do mercado de Alcanena.** Temos «Rua Professora Margarida
--     Adelaide Gonçalves Louro», o TUR4all diz «Rua 25 de Abril» e um terceiro
--     diz «Rua Zeca Afonso». Um edifício de mercado tem frentes para várias
--     ruas e nenhuma fonte é claramente a boa. Fica o que lá está.
--   · **O email do cine-teatro de Mação e o das inscrições do CIRA.** O
--     primeiro é o endereço nominal de uma pessoa; o segundo é o do desporto
--     do município, para inscrições em caminhadas. Nenhum é o balcão do
--     espaço, e uma ficha pública não é sítio para nenhum dos dois.
--
-- E não se preenche a morada da Galeria Municipal do Entroncamento. Um
-- resumo de motor de busca diz que fica dentro do Centro Cultural; nem a
-- notícia que o resumo cita nem o município o confirmam. Um resumo não é
-- fonte.

-- ---------------------------------------------------------------------------
-- I. A ligação que não leva a lado nenhum, e a que não valida.
-- ---------------------------------------------------------------------------

update public.venues set
  website_url = 'https://www.ourem.pt/areas-de-acao/cultura/museu/',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: o sítio publicado até aqui, museu.cm-ourem.pt, deixou de existir '
    '(NXDOMAIN no resolvedor público da Google; a zona cm-ourem.pt está viva, com série SOA de '
    '2026-08-28). museu2.cm-ourem.pt, que ainda aparece indexado, também não resolve. Passa a '
    'apontar para a página do museu no sítio do município.',
  updated_at = now()
where id = 'museu-municipal-ourem';

update public.venues set
  website_url = 'https://www.cm-constancia.pt/viver/biblioteca-e-arquivo-municipal/biblioteca-municipal-alexandre-oneill',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: bibliotecas.constancia.pt falha a validação do certificado a partir '
    'daqui. Troca-se pela página da biblioteca no sítio do município, que responde 200. Horário '
    'publicado: 2.ª a 6.ª das 09h00 às 17h00.',
  updated_at = now()
where id = 'biblioteca-municipal-constancia';

-- ---------------------------------------------------------------------------
-- II. O formato do telefone que a 0050 fixou, e que quatro fichas não seguem.
--
-- `+351 NNN NNN NNN` não é preciosismo: é o que `telefones()` sabe partir para
-- montar o `tel:`. «249360150» num href sem espaços continua a marcar, mas na
-- página lê-se como um número de série.
-- ---------------------------------------------------------------------------

update public.venues v set phone = d.tel, updated_at = now()
from (values
  ('centro-cultural-alfredo-keil',        '+351 249 360 150'),
  ('cine-teatro-ivone-silva',             '+351 249 360 150'),
  ('museu-rios-artes-maritimas',          '+351 249 730 053'),
  ('quartel-galeria-abrantes',            '+351 241 331 408')
) as d(id, tel)
where v.id = d.id;

-- ---------------------------------------------------------------------------
-- III. Dois pontos que faltavam no mapa.
--
-- O do quARTel é exacto: está publicado pelo próprio museu, na sua página.
-- O do CIRA é o do lugar do Crucifixo e não o da porta — a antiga escola
-- primária não está no OpenStreetMap. Fica dito na nota, que é o que a casa
-- faz com um ponto aproximado.
-- ---------------------------------------------------------------------------

update public.venues set
  latitude = 39.46423,
  longitude = -8.20093,
  email = 'museusdeabrantes@cm-abrantes.pt',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: coordenadas e email publicados pelo próprio museu em '
    'museusdeabrantes.pt/quartel. Horário publicado: 3.ª a sábado, 14h00–17h30; encerra ao '
    'domingo, à segunda e nos feriados (excepto 14 de junho). Entrada gratuita.',
  updated_at = now()
where id = 'quartel-galeria-abrantes';

update public.venues set
  address = 'Antiga Escola Primária do Crucifixo',
  latitude = 39.440034,
  longitude = -8.268321,
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: instalado na antiga escola primária do Crucifixo, confirmado em '
    'três coberturas independentes da inauguração. O ponto é o centróide do lugar do Crucifixo '
    '(Nominatim) e não o da porta — a escola não está no OpenStreetMap. As inscrições nas '
    'actividades fazem-se por desporto@cm-abrantes.pt, que é o do município e não o do centro, '
    'e por isso não entra no campo do email.',
  updated_at = now()
where id = 'cira-alcolobre';

-- ---------------------------------------------------------------------------
-- IV. Moradas, contactos e freguesia.
-- ---------------------------------------------------------------------------

update public.venues set
  website_url = 'https://turismo.cm-constancia.pt/o-que-visitar/museu-dos-rios-e-das-artes-maritimas',
  parish = 'Constância',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: página própria no turismo do município. Horário publicado: 2.ª a '
    '6.ª, 09h00–12h30 e 14h00–17h30. Entrada 1,00 €; visita com guia 0,50 € por pessoa, até 20.',
  updated_at = now()
where id = 'museu-rios-artes-maritimas';

update public.venues set
  address = 'Praça Pedro Ferreira',
  phone = '+351 249 360 150',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: morada e telefone da ficha de acessibilidade do TUR4all, que é um '
    'levantamento no terreno. A praça fica a 66 m da coordenada que já tínhamos e a Rua do '
    'Depósito de Água a 68 m do outro lado — é o mesmo edifício com duas frentes. O código postal '
    'não entra: o TUR4all diz 2240-342 e o Nominatim 2240-341 para a mesma praça. Horário '
    'publicado: segunda 7h30–12h00 e sábado 7h30–12h30.',
  updated_at = now()
where id = 'mercado-municipal-ferreira-do-zezere';

update public.venues set
  email = 'biblioteca@cm-ferreiradozezere.pt',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: email confirmado na ficha do TUR4all.',
  updated_at = now()
where id = 'biblioteca-municipal-ferreira-do-zezere';

update public.venues set
  phone = '+351 249 881 857',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: telefone da ficha do TUR4all. A morada não se mexe: temos «Rua '
    'Professora Margarida Adelaide Gonçalves Louro», o TUR4all diz «Rua 25 de Abril» e um '
    'terceiro «Rua Zeca Afonso» — o mercado tem frentes para várias ruas e nenhuma fonte se impõe.',
  updated_at = now()
where id = 'mercado-municipal-alcanena';

update public.venues set
  address = 'Rua Sacadura Cabral',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: a morada vem da própria ficha da biblioteca municipal, que a '
    'descreve como «Rua Sacadura Cabral (Centro Cultural Elvino Pereira)» — é o mesmo edifício. '
    'O turismo municipal confirma que alberga a biblioteca, a ludoteca, uma galeria e um auditório.',
  updated_at = now()
where id = 'centro-cultural-elvino-pereira';

-- ---------------------------------------------------------------------------
-- V. Duas fichas que abriam sem uma linha a dizer o que o espaço é.
--
-- Quatro espaços não têm descrição. Dois deles ficam por escrever de
-- propósito: do Estúdio de Dança de Alcanena não há morada nem designação
-- oficial confirmada, e do Pavilhão Ana Sonça não há nada além do nome que a
-- junta de freguesia usa. Escrever ali uma frase seria inventar.
-- ---------------------------------------------------------------------------

update public.venues set
  description =
    'O auditório municipal do Edifício Pirâmide, no Alto de Santo António. É uma sala pequena, '
    'de conferências, apresentações e sessões públicas, e é o local que a agenda do município '
    'nomeia quando a programação não é do quARTel nem da biblioteca.',
  updated_at = now()
where id = 'auditorio-edificio-piramide';

update public.venues set
  description =
    'A sala de exposições do município do Entroncamento. É onde a câmara mostra o que programa '
    'ao longo do ano — fotografia, cerâmica, coletivas dos alunos da universidade sénior, '
    'documentais do arquivo municipal —, sempre com entrada gratuita.',
  phone = '+351 249 720 400',
  email = 'cultura@cm-entroncamento.pt',
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-09-01: o telefone e o email são os da divisão de cultura do município, e '
    'não os de um balcão da galeria — é assim que se chega a quem sabe. A morada continua por '
    'confirmar: um resumo de motor de busca coloca a galeria dentro do Centro Cultural, mas nem '
    'a notícia citada nem o município o dizem.',
  updated_at = now()
where id = 'galeria-municipal-entroncamento';

-- ---------------------------------------------------------------------------
do $$
declare
  mal_formatado integer;
  morto         integer;
  n             integer;
begin
  -- Postcondições sobre as linhas que esta migração toca. Numa base vazia
  -- todas contam zero e passam caladas.

  -- 1. Nenhum dos telefones normalizados aqui volta ao formato antigo.
  select count(*) into mal_formatado
  from public.venues
  where id in ('centro-cultural-alfredo-keil','cine-teatro-ivone-silva',
               'museu-rios-artes-maritimas','quartel-galeria-abrantes')
    and phone is not null
    and phone !~ '^\+351 \d{3} \d{3} \d{3}';

  if mal_formatado > 0 then
    raise exception '% telefones desta migração não ficaram em «+351 NNN NNN NNN»', mal_formatado;
  end if;

  -- 2. O subdomínio morto não volta a nenhuma ficha. É a razão da migração.
  select count(*) into morto
  from public.venues
  where website_url like '%museu.cm-ourem.pt%'
     or website_url like '%museu2.cm-ourem.pt%';

  if morto > 0 then
    raise exception 'museu.cm-ourem.pt voltou a % ficha(s) — o domínio não existe', morto;
  end if;

  -- 3. Os dois espaços que ganham ponto ficam com os dois valores, nunca com
  --    metade de um par: meia coordenada põe um alfinete no golfo da Guiné.
  select count(*) into n
  from public.venues
  where id in ('quartel-galeria-abrantes','cira-alcolobre')
    and (latitude is null) <> (longitude is null);

  if n > 0 then
    raise exception '% espaço(s) desta migração ficaram com meia coordenada', n;
  end if;

  -- 4. As duas fichas que abriam sem descrição passam a ter uma.
  select count(*) into n
  from public.venues
  where id in ('auditorio-edificio-piramide','galeria-municipal-entroncamento')
    and description is null;

  if n > 0 then
    raise exception '% das duas fichas continuam sem descrição', n;
  end if;

  select count(*) into n from public.venues where latitude is not null;
  raise notice '% espaços com ponto no mapa', n;
  select count(*) into n from public.venues where description is not null;
  raise notice '% espaços com descrição', n;
end
$$;
