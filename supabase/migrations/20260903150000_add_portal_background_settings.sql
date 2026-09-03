-- Administrator-managed entrance page backgrounds.

alter table public.site_theme
  add column if not exists desktop_background_path text,
  add column if not exists mobile_background_path text,
  add column if not exists desktop_background_opacity numeric(4, 3) not null default 0.160
    check (desktop_background_opacity between 0 and 1),
  add column if not exists mobile_background_opacity numeric(4, 3) not null default 0.160
    check (mobile_background_opacity between 0 and 1);

grant select (
  desktop_background_path,
  mobile_background_path,
  desktop_background_opacity,
  mobile_background_opacity
) on public.site_theme to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site assets are publicly readable" on storage.objects;
create policy "site assets are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'site-assets');

drop policy if exists "site admins can upload site assets" on storage.objects;
create policy "site admins can upload site assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-assets'
    and (storage.foldername(name))[1] = 'entrance'
    and public.is_site_admin()
  );

drop policy if exists "site admins can update site assets" on storage.objects;
create policy "site admins can update site assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'site-assets'
    and (storage.foldername(name))[1] = 'entrance'
    and public.is_site_admin()
  )
  with check (
    bucket_id = 'site-assets'
    and (storage.foldername(name))[1] = 'entrance'
    and public.is_site_admin()
  );

drop policy if exists "site admins can delete site assets" on storage.objects;
create policy "site admins can delete site assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'site-assets'
    and (storage.foldername(name))[1] = 'entrance'
    and public.is_site_admin()
  );

create or replace function public.admin_update_portal_background(
  p_desktop_background_path text,
  p_mobile_background_path text,
  p_desktop_background_opacity numeric,
  p_mobile_background_opacity numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_admin() then
    raise exception 'admin access required';
  end if;

  if p_desktop_background_opacity not between 0 and 1
     or p_mobile_background_opacity not between 0 and 1 then
    raise exception 'invalid opacity';
  end if;

  if p_desktop_background_path is not null
     and p_desktop_background_path <> 'entrance/desktop' then
    raise exception 'invalid desktop background path';
  end if;

  if p_mobile_background_path is not null
     and p_mobile_background_path <> 'entrance/mobile' then
    raise exception 'invalid mobile background path';
  end if;

  update public.site_theme
  set desktop_background_path = p_desktop_background_path,
      mobile_background_path = p_mobile_background_path,
      desktop_background_opacity = p_desktop_background_opacity,
      mobile_background_opacity = p_mobile_background_opacity,
      updated_at = now(),
      updated_by = auth.uid()
  where id = 'global';
end;
$$;

revoke all on function public.admin_update_portal_background(text, text, numeric, numeric) from public;
grant execute on function public.admin_update_portal_background(text, text, numeric, numeric) to authenticated;
