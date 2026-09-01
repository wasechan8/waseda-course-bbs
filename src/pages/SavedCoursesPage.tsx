import { Bookmark, Clock3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getFavoriteCourses,
  getRecentCourses,
  subscribeCourseActivity,
  type SavedCourse,
} from '../lib/courseActivity'

function CourseLinks({ courses, empty }: { courses: SavedCourse[]; empty: string }) {
  if (!courses.length) return <p className="saved-empty">{empty}</p>
  return (
    <ol className="saved-course-list">
      {courses.map((course) => (
        <li key={course.id}>
          <Link to={`/faculty/${course.facultySlug}/course/${course.id}`}>{course.name}</Link>
          <span>{course.faculty}　{course.teacher ?? '教員未定'}</span>
        </li>
      ))}
    </ol>
  )
}

export function SavedCoursesPage() {
  const [favorites, setFavorites] = useState(getFavoriteCourses)
  const [recent, setRecent] = useState(getRecentCourses)

  useEffect(() => subscribeCourseActivity(() => {
    setFavorites(getFavoriteCourses())
    setRecent(getRecentCourses())
  }), [])

  return (
    <div className="content-column saved-courses-page">
      <nav className="breadcrumbs"><Link to="/">わせチャン</Link> &gt; 保存した科目</nav>
      <header className="board-title-bar"><h1>保存した科目</h1><span>この端末に保存されます</span></header>
      <section className="saved-section">
        <h2><Bookmark size={16} /> お気に入り</h2>
        <CourseLinks courses={favorites} empty="お気に入りの科目はまだありません。" />
      </section>
      <section className="saved-section">
        <h2><Clock3 size={16} /> 最近見た科目</h2>
        <CourseLinks courses={recent} empty="閲覧した科目はまだありません。" />
      </section>
    </div>
  )
}
