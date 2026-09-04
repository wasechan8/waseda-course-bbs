alter table public.exam_reports
  add column if not exists credit_rating integer,
  add column if not exists grade_rating integer,
  add column if not exists interest_rating integer,
  add column if not exists workload_rating integer;

alter table public.exam_reports
  alter column rating type numeric(3, 2) using rating::numeric;

alter table public.exam_reports
  drop constraint if exists exam_reports_credit_rating_check,
  drop constraint if exists exam_reports_grade_rating_check,
  drop constraint if exists exam_reports_interest_rating_check,
  drop constraint if exists exam_reports_workload_rating_check;

alter table public.exam_reports
  add constraint exam_reports_credit_rating_check check (credit_rating is null or credit_rating between 1 and 5),
  add constraint exam_reports_grade_rating_check check (grade_rating is null or grade_rating between 1 and 5),
  add constraint exam_reports_interest_rating_check check (interest_rating is null or interest_rating between 1 and 5),
  add constraint exam_reports_workload_rating_check check (workload_rating is null or workload_rating between 1 and 5);

grant select (credit_rating, grade_rating, interest_rating, workload_rating)
  on public.exam_reports to anon, authenticated;
grant insert (credit_rating, grade_rating, interest_rating, workload_rating)
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
      then 'pending'
    else 'approved'
  end;
  return new;
end;
$$;
