-- 0022 — Os endereços verdadeiros, e a honestidade sobre os quatro que faltam.
--
-- As dezasseis fontes foram semeadas com um molde: `/pt/agenda`. Nenhum dos
-- treze sites o serve. O molde foi escrito por analogia e nunca confrontado
-- com um site — e a sondagem de 28 de agosto provou-o do executor do GitHub
-- Actions, que é de onde a recolha corre: 404 em Tomar, Alcanena e Sertã, e o
-- mesmo padrão nos restantes.
--
-- Esta migração corrige os endereços a partir do que foi lido, liga o
-- adaptador `joomla-eventbooking` aos que o servem, e desliga com uma razão
-- escrita os que não podem funcionar hoje. Ver `docs/PLANO-DADOS.md`.

-- ---------------------------------------------------------------------------
-- Os nove que respondem, e que correm todos a mesma extensão do Joomla.
--
-- Não há molde: dois deixam cair o `www.` porque redirecionam para o domínio
-- nu, a agenda de Mação chama-se `eventos` e a da Sertã `agendaserta`. Cada
-- endereço é o que é, e foi lido um a um.
-- ---------------------------------------------------------------------------
update public.sources set
  url = 'https://cm-alcanena.pt/index.php/comunicacao/agenda',
  adapter = 'joomla-eventbooking', min_expected_items = 1
where id = 'cm-alcanena';

update public.sources set
  url = 'https://www.cm-constancia.pt/comunicacao/agenda',
  adapter = 'joomla-eventbooking', min_expected_items = 1
where id = 'cm-constancia';

update public.sources set
  url = 'https://www.cm-entroncamento.pt/index.php/agenda',
  adapter = 'joomla-eventbooking', min_expected_items = 1
where id = 'cm-entroncamento';

update public.sources set
  url = 'https://cm-ferreiradozezere.pt/comunicacao/agenda',
  adapter = 'joomla-eventbooking', min_expected_items = 1
where id = 'cm-ferreiradozezere';

update public.sources set
  url = 'https://www.cm-macao.pt/index.php/comunicacao/eventos',
  adapter = 'joomla-eventbooking', min_expected_items = 1
where id = 'cm-macao';

update public.sources set
  url = 'https://www.cm-sardoal.pt/comunicacao/agenda',
  adapter = 'joomla-eventbooking', min_expected_items = 1
where id = 'cm-sardoal';

update public.sources set
  url = 'https://www.cm-serta.pt/comunicacao/agendaserta',
  adapter = 'joomla-eventbooking', min_expected_items = 1
where id = 'cm-serta';

update public.sources set
  url = 'https://www.cm-tomar.pt/comunicacao/agenda',
  adapter = 'joomla-eventbooking', min_expected_items = 1
where id = 'cm-tomar';

update public.sources set
  url = 'https://www.cm-viladerei.pt/index.php/comunicacao/agenda',
  adapter = 'joomla-eventbooking', min_expected_items = 1
where id = 'cm-viladerei';

-- `min_expected_items = 1` nos nove é deliberado.
--
-- Com o valor a zero, uma recolha que não traga nada é uma execução verde — e
-- uma agenda que desaparece em silêncio é a falha que este projeto mais teme.
-- Todos os nove serviam pelo menos um evento na sondagem; exigir um é o
-- limiar mais conservador que ainda transforma o zero em aviso. Afinam-se com
-- dados, ao fim de sete noites, como o plano prevê.

-- ---------------------------------------------------------------------------
-- Os quatro que não podem funcionar hoje.
--
-- Ficam com o endereço certo e desligadas, cada uma com a razão escrita. Uma
-- fonte ligada que não consegue responder falha todas as noites, abre o
-- disjuntor e enche o registo de ruído que ninguém lê ao fim da terceira vez.
--
-- Desligar não é desistir: os quatro concelhos continuam a entrar pelas outras
-- duas vias — email e formulário — e o sítio mostra-os com o que tiver. Um
-- concelho a zero, dito como tal, é honesto.
-- ---------------------------------------------------------------------------

