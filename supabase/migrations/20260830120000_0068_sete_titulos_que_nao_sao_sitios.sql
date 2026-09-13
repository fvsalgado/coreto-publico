-- 0068 — Sete títulos de evento que estavam na fila dos espaços.
--
-- O adaptador do «Portal da Freguesia» oferece ao catálogo o texto livre de
-- cada evento, porque nesse CMS há um campo só e as juntas usam-no ora para
-- dizer onde é, ora para dizer o que é. Quando o texto não casa com nenhum
-- espaço, vai para `unresolved_venues` — a fila onde uma pessoa dá o alias
-- certo uma vez e todas as recolhas seguintes ficam a saber.
--
-- O filtro que decidia o que valia a pena oferecer media só a forma: curto,
-- sem pontuação de fim de frase. «Yoga Sénior Turma 1» tem essa forma. Em 29
-- de agosto de 2026 sete das quarenta e oito linhas da fila eram títulos de
-- eventos, e nenhum deles se pode resolver: não há espaço nenhum a que
-- chamar «Torneio de tiro ao alvo com pressão de ar».
--
-- O filtro passou a exigir que o nome **diga que tipo de sítio é** — pavilhão,
-- casa, centro, largo —, ou que comece por uma sigla. Isso trava os que ainda
-- não aconteceram. Estes sete já aconteceram, e é aqui que saem.
--
-- Não se apagam: marcam-se com `dismissed`, que é a coluna que existe
-- exatamente para «este nome não é um espaço nenhum». Apagá-los era perder a
-- prova de que estiveram cá, e é essa prova que explica o filtro novo.
--
-- Fica de fora, de propósito, «Pavilhão Ana Sonça»: veio pelo mesmo caminho e
-- é mesmo um sítio — um pavilhão em Minde que o catálogo ainda não tem. O
-- filtro novo continua a aceitá-lo, e a fila continua a pedi-lo.
-- ---------------------------------------------------------------------------

update public.unresolved_venues
set dismissed = true
where not dismissed
  and normalized in (
    'yogaseniorturma1',
    'yogaseniorturma2',
    'torneiodetiroaoalvocompressaodear',
    'iiprovaderesistenciaterranteztrailteam',
    'ixdownhillurbanoemconstancianodia12desetembro2026',
    'inicionapraiafluvialdeconstancia',
    'estemestambemvamosteraatividadedomingodepraca'
  );

-- ---------------------------------------------------------------------------
do $$
declare
  v_marcados integer;
  v_pavilhao integer;
begin
  select count(*) into v_marcados
  from public.unresolved_venues
  where dismissed
    and normalized in (
      'yogaseniorturma1',
      'yogaseniorturma2',
      'torneiodetiroaoalvocompressaodear',
      'iiprovaderesistenciaterranteztrailteam',
      'ixdownhillurbanoemconstancianodia12desetembro2026',
      'inicionapraiafluvialdeconstancia',
      'estemestambemvamosteraatividadedomingodepraca'
    );
  -- Numa base nova a fila está vazia e não há nada para marcar; no projeto
  -- real são os sete. Qualquer número entre os dois é uma fila em movimento,
  -- que é o que ela é.
  if v_marcados > 7 then
    raise exception 'marcaram-se % linhas, e só há sete nomes na lista', v_marcados;
  end if;

  select count(*) into v_pavilhao
  from public.unresolved_venues
  where normalized = 'pavilhaoanasonca' and dismissed;
  if v_pavilhao <> 0 then
    raise exception 'o Pavilhão Ana Sonça é um sítio a sério e não podia ter sido marcado';
  end if;
end
$$;
