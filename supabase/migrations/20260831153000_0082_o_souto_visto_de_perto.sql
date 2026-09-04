-- 0082 — O Souto visto de perto, e uma dúvida que passa a estar escrita.
--
-- O dono encontrou o Coreto do Souto no Google Street View (captura de março
-- de 2025) e mandou a imagem. Não se copia daqui nenhuma fotografia — as do
-- Street View são da Google e não se republicam —, mas ver o coreto muda três
-- coisas, e as três entram.
--
-- ## I — A coordenada estava certa
--
-- Confirmada contra o OSM: 39.57600,-8.23482 é a própria Praça Luís de Camões
-- (a pesquisa pelo nome da praça devolve exactamente este ponto, e a geocodifi-
-- cação inversa do ponto devolve exactamente esta praça). O que estava gravado
-- fica como está; passa é a estar verificado por duas vias e não por uma.
--
-- ## II — A descrição fica mais rica, e mais honesta
--
-- O que se vê e não estava escrito: base de alvenaria caiada, pintada de azul
-- e branco, com janelas redondas gradeadas; guarda de cor terracota com um
-- friso recortado em triângulos; colunas azuis; telhado de telha com cata-vento
-- ao centro; e a igreja mesmo ao lado, que a descrição já dizia e a imagem
-- confirma. As janelas redondas provam o piso fechado por baixo, que é o que
-- justifica a «escada interior» já registada.
--
-- ## III — A planta sai da descrição pública
--
-- A descrição dizia «planta hexagonal», vindo do levantamento local «Coretos
-- do Concelho de Abrantes» (2008) — fonte a sério, e é por isso que não se
-- apaga. Mas na imagem contam-se cinco faces na base, e cinco faces só se veem
-- de um octógono: de um hexágono veem-se três, quatro no limite.
--
-- Uma leitura de uma fotografia oblíqua não derruba um levantamento de campo,
-- e um levantamento de 2008 não derruba o que hoje se vê. Não se decide aqui:
-- tira-se a planta da descrição pública — que fica com o que é certo, e o que
-- é certo é bastante — e a dúvida passa a estar escrita no caderno, para quem
-- lá for a resolver de vez. Publicar «hexagonal» a torcer para que esteja
-- certo é o oposto do que esta casa faz com um campo de que não tem a certeza.

update public.coretos set
  description =
    'Na Praça Luís de Camões, ao lado da igreja. Base de alvenaria caiada em '
    'azul e branco, com janelas redondas gradeadas que dão luz ao piso fechado '
    'por baixo; guarda de cor terracota com friso recortado em triângulos, '
    'colunas azuis e telhado de telha com cata-vento. Sobe-se por uma escada '
    'interior.',
  notes = coalesce(notes, '') ||
    ' Visto no Google Street View (captura de 03/2025, Praça Luís de Camões, '
    'Souto) — nenhuma imagem de lá é reproduzida no sítio, que as do Street '
    'View são da Google. Duas coisas ficaram desse avistamento. A coordenada '
    'confirma-se por segunda via: no OSM, a pesquisa por «Praça Luís de Camões, '
    'Souto» devolve 39.57600,-8.23482 e a geocodificação inversa desse ponto '
    'devolve a mesma praça. E fica uma dúvida por resolver no terreno: o '
    'levantamento local de 2008 diz planta hexagonal, mas na imagem contam-se '
    'cinco faces na base, o que aponta para octogonal — de um hexágono veem-se '
    'três, quatro no limite. Enquanto não se decidir, a planta não entra na '
    'descrição pública. Continua a faltar fotografia livre: nada no Wikimedia '
    'Commons nem no inventário «Reanimar os Coretos em Portugal», que não tem '
    'este coreto.',
  updated_at = now()
where id = 'coreto-souto-praca-luis-de-camoes';

-- A ficha de espaço lê a mesma descrição: as duas não podem divergir.
update public.venues set
  description = (select description from public.coretos where id = 'coreto-souto-praca-luis-de-camoes'),
  updated_at = now()
where id = 'coreto-souto';

do $$
declare
  publica text;
  espaco  text;
begin
  select description into publica from public.coretos where id = 'coreto-souto-praca-luis-de-camoes';
  select description into espaco  from public.venues  where id = 'coreto-souto';

  -- A dúvida não pode escapar para a descrição pública por distração.
  if publica ~* 'hexagonal|octogonal' then
    raise exception 'a planta voltou à descrição pública do Souto, e está por decidir';
  end if;

  if publica is distinct from espaco then
    raise exception 'a descrição do coreto e a do espaço divergiram';
  end if;

  raise notice 'Souto: descrição actualizada, planta por decidir no terreno';
end
$$;
