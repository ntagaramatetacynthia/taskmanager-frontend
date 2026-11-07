import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Paperclip, Calendar, ArrowLeft, X } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Alert, Spinner } from '../../components/ui/index.jsx'
import { taskAPI, classAPI } from '../../services/api'
import { formatFileSize } from '../../features/spreadsheet/spreadsheetFormat'
import toast from 'react-hot-toast'

const WORKSHEET_ACCEPT = '.xlsx,.xls,.csv'

const schema = z.object({
  title:                   z.string().min(3, 'Title required'),
  description:             z.string().min(10, 'Description required'),
  instructions:            z.string().optional(),
  due_date:                z.string().min(1, 'Due date required'),
  class_id:                z.coerce.number().positive('Select a class'),
  priority:                z.enum(['low', 'medium', 'high', 'urgent']),
  type:                    z.enum(['assignment', 'project', 'quiz', 'exam', 'homework', 'task']),
  max_score:               z.coerce.number().min(1).max(1000),
  submission_type:         z.enum(['file', 'text', 'both']),
  late_submission_allowed: z.boolean(),
  late_penalty_percentage: z.coerce.number().min(0).max(100),
  // "Required Focus Duration": a preset string, or 'custom' + focus_custom_minutes.
  focus_duration:          z.string(),
  focus_custom_minutes:    z.string().optional(),
  focus_mode:              z.enum(['accumulated', 'continuous']),
})

const FOCUS_PRESETS = ['5', '10', '15', '20', '25', '30', '45', '60']

// Resolves the dropdown pair into the single integer the API stores (1..180).
function resolveFocusMinutes(values) {
  if (values.focus_duration !== 'custom') return Number(values.focus_duration)
  const custom = Number(values.focus_custom_minutes)
  if (!Number.isFinite(custom) || custom < 1 || custom > 180) return null
  return Math.round(custom)
}

