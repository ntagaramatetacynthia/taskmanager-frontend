/**
 * Storage adapter for focus sessions.
 *
 * Phase 1 keeps everything on the client, but the record shape below intentionally
 * mirrors the planned `FocusSession` API payload (snake_case is translated at the
 * boundary later), so Phase 2 only has to swap this adapter for HTTP calls.
 *
 * Every read/write is defensive: Safari private mode and quota exhaustion both throw
 * on localStorage, and a student losing their timer because storage is full is worse
 * than the timer not persisting at all.
 */

const STORAGE_KEY = 'rtms.focus.v1'
const VERSION = 1
const UPDATE_EVENT = 'rtms:focus-updated'

let memory = { version: VERSION, sessions: {} }
let storageWorks = null

function canUseStorage() {
  if (storageWorks !== null) return storageWorks
  try {
    const probe = `${STORAGE_KEY}.probe`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    storageWorks = true
  } catch {
    storageWorks = false
  }
  return storageWorks
}

function notify() {
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT))
}

function readAll() {
  if (!canUseStorage()) return memory
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: VERSION, sessions: {} }
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== VERSION || !parsed.sessions || typeof parsed.sessions !== 'object') {
      // Unknown/older shape: start clean rather than crash the assessment page.
      return { version: VERSION, sessions: {} }
    }
    return parsed
  } catch {
    return { version: VERSION, sessions: {} }
  }
}

function writeAll(data) {
  memory = data
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Quota or a mid-write failure: keep the in-memory copy, timer keeps working.
    }
  }
  notify()
  return data
}

export function readSession(taskId) {
  if (taskId === null || taskId === undefined) return null
  return readAll().sessions[String(taskId)] || null
}

export function writeSession(session) {
  if (!session || session.taskId === null || session.taskId === undefined) return null
  const data = readAll()
  data.sessions[String(session.taskId)] = session
  writeAll(data)
  return session
}

export function clearSession(taskId) {
  if (taskId === null || taskId === undefined) return
  const data = readAll()
  delete data.sessions[String(taskId)]
  writeAll(data)
}

/** Total focused seconds across every stored session except `excludeTaskId`. */
export function sumFocusedSeconds(excludeTaskId) {
  const { sessions } = readAll()
  return Object.entries(sessions).reduce((total, [key, session]) => {
    if (excludeTaskId !== undefined && String(excludeTaskId) === key) return total
    return total + Math.max(0, Number(session?.focusedSeconds) || 0)
  }, 0)
}

/** True when sessions survive a reload (false in private mode / blocked storage). */
export function isStoragePersistent() {
  return canUseStorage()
}

export function onFocusUpdate(handler) {
  window.addEventListener(UPDATE_EVENT, handler)
  return () => window.removeEventListener(UPDATE_EVENT, handler)
}

export { STORAGE_KEY, UPDATE_EVENT, VERSION as STORAGE_VERSION }
