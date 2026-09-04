-- 0075 — O que a sondagem de 30 de agosto encontrou, e porque é que ainda não
-- há adaptador.
--
-- Ficou por fechar o levantamento dos espaços que têm sítio próprio e ainda não
-- são lidos: dezasseis endereços sondados hoje, um a um, com `curl` e sem
-- executar JavaScript — que é como o recoletor desta casa lê. **Nenhum é
-- ligável hoje**, e o valor desta migração é escrever porquê, com números, para
-- a próxima pessoa não repetir o trabalho.
--
-- Escreve-se em `notes` e não em `description`: isto é o caderno de pesquisa,
-- não é o que se mostra a quem visita.
--
-- ## O que se aprendeu, por famílias
--
--   · **Há duas portas abertas e vazias.** A bilheteira da Casa do Povo de
--     Minde responde `200 []` na API pública do WooCommerce, e o blogue da
--     biblioteca do Entroncamento tem RSS vivo com dez itens. Nos dois casos o
--     caminho existe; o que não existe é programação do outro lado. São as
--     duas que se ligam num dia quando houver.
--   · **Três respondem 503 e dois falham na ligação segura** — um sem a cadeia
--     do certificado, outro com o certificado expirado. Pede-se autorização e
--     avisa-se; não se dá a volta nem se desliga a verificação. É a regra que
--     está escrita na página das fontes.
--   · **O resto monta-se no browser** — cascas de 300 a 1 400 caracteres de
--     texto visível, ou carrosséis com quarenta e dois blocos vazios.
--
-- Quatro endereços de Ourém e o do Sport Club Operário de Cem Soldos não
-- puderam ser observados: a ligação daqui falhou ao nível do túnel, e falhou
-- ao mesmo tempo para a Wikimedia e para a Google. Uma falha nossa não é uma
-- conclusão sobre o servidor dos outros, e por isso não se escreve nada sobre
-- eles.
-- ---------------------------------------------------------------------------

-- ------------------------- As duas portas abertas ---------------------------

update public.sources set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: a Store API pública do WooCommerce '
    '(/wp-json/wc/store/products) responde 200 com um array vazio. A porta está '
    'aberta e é legível por máquina — o que falta são bilhetes à venda, não '
    'caminho para os ler. Quando a bilheteira tiver programação, esta fonte é '
    'das primeiras a ligar.',
  updated_at = now()
