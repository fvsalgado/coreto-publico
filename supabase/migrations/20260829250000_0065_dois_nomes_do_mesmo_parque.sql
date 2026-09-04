-- 0065 — Dois nomes do mesmo parque
--
-- Ao ligar eventos a espaços com o levantamento de moradas sobraram dois casos
-- em que o nome que a fonte publica é um nome do espaço que já está no
-- catálogo — só não é o nome pelo qual ele lá está.
--
--   * «AQUAPOLIS – Margem Norte», em Abrantes. O Aquapolis são quinze
--     hectares nas duas margens do Tejo entre as pontes, e a própria ficha do
--     espaço diz que «abrange as duas margens (Parque Norte e Parque Sul)». A
--     margem é uma parte do parque, e não outro parque.
--   * «Parque Ribeirinho de Vila Nova da Barquinha». A morada do espaço, na
--     ficha, é literalmente «Barquinha Parque — Parque Ribeirinho de Vila Nova
--     da Barquinha, Largo 1.º de Dezembro». São o mesmo sítio com dois nomes,
--     um deles o da câmara e outro o do parque de escultura lá dentro.
--
-- **O que se escreve é o alias, e não só o `venue_id`.** Corrigir o evento à
-- mão resolvia o evento de hoje; o alias resolve todos os que a mesma fonte
-- publicar com o mesmo nome — que é o que vai acontecer, porque a câmara não
-- vai mudar de vocabulário por nossa causa. É a diferença entre limpar e
-- consertar.
--
-- E por isso **não se bloqueia nada**. Um bloqueio manual existe para proteger
-- o que uma pessoa decidiu contra o que a fonte insiste em dizer; aqui não há
-- discordância nenhuma — a partir do alias, a recolha chega sozinha à mesma
-- resposta. Bloquear seria trancar a porta que se acabou de abrir.

begin;

insert into public.venue_aliases (alias, venue_id) values
  (public.normalize_for_hash('AQUAPOLIS – Margem Norte'), 'aquapolis-abrantes'),
  (public.normalize_for_hash('AQUAPOLIS – Margem Sul'), 'aquapolis-abrantes'),
  (public.normalize_for_hash('Parque Ribeirinho de Vila Nova da Barquinha'),
   'parque-escultura-almourol')
on conflict (alias) do nothing;

-- E os dois eventos que já estão cá dentro, que a recolha só voltaria a tocar
-- quando a fonte mudasse alguma coisa neles.
update public.events
   set venue_id = 'aquapolis-abrantes', updated_at = now()
 where slug = 'um-dia-no-fundo-do-mar-1f0b65'
   and venue_id is null and municipality_id = 'abrantes';

update public.events
   set venue_id = 'parque-escultura-almourol', updated_at = now()
 where slug = 'insuflaveis-no-parque-7e3995'
   and venue_id is null and municipality_id = 'vila-nova-da-barquinha';

-- ---------------------------------------------------------------------------
-- O que tem de continuar verdade.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  select count(*) into n from public.venue_aliases
   where alias in (
     public.normalize_for_hash('AQUAPOLIS – Margem Norte'),
     public.normalize_for_hash('AQUAPOLIS – Margem Sul'),
     public.normalize_for_hash('Parque Ribeirinho de Vila Nova da Barquinha')
   );
  assert n = 3, format('esperavam-se três alias novos, há %s', n);

  -- A regra da 0064 continua de pé: nenhum evento num espaço de outro concelho.
  select count(*) into n
    from public.events e join public.venues v on v.id = e.venue_id
   where e.municipality_id is distinct from v.municipality_id;
  assert n = 0, format('%s eventos estão num espaço de outro concelho', n);

  -- E nenhum alias pode apontar para um espaço que não existe.
  select count(*) into n
    from public.venue_aliases a
    left join public.venues v on v.id = a.venue_id
   where v.id is null;
  assert n = 0, format('%s alias apontam para um espaço que não existe', n);
end $$;

commit;
