-- 0072 — A fila das etiquetas esquece também, e um erro de escrita.
--
-- Duas correções à 0071, que ficou a meio.
--
-- **O erro:** a lista de etiquetas a pôr de lado escrevia `festaseferias`, e a
-- forma normalizada de «Festas e Feiras» é `festasefeiras`. Duas letras
-- trocadas, e a etiqueta com mais ocorrências de todas — noventa e uma entre
-- as duas grafias — ficou na fila.
--
-- **O que faltava:** a fila das etiquetas tem o mesmo defeito que a fila dos
-- espaços tinha antes da 0067 — não esquece. Uma etiqueta que ganhou alias
-- deixa de ser desconhecida, mas a linha fica lá para sempre: das vinte que
-- estavam na fila, oito já estavam mapeadas pela 0071 e continuavam a pedir
-- trabalho feito.
--
-- Resolve-se da mesma maneira, e de propósito: uma vista com a mesma forma e o
-- mesmo nome. Quem lê o painel lê `unknown_tags_pendentes` e
-- `unresolved_venues_pendentes`, e as duas querem dizer a mesma coisa — o que
-- **hoje** ainda é trabalho.
-- ---------------------------------------------------------------------------

update public.unknown_tags set dismissed = true
where not dismissed and public.normalize_for_hash(tag) = 'festasefeiras';

create view public.unknown_tags_pendentes
with (security_invoker = true) as
select t.tag, t.hits, t.first_seen, t.last_seen, t.example_url
from public.unknown_tags t
where not t.dismissed
  and not exists (
    select 1 from public.category_aliases a
    where a.alias = public.normalize_for_hash(t.tag)
  );

comment on view public.unknown_tags_pendentes is
  'A fila de etiquetas por mapear, sem as já mapeadas e sem as que não nomeiam '
  'categoria nenhuma. Uma etiqueta sai da fila no instante em que ganha alias, '
  'sem ninguém a ter de a apagar. Ver `unresolved_venues_pendentes`.';

-- ---------------------------------------------------------------------------
do $$
declare
  v_festas  integer;
  v_na_fila integer;
begin
  select count(*) into v_festas from public.unknown_tags
  where public.normalize_for_hash(tag) = 'festasefeiras' and not dismissed;
  if v_festas <> 0 then
    raise exception '«Festas e Feiras» devia ter saído da fila, e há % linhas', v_festas;
  end if;

  select count(*) into v_na_fila from public.unknown_tags_pendentes;
  raise notice 'ficam % etiquetas na fila', v_na_fila;
end
$$;
