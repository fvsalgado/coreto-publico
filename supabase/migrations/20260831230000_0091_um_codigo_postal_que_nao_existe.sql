-- 0091 — Um código postal que não existe, e uma morada que era o nome.
--
-- Encontrado a verificar a ligação de mapa da 0079 em produção. A procura do
-- Convento de Cristo saía assim:
--
--     Convento de Cristo, Convento de Cristo, 2300-000, Tomar
--
-- Duas coisas erradas numa linha, e nenhuma delas era do código:
--
--   · **`2300-000` não é um código postal.** O sufixo `-000` não existe no
--     sistema dos CTT — é o que alguém escreve quando quer preencher o campo
--     e não sabe o valor. Estava publicado na ficha, com ar de morada.
--   · **A «morada» era o nome do espaço.** `address = 'Convento de Cristo'`
--     não diz a ninguém onde é nada; só fazia o nome aparecer duas vezes.
--
-- Um campo inventado é pior do que um campo vazio, e por duas razões que esta
-- casa já escreveu noutro sítio: quem o lê acredita, e quem o revê salta-o por
-- parecer preenchido.
--
-- ## O que entra em vez deles
--
-- Nada, e é essa a resposta certa. O OSM dá a rua «Terreiro» e o código
-- `2300-633` para o polígono do mosteiro, e isso fica escrito nas notas como
-- pista — mas uma rua chamada «Terreiro» e um código postal de polígono não
-- são morada confirmada de um Monumento Nacional com várias entradas. Fica
-- por levantar, como as outras que ficaram.
--
-- O espaço não perde nada com isto: tem coordenada, e é a coordenada que leva
-- lá. O que perde é uma afirmação falsa. E a procura no mapa passa a ser
-- «Convento de Cristo, Tomar», que é exactamente o que se quer que ela seja.
--
-- ## E a reincidência fica travada
--
-- `scripts/schema-checks.sql` passa a recusar qualquer código postal que não
-- tenha a forma portuguesa `dddd-ddd`, e qualquer um terminado em `-000`. A
-- primeira apanha o lixo; a segunda apanha o preenchimento de conveniência,
-- que passaria na primeira.

update public.venues set
  postal_code = null,
  address = null,
  notes = coalesce(notes || ' ', '') ||
    'Levantamento 2026-08-31: retirados o código postal «2300-000», que não existe (o sufixo -000 '
    'não é atribuído pelos CTT), e a morada «Convento de Cristo», que era o nome do próprio '
    'espaço. Pista por confirmar: o OSM dá, para o polígono do mosteiro, a rua «Terreiro» e o '
    'código 2300-633 (39.6035941,-8.4199276). Não entra sem confirmação — um Monumento Nacional '
    'com várias entradas não se resolve pelo centróide de um polígono.',
  updated_at = now()
where id = 'convento-de-cristo';

-- ---------------------------------------------------------------------------
do $$
declare
  invalidos integer;
  quais     text;
begin
  -- Postcondição, e vale para todos: numa base vazia passa calada.
  select count(*), string_agg(name || ' (' || postal_code || ')', ', ' order by name)
    into invalidos, quais
  from public.venues
  where postal_code is not null
    and (postal_code !~ '^\d{4}-\d{3}$' or postal_code ~ '-000$');

  if invalidos > 0 then
    raise exception '% espaços com código postal que não existe: %', invalidos, quais;
  end if;

  if exists (select 1 from public.venues where id = 'convento-de-cristo' and address is not null) then
    raise exception 'o Convento de Cristo voltou a ter uma morada que é o nome dele';
  end if;
end
$$;
