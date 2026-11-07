import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Modal, Spinner } from '../ui/index.jsx'
import { taskAPI, classAPI } from '../../services/api'

const toDateTimeLocal = (value) => {
  if (!value) return ''
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function EditTaskModal({ open, task, onClose, onSaved }) {
  const [loadingTask, setLoadingTask] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [classes, setClasses]         = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    class_id: '',
    type: 'assignment',
    priority: 'medium',
    status: 'published',
    due_date: '',
    max_score: 100,
    submission_type: 'both',
    focus_minutes: '',
    focus_mode: 'off',
  })

  useEffect(() => {
    if (!open || !task?.id) return

    // Pre-populate immediately from selected row
    setForm({
      title: task.title || '',
      description: task.description || '',
      instructions: task.instructions || '',
      class_id: task.class_id || task.class?.id || '',
      type: task.type || 'assignment',
      priority: task.priority || 'medium',
      status: task.status || 'published',
      due_date: toDateTimeLocal(task.due_date),
      max_score: task.max_score ?? 100,
      submission_type: task.submission_type || 'both',
      focus_minutes: task.focus_minutes ?? '',
      focus_mode: task.focus_mode || 'off',
    })

    // Fetch live task details and classes from the API
    setLoadingTask(true)
    Promise.all([
      taskAPI.getById(task.id).catch(() => ({ data: { data: task } })),
      classAPI.getAll().catch(() => ({ data: { data: [] } })),
    ])
      .then(([taskRes, classesRes]) => {
        const fresh = taskRes.data?.data || task
        setClasses(classesRes.data?.data || [])
        setForm({
          title: fresh.title || '',
          description: fresh.description || '',
          instructions: fresh.instructions || '',
          class_id: fresh.class_id || fresh.class?.id || '',
          type: fresh.type || 'assignment',
          priority: fresh.priority || 'medium',
          status: fresh.status || 'published',
          due_date: toDateTimeLocal(fresh.due_date),
          max_score: fresh.max_score ?? 100,
          submission_type: fresh.submission_type || 'both',
          focus_minutes: fresh.focus_minutes ?? '',
          focus_mode: fresh.focus_mode || 'off',
        })
      })
      .finally(() => setLoadingTask(false))
  }, [open, task])

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!task?.id) return
    setSubmitting(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        instructions: form.instructions,
        class_id: form.class_id ? Number(form.class_id) : undefined,
        type: form.type,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
        max_score: Number(form.max_score) || 100,
        submission_type: form.submission_type,
        focus_minutes: form.focus_minutes === '' ? null : Number(form.focus_minutes),
        focus_mode: form.focus_mode,
      }
      await taskAPI.update(task.id, payload)
      toast.success('Task updated successfully')
      onSaved?.()
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Task" size="lg">
      {loadingTask ? (
        <div className="py-8 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Task Title *</label>
              <input
                value={form.title}
                onChange={handleChange('title')}
                required
                minLength={3}
                className="input"
              />
            </div>

            <div>
              <label className="label">Class</label>
              <select value={form.class_id} onChange={handleChange('class_id')} className="input">
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Task Type</label>
              <select value={form.type} onChange={handleChange('type')} className="input">
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
                <option value="project">Project</option>
                <option value="exam">Exam</option>
                <option value="report">Report</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="label">Due Date *</label>
              <input
                type="datetime-local"
                value={form.due_date}
                onChange={handleChange('due_date')}
                required
                className="input"
              />
            </div>

            <div>
              <label className="label">Max Score</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={form.max_score}
                onChange={handleChange('max_score')}
                className="input"
              />
            </div>

            <div>
              <label className="label">Priority</label>
              <select value={form.priority} onChange={handleChange('priority')} className="input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="label">Status</label>
              <select value={form.status} onChange={handleChange('status')} className="input">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description *</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={handleChange('description')}
              required
              className="input resize-none"
            />
          </div>

          <div>
            <label className="label">Instructions</label>
            <textarea
              rows={2}
              value={form.instructions}
              onChange={handleChange('instructions')}
              className="input resize-none"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary w-full sm:w-auto">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
