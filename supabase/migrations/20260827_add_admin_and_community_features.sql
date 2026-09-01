-- Admin moderation, stable reply numbers, and public recent-post feed.
-- This migration is safe to run after the existing community migrations.

alter table public.bbs_posts
  add column if not exists post_no bigint;

with numbered as (
  select
    id,
    row_number() over (partition by course_id order by created_at, id) as assigned_no
  from public.bbs_posts
  where post_no is null
)
update public.bbs_posts as post
set post_no = numbered.assigned_no
from numbered
where post.id = numbered.id;

alter table public.bbs_posts
  alter column post_no set not null;

create unique index if not exists bbs_posts_course_post_no_idx
  on public.bbs_posts (course_id, post_no);

create or replace function public.prepare_community_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  lounge_thread_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  new.course_id := lower(btrim(new.course_id));
  new.body := btrim(new.body);

  if new.course_id ~ '^lounge:' then
    begin
      lounge_thread_id := substring(new.course_id from 8)::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid lounge thread';
    end;

    if not exists (
      select 1 from public.lounge_threads where id = lounge_thread_id
    ) then
      raise exception 'lounge thread not found';
    end if;
  elsif new.course_id !~ '^[0-9a-f]{20}$' then
    raise exception 'invalid course id';
  end if;

  if exists (
    select 1 from public.bbs_posts
    where author_id = current_user_id
      and created_at > now() - interval '15 seconds'
  ) then
    raise exception '投稿は15秒に1回までです。少し待ってから再度お試しください';
  end if;

  if (
    select count(*) from public.bbs_posts
    where author_id = current_user_id
      and created_at > now() - interval '1 hour'
  ) >= 12 then
    raise exception '1時間あたりの投稿上限に達しました';
  end if;

  if (
    select count(*) from public.bbs_posts
    where author_id = current_user_id
      and created_at > now() - interval '1 day'
  ) >= 40 then
    raise exception '1日あたりの投稿上限に達しました';
  end if;

  if exists (
    select 1 from public.bbs_posts
    where author_id = current_user_id
      and lower(btrim(body)) = lower(new.body)
      and created_at > now() - interval '1 day'
  ) then
    raise exception '同じ内容は続けて投稿できません';
  end if;

  -- Serialize numbering only within this board.
  perform pg_advisory_xact_lock(hashtextextended(new.course_id, 0));
  select coalesce(max(post_no), 0) + 1
    into new.post_no
  from public.bbs_posts
  where course_id = new.course_id;

  new.author_id := current_user_id;
  new.anon_label := '匿名-' || upper(
    substring(
      encode(extensions.digest(current_user_id::text || ':' || new.course_id, 'sha256'), 'hex')
      from 1 for 4
    )
  );
  new.status := case
    when public.requires_moderation(new.body) then 'pending'
    else 'approved'
  end;
  return new;
end;
$$;

revoke all on public.bbs_posts from anon, authenticated;
grant select (id, course_id, post_no, anon_label, body, like_count, dislike_count, created_at)
  on public.bbs_posts to anon, authenticated;
grant insert (course_id, body) on public.bbs_posts to authenticated;

create table if not exists public.admin_invites (
  email text primary key check (email = lower(btrim(email))),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(btrim(email))),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_invites enable row level security;
alter table public.site_admins enable row level security;
revoke all on public.admin_invites from public, anon, authenticated;
revoke all on public.site_admins from public, anon, authenticated;

