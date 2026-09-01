import { Bookmark, Check, ExternalLink, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BbsBoard } from '../components/BbsBoard'
import { ExamBoard } from '../components/ExamBoard'
import { StatusNotice } from '../components/StatusNotice'
import { getCourses } from '../lib/catalog'
import { getCampusForFaculty } from '../lib/campuses'
import type { Course } from '../types/catalog'
import { isFavoriteCourse, rememberCourse, toggleFavoriteCourse } from '../lib/courseActivity'

type DetailTab = 'bbs' | 'exam'

export function CoursePage() {
  const { facultySlug = '', courseId = '' } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>('bbs')
  const [error, setError] = useState<string | null>(null)
  const [favorite, setFavorite] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getCourses(facultySlug)
      .then((courses) => {
        const found = courses.find((item) => item.id === courseId)
        if (!found) throw new Error('科目が見つかりませんでした')
        setCourse(found)
        setFavorite(isFavoriteCourse(found.id))
        rememberCourse(found)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : '科目を読み込めませんでした')
      })
  }, [courseId, facultySlug])

  if (error) {
    return <div className="content-column"><StatusNotice>{error}</StatusNotice></div>
  }
  if (!course) {
    return <div className="content-column"><div className="empty-state">読み込み中...</div></div>
  }

  const campus = getCampusForFaculty(facultySlug)
  const shareText = `${course.name} | わせチャン`
  const shareUrl = window.location.href

  async function copyShareUrl() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function shareCourse() {
    if (navigator.share) {
      await navigator.share({ title: shareText, text: shareText, url: shareUrl })
      return
    }
    setShowShare((value) => !value)
  }

  return (
    <div className="board-page detail-page">
      <nav className="breadcrumbs" aria-label="現在位置">
        <Link to="/">わせチャン</Link>
        <span> &gt; </span>
        <Link to="/boards">{campus?.label ?? '学部'}</Link>
        <span> &gt; </span>
        <Link to={`/faculty/${facultySlug}`}>{course.faculty}</Link>
        <span> &gt; {course.name}</span>
      </nav>

      <header className="course-header">
        <h1>{course.name}</h1>
        <div className="course-detail-meta">
          <span>担当：{course.teacher ?? '教員未定'}</span>
          {course.term && <span>{course.term}</span>}
          {course.schedule && <span>{course.schedule}</span>}
          {course.credits != null && <span>{course.credits}単位</span>}
          {course.methodType && <span>{course.methodType.replace(/[【】]/g, '')}</span>}
          <span>{course.year ? `${course.year}年度` : '開講年度未登録'}</span>
          <span>{course.code || '科目コード未登録'}</span>
        </div>
        <a
          className="official-link"
          href={course.syllabusUrl ?? 'https://www.wsl.waseda.jp/syllabus/JAA101.php?pLng=jp'}
          target="_blank"
          rel="noreferrer"
        >
          公式シラバスで確認 <ExternalLink size={15} />
        </a>
        <div className="course-utility-actions">
          <button type="button" className={favorite ? 'active' : ''} onClick={() => setFavorite(toggleFavoriteCourse(course))}>
            <Bookmark size={15} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? '保存済み' : 'お気に入り'}
          </button>
          <button type="button" onClick={() => void shareCourse()}><Share2 size={15} /> 共有</button>
        </div>
        {showShare && (
          <div className="share-menu">
            <button type="button" onClick={() => void copyShareUrl()}>{copied ? <Check size={14} /> : null}{copied ? 'コピーしました' : 'リンクをコピー'}</button>
            <a href={`https://line.me/R/msg/text/?${encodeURIComponent(`${shareText}\n${shareUrl}`)}`} target="_blank" rel="noreferrer">LINE</a>
            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">X</a>
          </div>
        )}
      </header>

      <div className="detail-tabs" role="tablist" aria-label="科目掲示板">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bbs'}
          className={activeTab === 'bbs' ? 'active' : ''}
          onClick={() => setActiveTab('bbs')}
        >
          掲示板
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'exam'}
          className={activeTab === 'exam' ? 'active' : ''}
          onClick={() => setActiveTab('exam')}
        >
          テスト情報
        </button>
      </div>

      {activeTab === 'bbs' ? <BbsBoard courseId={course.id} /> : <ExamBoard courseId={course.id} />}
    </div>
  )
}
