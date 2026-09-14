-- 0156 — Sete dias de silêncio para as oito da CIM, e é uma experiência.
--
-- **Isto não corrige nada. É uma pergunta feita da única maneira que a pode
-- responder: deixando de bater à porta.**
--
-- ---------------------------------------------------------------------------
-- A pergunta
-- ---------------------------------------------------------------------------
--
-- As oito fontes alojadas em `83.240.244.155` deixaram de responder a 12 de
-- setembro. Sabemos que o corte segue a origem do pedido e não o nosso nome
-- (a ligação morre antes de o `User-Agent` sair daqui), e que o servidor está
-- de pé — abre de uma ligação portuguesa doméstica.
--
-- O que **não** sabemos é se é uma regra fixa ou uma proibição automática que
-- expira. E há uma razão concreta para desconfiar da segunda: o que ficou
-- gravado na véspera do corte.
--
--   dia     pedidos  falhas  janela
--   05/09        78       0   6 min
--   06/09        75       0   7 min
--   07/09        72       0   7 min
--   08/09        78       2  12 min
--   09/09        79       0   9 min
--   10/09        76       0   7 min
--   11/09        91      11  19 min   ← a véspera
--   12/09        24      24   nada respondeu
--
-- A 11 de setembro aquele servidor começou a falhar em páginas de detalhe —
-- `cm-alcanena` 173 s e cinco falhas, `cm-entroncamento` 191 s e cinco, contra
-- os trinta e poucos segundos do costume. E o nosso cliente fez o que está
-- programado para fazer: **tentou três vezes cada página falhada**, com espera
-- crescente. Foi assim que a janela passou de sete para dezanove minutos.
--
-- Num momento em que aquela máquina já estava com dificuldade, triplicámos os
-- pedidos exactamente nas páginas que ela não estava a conseguir servir. No
-- dia seguinte deixou de nos responder.
--
-- **Não está provado que uma coisa tenha causado a outra**, e não se vai
-- escrever aqui que está. Mas é um padrão que não se ignora.
--
-- ---------------------------------------------------------------------------
-- Porquê sete dias, e porquê não menos
-- ---------------------------------------------------------------------------
--
-- Porque **as janelas curtas já foram testadas sem darmos por isso.** A
-- recolha corre uma vez por dia: entre a corrida de 12/09 às 08:03 e a de
-- 13/09 às 08:24 houve um intervalo limpo de vinte e quatro horas sem um único
-- pedido nosso, e continuou bloqueado. Qualquer proibição com janela até um dia
-- está descartada por observação.
--
-- Abaixo de três dias não se aprende nada de novo. Sete cobrem o escalão
-- seguinte, que é o «uma semana» — comum nestes sistemas. Acima disso, se
-- ainda estiver bloqueado, é na prática uma regra fixa e a resposta é a carta.
--
-- **As oito têm de se calar juntas.** São um endereço IP só: se uma bate, bate
-- por todas, e o silêncio das outras sete não valia nada.
--
-- ---------------------------------------------------------------------------
-- Como, e o que custa
-- ---------------------------------------------------------------------------
--
-- Usa-se o disjuntor que já existe. O `isCircuitOpen` salta a fonte sem abrir
-- execução e sem escrever linha nenhuma, e **expira sozinho**: ao oitavo dia a
-- recolha tenta outra vez, sem ninguém ter de se lembrar.
--
-- **O custo é zero.** Estas oito não trazem nada desde 12 de setembro; deixar
-- de as tentar não perde um evento que fosse. O que está publicado fica
-- publicado — uma fonte saltada não é uma fonte que devolveu vazio, e o
-- `reconcile` não retira nada.
--
-- Fica uma sondagem por fazer à mão ao terceiro dia — uma fonte só, meia dúzia
-- de pedidos, pequena de mais para re-armar um limitador de ritmo. Se passar,
-- levanta-se isto mais cedo.
--
-- E os dois desfechos ensinam:
--
--   * **Volta a responder** — era automático e nós alimentávamo-lo. Corrige-se
--     o nosso lado (a pausa passou hoje a ser por máquina e não por nome) e a
--     carta pode nem ser precisa.
--   * **Continua calado** — é regra fixa, e a carta passa a poder dizer, com
--     prova: «parámos completamente durante uma semana e não mudou nada».
--     Isso elimina, de uma vez, a hipótese que o técnico do outro lado ia
--     querer verificar primeiro.

update public.sources set
  circuit_open_until = now() + interval '7 days',
  notes = coalesce(notes || ' ', '') ||
    'Calada a 2026-09-14 por sete dias, de propósito: experiência para distinguir uma regra fixa ' ||
    'de uma proibição automática que se renova a cada tentativa. Ver a migração 0156. O disjuntor ' ||
    'expira sozinho a 2026-09-21 e a fonte volta a ser tentada sem intervenção.',
  updated_at = now()
where id in ('caminhos-cimt', 'cm-alcanena', 'cm-constancia', 'cm-entroncamento',
             'cm-ferreiradozezere', 'cm-macao', 'cm-tomar', 'cm-vnbarquinha');

-- ---------------------------------------------------------------------------
-- A prova, aqui dentro.
-- ---------------------------------------------------------------------------
do $$
declare
  v_caladas integer;
  v_outras integer;
begin
  select count(*) into v_caladas
    from public.sources
   where id in ('caminhos-cimt', 'cm-alcanena', 'cm-constancia', 'cm-entroncamento',
                'cm-ferreiradozezere', 'cm-macao', 'cm-tomar', 'cm-vnbarquinha')
     and circuit_open_until > now() + interval '6 days';
  if v_caladas <> 8 then
    raise exception 'só % das oito ficaram caladas', v_caladas;
  end if;

  -- **Nenhuma outra fonte pode ter sido apanhada por isto.** As trinta e duas
  -- restantes leem-se esta noite como leram ontem; o Teatro Virgínia incluído,
  -- que tem outra avaria e não entra nesta experiência.
  select count(*) into v_outras
    from public.sources
   where is_enabled
     and circuit_open_until is not null
     and id not in ('caminhos-cimt', 'cm-alcanena', 'cm-constancia', 'cm-entroncamento',
                    'cm-ferreiradozezere', 'cm-macao', 'cm-tomar', 'cm-vnbarquinha');
  if v_outras <> 0 then
    raise exception '% fonte(s) fora das oito ficaram com o disjuntor armado', v_outras;
  end if;
end $$;
