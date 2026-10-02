-- 0166 — As palavras da casa ficam em casa.
--
-- «Montra» é o nome que a casa dá, por dentro, à região de demonstração e à
-- página do produto (`docs/NARRATIVA.md` §9), e nunca se escreve a quem
-- visita. Escorregou para três textos que a base serve (C1-005, C2-042,
-- C4-009), todos semeados pela casa e nenhum escrito por quem organiza:
--
-- - o lema da demonstração, que é a descrição de partilha dela — o texto que o
--   WhatsApp ou o email mostram por baixo da ligação quando alguém a manda a
--   quem decide: «A montra do Coreto — a agenda cultural que cada região pode
--   ter.» (0110);
-- - a história das «Informações» da demonstração: «Esta montra mostra o
--   produto…» (0110);
-- - a nota pública das duas fontes de demonstração na `/fontes`: «Fonte de
--   demonstração da montra…» (0122).
--
-- **Só onde o texto ainda é o semeado.** O lema compara-se por inteiro, e a
-- história e as notas trocam a frase e deixam o resto: quem já reescreveu o
-- texto no painel escreveu outra coisa, e esta migração não lha desfaz.
--
-- O que impede o regresso está em dois sítios: as `schema-checks.sql` recusam
-- uma base onde um texto da casa diga uma destas palavras, e o
-- `scripts/verificar-regioes.mjs` varre o texto servido das páginas de cada
-- domínio — com a lista do `scripts/glossario-interno.mjs`, a mesma que o
-- `check:afirmacoes` aplica ao código.

update public.regions
   set tagline = 'Uma agenda cultural a funcionar sobre um território inventado — o que cada região pode ter.'
 where id = 'vale-do-coreto'
   and tagline = 'A montra do Coreto — a agenda cultural que cada região pode ter.';

update public.regions
   set about_story = replace(about_story, 'Esta montra mostra o produto', 'Esta demonstração mostra o produto')
 where id = 'vale-do-coreto'
   and about_story like '%Esta montra mostra o produto%';

update public.sources
   set public_note = replace(public_note, 'Fonte de demonstração da montra:', 'Fonte de demonstração:')
 where public_note like 'Fonte de demonstração da montra:%';

do $$
declare
  n integer;
begin
  select count(*) into n from public.regions
   where id = 'vale-do-coreto'
     and (tagline ~* '\mmontra\M' or about_story ~* '\mmontra\M');
  assert n = 0, 'a demonstração continua a dizer «montra» no lema ou na história';

  select count(*) into n from public.sources where public_note ~* '\mmontra\M';
  assert n = 0, format('%s notas públicas de fontes continuam a dizer «montra»', n);
end
$$;
