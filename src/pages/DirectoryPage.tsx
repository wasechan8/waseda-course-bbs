import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getCourses, getFaculties } from '../lib/catalog'
import { CAMPUSES } from '../lib/campuses'
import type { Course, Faculty } from '../types/catalog'
import { StatusNotice } from '../components/StatusNotice'

export function DirectoryPage() {
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Course[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    getFaculties().then(setFaculties).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : '学部一覧を読み込めませんでした')
    })
  }, [])

  async function searchCourses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedQuery = query.trim().toLocaleLowerCase('ja-JP')
    if (!normalizedQuery) {
      setResults([])
      setHasSearched(false)
      return
    }

    setSearching(true)
    setError(null)
    try {
      const courseGroups = await Promise.all(faculties.map((faculty) => getCourses(faculty.slug)))
      const matches = courseGroups
        .flat()
        .filter((course) =>
          [course.name, course.teacher, course.code]
            .filter(Boolean)
            .some((value) => value!.toLocaleLowerCase('ja-JP').includes(normalizedQuery)),
        )
        .slice(0, 50)
      setResults(matches)
      setHasSearched(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '科目を検索できませんでした')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="entrance-page">
      <section className="entrance-heading">
        <h1>早稲田大学 科目別掲示板</h1>
        <p>学部を選ぶと、科目ごとの掲示板と口コミを見られます。</p>
      </section>

      <form className="entrance-search" onSubmit={searchCourses}>
        <label>
          <span className="sr-only">科目・教員名を検索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="科目名・教員名・科目コード"
          />
        </label>
        <button type="submit" disabled={searching || !query.trim()}>{searching ? '検索中' : '検索'}</button>
      </form>

      {error && <StatusNotice>{error}</StatusNotice>}

      {hasSearched && (
        <section className="entrance-results">
          <h2>検索結果（{results.length}件・最大50件）</h2>
          {results.length === 0 ? (
            <p>一致する科目がありません。</p>
          ) : (
            <ol>
              {results.map((course) => (
                <li key={`${course.facultySlug}:${course.id}`}>
                  <Link to={`/faculty/${course.facultySlug}/course/${course.id}`}>{course.name}</Link>
                  <span>{course.faculty}　{course.teacher ?? '教員未定'}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <div className="campus-directory">
        {CAMPUSES.map((campus) => {
          const campusFaculties = campus.facultySlugs
            .map((slug) => faculties.find((faculty) => faculty.slug === slug))
            .filter((faculty): faculty is Faculty => Boolean(faculty))

          if (campusFaculties.length === 0) return null

          return (
            <section className="campus-section" key={campus.slug}>
              <h2>{campus.label}</h2>
              <ul>
                {campusFaculties.map((faculty) => (
                  <li key={faculty.slug}>
                    <Link to={`/faculty/${faculty.slug}`}>{faculty.label}</Link>
                    <span>（{faculty.courseCount.toLocaleString()}）</span>
                  </li>
                ))}
                <li className="lounge-link">
                  <Link to={`/campus/${campus.slug}/lounge`}>喫煙所</Link>
                </li>
              </ul>
            </section>
          )
        })}
      </div>

      <p className="entrance-note">
        科目ページは情報交換のための固定掲示板です。自由な話題は各キャンパスの喫煙所を利用してください。
      </p>
    </div>
  )
}
