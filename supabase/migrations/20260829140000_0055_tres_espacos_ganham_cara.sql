-- 0055 — Três espaços ganham cara.
--
-- Trinta e cinco dos oitenta espaços não tinham fotografia. Procurou-se no
-- Wikimedia Commons, um a um, e encontraram-se três com correspondência que
-- não deixa dúvida no nome e no lugar. Os endereços foram pedidos e voltaram
-- `200 image/jpeg`, com tamanho: um `Special:FilePath` que responde 404 é uma
-- moldura vazia na grelha.
--
-- O que **não** entrou, e porquê: a pesquisa por «Centro Cultural de Vila
-- Nova da Barquinha» devolveu três fotografias do **Centro Cultural Municipal
-- de Tancos**. Tancos é do mesmo concelho e não é o mesmo edifício. Já uma
-- vez este catálogo teve fotografias de coretos de outra região a fazer de
-- coretos daqui, e a regra que ficou dessa vez é esta: nome parecido não é
-- prova, e sem prova não entra.
--
-- O Teatro Municipal de Ourém e o Cine-Teatro Municipal de Ourém são o mesmo
-- edifício — o cineteatro foi recuperado e mudou de nome —, o que ficou
-- confirmado antes de a fotografia entrar, e traz de caminho a descrição.

update public.venues v
   set image_url = novo.image_url,
       image_credit = novo.image_credit,
       updated_at = now()
  from (values
    ('cine-teatro-sao-joao-entroncamento',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Cine-Teatro_S%C3%A3o_Jo%C3%A3o_no_Entroncamento_-_Vista_frontal_para_fachada_principal.jpg?width=1600',
     'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons'),
    ('teatro-municipal-ourem',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Fachada_principal_do_Cine-Teatro_Municipal_de_Our%C3%A9m.jpg?width=1600',
     'Threeohsix, CC BY-SA 4.0, via Wikimedia Commons'),
    ('biblioteca-municipal-ferreira-do-zezere',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Biblioteca_Municipal_de_Ferreira_do_Z%C3%AAzere_-_Portugal_%285003364233%29.jpg?width=1600',
     'Vitor Oliveira (Torres Vedras), CC BY-SA 2.0, via Wikimedia Commons')
  ) as novo(id, image_url, image_credit)
 where v.id = novo.id
   and v.image_url is null;

update public.venues
   set description = 'O antigo cineteatro de Ourém, recuperado e reaberto com outro nome. O edifício é do arquiteto J. P. Hamard, de linguagem brutalista e construção pré-fabricada, e mantém a traça de cineteatro. A sala principal tem 441 lugares, teia e boca de cena — recebe espetáculos e cinema.',
       updated_at = now()
 where id = 'teatro-municipal-ourem'
   and description is null;

-- ---------------------------------------------------------------------------
do $$
declare
  v_sem_credito integer;
  v_credito_orfao integer;
begin
  -- Uma fotografia do Commons sem crédito é um incumprimento da licença, e as
  -- licenças desta casa cumprem-se.
  select count(*) into v_sem_credito from public.venues
    where image_url is not null and (image_credit is null or btrim(image_credit) = '');
  if v_sem_credito > 0 then
    raise exception '% espaços com fotografia e sem crédito', v_sem_credito;
  end if;

  select count(*) into v_credito_orfao from public.venues
    where image_url is null and image_credit is not null;
  if v_credito_orfao > 0 then
    raise exception '% espaços com crédito de fotografia e sem fotografia', v_credito_orfao;
  end if;
end
$$;
