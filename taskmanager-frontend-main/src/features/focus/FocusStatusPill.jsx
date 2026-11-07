/**
 * Compact focus indicator for the student's task list.
 *
 * Reads the same store the panel writes and re-reads on every focus update, so the pill
 * reflects a block that was started on the assessment page. It renders nothing unless
 * there is a running/paused session worth showing, so unaffected rows look untouched.
 */
import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import clsx from 'clsx'
import { readSession, onFocusUpdate } from './focusStorage'
import { formatDuration } from './focusFormat'
import './focus-timer.css'

export default function FocusStatusPill({ taskId }) {
  const [session, setSession] = useState(() => readSession(taskId))

  useEffect(() => {
    setSession(readSession(taskId))
    return onFocusUpdate(() => setSession(readSession(taskId)))
  }, [taskId])

  if (!session) return null

  const seconds = Number(session.focusedSeconds) || 0
  const isRunning = session.status === 'running'
  const isPaused = session.status === 'paused'

  // Below a minute there is nothing useful to report, and the pill would flicker.
  if ((!isRunning && !isPaused) || seconds < 60) return null

  return (
    <span
      className={clsx('focusit-pill', isRunning ? 'focusit-pill--running' : 'focusit-pill--paused')}
      title={isRunning ? 'Focus timer is running on this assessment' : 'Focus timer is paused on this assessment'}
    >
      <Timer size={11} aria-hidden="true" />
      {isRunning ? 'Focusing' : 'Paused'} {formatDuration(seconds)}
    </span>
  )
}
