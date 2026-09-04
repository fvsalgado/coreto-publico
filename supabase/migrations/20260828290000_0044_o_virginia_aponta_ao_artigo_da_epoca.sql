-- 0044 — O Virgínia aponta ao artigo da época, não ao índice dela.
--
-- A 0042 pôs a fonte a apontar para `/index.php/cinema`, com o argumento de
-- que a categoria «serve sempre a época corrente» e assim a fonte não expirava
-- em janeiro. O argumento estava certo; a leitura da página estava errada.
--
-- O erro foi de método, e vale a pena escrevê-lo: capturaram-se as duas
-- páginas em sequência para o mesmo ficheiro, e a segunda apagou a primeira.
-- O que se testou como sendo a categoria era, afinal, o artigo. A categoria
-- serve só as ligações dos artigos por ano — não traz uma única sessão.
--
-- A primeira recolha mostrou-o em cheio: zero itens. Nada foi escrito, porque
-- o guarda de contagem fez exatamente o que existe para fazer (0 contra um
-- mínimo de 3).
--
-- A correção é dupla. A fonte passa a apontar ao artigo da época
-- (`/index.php/cinema/cinema`, que hoje serve «Cinema 2026» e responde com as
-- sessões todas). E o adaptador deixa de depender disso: quando a página que
-- recebe não tem sessões — porque é o índice, ou porque o artigo do ano mudou
-- de endereço —, segue a primeira ligação de artigo que lá encontrar, que é a
-- do ano corrente. A fonte deixa de poder secar em silêncio numa passagem de
-- ano.

update public.sources set
  url = 'https://www.teatrovirginia.pt/index.php/cinema/cinema',
  consecutive_failures = 0,
  circuit_open_until = null,
  last_error = null,
  notes = coalesce(notes || ' ', '') || 'Corrigido a 2026-08-28: apontava para /index.php/cinema, que é o índice da categoria e não traz sessões (a primeira recolha devolveu 0 e o guarda de contagem travou a escrita). Passa a apontar ao artigo da época; e o adaptador, se receber uma página sem sessões, segue sozinho a ligação do artigo mais recente.',
  updated_at = now()
where id = 'teatro-virginia';

-- ---------------------------------------------------------------------------
do $$
declare
  v_url text;
begin
  select url into v_url from public.sources where id = 'teatro-virginia';
  if v_url <> 'https://www.teatrovirginia.pt/index.php/cinema/cinema' then
    raise exception 'a fonte do Virgínia devia apontar ao artigo da época, e aponta para %', v_url;
  end if;
end
$$;
