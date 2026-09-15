export type Faculty = {
  slug: string
  label: string
  courseCount: number
}

export type Course = {
  id: string
  code: string
  name: string
  teacher: string | null
  faculty: string
  facultySlug: string
  term: string | null
  schedule: string | null
  slots?: CourseSlot[]
  credits: number | null
  methodType: string | null
  year: number | null
  syllabusUrl: string | null
  curriculumCategories?: string[]
}

export type CourseSlot = {
  day: number
  period: number
}
