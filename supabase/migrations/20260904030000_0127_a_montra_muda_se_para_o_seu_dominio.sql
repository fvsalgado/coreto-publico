-- 0127 — A montra sai do coreto.org e passa a viver no demo.coreto.org.
--
-- O `coreto.org` era a montra: a região `vale-do-coreto`, com dois concelhos
-- inventados, oito espaços e trinta eventos que nunca aconteceram, a servir
-- `/agenda`, `/mapa` e `/espacos` a 200 — lugares imaginários num mapa
-- verdadeiro. Quem escrevia o endereço do produto para saber o que o produto
-- é encontrava uma agenda a fingir que era uma.
--
-- Passa a haver um endereço para cada coisa:
--
--   coreto.org           a ficha técnica, que não é de região nenhuma
--   demo.coreto.org      esta região, a demonstração, que diz que é
--   mediotejo.coreto.org a agenda a sério
--
-- **O `coreto.org` deixa de estar no mapa de domínios de propósito.** É isso
-- que o faz cair na página do produto (`app/pagina-do-produto`), que não toca
-- na base — a mesma que responde a qualquer anfitrião desconhecido. A
-- escotilha `REGIAO_DE_OMISSAO` tem de estar fechada no ambiente para isto
-- valer; ver `docs/VERCEL.md`.

update public.regions
   set domain          = 'demo.coreto.org',
       ical_uid_domain = 'demo.coreto.org',
       updated_at      = now()
 where id = 'vale-do-coreto';

-- O `www.coreto.org` era alias desta região, e um alias serve para o
-- middleware redirecionar para o canónico dela. Com a montra fora do
-- `coreto.org`, esse mecanismo mandaria o `www` para a demonstração — que é o
-- contrário do que quem o escreve quer.
--
-- Sai da tabela e passa a ser o que sempre devia ter sido: um
-- redirecionamento de anfitrião, tratado no painel de domínios da Vercel,
-- antes de o pedido chegar à aplicação. Um alias pertence a uma região; o
-- `coreto.org` deixou de ter uma.
delete from public.region_domain_aliases
 where domain = 'www.coreto.org';

-- A demonstração continua a poder ser alcançada pelo nome curto se um dia se
-- quiser, mas hoje não há alias nenhum a apontar-lhe: o endereço é um só, e um
-- só endereço não tem conteúdo duplicado para resolver.

do $$
declare
  dominio text;
  alias_a_mais integer;
begin
  select domain into dominio from public.regions where id = 'vale-do-coreto';
  if dominio is distinct from 'demo.coreto.org' then
    raise exception 'a montra ficou em % em vez de demo.coreto.org', dominio;
  end if;

  select count(*) into alias_a_mais
    from public.region_domain_aliases
   where domain in ('www.coreto.org', 'coreto.org');
  if alias_a_mais <> 0 then
    raise exception 'ficaram % alias a apontar ao coreto.org', alias_a_mais;
  end if;

  -- E o principal: nenhuma região reclama o coreto.org, que é o que deixa a
  -- ficha técnica responder lá.
  if exists (select 1 from public.regions where domain = 'coreto.org') then
    raise exception 'ainda há uma região com o domínio coreto.org';
  end if;
end $$;
