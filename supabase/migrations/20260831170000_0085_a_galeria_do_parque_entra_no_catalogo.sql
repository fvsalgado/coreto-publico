-- 0085 — A Galeria do Parque entra no catálogo, e não é o parque.
--
-- Oitenta e um dos cento e quarenta eventos publicados não têm espaço do
-- catálogo. A pergunta era quantos deles são ligáveis, e a resposta é uma só
-- ficha — mas essa é preciso criá-la primeiro.
--
-- ## O que o levantamento mediu
--
-- Pelo nome, com a mesma normalização que a recolha usa: **zero**. Nenhum dos
-- oitenta e um nomes de local casa com um espaço ou um alias do concelho.
--
-- Pela fila de trabalho: **zero também**. A vista
-- `unresolved_venues_pendentes`, que é a fila descontada do que já foi
-- resolvido, está vazia — as dezassete linhas que ainda restam na tabela em
-- bruto têm todas alias, e a vista da 0067 já as esconde. A fila fez o
-- trabalho dela.
--
-- Lendo um a um: os oitenta e um estão em praças, largos, jardins, praias
-- fluviais, estádios, sedes de junta e sedes de associação — ou trazem só o
-- nome da terra. «Torres Novas» aparece catorze vezes, porque os eventos que
-- entraram pelos instantâneos não trouxeram sala. E a regra da casa é a que
-- está escrita no inventário: **o catálogo é das casas da cultura; um largo
-- não é uma casa.** Ligá-los era inventar uma morada.
--
-- ## A excepção, e o erro que ela quase provocou
--
-- Sobra uma: «Exposição "ESCULTURA. TRANSMUTAÇÃO", Coleção de Arte Fundação
-- EDP», em Vila Nova da Barquinha, com o local escrito «Galeria do Parque».
-- Essa é uma casa da cultura a sério — e não estava no catálogo.
--
-- O atalho óbvio era pô-la como alias do Parque de Escultura Contemporânea
-- Almourol, que já lá está e tem «Parque» no nome. **Seria errado.** A Galeria
-- do Parque foi inaugurada em 2012 como espaço complementar ao parque de
-- escultura, mas ocupa o piso térreo dos Paços do Concelho, na Praça da
-- República — a cento e cinquenta metros do parque, que fica no Largo 1.º de
-- Dezembro. O alias punha a exposição no sítio errado do mapa, e um ponto
-- errado é pior do que ponto nenhum: quem o segue vai lá e não encontra.
--
-- É o mesmo engano que já tinha aparecido neste levantamento noutra forma. «A
-- Arte do Calafate» nomeia o Museu dos Rios e das Artes Marítimas na
-- descrição, mas só como sítio da inscrição — a oficina é no Estaleiro do Rio
-- Tejo. Um nome de espaço dentro de um texto não é o mesmo que o espaço onde a
-- coisa acontece, e a diferença só se vê a ler.
--
-- ## O que se sabe da Galeria, e o que fica por saber
--
-- Espaço de exposições do município em parceria com a Fundação EDP, aberto em
-- 2012, com arte contemporânea nacional — escultura, pintura, fotografia e
-- vídeo. A exposição que está no catálogo é da Coleção de Arte da Fundação
-- EDP, o que confirma a ligação pelos dois lados.
--
-- O código postal fica vazio de propósito: a ficha da TUR4all dá 2260-408, o
-- OSM dá 2260-438 para a praça, e não se escolhe entre dois à sorte. A morada
-- e a coordenada chegam para lá ir, e a coordenada está confirmada por duas
-- vias no OSM (a pesquisa pela câmara municipal e a geocodificação inversa do
-- ponto devolvem ambas os Paços do Concelho, na Praça da República).
--
-- E fica um aviso para quem lá voltar: o `barquinhaearte.pt`, que a ficha da
-- TUR4all indica como sítio da galeria, já não serve a galeria — responde uma
-- página genérica sobre arte. O endereço que fica é o do turismo municipal,
-- que é o mesmo padrão que o Castelo de Almourol já usa.
--
-- O alias fica **preso ao concelho**. «Galeria do Parque» é um nome que
-- qualquer município com um parque pode ter, e um alias regional era uma
-- armadilha à espera do próximo concelho.

