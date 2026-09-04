-- 0033 — Abrantes liga-se: o pedido foi feito, e a resposta foi sim.
--
-- A 0022 desligou esta fonte com a razão escrita: a API do site municipal
-- (uma aplicação Flutter servida por sitecmaproxy.cm-abrantes.pt) responde
-- 403 «Origem não autorizada» a quem não envie o cabeçalho `Origin` do
-- próprio site, e contornar um controlo de acesso sem autorização não se
-- faz. A posição era essa e mantém-se.
--
-- O que mudou não foi a técnica — foi a autorização. **A Câmara Municipal de
-- Abrantes autorizou expressamente o Coreto a recolher a agenda por qualquer
-- via técnica** (comunicado pelo editor do projeto a 2026-08-28). Com a
-- autorização, enviar o cabeçalho que a API espera deixa de ser contorno e
-- passa a ser o modo de acesso combinado.
--
-- E vale a pena: é das fontes mais ricas do território — datas de início e
-- fim, hora, local, área temática, descrição, promotor, público-alvo e
-- cartaz, com um endpoint de detalhe por evento. O adaptador
-- `abrantes-proxy` lê a lista (hoje + futuro + passado recente, para a
-- reconciliação não confundir «já aconteceu» com «desapareceu») e visita o
-- detalhe dos eventos por vir.

update public.sources
   set adapter = 'abrantes-proxy',
       config = jsonb_build_object('originHeader', 'https://www.cm-abrantes.pt'),
       is_enabled = true,
       -- Quem liga uma fonte declara o mínimo (regra dos schema-checks). A
       -- sondagem de 2026-08-28 trouxe 3 eventos de hoje e 9 futuros: abaixo
       -- de 3, ou a agenda esvaziou ou o proxy mudou — e quer-se saber.
       min_expected_items = 3,
       -- O disjuntor pode ter aberto enquanto a fonte falhava por 403.
       consecutive_failures = 0,
       circuit_open_until = null,
       notes = 'Recolha AUTORIZADA pela Câmara Municipal de Abrantes '
            || '(comunicação ao editor do projeto, agosto de 2026): a API do '
            || 'site municipal verifica o cabeçalho Origin e o adaptador '
            || 'envia o do próprio site, conforme combinado. Ligada a '
            || '2026-08-28; histórico do 403 na 0022.',
       updated_at = now()
 where id = 'cm-abrantes';

do $$
declare
  v_fonte record;
begin
  select adapter, is_enabled, config ->> 'originHeader' as origin
    into v_fonte
    from public.sources
   where id = 'cm-abrantes';

  if v_fonte is null then
    raise exception 'a fonte cm-abrantes desapareceu';
  end if;
  if v_fonte.adapter <> 'abrantes-proxy' or not v_fonte.is_enabled then
    raise exception 'cm-abrantes devia estar ligada ao abrantes-proxy';
  end if;
  if v_fonte.origin <> 'https://www.cm-abrantes.pt' then
    raise exception 'cm-abrantes sem originHeader — o adaptador recusa correr sem ele';
  end if;
end
$$;
