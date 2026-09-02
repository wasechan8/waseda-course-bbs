-- Expand high-confidence moderation phrases while reducing false positives.
-- Matches are held for administrator review; they are not deleted.

delete from public.moderation_terms
where term in ('殺す', '死ね', '学籍番号', '住所晒');

insert into public.moderation_terms (term)
values
  ('お前を殺す'),
  ('おまえを殺す'),
  ('てめえを殺す'),
  ('殺してやる'),
  ('殺すぞ'),
  ('ぶっ殺す'),
  ('殴りに行く'),
  ('刺してやる'),
  ('刺すぞ'),
  ('自殺しろ'),
  ('首を吊れ'),
  ('飛び降りろ'),
  ('爆破してやる'),
  ('爆弾を置く'),
  ('校舎を爆破'),
  ('キャンパスを爆破'),
  ('校舎に火をつける'),
  ('キャンパスに火をつける'),
  ('住所を晒す'),
  ('住所晒すぞ'),
  ('住所晒してやる'),
  ('個人情報を晒す'),
  ('電話番号を晒す'),
  ('学籍番号を晒す'),
  ('レイプするぞ'),
  ('強姦してやる'),
  ('覚醒剤売ります'),
  ('大麻売ります'),
  ('口座売ります'),
  ('アカウント売ります')
on conflict (term) do nothing;

create or replace function public.requires_moderation(content text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select regexp_replace(
      lower(coalesce(content, '')),
      '[[:space:]　・･.,，。!！?？「」『』（）()【】]',
      '',
      'g'
    ) as value
  )
  select
    exists (
      select 1
      from public.moderation_terms, normalized
      where position(
        regexp_replace(
          lower(term),
          '[[:space:]　・･.,，。!！?？「」『』（）()【】]',
          '',
          'g'
        ) in normalized.value
      ) > 0
    )
    or coalesce(content, '') ~* '[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+'
    or coalesce(content, '') ~ '(0[5789]0|0[1-9][0-9]?)[-‐‑‒–—―ー−]?[0-9]{3,4}[-‐‑‒–—―ー−]?[0-9]{4}'
    or coalesce(content, '') ~* '学籍番号[[:space:]　:：-]*[0-9a-z]{6,16}';
$$;

revoke all on function public.requires_moderation(text) from public, anon, authenticated;
