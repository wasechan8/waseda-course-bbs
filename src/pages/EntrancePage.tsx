import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RecentPostsFeed } from '../components/RecentPostsFeed'
import { getPortalAssetUrl, normalizePortalAppearance, type PortalAppearance } from '../lib/portalAppearance'
import { supabase } from '../lib/supabase'

export function EntrancePage() {
  const [appearance, setAppearance] = useState<PortalAppearance | null>(null)

  useEffect(() => {
    const client = supabase
    if (!client) return

    const loadBackground = async () => {
      const { data } = await client
        .from('site_theme')
        .select('desktop_background_path, mobile_background_path, desktop_background_opacity, mobile_background_opacity, updated_at')
        .eq('id', 'global')
        .maybeSingle()
      setAppearance(normalizePortalAppearance(data))
    }

    void loadBackground()
    const channel = client
      .channel('portal-background-image')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_theme' }, () => void loadBackground())
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [])

  const desktopBackgroundUrl = appearance ? getPortalAssetUrl(appearance.desktopPath, appearance.updatedAt) : ''
  const mobileBackgroundUrl = appearance
    ? getPortalAssetUrl(appearance.mobilePath, appearance.updatedAt) || desktopBackgroundUrl
    : ''

  return (
    <div className="portal-page">
      <nav className="portal-nav" aria-label="玄関メニュー">
        <Link to="/boards">掲示板</Link>
        <Link to="/guide">利用案内・削除依頼</Link>
        <a href="https://www.wsl.waseda.jp/syllabus/JAA101.php?pLng=jp" target="_blank" rel="noreferrer">
          公式シラバス
        </a>
      </nav>

      <section className="portal-main">
        {desktopBackgroundUrl && (
          <picture className="portal-background-image" aria-hidden="true">
            {mobileBackgroundUrl && <source media="(max-width: 720px)" srcSet={mobileBackgroundUrl} />}
            <img src={desktopBackgroundUrl} alt="" />
          </picture>
        )}
        <img className="portal-logo" src={`${import.meta.env.BASE_URL}wasechan-logo-v3.png`} alt="わせチャン" />
        <p>早稲田大学非公式・科目別掲示板</p>
        <Link className="portal-enter" to="/boards">掲示板に入る</Link>
        <RecentPostsFeed />
      </section>

      <footer className="portal-footer">
        <p>利用は各自の判断でお願いします。</p>
        <p>早稲田大学が運営するサイトではありません。</p>
        <div>
          <Link to="/guide">利用案内</Link>
          <a href="mailto:wasechan8@gmail.com">連絡先</a>
        </div>
      </footer>
    </div>
  )
}