insert into public.admin_invites (email)
values ('wasechan8@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.site_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

create or replace function public.claim_admin_access()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select lower(email) into current_email
  from auth.users
  where id = current_user_id;

  if current_email is null or not exists (
    select 1 from public.admin_invites where email = current_email
  ) then
    return false;
  end if;

  insert into public.site_admins (user_id, email, created_by)
  select current_user_id, current_email, invited_by
  from public.admin_invites
  where email = current_email
  on conflict (user_id) do update set email = excluded.email;

  update public.admin_invites
  set accepted_by = current_user_id, accepted_at = coalesce(accepted_at, now())
  where email = current_email;

  return true;
end;
$$;

revoke all on function public.claim_admin_access() from public;
grant execute on function public.claim_admin_access() to authenticated;

create or replace function public.admin_invite_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  clean_email text := lower(btrim(p_email));
  invited_user_id uuid;
begin
  if not public.is_site_admin() then
    raise exception 'admin access required';
  end if;
  if clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception '有効なメールアドレスを入力してください';
  end if;

  insert into public.admin_invites (email, invited_by)
  values (clean_email, auth.uid())
  on conflict (email) do update set invited_by = excluded.invited_by;

  select id into invited_user_id from auth.users where lower(email) = clean_email limit 1;
  if invited_user_id is not null then
    insert into public.site_admins (user_id, email, created_by)
    values (invited_user_id, clean_email, auth.uid())
    on conflict (user_id) do update set email = excluded.email;
    update public.admin_invites
    set accepted_by = invited_user_id, accepted_at = coalesce(accepted_at, now())
    where email = clean_email;
  end if;
end;
$$;

revoke all on function public.admin_invite_admin(text) from public;
grant execute on function public.admin_invite_admin(text) to authenticated;

create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, active boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(a.user_id, i.accepted_by) as user_id,
    i.email,
    a.user_id is not null as active,
    i.created_at
  from public.admin_invites i
  left join public.site_admins a on a.email = i.email
  where public.is_site_admin()
  order by active desc, i.created_at;
$$;

revoke all on function public.admin_list_admins() from public;
grant execute on function public.admin_list_admins() to authenticated;

create or replace function public.admin_remove_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  if not public.is_site_admin() then
    raise exception 'admin access required';
  end if;
  if p_user_id = auth.uid() then
    raise exception '自分自身の管理者権限は削除できません';
  end if;
  if (select count(*) from public.site_admins) <= 1 then
    raise exception '最後の管理者は削除できません';
  end if;

  delete from public.site_admins where user_id = p_user_id returning email into target_email;
  if target_email is not null then
    delete from public.admin_invites where email = target_email;
  end if;
end;
$$;

revoke all on function public.admin_remove_admin(uuid) from public;
grant execute on function public.admin_remove_admin(uuid) to authenticated;

create or replace function public.admin_moderation_queue()
returns table (
  content_id uuid,
  content_type text,
  course_id text,
  body text,
  status text,
  created_at timestamptz,
  report_count integer,
  report_reasons text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    'bbs'::text,
    p.course_id,
    p.body,
    p.status,
    p.created_at,
    count(r.post_id)::integer,
    coalesce(array_agg(distinct r.reason) filter (where r.reason is not null), '{}'::text[])
  from public.bbs_posts p
  left join public.bbs_reports r on r.post_id = p.id
  where public.is_site_admin()
    and (p.status <> 'approved' or r.post_id is not null)
  group by p.id
  union all
  select
    e.id,
    'exam'::text,
    e.course_id,
    e.body,
    e.status,
    e.created_at,
    count(f.exam_report_id)::integer,
    coalesce(array_agg(distinct f.reason) filter (where f.reason is not null), '{}'::text[])
  from public.exam_reports e
  left join public.exam_report_flags f on f.exam_report_id = e.id
  where public.is_site_admin()
    and (e.status <> 'approved' or f.exam_report_id is not null)
  group by e.id
  order by created_at desc;
$$;

revoke all on function public.admin_moderation_queue() from public;
grant execute on function public.admin_moderation_queue() to authenticated;

create or replace function public.admin_set_content_status(
  p_content_type text,
  p_content_id uuid,
  p_status text
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
  if p_status not in ('approved', 'pending', 'hidden') then
    raise exception 'invalid status';
  end if;

  if p_content_type = 'bbs' then
    update public.bbs_posts set status = p_status where id = p_content_id;
    if p_status = 'approved' then
      delete from public.bbs_reports where post_id = p_content_id;
    end if;
  elsif p_content_type = 'exam' then
    update public.exam_reports set status = p_status where id = p_content_id;
    if p_status = 'approved' then
      delete from public.exam_report_flags where exam_report_id = p_content_id;
    end if;
  else
    raise exception 'invalid content type';
  end if;
end;
$$;

revoke all on function public.admin_set_content_status(text, uuid, text) from public;
grant execute on function public.admin_set_content_status(text, uuid, text) to authenticated;

create or replace function public.admin_delete_content(p_content_type text, p_content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_admin() then
    raise exception 'admin access required';
  end if;

  if p_content_type = 'bbs' then
    delete from public.bbs_posts where id = p_content_id;
  elsif p_content_type = 'exam' then
    delete from public.exam_reports where id = p_content_id;
  else
    raise exception 'invalid content type';
  end if;
end;
$$;

revoke all on function public.admin_delete_content(text, uuid) from public;
grant execute on function public.admin_delete_content(text, uuid) to authenticated;

create or replace function public.latest_bbs_posts(p_limit integer default 12)
returns table (
  id uuid,
  course_id text,
  post_no bigint,
  anon_label text,
  body text,
  created_at timestamptz,
  lounge_title text,
  campus_slug text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.course_id,
    p.post_no,
    p.anon_label,
    p.body,
    p.created_at,
    thread.title,
    thread.campus_slug
  from public.bbs_posts p
  left join public.lounge_threads thread
    on p.course_id = 'lounge:' || thread.id::text
  where p.status = 'approved'
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 30);
$$;

revoke all on function public.latest_bbs_posts(integer) from public;
grant execute on function public.latest_bbs_posts(integer) to anon, authenticated;
