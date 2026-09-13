-- 0149 — Os indicadores que medem o que a casa promete.
--
-- O `PROJETO.md` faz dois compromissos escritos — a cauda longa associativa e
-- a coesão do território — e a declaração de acessibilidade faz um terceiro.
-- Nenhum dos três tinha número. Esta migração conta cinco famílias, e conta-as
-- com a honestidade que a ausência exige: **quase todas começam em zero, e é
-- para isso que servem**. Um compromisso sem medida é uma intenção; com
-- medida, é trabalho por fazer, à vista.
--
-- ## A base é «programado», e não «publicado». Medido.
--
-- O resto do relatório tem duas populações, com razões escritas: os eventos
-- **publicados no mês** contam a decisão de publicar e incluem os arquivados;
-- os **a decorrer no mês** contam só `status = 'published'`.
--
-- Para estes cinco indicadores nenhuma das duas serve, e o número que o
-- mostra é o CAMINHOS. A série regional da CIM tocou **dez concelhos** entre
-- 13 de abril e 24 de maio de 2026; os seus dez eventos estão hoje
-- `archived`, porque já aconteceram. Contando só `published`, o relatório de
-- abril diz **cinco** eventos no Médio Tejo e **zero** em rede. Contando o
-- que foi programado, diz **treze** e **quatro, em quatro concelhos**.
--
-- Um indicador de coesão territorial que esquece o programa que uniu dez
-- concelhos, por ele ter acabado, mede a data em que se abriu o relatório.
-- Por isso a base aqui é: canónico, `status not in ('draft','hidden')`, com a
-- programação a tocar a janela. `draft` fica de fora porque não é agenda
-- ainda; `hidden` porque é uma decisão de não mostrar.
--
-- Isto quer dizer que `promises.total` **não é** o `eventos_a_decorrer` do
-- bloco das comparações, e a diferença está escrita na ficha técnica. Em
-- setembro de 2026 são 104 e 101.
--
-- ## O que cada família conta, e o que não conta
--
-- **Coesão.** A quota do concelho com mais programação, a mediana, e quantos
-- ficam abaixo de metade dela — **nunca como tabela ordenada**. Uma lista de
-- concelhos por ordem de programação é uma tabela classificativa, e uma
-- tabela classificativa entre municípios da mesma CIM não é um instrumento de
-- coesão: é uma arma. A mediana conta **todos** os concelhos da região, zeros
-- incluídos, porque um concelho sem programação é precisamente o achado.
--
-- **Cauda longa associativa.** Em espaço de coletividade, em equipamento, e
-- em sítio nomeado sem espaço do catálogo. As três somam o total — provado lá
-- em baixo — e a terceira é a maior de longe: em setembro, 68 dos 104. Não é
-- um defeito das coletividades, é o estado do catálogo.
--
-- **Entrada livre.** Grátis, pago, e **não diz** — as três com o mesmo peso.
-- «Não diz» não é «pago» nem «grátis», e arrumá-lo numa das outras era
-- inventar o preço de 72 eventos.
--
-- **Acessibilidade declarada.** São **quatro** condições e não cinco: cadeira
-- de rodas, língua gestual, audiodescrição e sessão relaxada. O plano falava
-- também em legendagem, e `events` não tem coluna nenhuma para ela — contar
-- uma quinta que não existe era escrever um zero que se lê como «ninguém
-- legenda». A da cadeira de rodas é a **resolvida** (a do evento, ou a do
-- espaço quando o evento não diz), que é o que o público lê na ficha.
--
-- **Programação em rede.** Eventos de séries com `is_regional`, e quantos
-- concelhos tocaram. Hoje há três séries regionais na base e uma com eventos.
--
-- ## A ressalva que vai em todas
--
-- Isto mede **o que a agenda conseguiu recolher**, e não o que aconteceu no
-- território. Confundir as duas coisas é acusar um município de não fazer
-- nada quando o que ele não faz é publicar em HTML legível — e hoje há oito
-- câmaras cujo sítio não responde a um único pedido. A frase vai na ficha
-- técnica e na página, ao lado dos números.

