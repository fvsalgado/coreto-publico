-- 0041 — O Cine-Teatro São João entra, e os eventos ligam-se ao espaço.
--
-- O pedido: um evento que acontece num espaço do catálogo tem de aparecer
-- ligado a esse espaço, não com o nome do concelho por local. A recolha das
-- agendas Joomla põe o espaço em `location_name` só quando a câmara o escreve
-- no campo do preço; quando o espaço vem no corpo da descrição («no Cineteatro
-- São João», «patente na Biblioteca Municipal»), ficava por casar.
--
-- Verificou-se cada caso contra a fonte antes de ligar — a regra da casa é
-- não fabricar, e um evento ligado ao espaço errado é pior do que um evento
-- com o nome do concelho. Dois achados obrigaram a mais do que ligar:
--
--   * O **Cine-Teatro São João** (Entroncamento) é um espaço DIFERENTE do
--     Centro Cultural do Entroncamento — ruas, anos e lotações distintos
--     (allaboutportugal, RTCP, SIPA 10571). Faltava ao catálogo, e é o
--     principal palco do concelho. Entra aqui, e os dois eventos que lá
--     acontecem ligam-se-lhe.
--   * A biblioteca de Vila Nova da Barquinha passou a chamar-se oficialmente
--     **Biblioteca Municipal Carlos Matos Gomes** (inaugurada a 25/06/2026,
--     reintegrada na RNBP; DGLAB e imprensa regional). O nome antigo fica
--     como alias — nada deixa de casar.
--
-- Os `update` aos eventos afetam zero linhas no Postgres limpo do CI (que só
-- tem migrações, não tem recolha) e ligam os eventos em produção. A regra
-- `keepIfEmpty` da recolha preserva um `venue_id` preenchido, por isso a
-- ligação sobrevive às recolhas seguintes.

-- ---------------------------------------------------------------------------
-- 1) O espaço que faltava: Cine-Teatro São João (Entroncamento).
-- ---------------------------------------------------------------------------
insert into public.venues (
  id, name, short_name, municipality_id, parish, kind, status, is_association,
  address, postal_code, latitude, longitude, phone, email, website_url, description, notes
) values (
  'cine-teatro-sao-joao-entroncamento',
  'Cine-Teatro São João',
  'Cine-Teatro São João',
  'entroncamento',
  'São João Baptista',
  'theatre',
  'active',
  false,
  'Rua Dom Nuno Álvares Pereira, 18-20',
  '2330-141 Entroncamento',
  39.462632,
  -8.469193,
  '249 720 400',
  'cultura@cm-entroncamento.pt',
  'https://www.cm-entroncamento.pt',
  'A sala de espetáculos e auditório municipal do Entroncamento, na Rua Dom Nuno Álvares Pereira. '
  || 'Inaugurado em 1965, foi adquirido pela câmara em 1999 e reaberto restaurado em novembro de 2019, '
  || 'com cerca de 395 lugares. Integra a Rede de Teatros e Cineteatros Portugueses.',
  'Levantamento 2026-08-28: espaço distinto do Centro Cultural do Entroncamento (ruas, anos e lotações diferentes). '
  || 'Morada, datas e lotação de allaboutportugal.pt, RTCP e SIPA n.º 10571; coordenadas da Rua Dom Nuno Álvares Pereira.'
)
on conflict (id) do nothing;

insert into public.venue_aliases (alias, venue_id) values
  (public.normalize_for_hash('Cine-Teatro São João'), 'cine-teatro-sao-joao-entroncamento'),
  (public.normalize_for_hash('Cineteatro São João'), 'cine-teatro-sao-joao-entroncamento'),
  (public.normalize_for_hash('Cineteatro S. João'), 'cine-teatro-sao-joao-entroncamento'),
  (public.normalize_for_hash('Auditório Municipal do Entroncamento'), 'cine-teatro-sao-joao-entroncamento')
on conflict (alias) do nothing;

