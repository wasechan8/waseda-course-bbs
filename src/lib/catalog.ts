import type { Course, Faculty } from '../types/catalog'

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(dataUrl(path))
  if (!response.ok) {
    throw new Error('科目データを読み込めませんでした')
  }
  return response.json() as Promise<T>
}

export function getFaculties() {
  return readJson<Faculty[]>('faculties.json')
}

export function getCourses(facultySlug: string) {
  return readJson<Course[]>(`courses/${facultySlug}.json`)
}

function compactName(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/[\s\u3000・･,，:：_\-‐－]/gu, '')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function teacherSuffixes(teacher: string | null) {
  if (!teacher) return []

  return teacher
    .normalize('NFKC')
    .split(/[／/,、]+/u)
    .flatMap((teacherName) => {
      const parts = teacherName.trim().split(/\s+/u).filter(Boolean)
      if (parts.length === 0) return []
      return [parts.join(''), parts[0]]
    })
    .filter((suffix) => Array.from(suffix).length >= 2)
    .sort((left, right) => right.length - left.length)
}

function reviewCourseName(course: Course) {
  let name = course.name
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()

  // Some science and engineering titles append the instructor directly to the title.
  for (const teacher of teacherSuffixes(course.teacher)) {
    const flexibleSuffix = Array.from(teacher).map(escapeRegExp).join('\\s*')
    const withoutTeacher = name.replace(new RegExp(`\\s*${flexibleSuffix}\\s*$`, 'iu'), '')
    if (withoutTeacher !== name) {
      name = withoutTeacher
      break
    }
  }

  name = name
    .replace(/(?:春期|秋期|春学期|秋学期)?[月火水木金土日](?:曜)?[1-7](?:時限)?$/u, '')
    .replace(/(?:【[^】]*】|\[[^\]]*\])$/u, '')

  let previous = ''
  while (name !== previous) {
    previous = name
    name = name
      .replace(/(?:\s+(?:\d{1,2}|[IVX]{1,4}|[A-D])(?:\s*クラス)?|(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])(?:\d{1,2}|[IVX]{1,4}|[A-D]))$/iu, '')
      .replace(/(?:【[^】]*】|\[[^\]]*\])$/u, '')
  }

  return compactName(name)
}

function courseNamesMatch(left: Course, right: Course) {
  const leftName = reviewCourseName(left)
  const rightName = reviewCourseName(right)
  if (!leftName || !rightName) return false
  if (leftName === rightName) return true

  const [shorter, longer] = leftName.length <= rightName.length
    ? [leftName, rightName]
    : [rightName, leftName]

  return Array.from(shorter).length >= 2 && longer.includes(shorter)
}

export function getReviewCourses(courses: Course[], currentCourse: Course) {
  const courseCode = currentCourse.code.normalize('NFKC').trim().toUpperCase()
  if (!courseCode) return [currentCourse]

  const matchingCourses = courses.filter((course) => (
    course.code.normalize('NFKC').trim().toUpperCase() === courseCode
    && courseNamesMatch(course, currentCourse)
  ))

  return matchingCourses.length > 0 ? matchingCourses : [currentCourse]
}
