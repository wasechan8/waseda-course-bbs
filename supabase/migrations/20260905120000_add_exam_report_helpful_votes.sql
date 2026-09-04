alter table public.exam_reports
  add column if not exists helpful_count integer not null default 0;

alter table public.exam_reports
  drop constraint if exists exam_reports_helpful_count_check;
alter table public.exam_reports
  add constraint exam_reports_helpful_count_check check (helpful_count >= 0);

grant select (helpful_count) on public.exam_reports to anon, authenticated;

create table if not exists public.exam_report_helpful_votes (
  report_id uuid not null references public.exam_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

alter table public.exam_report_helpful_votes enable row level security;

create or replace function public.prepare_exam_report_helpful_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists prepare_exam_report_helpful_vote on public.exam_report_helpful_votes;
create trigger prepare_exam_report_helpful_vote
before insert on public.exam_report_helpful_votes
for each row execute function public.prepare_exam_report_helpful_vote();

create or replace function public.refresh_exam_report_helpful_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_report_id uuid := coalesce(new.report_id, old.report_id);
begin
  update public.exam_reports
  set helpful_count = (
    select count(*) from public.exam_report_helpful_votes
    where report_id = target_report_id
  )
  where id = target_report_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_exam_report_helpful_count on public.exam_report_helpful_votes;
create trigger refresh_exam_report_helpful_count
after insert or delete on public.exam_report_helpful_votes
for each row execute function public.refresh_exam_report_helpful_count();

drop policy if exists exam_report_helpful_votes_read_own on public.exam_report_helpful_votes;
create policy exam_report_helpful_votes_read_own
on public.exam_report_helpful_votes for select
to authenticated
using (user_id = auth.uid());

drop policy if exists exam_report_helpful_votes_insert_own on public.exam_report_helpful_votes;
create policy exam_report_helpful_votes_insert_own
on public.exam_report_helpful_votes for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists exam_report_helpful_votes_delete_own on public.exam_report_helpful_votes;
create policy exam_report_helpful_votes_delete_own
on public.exam_report_helpful_votes for delete
to authenticated
using (user_id = auth.uid());

revoke all on public.exam_report_helpful_votes from anon, authenticated;
grant select (report_id) on public.exam_report_helpful_votes to authenticated;
grant insert (report_id) on public.exam_report_helpful_votes to authenticated;
grant delete on public.exam_report_helpful_votes to authenticated;
