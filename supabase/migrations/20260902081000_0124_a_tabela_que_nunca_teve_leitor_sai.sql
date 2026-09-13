-- 0124 — A tabela que nunca teve leitor sai.
--
-- A 1 de setembro de 2026, às 09:36, correu em produção, pela API do
-- Supabase, uma migração chamada «0099_um_alias_deixa_de_valer_onde_nao_
-- merece». Criava `public.category_alias_ignores` — pares (fonte, alias) em
-- que uma fonte perde o crédito pela sua própria etiqueta — e punha-lhe uma
-- linha: cm-tomar e «eventos-literarios», porque a câmara etiquetava assim
-- um samba e uma exposição de pintura. A ideia era o harmonizador saltar a
-- etiqueta e passar ao título.
--
-- O ficheiro nunca chegou ao repositório, e o harmonizador nunca aprendeu a
-- ler a tabela: `resolveCategory` não a conhece, e o caso que ela cobria
-- resolveu-se à mão na 0087, evento a evento. Ficou em produção uma tabela
-- que nenhum código lê, e no repositório uma base que nunca a teve. A
-- conciliação do registo de migrações (`scripts/conciliar-registo.sh`)
-- encontrou a linha sem ficheiro.
--
-- Uma base nova e a de produção têm de ser a mesma base. Das duas maneiras
-- de as juntar — trazer a tabela para o repositório, com o leitor que nunca
-- teve, ou tirá-la de produção — fica a segunda: a decisão de ignorar uma
-- etiqueta numa fonte, se voltar a fazer falta, escreve-se nessa altura,
-- com o código que a lê ao lado. `if exists`, porque numa base construída
-- do repositório não há nada para tirar.

drop table if exists public.category_alias_ignores;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'category_alias_ignores'
  ) then
    raise exception 'category_alias_ignores continua na base';
  end if;
end
$$;
