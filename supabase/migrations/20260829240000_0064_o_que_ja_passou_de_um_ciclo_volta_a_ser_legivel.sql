-- 0064 — O que já passou de um ciclo volta a ser legível
--
-- O CAMINHOS é o argumento da Comunidade Intermunicipal: programação em rede,
-- dez espetáculos, dez concelhos, uma edição inteira entre abril e maio. Está
-- todo cá dentro — com cartaz, data, sítio e ligação para a página oficial de
-- cada um. E não aparece em lado nenhum do sítio.
--
-- A razão é boa e é esta: os dez eventos já passaram, e um evento que passa é
-- arquivado. A política de leitura pública deixa passar `status = 'published'`
-- e mais nada, que é o que impede que um evento apagado por estar errado, ou
-- desaparecido da fonte, volte à rua pela porta das traseiras.
--
-- O dono decidiu que as edições passadas dos ciclos entram. Isso não se faz
-- abrindo o arquivo — faz-se abrindo **a parte do arquivo que é um registo e
-- não um engano**. Uma segunda política, com três condições que têm de valer
-- todas ao mesmo tempo:
--
--   * `archived_reason = 'passado'` — foi arquivado por ter acontecido, e não
--     por ser um erro, um duplicado ou uma coisa que sumiu do sítio da fonte;
--   * `series_id is not null` — pertence a um ciclo com nome, que é o que dá
--     sentido a mostrá-lo depois de passar;
--   * `is_canonical` — é o registo bom do evento, e não a cópia perdida de uma
--     desduplicação.
--
-- Tudo o resto do arquivo continua invisível. E como as políticas se somam com
-- «ou», a linha antiga não muda: quem lê eventos publicados lê exatamente o
-- que lia ontem.

create policy events_past_series_read on public.events
  for select to anon, authenticated
  using (
    status = 'archived'
    and archived_reason = 'passado'
    and series_id is not null
    and is_canonical
  );

comment on policy events_past_series_read on public.events is
  'A edição passada de um ciclo é um registo público. O resto do arquivo não.';

-- ---------------------------------------------------------------------------
-- E o teatro errado.
--
-- Ao abrir esta gaveta apareceu lá dentro um evento no sítio errado. O «Corpo
-- Suspenso», do CAMINHOS, fez-se no Cine-Teatro São Pedro de Alcanena — é o
-- que a página do próprio CAMINHOS diz. Está cá com o `venue_id` do Cineteatro
-- São Pedro de **Abrantes**: outro teatro, outro concelho, setenta quilómetros
-- ao lado, com a morada errada e as coordenadas erradas.
--
-- Não foi ninguém que se enganou a escrever. A tabela de alias tem uma linha
-- por nome e nenhuma coluna de concelho, e o nome curto «Cine-Teatro São
-- Pedro» ficou com o de Abrantes (0035). Um cartaz que diga só isso casa
-- sempre com Abrantes, esteja o evento onde estiver.
--
-- O harmonizador passou a recusar um espaço que fique noutro concelho que não
-- o do evento — `resolveVenueInMunicipality`, com o teste que reproduz este
-- caso. A partir daí um nome ambíguo fica por resolver, vai para
-- `unresolved_venues` e espera por um alias; não vai calado para o concelho
-- errado. Isto aqui é o que já estava escrito.
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  update public.events
     set venue_id = 'cine-teatro-sao-pedro-alcanena', updated_at = now()
   where slug = 'corpo-suspenso-63af3d'
     and venue_id = 'cine-teatro-sao-pedro-abrantes'
  returning id into v_id;

  if v_id is not null then
    perform public.lock_event_fields(
      v_id, array['venue_id'], 'correção de espaço 2026-08-29',
      'A página do CAMINHOS diz Cine-Teatro São Pedro, Alcanena. Estava no de Abrantes por o alias curto do nome não ter concelho.'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- O que tem de continuar verdade.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  -- A política nova existe e não mexeu na antiga.
  select count(*) into n from pg_policy
   where polrelid = 'public.events'::regclass
     and polname in ('events_public_read', 'events_past_series_read');
  assert n = 2, format('esperavam-se duas políticas de leitura em events, há %s', n);

  -- Nenhum evento pode estar num espaço de outro concelho. É a asserção que
  -- apanha a próxima colisão de nomes antes de ela chegar ao sítio.
  select count(*) into n
    from public.events e join public.venues v on v.id = e.venue_id
   where e.municipality_id is distinct from v.municipality_id;
  assert n = 0, format('%s eventos estão num espaço de outro concelho', n);
end $$;
