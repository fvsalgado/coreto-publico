-- 0053 — A agenda ordena-se pelo que está a acabar.
--
-- A agenda ordenava por `date_start`, e isso punha a primeira página inteira
-- ocupada por exposições. Trinta dos setenta e três eventos publicados já
-- tinham aberto; como abriram em maio, junho e julho, ordenados pela data de
-- início ficavam todos à frente — e quem abria a agenda para ver o que há
-- este fim de semana via trinta exposições antes do primeiro concerto.
--
-- A ordem certa não é a da estreia: é a do próximo dia que interessa a quem
-- lê. Para um evento que ainda não começou, é o dia em que abre. Para um que
-- já está a decorrer, é o dia em que fecha — porque é isso que decide se
-- ainda dá tempo de lá ir.
--
-- `coalesce(date_end, date_start)` dá as duas coisas ao mesmo tempo, e dá-as
-- numa coluna gerada, que o índice sabe ordenar e o PostgREST sabe pedir. Um
-- evento de um dia mantém-se no seu dia. Uma exposição vai para o dia em que
-- fecha. Um festival de três dias escorrega dois dias para a frente, o que é
-- o preço, e é pequeno.
--
-- O preço podia ser grande num caso: uma exposição que abre em setembro e só
-- fecha em dezembro iria para dezembro, longe da sua estreia. Foram contados:
-- dos quarenta e três eventos futuros do catálogo, **zero** duram mais de
-- trinta dias. Hoje este caso não existe. Se um dia existir, aparece na
-- agenda mais tarde do que devia — e o sítio para o corrigir é aqui.

alter table public.events
  add column if not exists agenda_date date
  generated always as (coalesce(date_end, date_start)) stored;

comment on column public.events.agenda_date is
  'O próximo dia que interessa a quem lê: a estreia de um evento que ainda não abriu, o fecho de um que já está a decorrer. É por aqui que a agenda ordena.';

create index if not exists events_agenda_date_idx
  on public.events (agenda_date)
  where status = 'published' and is_canonical;

-- ---------------------------------------------------------------------------
do $$
declare
  v_errado integer;
begin
  -- A coluna é gerada, por isso não pode divergir — mas se alguém trocar a
  -- expressão numa migração futura, é aqui que se dá por isso.
  select count(*) into v_errado from public.events
    where agenda_date is distinct from coalesce(date_end, date_start);
  if v_errado > 0 then
    raise exception '% eventos com agenda_date fora do que a expressão manda', v_errado;
  end if;

  -- Um evento datado tem de ter dia de agenda. Sem ele cai para o fim da
  -- lista com os que não têm data nenhuma, e desaparece sem ninguém reparar.
  select count(*) into v_errado from public.events
    where date_start is not null and agenda_date is null;
  if v_errado > 0 then
    raise exception '% eventos com data de início e sem dia de agenda', v_errado;
  end if;
end
$$;
