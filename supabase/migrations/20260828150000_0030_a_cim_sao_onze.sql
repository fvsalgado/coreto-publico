-- 0030 — A CIM do Médio Tejo são onze concelhos. A 0016 corrigiu para errado.
--
-- A Sertã e Vila de Rei **saíram** da Comunidade Intermunicipal do Médio Tejo a
-- 23 de dezembro de 2022, para a CIM da Beira Baixa. Não fazem parte deste
-- território desde então.
--
-- A migração 0016 chamava-se «treze concelhos» e acrescentou-as, com este
-- raciocínio escrito lá dentro: as listas do projeto tinham onze, onze é o
-- número de concelhos do distrito de Santarém, a Sertã e Vila de Rei são de
-- Castelo Branco — logo caíram por distração e faltavam.
--
-- Cada passo é verdadeiro e a conclusão é falsa. As listas de onze não estavam
-- desatualizadas: estavam certas. Foram corrigidas para errado.
--
-- O próprio projeto já tinha escrito a lição no manual de operação — «foi por
-- uma contagem que ninguém questionou» — sem a aplicar a si mesmo. Uma
-- contagem não é uma verificação: «são treze e nós temos onze» é uma inferência
-- sobre um facto que ninguém foi confirmar.
--
-- Sai tudo, e sem vestígios: os eventos, as sessões, os espaços, as fontes, as
-- execuções, os espaços por resolver e os próprios concelhos.

-- As sessões primeiro, que dependem dos eventos.
delete from public.event_sessions
where event_id in (
  select id from public.events where municipality_id in ('serta', 'vila-de-rei')
);

delete from public.events where municipality_id in ('serta', 'vila-de-rei');

delete from public.unresolved_venues where municipality_id in ('serta', 'vila-de-rei');
delete from public.submissions      where municipality_id in ('serta', 'vila-de-rei');
delete from public.venue_aliases
where venue_id in (
  select id from public.venues where municipality_id in ('serta', 'vila-de-rei')
);
delete from public.venues  where municipality_id in ('serta', 'vila-de-rei');
delete from public.coretos where municipality_id in ('serta', 'vila-de-rei');

delete from public.source_runs where source_id in ('cm-serta', 'cm-viladerei');
delete from public.sources     where id in ('cm-serta', 'cm-viladerei');

-- E os concelhos. É esta a linha que o teste de `municipalities.ts` lê para
-- saber que a base e o código dizem o mesmo — por isso a forma importa:
-- `delete from public.municipalities where id in (…)`.
delete from public.municipalities where id in ('serta', 'vila-de-rei');

comment on table public.municipalities is
  'Os 11 concelhos da Comunidade Intermunicipal do Médio Tejo. A Sertã e Vila '
  'de Rei saíram para a CIM da Beira Baixa a 2022-12-23 e não voltam sem uma '
  'alteração da lei.';

-- ---------------------------------------------------------------------------
-- A vista de qualidade tinha treze escrito como asserção. Passa a onze, e a
-- razão de a haver mantém-se: um concelho que desaparece do painel por não ter
-- eventos é o que este projeto existe para não deixar acontecer.
-- ---------------------------------------------------------------------------
do $$
declare
  v_linhas integer;
  v_sobras integer;
begin
  select count(*) into v_linhas from public.event_quality_by_municipality;
  if v_linhas <> 11 then
    raise exception 'a vista de qualidade tem de ter uma linha por concelho, e são onze — tem %', v_linhas;
  end if;

  select count(*) into v_sobras from public.municipalities where district <> 'Santarém';
  if v_sobras > 0 then
    raise exception '% concelhos fora do distrito de Santarém continuam na CIM', v_sobras;
  end if;

  select count(*) into v_sobras
  from public.events where municipality_id in ('serta', 'vila-de-rei');
  if v_sobras > 0 then
    raise exception 'ficaram % eventos dos concelhos que saíram', v_sobras;
  end if;
end
$$;
