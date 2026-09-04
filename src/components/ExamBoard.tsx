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
const EXAM_FORMATS = ['筆記', 'オンライン', 'プレゼン', 'その他']
const BRING_IN_OPTIONS = ['不可', '一部可', '全可']
const ATTENDANCE_METHODS = [
  '出席確認なし',
  'パスワード',
  'レビューシート（紙）',
  'レビューシート（Moodle）',
  '出席カード',
  '点呼',
  '動画視聴（Moodle）',
  'その他',
]
const REPORT_FORMATS = ['中間レポート', '期末レポート', '毎回の課題', 'その他']
const BASE_REPORT_COLUMNS = 'id,course_id,anon_label,rating,body,taken_year,taken_term,exam_format,bring_in,exam_minutes,difficulty,time_intensity,mark_writing_balance,created_at'
const REPORT_COLUMNS = `${BASE_REPORT_COLUMNS},report_format,report_word_count,report_details`
const ALL_REPORT_COLUMNS = `${REPORT_COLUMNS},credit_rating,grade_rating,interest_rating,workload_rating`
const EXTENDED_REPORT_COLUMNS = `${ALL_REPORT_COLUMNS},attendance_method,attendance_notes,report_items`
const RATING_FIELDS = [
  { key: 'credit_rating', label: '単位' },
  { key: 'grade_rating', label: '成績' },
  { key: 'interest_rating', label: '面白さ' },
  { key: 'workload_rating', label: '負担の軽さ' },
] as const
type RatingKey = typeof RATING_FIELDS[number]['key']
type RatingValues = Record<RatingKey, number>
type ReportDraft = {
  id: number
  type: string
  wordCount: string
  details: string
}
const EMPTY_RATINGS: RatingValues = {
  credit_rating: 0,
  grade_rating: 0,
  interest_rating: 0,
  workload_rating: 0,
}

function isMissingReportColumn(error: { message?: string } | null) {
  return Boolean(error?.message?.includes('exam_reports.report_format'))
}

function isMissingRatingColumn(error: { message?: string } | null) {
  return Boolean(error?.message?.includes('exam_reports.credit_rating'))
}

function isMissingExtendedReportColumn(error: { message?: string } | null) {
  return Boolean(
    error?.message?.includes('exam_reports.attendance_method')
    || error?.message?.includes('exam_reports.attendance_notes')
    || error?.message?.includes('exam_reports.report_items'),
  )
}

function getRating(report: ExamReport, key: RatingKey) {
  return Number(report[key] ?? report.rating)
}

function StarRating({ value, label }: { value: number; label?: string }) {
  const roundedValue = Math.round(value * 2) / 2
  return (
    <span className="star-rating" aria-label={label ? `${label} 5段階中${value}` : `5段階中${value}`}>
      {[1, 2, 3, 4, 5].map((score) => (
        <span
          key={score}
          className="star-symbol"
          style={{ '--star-fill': `${Math.max(0, Math.min(1, roundedValue - score + 1)) * 100}%` } as CSSProperties}
          aria-hidden="true"
        >
          <Star className="star-outline" />
          <span className="star-fill"><Star fill="currentColor" /></span>
        </span>
      ))}
    </span>
  )
}

function StarRatingInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="review-rating-field">
      <span>{label}</span>
      <div className="star-rating-input">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            type="button"
            key={score}
            className={score <= value ? 'selected' : ''}
            onClick={() => onChange(score)}
            aria-label={`${label} ${score}`}
          >
            <span
              className="star-symbol"
              style={{ '--star-fill': score <= value ? '100%' : '0%' } as CSSProperties}
              aria-hidden="true"
            >
              <Star className="star-outline" />
              <span className="star-fill"><Star fill="currentColor" /></span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function getReportItems(report: ExamReport) {
  if (Array.isArray(report.report_items) && report.report_items.length > 0) {
    return report.report_items
  }
  if (report.report_format || report.report_word_count != null || report.report_details) {
    return [{
      type: report.report_format ?? 'レポート',
      word_count: report.report_word_count,
      details: report.report_details,
    }]
  }
  return []
}

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
  const [reportFieldsAvailable, setReportFieldsAvailable] = useState(true)
  const [ratingFieldsAvailable, setRatingFieldsAvailable] = useState(true)
  const [extendedFieldsAvailable, setExtendedFieldsAvailable] = useState(true)
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all')

  const [ratings, setRatings] = useState<RatingValues>(EMPTY_RATINGS)
  const [body, setBody] = useState('')
  const [takenYear, setTakenYear] = useState(CURRENT_YEAR)
  const [takenTerm, setTakenTerm] = useState('春学期')
  const [includeExam, setIncludeExam] = useState(false)
  const [examFormat, setExamFormat] = useState('')
  const [bringIn, setBringIn] = useState('')
  const [examMinutes, setExamMinutes] = useState('')
  const [difficulty, setDifficulty] = useState(0)
  const [timeIntensity, setTimeIntensity] = useState(0)
  const [includeBalance, setIncludeBalance] = useState(false)
  const [markWritingBalance, setMarkWritingBalance] = useState(50)
  const [attendanceMethod, setAttendanceMethod] = useState('')
  const [attendanceNotes, setAttendanceNotes] = useState('')
  const [includeReport, setIncludeReport] = useState(false)
  const [reportDrafts, setReportDrafts] = useState<ReportDraft[]>([
    { id: 1, type: '期末レポート', wordCount: '', details: '' },
  ])

  const loadReports = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      await ensureAnonymousSession()
      let result: { data: Record<string, unknown>[] | null; error: { message: string } | null } = await supabase
        .from('exam_reports')
        .select(EXTENDED_REPORT_COLUMNS)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (isMissingExtendedReportColumn(result.error)) {
        setExtendedFieldsAvailable(false)
        result = await supabase
          .from('exam_reports')
          .select(ALL_REPORT_COLUMNS)
          .eq('course_id', courseId)
          .order('created_at', { ascending: false })
          .limit(100)
      } else {
        setExtendedFieldsAvailable(true)
      }

      if (isMissingRatingColumn(result.error)) {
        const fallback = await supabase
          .from('exam_reports')
          .select(REPORT_COLUMNS)
          .eq('course_id', courseId)
          .order('created_at', { ascending: false })
          .limit(100)
        if (fallback.error) throw fallback.error
        setRatingFieldsAvailable(false)
        setReportFieldsAvailable(true)
        setMessage(null)
        setReports((fallback.data ?? []).map((report) => ({
          ...report,
          credit_rating: null,
          grade_rating: null,
          interest_rating: null,
          workload_rating: null,
          attendance_method: null,
          attendance_notes: null,
          report_items: null,
        })) as ExamReport[])
        return
      }

      if (isMissingReportColumn(result.error)) {
        const fallback = await supabase
          .from('exam_reports')
          .select(BASE_REPORT_COLUMNS)
          .eq('course_id', courseId)
          .order('created_at', { ascending: false })
          .limit(100)
        if (fallback.error) throw fallback.error
        setReportFieldsAvailable(false)
        setRatingFieldsAvailable(false)
        setMessage(null)
        setReports((fallback.data ?? []).map((report) => ({
          ...report,
          credit_rating: null,
          grade_rating: null,
          interest_rating: null,
          workload_rating: null,
          report_format: null,
          report_word_count: null,
          report_details: null,
          attendance_method: null,
          attendance_notes: null,
          report_items: null,
        })) as ExamReport[])
        return
      }

      if (result.error) throw result.error
      setReportFieldsAvailable(true)
      setRatingFieldsAvailable(true)
      setReports((result.data ?? []).map((report) => ({
        ...report,
        attendance_method: 'attendance_method' in report ? report.attendance_method : null,
        attendance_notes: 'attendance_notes' in report ? report.attendance_notes : null,
        report_items: 'report_items' in report ? report.report_items : null,
      })) as ExamReport[])
    } catch (error) {
      setMessage(getErrorMessage(error, '口コミを読み込めませんでした'))
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const averageRating = useMemo(
    () => reports.length
      ? reports.reduce((sum, report) => sum + Number(report.rating), 0) / reports.length
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

  function updateReportDraft(id: number, changes: Partial<Omit<ReportDraft, 'id'>>) {
    setReportDrafts((current) => current.map((draft) => (
      draft.id === id ? { ...draft, ...changes } : draft
    )))
  }

  function addReportDraft() {
    setReportDrafts((current) => {
      if (current.length >= 5) return current
      const nextId = Math.max(0, ...current.map((draft) => draft.id)) + 1
      return [...current, { id: nextId, type: '期末レポート', wordCount: '', details: '' }]
    })
  }

  function removeReportDraft(id: number) {
    setReportDrafts((current) => current.length === 1
      ? [{ id: current[0].id, type: '期末レポート', wordCount: '', details: '' }]
      : current.filter((draft) => draft.id !== id))
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    if (RATING_FIELDS.some(({ key }) => ratings[key] === 0)) {
      setMessage('4つの評価を選んでください')
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
      const overallRating = Number((RATING_FIELDS.reduce((sum, { key }) => sum + ratings[key], 0) / RATING_FIELDS.length).toFixed(2))
      const reportItems = includeReport
        ? reportDrafts
          .map((draft) => ({
            type: draft.type || 'その他',
            word_count: draft.wordCount ? Number(draft.wordCount) : null,
            details: draft.details.trim() || null,
          }))
          .filter((item) => item.type || item.word_count != null || item.details)
        : []
      const { error } = await supabase.from('exam_reports').insert({
        course_id: courseId,
        rating: overallRating,
        ...(ratingFieldsAvailable ? ratings : {}),
        body: body.trim(),
        taken_year: takenYear,
        taken_term: takenTerm,
        exam_format: includeExam ? examFormat || null : null,
        bring_in: includeExam ? bringIn || null : null,
        exam_minutes: includeExam && examMinutes ? Number(examMinutes) : null,
        difficulty: includeExam ? difficulty || null : null,
        time_intensity: includeExam ? timeIntensity || null : null,
        mark_writing_balance: includeExam && includeBalance ? markWritingBalance : null,
        ...(reportFieldsAvailable ? {
          report_format: !extendedFieldsAvailable && includeReport ? reportDrafts[0]?.type || null : null,
          report_word_count: !extendedFieldsAvailable && includeReport && reportDrafts[0]?.wordCount
            ? Number(reportDrafts[0].wordCount)
            : null,
          report_details: !extendedFieldsAvailable && includeReport ? reportDrafts[0]?.details.trim() || null : null,
        } : {}),
        ...(extendedFieldsAvailable ? {
          attendance_method: attendanceMethod || null,
          attendance_notes: attendanceMethod ? attendanceNotes.trim() || null : null,
          report_items: reportItems,
        } : {}),
      })
      if (error) throw error
      setRatings(EMPTY_RATINGS)
      setBody('')
      setIncludeExam(false)
      setExamFormat('')
      setBringIn('')
      setExamMinutes('')
      setDifficulty(0)
      setTimeIntensity(0)
      setIncludeBalance(false)
      setAttendanceMethod('')
      setAttendanceNotes('')
      setIncludeReport(false)
      setReportDrafts([{ id: 1, type: '期末レポート', wordCount: '', details: '' }])
      setShowForm(false)
      setMessage('投稿ありがとうございます！')
      await loadReports()
    } catch (error) {
      setMessage(getErrorMessage(error, '口コミを投稿できませんでした'))
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
    return <StatusNotice setup>口コミは準備中です。Supabase接続後に投稿できます。</StatusNotice>
  }

  return (
    <section className="board-stack" aria-label="口コミ">
      <div className="exam-summary">
        <div className="review-average">
          <StarRating value={averageRating ?? 0} />
          <strong>{averageRating?.toFixed(2) ?? '—'}</strong>
          <span>{reports.length}件</span>
        </div>
        <button type="button" className="primary-button" onClick={() => setShowForm((value) => !value)}>
          {showForm ? '閉じる' : '口コミを書く'}
        </button>
      </div>

      {showForm && (
        <form className="exam-form" onSubmit={submitReport}>
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

          <div className="form-section">
            <label>評価（必須）</label>
            <div className="review-rating-grid">
              {RATING_FIELDS.map(({ key, label }) => (
                <StarRatingInput
                  key={key}
                  label={label}
                  value={ratings[key]}
                  onChange={(value) => setRatings((current) => ({ ...current, [key]: value }))}
                />
              ))}
            </div>
          </div>

          <label>
            授業の口コミ（必須） <span className="muted-inline">{body.length}/1000</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="授業内容、課題の量、出席、雰囲気などを10文字以上で"
            />
          </label>

          <div className="optional-info-heading">
            <strong>成績評価方法（任意）</strong>
          </div>

          {extendedFieldsAvailable && (
            <div className="attendance-fields">
              <label>
                出席確認
                <select value={attendanceMethod} onChange={(event) => setAttendanceMethod(event.target.value)}>
                  <option value="">未入力</option>
                  {ATTENDANCE_METHODS.map((method) => <option key={method}>{method}</option>)}
                </select>
              </label>
              {attendanceMethod && attendanceMethod !== '出席確認なし' && (
                <label>
                  出席の補足 <span className="muted-inline">{attendanceNotes.length}/30</span>
                  <input
                    type="text"
                    value={attendanceNotes}
                    maxLength={30}
                    onChange={(event) => setAttendanceNotes(event.target.value)}
                    placeholder="例：毎回授業の最後に実施"
                  />
                </label>
              )}
            </div>
          )}

          <div className={`optional-info-switches${reportFieldsAvailable ? '' : ' single'}`}>
            <label className={`optional-info-switch${includeExam ? ' selected' : ''}`}>
              <input type="checkbox" checked={includeExam} onChange={(event) => setIncludeExam(event.target.checked)} />
              <span><strong>テスト</strong><small>形式・持込・時間など</small></span>
            </label>
            {reportFieldsAvailable && (
              <label className={`optional-info-switch${includeReport ? ' selected' : ''}`}>
                <input type="checkbox" checked={includeReport} onChange={(event) => setIncludeReport(event.target.checked)} />
                <span><strong>レポート</strong><small>形式・分量・提出方法など</small></span>
              </label>
            )}
          </div>

          {includeExam && (
            <div className="optional-info-section">
              <div className="optional-info-section-title">テスト</div>
              <div className="optional-info-fields">
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
              </div>
            </div>
          )}

          {reportFieldsAvailable && includeReport && (
            <div className="optional-info-section">
              <div className="optional-info-section-title">レポート</div>
              <div className="optional-info-fields">
                {reportDrafts.map((draft, index) => (
                  <div className="report-draft" key={draft.id}>
                    <div className="report-draft-heading">
                      <strong>レポート {index + 1}</strong>
                      <button type="button" onClick={() => removeReportDraft(draft.id)}>削除</button>
                    </div>
                    <div className="form-grid two-columns">
                      <label>
                        種類
                        <select value={draft.type} onChange={(event) => updateReportDraft(draft.id, { type: event.target.value })}>
                          {REPORT_FORMATS.map((format) => <option key={format}>{format}</option>)}
                        </select>
                      </label>
                      <label>
                        おおよその文字数
                        <input
                          type="number"
                          min="0"
                          max="100000"
                          step="100"
                          value={draft.wordCount}
                          onChange={(event) => updateReportDraft(draft.id, { wordCount: event.target.value })}
                          placeholder="2000"
                        />
                      </label>
                    </div>
                    <label>
                      補足 <span className="muted-inline">{draft.details.length}/1000</span>
                      <textarea
                        value={draft.details}
                        onChange={(event) => updateReportDraft(draft.id, { details: event.target.value })}
                        maxLength={1000}
                        rows={3}
                        placeholder="テーマ、提出方法など"
                      />
                    </label>
                  </div>
                ))}
                {reportDrafts.length < 5 && (
                  <button type="button" className="add-report-button" onClick={addReportDraft}>＋ レポートを追加</button>
                )}
              </div>
            </div>
          )}

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
        <div className="empty-state">口コミはまだありません。</div>
      ) : (
        <ol className="exam-list">
          {visibleReports.map((report) => (
            <li className="exam-item" key={report.id}>
              <div className="exam-item-header">
                <div className="review-average small">
                  <StarRating value={Number(report.rating)} />
                  <strong>{Number(report.rating).toFixed(2)}</strong>
                </div>
                <span>{report.taken_year}年度 {report.taken_term}</span>
              </div>
              <div className="review-rating-breakdown">
                {RATING_FIELDS.map(({ key, label }) => (
                  <span key={key}><b>{label}</b><StarRating value={getRating(report, key)} label={label} /></span>
                ))}
              </div>
              <p>{report.body}</p>
              {(report.attendance_method || report.attendance_notes) && (
                <div className="review-extra compact">
                  <strong>出席</strong>
                  <dl className="exam-facts">
                    {report.attendance_method && <div><dt>確認方法</dt><dd>{report.attendance_method}</dd></div>}
                  </dl>
                  {report.attendance_notes && <p className="report-details">{report.attendance_notes}</p>}
                </div>
              )}
              {(report.exam_format || report.bring_in || report.exam_minutes != null || report.difficulty != null || report.time_intensity != null || report.mark_writing_balance != null) && (
                <div className="review-extra">
                  <strong>テスト</strong>
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
                </div>
              )}
              {getReportItems(report).length > 0 && (
                <div className="review-extra">
                  <strong>レポート</strong>
                  <div className="report-items">
                    {getReportItems(report).map((item, index) => (
                      <div className="report-item" key={`${report.id}-report-${index}`}>
                        <dl className="exam-facts">
                          {item.type && <div><dt>種類</dt><dd>{item.type}</dd></div>}
                          {item.word_count != null && <div><dt>分量</dt><dd>約{item.word_count.toLocaleString()}字</dd></div>}
                        </dl>
                        {item.details && <p className="report-details">{item.details}</p>}
                      </div>
                    ))}
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
