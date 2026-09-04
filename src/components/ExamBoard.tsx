import { Diamond, Flag, Send } from 'lucide-react'
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
const REPORT_FORMATS = ['期末レポート', '中間レポート', '毎回の課題', '複数回', 'その他']
const BASE_REPORT_COLUMNS = 'id,course_id,anon_label,rating,body,taken_year,taken_term,exam_format,bring_in,exam_minutes,difficulty,time_intensity,mark_writing_balance,created_at'
const REPORT_COLUMNS = `${BASE_REPORT_COLUMNS},report_format,report_word_count,report_details`
const ALL_REPORT_COLUMNS = `${REPORT_COLUMNS},credit_rating,grade_rating,interest_rating,workload_rating`
const RATING_FIELDS = [
  { key: 'credit_rating', label: '単位' },
  { key: 'grade_rating', label: '成績' },
  { key: 'interest_rating', label: '面白さ' },
  { key: 'workload_rating', label: '負担の軽さ' },
] as const
type RatingKey = typeof RATING_FIELDS[number]['key']
type RatingValues = Record<RatingKey, number>
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

function getRating(report: ExamReport, key: RatingKey) {
  return Number(report[key] ?? report.rating)
}

function SmileRating({ value, label }: { value: number; label?: string }) {
  return (
    <span className="smile-rating" aria-label={label ? `${label} 5段階中${value}` : `5段階中${value}`}>
      {[1, 2, 3, 4, 5].map((score) => (
        <span
          key={score}
          className="smile-symbol"
          style={{ '--smile-fill': `${Math.max(0, Math.min(1, value - score + 1)) * 100}%` } as CSSProperties}
          aria-hidden="true"
        >
          ☻
        </span>
      ))}
    </span>
  )
}

function SmileRatingInput({
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
      <div className="smile-rating-input">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            type="button"
            key={score}
            className={score <= value ? 'selected' : ''}
            onClick={() => onChange(score)}
            aria-label={`${label} ${score}`}
          >
            <span
              className="smile-symbol"
              style={{ '--smile-fill': score <= value ? '100%' : '0%' } as CSSProperties}
              aria-hidden="true"
            >
              ☻
            </span>
          </button>
        ))}
      </div>
    </div>
  )
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
  const [includeReport, setIncludeReport] = useState(false)
  const [reportFormat, setReportFormat] = useState('')
  const [reportWordCount, setReportWordCount] = useState('')
  const [reportDetails, setReportDetails] = useState('')

  const loadReports = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      await ensureAnonymousSession()
      const result = await supabase
        .from('exam_reports')
        .select(ALL_REPORT_COLUMNS)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(100)

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
        })) as ExamReport[])
        return
      }

      if (result.error) throw result.error
      setReportFieldsAvailable(true)
      setRatingFieldsAvailable(true)
      setReports((result.data ?? []) as ExamReport[])
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
          report_format: includeReport ? reportFormat || null : null,
          report_word_count: includeReport && reportWordCount ? Number(reportWordCount) : null,
          report_details: includeReport ? reportDetails.trim() || null : null,
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
      setIncludeReport(false)
      setReportFormat('')
      setReportWordCount('')
      setReportDetails('')
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
          <SmileRating value={averageRating ?? 0} />
          <strong>{averageRating?.toFixed(2) ?? '—'}</strong>
          <span>{reports.length}件</span>
        </div>
        <button type="button" className="primary-button" onClick={() => setShowForm((value) => !value)}>
          {showForm ? '閉じる' : '口コミを書く'}
        </button>
      </div>

      {showForm && (
        <form className="exam-form" onSubmit={submitReport}>
          <div className="form-section">
            <label>評価（必須）</label>
            <div className="review-rating-grid">
              {RATING_FIELDS.map(({ key, label }) => (
                <SmileRatingInput
                  key={key}
                  label={label}
                  value={ratings[key]}
                  onChange={(value) => setRatings((current) => ({ ...current, [key]: value }))}
                />
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
                <div className="form-grid two-columns">
                  <label>
                    レポート形式
                    <select value={reportFormat} onChange={(event) => setReportFormat(event.target.value)}>
                      <option value="">未指定</option>
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
                      value={reportWordCount}
                      onChange={(event) => setReportWordCount(event.target.value)}
                      placeholder="2000"
                    />
                  </label>
                </div>
                <label>
                  レポートの補足 <span className="muted-inline">{reportDetails.length}/1000</span>
                  <textarea
                    value={reportDetails}
                    onChange={(event) => setReportDetails(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="テーマ、提出方法、頻度など"
                  />
                </label>
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
                  <SmileRating value={Number(report.rating)} />
                  <strong>{Number(report.rating).toFixed(2)}</strong>
                </div>
                <span>{report.taken_year}年度 {report.taken_term}</span>
              </div>
              <div className="review-rating-breakdown">
                {RATING_FIELDS.map(({ key, label }) => (
                  <span key={key}><b>{label}</b><SmileRating value={getRating(report, key)} label={label} /></span>
                ))}
              </div>
              <p>{report.body}</p>
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
              {(report.report_format || report.report_word_count != null || report.report_details) && (
                <div className="review-extra">
                  <strong>レポート</strong>
                  <dl className="exam-facts">
                    {report.report_format && <div><dt>形式</dt><dd>{report.report_format}</dd></div>}
                    {report.report_word_count != null && <div><dt>分量</dt><dd>約{report.report_word_count.toLocaleString()}字</dd></div>}
                  </dl>
                  {report.report_details && <p className="report-details">{report.report_details}</p>}
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
