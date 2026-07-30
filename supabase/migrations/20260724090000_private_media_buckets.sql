-- CoachOS authenticates users with NextAuth, not Supabase Auth. Application
-- code authorizes the workspace/player first and then uses the server-only
-- service role for Storage. The buckets themselves must therefore remain
-- private and must not expose blanket public/authenticated policies.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'player-photos',
  'player-photos',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'training-images',
  'training-images',
  false,
  3145728,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read player photos" on storage.objects;
drop policy if exists "Authenticated upload player photos" on storage.objects;
drop policy if exists "Authenticated update player photos" on storage.objects;
drop policy if exists "Authenticated delete player photos" on storage.objects;
drop policy if exists "Public read training images" on storage.objects;
drop policy if exists "Authenticated upload training images" on storage.objects;
drop policy if exists "Authenticated update training images" on storage.objects;
drop policy if exists "Authenticated delete training images" on storage.objects;
