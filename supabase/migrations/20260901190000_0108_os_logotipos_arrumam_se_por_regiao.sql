-- 0108 — Os logótipos arrumam-se por região.
--
-- Os ficheiros do Médio Tejo mudaram de `public/logos/` para
-- `public/logos/medio-tejo/` no mesmo PR: com mais do que uma região, uma
-- pasta rasa era uma colisão de nomes à espera de acontecer, e o guia da
-- CIM nova manda cada uma para a sua pasta. Os caminhos guardados na linha
-- da região têm de acompanhar os ficheiros — um caminho que aponta para onde
-- o ficheiro já não está é um logótipo partido no toldo de todas as páginas.
--
-- Vai em migração e não num UPDATE de ocasião pela mesma razão de sempre:
-- uma base reconstruída só a partir deste repositório tem de apontar para os
-- ficheiros que este repositório traz.

update public.regions
   set logo_on_graphite_path = '/logos/medio-tejo/cim-branco.png',
       logo_on_brand_path    = '/logos/medio-tejo/cim-escuro.png',
       funding_logo_path     = '/logos/medio-tejo/cofinanciamento-centro-2030.png'
 where id = 'medio-tejo';
