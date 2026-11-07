import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileText, CheckCircle, X, FileSpreadsheet, Download } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Alert, Badge, Spinner, PageLoader } from '../../components/ui/index.jsx'
import { taskAPI } from '../../services/api'
import OnlineExamInterface from '../../components/exam/OnlineExamInterface'
import SpreadsheetPreview from '../../features/spreadsheet/SpreadsheetPreview'
import { describeSpreadsheet, formatFileSize } from '../../features/spreadsheet/spreadsheetFormat'
import { filenameFromHeaders, saveBlob } from '../../utils/fileDownload'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const SUBMISSION_ACCEPT = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.xls,.csv'

export default function TaskSubmitPage() {
  const { id }              = useParams()
  const navigate            = useNavigate()
  const [task, setTask]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile]     = useState(null)
  const [text, setText]     = useState('')
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]   = useState('')
  const [worksheetOpen, setWorksheetOpen] = useState(false)
  const [downloading, setDownloading]     = useState(false)
  const inputRef            = useRef(null)

  useEffect(() => {
    taskAPI.getById(id)
      .then(({ data }) => {
        setTask(data.data)
        if (data.data?.my_submission?.status === 'submitted' || data.data?.my_submission?.status === 'graded') {
          setSubmitted(true)
        }
      })
      .catch(() => toast.error('Failed to load task'))
      .finally(() => setLoading(false))
  }, [id])

  const isOverdue = task ? new Date(task.due_date) < new Date() : false

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  // Stable loader for the viewer; the file is parsed for display only, never rewritten.
  const loadWorksheet = useCallback(() => taskAPI.fetchAttachment(id).then((res) => res.data), [id])

  const downloadWorksheet = async () => {
    setDownloading(true)
    try {
      const response = await taskAPI.fetchAttachment(id)
      saveBlob(response.data, filenameFromHeaders(response.headers, task?.attachment?.file_name))
    } catch {
      toast.error('Could not download the worksheet. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const onSubmit = async () => {
    if (task.submission_type !== 'text' && !file) { setError('Please attach a file'); return }
    if (task.submission_type !== 'file' && !text.trim()) { setError('Please write your answer'); return }
    setError('')
    setSubmitting(true)
    try {
      const form = new FormData()
      if (file) form.append('file', file)
      if (text) form.append('content', text)
      await taskAPI.submit(id, form)
      setSubmitted(true)
      toast.success('Task submitted successfully!')
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed')
    } finally { setSubmitting(false) }
  }

  if (loading) return <DashboardLayout title="Submit Task"><PageLoader /></DashboardLayout>
  if (!task) return <DashboardLayout title="Submit Task"><p className="text-sm text-gray-500 p-6">Task not found.</p></DashboardLayout>

  if (submitted) {
    const sub = task?.my_submission
    return (
      <DashboardLayout title={task.type === 'exam' ? 'Exam Submitted' : 'Task Submitted'}>
        <div className="max-w-lg mx-auto card text-center py-12">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            {sub?.status === 'graded' ? 'Assessment Graded' : 'Submitted Successfully!'}
          </h2>
          {sub?.status === 'graded' ? (
            <div className="mt-3 space-y-1">
              <p className="text-3xl font-bold text-primary-900">{sub.score}/{task.max_score}</p>
              {sub.feedback && <p className="text-sm text-gray-600 mt-2">{sub.feedback}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mt-2">
              Your {task.type === 'exam' ? 'exam answers have' : 'work has'} been submitted. You'll be notified when it's graded.
            </p>
          )}
          <button onClick={() => navigate('/student')} className="btn-primary mt-6 px-6">
            Back to Dashboard
          </button>
        </div>
      </DashboardLayout>
    )
  }

  // ─── If task is an Exam: render the dedicated Online Exam Interface ───────
  const isExam = task.type === 'exam' || task.type === 'quiz'
  if (isExam) {
    return (
      <DashboardLayout title="Online Examination" subtitle={task.title}>
        <div className="mb-4">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft size={14} /> Back to Tasks
          </button>
        </div>
        <OnlineExamInterface task={task} onSubmitted={() => setSubmitted(true)} />
      </DashboardLayout>
    )
  }

  // ─── Standard Assignment/Task: NO focus mode restrictions ─────────────────
  return (
    <DashboardLayout title="Submit Task" subtitle={task.title}>
      <div className="max-w-2xl">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
          <ArrowLeft size={14} /> Back
        </button>

        <div className="card mb-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">{task.title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{task.subject?.name || task.class?.name}</p>
            </div>
            <Badge status={isOverdue ? 'late' : 'active'} />
          </div>
          <p className="text-sm text-gray-600 mb-3">{task.description}</p>
          {task.instructions && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-800 mb-1">Instructions</p>
              <pre className="text-xs text-blue-700 whitespace-pre-wrap font-sans">{task.instructions}</pre>
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <span>Due: <strong className={clsx(isOverdue ? 'text-red-600' : 'text-gray-700')}>{new Date(task.due_date).toLocaleString()}</strong></span>
            <span>Max Score: <strong className="text-gray-700">{task.max_score}</strong></span>
            {isOverdue && task.late_submission_allowed && (
              <span className="text-amber-600">⚠ {task.late_penalty_percentage}% late penalty applies</span>
            )}
          </div>
        </div>

        {task.attachment && (
          <div className="card mb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-lg bg-blue-50 text-primary-900 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate" title={task.attachment.file_name}>
                    {task.attachment.file_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {describeSpreadsheet(task.attachment.file_name)}
                    {' · '}{formatFileSize(task.attachment.file_size)} · Attached by your teacher
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  className="btn-secondary text-xs py-1.5 px-3"
                  onClick={() => setWorksheetOpen((open) => !open)}
                  aria-expanded={worksheetOpen}
                >
                  {worksheetOpen ? 'Close preview' : 'View worksheet'}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs py-1.5 px-3"
                  onClick={downloadWorksheet}
                  disabled={downloading}
                >
                  <Download size={13} /> {downloading ? 'Downloading…' : 'Download'}
                </button>
              </div>
            </div>

            {worksheetOpen && (
              <div className="mt-3">
                <SpreadsheetPreview
                  fileName={task.attachment.file_name}
                  fileSize={task.attachment.file_size}
                  loadFile={loadWorksheet}
                  onDownload={downloadWorksheet}
                />
              </div>
            )}
          </div>
        )}

        <div className="card space-y-5">
          {error && <Alert type="error" message={error} />}

          {task.submission_type !== 'text' && (
            <div>
              <label className="label">Attach File {task.submission_type === 'file' && '*'}</label>
              {!file ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={clsx(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
                    dragging ? 'border-primary-900 bg-primary-50' : 'border-gray-300 hover:border-primary-900 hover:bg-gray-50'
                  )}
                >
                  <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">Drop file here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, TXT, JPG, PNG, XLSX, XLS, CSV</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={SUBMISSION_ACCEPT}
                    className="hidden"
                    onChange={e => setFile(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-emerald-800">{file.name}</p>
                      <p className="text-xs text-emerald-600">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button onClick={() => setFile(null)} className="p-1 rounded-md text-emerald-600 hover:bg-emerald-100">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {task.submission_type !== 'file' && (
            <div>
              <label className="label">Written Answer {task.submission_type === 'text' && '*'}</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={6}
                placeholder="Type your answer here..."
                className="input resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">{text.length} characters</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="btn-primary px-6"
            >
              {submitting ? <><Spinner size="sm" /> Submitting...</> : 'Submit Task'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
