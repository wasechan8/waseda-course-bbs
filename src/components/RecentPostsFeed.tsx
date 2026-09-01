import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type CourseIndexEntry = {
  name: string
  facultySlug: string
}

type RecentPost = {
  id: string
  course_id: string
  post_no: number
  anon_label: string
  body: string
  created_at: string
  lounge_title: string | null
  campus_slug: string | null
}

const FACULTY_ABBREVIATIONS: Record<string, string> = {
  politics_economics: '政経',
  law: '法',
  education: '教育',
  commerce: '商',
  social_sciences: '社学',
  human_sciences: '人科',
  sport_sciences: 'スポ科',
  international: '国教',
  culture_community: '文構',
  letters: '文',
  human_correspondence: '人科通信',
  fundamental_sci: '基幹',
  creative_sci: '創造',
  advanced_sci: '先進',
  global_education: 'GEC',
}

const CAMPUS_ABBREVIATIONS: Record<string, string> = {
  waseda: '早',
  toyama: '戸',
  tokorozawa: '所',
  nishiwaseda: '西',
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'たった今'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}時間前`
  return `${Math.floor(seconds / 86400)}日前`
}

export function RecentPostsFeed() {
  const [posts, setPosts] = useState<RecentPost[]>([])
  const [courseIndex, setCourseIndex] = useState<Record<string, CourseIndexEntry>>({})
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.rpc('latest_bbs_posts', { p_limit: 10 })
    if (!error) {
      setPosts((data ?? []) as RecentPost[])
      setUpdatedAt(new Date())
    }
  }, [])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/course-index.json`)
      .then((response) => response.ok ? response.json() : {})
      .then((data: unknown) => setCourseIndex(data as Record<string, CourseIndexEntry>))
      .catch(() => setCourseIndex({}))
  }, [])

  useEffect(() => {
    const client = supabase
    if (!isSupabaseConfigured || !client) return
    void load()
    const interval = window.setInterval(() => void load(), 15000)
    const channel = client
      .channel('portal-recent-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bbs_posts' }, () => void load())
      .subscribe()
    return () => {
      window.clearInterval(interval)
      void client.removeChannel(channel)
    }
  }, [load])

  if (!isSupabaseConfigured || posts.length === 0) return null

  return (
    <section className="portal-recent" aria-labelledby="recent-posts-title">
      <div className="portal-recent-heading">
        <h2 id="recent-posts-title">新着の書き込み</h2>
        <span>{updatedAt ? `${updatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 更新` : '取得中'}</span>
      </div>
      <ol>
        {posts.map((post) => {
          const course = courseIndex[post.course_id]
          const loungeId = post.course_id.startsWith('lounge:') ? post.course_id.slice(7) : null
          const href = loungeId && post.campus_slug
            ? `/campus/${post.campus_slug}/lounge/${loungeId}`
            : course
              ? `/faculty/${course.facultySlug}/course/${post.course_id}`
              : '/boards'
          const facultyAbbreviation = course ? FACULTY_ABBREVIATIONS[course.facultySlug] : null
          const campusAbbreviation = post.campus_slug ? CAMPUS_ABBREVIATIONS[post.campus_slug] : null
          const boardName = loungeId
            ? `喫煙所（${campusAbbreviation ?? '他'}）`
            : course
              ? `${facultyAbbreviation ?? course.facultySlug}　${course.name}`
              : '科目掲示板'
          return (
            <li key={post.id}>
              <Link to={href}>{boardName}</Link>
              <span className="portal-recent-body">{post.body.replace(/\s+/g, ' ').slice(0, 72)}</span>
              <time dateTime={post.created_at}>{relativeTime(post.created_at)}</time>
            </li>
          )
        })}
      </ol>
      <p>15秒ごとに自動更新</p>
    </section>
  )
}
