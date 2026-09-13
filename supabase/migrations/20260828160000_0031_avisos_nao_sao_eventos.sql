-- 0031 — Avisos municipais não são eventos.
--
-- A primeira recolha a sério de Tomar trouxe, publicou e manteve no ar a
-- «Piscina Municipal Vasco Jacob» (o horário da época de banhos) e a «Fábrica
-- das Artes | Tomar» (a brochura anual das oficinas municipais). Nenhum dos
-- dois é um evento: são informação municipal que a câmara publica na mesma
-- agenda de onde vem a programação.
--
-- A resposta tem duas partes, e esta migração é a segunda:
--
--   1. No código, `looksLikeMunicipalNotice` (em `@coreto/core`) reconhece o
--      padrão — piscinas, época balnear, horários, editais, reuniões de
--      câmara — e manda o candidato NOVO para a fila de moderação em vez de o
--      publicar. Nunca despublica nada: essa decisão é de quem modera.
--   2. Aqui, o que uma pessoa já decidiu fica escrito na fonte:
--      `config.excludeTitles` é a lista de títulos que esta fonte publica na
--      agenda e que não são eventos. A recolha salta-os sem gastar a fila com
--      a mesma pergunta todas as noites.
--
-- Os dois eventos foram arquivados em produção a 2026-08-28 pela função
-- auditada (`set_event_status`), com `archived_reason` a dizer porquê. Esta
-- migração garante que não voltam a entrar.

update public.sources
   set config = config || jsonb_build_object(
         'excludeTitles',
         jsonb_build_array('piscina municipal', 'fábrica das artes')
       ),
       notes = coalesce(notes || ' ', '')
            || 'A agenda desta câmara mistura avisos com programação: '
            || '«Piscina Municipal…» e «Fábrica das Artes…» estão excluídos '
            || 'por decisão editorial de 2026-08-28.',
       updated_at = now()
 where id = 'cm-tomar';

do $$
declare
  v_excluded jsonb;
begin
  select config -> 'excludeTitles' into v_excluded
    from public.sources where id = 'cm-tomar';

  if v_excluded is null or jsonb_array_length(v_excluded) < 2 then
    raise exception 'cm-tomar devia ter pelo menos duas exclusões e tem %', v_excluded;
  end if;
end
$$;
