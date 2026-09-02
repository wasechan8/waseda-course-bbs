-- Public site theme selected from the administrator page.

create table if not exists public.site_theme (
  id text primary key check (id = 'global'),
  theme_key text not null default 'classic' check (
    theme_key in (
      'classic', 'gray', 'sky', 'navy', 'sakura', 'fuji', 'peach', 'sand',
      'sage', 'mint', 'aqua', 'lemon', 'waseda', 'retroBlue', 'paper', 'ice'
    )
  ),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.site_theme (id, theme_key)
values ('global', 'classic')
on conflict (id) do nothing;

alter table public.site_theme enable row level security;

drop policy if exists "site theme is publicly readable" on public.site_theme;
create policy "site theme is publicly readable"
  on public.site_theme for select
  to anon, authenticated
  using (true);

revoke all on public.site_theme from public, anon, authenticated;
grant select (id, theme_key, updated_at) on public.site_theme to anon, authenticated;

create or replace function public.admin_update_site_theme(p_theme_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_admin() then
    raise exception 'admin access required';
  end if;

  if p_theme_key not in (
    'classic', 'gray', 'sky', 'navy', 'sakura', 'fuji', 'peach', 'sand',
    'sage', 'mint', 'aqua', 'lemon', 'waseda', 'retroBlue', 'paper', 'ice'
  ) then
    raise exception 'invalid theme';
  end if;

  update public.site_theme
  set theme_key = p_theme_key,
      updated_at = now(),
      updated_by = auth.uid()
  where id = 'global';

  return p_theme_key;
end;
$$;

revoke all on function public.admin_update_site_theme(text) from public;
grant execute on function public.admin_update_site_theme(text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'site_theme'
  ) then
    alter publication supabase_realtime add table public.site_theme;
  end if;
end;
$$;
