import type { PropsWithChildren } from 'react'
import { Link, useLocation } from 'react-router-dom'

export function AppShell({ children }: PropsWithChildren) {
  const { pathname } = useLocation()

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
