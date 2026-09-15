import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCourses, getFaculties } from '../lib/catalog'
import { getCampusForFaculty } from '../lib/campuses'
import type { Course, Faculty } from '../types/catalog'
import { StatusNotice } from '../components/StatusNotice'

const PAGE_SIZE = 50
const DAYS = [
  { value: 1, label: '月曜日' },
  { value: 2, label: '火曜日' },
  { value: 3, label: '水曜日' },
  { value: 4, label: '木曜日' },
  { value: 5, label: '金曜日' },
  { value: 6, label: '土曜日' },
  { value: 7, label: '日曜日' },
]
const PERIODS = [1, 2, 3, 4, 5, 6, 7]
const PRIMARY_TERM_ORDER = [
  '春学期',
  '春クォーター',
  '夏クォーター',
  '秋学期',
  '秋クォーター',
  '冬クォーター',
]
const PRIMARY_TERM_RANK = new Map(PRIMARY_TERM_ORDER.map((item, index) => [item, index]))
const CURRICULUM_CATEGORY_GROUPS = [
  {
    label: '科目区分',
    options: ['ミニマムディシプリン', '専門・学際'],
  },
  {
    label: 'コース科目',
    options: [
      '平和・国際協力コース',
      '多文化社会・共生コース',
      'サスティナビリティコース',
      'コミュニティ・社会デザインコース',
      '組織・社会イノベーションコース',
    ],
  },
  {
    label: 'ゼミナール',
    options: ['ゼミナールI', 'ゼミナールII', 'ゼミナールIII'],
  },
  {
    label: '外国語・その他',
    options: ['必修英語', '教養外国語', '自由科目'],
  },
]

