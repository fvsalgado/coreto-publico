-- 0153 — Mais tempo ao Virgínia, para se saber se é disso que precisa.
--
-- **Isto é uma experiência, e está escrita como tal.** Se falhar, a resposta
-- que fica é «não é o tempo», e isso também vale a pena saber-se.
--
-- O que se mediu, e é o que a justifica:
--
--   03/09   success   40 itens   2 respostas, 1 falha    50 s
--   04/09   partial    0 itens   3 respostas, 3 falhas  138 s
--   …
--   14/09   failed     0 itens   3 respostas, 3 falhas  138 s
--
-- A 3 de setembro a fonte **passou**, e passou à segunda tentativa: uma
-- falhou, outra chegou, e o total foi cinquenta segundos. Desde o dia
-- seguinte, as três tentativas esgotam os quarenta e cinco segundos cada uma,
-- todas as noites, ao milissegundo. A página não cresceu — 465 KB em agosto,
-- 475 KB hoje.
--
-- Isto diz que a página anda mesmo à beira do tecto visto do executor, e que
-- o tecto deixou de chegar. Daqui, de outra origem, a mesma página com o
-- mesmo agente e a mesma codificação responde em 2,4 s a 197 KB/s — por isso
-- o que mudou não é o tamanho nem o nosso cliente.
--
-- Cento e vinte segundos não é adivinhação: é o dobro largo do que a fonte
-- já mostrou precisar quando ainda passava. E não é contornar nada — é o
-- mesmo agente, a mesma morada, a mesma página, com mais paciência.
--
-- **O custo, para ficar dito.** Três tentativas a 120 s são seis minutos numa
-- noite em que a fonte não responda, contra os dois de agora. O trabalho tem
-- quarenta e cinco minutos de tecto e quarenta fontes, e esta é a única com
-- um tempo destes — cabe. Se a experiência falhar, o passo seguinte não é
-- subir outra vez: é aceitar que o problema é do lado de lá e escrever-lhes,
-- como se escreveu à CIM.
--
-- A 0046 é a irmã desta, e convém lê-la antes: foi lá que se descobriu que o
-- servidor comprimia meio megabyte a cada pedido e não acabava. A correção
-- dessa noite — `semCompressao` — continua aplicada e continua certa; o que
-- se vê agora é outra coisa, por cima dela.

update public.sources set
  config = coalesce(config, '{}'::jsonb) || '{"timeoutMs": 120000}'::jsonb,
  updated_at = now()
where id = 'teatro-virginia';

-- ---------------------------------------------------------------------------
do $$
declare
  v_tempo integer;
  v_sem_compressao boolean;
begin
  select (config ->> 'timeoutMs')::integer,
         (config ->> 'semCompressao')::boolean
    into v_tempo, v_sem_compressao
    from public.sources where id = 'teatro-virginia';

  if v_tempo <> 120000 then
    raise exception 'o tecto do Virgínia ficou em % ms', v_tempo;
  end if;

  -- A correção da 0046 não se perde por descuido ao mexer no mesmo `config`.
  if v_sem_compressao is not true then
    raise exception 'a fonte do Virgínia deixou de pedir a página sem compressão — ver a 0046';
  end if;
end $$;
