-- 0123 — O Auditório Cultural dos Paços do Concelho de Ourém entra no catálogo.
--
-- Esta migração já correu em produção: a 1 de setembro de 2026, às 09:37,
-- pela API do Supabase, com o nome «0100_o_auditorio_de_ourem_entra_no_
-- catalogo». O ficheiro nunca chegou ao repositório — o número 0100 foi
-- entretanto ocupado por outra, e o ramo onde este vivia ficou para trás. A
-- conciliação do registo de migrações (`scripts/conciliar-registo.sh`)
-- encontrou a linha sem ficheiro, e o espaço estava na base, com três alias
-- e sem um único evento a apontar-lhe.
--
-- A regra da casa é que a base se reconstrói do repositório: uma base nova
-- tem de nascer com o que a de produção tem. Por isso a migração volta, com
-- o número seguinte e o texto que correu, palavra por palavra. É idempotente
-- — `on conflict do nothing` no espaço e nos alias — e em produção não
-- escreve nada: o registo passa a apontar a linha de 1 de setembro a este
-- ficheiro, e é tudo.
--
-- O texto original, a partir daqui:
--
-- Apareceu na varredura ao TUR4all de 1 de setembro, quando eu procurava
-- acessibilidade e não espaços. Edifício do século XIX reabilitado para uso
-- cultural em 2014, com cerca de cem lugares — programa, e não estava cá.
--
-- Três coisas que não se copiaram do TUR4all: o sítio (aponta
-- museu.cm-ourem.pt, que a 0092 provou não existir), o email (três grafias
-- entre fontes — fica a do Museu Municipal, mesmo serviço, já verificada) e
-- a praça (o OSM tem os Paços na Praça Dona Maria II, a 65 m; fica a morada
-- do TUR4all, que traz número de porta).

insert into public.venues (
  id, name, municipality_id, parish, kind, status, is_association,
  address, postal_code, latitude, longitude,
  website_url, phone, email,
  wheelchair_accessible, accessibility_notes,
  description, notes
) values (
  'auditorio-pacos-concelho-ourem',
  'Auditório Cultural dos Paços do Concelho de Ourém',
  'ourem',
  'Nossa Senhora da Piedade',
  'auditorium', 'active', false,
  'Praça do Município, 11', '2490-499', 39.657620, -8.578380,
  'https://www.ourem.pt/areas-de-acao/cultura/museu/',
  '+351 919 585 003',
  'museu@mail.cm-ourem.pt',
  true,
  'Avaliado pelo TUR4all. Entrada acessível, com porta de 78 cm ou mais e o nome do espaço bem '
  'visível. Circulação em cadeira de rodas total, iluminação adequada e sem obstáculos para quem '
  'tem baixa visão. A casa de banho é adaptada, sem desnível no acesso, com 150 cm de espaço de '
  'manobra, sanita alta e barra de apoio do lado direito — mas a porta, de correr, tem menos de '
  '78 cm. Cães de assistência são permitidos e há pessoal de atendimento. A ficha não avalia '
  'rampa, elevador, lugares reservados na sala nem estacionamento. O TUR4all não data a avaliação.',
  'Sala multiusos num edifício do século XIX, reabilitado e convertido para uso cultural em 2014. '
  'Tem cerca de cem lugares sentados em 130 m², e é onde o município recebe o que não cabe no '
  'teatro — conferências, sessões, pequenos espetáculos.',
  'Criado pela 0100, a partir da ficha do TUR4all encontrada na varredura de acessibilidade de '
  '01/09/2026. Ponto do OpenStreetMap para a Praça do Município, que é a morada que o TUR4all dá. '
  'Os Paços do Concelho aparecem no OSM na Praça Dona Maria II, a 65 m — as duas praças existem e '
  'o edifício faz esquina. Código postal confirmado por três fontes. NÃO usar museu.cm-ourem.pt, '
  'que o TUR4all indica: esse domínio não existe (ver 0092). O email diverge entre fontes '
  '(museu@cm-ourem.pt no TUR4all, museu@cm.ourem.pt numa pesquisa) — fica o do Museu Municipal, '
  'que é o mesmo serviço e já passou por verificação.'
)
on conflict (id) do nothing;

insert into public.venue_aliases (alias, venue_id, municipality_id) values
  (public.normalize_for_hash('Auditório Cultural dos Paços do Concelho de Ourém'),
   'auditorio-pacos-concelho-ourem', 'ourem'),
  (public.normalize_for_hash('Auditório dos Paços do Concelho'),
   'auditorio-pacos-concelho-ourem', 'ourem'),
  (public.normalize_for_hash('Auditório Cultural dos Paços do Concelho'),
   'auditorio-pacos-concelho-ourem', 'ourem')
on conflict do nothing;

-- ---------------------------------------------------------------------------
do $$
declare
  n      integer;
  metros numeric;
begin
  select count(*) into n
  from public.venues
  where id = 'auditorio-pacos-concelho-ourem'
    and (latitude is null or longitude is null or address is null or description is null
         or accessibility_notes is null);

  if n > 0 then
    raise exception 'o auditório de Ourém entrou sem ponto, morada, descrição ou nota de acesso';
  end if;

  select count(*) into n
  from public.venues
  where id = 'auditorio-pacos-concelho-ourem'
    and accessibility_notes !~* 'menos de 78 cm';

  if n > 0 then
    raise exception 'saiu da nota a ressalva da porta da casa de banho do auditório de Ourém';
  end if;

  select count(*) into n
  from public.venues
  where id = 'auditorio-pacos-concelho-ourem'
    and (website_url like '%museu.cm-ourem.pt%' or website_url like '%museu2.cm-ourem.pt%');

  if n > 0 then
    raise exception 'o auditório de Ourém entrou a apontar para um domínio que não existe';
  end if;

  select 111.32 * sqrt(power(latitude - 39.6570, 2)
                     + power((longitude + 8.5780) * cos(radians(latitude)), 2))
    into metros
  from public.venues where id = 'auditorio-pacos-concelho-ourem';

  if metros is not null and metros > 15 then
    raise exception 'o auditório de Ourém ficou a % km do centro do concelho', round(metros);
  end if;

  select count(*) into n
  from public.venue_aliases
  where venue_id = 'auditorio-pacos-concelho-ourem';
  if n < 3 then
    raise exception 'o auditório de Ourém ficou com % alias, e são três', n;
  end if;

  select count(*) into n from public.venues where accessibility_notes is not null;
  raise notice '% espaços dizem como se entra', n;
  select count(*) into n from public.venues;
  raise notice 'o catálogo passa a ter % espaços', n;
end
$$;