where id = 'cpminde-bilheteira';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: o blogue tem RSS vivo (/feed/, 10 itens, o mais '
    'recente de 18/08/2026) — é a única porta desta ronda que está aberta e a '
    'ser usada. O que lá vem são as «Novidades da semana», que são aquisições '
    'de livros e não eventos. Se a biblioteca passar a publicar sessões, '
    'liga-se num dia.',
  updated_at = now()
where id = 'biblioteca-municipal-entroncamento';

-- ---------------------- Onde o servidor responde que não --------------------

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: bmab.cm-abrantes.pt responde 503 com 118 bytes. '
    'Pede-se autorização; não se dá a volta.',
  updated_at = now()
where id = 'biblioteca-antonio-botto';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: museu.cm-torresnovas.pt responde 503 «Application '
    'Blocked», como o resto do domínio de Torres Novas.',
  updated_at = now()
where id = 'museu-carlos-reis';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: rbe.cm-vnbarquinha.pt responde 503 com 118 bytes.',
  updated_at = now()
where id = 'biblioteca-municipal-barquinha';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: rbtn.torresnovas.pt não completa a ligação segura — '
    'o servidor não envia a cadeia intermédia do certificado. É um defeito do '
    'lado deles e não um bloqueio: um browser disfarça-o, um recoletor não. '
    'Vale a pena dizer-lho.',
  updated_at = now()
where id = 'biblioteca-gustavo-pinto-lopes';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: bibliotecas.constancia.pt tem o certificado TLS '
    'expirado. Não se desliga a verificação para contornar isto.',
  updated_at = now()
where id = 'biblioteca-municipal-constancia';

-- --------------- Onde há sítio, e o sítio não publica agenda ----------------

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: a secção «Em Agenda» (#events) tem dois cartazes, e a '
    '30/08 os dois já passaram — «20 MAI → 21 JUN 2026» e a exposição RAMOT, de '
    '20/06/2026. A data está em texto livre num div.date (os span de dia e de '
    'mês estão comentados no HTML) e num dos dois vem vazia. Há por onde ler: o '
    'detalhe abre por POST a includes/_popup1.php com id e lang e devolve a '
    'ficha com a data legível; o carrossel de notícias do topo usa '
    'includes/news.php com o id no campo description. O que falta é matéria — '
    'nada por acontecer hoje — e um formato de data que não seja o que o editor '
    'escrever à mão. Não se infere de duas amostras.',
  updated_at = now()
where id = 'ceft-casa-dos-cubos';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: a secção «CCLT :: Próximos Eventos» (#sec4) é o '
    'blogue do complexo — três artigos, cada um com endereço próprio e um '
    'datetime legível (2026-04-24, 2026-05-30, 2026-06-03), e os três sobre o '
    'que já aconteceu («foi inaugurada»). Não há listagem do que está marcado, '
    'e /feed/ devolve a própria página. Ler isto punha notícias na agenda.',
  updated_at = now()
where id = 'complexo-cultural-levada-tomar';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: 42 blocos div.item na página e nenhum com texto — são '
    'molduras de carrossel preenchidas por JavaScript. museusdeabrantes.pt/feed/ '
    'responde 404.',
  updated_at = now()
where id = 'miaa';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: /1194/atividades lista a oferta permanente (Parque de '
    'Astronomia, planetário, observações noturnas) com «1 janeiro – 31 '
    'dezembro»; /15263/aconteceu é, pelo próprio nome, o que já aconteceu, '
    'agrupado por mês e sem dia. Não há listagem do que está marcado. E o sítio '
    'é servido em codificação antiga sem charset correto — quem escrever o '
    'adaptador tem de o descodificar à mão.',
  updated_at = now()
where id = 'ccv-constancia';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: o feed Atom do Blogger responde e traz 8 entradas, a '
    'mais recente de 10/03/2025, e todas com title e content vazios — são '
    'publicações só de imagem. Sem texto não há o que ler.',
  updated_at = now()
where id = 'sf-euterpe-meiaviense';

-- ------------------------- Cascas montadas no browser -----------------------

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: 346 caracteres de texto visível na página inteira. '
    'É uma casca; o conteúdo monta-se no browser.',
  updated_at = now()
where id = 'caorg-minde';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: 1 026 caracteres de texto visível e nenhuma data. '
    'Não há agenda publicada.',
  updated_at = now()
where id = 'choral-phydellius';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: 1 369 caracteres de texto visível e nenhuma data — a '
    'programação não vem no HTML servido.',
  updated_at = now()
where id = 'convento-de-cristo';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: sítio Wix, 376 kB de HTML e nem uma data em português '
    'no texto visível.',
  updated_at = now()
where id = 'casa-memoria-de-camoes';

update public.venues set
  notes = coalesce(notes || ' ', '') ||
    'Sondagem 2026-08-30: visitabrantes.pt serve 276 caracteres de texto '
    'visível — monta-se por JavaScript.',
  updated_at = now()
where id = 'aquapolis-abrantes';

-- ---------------------------------------------------------------------------
do $$
declare
  v_espacos integer;
  v_fonte   integer;
begin
  select count(*) into v_espacos from public.venues
  where notes like '%Sondagem 2026-08-30%';
  if v_espacos <> 16 then
    raise exception 'esperavam-se 16 espaços anotados e há %', v_espacos;
  end if;

  select count(*) into v_fonte from public.sources
  where id = 'cpminde-bilheteira' and notes like '%Store API%';
  if v_fonte <> 1 then
    raise exception 'a nota da bilheteira de Minde não ficou escrita';
  end if;

  -- E nenhum destes espaços ganhou fonte ligada: isto é o caderno, não o
  -- motor. A ronda inteira deu negativo, e é isso que fica escrito.
  if exists (
    select 1 from public.sources s
    join public.venues v on v.id = s.venue_id
    where s.is_enabled and v.notes like '%Sondagem 2026-08-30%'
  ) then
    raise exception 'um espaço anotado como não ligável aparece com fonte ligada';
  end if;
end
$$;
