-- 0066 — Um alias pode ser de um concelho só.
--
-- `venue_aliases` nasceu com o nome por chave primária: uma linha por grafia,
-- válida em toda a região. O comentário da 0025, que criou a fila de espaços
-- por resolver, já dizia porque é que isso não chegava:
--
--   «O concelho vem junto porque "Casa da Cultura" sem concelho não se
--    resolve — há-as em Ferreira do Zêzere e em Alcanena, e são espaços
--    diferentes.»
--
-- A fila ganhou o concelho. A tabela de alias não. O resultado é que um nome
-- que se repete na região só pode pertencer a um concelho — o primeiro que o
-- reclamou —, e todos os outros perdem: `resolveVenueInMunicipality` recusa a
-- ligação, de propósito, para não pôr o evento no espaço errado. Recusar é
-- melhor do que errar, mas não é resolver.
--
-- Concretamente, hoje: «Casa da Cultura» é o nome canónico do espaço de
-- Ferreira do Zêzere, e por isso é ele que fica com o alias regional. Uma
-- agenda de Alcanena que escreva «Casa da Cultura» — que é como lá se chama à
-- Casa Municipal da Cultura — não casa com nada e vai para a fila.
--
-- ## A chave
--
-- Passa a ser o par (nome, âmbito). O âmbito é o concelho quando o alias é de
-- um concelho, e vazio quando vale em toda a região.
--
-- O `null` não serve numa chave primária — uma coluna de chave é sempre `not
-- null` —, e um alias regional tem de ser uma linha como as outras. Daí a
-- coluna gerada: `municipality_id` continua a ser o que se lê e se escreve,
-- com a chave estrangeira e o `null` a dizer «toda a região»; `ambito` é a
-- mesma coisa dobrada para a chave, e ninguém lhe toca à mão.
--
-- O que a chave passa a garantir, e não garantia:
--   · um alias regional por nome;
--   · um alias por nome e concelho;
--   · e os dois podem coexistir — o do concelho ganha, porque foi escrito
--     exatamente para desfazer a ambiguidade que o regional tem.
-- ---------------------------------------------------------------------------

alter table public.venue_aliases
  add column municipality_id text references public.municipalities(id) on delete cascade;

comment on column public.venue_aliases.municipality_id is
  'O concelho a que este alias está preso, ou null quando vale em toda a '
  'região. Um alias preso ganha ao regional na resolução: foi escrito para '
  'desfazer uma ambiguidade que o regional tem.';

alter table public.venue_aliases
  add column ambito text generated always as (coalesce(municipality_id, '')) stored;

comment on column public.venue_aliases.ambito is
  'O `municipality_id` dobrado para caber na chave primária, que não aceita '
  'nulos. Gerada: não se escreve, lê-se.';

alter table public.venue_aliases drop constraint venue_aliases_pkey;
alter table public.venue_aliases add primary key (alias, ambito);

create index venue_aliases_municipio_idx
  on public.venue_aliases (municipality_id)
  where municipality_id is not null;

comment on table public.venue_aliases is
  'RLS ligado e SEM policy, de propósito. Tabela de resolução usada pela '
  'recolha; não acrescenta nada a quem visita. A chave é (alias, ambito): o '
  'mesmo nome pode pertencer a espaços diferentes em concelhos diferentes.';

-- ---------------------------------------------------------------------------
-- O primeiro alias preso a um concelho, que é o caso que motivou isto.
--
-- Em Alcanena, «Casa da Cultura» é a Casa Municipal da Cultura — está no
-- próprio nome canónico do espaço. O alias regional continua a apontar ao de
-- Ferreira do Zêzere, que se chama assim e mais nada.
-- ---------------------------------------------------------------------------
insert into public.venue_aliases (alias, venue_id, municipality_id) values
  ('casadacultura', 'casa-da-cultura-pateo', 'alcanena')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- E o buraco que isto deixou à vista: o Politécnico é o único espaço do
-- catálogo cujo próprio nome canónico não era alias de si próprio. A recolha
-- só resolve por alias — o nome do espaço, por si, não resolve nada —, por
-- isso uma fonte que escrevesse «Universidade Politécnica de Tomar» tal e
-- qual não casava com o espaço que tem esse nome.
-- ---------------------------------------------------------------------------
insert into public.venue_aliases (alias, venue_id) values
  ('universidadepolitecnicadetomar', 'ipt')
on conflict do nothing;

update public.events
set venue_id = 'ipt', updated_at = now()
where venue_id is null
  and municipality_id = 'tomar'
  and public.normalize_for_hash(location_name) = 'universidadepolitecnicadetomar';

-- ---------------------------------------------------------------------------
do $$
declare
  v_ambito     integer;
  v_alcanena   integer;
  v_politecnico integer;
  v_orfaos     integer;
begin
  -- A chave é mesmo o par.
  select count(*) into v_ambito
  from information_schema.key_column_usage k
  join information_schema.table_constraints c
    on c.constraint_name = k.constraint_name
   and c.constraint_schema = k.constraint_schema
  where c.table_schema = 'public'
    and c.table_name = 'venue_aliases'
    and c.constraint_type = 'PRIMARY KEY';
  if v_ambito <> 2 then
    raise exception 'a chave primária de venue_aliases devia ter 2 colunas, e tem %', v_ambito;
  end if;

  select count(*) into v_alcanena
  from public.venue_aliases
  where alias = 'casadacultura' and municipality_id = 'alcanena';
  if v_alcanena <> 1 then
    raise exception 'faltou o alias de «Casa da Cultura» preso a Alcanena';
  end if;

  select count(*) into v_politecnico
  from public.venue_aliases
  where alias = 'universidadepolitecnicadetomar' and venue_id = 'ipt';
  if v_politecnico <> 1 then
    raise exception 'faltou o alias do nome canónico do Politécnico';
  end if;

  -- E agora nenhum espaço fica sem o próprio nome a resolver para si.
  select count(*) into v_orfaos
  from public.venues v
  where not exists (
    select 1 from public.venue_aliases a
    where a.alias = public.normalize_for_hash(v.name)
      and (a.municipality_id is null or a.municipality_id = v.municipality_id)
  );
  if v_orfaos <> 0 then
    raise exception '% espaços continuam sem o próprio nome como alias', v_orfaos;
  end if;
end
$$;
