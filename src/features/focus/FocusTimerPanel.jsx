/**
 * Smart Focus Timer panel for a single assessment.
 *
 * Visual contract: this must look like it was always part of RTMS. It therefore reuses
 * the existing `.card`, `.btn-primary`, `.btn-secondary` and `.badge-*` classes plus the
 * project palette (primary-900 / gov-gold) instead of introducing a new look. The only
 * custom styles live in focus-timer.css and are all `.focusit-` scoped.
 */
import { Pause, Play, Timer, TriangleAlert } from 'lucide-react'
import clsx from 'clsx'
import { Alert } from '../../components/ui/index.jsx'
import useFocusSession, { BLOCK_PRESETS } from './useFocusSession'
import { formatClock, formatDeadline, formatDuration } from './focusFormat'
import './focus-timer.css'

const STATE_META = {
  idle: { label: 'Not started', className: 'badge-inactive', icon: 'idle' },
  running: { label: 'Focusing', className: 'badge-active', icon: 'running' },
  paused: { label: 'Paused', className: 'badge-pending', icon: 'idle' },
  block_complete: { label: 'Block complete', className: 'badge-approved', icon: 'idle' },
}

export default function FocusTimerPanel({ task, onSummary }) {
  const focus = useFocusSession(task, { onSummary })

  if (!task) return null

  const state = STATE_META[focus.status] || STATE_META.idle
  const isRunning = focus.status === 'running'
  const isPaused = focus.status === 'paused'
  // Verified time comes from the server now, not from a local counter.
  const hasSavedTime = focus.verifiedSeconds > 0
  const showRecovery = Boolean(focus.recovery) && !isRunning && hasSavedTime

  const deadlineLabel = focus.deadline ? formatDeadline(focus.deadline.ms) : 'No deadline set'
  const deadlineClass = clsx(
    'focusit__metaItem',
    focus.deadline?.overdue || focus.deadline?.critical
      ? 'focusit__metaItem--critical'
      : focus.deadline?.warning
        ? 'focusit__metaItem--warning'
        : ''
  )

  const startLabel =
    focus.status === 'block_complete' || hasSavedTime
      ? `Start ${focus.plannedMinutes} min block`
      : `Start ${focus.plannedMinutes} min focus`

  return (
    <section className="card focusit" aria-label="Focus session timer">
      <div className="focusit__head">
        <div className="flex items-center gap-3 min-w-0">
          <span className="focusit__icon" aria-hidden="true">
            <Timer size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Focus session</p>
            <p className="text-xs text-gray-500">
              {isRunning
                ? 'Timing stops automatically if you leave this tab'
                : 'Short timed blocks help you finish this assessment'}
            </p>
          </div>
        </div>

        <span className={state.className} aria-live="polite">
          {isRunning && <span className="focusit__dot" aria-hidden="true" />}
          {state.label}
        </span>
      </div>

      {focus.requiredMinutes > 0 && (
        <div
          className={clsx(
            'focusit__requirement',
            focus.satisfied ? 'focusit__requirement--met' : 'focusit__requirement--pending'
          )}
        >
          <span className="font-medium">
            {focus.satisfied
              ? 'Focus requirement completed. You may now submit your task.'
              : `Focus requirement not met. You have completed ${formatDuration(focus.verifiedSeconds)} of ${focus.requiredMinutes} required focused minutes.`}
          </span>
          <span className="focusit__requirementMeta">
            Required {focus.requiredMinutes} min · Verified {formatDuration(focus.verifiedSeconds)} ·{' '}
            {focus.focusMode === 'continuous' ? 'Continuous' : 'Accumulated'}
          </span>
        </div>
      )}

      {focus.syncError && (
        <div className="focusit__recovery">
          <Alert type="error" message={focus.syncError} />
          <button type="button" className="btn-secondary" onClick={focus.retrySync}>
            Retry saving
          </button>
        </div>
      )}

      {showRecovery && (
        <div className="focusit__recovery">
          <Alert
            type="info"
            message={`Saved focus time found for this assessment: ${formatDuration(focus.recovery.seconds)}. Resume where you stopped, or clear it.`}
          />
          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary" onClick={focus.resume}>
              <Play size={14} /> Resume
            </button>
            <button type="button" className="btn-secondary" onClick={focus.discard}>
              Clear saved time
            </button>
          </div>
        </div>
      )}

      <div className="focusit__timerRow">
        <div>
          <p className="focusit__clock" aria-hidden="true">
            {formatClock(focus.remainingSeconds)}
          </p>
          <p className="focusit__caption">
            {isRunning
              ? 'left in this block'
              : focus.status === 'block_complete'
                ? 'block finished'
                : isPaused
                  ? 'paused'
                  : `block length · ${focus.plannedMinutes} min`}
          </p>
        </div>

        <div className="focusit__presets" role="group" aria-label="Focus block length">
          {BLOCK_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={clsx('focusit__preset', focus.plannedMinutes === minutes && 'focusit__preset--active')}
              onClick={() => focus.setPlannedMinutes(minutes)}
              disabled={isRunning || isPaused}
              aria-pressed={focus.plannedMinutes === minutes}
            >
              {minutes}m
            </button>
          ))}
        </div>
      </div>

      <div
        className="focusit__track"
        role="progressbar"
        aria-label="Focus block progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(focus.progress)}
      >
        <div className="focusit__fill" style={{ width: `${focus.progress}%` }} />
      </div>

      {/* While the recovery prompt is open it owns the resume/clear actions, so the
          regular action row would only duplicate them. */}
      <div className="focusit__actions" hidden={showRecovery}>
        {isRunning ? (
          <>
            <button type="button" className="btn-secondary" onClick={focus.pause}>
              <Pause size={14} /> Pause
            </button>
            <button type="button" className="focusit__link" onClick={focus.endSession}>
              End session
            </button>
          </>
        ) : isPaused ? (
          <>
            <button type="button" className="btn-primary" onClick={focus.resume}>
              <Play size={14} /> Resume focus
            </button>
            <button type="button" className="focusit__link" onClick={focus.endSession}>
              End session
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={() => focus.startBlock(focus.plannedMinutes)}>
            <Play size={14} /> {startLabel}
          </button>
        )}
      </div>

      <div className="focusit__meta">
        <span className={deadlineClass}>
          {(focus.deadline?.overdue || focus.deadline?.critical) && <TriangleAlert size={12} aria-hidden="true" />}
          {deadlineLabel}
        </span>
        <span className="focusit__metaItem">
          Verified <strong>{formatDuration(focus.verifiedSeconds)}</strong>
          {focus.requiredMinutes > 0 ? ` of ${focus.requiredMinutes} min required` : ' on this task'}
        </span>
        {focus.blocksCompleted > 0 && (
          <span className="focusit__metaItem">
            {focus.blocksCompleted} block{focus.blocksCompleted === 1 ? '' : 's'} completed
          </span>
        )}
        <span className={clsx('focusit__metaItem', focus.interruptions.length > 0 && 'focusit__metaItem--warning')}>
          {focus.interruptions.length} interruption{focus.interruptions.length === 1 ? '' : 's'}
        </span>
      </div>

      {!focus.storagePersistent && (
        <p className="focusit__note">
          This browser is blocking local storage, so focus time will not survive a reload.
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {focus.announcement}
      </p>
    </section>
  )
}
