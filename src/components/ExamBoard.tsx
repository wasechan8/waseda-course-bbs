import { Diamond, Flag, Send, Star } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { ensureAnonymousSession, isSupabaseConfigured, supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import type { ExamReport } from '../types/community'
import { StatusNotice } from './StatusNotice'
import { PostingPolicyNotice } from './PostingPolicyNotice'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 10 }, (_, index) => CURRENT_YEAR - index)
const TERMS = [
  '春学期',
  '秋学期',
  '通年',
  '春クォーター',
  '夏クォーター',
  '秋クォーター',
  '冬クォーター',
  '夏季集中',
  '冬季集中',
]
const EXAM_FORMATS = ['筆記', 'レポート', 'オンライン', 'プレゼン', 'なし', 'その他']
const BRING_IN_OPTIONS = ['不可', '一部可', '全可']

function ScoreInput({
  value,
  onChange,
  tone,
  label,
}: {
  value: number
  onChange: (value: number) => void
  tone: 'difficulty' | 'intensity'
  label: string
}) {
  return (
    <div className="score-field">
      <span>{label}</span>
      <div className={`diamond-score ${tone}`}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            type="button"
            key={score}
            className={score <= value ? 'selected' : ''}
            onClick={() => onChange(value === score ? 0 : score)}
            aria-label={`${label} ${score}`}
          >
            <Diamond size={19} fill="currentColor" />
          </button>
        ))}
      </div>
    </div>
  )
}

