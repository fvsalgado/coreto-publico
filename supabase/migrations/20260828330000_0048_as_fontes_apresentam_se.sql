-- 0048 — As fontes apresentam-se.
--
-- «Cada evento aponta para a fonte de onde veio» está escrito no /sobre desde
-- o primeiro dia, e até aqui só se via evento a evento. Quem quisesse a
-- pergunta inteira — que fontes é que esta agenda lê, e o que é que fica de
-- fora — não tinha onde a fazer.
--
-- Passa a ter: a página /fontes. E como uma página pública não pode ler
-- `sources.notes` — que é o caderno da recolha, com estados de HTTP, datas de
-- avaria e decisões de configuração —, cada fonte ganha aqui uma linha
-- escrita para quem lê. É a terceira vez que esta casa faz a mesma separação
-- (espaços, coretos, agora fontes), e é a mesma regra: o que a máquina precisa
-- de saber e o que uma pessoa quer ler não são o mesmo texto.

alter table public.sources add column if not exists public_note text;

comment on column public.sources.public_note is
  'Uma linha sobre esta fonte, escrita para a página pública. Nunca o caderno da recolha — esse é `notes`.';

update public.sources set public_note = 'A agenda publicada pelo município, lida pela interface do próprio sítio. A recolha foi autorizada pela câmara.'
  where id = 'cm-abrantes';
update public.sources set public_note = 'A agenda publicada pelo município.'
  where id in ('cm-alcanena', 'cm-constancia', 'cm-entroncamento', 'cm-ferreiradozezere',
               'cm-macao', 'cm-sardoal', 'cm-vnbarquinha');
update public.sources set public_note = 'A agenda publicada pelo município, pela interface aberta do serviço municipal de associativismo.'
  where id = 'cm-ourem';
update public.sources set public_note = 'A agenda publicada pelo município. Os avisos que ela traz a par da programação — inscrições, horários de piscina — ficam de fora por decisão editorial: não são eventos.'
  where id = 'cm-tomar';
update public.sources set public_note = 'A programação do Cine-Teatro Paraíso, do sítio da própria sala, com todas as sessões de cada espetáculo.'
  where id = 'cine-teatro-paraiso';
update public.sources set public_note = 'As sessões de cinema do Cineclube de Torres Novas no Teatro Virgínia: a época inteira, com hora, duração e classificação etária.'
  where id = 'teatro-virginia';
update public.sources set public_note = 'O CAMINHOS, programação cultural em rede da Comunidade Intermunicipal do Médio Tejo — os ciclos que atravessam vários concelhos e que, vistos concelho a concelho, nunca se leem como o que são.'
  where id = 'caminhos-cimt';

update public.sources set public_note = 'A agenda do município está identificada e configurada, mas o servidor responde «Application Blocked» a quem a vem ler — a nós e a qualquer outro. Contornar um bloqueio não é recolher, é entrar sem ser convidado, e não é o que esta casa faz: a via é a câmara autorizar o endereço do recoletor. Até lá, Torres Novas entra por email e pelas sessões do Teatro Virgínia.'
  where id = 'cm-torresnovas';
update public.sources set public_note = 'Agendas mensais e quadrimestrais em PDF. Ainda não está ligada: cada endereço é confirmado à mão antes de entrar.'
  where id = 'agendas-pdf-medio-tejo';

update public.sources set updated_at = now() where public_note is not null;

-- ---------------------------------------------------------------------------
do $$
declare
  v_sem_nota integer;
begin
  select count(*) into v_sem_nota from public.sources
    where public_note is null or btrim(public_note) = '';
  if v_sem_nota > 0 then
    raise exception '% fontes ficaram sem linha pública — a página /fontes mostra-as todas', v_sem_nota;
  end if;
end
$$;