export default function CreateTaskPage() {
  const [classes, setClasses]   = useState([])
  const [error, setError]       = useState('')
  // Optional worksheet, uploaded straight after the task row exists.
  const [worksheet, setWorksheet] = useState(null)
  const navigate                = useNavigate()

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'medium', type: 'assignment', max_score: 100,
      submission_type: 'both', late_submission_allowed: true, late_penalty_percentage: 10,
      focus_duration: '25', focus_custom_minutes: '', focus_mode: 'accumulated'
    }
  })

  const lateAllowed = watch('late_submission_allowed')
  const focusDuration = watch('focus_duration')
  const focusMode = watch('focus_mode')

  useEffect(() => {
    classAPI.getAll().then(({ data }) => setClasses(data.data || [])).catch(() => {})
  }, [])

  const onWorksheetChange = (event) => {
    const picked = event.target.files?.[0] || null
    if (picked && !/\.(xlsx|xls|csv)$/i.test(picked.name)) {
      setError('Only Excel or CSV worksheets can be attached (.xlsx, .xls, .csv).')
      setWorksheet(null)
      event.target.value = ''
      return
    }
    setError('')
    setWorksheet(picked)
  }

  const onSubmit = async (values) => {
    setError('')
    const focusMinutes = resolveFocusMinutes(values)
    if (focusMinutes === null) {
      setError('Enter a custom focus duration between 1 and 180 minutes.')
      return
    }

    try {
      // The dropdown pair collapses into the single integer the API stores.
      const { focus_duration, focus_custom_minutes, ...payload } = values
      const { data } = await taskAPI.create({ ...payload, focus_minutes: focusMinutes })

      // The attachment needs a task id, so it is uploaded as a second, separate request.
      // A failed upload must not lose the task that was just created.
      let attachmentError = ''
      if (worksheet) {
        const form = new FormData()
        form.append('file', worksheet)
        try {
          await taskAPI.uploadAttachment(data.data.id, form)
        } catch (uploadError) {
          attachmentError = uploadError.response?.data?.message || 'The worksheet could not be attached.'
        }
      }

      toast.success(data.message || 'Task created successfully')
      if (attachmentError) {
        toast.error(`${attachmentError} Re-attach the worksheet from the task before publishing.`)
      }
      navigate('/teacher/tasks')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task')
    }
  }

  return (
    <DashboardLayout title="Create Task" subtitle="Assign a new task to your class">
      <div className="max-w-2xl">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
          <ArrowLeft size={14} /> Back
        </button>

        <div className="card">
          {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Title */}
            <div>
              <label className="label">Task Title *</label>
              <input {...register('title')} placeholder="e.g. Algebra Assignment 1" className="input" />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
            </div>

            {/* Type + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Type *</label>
                <select {...register('type')} className="input">
                  {['assignment','project','quiz','exam','homework','task'].map(t => (
                    <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Priority *</label>
                <select {...register('priority')} className="input">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Class + Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Class / Department *</label>
                <select {...register('class_id')} className="input">
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.class_id && <p className="text-xs text-red-500 mt-1">{errors.class_id.message}</p>}
              </div>
              <div>
                <label className="label">Due Date *</label>
                <div className="relative">
                  <input {...register('due_date')} type="datetime-local" className="input pr-9" />
                  <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                {errors.due_date && <p className="text-xs text-red-500 mt-1">{errors.due_date.message}</p>}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="label">Description *</label>
              <textarea {...register('description')} rows={3} placeholder="Describe the task..." className="input resize-none" />
              {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
            </div>

            {/* Instructions */}
            <div>
              <label className="label">Instructions (optional)</label>
              <textarea {...register('instructions')} rows={2} placeholder="Step-by-step instructions..." className="input resize-none" />
            </div>

            {/* Worksheet attachment (Excel / CSV) */}
            <div>
              <label className="label" htmlFor="worksheet">Worksheet (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  id="worksheet"
                  type="file"
                  accept={WORKSHEET_ACCEPT}
                  onChange={onWorksheetChange}
                  className="block w-full max-w-sm text-xs text-gray-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-primary-800"
                />
                {worksheet && (
                  <button
                    type="button"
                    onClick={() => setWorksheet(null)}
                    className="p-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
                    title="Remove worksheet"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {worksheet ? (
                <p className="text-xs text-gray-600 mt-1.5 flex items-center gap-1.5">
                  <Paperclip size={12} /> {worksheet.name} · {formatFileSize(worksheet.size)}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  XLSX, XLS or CSV. Students open it read-only inside RTMS and can download the original.
                </p>
              )}
            </div>

            {/* Focus requirement */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Focus Requirement</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Required Focus Duration *</label>
                  <select {...register('focus_duration')} className="input">
                    {FOCUS_PRESETS.map(minutes => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes{minutes === '25' ? ' (default)' : ''}
                      </option>
                    ))}
                    <option value="custom">Custom duration</option>
                  </select>
                </div>
                <div>
                  <label className="label">Focus Policy</label>
                  <select {...register('focus_mode')} className="input">
                    <option value="accumulated">Accumulated (sessions add up)</option>
                    <option value="continuous">Continuous (one uninterrupted block)</option>
                  </select>
                </div>
              </div>
              {focusDuration === 'custom' && (
                <div className="w-48">
                  <label className="label">Custom duration (minutes)</label>
                  <input
                    {...register('focus_custom_minutes')}
                    type="number"
                    min="1"
                    max="180"
                    placeholder="1 - 180"
                    className="input"
                  />
                </div>
              )}
              <p className="text-xs text-gray-500">
                {focusMode === 'continuous'
                  ? 'The student must finish one uninterrupted block of the required length before submitting.'
                  : 'Focus sessions add up until the required total is reached before submitting.'}
              </p>
            </div>

            {/* Submission settings */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Submission Settings</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Submission Type</label>
                  <select {...register('submission_type')} className="input">
                    <option value="both">File + Text</option>
                    <option value="file">File Only</option>
                    <option value="text">Text Only</option>
                  </select>
                </div>
                <div>
                  <label className="label">Max Score</label>
                  <input {...register('max_score')} type="number" className="input" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input {...register('late_submission_allowed')} type="checkbox" id="late" className="w-4 h-4 accent-primary-900" />
                <label htmlFor="late" className="text-sm text-gray-700">Allow late submissions</label>
              </div>
              {lateAllowed && (
                <div className="w-48">
                  <label className="label">Late Penalty (%)</label>
                  <input {...register('late_penalty_percentage')} type="number" min="0" max="100" className="input" />
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="btn-primary px-6">
                {isSubmitting ? <Spinner size="sm" /> : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
