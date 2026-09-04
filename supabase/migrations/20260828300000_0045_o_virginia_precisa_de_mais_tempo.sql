-- 0045 — O Virgínia precisa de mais tempo, não de outro endereço.
--
-- A 0044 corrigiu o endereço e a recolha voltou a trazer zero. O registo desta
-- vez foi explícito, e a causa não era nenhuma das duas que se tinham suposto:
--
--     [teatro-virginia] aviso: página sem resposta utilizável:
--     https://www.teatrovirginia.pt/index.php/cinema/cinema
--     — tempo de resposta esgotado
--
-- A página da época pesa 465 KB e responde em cerca de dois segundos a partir
-- daqui. A partir do executor do GitHub esgotou os quinze segundos por omissão,
-- três vezes seguidas — quarenta e nove segundos até desistir. Um sítio lento
-- visto de longe não é um sítio partido, e a recolha não devia desistir dele
-- como se fosse.
--
-- Sobe-se o tempo desta fonte para quarenta e cinco segundos. É por fonte e com
-- a razão escrita, e não o valor por omissão de todas: um tempo generoso em
-- todo o lado seria uma recolha inteira à espera do servidor mais lento da
-- região.
--
-- A `config` das fontes passa a aceitar `timeoutMs`, validado entre um e
-- sessenta segundos.

update public.sources set
  config = coalesce(config, '{}'::jsonb) || '{"timeoutMs": 45000}'::jsonb,
  consecutive_failures = 0,
  circuit_open_until = null,
  last_error = null,
  notes = coalesce(notes || ' ', '') || 'Corrigido a 2026-08-28 (segunda vez): a recolha esgotava os 15 s por omissão a partir do executor do GitHub, embora a página responda em ~2 s de outros pontos. Passa a declarar timeoutMs de 45 s. O endereço e o adaptador já estavam certos.',
  updated_at = now()
where id = 'teatro-virginia';

-- ---------------------------------------------------------------------------
do $$
declare
  v_timeout integer;
begin
  select (config ->> 'timeoutMs')::integer into v_timeout
    from public.sources where id = 'teatro-virginia';
  if v_timeout is null or v_timeout < 30000 then
    raise exception 'a fonte do Virgínia devia declarar um tempo limite generoso, e declara %', coalesce(v_timeout::text, 'nenhum');
  end if;
end
$$;
