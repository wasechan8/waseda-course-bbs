import { LogOut, Shield, Trash2, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../lib/errors'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { StatusNotice } from '../components/StatusNotice'

type AdminEntry = {
  user_id: string | null
  email: string
  active: boolean
  created_at: string
}

type ModerationItem = {
  content_id: string
  content_type: 'bbs' | 'exam'
  course_id: string
  body: string
  status: 'approved' | 'pending' | 'hidden'
  created_at: string
  report_count: number
  report_reasons: string[]
}

const REASON_LABELS: Record<string, string> = {
  threat: '犯罪予告・緊急性',
  illegal: '違法行為',
  harassment: '誹謗中傷',
  personal_info: '個人情報',
  spam: '宣伝・連投',
  other: 'その他',
}

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [registerMode, setRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [admins, setAdmins] = useState<AdminEntry[]>([])
  const [queue, setQueue] = useState<ModerationItem[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshAccess = useCallback(async () => {
    if (!supabase) return
    setChecking(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const hasUser = Boolean(sessionData.session?.user && !sessionData.session.user.is_anonymous)
    setAuthenticated(hasUser)
    if (!hasUser) {
      setIsAdmin(false)
      setChecking(false)
      return
    }

    await supabase.rpc('claim_admin_access')
    const { data } = await supabase.rpc('is_site_admin')
    setIsAdmin(data === true)
    setChecking(false)
  }, [])

  const loadAdminData = useCallback(async () => {
    if (!supabase) return
    const [adminResult, queueResult] = await Promise.all([
      supabase.rpc('admin_list_admins'),
      supabase.rpc('admin_moderation_queue'),
    ])
    if (adminResult.error) throw adminResult.error
    if (queueResult.error) throw queueResult.error
    setAdmins((adminResult.data ?? []) as AdminEntry[])
    setQueue((queueResult.data ?? []) as ModerationItem[])
  }, [])

  useEffect(() => {
    void refreshAccess()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange(() => void refreshAccess())
    return () => data.subscription.unsubscribe()
  }, [refreshAccess])

  useEffect(() => {
    if (!isAdmin) return
    loadAdminData().catch((error) => setMessage(getErrorMessage(error, '管理データを読み込めませんでした')))
  }, [isAdmin, loadAdminData])

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    try {
      const result = registerMode
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) throw result.error
      if (registerMode && !result.data.session) {
        setMessage('確認メールを送信しました。メール内のリンクを開いてからログインしてください。')
      } else {
        await refreshAccess()
      }
    } catch (error) {
      setMessage(getErrorMessage(error, 'ログインできませんでした'))
    } finally {
      setBusy(false)
    }
  }

  async function inviteAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !inviteEmail.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const { error } = await supabase.rpc('admin_invite_admin', { p_email: inviteEmail.trim() })
      if (error) throw error
      setInviteEmail('')
      setMessage('管理者として招待しました。相手はこの画面から初回登録できます。')
      await loadAdminData()
    } catch (error) {
      setMessage(getErrorMessage(error, '管理者を追加できませんでした'))
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(item: ModerationItem, status: ModerationItem['status']) {
    if (!supabase) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('admin_set_content_status', {
        p_content_type: item.content_type,
        p_content_id: item.content_id,
        p_status: status,
      })
      if (error) throw error
      await loadAdminData()
    } catch (error) {
      setMessage(getErrorMessage(error, '状態を変更できませんでした'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteItem(item: ModerationItem) {
    if (!supabase || !window.confirm('この投稿を完全に削除します。元に戻せません。続けますか？')) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('admin_delete_content', {
        p_content_type: item.content_type,
        p_content_id: item.content_id,
      })
      if (error) throw error
      await loadAdminData()
    } catch (error) {
      setMessage(getErrorMessage(error, '削除できませんでした'))
    } finally {
      setBusy(false)
    }
  }

  if (!isSupabaseConfigured) return <div className="content-column"><StatusNotice>Supabaseが未設定です。</StatusNotice></div>
  if (checking) return <div className="content-column"><div className="empty-state">権限を確認中...</div></div>

  if (!authenticated || !isAdmin) {
    return (
      <div className="content-column admin-page admin-login-page">
        <nav className="breadcrumbs"><Link to="/">わせチャン</Link> &gt; 管理者</nav>
        <form className="admin-login" onSubmit={submitAuth}>
          <Shield size={30} />
          <h1>管理者ログイン</h1>
          {authenticated && !isAdmin && <StatusNotice>このアカウントには管理者権限がありません。</StatusNotice>}
          {message && <StatusNotice>{message}</StatusNotice>}
          <label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
          <button className="primary-button" type="submit" disabled={busy}>{registerMode ? '初回登録' : 'ログイン'}</button>
          <button className="text-button" type="button" onClick={() => setRegisterMode((value) => !value)}>
            {registerMode ? 'ログインへ戻る' : '招待された管理者の初回登録'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="content-column admin-page">
      <div className="admin-heading">
        <div><h1>管理画面</h1><p>通報と保留中の投稿を確認します。</p></div>
        <button type="button" onClick={() => void supabase?.auth.signOut()}><LogOut size={15} /> ログアウト</button>
      </div>
      {message && <StatusNotice>{message}</StatusNotice>}

      <section className="admin-section">
        <h2>確認待ち・通報</h2>
        {queue.length === 0 ? <p className="saved-empty">現在、確認が必要な投稿はありません。</p> : (
          <ol className="moderation-list">
            {queue.map((item) => (
              <li key={`${item.content_type}:${item.content_id}`}>
                <div className="moderation-meta">
                  <strong>{item.content_type === 'bbs' ? '掲示板投稿' : 'テスト情報'}</strong>
                  <span>{item.status}</span>
                  <span>{item.report_count}件の通報</span>
                  <time>{new Date(item.created_at).toLocaleString('ja-JP')}</time>
                </div>
                {item.report_reasons.length > 0 && <p className="moderation-reasons">{item.report_reasons.map((reason) => REASON_LABELS[reason] ?? reason).join('、')}</p>}
                <p>{item.body}</p>
                <div className="moderation-actions">
                  <button type="button" disabled={busy} onClick={() => void setStatus(item, 'approved')}>公開</button>
                  <button type="button" disabled={busy} onClick={() => void setStatus(item, 'hidden')}>非表示</button>
                  <button type="button" disabled={busy} className="danger-button" onClick={() => void deleteItem(item)}><Trash2 size={14} /> 完全削除</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="admin-section">
        <h2>管理者</h2>
        <form className="admin-invite-form" onSubmit={inviteAdmin}>
          <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="追加するメールアドレス" required />
          <button type="submit" disabled={busy}><UserPlus size={15} /> 招待</button>
        </form>
        <ul className="admin-list">
          {admins.map((admin) => <li key={admin.email}><span>{admin.email}</span><strong>{admin.active ? '有効' : '招待中'}</strong></li>)}
        </ul>
      </section>
    </div>
  )
}