update public.sources set
  url = 'https://www.cm-vnbarquinha.pt/index.php/viver/agenda',
  adapter = 'joomla-eventbooking',
  is_enabled = false,
  notes = 'Desligada a 2026-08-28. O servidor não completa a ligação TLS, e não '
       || 'é do intermediário: falha também do executor do GitHub Actions, em '
       || 'HTML e em RSS. O endereço fica certo para o dia em que responder — '
       || 'é a mesma extensão dos outros nove e o adaptador já a serve.'
where id = 'cm-vnbarquinha';

update public.sources set
  url = 'https://sitecmaproxy.cm-abrantes.pt/proxy/agenda/eventos',
  is_enabled = false,
  notes = 'Desligada a 2026-08-28. O município migrou para uma aplicação '
       || 'Flutter cuja API está restringida à origem do próprio site: '
       || 'sitecmaproxy.cm-abrantes.pt responde 403 «Origem não autorizada». '
       || 'Contornar essa restrição forjando um cabeçalho Origin é trivial e '
       || 'não se faz — é um controlo de acesso explícito. A via é pedir, pela '
       || 'CIM, e é um pedido fácil: a API já existe e já é pública em tudo '
       || 'menos na origem autorizada.'
where id = 'cm-abrantes';

update public.sources set
  url = 'https://www.cm-torresnovas.pt/',
  is_enabled = false,
  notes = 'Desligada a 2026-08-28. O site responde 503 «Application Blocked» '
       || 'de um WAF, também ao executor do GitHub Actions — não é reputação '
       || 'do endereço de quem sondou. A via é pedir autorização para o agente '
       || 'do Coreto, pela CIM.'
where id = 'cm-torresnovas';

update public.sources set
  url = 'https://servicos.ourem.pt/api/index.php?service=list_eventos',
  is_enabled = false,
  notes = 'Desligada a 2026-08-28. Ourém publica uma API JSON pública e rica — '
       || 'servicos.ourem.pt/api/index.php?service=list_eventos — com '
       || 'identificador estável, datas em ISO, hora, sinopse, imagem, local e '
       || 'coordenadas. É a melhor fonte do território e nenhuma outra enche '
       || 'hoje os campos de geolocalização. Falta o adaptador que a lê; o '
       || 'endereço semeado apontava para outro sítio e não serve. Fase 2.1 do '
       || 'plano de dados.'
where id = 'cm-ourem';

-- ---------------------------------------------------------------------------
-- As duas fontes de equipamento que já estavam ligadas.
--
-- Não foi a sondagem que as mudou — ambas respondem 200 e ficam como estão.
-- Mas estavam com o mínimo esperado a zero, e a asserção nova não abre
-- exceções: uma fonte ligada declara o que espera trazer, ou uma bilheteira
-- que esvazia passa despercebida como uma agenda que esvazia.
--
-- Um é o limiar mais conservador possível, e é verdade de qualquer fonte que
-- esteja a funcionar.
-- ---------------------------------------------------------------------------
update public.sources set min_expected_items = 1
where id in ('teatro-virginia', 'cine-teatro-paraiso');

-- ---------------------------------------------------------------------------
-- Uma trava contra o engano que deu origem a tudo isto.
--
-- O molde `/pt/agenda` sobreviveu porque nada o contrariava. Se voltar — numa
-- migração futura, num seed copiado, num `update` à pressa —, a asserção
-- rebenta aqui em vez de produzir treze recolhas vazias em silêncio.
-- ---------------------------------------------------------------------------
do $$
declare
  moldes int;
begin
  select count(*) into moldes from public.sources where url like '%/pt/agenda%';
  if moldes > 0 then
    raise exception 'ainda há % fontes com o molde /pt/agenda, que nenhum destes sites serve', moldes;
  end if;
end
$$;
