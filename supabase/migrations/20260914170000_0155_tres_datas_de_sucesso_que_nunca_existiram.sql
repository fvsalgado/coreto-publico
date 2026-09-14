-- 0155 — Três datas de sucesso que nunca existiram.
--
-- A correção de comportamento está no `pipeline.ts`: o `leituraBoa` ganhou uma
-- terceira condição e uma corrida que se deu por `partial` deixa de escrever
-- sucesso na ficha da fonte. Mas o código novo não desfaz o que o velho
-- escreveu, e o que ele escreveu foram datas que não aconteceram. Isto desfaz.
--
-- É a mesma forma da 0046 e da 0152, e pela mesma razão: uma correção que
-- deixa para trás fichas a mentir não está acabada.
--
-- ---------------------------------------------------------------------------
-- O que se mediu, a 14 de setembro de 2026
-- ---------------------------------------------------------------------------
--
-- Comparou-se, fonte a fonte, o `sources.last_success_at` com a corrida mais
-- recente que ficou gravada em `source_runs` com `status = 'success'`. Três
-- não batiam certo:
--
--   fonte             a ficha dizia    a última corrida com sucesso foi
--   jf-assentiz       14/09 09:08      30/08 07:37      → 15 dias a mais
--   jf-fontes         14/09 09:08      06/09 08:06      →  8 dias a mais
--   teatro-virginia   07/09 08:37      03/09 13:32      →  3,8 dias a mais
--
-- As outras trinta e sete batem certo ao minuto.
--
-- ---------------------------------------------------------------------------
-- Como é que uma corrida `partial` escrevia sucesso
-- ---------------------------------------------------------------------------
--
-- Dois caminhos, e cada um deixou a sua data.
--
-- **As duas freguesias** têm linha de base 1. A `avaliarContagem` devolve
-- `'normal'` sem comparar contagem nenhuma quando a linha de base é menor do
-- que `DRIFT_MIN_BASELINE` (5) — e é assim de propósito: uma freguesia
-- sossegada que traz zero porque zero é o que lá está não pode pôr o painel
-- amarelo todas as noites para sempre. Só que o `status` da corrida ficava
-- `'partial'`, com a nota «a fonte respondeu mas não devolveu eventos
-- (costumava dar 1)». A corrida dizia uma coisa e a ficha dizia outra, e quem
-- lê a ficha — a `/estado` — via verde.
--
-- **O Virgínia** é o resíduo mais antigo. A data dele parou em 07/09 08:37
-- porque o guarda `leituraBoa = contagem === 'normal'` só entrou no código a
-- 08/09 às 00:11; até aí o `succeeded` era `true` sem condição nenhuma, e cada
-- noite falhada escrevia a data do próprio dia. A partir de 08/09 deixou de
-- escrever — e a data ficou congelada na última noite antes do guarda.
--
-- ---------------------------------------------------------------------------
-- O que isto NÃO é
-- ---------------------------------------------------------------------------
--
-- **Não é dizer que estas fontes estão avariadas.** As duas freguesias
-- respondem todos os dias, em tempo, com HTTP 200. O que elas não fazem é
-- trazer eventos — e a agenda da junta pode estar honestamente vazia. A data
-- corrigida diz «foi nesse dia que se leu alguma coisa», que é o que a coluna
-- promete, e não «a fonte está partida».
--
-- **Não mexe no disjuntor.** `consecutive_failures` e `circuit_open_until`
-- ficam como estão, porque quem os governa é o `leu` — houve resposta, e
-- houve. Contar isto como falha era repetir o que prendeu o Sardoal (ver a
-- 0152).
--
-- **Não inventa datas.** Cada valor abaixo é lido do `source_runs`, não
-- escrito à mão: se não houver lá corrida com sucesso nenhuma, a coluna fica
-- a nulo, que é a resposta verdadeira — «nunca se leu nada desta fonte» — e
-- não uma data de conveniência.

update public.sources s
   set last_success_at = (
         select max(r.started_at)
           from public.source_runs r
          where r.source_id = s.id
            and r.status = 'success'
       ),
       updated_at = now()
 where s.id in ('jf-assentiz', 'jf-fontes', 'teatro-virginia');

-- ---------------------------------------------------------------------------
-- A prova, aqui dentro, porque uma migração que não verifica o que fez é uma
-- intenção e não uma alteração.
-- ---------------------------------------------------------------------------
do $$
declare
  v_mentirosas integer;
  v_falhas_virginia integer;
begin
  -- Nenhuma fonte activa pode dizer que teve sucesso depois da última corrida
  -- em que o teve. A folga de dez minutos é para a corrida que ainda está a
  -- fechar-se enquanto isto corre.
  select count(*) into v_mentirosas
    from public.sources s
    left join (
      select source_id, max(started_at) as ultimo
        from public.source_runs where status = 'success' group by source_id
    ) v on v.source_id = s.id
   where s.is_enabled
     and s.last_success_at is not null
     and (v.ultimo is null or s.last_success_at > v.ultimo + interval '10 minutes');

  if v_mentirosas <> 0 then
    raise exception 'ficaram % ficha(s) a dizer que tiveram sucesso depois da última corrida com sucesso', v_mentirosas;
  end if;

  -- E o disjuntor do Virgínia não se mexeu por causa disto: a avaria dele é
  -- outra, continua de pé, e não é esta migração que a trata.
  select consecutive_failures into v_falhas_virginia
    from public.sources where id = 'teatro-virginia';
  if v_falhas_virginia is null then
    raise exception 'o Teatro Virgínia desapareceu da tabela das fontes';
  end if;
end $$;
