import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Clock, ShieldAlert, AlertTriangle, CheckCircle, Lock,
  Upload, FileText, X, FileSpreadsheet, Download, Play, HelpCircle
} from 'lucide-react'
import { Alert, Badge, Spinner } from '../ui/index.jsx'
import { taskAPI } from '../../services/api'
import SpreadsheetPreview from '../../features/spreadsheet/SpreadsheetPreview'
import { describeSpreadsheet, formatFileSize } from '../../features/spreadsheet/spreadsheetFormat'
import { filenameFromHeaders, saveBlob } from '../../utils/fileDownload'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const SUBMISSION_ACCEPT = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.xls,.csv'

// Helper to format countdown seconds into MM:SS or HH:MM:SS
function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function OnlineExamInterface({ task, onSubmitted }) {
  // 1. Exam Lifecycle States
  const [examStarted, setExamStarted]   = useState(false)
  const [isTimeUp, setIsTimeUp]         = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState('')

  // 2. Timer Setup: duration in minutes from task.focus_minutes or default 60 min
  const examDurationMinutes = Number(task.focus_minutes) > 0 ? Number(task.focus_minutes) : 60
  const initialSeconds = examDurationMinutes * 60
  const [timeLeft, setTimeLeft] = useState(initialSeconds)

  // 3. Exam Answers State (Radio choices, Checkbox options, Written Text, File)
  const [mcAnswers, setMcAnswers]       = useState({})
  const [checkAnswers, setCheckAnswers] = useState({})
  const [writtenAnswer, setWrittenAnswer] = useState('')
  const [file, setFile]                 = useState(null)
  const [dragging, setDragging]         = useState(false)
  const fileInputRef                    = useRef(null)

  // 4. Tab Monitoring / Security Tracking
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [showSecurityWarning, setShowSecurityWarning] = useState(false)

  // 5. Worksheet viewer & download state
  const [worksheetOpen, setWorksheetOpen] = useState(false)
  const [downloading, setDownloading]     = useState(false)

  // Stable loader for task attachment
  const loadWorksheet = useCallback(() => taskAPI.fetchAttachment(task.id).then((res) => res.data), [task.id])

  const downloadWorksheet = async () => {
    setDownloading(true)
    try {
      const response = await taskAPI.fetchAttachment(task.id)
      saveBlob(response.data, filenameFromHeaders(response.headers, task?.attachment?.file_name))
    } catch {
      toast.error('Could not download worksheet.')
    } finally {
      setDownloading(false)
    }
  }

  // ─── Countdown Timer Effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!examStarted || isTimeUp) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setIsTimeUp(true)
          toast.error('Time is up! All question inputs are locked. Please submit your exam now.', { duration: 6000 })
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [examStarted, isTimeUp])

  // ─── Focus Mode & Tab Switch Monitoring (Strictly on Exams) ─────────────────
  useEffect(() => {
    if (!examStarted || isTimeUp) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(c => c + 1)
        setShowSecurityWarning(true)
      }
    }

    const handleBlur = () => {
      setTabSwitchCount(c => c + 1)
      setShowSecurityWarning(true)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [examStarted, isTimeUp])

  // Start Exam Handler
  const handleStartExam = () => {
    setExamStarted(true)
    setTimeLeft(initialSeconds)
    setIsTimeUp(false)
    toast.success('Exam started! Focus mode is active. Good luck!')

    // Optional: Request full screen if supported
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    } catch (_) {}
  }

  // Submit Exam Handler (Kept fully enabled early & after time is up)
  const handleSubmitExam = async () => {
    setError('')
    setSubmitting(true)

    try {
      // Compile student answers into content string
      const sections = []

      // Section 1: Multiple Choice Answers
      const mcKeys = Object.keys(mcAnswers)
      if (mcKeys.length > 0) {
        sections.push('--- Section A: Multiple Choice Answers ---')
        mcKeys.sort().forEach(q => {
          sections.push(`${q}: Option ${mcAnswers[q]}`)
        })
      }

      // Section 2: Multi-select Answers
      const checkKeys = Object.keys(checkAnswers)
      if (checkKeys.length > 0) {
        sections.push('\n--- Section B: Selected Choices ---')
        checkKeys.sort().forEach(q => {
          const selected = checkAnswers[q] || []
          sections.push(`${q}: [${selected.join(', ')}]`)
        })
      }

      // Section 3: Written Essay / Short Answer
      if (writtenAnswer.trim()) {
        sections.push('\n--- Section C: Written Responses ---')
        sections.push(writtenAnswer.trim())
      }

      // Section 4: Focus Integrity Log
      if (tabSwitchCount > 0) {
        sections.push(`\n[Integrity Note: ${tabSwitchCount} tab switch/blur event(s) detected during exam]`)
      }

      let compiledContent = sections.join('\n')

      if (!compiledContent.trim() && !file) {
        if (isTimeUp) {
          compiledContent = '[No answers provided before time expired]'
        } else {
          setError('Please answer at least one question or write your exam responses before submitting.')
          setSubmitting(false)
          return
        }
      }

      const formData = new FormData()
      if (file) formData.append('file', file)
      if (compiledContent) formData.append('content', compiledContent)

      await taskAPI.submit(task.id, formData)
      toast.success('Exam submitted successfully!')

      if (onSubmitted) {
        onSubmitted()
      }
    } catch (err) {
      console.error('Exam submission error:', err)
      setError(err.response?.data?.message || err.message || 'Exam submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (isTimeUp) return
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const toggleCheckbox = (questionKey, optionValue) => {
    if (isTimeUp) return
    setCheckAnswers(prev => {
      const current = prev[questionKey] || []
      const next = current.includes(optionValue)
        ? current.filter(v => v !== optionValue)
        : [...current, optionValue]
      return { ...prev, [questionKey]: next }
    })
  }

  // ─── VIEW 1: Pre-Exam Briefing Screen (Before clicking 'Start Exam') ────────
  if (!examStarted) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="card border-t-4 border-t-primary-900 shadow-md">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary-900 bg-primary-50 px-2.5 py-1 rounded-md">
                Online Examination
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-2">{task.title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{task.subject?.name || task.class?.name}</p>
            </div>
            <Badge status="urgent" />
          </div>

          <p className="text-sm text-gray-700 leading-relaxed mb-4">{task.description}</p>

          {task.instructions && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <HelpCircle size={14} /> Exam Instructions
              </p>
              <pre className="text-xs text-blue-800 whitespace-pre-wrap font-sans leading-relaxed">
                {task.instructions}
              </pre>
            </div>
          )}

          {/* Exam Parameters Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100 text-center mb-6">
            <div>
              <p className="text-xs text-gray-400">Allocated Time</p>
              <p className="text-lg font-bold text-gray-900 flex items-center justify-center gap-1 mt-0.5">
                <Clock size={16} className="text-primary-900" /> {examDurationMinutes} min
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Score</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{task.max_score || 100} pts</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Due Date</p>
              <p className="text-xs font-semibold text-gray-700 mt-1">
                {new Date(task.due_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Security Mode</p>
              <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1 mt-1">
                <ShieldAlert size={14} /> Focus Lock
              </p>
            </div>
          </div>

          {/* Rules & Integrity Warning */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2 mb-6">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide">
              <AlertTriangle size={14} /> Examination Rules
            </h4>
            <ul className="text-xs text-amber-800 list-disc list-inside space-y-1">
              <li>Focus Mode triggers immediately when you click <strong>Start Exam</strong>.</li>
              <li>Leaving this browser tab or window will be monitored and logged.</li>
              <li>When the timer reaches <strong>00:00</strong>, all input fields will be locked automatically.</li>
              <li>You may submit your exam at <strong>any time early</strong> before the countdown expires.</li>
              <li>When time expires, the <strong>Submit Exam</strong> button remains active to send your locked answers.</li>
            </ul>
          </div>

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleStartExam}
              className="btn-primary text-base py-3 px-10 shadow-lg inline-flex items-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <Play size={18} /> Start Exam
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── VIEW 2: Active Online Exam Interface ──────────────────────────────────
  const isTimeCritical = timeLeft <= 300 // 5 minutes or less

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16">
      {/* Sticky Exam Header Bar */}
      <div className={clsx(
        'sticky top-16 z-30 card shadow-md border-2 transition-colors py-3 px-5',
        isTimeUp
          ? 'border-red-500 bg-red-50/95'
          : isTimeCritical
            ? 'border-amber-400 bg-amber-50/95'
            : 'border-primary-900/30 bg-white/95 backdrop-blur'
      )}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-white',
              isTimeUp ? 'bg-red-600' : isTimeCritical ? 'bg-amber-600 animate-pulse' : 'bg-primary-900'
            )}>
              {isTimeUp ? <Lock size={16} /> : <Clock size={16} />}
            </span>
            <div>
              <p className="text-xs text-gray-500 font-medium">
                {isTimeUp ? 'Time Expired' : 'Time Remaining'}
              </p>
              <p className={clsx(
                'text-xl font-mono font-bold tracking-tight',
                isTimeUp ? 'text-red-700' : isTimeCritical ? 'text-amber-700' : 'text-primary-900'
              )}>
                {isTimeUp ? '00:00' : formatCountdown(timeLeft)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={clsx(
              'text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1',
              isTimeUp
                ? 'bg-red-100 text-red-800'
                : 'bg-emerald-100 text-emerald-800'
            )}>
              {isTimeUp ? <Lock size={12} /> : <ShieldAlert size={12} />}
              {isTimeUp ? 'Inputs Locked' : 'Focus Mode Active'}
            </span>

            {/* Submit Button remains available during whole exam and when time is up */}
            <button
              type="button"
              onClick={handleSubmitExam}
              disabled={submitting}
              className={clsx(
                'btn-primary text-xs py-2 px-5 font-bold shadow-md inline-flex items-center gap-1.5',
                isTimeUp ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'
              )}
            >
              {submitting ? (
                <><Spinner size="sm" /> Submitting...</>
              ) : isTimeUp ? (
                <><Lock size={13} /> Submit Locked Exam</>
              ) : (
                <><CheckCircle size={13} /> Submit Exam</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Security alert if student left tab */}
      {showSecurityWarning && (
        <Alert
          type="warning"
          message={`Security Notice: Tab switch detected (${tabSwitchCount} time${tabSwitchCount > 1 ? 's' : ''}). Please remain on the exam screen to avoid academic integrity flags.`}
        />
      )}

      {/* Time-up Banner Notification */}
      {isTimeUp && (
        <div className="p-4 bg-red-100 border-2 border-red-300 rounded-lg text-red-900 text-sm font-medium flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-red-700 flex-shrink-0" />
            <span>Time is up! All question inputs are now locked. You can no longer modify your answers. Please click <strong>Submit Locked Exam</strong> to finish.</span>
          </div>
          <button
            type="button"
            onClick={handleSubmitExam}
            disabled={submitting}
            className="btn-primary bg-red-700 hover:bg-red-800 text-xs py-1.5 px-4 flex-shrink-0 inline-flex items-center gap-1.5"
          >
            {submitting ? <Spinner size="sm" /> : <><Lock size={13} /> Submit Locked Exam</>}
          </button>
        </div>
      )}

      {error && <Alert type="error" message={error} />}

      {/* Exam Details Card */}
      <div className="card">
        <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{task.subject?.name || task.class?.name}</p>
        <p className="text-sm text-gray-700 mt-2.5 leading-relaxed">{task.description}</p>

        {task.instructions && (
          <div className="mt-3 p-3.5 bg-blue-50/60 border border-blue-100 rounded-lg">
            <p className="text-xs font-bold text-blue-900 mb-1">Question Prompts & Instructions</p>
            <pre className="text-xs text-blue-800 whitespace-pre-wrap font-sans leading-relaxed">
              {task.instructions}
            </pre>
          </div>
        )}
      </div>

      {/* Optional Attached Worksheet or Reference Materials */}
      {task.attachment && (
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-primary-900 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{task.attachment.file_name}</p>
                <p className="text-xs text-gray-500">
                  {describeSpreadsheet(task.attachment.file_name)} · {formatFileSize(task.attachment.file_size)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-xs py-1.5 px-3"
                onClick={() => setWorksheetOpen(o => !o)}
              >
                {worksheetOpen ? 'Hide Reference' : 'View Reference'}
              </button>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1"
                onClick={downloadWorksheet}
                disabled={downloading}
              >
                <Download size={13} /> {downloading ? '...' : 'Download'}
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

      {/* ─── Online Exam Question Inputs (All lock with disabled={isTimeUp}) ─── */}
      <div className="card space-y-6">
        <div className="border-b border-gray-100 pb-3">
          <h4 className="text-sm font-bold text-gray-900">Exam Answer Sheet</h4>
          <p className="text-xs text-gray-400">
            {isTimeUp ? 'Inputs are locked because time has expired.' : 'Select or write your answers below. You may submit anytime early.'}
          </p>
        </div>

        {/* Section A: Multiple Choice Question Group (Radio buttons) */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Part 1: Multiple Choice Questions
          </p>

          {[
            { id: 'Q1', text: 'Question 1: Choose the correct option according to the exam instructions' },
            { id: 'Q2', text: 'Question 2: Select the best answer for this assessment question' },
            { id: 'Q3', text: 'Question 3: Identify the valid statement from the choices below' }
          ].map((q) => (
            <div key={q.id} className="p-3.5 bg-gray-50/80 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-800 mb-2">{q.text}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['A', 'B', 'C', 'D'].map(option => (
                  <label
                    key={option}
                    className={clsx(
                      'flex items-center gap-2 p-2 rounded border text-xs font-medium cursor-pointer transition-colors',
                      mcAnswers[q.id] === option
                        ? 'border-primary-900 bg-primary-50 text-primary-900 font-bold'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100',
                      isTimeUp && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <input
                      type="radio"
                      name={`mc_${q.id}`}
                      value={option}
                      disabled={isTimeUp}
                      checked={mcAnswers[q.id] === option}
                      onChange={() => setMcAnswers(prev => ({ ...prev, [q.id]: option }))}
                      className="text-primary-900 focus:ring-primary-900"
                    />
                    <span>Option {option}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Section B: Multi-Select Question Group (Checkboxes) */}
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Part 2: Multi-Select Verification (Checkboxes)
          </p>

          <div className="p-3.5 bg-gray-50/80 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-800 mb-2">
              Question 4: Select all criteria that apply to this problem
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { val: 'Crit_1', label: 'Primary method verified and substantiated' },
                { val: 'Crit_2', label: 'Secondary hypothesis aligns with standard model' },
                { val: 'Crit_3', label: 'Numerical constants evaluated without rounding error' },
                { val: 'Crit_4', label: 'Empirical data meets tolerance thresholds' }
              ].map(item => {
                const isChecked = (checkAnswers['Q4'] || []).includes(item.val)
                return (
                  <label
                    key={item.val}
                    className={clsx(
                      'flex items-center gap-2.5 p-2 rounded border text-xs font-medium cursor-pointer transition-colors',
                      isChecked
                        ? 'border-primary-900 bg-primary-50 text-primary-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100',
                      isTimeUp && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={isTimeUp}
                      checked={isChecked}
                      onChange={() => toggleCheckbox('Q4', item.val)}
                      className="rounded text-primary-900 focus:ring-primary-900"
                    />
                    <span>{item.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        {/* Section C: Written Responses / Essay (Text Area) */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Part 3: Written Answers / Explanations
            </label>
            {isTimeUp && (
              <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                <Lock size={12} /> Text locked
              </span>
            )}
          </div>
          <textarea
            value={writtenAnswer}
            onChange={e => setWrittenAnswer(e.target.value)}
            disabled={isTimeUp}
            rows={8}
            placeholder={isTimeUp ? 'Time has expired. Written input is locked.' : 'Type your detailed exam answers, mathematical workings, and explanations here...'}
            className={clsx(
              'input font-sans resize-y transition-colors',
              isTimeUp && 'bg-gray-100 cursor-not-allowed text-gray-500'
            )}
          />
          <p className="text-xs text-gray-400">{writtenAnswer.length} characters written</p>
        </div>

        {/* Section D: File Upload / Formula Sheet (Optional) */}
        {task.submission_type !== 'text' && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Part 4: Upload Calculations / Supporting Document (Optional)
            </label>
            {!file ? (
              <div
                onDragOver={(e) => { e.preventDefault(); if (!isTimeUp) setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => { if (!isTimeUp) fileInputRef.current?.click() }}
                className={clsx(
                  'border-2 border-dashed rounded-lg p-6 text-center transition-all',
                  isTimeUp
                    ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                    : dragging
                      ? 'border-primary-900 bg-primary-50 cursor-pointer'
                      : 'border-gray-300 hover:border-primary-900 cursor-pointer hover:bg-gray-50'
                )}
              >
                <Upload size={22} className="mx-auto mb-1.5 text-gray-400" />
                <p className="text-xs font-medium text-gray-600">
                  {isTimeUp ? 'Upload locked (time expired)' : 'Drop file here or click to attach calculation sheet'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX, TXT, PNG, JPG, XLSX</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={SUBMISSION_ACCEPT}
                  disabled={isTimeUp}
                  className="hidden"
                  onChange={e => setFile(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-emerald-700 flex-shrink-0" />
                  <p className="text-xs font-medium text-emerald-900 truncate">{file.name}</p>
                </div>
                {!isTimeUp && (
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
                    title="Remove file"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Submission Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {isTimeUp
              ? '⏰ Time has expired. Your inputs are locked. You may submit your final answers now.'
              : '⚡ You can submit early at any time before the timer runs out.'}
          </p>

          <button
            type="button"
            onClick={handleSubmitExam}
            disabled={submitting}
            className={clsx(
              'btn-primary px-8 py-2.5 text-sm font-bold shadow-md inline-flex items-center gap-2',
              isTimeUp ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'
            )}
          >
            {submitting ? (
              <><Spinner size="sm" /> Submitting Exam...</>
            ) : isTimeUp ? (
              <><Lock size={15} /> Submit Locked Exam</>
            ) : (
              <><CheckCircle size={15} /> Submit Exam</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
