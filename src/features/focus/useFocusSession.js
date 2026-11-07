/**
 * useFocusSession — the study timer, backed by the server's verified focus sessions.
 *
 * Division of responsibility:
 * - The CLIENT owns presentation: the ticking clock, presets, and the visibility/blur
 *   pause. It never claims how long the student focused.
 * - The SERVER owns truth: it opens the session, accrues focus time from its own
 *   timestamps, and marks completion. `summary` below always comes from the API.
 *
 * localStorage is now only a mirror so a refresh does not lose the visual state; the
 * verified total shown to the student comes from the server.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { focusAPI } from '../../services/api'
import {
  readSession,
  writeSession,
  clearSession,
  isStoragePersistent,
} from './focusStorage'

export const BLOCK_PRESETS = [5, 10, 15, 20, 25, 30, 45, 60]
export const DEFAULT_BLOCK_MINUTES = 25

const TICK_MS = 1000
const HEARTBEAT_MS = 15000
// visibilitychange and blur both fire for a single tab switch.
const INTERRUPTION_DEBOUNCE_MS = 400
const RECOVERY_WINDOW_MS = 12 * 60 * 60 * 1000
const MAX_FOCUS_SECONDS = 8 * 60 * 60

const iso = (ms) => new Date(ms).toISOString()
const secondsBetween = (from, to) => Math.max(0, Math.floor((to - from) / 1000))

function createSession(taskId, userId, dueAt, plannedSeconds) {
  const now = Date.now()
  return {
    taskId,
    studentId: userId ?? null,
    status: 'idle',
    plannedSeconds,
    blockPlannedSeconds: plannedSeconds,
    blockFocusedSeconds: 0,
    focusedSeconds: 0,
    pausedSeconds: 0,
    blocksCompleted: 0,
    interruptions: [],
    lastRunStartedAt: null,
    pausedAt: null,
    lastTickAt: iso(now),
    startedAt: null,
    endedAt: null,
    deadlineAt: dueAt ? iso(dueAt) : null,
    updatedAt: iso(now),
  }
}

function accrue(session, atMs) {
  if (!session || session.status !== 'running' || !session.lastRunStartedAt) return session
  const delta = secondsBetween(Date.parse(session.lastRunStartedAt), atMs)
  if (delta <= 0) return session
  return {
    ...session,
    focusedSeconds: Math.min(MAX_FOCUS_SECONDS, (session.focusedSeconds || 0) + delta),
    blockFocusedSeconds: Math.min(
      session.blockPlannedSeconds || MAX_FOCUS_SECONDS,
      (session.blockFocusedSeconds || 0) + delta
    ),
    lastRunStartedAt: iso(atMs),
    lastTickAt: iso(atMs),
    updatedAt: iso(atMs),
  }
}

export default function useFocusSession(task, options = {}) {
  const { onSummary } = options
  const taskId = task?.id ?? null
  const dueAt = task?.due_date ? new Date(task.due_date).getTime() : null
  const requiredMinutes = Number(task?.focus_minutes) > 0 ? Math.round(Number(task.focus_minutes)) : 0
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [session, setSession] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [recovery, setRecovery] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const [summary, setSummary] = useState(null)
  const [syncError, setSyncError] = useState('')

  const sessionRef = useRef(null)
  const serverSessionIdRef = useRef(null)
  const pendingCompleteRef = useRef(null)
  const lastInterruptionRef = useRef(0)
  const lastHeartbeatRef = useRef(0)
  const warnedTwoMinutesRef = useRef(false)

  const applySummary = useCallback((next) => {
    if (!next) return
    setSummary(next)
    if (onSummary) onSummary(next)
  }, [onSummary])

  const commit = useCallback((next) => {
    if (!next) return
    sessionRef.current = next
    setSession(next)
    writeSession(next)
  }, [])

  // ── Server truth on mount / task change ─────────────────────────────────────
  useEffect(() => {
    if (taskId === null) {
      sessionRef.current = null
      setSession(null)
      setSummary(null)
      setRecovery(null)
      serverSessionIdRef.current = null
      return undefined
    }

    let cancelled = false

    const load = async () => {
      let status = null
      try {
        const { data } = await focusAPI.status(taskId)
        status = data.data
        if (!cancelled) applySummary(status)
      } catch (err) {
        if (!cancelled) {
          setSyncError(err.response?.data?.message || 'Could not load your verified focus time.')
        }
      }
      if (cancelled) return

      const open = status?.open_session || null
      const planned = requiredMinutes > 0 ? requiredMinutes * 60 : DEFAULT_BLOCK_MINUTES * 60

      if (open) {
        // Adopt the server session so a refresh continues where it left off.
        serverSessionIdRef.current = open.id
        const focusedSeconds = Math.round((open.focused_ms || 0) / 1000)
        const resumed = {
          ...createSession(taskId, userId, dueAt, planned),
          status: open.status === 'PAUSED' ? 'paused' : 'running',
          focusedSeconds,
          blockFocusedSeconds: focusedSeconds,
          startedAt: open.started_at,
          interruptions: (open.interruptions || []).map((entry) => ({
            type: entry.type,
            at: entry.at,
            afterFocusedSeconds: Math.round((entry.after_focused_ms || 0) / 1000),
          })),
          blocksCompleted: open.blocks_completed || 0,
          lastRunStartedAt: open.status === 'RUNNING' ? iso(Date.now()) : null,
          pausedAt: open.status === 'PAUSED' ? (open.updated_at || iso(Date.now())) : null,
        }
        commit(resumed)
        setRecovery(null)
        return
      }

      serverSessionIdRef.current = null
      const stored = readSession(taskId)
      if (stored && stored.status === 'running') {
        const cutoff = stored.lastTickAt ? Math.min(Date.now(), Date.parse(stored.lastTickAt)) : Date.now()
        const paused = { ...accrue(stored, cutoff), status: 'paused', pausedAt: iso(cutoff), lastRunStartedAt: null }
        writeSession(paused)
        commit(paused)
        setRecovery({ seconds: paused.focusedSeconds || 0 })
        return
      }

      if (stored) {
        commit(stored)
        setRecovery(stored.status === 'paused' && (stored.focusedSeconds || 0) > 0
          && stored.updatedAt && Date.now() - Date.parse(stored.updatedAt) < RECOVERY_WINDOW_MS
          ? { seconds: stored.focusedSeconds || 0 }
          : null)
        return
      }

      commit(createSession(taskId, userId, dueAt, planned))
      setRecovery(null)
    }

    load()
    return () => { cancelled = true }
  }, [taskId, dueAt, userId, requiredMinutes, applySummary, commit])

  // ── Tick, heartbeat, block completion ───────────────────────────────────────
  const finishBlock = useCallback(async (atMs) => {
    const current = sessionRef.current
    if (!current) return
    const blockSeconds = current.blockPlannedSeconds || 0
    const localDone = {
      ...accrue(current, atMs),
      focusedSeconds: Math.min(
        MAX_FOCUS_SECONDS,
        (current.focusedSeconds || 0) + (blockSeconds - (current.blockFocusedSeconds || 0))
      ),
      blockFocusedSeconds: blockSeconds,
      blocksCompleted: (current.blocksCompleted || 0) + 1,
      status: 'block_complete',
      lastRunStartedAt: null,
      pausedAt: null,
      updatedAt: iso(atMs),
    }
    commit(localDone)
    setRecovery(null)
    setAnnouncement('Focus session finished and sent for verification.')

    const serverId = serverSessionIdRef.current
    if (!serverId) return
    try {
      const { data } = await focusAPI.complete(serverId)
      applySummary(data.summary)
      serverSessionIdRef.current = null
      pendingCompleteRef.current = null
      setSyncError('')
    } catch {
      // Keep the local state and offer a retry rather than silently losing the session.
      pendingCompleteRef.current = serverId
      setSyncError('Your completed focus session could not be saved. Please retry.')
    }
  }, [commit, applySummary])

  useEffect(() => {
    if (!session || session.status !== 'running') return undefined

    const interval = setInterval(() => {
      const at = Date.now()
      setNow(at)
      const current = sessionRef.current
      if (!current || current.status !== 'running' || !current.lastRunStartedAt) return

      const elapsed =
        (current.blockFocusedSeconds || 0) + secondsBetween(Date.parse(current.lastRunStartedAt), at)

      if (elapsed >= (current.blockPlannedSeconds || 0)) {
        finishBlock(at)
        return
      }

      const remaining = (current.blockPlannedSeconds || 0) - elapsed
      if (remaining > 0 && remaining <= 120 && !warnedTwoMinutesRef.current) {
        warnedTwoMinutesRef.current = true
        setAnnouncement('Two minutes left in this focus session.')
      }

      if (at - lastHeartbeatRef.current >= HEARTBEAT_MS) {
        lastHeartbeatRef.current = at
        commit(accrue(current, at))
        const serverId = serverSessionIdRef.current
        if (serverId) {
          focusAPI.heartbeat(serverId).catch(() => setSyncError('Focus updates are not reaching the server right now.'))
        }
      }
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [session?.status, commit, finishBlock])

  // Deadline keeps moving while no block is running, at a cheap cadence.
  useEffect(() => {
    if (session?.status === 'running') return undefined
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [session?.status])

  // ── Interruption detection ─────────────────────────────────────────────────
  const pauseForInterruption = useCallback((type) => {
    const current = sessionRef.current
    if (!current || current.status !== 'running') return

    const at = Date.now()
    if (at - lastInterruptionRef.current < INTERRUPTION_DEBOUNCE_MS) return
    lastInterruptionRef.current = at

    commit({
      ...accrue(current, at),
      status: 'paused',
      pausedAt: iso(at),
      lastRunStartedAt: null,
      interruptions: [
        ...(current.interruptions || []),
        { type, at: iso(at), afterFocusedSeconds: current.focusedSeconds || 0 },
      ],
    })
    setAnnouncement('Focus paused because you left the assessment.')

    const serverId = serverSessionIdRef.current
    if (serverId) {
      focusAPI.pause(serverId, { reason: type }).catch(() => setSyncError('Your focus session was interrupted and could not be synced.'))
    }
  }, [commit])

  useEffect(() => {
    const handleVisibility = () => { if (document.hidden) pauseForInterruption('tab_hidden') }
    const handleBlur = () => pauseForInterruption('window_blur')

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
    }
  }, [pauseForInterruption])

  // ── Actions ────────────────────────────────────────────────────────────────
  const startBlock = useCallback(async (minutes) => {
    const current = sessionRef.current
    if (!current || taskId === null) return

    const wanted = Number(minutes) > 0 ? Math.round(Number(minutes)) : current.plannedSeconds / 60
    const planned = Math.max(1, wanted) * 60
    const at = Date.now()

    commit({
      ...current,
      status: 'running',
      plannedSeconds: planned,
      blockPlannedSeconds: planned,
      blockFocusedSeconds: 0,
      pausedAt: null,
      endedAt: null,
      startedAt: current.startedAt || iso(at),
      lastRunStartedAt: iso(at),
      lastTickAt: iso(at),
      updatedAt: iso(at),
    })
    lastHeartbeatRef.current = at
    warnedTwoMinutesRef.current = planned <= 120
    setRecovery(null)
    setNow(at)
    setAnnouncement(`Focus session started for ${planned / 60} minutes.`)

    try {
      const { data } = await focusAPI.start(taskId)
      serverSessionIdRef.current = data.data.id
      setSyncError('')
    } catch (err) {
      setSyncError(err.response?.data?.message || 'Focus session could not be registered with the server.')
    }
  }, [commit, taskId])

  const pause = useCallback(() => {
    const current = sessionRef.current
    if (!current || current.status !== 'running') return
    const at = Date.now()
    commit({ ...accrue(current, at), status: 'paused', pausedAt: iso(at), lastRunStartedAt: null })
    setAnnouncement('Focus paused.')

    const serverId = serverSessionIdRef.current
    if (serverId) focusAPI.pause(serverId, { reason: 'manual' }).catch(() => setSyncError('Pause did not reach the server.'))
  }, [commit])

  const resume = useCallback(() => {
    const current = sessionRef.current
    if (!current || current.status === 'running') return
    const at = Date.now()
    const pausedSeconds = current.pausedAt
      ? (current.pausedSeconds || 0) + secondsBetween(Date.parse(current.pausedAt), at)
      : current.pausedSeconds || 0

    commit({
      ...current,
      status: 'running',
      pausedSeconds,
      pausedAt: null,
      startedAt: current.startedAt || iso(at),
      lastRunStartedAt: iso(at),
      lastTickAt: iso(at),
    })
    lastHeartbeatRef.current = at
    setRecovery(null)
    setNow(at)
    setAnnouncement('Focus resumed.')

    const serverId = serverSessionIdRef.current
    if (serverId) focusAPI.resume(serverId).catch(() => setSyncError('Resume did not reach the server.'))
  }, [commit])

  /** Ends the block: the earned time is completed (not discarded) on the server. */
  const endSession = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    if (current.status === 'running') {
      await finishBlock(Date.now())
      return
    }

    const serverId = serverSessionIdRef.current
    if (serverId) {
      try {
        const { data } = await focusAPI.complete(serverId)
        applySummary(data.summary)
        serverSessionIdRef.current = null
        setSyncError('')
      } catch {
        pendingCompleteRef.current = serverId
        setSyncError('Your completed focus session could not be saved. Please retry.')
      }
    }
    commit({ ...current, status: 'idle', blockFocusedSeconds: 0, endedAt: iso(Date.now()) })
    setRecovery(null)
    setAnnouncement('Focus session ended.')
  }, [commit, finishBlock, applySummary])

  const retrySync = useCallback(async () => {
    const serverId = pendingCompleteRef.current
    if (!serverId) return
    try {
      const { data } = await focusAPI.complete(serverId)
      applySummary(data.summary)
      pendingCompleteRef.current = null
      serverSessionIdRef.current = null
      setSyncError('')
      setAnnouncement('Focus session saved.')
    } catch {
      setSyncError('Your completed focus session could not be saved. Please retry.')
    }
  }, [applySummary])

  const discard = useCallback(() => {
    if (taskId === null) return
    const serverId = serverSessionIdRef.current
    if (serverId) focusAPI.abandon(serverId).catch(() => {})
    serverSessionIdRef.current = null
    clearSession(taskId)
    const fresh = createSession(taskId, userId, dueAt, requiredMinutes > 0 ? requiredMinutes * 60 : DEFAULT_BLOCK_MINUTES * 60)
    sessionRef.current = fresh
    setSession(fresh)
    setRecovery(null)
    setAnnouncement('Focus state cleared for this device.')
  }, [taskId, userId, dueAt, requiredMinutes])

  const setPlannedMinutes = useCallback((minutes) => {
    const current = sessionRef.current
    if (!current || current.status === 'running') return
    const planned = Math.max(1, Math.round(Number(minutes) || DEFAULT_BLOCK_MINUTES)) * 60
    commit({ ...current, plannedSeconds: planned, blockPlannedSeconds: planned, blockFocusedSeconds: 0 })
  }, [commit])

  // ── Derived render values ──────────────────────────────────────────────────
  const derived = useMemo(() => {
    const fallbackPlan = requiredMinutes > 0 ? requiredMinutes * 60 : DEFAULT_BLOCK_MINUTES * 60
    if (!session) {
      return {
        status: 'idle',
        blockElapsedSeconds: 0,
        remainingSeconds: fallbackPlan,
        progress: 0,
        blocksCompleted: 0,
        interruptions: [],
        plannedMinutes: Math.round(fallbackPlan / 60),
      }
    }

    const liveBlock =
      session.status === 'running' && session.lastRunStartedAt
        ? (session.blockFocusedSeconds || 0) + secondsBetween(Date.parse(session.lastRunStartedAt), now)
        : session.blockFocusedSeconds || 0

    const planned = session.blockPlannedSeconds || fallbackPlan
    const capped = Math.min(liveBlock, planned)

    return {
      status: session.status,
      blockElapsedSeconds: capped,
      remainingSeconds: Math.max(0, planned - capped),
      progress: planned > 0 ? Math.min(100, (capped / planned) * 100) : 0,
      blocksCompleted: session.blocksCompleted || 0,
      interruptions: session.interruptions || [],
      plannedMinutes: Math.max(1, Math.round((session.plannedSeconds || fallbackPlan) / 60)),
    }
  }, [session, now, requiredMinutes])

  const deadline = useMemo(() => {
    if (!dueAt) return null
    const distance = dueAt - now
    return {
      ms: distance,
      overdue: distance <= 0,
      critical: distance > 0 && distance <= 10 * 60 * 1000,
      warning: distance > 0 && distance <= 60 * 60 * 1000,
    }
  }, [dueAt, now])

  return {
    ...derived,
    deadline,
    recovery,
    announcement,
    syncError,
    storagePersistent: isStoragePersistent(),
    // Verified numbers always come from the server.
    requiredSeconds: summary?.required_seconds ?? (requiredMinutes ? requiredMinutes * 60 : 0),
    verifiedSeconds: summary?.completed_seconds ?? 0,
    satisfied: summary ? summary.satisfied : requiredMinutes === 0,
    focusMode: summary?.mode || task?.focus_mode || 'accumulated',
    requiredMinutes,
    startBlock,
    pause,
    resume,
    endSession,
    setPlannedMinutes,
    discard,
    retrySync,
  }
}