function ScoreDisplay({ value, tone }: { value: number; tone: 'difficulty' | 'intensity' }) {
  return (
    <span className={`diamond-display ${tone}`} aria-label={`5段階中${value}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Diamond key={index} size={12} fill="currentColor" className={index < value ? 'filled' : ''} />
      ))}
    </span>
  )
}

export function ExamBoard({ courseId }: { courseId: string }) {
  const [reports, setReports] = useState<ExamReport[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all')

  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [takenYear, setTakenYear] = useState(CURRENT_YEAR)
  const [takenTerm, setTakenTerm] = useState('春学期')
  const [examFormat, setExamFormat] = useState('')
  const [bringIn, setBringIn] = useState('')
  const [examMinutes, setExamMinutes] = useState('')
  const [difficulty, setDifficulty] = useState(0)
  const [timeIntensity, setTimeIntensity] = useState(0)
  const [includeBalance, setIncludeBalance] = useState(false)
  const [markWritingBalance, setMarkWritingBalance] = useState(50)

  const loadReports = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      await ensureAnonymousSession()
      const { data, error } = await supabase
        .from('exam_reports')
        .select(
          'id,course_id,anon_label,rating,body,taken_year,taken_term,exam_format,bring_in,exam_minutes,difficulty,time_intensity,mark_writing_balance,created_at',
        )
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setReports((data ?? []) as ExamReport[])
    } catch (error) {
      setMessage(getErrorMessage(error, 'テスト情報を読み込めませんでした'))
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const averageRating = useMemo(
    () => reports.length
      ? reports.reduce((sum, report) => sum + report.rating, 0) / reports.length
      : null,
    [reports],
  )
  const availableYears = useMemo(
    () => [...new Set(reports.map((report) => report.taken_year))].sort((a, b) => b - a),
    [reports],
  )
  const visibleReports = useMemo(
    () => yearFilter === 'all' ? reports : reports.filter((report) => report.taken_year === yearFilter),
    [reports, yearFilter],
  )

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    if (rating === 0) {
      setMessage('評価を選んでください')
      return
    }
    if (body.trim().length < 10) {
      setMessage('本文を10文字以上で入力してください')
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      await ensureAnonymousSession()
      const { error } = await supabase.from('exam_reports').insert({
        course_id: courseId,
        rating,
        body: body.trim(),
        taken_year: takenYear,
        taken_term: takenTerm,
        exam_format: examFormat || null,
        bring_in: bringIn || null,
        exam_minutes: examMinutes ? Number(examMinutes) : null,
        difficulty: difficulty || null,
        time_intensity: timeIntensity || null,
        mark_writing_balance: includeBalance ? markWritingBalance : null,
      })
      if (error) throw error
      setRating(0)
      setBody('')
      setExamFormat('')
      setBringIn('')
      setExamMinutes('')
      setDifficulty(0)
      setTimeIntensity(0)
      setIncludeBalance(false)
      setShowForm(false)
      await loadReports()
    } catch (error) {
      setMessage(getErrorMessage(error, 'テスト情報を投稿できませんでした'))
    } finally {
      setSubmitting(false)
    }
  }

  async function flagReport(reportId: string) {
    if (!supabase || !window.confirm('この投稿を運営に通報しますか？')) return
    try {
      await ensureAnonymousSession()
      const { error } = await supabase.from('exam_report_flags').insert({
        exam_report_id: reportId,
        reason: 'other',
      })
      if (error) {
        if (error.code === '23505') throw new Error('この投稿はすでに通報済みです')
        throw error
      }
      setMessage('通報を受け付けました')
    } catch (error) {
      setMessage(getErrorMessage(error, '通報できませんでした'))
    }
  }

  if (!isSupabaseConfigured) {
    return <StatusNotice setup>テスト情報掲示板は準備中です。Supabase接続後に投稿できます。</StatusNotice>
  }

  return (
    <section className="board-stack" aria-label="テスト情報">
      <div className="exam-summary">
        <div>
          <span className="summary-label">総合評価</span>
          <strong>{averageRating?.toFixed(1) ?? '—'}</strong>
          <span>{reports.length}件</span>
        </div>
        <div className="stars" aria-label={averageRating ? `5段階中${averageRating}` : '評価なし'}>
          {[1, 2, 3, 4, 5].map((score) => (
            <Star key={score} size={18} fill={averageRating && score <= Math.round(averageRating) ? 'currentColor' : 'none'} />
          ))}
        </div>
        <button type="button" className="primary-button" onClick={() => setShowForm((value) => !value)}>
          {showForm ? '閉じる' : 'テスト情報を書く'}
        </button>
      </div>

      {showForm && (
        <form className="exam-form" onSubmit={submitReport}>
          <div className="form-section">
            <label>授業の評価</label>
            <div className="rating-input">
              {[1, 2, 3, 4, 5].map((score) => (
                <button type="button" key={score} onClick={() => setRating(score)} aria-label={`評価${score}`}>
                  <Star size={25} fill={score <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid two-columns">
            <label>
              履修年度
              <select value={takenYear} onChange={(event) => setTakenYear(Number(event.target.value))}>
                {YEARS.map((year) => <option key={year}>{year}</option>)}
              </select>
            </label>
            <label>
              学期
              <select value={takenTerm} onChange={(event) => setTakenTerm(event.target.value)}>
                {TERMS.map((term) => <option key={term}>{term}</option>)}
              </select>
            </label>
          </div>

          <label>
            感想・補足 <span className="muted-inline">{body.length}/1000</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="試験の傾向や授業の感想を10文字以上で"
            />
          </label>

          <div className="form-divider"><span>試験情報（任意）</span></div>
          <div className="form-grid three-columns">
            <label>
              試験形式
              <select value={examFormat} onChange={(event) => setExamFormat(event.target.value)}>
                <option value="">未指定</option>
                {EXAM_FORMATS.map((format) => <option key={format}>{format}</option>)}
              </select>
            </label>
            <label>
              持込
              <select value={bringIn} onChange={(event) => setBringIn(event.target.value)}>
                <option value="">未指定</option>
                {BRING_IN_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              試験時間（分）
              <input
                type="number"
                min="0"
                max="600"
                value={examMinutes}
                onChange={(event) => setExamMinutes(event.target.value)}
                placeholder="90"
              />
            </label>
          </div>

          <div className="form-grid two-columns score-grid">
            <ScoreInput label="難易度" value={difficulty} onChange={setDifficulty} tone="difficulty" />
            <ScoreInput label="時間のキツさ" value={timeIntensity} onChange={setTimeIntensity} tone="intensity" />
          </div>

          <div className="balance-field">
            <label className="check-label">
              <input type="checkbox" checked={includeBalance} onChange={(event) => setIncludeBalance(event.target.checked)} />
              マーク・記述比率を入力
            </label>
            {includeBalance && (
              <div>
                <div className="balance-labels">
                  <span className="mark-label">マーク {markWritingBalance}%</span>
                  <span className="writing-label">記述 {100 - markWritingBalance}%</span>
                </div>
                <input
                  className="balance-range"
                  type="range"
                  min="0"
                  max="100"
                  value={markWritingBalance}
                  onChange={(event) => setMarkWritingBalance(Number(event.target.value))}
                  style={{ '--balance-value': `${markWritingBalance}%` } as CSSProperties}
                />
              </div>
            )}
          </div>

          <PostingPolicyNotice />
          <button className="primary-button submit-wide" type="submit" disabled={submitting}>
            <Send size={16} /> {submitting ? '送信中' : '投稿する'}
          </button>
        </form>
      )}

      {message && <StatusNotice>{message}</StatusNotice>}

      {availableYears.length > 1 && (
        <div className="exam-year-filter">
          <label htmlFor="exam-year">履修年度</label>
          <select id="exam-year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
            <option value="all">すべて</option>
            {availableYears.map((year) => <option value={year} key={year}>{year}年度</option>)}
          </select>
          <span>{visibleReports.length}件</span>
        </div>
      )}

      {loading ? (
        <div className="empty-state">読み込み中...</div>
      ) : reports.length === 0 ? (
        <div className="empty-state">テスト情報はまだありません。</div>
      ) : (
        <ol className="exam-list">
          {visibleReports.map((report) => (
            <li className="exam-item" key={report.id}>
              <div className="exam-item-header">
                <div className="stars small">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <Star key={score} size={15} fill={score <= report.rating ? 'currentColor' : 'none'} />
                  ))}
                </div>
                <span>{report.taken_year}年度 {report.taken_term}</span>
              </div>
              <p>{report.body}</p>
              <dl className="exam-facts">
                {report.exam_format && <div><dt>形式</dt><dd>{report.exam_format}</dd></div>}
                {report.bring_in && <div><dt>持込</dt><dd>{report.bring_in}</dd></div>}
                {report.exam_minutes != null && <div><dt>時間</dt><dd>{report.exam_minutes}分</dd></div>}
                {report.difficulty != null && <div><dt>難易度</dt><dd><ScoreDisplay value={report.difficulty} tone="difficulty" /></dd></div>}
                {report.time_intensity != null && <div><dt>時間のキツさ</dt><dd><ScoreDisplay value={report.time_intensity} tone="intensity" /></dd></div>}
              </dl>
              {report.mark_writing_balance != null && (
                <div className="balance-display">
                  <div className="balance-labels">
                    <span className="mark-label">マーク {report.mark_writing_balance}%</span>
                    <span className="writing-label">記述 {100 - report.mark_writing_balance}%</span>
                  </div>
                  <div className="balance-track">
                    <span className="mark-balance" style={{ width: `${report.mark_writing_balance}%` }} />
                    <span className="writing-balance" style={{ width: `${100 - report.mark_writing_balance}%` }} />
                  </div>
                </div>
              )}
              <div className="exam-footer">
                <span>{report.anon_label}</span>
                <button type="button" className="report-button" onClick={() => void flagReport(report.id)}>
                  <Flag size={14} /> 通報
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
