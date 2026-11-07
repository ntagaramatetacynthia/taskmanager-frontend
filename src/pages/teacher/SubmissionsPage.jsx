import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Badge, Modal, SectionHeader, PageLoader } from '../../components/ui/index.jsx'
import { taskAPI } from '../../services/api'
import { filenameFromHeaders, saveBlob } from '../../utils/fileDownload'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const STATUS_FILTERS = ['all', 'submitted', 'resubmitted', 'graded']

export default function SubmissionsPage() {
  const { id }              = useParams()
  const navigate            = useNavigate()
  const [task, setTask]     = useState(null)
  const [subs, setSubs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [gradeModal, setGradeModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => {
    Promise.all([taskAPI.getById(id), taskAPI.getSubmissions(id)])
      .then(([t, s]) => {
        setTask(t.data.data)
        setSubs(s.data.data || [])
      })
      .catch(() => toast.error('Failed to load submissions'))
      .finally(() => setLoading(false))
  }, [id])

  const openGrade = (sub) => { reset({ score: '', feedback: '' }); setGradeModal(sub) }

  const onGrade = async (values) => {
    setSubmitting(true)
    try {
      await taskAPI.grade(id, gradeModal.id, { score: parseInt(values.score), feedback: values.feedback })
      toast.success('Submission graded')
      setSubs(prev => prev.map(s => s.id === gradeModal.id
        ? { ...s, status: 'graded', score: parseInt(values.score), feedback: values.feedback }
        : s
      ))
      setGradeModal(null)
    } catch {
      toast.error('Failed to grade submission')
    } finally { setSubmitting(false) }
  }

  // Submitted files are served by an authorized endpoint, so the bytes are fetched with
  // the auth token and saved from a Blob rather than linked to directly.
  const downloadSubmission = async (submission) => {
    try {
      const response = await taskAPI.fetchSubmissionFile(id, submission.id)
      saveBlob(response.data, filenameFromHeaders(response.headers, submission.file_name))
    } catch {
      toast.error('Could not download this submission.')
    }
  }

  const filtered = filter === 'all' ? subs : subs.filter(s => s.status === filter)

  const submitted = subs.filter(s => ['submitted', 'resubmitted'].includes(s.status)).length
  const graded    = subs.filter(s => s.status === 'graded').length

  if (loading) return <DashboardLayout title="Submissions"><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout title={task?.title || 'Submissions'} subtitle="Review and grade student submissions">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={14} /> Back to Tasks
      </button>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="card bg-blue-50 border-0 text-center py-4">
          <p className="text-2xl font-bold text-primary-900">{subs.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total</p>
        </div>
        <div className="card bg-amber-50 border-0 text-center py-4">
          <p className="text-2xl font-bold text-amber-600">{submitted}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pending Grade</p>
        </div>
        <div className="card bg-emerald-50 border-0 text-center py-4">
          <p className="text-2xl font-bold text-gov-green">{graded}</p>
          <p className="text-xs text-gray-500 mt-0.5">Graded</p>
        </div>
      </div>

      <div className="card">
        <div className="flex gap-1.5 mb-5">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx('px-3 py-1.5 text-xs rounded-md font-medium capitalize transition-colors',
                filter === f ? 'bg-primary-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >{f}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No submissions yet.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(sub => (
              <div key={sub.id} className={clsx(
                'flex items-center justify-between p-4 rounded-lg border transition-colors',
                sub.status === 'graded' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-gray-100 hover:bg-gray-50'
              )}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{sub.student?.name?.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sub.student?.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{sub.student?.email}</span>
                      {sub.submitted_at && (
                        <span className="text-xs text-gray-400">· {new Date(sub.submitted_at).toLocaleString()}</span>
                      )}
                      {sub.is_late && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Late</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {sub.score !== null && sub.score !== undefined && (
                    <span className="text-sm font-bold text-primary-900">{sub.score}/{task?.max_score || 100}</span>
                  )}
                  <Badge status={sub.status} />
                  {sub.file_url && (
                    <button
                      type="button"
                      onClick={() => downloadSubmission(sub)}
                      className="p-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      title={`Download ${sub.file_name || 'submission'}`}
                    >
                      <Download size={13} />
                    </button>
                  )}
                  {['submitted', 'resubmitted'].includes(sub.status) && (
                    <button onClick={() => openGrade(sub)} className="btn-primary text-xs py-1 px-3">Grade</button>
                  )}
                  {sub.status === 'graded' && (
                    <button onClick={() => openGrade(sub)} className="btn-secondary text-xs py-1 px-3">Edit Grade</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!gradeModal} onClose={() => setGradeModal(null)} title={`Grade: ${gradeModal?.student?.name}`}>
        <form onSubmit={handleSubmit(onGrade)} className="space-y-4">
          <div>
            <label className="label">Score (out of {task?.max_score || 100}) *</label>
            <input
              {...register('score', {
                required: 'Score required',
                min: { value: 0, message: 'Min 0' },
                max: { value: task?.max_score || 100, message: `Max ${task?.max_score || 100}` }
              })}
              type="number" min="0" max={task?.max_score || 100} placeholder="e.g. 85" className="input"
            />
            {errors.score && <p className="text-xs text-red-500 mt-1">{errors.score.message}</p>}
          </div>
          <div>
            <label className="label">Feedback</label>
            <textarea {...register('feedback')} rows={3} placeholder="Write feedback for the student..." className="input resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setGradeModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-success">
              {submitting ? 'Saving...' : 'Save Grade'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
