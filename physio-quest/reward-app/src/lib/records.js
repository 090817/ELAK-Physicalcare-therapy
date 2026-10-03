import { mergeTrainings, trainingById, trainings } from '../data/trainings'

export const HOLD_SECONDS = 30
export const DAILY_CAP_SECONDS = 10 * 60
export const STORAGE_KEY_BASE = 'rehab-stretch-days-v1'

export function storageKey() {
  try {
    const user = new URLSearchParams(window.location.search).get('user') || ''
    const clean = user.trim().toLowerCase()
    return clean ? `${STORAGE_KEY_BASE}:${clean}` : STORAGE_KEY_BASE
  } catch {
    return STORAGE_KEY_BASE
  }
}

export const STORAGE_KEY = storageKey()
export const DEFAULT_TRAINING_ID = trainings[0].id

export function todayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function emptyState() {
  return { version: 2, sessions: [], active: null, selectedTrainingId: DEFAULT_TRAINING_ID }
}

export function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.sessions)) return emptyState()
    const sessions = parsed.sessions
      .filter((item) => item && typeof item.date === 'string' && Number.isFinite(item.durationSec))
      .map((item) => ({
        date: item.date,
        durationSec: Math.min(DAILY_CAP_SECONDS, Math.max(0, Math.floor(item.durationSec))),
        confirmedAt: Number(item.confirmedAt) || 0,
        trainings: mergeTrainings(item.trainings),
      }))
    const unique = new Map(sessions.map((item) => [item.date, item]))
    const active = parsed.active
    const trainingId = trainingById(active?.trainingId) ? active.trainingId : null
    const nextActive =
      active && typeof active.date === 'string' && Number.isFinite(active.startedAt)
        ? { date: active.date, startedAt: active.startedAt, ...(trainingId ? { trainingId } : {}) }
        : null
    const selected = trainingById(parsed.selectedTrainingId) ? parsed.selectedTrainingId : DEFAULT_TRAINING_ID
    return {
      version: 2,
      sessions: [...unique.values()].sort((a, b) => a.date.localeCompare(b.date)),
      active: nextActive && nextActive.date === todayKey() ? nextActive : null,
      selectedTrainingId: selected,
    }
  } catch {
    return emptyState()
  }
}

export function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 隐私模式无法写入时，本次访问仍可正常使用。
  }
}

export function runningElapsed(active, now) {
  if (!active) return 0
  const elapsed = (now - active.startedAt) / 1000
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
}

export function creditedElapsed(active, now) {
  return Math.min(DAILY_CAP_SECONDS, runningElapsed(active, now))
}

export function liveDuration(sessions, active, now) {
  if (!active) return totalDuration(sessions)
  const others = sessions.filter((item) => item.date !== active.date)
  return totalDuration(others) + creditedElapsed(active, now)
}

export function withSyncedToday(state, now) {
  const active = state.active
  if (!active) return state
  if (active.date !== todayKey(new Date(now))) return { ...state, active: null }
  const raw = Math.floor(runningElapsed(active, now))
  const elapsed = Math.min(DAILY_CAP_SECONDS, raw)
  const reachedCap = raw >= DAILY_CAP_SECONDS
  if (elapsed < HOLD_SECONDS) return state
  const existing = state.sessions.find((item) => item.date === active.date)
  if (existing?.durationSec === elapsed && !reachedCap) return state
  const session = {
    date: active.date,
    durationSec: elapsed,
    confirmedAt: existing?.confirmedAt || now,
    trainings: mergeTrainings(existing?.trainings, active.trainingId || state.selectedTrainingId),
  }
  return {
    ...state,
    active: reachedCap ? null : active,
    sessions: [...state.sessions.filter((item) => item.date !== active.date), session].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  }
}

export function totalDuration(sessions) {
  return sessions.reduce((sum, item) => sum + item.durationSec, 0)
}

export function formatDuration(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec))
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  if (hours > 0) return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`
  if (minutes > 0) return seconds > 0 ? `${minutes} min ${seconds} sec` : `${minutes} min`
  return `${seconds} sec`
}

export function formatClock(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec))
  const minutes = Math.floor(sec / 60)
  const seconds = sec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatTimer(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec))
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${clock}` : clock
}