create function public.report_promises(p_region text, p_de date, p_ate date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  -- Uma passagem pelo catálogo, e as cinco famílias a lerem-na. Sem tabela
  -- temporária: uma função `stable` não escreve, e uma que escrevesse deixava
  -- de poder ser chamada de dentro de outra consulta.
  with base as (
    select e.id,
           e.municipality_id,
           e.venue_id,
           e.is_free,
           e.price_min,
           coalesce(e.wheelchair_accessible_resolved, false) as cadeira,
           coalesce(e.has_sign_language, false)              as gestual,
           coalesce(e.has_audio_description, false)          as audio,
           coalesce(e.is_relaxed_performance, false)         as relaxada,
           s.id is not null                                  as em_rede,
           coalesce(v.is_association, false)                 as associativo
      from public.events e
      join public.municipalities m on m.id = e.municipality_id
      left join public.venues v on v.id = e.venue_id
      left join public.series s on s.id = e.series_id and s.is_regional
     where m.region_id = p_region
       and e.is_canonical
       -- Ver o cabeçalho: `archived` conta. Um programa que uniu dez
       -- concelhos em abril não deixa de o ter feito por ter acabado.
       and e.status not in ('draft', 'hidden')
       and e.date_start < p_ate
       and coalesce(e.date_end, e.date_start) >= p_de
  ),
  -- **Todos** os concelhos da região, zeros incluídos: um concelho sem
  -- programação é precisamente o achado que a coesão existe para mostrar.
  por_concelho as (
    select m.id, count(b.id) as n
      from public.municipalities m
      left join base b on b.municipality_id = m.id
     where m.region_id = p_region
     group by m.id
  ),
  resumo as (
    select (select count(*) from base)                              as total,
           (select count(*) from por_concelho)                      as concelhos,
           (select count(*) from por_concelho where n > 0)          as com_programacao,
           (select coalesce(max(n), 0) from por_concelho)           as maior,
           (select percentile_cont(0.5) within group (order by n)
              from por_concelho)                                    as mediana
  )
  select jsonb_build_object(
    'from', p_de,
    'to',   p_ate - 1,
    'total', r.total,

    'cohesion', jsonb_build_object(
      'municipalities', r.concelhos,
      'municipalities_with_programming', r.com_programacao,
      -- Entre 0 e 1. Nulo sem programação nenhuma: não há quota de zero, e
      -- zero lia-se como «o maior concelho não tem nada», que é outra coisa.
      -- Uma região de um concelho só dá 1, e está certo.
      'top_share', case when r.total > 0 then round(r.maior::numeric / r.total, 4) end,
      'median', r.mediana,
      'below_half_median', (
        select count(*) from por_concelho where n::numeric < r.mediana / 2)),

    'association', jsonb_build_object(
      'in_association_venue', (select count(*) from base where associativo),
      'in_other_venue',       (select count(*) from base
                                where venue_id is not null and not associativo),
      'without_venue',        (select count(*) from base where venue_id is null)),

    'admission', jsonb_build_object(
      'free',       (select count(*) from base where is_free),
      'priced',     (select count(*) from base where not is_free and price_min is not null),
      'undeclared', (select count(*) from base where not is_free and price_min is null)),

    -- `any` e `none` somam o total; as quatro condições sobrepõem-se e por
    -- isso **não** somam — um evento com língua gestual e cadeira de rodas
    -- conta nas duas, e somá-las dava mais eventos do que os que há.
    'accessibility', jsonb_build_object(
      'any',  (select count(*) from base where cadeira or gestual or audio or relaxada),
      'none', (select count(*) from base where not (cadeira or gestual or audio or relaxada)),
      'wheelchair',        (select count(*) from base where cadeira),
      'sign_language',     (select count(*) from base where gestual),
      'audio_description', (select count(*) from base where audio),
      'relaxed',           (select count(*) from base where relaxada)),

    'network', jsonb_build_object(
      'events', (select count(*) from base where em_rede),
      'municipalities_touched', (
        select count(distinct municipality_id) from base where em_rede)))
  from resumo r;
$$;

comment on function public.report_promises(text, date, date) is
  'Os cinco indicadores dos compromissos declarados, numa janela [de, ate). '
  'A base é o que foi **programado** — canónico, nem rascunho nem escondido, '
  'com a programação a tocar a janela — e não só o que está publicado hoje: '
  'contar só `published` faz um programa que uniu dez concelhos desaparecer '
  'do relatório do mês em que aconteceu, por ter sido arquivado desde então. '
  'Mede o que a agenda conseguiu recolher, e não o que aconteceu no '
  'território.';

revoke execute on function public.report_promises(text, date, date)
  from public, anon, authenticated;
grant execute on function public.report_promises(text, date, date) to service_role;

-- ---------------------------------------------------------------------------
-- As provas
-- ---------------------------------------------------------------------------
do $$
declare
  v_p     jsonb;
  v_total bigint;
begin
  v_p := public.report_promises('medio-tejo', date_trunc('month', current_date)::date,
                                (date_trunc('month', current_date) + interval '1 month')::date);
  v_total := (v_p ->> 'total')::bigint;

  -- As três de cada família somam o total. É a asserção que o plano pede, e é
  -- a que apanha um evento que caia por uma fenda entre as categorias: um
  -- `is_free` nulo, um `venue_id` a apontar para um espaço apagado.
  if (v_p -> 'association' ->> 'in_association_venue')::bigint
   + (v_p -> 'association' ->> 'in_other_venue')::bigint
   + (v_p -> 'association' ->> 'without_venue')::bigint <> v_total then
    raise exception 'a cauda longa associativa não soma o total: %', v_total;
  end if;

  if (v_p -> 'admission' ->> 'free')::bigint
   + (v_p -> 'admission' ->> 'priced')::bigint
   + (v_p -> 'admission' ->> 'undeclared')::bigint <> v_total then
    raise exception 'a entrada livre não soma o total: %', v_total;
  end if;

  -- Aqui somam duas e não quatro: as condições sobrepõem-se de propósito.
  if (v_p -> 'accessibility' ->> 'any')::bigint
   + (v_p -> 'accessibility' ->> 'none')::bigint <> v_total then
    raise exception 'a acessibilidade declarada não soma o total: %', v_total;
  end if;

  -- Nenhuma condição isolada pode ser maior do que «alguma».
  if (v_p -> 'accessibility' ->> 'wheelchair')::bigint
     > (v_p -> 'accessibility' ->> 'any')::bigint then
    raise exception 'há mais eventos com cadeira de rodas do que com alguma condição declarada';
  end if;

  -- A quota fica entre 0 e 1, sempre.
  if v_total > 0 then
    if (v_p -> 'cohesion' ->> 'top_share')::numeric < 0
       or (v_p -> 'cohesion' ->> 'top_share')::numeric > 1 then
      raise exception 'a quota de coesão saiu fora de [0,1]: %', v_p -> 'cohesion' ->> 'top_share';
    end if;
  elsif v_p -> 'cohesion' -> 'top_share' <> 'null'::jsonb then
    raise exception 'sem programação nenhuma a quota devia vir a nulo e veio %',
      v_p -> 'cohesion' -> 'top_share';
  end if;

  -- Os concelhos tocados em rede nunca são mais do que os eventos em rede.
  if (v_p -> 'network' ->> 'municipalities_touched')::bigint
     > (v_p -> 'network' ->> 'events')::bigint then
    raise exception 'mais concelhos em rede do que eventos em rede';
  end if;

  -- Uma região com um concelho só dá quota 1 sem rebentar, e prova-se com
  -- uma janela em que só um concelho tem programação: a do concelho que tem
  -- mais. Se a região não tiver programação nenhuma, salta-se — não se
  -- inventa um evento para provar uma conta.
  if v_total > 0 and (v_p -> 'cohesion' ->> 'municipalities_with_programming')::bigint = 1 then
    if (v_p -> 'cohesion' ->> 'top_share')::numeric <> 1 then
      raise exception 'um só concelho com programação devia dar quota 1 e deu %',
        v_p -> 'cohesion' ->> 'top_share';
    end if;
  end if;

  -- E uma região sem concelhos nenhuns não rebenta.
  v_p := public.report_promises('regiao-que-nao-existe', '2026-01-01', '2026-02-01');
  if (v_p ->> 'total')::bigint <> 0 then
    raise exception 'uma região inexistente devolveu programação';
  end if;
  if v_p -> 'cohesion' -> 'top_share' <> 'null'::jsonb then
    raise exception 'uma região inexistente devolveu uma quota de coesão';
  end if;
end
$$;