export function FacultyPage() {
  const { facultySlug = '' } = useParams()
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [day, setDay] = useState('')
  const [period, setPeriod] = useState('')
  const [curriculumCategory, setCurriculumCategory] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setCurriculumCategory('')
    Promise.all([getFaculties(), getCourses(facultySlug)])
      .then(([facultyList, courseList]) => {
        setFaculty(facultyList.find((item) => item.slug === facultySlug) ?? null)
        setCourses(courseList)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : '科目一覧を読み込めませんでした')
      })
      .finally(() => setLoading(false))
  }, [facultySlug])

  const terms = useMemo(
    () => [...new Set(courses.map((course) => course.term).filter((value): value is string => Boolean(value)))].sort(
      (left, right) => {
        const leftRank = PRIMARY_TERM_RANK.get(left)
        const rightRank = PRIMARY_TERM_RANK.get(right)
        if (leftRank != null && rightRank != null) return leftRank - rightRank
        if (leftRank != null) return -1
        if (rightRank != null) return 1
        return left.localeCompare(right, 'ja-JP')
      },
    ),
    [courses],
  )
  const primaryTerms = terms.filter((item) => PRIMARY_TERM_RANK.has(item))
  const specialTerms = terms.filter((item) => !PRIMARY_TERM_RANK.has(item))

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ja-JP')
    const selectedDay = day ? Number(day) : null
    const selectedPeriod = period ? Number(period) : null
    return courses.filter((course) => {
      if (term && course.term !== term) return false
      if (
        curriculumCategory &&
        !(course.curriculumCategories ?? []).includes(curriculumCategory)
      ) return false
      if (
        (selectedDay || selectedPeriod) &&
        !(course.slots ?? []).some(
          (slot) =>
            (!selectedDay || slot.day === selectedDay) &&
            (!selectedPeriod || slot.period === selectedPeriod),
        )
      ) return false
      if (!normalizedQuery) return true
      return [course.name, course.teacher, course.code]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('ja-JP').includes(normalizedQuery))
    })
  }, [courses, query, term, day, period, curriculumCategory])

  const hasFilters = Boolean(query || term || day || period || curriculumCategory)
  const campus = getCampusForFaculty(facultySlug)

  function clearFilters() {
    setQuery('')
    setTerm('')
    setDay('')
    setPeriod('')
    setCurriculumCategory('')
    setVisibleCount(PAGE_SIZE)
  }

  return (
    <div className="board-page faculty-page">
      <nav className="breadcrumbs" aria-label="現在位置">
        <Link to="/">わせチャン</Link>
        <span> &gt; </span>
        <Link to="/boards">{campus?.label ?? '学部一覧'}</Link>
        <span> &gt; {faculty?.label ?? '科目一覧'}</span>
      </nav>

      <header className="board-title-bar">
        <h1>{faculty?.label ?? '科目一覧'}</h1>
        <span>科目別掲示板</span>
      </header>

      <div className="course-filter-bar">
        <label className="search-field">
          <span>検索</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setVisibleCount(PAGE_SIZE)
            }}
            placeholder="科目名・教員名・科目コード"
            aria-label="科目を検索"
          />
        </label>
        <label className="select-field">
          <span>学期</span>
          <select
            value={term}
            onChange={(event) => {
              setTerm(event.target.value)
              setVisibleCount(PAGE_SIZE)
            }}
            aria-label="学期で絞り込む"
          >
            <option value="">すべての学期</option>
            {primaryTerms.length > 0 && (
              <optgroup label="通常の学期・クォーター">
                {primaryTerms.map((item) => <option key={item}>{item}</option>)}
              </optgroup>
            )}
            {specialTerms.length > 0 && (
              <optgroup label="集中・その他">
                {specialTerms.map((item) => <option key={item}>{item}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <label className="select-field">
          <span>曜日</span>
          <select
            value={day}
            onChange={(event) => {
              setDay(event.target.value)
              setVisibleCount(PAGE_SIZE)
            }}
            aria-label="曜日で絞り込む"
          >
            <option value="">すべての曜日</option>
            {DAYS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="select-field">
          <span>時限</span>
          <select
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value)
              setVisibleCount(PAGE_SIZE)
            }}
            aria-label="時限で絞り込む"
          >
            <option value="">すべての時限</option>
            {PERIODS.map((item) => <option key={item} value={item}>{item}限</option>)}
          </select>
        </label>
        {facultySlug === 'social_sciences' && (
          <label className="select-field curriculum-filter-field">
            <span>学科目区分</span>
            <select
              value={curriculumCategory}
              onChange={(event) => {
                setCurriculumCategory(event.target.value)
                setVisibleCount(PAGE_SIZE)
              }}
              aria-label="学科目区分で絞り込む"
            >
              <option value="">すべての学科目区分</option>
              {CURRICULUM_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => <option key={option}>{option}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <StatusNotice>{error}</StatusNotice>}

      <div className="list-summary">
        <strong>全部 {Math.min(visibleCount, filteredCourses.length).toLocaleString()} / {filteredCourses.length.toLocaleString()}</strong>
        {hasFilters && <button type="button" onClick={clearFilters}>条件をクリア</button>}
      </div>

      {loading ? (
        <div className="empty-state">科目を読み込んでいます...</div>
      ) : filteredCourses.length === 0 ? (
        <div className="empty-state">条件に一致する科目がありません。</div>
      ) : (
        <ol className="course-list" start={1}>
          {filteredCourses.slice(0, visibleCount).map((course, index) => (
            <li className="course-row" key={course.id}>
              <span className="course-number">{index + 1}</span>
              <div className="course-main">
                <h2>
                  <Link to={`/faculty/${facultySlug}/course/${course.id}`}>{course.name}</Link>
                </h2>
                <p>
                  <span>{course.teacher ?? '教員未定'}</span>
                  {course.term && <span>{course.term}</span>}
                  {course.schedule && <span>{course.schedule}</span>}
                  {course.credits != null && <span>{course.credits}単位</span>}
                  {course.methodType && <span>{course.methodType.replace(/[【】]/g, '')}</span>}
                </p>
              </div>
              <span className="course-code">{course.code || 'コード未登録'}</span>
            </li>
          ))}
        </ol>
      )}

      {visibleCount < filteredCourses.length && (
        <button type="button" className="load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
          さらに表示
        </button>
      )}
    </div>
  )
}
