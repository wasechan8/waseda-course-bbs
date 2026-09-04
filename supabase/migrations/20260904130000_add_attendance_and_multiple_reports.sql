alter table public.exam_reports
  add column if not exists attendance_method text,
  add column if not exists attendance_notes text,
  add column if not exists report_items jsonb not null default '[]'::jsonb;

alter table public.exam_reports
  drop constraint if exists exam_reports_attendance_method_check,
  drop constraint if exists exam_reports_attendance_notes_check;

alter table public.exam_reports
  add constraint exam_reports_attendance_method_check check (
    attendance_method is null
    or attendance_method in (
      '出席確認なし',
      'パスワード',
      'レビューシート（紙）',
      'レビューシート（Moodle）',
      '出席カード',
      '点呼',
      '動画視聴（Moodle）',
      'その他'
    )
  ),
  add constraint exam_reports_attendance_notes_check check (
    attendance_notes is null or char_length(attendance_notes) <= 30
  );

create or replace function public.valid_review_report_items(items jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  item jsonb;
  word_count numeric;
begin
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 5 then
    return false;
  end if;

  for item in select value from jsonb_array_elements(items)
  loop
    if jsonb_typeof(item) <> 'object' then
      return false;
    end if;

    if coalesce(item ->> 'type', '') not in ('中間レポート', '期末レポート', '毎回の課題', 'その他') then
      return false;
    end if;

    if item ? 'word_count' and jsonb_typeof(item -> 'word_count') <> 'null' then
      if jsonb_typeof(item -> 'word_count') <> 'number' then
        return false;
      end if;
      word_count := (item ->> 'word_count')::numeric;
      if word_count < 0 or word_count > 100000 or word_count <> trunc(word_count) then
        return false;
      end if;
    end if;

    if item ? 'details'
      and jsonb_typeof(item -> 'details') <> 'null'
      and (
        jsonb_typeof(item -> 'details') <> 'string'
        or char_length(item ->> 'details') > 1000
      ) then
      return false;
    end if;
  end loop;

  return true;
exception when others then
  return false;
end;
$$;

alter table public.exam_reports
  drop constraint if exists exam_reports_report_items_check;
alter table public.exam_reports
  add constraint exam_reports_report_items_check check (
    public.valid_review_report_items(report_items)
  );

grant select (attendance_method, attendance_notes, report_items)
  on public.exam_reports to anon, authenticated;
grant insert (attendance_method, attendance_notes, report_items)
  on public.exam_reports to authenticated;

create or replace function public.prepare_exam_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  new.course_id := lower(btrim(new.course_id));
  new.body := btrim(new.body);
  new.report_format := nullif(btrim(new.report_format), '');
  new.report_details := nullif(btrim(new.report_details), '');
  new.attendance_method := nullif(btrim(new.attendance_method), '');
  new.attendance_notes := nullif(btrim(new.attendance_notes), '');
  new.report_items := coalesce(new.report_items, '[]'::jsonb);

  if new.course_id !~ '^[0-9a-f]{20}$' then
    raise exception 'invalid course id';
  end if;

  if num_nonnulls(new.credit_rating, new.grade_rating, new.interest_rating, new.workload_rating) not in (0, 4) then
    raise exception 'all rating categories are required';
  end if;

  if num_nonnulls(new.credit_rating, new.grade_rating, new.interest_rating, new.workload_rating) = 4 then
    new.rating := round((new.credit_rating + new.grade_rating + new.interest_rating + new.workload_rating)::numeric / 4, 2);
  end if;

  if (
    select count(*) from public.exam_reports
    where author_id = current_user_id
      and created_at > now() - interval '5 minutes'
  ) >= 3 then
    raise exception '投稿間隔が短すぎます。少し待ってから再度お試しください';
  end if;

  if (
    select count(*) from public.exam_reports
    where author_id = current_user_id
      and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception '1日あたりの口コミ投稿上限に達しました';
  end if;

  new.author_id := current_user_id;
  new.anon_label := '匿名-' || upper(
    substring(
      encode(extensions.digest(current_user_id::text || ':' || new.course_id, 'sha256'), 'hex')
      from 1 for 4
    )
  );
  new.status := case
    when public.requires_moderation(new.body)
      or coalesce(public.requires_moderation(new.report_details), false)
      or coalesce(public.requires_moderation(new.attendance_notes), false)
      or public.requires_moderation(new.report_items::text)
      then 'pending'
    else 'approved'
  end;
  return new;
end;
$$;

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
    e.body
      || case when e.attendance_notes is not null then E'\n\n[出席補足]\n' || e.attendance_notes else '' end
      || case when e.report_details is not null then E'\n\n[レポート補足]\n' || e.report_details else '' end
      || case when jsonb_array_length(e.report_items) > 0 then E'\n\n[レポート]\n' || e.report_items::text else '' end,
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
