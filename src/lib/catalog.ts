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

function reviewCourseName(name: string) {
  return name
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/\s+\d{2}(?:\s*クラス)?$/u, '')
    .trim()
}

export function getReviewCourses(courses: Course[], currentCourse: Course) {
  const courseCode = currentCourse.code.normalize('NFKC').trim().toUpperCase()
  if (!courseCode) return [currentCourse]

  const courseName = reviewCourseName(currentCourse.name)
  const matchingCourses = courses.filter((course) => (
    course.code.normalize('NFKC').trim().toUpperCase() === courseCode
    && reviewCourseName(course.name) === courseName
  ))

  return matchingCourses.length > 0 ? matchingCourses : [currentCourse]
}
