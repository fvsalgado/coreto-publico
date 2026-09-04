-- 0052 — O politécnico mudou de nome, e mais seis espaços passam a dizer o que são.
--
-- A sondagem da 0051 foi buscar a agenda do politécnico de Tomar e a página
-- veio com outro nome no título: «Universidade Politécnica de Tomar». Não é
-- gralha nem marca de campanha — é a designação oficial desde 1 de agosto de
-- 2026, ao abrigo da Lei n.º 16/2023, depois de a A3ES ter dado ao instituto
-- acreditação institucional pelo prazo máximo e sem condições. Treze
-- politécnicos públicos mudaram de nome no mesmo dia; o de Tomar é um deles.
--
-- A natureza do ensino não muda. O que muda é o nome que esta agenda escreve
-- na ficha de um espaço da região, e um nome errado numa ficha pública é um
-- erro de dados como outro qualquer.
--
-- O identificador `ipt` fica como está. Um `id` é uma chave, não um rótulo:
-- muda-lo partia os endereços `/espaco/ipt` que já andam por aí e a ligação
-- da fonte `ipt-agenda` que a 0051 acabou de criar. Quem quiser o nome novo
-- lê-o onde ele conta, que é na página.
--
-- A seguir, mais seis apresentações, de fonte primária ou de facto assente.

update public.venues
   set name = 'Universidade Politécnica de Tomar',
       short_name = 'UPT',
       description = 'O ensino superior do Médio Tejo, em Tomar desde 1973. Adotou o nome de Universidade Politécnica a 1 de agosto de 2026, depois de acreditação da A3ES pelo prazo máximo. Tem agenda própria, com conferências, concertos e exposições abertos à cidade.',
       updated_at = now()
 where id = 'ipt';

update public.venues v
   set description = novo.description,
       updated_at = now()
  from (values
    ('aquapolis-abrantes',
     'A requalificação das duas margens do Tejo entre as pontes, feita pelo Programa Polis e inaugurada em junho de 2007. São quinze hectares de parque com anfiteatro, praia fluvial, ciclovia, circuitos de manutenção e zona de merendas — e é aqui que se faz o Mercado Ribeirinho.'),
    ('igreja-da-misericordia-tomar',
     'A Misericórdia de Tomar foi fundada no início do século XVI por ordem de D. Manuel I, e a igreja veio depois. É maneirista: nave única de colunas jónicas, teto de madeira em masseira, azulejo enxaquetado e pintura quinhentista. A igreja e o hospital foram remodelados na segunda metade do século XVIII.'),
    ('santuario-de-fatima',
     'Na Cova da Iria, erguido a partir de 1917 em torno da Capelinha das Aparições. Tem duas basílicas — a de Nossa Senhora do Rosário, do século XX, e a da Santíssima Trindade, aberta em 2007 — e recebe romeiros o ano inteiro, com os dias 12 e 13 de cada mês entre maio e outubro como os de maior afluência.'),
    ('centro-pastoral-paulo-vi',
     'O grande auditório do Santuário de Fátima, onde se fazem os congressos, os encontros e os espetáculos que não cabem no recinto. Tem também salas de exposição.'),
    ('cineclube-torres-novas',
     'O cineclube da cidade, que programa cinema de autor ao longo da época. As sessões são no Teatro Virgínia, e é de lá que entram nesta agenda, com hora e classificação etária.')
  ) as novo(id, description)
 where v.id = novo.id
   and v.description is null;

-- ---------------------------------------------------------------------------
do $$
declare
  v_nome integer;
  v_caderno integer;
begin
  select count(*) into v_nome from public.venues
    where id = 'ipt' and name = 'Universidade Politécnica de Tomar';
  if v_nome <> 1 then
    raise exception 'o politécnico de Tomar não ficou com o nome novo';
  end if;

  -- A mesma rede da 0050: o caderno de pesquisa não sai da moderação.
  select count(*) into v_caderno from public.venues
    where description ~* '(por confirmar no terreno|ATENÇÃO|coerência de critério|nenhum resultado|a confirmar junto|não encontrámos|falta quem confirme)';
  if v_caderno > 0 then
    raise exception '% descrições de espaço com linguagem de caderno de pesquisa', v_caderno;
  end if;
end
$$;
