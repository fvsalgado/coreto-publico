-- 0079 — Uma freguesia sossegada não é uma avaria.
--
-- O painel de saúde das fontes dizia que dezoito das quarenta fontes activas
-- tinham um erro. Nenhuma delas tem.
--
-- São juntas de freguesia pequenas — Bugalhos, Valhascos, Espite, Cercal,
-- Junceira, Matas, Seiça, e mais onze. Todas com uma página onde caberia uma
-- agenda; nenhuma com um único evento lá escrito. Em seis recolhas seguidas
-- devolveram zero, porque zero é o que lá está. A recolha classificava esse
-- zero como execução parcial e guardava-lhe a nota «a fonte respondeu mas não
-- devolveu eventos» em `last_error`.
--
-- Era a mesma falha em dois sítios: o estado da execução, que ficava amarelo,
-- e o campo de erro da fonte, que ficava preenchido. Dezoito linhas em
-- quarenta, todas as noites, para sempre. O comentário que está no `pipeline`
-- desde o início já dizia porque é que isso não pode ser — «o painel de saúde
-- ficava permanentemente amarelo e ninguém lhe dava atenção no dia em que
-- interessasse» — e a regra logo por baixo dele fazia exactamente isso.
--
-- A regra está corrigida no código: quem decide se um zero é alarmante é a
-- deteção de alteração de layout, que corre antes e conhece a linha de base da
-- fonte. Uma fonte que costumava dar vinte e seis e dá zero volta de lá
-- marcada — é o caso do Teatro Virgínia, e continua amarelo, como deve. Uma
-- fonte cuja linha de base é zero não caiu de lado nenhum.
--
-- Falta o estado que já está escrito. A correcção no código só age na próxima
-- recolha, e essa depende de um executor que hoje não corre; até lá o painel
-- continuaria a mentir. Esta migração limpa-o.
--
-- Só se apaga o que corresponde exactamente aos dois critérios — a mensagem à
-- letra e a ausência de linha de base —, e é a própria condição que garante
-- que nenhum aviso verdadeiro cai: sob a regra antiga esta mensagem escrevia-
-- se a qualquer fonte que trouxesse zero; sob a nova só se escreve a quem tem
-- linha de base. Numa fonte com linha de base zero, esta frase é
-- necessariamente a antiga e falsa. O Teatro Virgínia, que tem linha de base
-- de 26, não é tocado — nem por esta condição nem por outra: o aviso dele diz
-- outra coisa, e diz a verdade.

do $$
declare
  limpas    integer;
  restantes integer;
begin
  with alvo as (
    update public.sources
    set last_error = null
    where last_error = 'a fonte respondeu mas não devolveu eventos'
      and coalesce(baseline_item_count, 0) = 0
    returning id
  )
  select count(*) into limpas from alvo;

  -- A pós-condição: nenhuma fonte sem linha de base fica a mostrar um erro que
  -- não existe. Numa base recém-criada é trivialmente verdadeira, porque nunca
  -- correu uma recolha que escrevesse o campo; em produção é o que se quer
  -- provar.
  select count(*) into restantes
  from public.sources
  where last_error = 'a fonte respondeu mas não devolveu eventos'
    and coalesce(baseline_item_count, 0) = 0;

  if restantes <> 0 then
    raise exception 'ainda há % fontes sem linha de base com o erro falso', restantes;
  end if;

  raise notice '% fontes deixaram de mostrar um erro que não existia', limpas;
end
$$;