insert into public.venues (
  id, name, short_name, municipality_id, parish, kind, address,
  latitude, longitude, phone, email, website_url, description, notes
) values (
  'galeria-do-parque',
  'Galeria do Parque',
  null,
  'vila-nova-da-barquinha',
  'Vila Nova da Barquinha',
  'gallery',
  'Paços do Concelho, Praça da República',
  39.458157,
  -8.431104,
  '+351 249 720 350',
  'galeria@cm-vnbarquinha.pt',
  'https://visitbarquinha.pt/o-que-fazer/galeria-do-parque/',
  'Galeria municipal de arte contemporânea, aberta em 2012 no piso térreo '
  'dos Paços do Concelho. Programa exposições temporárias de escultura, '
  'pintura, fotografia e vídeo em parceria com a Fundação EDP, que assegura '
  'a curadoria. É complementar ao Parque de Escultura Contemporânea Almourol, '
  'mas fica noutro edifício, do outro lado da vila. Entrada livre.',
  'Levantamento 2026-08-31: entrou pelo evento «ESCULTURA. TRANSMUTAÇÃO», da '
  'Coleção de Arte Fundação EDP, que a agenda municipal dava com o local '
  '«Galeria do Parque» e sem espaço do catálogo. Horário publicado: 3.ª a 6.ª '
  '11:00–13:00 e 15:00–18:00, sáb. 15:00–19:00, encerra dom. e 2.ª. Código '
  'postal por confirmar — a TUR4all dá 2260-408 e o OSM dá 2260-438 para a '
  'praça; fica vazio até haver fonte primária. Coordenada confirmada por duas '
  'vias no OSM: a pesquisa por «Câmara Municipal de Vila Nova da Barquinha» e '
  'a geocodificação inversa de 39.458157,-8.431104 devolvem ambas os Paços do '
  'Concelho, na Praça da República. NÃO confundir com o Parque de Escultura '
  'Contemporânea Almourol (Largo 1.º de Dezembro), que está a 148 m e é outra '
  'ficha — o alias cruzado punha a exposição no ponto errado do mapa. O '
  'barquinhaearte.pt, que a TUR4all indica como sítio da galeria, já não a '
  'serve.'
)
on conflict (id) do nothing;

-- Preso ao concelho: «Galeria do Parque» é um nome que se repete.
insert into public.venue_aliases (alias, venue_id, municipality_id) values
  (public.normalize_for_hash('Galeria do Parque'), 'galeria-do-parque', 'vila-nova-da-barquinha')
on conflict do nothing;

-- E o evento que a provou existir. Sem bloqueio: o alias resolve isto sozinho
-- na próxima recolha, e é ele que tem de durar, não uma correção à mão.
update public.events e set venue_id = 'galeria-do-parque', updated_at = now()
from public.venue_aliases a
where a.venue_id = 'galeria-do-parque'
  and e.venue_id is null
  and e.location_name is not null
  and public.normalize_for_hash(e.location_name) = a.alias
  and e.municipality_id = a.municipality_id;

-- ---------------------------------------------------------------------------
do $$
declare
  ponto_do_parque   record;
  ponto_da_galeria  record;
  metros            numeric;
  orfaos            integer;
begin
  select latitude, longitude into ponto_da_galeria
  from public.venues where id = 'galeria-do-parque';

  select latitude, longitude into ponto_do_parque
  from public.venues where id = 'parque-escultura-almourol';

  -- As duas fichas são de sítios diferentes, e a prova é a distância. Se
  -- alguém as fundir um dia, esta linha rebenta antes de a exposição ir parar
  -- ao ponto errado do mapa. (Aproximação plana, que a 150 m chega e sobra.)
  if ponto_do_parque.latitude is not null and ponto_da_galeria.latitude is not null then
    metros := 111320 * sqrt(
      power(ponto_da_galeria.latitude - ponto_do_parque.latitude, 2) +
      power((ponto_da_galeria.longitude - ponto_do_parque.longitude)
            * cos(radians(ponto_da_galeria.latitude)), 2)
    );
    if metros < 50 then
      raise exception
        'a Galeria do Parque e o parque de escultura ficaram no mesmo ponto (% m) — são espaços diferentes',
        round(metros);
    end if;
    raise notice 'Galeria do Parque a % m do parque de escultura', round(metros);
  end if;

  -- Postcondição: nada que nomeie a galeria fica sem a ficha dela.
  select count(*) into orfaos
  from public.events e
  where e.status = 'published'
    and e.venue_id is null
    and e.location_name is not null
    and public.normalize_for_hash(e.location_name) = public.normalize_for_hash('Galeria do Parque')
    and e.municipality_id = 'vila-nova-da-barquinha';

  if orfaos > 0 then
    raise exception '% eventos continuam a dizer «Galeria do Parque» sem ficha ligada', orfaos;
  end if;
end
$$;
