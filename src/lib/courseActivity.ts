import type { Course } from '../types/catalog'

export type SavedCourse = Pick<Course, 'id' | 'name' | 'teacher' | 'faculty' | 'facultySlug' | 'year'> & {
  visitedAt: string
}

const FAVORITES_KEY = 'wasechan-favorite-courses'
const RECENT_KEY = 'wasechan-recent-courses'
const CHANGE_EVENT = 'wasechan-course-activity-change'

function read(key: string): SavedCourse[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function write(key: string, courses: SavedCourse[]) {
  localStorage.setItem(key, JSON.stringify(courses))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function snapshot(course: Course): SavedCourse {
  return {
    id: course.id,
    name: course.name,
    teacher: course.teacher,
    faculty: course.faculty,
    facultySlug: course.facultySlug,
    year: course.year,
    visitedAt: new Date().toISOString(),
  }
}

export function getFavoriteCourses() {
  return read(FAVORITES_KEY)
}

export function getRecentCourses() {
  return read(RECENT_KEY)
}

export function isFavoriteCourse(courseId: string) {
  return read(FAVORITES_KEY).some((course) => course.id === courseId)
}

export function toggleFavoriteCourse(course: Course) {
  const current = read(FAVORITES_KEY)
  const exists = current.some((item) => item.id === course.id)
  write(
    FAVORITES_KEY,
    exists ? current.filter((item) => item.id !== course.id) : [snapshot(course), ...current].slice(0, 100),
  )
  return !exists
}

export function rememberCourse(course: Course) {
  const current = read(RECENT_KEY).filter((item) => item.id !== course.id)
  write(RECENT_KEY, [snapshot(course), ...current].slice(0, 30))
}

export function subscribeCourseActivity(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
