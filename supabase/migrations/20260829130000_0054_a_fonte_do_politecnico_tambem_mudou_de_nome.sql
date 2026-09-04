-- 0054 — A fonte do politécnico também mudou de nome.
--
-- A 0052 corrigiu o nome do espaço para «Universidade Politécnica de Tomar»,
-- que é a designação oficial desde 1 de agosto de 2026. Ficou de fora a fonte
-- que a 0051 tinha criado com o nome antigo — e é essa que aparece escrita na
-- página das fontes, ao lado do endereço da agenda.
--
-- Um nome corrigido em metade dos sítios é um nome que continua errado onde
-- se lê.

update public.sources
   set name = 'Universidade Politécnica de Tomar — agenda',
       updated_at = now()
 where id = 'ipt-agenda';

do $$
declare
  v_antigo integer;
begin
  select count(*) into v_antigo from public.sources
    where name ilike '%Instituto Politécnico de Tomar%';
  if v_antigo > 0 then
    raise exception '% fontes ainda com o nome antigo do politécnico', v_antigo;
  end if;
end
$$;
