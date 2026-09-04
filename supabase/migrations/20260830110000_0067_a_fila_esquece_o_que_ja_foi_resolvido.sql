-- 0067 — A fila de espaços por resolver esquece o que já foi resolvido.
--
-- `unresolved_venues` é uma fila de trabalho para uma pessoa: cada nome que a
-- recolha não conseguiu ligar ao catálogo aparece lá, alguém lhe dá o alias
-- certo uma vez, e todas as recolhas seguintes ficam a saber.
--
-- Só que a linha não sai. O `upsert` da recolha só toca nas que voltam a
-- aparecer; a que foi resolvida deixa de aparecer — e por isso fica lá para
-- sempre, com o `last_seen` congelado no dia em que deixou de ser um problema.
--
-- Em 29 de agosto de 2026, oito das quarenta e oito linhas da fila já tinham
-- alias: «MIAA – Museu Ibérico de Arqueologia e Arte de Abrantes», as três
-- grafias do Complexo Cultural da Levada, a Biblioteca Municipal de Ourém, o
-- Mercado Municipal António Teixeira Antunes. Um sexto da fila era trabalho
-- feito a pedir para ser feito outra vez.
--
-- ## Uma vista, e não uma limpeza
--
-- Apagar as oito resolvia hoje e voltava a acontecer na semana seguinte. O
-- que se corrige é a pergunta: a fila passa a ser «o que **hoje** não
-- resolve», calculado contra a tabela de alias em cada leitura.
--
-- A condição é a mesma que `resolveVenueInMunicipality` aplica no código, e
-- tem de continuar a sê-lo:
--
--   · um alias preso ao concelho do evento resolve;
--   · um alias regional resolve, a menos que aponte a um espaço de outro
--     concelho — que é a recusa que impede um evento de Alcanena de ir parar
--     ao teatro de Abrantes.
--
-- O histórico fica. Uma linha resolvida guarda quantas vezes apareceu e
-- quando — é assim que se sabe que o alias valeu a pena.
-- ---------------------------------------------------------------------------

create view public.unresolved_venues_pendentes
with (security_invoker = true) as
select u.normalized,
       u.name,
       u.municipality_id,
       u.hits,
       u.first_seen,
       u.last_seen,
       u.example_url
from public.unresolved_venues u
where not u.dismissed
  and not exists (
    select 1
    from public.venue_aliases a
    join public.venues v on v.id = a.venue_id
    where a.alias = u.normalized
      and (
        a.municipality_id = u.municipality_id
        or (
          a.municipality_id is null
          and (u.municipality_id is null or v.municipality_id = u.municipality_id)
        )
      )
  );

comment on view public.unresolved_venues_pendentes is
  'A fila de espaços por resolver, sem o que já foi resolvido. Aplica a mesma '
  'regra que a recolha: o alias preso ao concelho ganha, o regional só vale se '
  'não apontar a um espaço de outro concelho. Uma linha sai da fila no '
  'instante em que ganha alias, sem ninguém a ter de a apagar.';

-- ---------------------------------------------------------------------------
do $$
declare
  v_na_tabela integer;
  v_na_vista  integer;
begin
  select count(*) into v_na_tabela from public.unresolved_venues where not dismissed;
  select count(*) into v_na_vista  from public.unresolved_venues_pendentes;
  if v_na_vista > v_na_tabela then
    raise exception 'a vista tem % linhas e a tabela %, o que não pode ser', v_na_vista, v_na_tabela;
  end if;
end
$$;
