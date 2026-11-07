/** Small formatting helpers shared by the focus panel and the focus pill. */

/** 1500 -> "25:00", 65 -> "01:05" */
export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const mm = String(hours > 0 ? minutes : minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${mm}:${ss}`
}

/** 65 -> "1m", 3900 -> "1h 05m", 20 -> "<1m" */
export function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0))
  if (safe < 60) return safe === 0 ? '0m' : '<1m'
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

/** "Due in 2h 14m" / "Due in 9m" / "Past due by 3h 02m" / "No deadline set" */
export function formatDeadline(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return 'No deadline set'
  const overdue = ms <= 0
  const distance = formatDuration(Math.abs(ms) / 1000)
  return overdue ? `Past due by ${distance}` : `Due in ${distance}`
}
