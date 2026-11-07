import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, ClipboardList, CheckCircle2, AlertTriangle, Award, Send, MessageSquare, GraduationCap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { parentAPI, clearParentSession } from '../../services/parentApi'
import { StatCard, Badge, Alert, Spinner, PageLoader, EmptyState } from '../../components/ui/index.jsx'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function ProgressBar({ value, color = 'bg-primary-900' }) {
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${Math.min(100, value || 0)}%` }} />
    </div>
  )
}

function FeedbackForm({ classTeacher, subjectTeachers, guardianName, onSent }) {
  // '' = default: the class teacher. Otherwise "teacherId:subjectId".
  const [recipient, setRecipient] = useState('')
  const [title, setTitle]         = useState('')
  const [message, setMessage]     = useState('')
  const [name, setName]           = useState(guardianName || '')
  const [sending, setSending]     = useState(false)
  const [result, setResult]       = useState(null)

  useEffect(() => {
    if (guardianName && !name) {
      setName(guardianName)
    }
  }, [guardianName, name])

  const submit = async (e) => {
    e.preventDefault()
    setResult(null)
    setSending(true)
    try {
      const payload = {
        message: message.trim(),
        title: title.trim() || null,
        parent_name: name.trim() || guardianName || null,
      }
      if (recipient) {
        const [teacherId, subjectId] = recipient.split(':').map(Number)
        payload.teacher_id = teacherId
        payload.subject_id = subjectId
      }
      await parentAPI.sendFeedback(payload)
      setTitle('')
      setMessage('')
      setRecipient('')
      setResult({ type: 'success', message: 'Message sent successfully' })
      toast.success('Message sent successfully')
      await onSent?.()
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Could not send your message.'
      setResult({ type: 'error', message: errorMsg })
      toast.error(errorMsg)
    } finally {
      setSending(false)
    }
  }

  const noClassTeacher = !classTeacher && !recipient

  return (
    <form id="parent-feedback-form" onSubmit={submit} className="space-y-4">
      {result && <Alert type={result.type} message={result.message} />}

      <div>
        <label htmlFor="feedback-recipient" className="label">Send to</label>
        <select id="feedback-recipient" className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)}>
          <option value="">
            {classTeacher ? `Class Teacher — ${classTeacher.teacher_name} (default)` : 'Class Teacher (not assigned)'}
          </option>
          {subjectTeachers.length > 0 && (
            <optgroup label="Subject Teachers">
              {subjectTeachers.map((s) => (
                <option key={`${s.teacher_id}:${s.subject_id}`} value={`${s.teacher_id}:${s.subject_id}`}>
                  {s.subject_name} — {s.teacher_name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <p className="text-xs text-gray-500 mt-1">Optional — choose a subject teacher to override the default.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="feedback-name" className="label">Your name</label>
          <input id="feedback-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div>
          <label htmlFor="feedback-title" className="label">Subject (optional)</label>
          <input id="feedback-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>
      </div>

      <div>
        <label htmlFor="feedback-message" className="label">Message</label>
        <textarea id="feedback-message" className="input min-h-[120px]" value={message}
          onChange={(e) => setMessage(e.target.value)} minLength={5} maxLength={5000} required
          placeholder="Write your message to the teacher…" />
      </div>

      <button id="feedback-submit" type="submit" disabled={sending || noClassTeacher || message.trim().length < 5}
        className="btn-primary inline-flex items-center gap-2">
        {sending ? <Spinner size="sm" /> : <Send size={16} />} Send message
      </button>
    </form>
  )
}

export default function ParentDashboard() {
  const navigate = useNavigate()
  const [data, setData]         = useState(null)
  const [history, setHistory]   = useState([])
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')

  const loadHistory = () => parentAPI.myFeedback().then(({ data }) => setHistory(data.data || [])).catch(() => {})

  useEffect(() => {
    parentAPI.dashboard()
      .then(({ data }) => setData(data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
    loadHistory()
  }, [])

  const logout = () => { clearParentSession(); navigate('/parent/login', { replace: true }) }

  const tasks = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data.tasks
    if (filter === 'completed') return data.tasks.filter((t) => ['submitted', 'late', 'graded'].includes(t.status))
    return data.tasks.filter((t) => t.status === filter)
  }, [data, filter])

  if (loading) return <PageLoader />

  const s = data?.summary

  return (
    <div className="min-h-screen bg-gov-light">
      <header className="bg-primary-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center"><GraduationCap size={22} /></div>
            <div>
              <h1 className="text-lg font-bold">{data?.student?.name || 'Parent Portal'}</h1>
              <p className="text-xs text-white/70">
                Student ID {data?.student?.student_id}{data?.class ? ` · ${data.class.name}` : ''}
              </p>
            </div>
          </div>
          <button id="parent-logout" onClick={logout} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && <Alert type="error" message={error} />}

        {s && (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Tasks" value={s.total_tasks} icon={ClipboardList} color="blue" />
              <StatCard label="Completed" value={s.completed} icon={CheckCircle2} color="green" sub={`${s.completion_rate}% completion`} />
              <StatCard label="Overdue" value={s.overdue} icon={AlertTriangle} color="red" sub={`${s.pending} still open`} />
              <StatCard label="Average Score" value={s.average_percentage != null ? `${s.average_percentage}%` : '—'} icon={Award} color="gold" sub={`${s.graded} graded`} />
            </section>

            <section className="grid lg:grid-cols-3 gap-6">
              <div className="card lg:col-span-1 space-y-4">
                <h2 className="font-semibold text-primary-900">Overall Progress</h2>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>Completion</span><span className="font-semibold">{s.completion_rate}%</span></div>
                  <ProgressBar value={s.completion_rate} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>On-time submissions</span><span className="font-semibold">{s.on_time_rate}%</span></div>
                  <ProgressBar value={s.on_time_rate} color="bg-gov-green" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>Average score</span><span className="font-semibold">{s.average_percentage ?? '—'}{s.average_percentage != null && '%'}</span></div>
                  <ProgressBar value={s.average_percentage} color="bg-gov-gold" />
                </div>
                {data.class_teacher && (
                  <p className="text-sm text-gray-500 pt-2 border-t">Class Teacher: <span className="font-medium text-gray-700">{data.class_teacher.teacher_name}</span></p>
                )}
              </div>

              <div className="card lg:col-span-2">
                <h2 className="font-semibold text-primary-900 mb-4">Progress by Subject</h2>
                {data.subjects.length === 0 ? (
                  <p className="text-sm text-gray-500">No subject data yet.</p>
                ) : (
                  <div className="space-y-4">
                    {data.subjects.map((sub) => {
                      const pct = sub.total ? Math.round((sub.completed / sub.total) * 100) : 0
                      return (
                        <div key={sub.subject}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{sub.subject}</span>
                            <span className="text-gray-500">
                              {sub.completed}/{sub.total} done · avg {sub.average_percentage != null ? `${sub.average_percentage}%` : '—'}
                            </span>
                          </div>
                          <ProgressBar value={pct} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="card p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b">
                <h2 className="font-semibold text-primary-900">Tasks &amp; Grades</h2>
                <div className="flex flex-wrap gap-2">
                  {['all', 'pending', 'completed', 'graded', 'overdue'].map((f) => (
                    <button key={f} id={`parent-filter-${f}`} onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${filter === f ? 'bg-primary-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {tasks.length === 0 ? (
                <div className="p-6"><EmptyState icon={ClipboardList} title="No tasks here" description="Nothing matches this filter yet." /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="table-header">Task</th>
                        <th className="table-header">Subject</th>
                        <th className="table-header">Due</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Score</th>
                        <th className="table-header">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {tasks.map((t) => (
                        <tr key={t.task_id} className="hover:bg-gray-50 transition">
                          <td className="table-cell">
                            <p className="font-medium text-gray-800">{t.title}</p>
                            {t.teacher_feedback && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">“{t.teacher_feedback}”</p>}
                          </td>
                          <td className="table-cell">{t.subject?.name || '—'}</td>
                          <td className="table-cell whitespace-nowrap">{fmtDate(t.due_date)}</td>
                          <td className="table-cell"><Badge status={t.status} /></td>
                          <td className="table-cell whitespace-nowrap">
                            {t.score != null ? `${t.score}/${t.max_score}` : '—'}
                            {t.percentage != null && <span className="text-xs text-gray-500 ml-1">({t.percentage}%)</span>}
                          </td>
                          <td className="table-cell font-semibold">{t.grade || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="grid lg:grid-cols-3 gap-6">
              <div className="card lg:col-span-2">
                <h2 className="font-semibold text-primary-900 mb-4 flex items-center gap-2"><MessageSquare size={18} /> Message a Teacher</h2>
                <FeedbackForm
                  classTeacher={data.class_teacher}
                  subjectTeachers={data.subject_teachers || []}
                  guardianName={data.student?.guardian_name}
                  onSent={loadHistory}
                />
              </div>
              <div className="card">
                <h2 className="font-semibold text-primary-900 mb-4">Sent Messages</h2>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500">No messages sent yet.</p>
                ) : (
                  <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {history.map((f) => (
                      <li key={f.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">To {f.teacher?.name || 'Teacher'}</span>
                          <span className={f.status === 'read' ? 'badge-approved' : 'badge-pending'}>{f.status}</span>
                        </div>
                        {f.title && <p className="text-sm font-semibold mt-1">{f.title}</p>}
                        <p className="text-sm text-gray-600 mt-1 line-clamp-3">{f.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{fmtDate(f.created_at || f.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