-- ---------------------------------------------------------------------------
-- 2) A biblioteca da Barquinha recebe o nome oficial novo.
-- ---------------------------------------------------------------------------
update public.venues set
  name = 'Biblioteca Municipal Carlos Matos Gomes',
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: nome oficial atualizado — a biblioteca passou a Biblioteca Municipal Carlos Matos Gomes (inaugurada 25/06/2026, reintegrada na RNBP; DGLAB e imprensa regional), em homenagem a Carlos Matos Gomes (1946-2025), militar de Abril e escritor natural da Barquinha.',
  updated_at = now()
where id = 'biblioteca-municipal-barquinha';

insert into public.venue_aliases (alias, venue_id) values
  (public.normalize_for_hash('Biblioteca Municipal Carlos Matos Gomes'), 'biblioteca-municipal-barquinha'),
  (public.normalize_for_hash('Biblioteca Municipal de Vila Nova da Barquinha'), 'biblioteca-municipal-barquinha')
on conflict (alias) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Ligar os eventos verificados ao espaço onde acontecem (só em produção;
--    no CI não há eventos e estes update afetam zero linhas).
-- ---------------------------------------------------------------------------
update public.events set venue_id = 'cine-teatro-sao-joao-entroncamento', updated_at = now()
  where venue_id is null and source_url in (
    'https://www.cm-entroncamento.pt/index.php/agenda/musica/cafe-concerto-no-foyer-do-cineteatro-s-joao',
    'https://www.cm-entroncamento.pt/index.php/agenda/musica/gala-uma-noite-na-opera');

update public.events set venue_id = 'biblioteca-municipal-entroncamento', updated_at = now()
  where venue_id is null and source_url = 'https://www.cm-entroncamento.pt/index.php/agenda/musica/sunset-na-biblioteca';

update public.events set venue_id = 'biblioteca-municipal-ferreira-do-zezere', updated_at = now()
  where venue_id is null and source_url = 'https://cm-ferreiradozezere.pt/comunicacao/agenda/exposicoes/481-exposicao-geografias-da-memoria';

update public.events set venue_id = 'biblioteca-municipal-sardoal', updated_at = now()
  where venue_id is null and source_url = 'https://www.cm-sardoal.pt/comunicacao/agenda/exposicoes/exposicao-ser-em-construcao';

update public.events set venue_id = 'centro-cultural-gil-vicente', updated_at = now()
  where venue_id is null and source_url = 'https://www.cm-sardoal.pt/comunicacao/agenda/exposicoes/exposicao-de-gigantones-e-cabecudos';

update public.events set venue_id = 'centro-cultural-barquinha', updated_at = now()
  where venue_id is null and source_url = 'https://www.cm-vnbarquinha.pt/index.php/viver/agenda/musica/barquinha-jazz-2026';

update public.events set venue_id = 'biblioteca-municipal-barquinha', updated_at = now()
  where venue_id is null and source_url = 'https://www.cm-vnbarquinha.pt/index.php/viver/agenda/eventos-literarios/clube-de-leitura';

-- ---------------------------------------------------------------------------
-- Asserções — só sobre espaços/aliases, que existem no Postgres limpo do CI.
-- ---------------------------------------------------------------------------
do $$
declare
  v_novo integer;
  v_nome text;
  v_aliases integer;
begin
  select count(*) into v_novo from public.venues where id = 'cine-teatro-sao-joao-entroncamento';
  if v_novo <> 1 then
    raise exception 'esperava-se o espaço cine-teatro-sao-joao-entroncamento, e há %', v_novo;
  end if;

  select name into v_nome from public.venues where id = 'biblioteca-municipal-barquinha';
  if v_nome <> 'Biblioteca Municipal Carlos Matos Gomes' then
    raise exception 'a biblioteca da Barquinha devia chamar-se Carlos Matos Gomes, e chama-se %', v_nome;
  end if;

  -- Três e não quatro: «Cine-Teatro São João» e «Cineteatro São João»
  -- normalizam para o mesmo alias (o hífen e o espaço caem), e o quarto é
  -- «Auditório Municipal do Entroncamento».
  select count(*) into v_aliases from public.venue_aliases
   where venue_id = 'cine-teatro-sao-joao-entroncamento';
  if v_aliases < 3 then
    raise exception 'esperavam-se pelo menos 3 aliases do Cine-Teatro São João, e há %', v_aliases;
  end if;
end
$$;
