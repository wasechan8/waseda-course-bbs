import { useEffect, type PropsWithChildren } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { applySiteTheme, DEFAULT_THEME_KEY, isThemeKey } from '../lib/siteTheme'
import { applyPortalAppearance, normalizePortalAppearance } from '../lib/portalAppearance'

export function AppShell({ children }: PropsWithChildren) {
  const { pathname } = useLocation()

  useEffect(() => {
    const client = supabase
    applySiteTheme(DEFAULT_THEME_KEY)
    if (!client) return

    const loadAppearance = async () => {
      const { data } = await client
        .from('site_theme')
        .select('theme_key, desktop_background_path, mobile_background_path, desktop_background_opacity, mobile_background_opacity, updated_at')
        .eq('id', 'global')
        .maybeSingle()
      if (isThemeKey(data?.theme_key)) applySiteTheme(data.theme_key)
      applyPortalAppearance(normalizePortalAppearance(data))
    }

    void loadAppearance()
    const channel = client
      .channel('public-site-theme')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_theme' }, () => void loadAppearance())
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [])

  if (pathname === '/') {
    return <main className="portal-shell">{children}</main>
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="わせチャン ホーム">
            <img src={`${import.meta.env.BASE_URL}wasechan-logo-v3.png`} alt="わせチャン" />
          </Link>
          <span className="site-description">早稲田大学非公式・科目別掲示板</span>
          <nav className="header-links" aria-label="補助メニュー">
            <Link to="/boards">掲示板一覧</Link>
            <Link to="/saved">お気に入り</Link>
            <Link to="/guide">利用案内</Link>
            <a href="https://www.wsl.waseda.jp/syllabus/JAA101.php?pLng=jp" target="_blank" rel="noreferrer">
              公式シラバス
            </a>
          </nav>
        </div>
      </header>
      <main className="page-shell">{children}</main>
      <footer className="site-footer">
        <div>
          <strong>わせチャン</strong>
          <p>
            早稲田大学の学生が個人的に制作する非公式サイトです。早稲田大学とは関係ありません。
            掲載情報は参考として扱い、履修時は必ず公式シラバスをご確認ください。
          </p>
        </div>
        <div className="footer-links">
          <Link to="/guide">利用案内・削除依頼</Link>
          <Link to="/admin">管理者</Link>
          <a href="mailto:wasechan8@gmail.com">連絡先</a>
          <a href="https://www.wsl.waseda.jp/syllabus/JAA101.php?pLng=jp" target="_blank" rel="noreferrer">
            早稲田大学 公式シラバス
          </a>
        </div>
      </footer>
    </div>
  )
}
