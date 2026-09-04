-- 0083 — Os espaços religiosos saem do catálogo.
--
-- Decisão do dono. São dois, e nenhum tem programação nenhuma:
--
--   · **Santuário de Nossa Senhora do Rosário de Fátima** (Ourém)
--   · **Igreja da Misericórdia de Tomar**
--
-- Zero eventos cada um, hoje e desde sempre. Estavam no catálogo por serem
-- equipamentos conhecidos da região, não por alguma coisa acontecer neles que
-- esta agenda publique — e no caso de Fátima isso é coerente com uma regra que
-- já existia: as celebrações diárias do santuário não entram na agenda. Um
-- espaço que nunca vai receber uma linha de programação é uma ficha que não
-- serve quem procura o que há para fazer.
--
-- Apaga-se em vez de fechar: `status = 'closed'` quer dizer que a casa fechou
-- portas, e nem o santuário nem a igreja fecharam. Dizer que fecharam para os
-- esconder seria pôr na base uma coisa falsa por conveniência de apresentação.
--
-- Não fica nenhuma restrição a impedir que um espaço religioso volte, e isso é
-- deliberado. Em Portugal há muita música dentro de igrejas — coros, órgão,
-- ciclos de música sacra —, e no dia em que uma igreja do Médio Tejo tiver
-- programação a sério, ela tem lugar aqui como qualquer outro palco. O que sai
-- hoje são estas duas fichas vazias, não a categoria.
--
-- A remoção é segura: as chaves estrangeiras que apontam a `venues` são todas
-- `on delete set null` menos a dos alias, que é `cascade` — os dois alias de
-- cada um caem com ele. E com zero eventos não há sequer nada para anular.
-- Ainda assim, a remoção fica guardada pela condição de não haver programação:
-- se algum evento se tiver ligado entretanto, nada se apaga e a asserção final
-- rebenta, que apagar um espaço com programação seria apagar programação.
--
-- **A fonte de Fátima fica, e o seu `venue_id` fica a nulo.** A primeira versão
-- desta migração também travava em fontes ligadas, e a asserção disparou — bem
-- disparada, porque mostrou uma coisa que era preciso ver: existe uma fonte
-- `fatima-eventos`, desligada, cujas notas guardam a decisão do dono de 29 de
-- agosto de 2026 («as celebrações diárias não entram») e o resultado da
-- sondagem técnica que a acompanhou. Esse registo é a razão pela qual o
-- santuário não é recolhido, e apagá-lo seria apagar a decisão.
--
-- Mas uma fonte desligada não é programação, e travar por causa dela era
-- confundir as duas coisas. A guarda passa a ser sobre o que de facto se
-- perderia: eventos, sessões, submissões em curso e a ligação de um coreto. A
-- fonte sobrevive inteira — nome, endereço, notas, decisão —, com o `venue_id`
-- a nulo porque o espaço deixou de existir no catálogo, que é a verdade. A
-- página das fontes já sabe ler uma fonte sem espaço: filtra os nulos antes de
-- ir buscar os nomes.

delete from public.venues v
where v.kind = 'religious'
  and not exists (select 1 from public.events e where e.venue_id = v.id)
  and not exists (select 1 from public.event_sessions s where s.venue_id = v.id)
  and not exists (select 1 from public.submissions m where m.venue_id = v.id)
  and not exists (select 1 from public.coretos c where c.venue_id = v.id);

do $$
declare
  restantes integer;
  nomes     text;
begin
  select count(*), string_agg(name, ', ' order by name)
    into restantes, nomes
  from public.venues where kind = 'religious';

  if restantes <> 0 then
    raise exception
      '% espaços religiosos ficaram por retirar (%) — têm programação ou fonte ligada, e não se apaga por cima disso',
      restantes, nomes;
  end if;

  raise notice 'o catálogo ficou sem espaços religiosos';
end
$$;
