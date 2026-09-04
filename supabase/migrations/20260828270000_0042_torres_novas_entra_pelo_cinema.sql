-- 0042 — Torres Novas entra pelo cinema, e a câmara fica pronta para o dia em
--        que autorizar.
--
-- Torres Novas era o único dos onze sem recolha própria. A sondagem de hoje
-- separou duas coisas que andavam juntas:
--
--   * O sítio da **câmara** continua a responder `503 «Application Blocked»`
--     a quem recolhe — é um aparelho de segurança que bloqueia por endereço,
--     e bloqueia tudo (robots.txt, sitemap, feeds). Descobriu-se, pelo índice
--     de pesquisa, que a agenda existe em
--     `/index.php/comunicacao/agenda`, com as mesmas categorias e o mesmo
--     formato de data dos outros oito concelhos — ou seja, é `com_eventbooking`
--     e corre com o adaptador que já temos. A configuração ficava a apontar
--     para um caminho que não existe («/pt/agenda») e para o adaptador errado;
--     corrige-se agora, para que o dia em que a câmara autorizar o endereço de
--     quem recolhe seja só ligar o interruptor.
--
--     **Fica desligada.** A via de entrada é a câmara autorizar o nosso
--     recoletor — não contornar o bloqueio dela. Um agregador que se esgueira
--     pela segurança de quem publica não tem como pedir confiança a seguir.
--
--   * O sítio do **Teatro Virgínia** não está atrás desse bloqueio, e publica
--     a época de cinema inteira: sessão a sessão, com data, hora, realizador,
--     duração e classificação etária. A nota anterior dizia que o sítio «não
--     publica datas» — era verdade da entrada, que é um índice sem programação,
--     e falso da secção do cinema, que é onde a programação vive. Passa a ser
--     recolhida pelo adaptador novo `teatro-virginia`.
--
--     O endereço é o da **categoria** e não o do artigo do ano: a categoria
--     serve sempre a época corrente, e o artigo muda de número a cada ano
--     («Cinema 2026» é o 206, «Cinema 2025» o 504). Assim a fonte não expira
--     em janeiro.
--
-- As sessões são do Cineclube de Torres Novas, às terças às 21h30, no Teatro
-- Virgínia. A época publicada hoje (janeiro–junho de 2026) já passou toda; a
-- fonte fica ligada à espera da próxima, que entra sozinha na noite em que for
-- publicada.

update public.sources set
  adapter = 'teatro-virginia',
  url = 'https://www.teatrovirginia.pt/index.php/cinema',
  is_enabled = true,
  min_expected_items = 3,
  baseline_item_count = null,
  consecutive_failures = 0,
  circuit_open_until = null,
  last_error = null,
  name = 'Teatro Virgínia — Cinema (Cineclube de Torres Novas)',
  notes = coalesce(notes || ' ', '') || 'Religada a 2026-08-28: a secção do cinema (/index.php/cinema) publica a época inteira em sessões datadas, com realizador, duração e classificação — o que a entrada do sítio não faz. Adaptador próprio «teatro-virginia»; o endereço é o da categoria para não expirar quando o artigo do ano mudar de número. Não se recolhe da bilheteira de terceiros.',
  updated_at = now()
where id = 'teatro-virginia';

update public.sources set
  adapter = 'joomla-eventbooking',
  url = 'https://cm-torresnovas.pt/index.php/comunicacao/agenda',
  min_expected_items = 1,
  notes = coalesce(notes || ' ', '') || 'Levantamento 2026-08-28: identificado o caminho verdadeiro da agenda (/index.php/comunicacao/agenda) e confirmado, pelo índice de pesquisa, que é com_eventbooking como as outras oito câmaras — passa a estar configurada com o adaptador certo. CONTINUA DESLIGADA: o WAF responde 503 a quem recolhe, e a via de entrada é a câmara autorizar o endereço do recoletor, não contornar o bloqueio.',
  updated_at = now()
where id = 'cm-torresnovas';

-- ---------------------------------------------------------------------------
do $$
declare
  v_adapter text;
  v_url text;
  v_ligada boolean;
  v_camara_ligada boolean;
begin
  select adapter, url, is_enabled into v_adapter, v_url, v_ligada
    from public.sources where id = 'teatro-virginia';
  if v_adapter <> 'teatro-virginia' then
    raise exception 'a fonte do Teatro Virgínia devia usar o adaptador teatro-virginia, e usa %', v_adapter;
  end if;
  if v_url not like '%/index.php/cinema' then
    raise exception 'a fonte do Teatro Virgínia devia apontar para a categoria do cinema, e aponta para %', v_url;
  end if;
  if not v_ligada then
    raise exception 'a fonte do Teatro Virgínia devia ficar ligada';
  end if;

  -- Uma fonte ligada com mínimo a zero é uma recolha vazia a passar por verde.
  if (select min_expected_items from public.sources where id = 'teatro-virginia') < 1 then
    raise exception 'a fonte do Teatro Virgínia tem de declarar um mínimo de itens';
  end if;

  select is_enabled into v_camara_ligada from public.sources where id = 'cm-torresnovas';
  if v_camara_ligada then
    raise exception 'a câmara de Torres Novas tem de ficar desligada enquanto o WAF a tapar';
  end if;
end
$$;
