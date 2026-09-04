-- 0008 — Storage.
--
-- Dois baldes com propósitos opostos:
--   `media`   — imagens já tratadas, públicas, servidas ao site.
--   `intake`  — o que chega por email ou formulário: privado, nunca servido
--               ao público, e nunca a partir do domínio principal.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880,                                  -- 5 MB
  array['image/webp', 'image/jpeg', 'image/png', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intake',
  'intake',
  false,
  10485760,                                 -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública apenas do balde tratado.
create policy media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

-- `intake` fica sem policy: só a chave de serviço lá chega. Um cartaz enviado
-- por email não é conteúdo público até alguém o aprovar e a imagem tratada
-- passar para `media`.
