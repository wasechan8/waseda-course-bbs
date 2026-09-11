import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BbsBoard } from '../components/BbsBoard'
import { StatusNotice } from '../components/StatusNotice'
import { getCampus } from '../lib/campuses'
import { getErrorMessage } from '../lib/errors'
import { ensureAnonymousSession, isSupabaseConfigured, supabase } from '../lib/supabase'
import type { LoungeThread } from '../types/community'
import { PostingPolicyNotice } from '../components/PostingPolicyNotice'

const THREAD_DATE_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string) {
  return THREAD_DATE_FORMATTER.format(new Date(value))
}

export function LoungePage() {
  const { campusSlug = '' } = useParams()
  const campus = getCampus(campusSlug)
  const [threads, setThreads] = useState<LoungeThread[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const loadThreads = useCallback(async () => {
    if (!supabase || !campus) return
    setLoading(true)
    setLoadFailed(false)
    try {
      const { data, error } = await supabase
        .from('lounge_threads')
        .select('id,campus_slug,title,reply_count,created_at')
        .eq('campus_slug', campus.slug)
        .order('updated_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setThreads((data ?? []) as LoungeThread[])
    } catch (error) {
      const errorMessage = getErrorMessage(error, '')
      setMessage(
        errorMessage.includes('lounge_threads')
          ? '喫煙所は準備中です。Supabaseに追加migrationを適用すると利用できます。'
          : getErrorMessage(error, '喫煙所を読み込めませんでした'),
      )
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [campus])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  async function createThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !campus || !title.trim() || !body.trim()) return
    setSubmitting(true)
    setMessage(null)
    try {
      await ensureAnonymousSession()
      const { error } = await supabase.rpc('create_lounge_thread', {
        p_campus_slug: campus.slug,
        p_title: title.trim(),
        p_body: body.trim(),
      })
      if (error) throw error
      setTitle('')
      setBody('')
      setShowForm(false)
      await loadThreads()
    } catch (error) {
      setMessage(getErrorMessage(error, 'スレッドを作成できませんでした'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!campus) {
    return <div className="content-column"><StatusNotice>キャンパスが見つかりませんでした。</StatusNotice></div>
  }

  return (
    <div className="board-page lounge-page">
      <nav className="breadcrumbs" aria-label="現在位置">
        <Link to="/">わせチャン</Link>
        <span> &gt; </span>
        <Link to="/boards">{campus.label}</Link>
        <span> &gt; 喫煙所</span>
      </nav>

      <header className="board-title-bar">
        <h1>{campus.label} 喫煙所</h1>
        <span>雑談・学生生活</span>
      </header>

      <div className="list-summary">
        <strong>全部 {threads.length.toLocaleString()}</strong>
        {isSupabaseConfigured && (
          <button type="button" onClick={() => setShowForm((value) => !value)}>
            {showForm ? '閉じる' : '新しいスレッドを作る'}
          </button>
        )}
      </div>

      {showForm && (
        <form className="lounge-form" onSubmit={createThread}>
          <label>
            タイトル
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} />
          </label>
          <label>
            最初の書き込み
            <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} rows={4} />
          </label>
          <PostingPolicyNotice />
          <button className="primary-button" type="submit" disabled={submitting || !title.trim() || !body.trim()}>
            {submitting ? '作成中' : 'スレッドを作る'}
          </button>
        </form>
      )}

      {message && <StatusNotice>{message}</StatusNotice>}

      {!isSupabaseConfigured ? (
        <StatusNotice setup>喫煙所は準備中です。Supabase接続後に利用できます。</StatusNotice>
      ) : loading ? (
        <div className="empty-state">読み込み中...</div>
      ) : loadFailed ? null : threads.length === 0 ? (
        <div className="empty-state">まだスレッドがありません。</div>
      ) : (
        <ol className="lounge-thread-list">
          {threads.map((thread, index) => (
            <li className="lounge-thread-row" key={thread.id}>
              <span>{index + 1}</span>
              <Link to={`/campus/${campus.slug}/lounge/${thread.id}`}>{thread.title}</Link>
              <small>{thread.reply_count}レス　{formatDate(thread.created_at)}</small>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function LoungeThreadPage() {
  const { campusSlug = '', threadId = '' } = useParams()
  const campus = getCampus(campusSlug)
  const [thread, setThread] = useState<LoungeThread | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !threadId) return
    supabase
      .from('lounge_threads')
      .select('id,campus_slug,title,reply_count,created_at')
      .eq('id', threadId)
      .single()
      .then(({ data, error }) => {
        if (error) setMessage(getErrorMessage(error, 'スレッドを読み込めませんでした'))
        else setThread(data as LoungeThread)
      })
  }, [threadId])

  if (!campus) {
    return <div className="content-column"><StatusNotice>キャンパスが見つかりませんでした。</StatusNotice></div>
  }

  return (
    <div className="board-page detail-page">
      <nav className="breadcrumbs" aria-label="現在位置">
        <Link to="/">わせチャン</Link>
        <span> &gt; </span>
        <Link to="/boards">{campus.label}</Link>
        <span> &gt; </span>
        <Link to={`/campus/${campus.slug}/lounge`}>喫煙所</Link>
        {thread && <span> &gt; {thread.title}</span>}
      </nav>

      {message && <StatusNotice>{message}</StatusNotice>}
      {!isSupabaseConfigured ? (
        <StatusNotice setup>喫煙所は準備中です。</StatusNotice>
      ) : !thread ? (
        <div className="empty-state">読み込み中...</div>
      ) : (
        <>
          <header className="course-header lounge-thread-header">
            <h1>{thread.title}</h1>
            <div className="course-detail-meta">
              <span>{campus.label} 喫煙所</span>
              <span>{thread.reply_count}レス</span>
            </div>
          </header>
          <BbsBoard courseId={`lounge:${thread.id}`} />
        </>
      )}
    </div>
  )
}
