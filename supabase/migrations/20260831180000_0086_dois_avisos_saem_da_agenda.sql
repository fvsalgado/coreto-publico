-- 0086 — Dois avisos municipais saem da agenda, e o detetor aprende-os.
--
-- Decisão do dono, a 31 de agosto. São dois, e nenhum é programação cultural:
--
--   · **Vacinação Antirrábica** — Serra, Tomar, 12 de agosto, sem descrição;
--   · **Campanha de Sensibilização para o Bem-Estar Animal** — Assentiz,
--     Torres Novas, 23 de julho: «Cuidar do seu animal é um compromisso.»
--
-- Entraram pela recolha porque estão nas agendas das juntas, e as juntas
-- misturam ali o que anunciam à população. Não têm sala, nem hora a que se
-- chegue tarde, nem nada a que se assista — o que os torna avisos de serviço
-- público, e não uma noite a que alguém vai.
--
-- Ficam `hidden` e não apagados, como os dois de Mação em agosto: o registo
-- continua na base, com a data e a fonte, e reverte-se num instante se o dono
-- discordar. O `status` fica trancado em `manual_overrides`, sem o que a
-- recolha seguinte os republicava — foi o que a 0073 já teve de fazer.
--
-- ## E o detetor aprende, que é a parte que dura
--
-- Escondê-los sem mais era resolver hoje e voltar a acontecer na próxima
-- campanha. `looksLikeMunicipalNotice` passa a conhecer dois padrões:
--
--   · **`vacinacao` em início de título.** Um título que começa por
--     «Vacinação» é um aviso de saúde pública, e não há programação cultural
--     que comece assim. Em início de título e não em qualquer ponto, pela
--     mesma razão que «aviso» já era só prefixo: «O Ensaio Geral da
--     Vacinação» é uma peça, e passa.
--   · **`campanha de sensibilização` em qualquer ponto.** A expressão
--     inteira, e não «campanha» sozinha — uma campanha de recolha de livros é
--     programação de biblioteca, e essa tem de passar.
--
-- O detetor não apaga nem recusa: manda o candidato à fila de moderação com o
-- motivo à vista, e quem modera decide. É por isso que uma expressão a mais
-- na rede custa uma decisão, e uma a menos custa um aviso publicado.

update public.events set status = 'hidden', updated_at = now()
where status = 'published'
  and (
    (source_id = 'jf-serra'    and source_key = 'evento-1'  and title = 'Vacinação Antirrábica') or
    (source_id = 'jf-assentiz' and source_key = 'evento-42' and title = 'Campanha de Sensibilização para o Bem-Estar Animal')
  );

insert into public.manual_overrides (event_id, field, value, actor, note)
select id, 'status', to_jsonb('hidden'::text), 'decisão do dono 2026-08-31',
       'Aviso municipal de serviço público, não é programação cultural. '
       'O detetor `looksLikeMunicipalNotice` passa a reconhecê-lo a partir da 0086.'
from public.events
where status = 'hidden'
  and (
    (source_id = 'jf-serra'    and source_key = 'evento-1'  and title = 'Vacinação Antirrábica') or
    (source_id = 'jf-assentiz' and source_key = 'evento-42' and title = 'Campanha de Sensibilização para o Bem-Estar Animal')
  )
on conflict (event_id, field) do nothing;

update public.events e set has_manual_overrides = true
where exists (select 1 from public.manual_overrides o where o.event_id = e.id)
  and not e.has_manual_overrides;

-- ---------------------------------------------------------------------------
do $$
declare
  ainda_publicados integer;
  sem_bloqueio     integer;
begin
  -- Postcondição, e não contagem do dia: numa base vazia passa em silêncio.
  select count(*) into ainda_publicados
  from public.events
  where status = 'published'
    and title in ('Vacinação Antirrábica', 'Campanha de Sensibilização para o Bem-Estar Animal');

  if ainda_publicados > 0 then
    raise exception '% avisos continuam publicados', ainda_publicados;
  end if;

  select count(*) into sem_bloqueio
  from public.events e
  where e.status = 'hidden'
    and e.title in ('Vacinação Antirrábica', 'Campanha de Sensibilização para o Bem-Estar Animal')
    and not exists (
      select 1 from public.manual_overrides o where o.event_id = e.id and o.field = 'status'
    );

  if sem_bloqueio > 0 then
    raise exception
      '% avisos ficaram escondidos sem o estado trancado — a próxima recolha republicava-os', sem_bloqueio;
  end if;
end
$$;
