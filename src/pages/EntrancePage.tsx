import { Link } from 'react-router-dom'
import { RecentPostsFeed } from '../components/RecentPostsFeed'

export function EntrancePage() {
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
