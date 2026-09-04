-- 0125 — A montra responde pelo endereço que existe.
--
-- A 0110 deu à região montra o `contact_email` `ola@coreto.org`, escolhido
-- quando o `coreto.org` ainda não tinha correio nenhum: era um endereço
-- bonito para uma caixa que se criaria depois. A caixa nunca foi criada, e a
-- decisão do dono é que não seja — no Purelymail existe uma, `fabio@`, e um
-- alias a mais é mais uma coisa para manter.
--
-- Entretanto o endereço deixou de ser decoração. A montra mostra-o, o
-- `/.well-known/security.txt` publica-o como contacto de segurança (RFC 9116)
-- e os feeds levam-no. **Um contacto de segurança que não recebe é pior do
-- que não ter contacto nenhum**: quem encontra uma falha escreve, não obtém
-- resposta, e conclui — com razão — que ninguém está a ouvir. O que se segue
-- a esse silêncio costuma ser a divulgação pública.
--
-- O par desta linha está em `apps/web/src/lib/produto.ts`, que guarda o mesmo
-- endereço para a página do produto servida a anfitriões desconhecidos — a
-- que tem de aguentar a base de dados em baixo, e por isso não a consulta.
-- Mudar um sem o outro põe dois contactos diferentes no mesmo sítio.

update public.regions
   set contact_email = 'fabio@coreto.org'
 where id = 'vale-do-coreto'
   and contact_email = 'ola@coreto.org';

do $$
begin
  if exists (
    select 1 from public.regions where contact_email = 'ola@coreto.org'
  ) then
    raise exception 'ainda há regiões com o ola@coreto.org';
  end if;
end
$$;
