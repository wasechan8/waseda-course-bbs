export type VoteChoice = 'up' | 'down'

export type BbsPost = {
  id: string
  course_id: string
  post_no: number
  anon_label: string
  body: string
  like_count: number
  dislike_count: number
  created_at: string
}

export type ExamReport = {
  id: string
  course_id: string
  anon_label: string
  rating: number
  body: string
  taken_year: number
  taken_term: string
  exam_format: string | null
  bring_in: string | null
  exam_minutes: number | null
  difficulty: number | null
  time_intensity: number | null
  mark_writing_balance: number | null
  created_at: string
}

export type LoungeThread = {
  id: string
  campus_slug: string
  title: string
  reply_count: number
  created_at: string
}
