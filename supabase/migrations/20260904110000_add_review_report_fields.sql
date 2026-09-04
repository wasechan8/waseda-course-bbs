alter table public.exam_reports
  add column if not exists report_format text,
  add column if not exists report_word_count integer,
  add column if not exists report_details text;

alter table public.exam_reports
  drop constraint if exists exam_reports_report_format_check;
alter table public.exam_reports
  add constraint exam_reports_report_format_check check (
    report_format is null
    or report_format in ('期末レポート', '中間レポート', '毎回の課題', '複数回', 'その他')
  );

alter table public.exam_reports
  drop constraint if exists exam_reports_report_word_count_check;
alter table public.exam_reports
  add constraint exam_reports_report_word_count_check check (
    report_word_count is null or report_word_count between 0 and 100000
  );

alter table public.exam_reports
  drop constraint if exists exam_reports_report_details_check;
alter table public.exam_reports
  add constraint exam_reports_report_details_check check (
    report_details is null or char_length(report_details) <= 1000
  );

grant select (report_format, report_word_count, report_details)
  on public.exam_reports to anon, authenticated;
grant insert (report_format, report_word_count, report_details)
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

  if new.course_id !~ '^[0-9a-f]{20}$' then
    raise exception 'invalid course id';
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
    e.body || case
      when e.report_details is not null then E'\n\n[レポート補足]\n' || e.report_details
      else ''
    end,
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
