-- 0088 — Onze eventos deixam de dizer que são para todas as idades.
--
-- O leitor de público lia a palavra **«todos»** solta, em qualquer ponto do
-- texto, como uma declaração sobre idades. Não é. Ela aparece assim:
--
--   · «Levantamento do bilhete no Posto de Turismo (**todos** os dias, das
--     10h00 às 13h00…)» — Festival Z, Ferreira do Zêzere;
--   · «**todos** os concertos têm entrada livre» — Fins de Tarde na Vila
--     Medieval, Ourém;
--   · «são convidados **todos** os naturais desta freguesia» — Almoço dos
--     Idosos, Martinchel.
--
-- Nenhuma fala de idades, e o almoço dos idosos estava publicado como
-- programação para todas as idades. **Onze dos trinta e cinco** eventos com
-- essa etiqueta tinham-na só por causa da palavra solta: nenhum deles diz
-- «todas as idades», «todos os públicos», «para todos», «público em geral»
-- nem «público geral» em lado nenhum.
--
-- É o mesmo erro que o classificador de categorias evita de propósito, e o
-- ficheiro dele já o tinha escrito: «a descrição menciona "concerto" em metade
-- dos eventos que não são concertos». Uma palavra comum num texto longo não é
-- uma declaração sobre o evento.
--
-- ## E a barra de idade sobe na ordem
--
-- Havia um segundo defeito, do mesmo tipo mas ao contrário. O leitor decidia
-- primeiro pelas palavras e só depois pela idade — e por isso um espetáculo
-- **M/16** saía marcado «para todas as idades» quando a página dizia «todos»
-- em qualquer sítio. Uma classificação etária é a bilheteira a dizer que
-- menores não entram; linguagem de cartaz não a desmente. A barra passa à
-- frente das palavras, e só as escolas ficam antes dela — uma sessão marcada
-- para escolas é uma sessão fechada, e isso manda sobre o resto.
--
-- ## Porque é preciso apagar, e não só corrigir a regra
--
-- A regra corrigida só age na próxima recolha, e mesmo aí não chegaria aqui:
-- `mergeEventUpdate` nunca substitui um valor preenchido por um vazio — é a
-- regra que impede uma noite com o seletor partido de apagar as descrições de
-- um concelho inteiro. Um `audience` errado já escrito ficava lá para sempre,
-- porque a leitura nova traz vazio e o vazio não escreve. É a mesma razão pela
-- qual a 0079 teve de limpar à mão o estado que a correção do código não
-- alcançava.
--
-- Fica a nulo, e não noutra etiqueta: não se sabe qual é o público destes
-- onze, e inventá-lo era repetir o erro noutra direção.

update public.events set audience = null, updated_at = now()
where audience = 'all_ages'
  and coalesce(description, '') ~* '\mtodos\M'
  and coalesce(description, '') !~* 'todas as idades|todos os p.blicos|p.blico em geral|p.blico geral|para todos\M'
  and coalesce(accessibility_notes, '') !~* 'todas as idades|todos os p.blicos|p.blico em geral|p.blico geral|para todos\M';

-- E o que já tinha barra de idade passa a dizê-lo. «Corpo Suspenso», do
-- CAMINHOS, estava «para todas as idades» com `min_age` 16 — as duas coisas
-- na mesma linha, e a contradição à vista de quem lesse.
update public.events set audience = 'adults', updated_at = now()
where audience = 'all_ages' and min_age is not null and min_age >= 16;

-- ---------------------------------------------------------------------------
do $$
declare
  contraditorios integer;
  soltos         integer;
begin
  -- Postcondições: numa base vazia passam em silêncio, que é o que devem.
  select count(*) into contraditorios
  from public.events
  where audience = 'all_ages' and min_age is not null and min_age >= 16;

  if contraditorios > 0 then
    raise exception
      '% eventos continuam «para todas as idades» com barra de 16 anos ou mais', contraditorios;
  end if;

  -- A asserção é sobre o que esta migração estabelece, e não mais.
  --
  -- A primeira versão exigia que **todo** o «para todas as idades» tivesse a
  -- frase na descrição, e rebentou com dezasseis — que estavam certos. Esses
  -- vêm do campo de público da própria fonte: o `publicoAlvo` de Abrantes diz
  -- «Para todos os públicos», o CAMINHOS e Ourém têm campo equivalente, e
  -- nenhum deles é guardado em coluna nenhuma. Exigir a prova na base era
  -- exigi-la onde ela nunca esteve.
  --
  -- O que se afirma é o que se fez: nenhum evento fica «para todas as idades»
  -- **por causa de um «todos» solto na descrição** e de mais nada.
  select count(*) into soltos
  from public.events
  where audience = 'all_ages'
    and coalesce(description, '') ~* '\mtodos\M'
    and coalesce(description, '') !~* 'todas as idades|todos os p.blicos|p.blico em geral|p.blico geral|para todos\M'
    and coalesce(accessibility_notes, '') !~* 'todas as idades|todos os p.blicos|p.blico em geral|p.blico geral|para todos\M';

  if soltos > 0 then
    raise exception
      '% eventos ficaram «para todas as idades» por causa de um «todos» solto', soltos;
  end if;
end
$$;
