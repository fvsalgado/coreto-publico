-- 0154 — A 0153 pôs um valor que o validador recusa. Corrigir.
--
-- **Erro meu, e caro por um bocado.** A 0153 pôs `timeoutMs: 120000` na fonte
-- do Teatro Virgínia sem olhar ao esquema que a valida. O
-- `packages/ingest/src/adapter.ts` tem `z.number().int().min(1_000).max(60_000)`,
-- e a recolha seguinte não esgotou tempo nenhum: rebentou em 128 milissegundos
-- com «configuração da fonte inválida — timeoutMs: Too big: expected number to
-- be <=60000». A fonte passou de «responde devagar de mais» para «nem sequer
-- é tentada», que é pior.
--
-- Mudei dados de produção sem ler a regra que os julga. O validador fez o que
-- devia — falhou alto, depressa e com o motivo escrito —, e é a única razão
-- por que isto se viu no minuto seguinte em vez de na próxima noite.
--
-- **Porque é que fica em 60 s e não se sobe o tecto.** Seria fácil levantar o
-- `max` para 120 000 e passar. Não se faz: ajustar a guarda para caber o valor
-- é o contrário de respeitar a guarda, e o tecto existe para que uma fonte não
-- segure a recolha inteira à espera de um servidor que não responde. Sessenta
-- segundos são um terço a mais do que os quarenta e cinco de agora, cabem na
-- regra que já lá estava, e chegam para responder à pergunta.
--
-- A experiência continua a ser experiência: se com sessenta segundos a fonte
-- continuar a não acabar de mandar a página, a resposta é «não é o tempo», e
-- o passo seguinte é escrever ao Cineclube — não voltar aqui a subir números.

update public.sources set
  config = coalesce(config, '{}'::jsonb) || '{"timeoutMs": 60000}'::jsonb,
  notes = coalesce(notes || ' ', '') ||
    'Tecto em 60 s desde 2026-09-14 (a 0153 tentou 120 s e o validador recusou, max 60 s). ' ||
    'Razão: a 03/09 a fonte ainda passava, em 50 s no total; desde 04/09 as três tentativas ' ||
    'esgotam os 45 s cada uma. A página não cresceu e de outra origem responde em 2,4 s.',
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

  if v_tempo is null or v_tempo > 60000 or v_tempo < 1000 then
    raise exception 'o tecto do Virgínia ficou em % ms, e o validador só aceita entre 1000 e 60000', v_tempo;
  end if;

  if v_sem_compressao is not true then
    raise exception 'a fonte do Virgínia deixou de pedir a página sem compressão — ver a 0046';
  end if;
end $$;
