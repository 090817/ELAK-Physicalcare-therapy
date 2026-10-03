import { evaluateAwards } from '../data/awards'
import { milestones } from '../data/milestones'
import { timeMilestones } from '../data/timeMilestones'
import { mergeTrainings, trainingById, trainings } from '../data/trainings'
import {
  DAILY_CAP_SECONDS,
  HOLD_SECONDS,
  emptyState,
  liveDuration,
  runningElapsed,
  todayKey,
  withSyncedToday,
} from './records'

// 外层 App 通过 window.RehabAwards.dispatch(command) 或 postMessage 下发命令。
// postMessage 形态：{ channel: 'rehab-awards', id?, command }
// 回执：{ channel: 'rehab-awards', event: 'result', id, result }
//
// command:
// { type: 'getState' }
// { type: 'selectTraining', trainingId }
// { type: 'start', trainingId? }
// { type: 'stop' }
// { type: 'checkin', trainingId, date? }
// { type: 'addTime', seconds, trainingId?, date? }
// { type: 'reset' }
//
// trainingId 使用奖项系统.html 里的 id：
// anklePumps、toeRaises、ankleEversion、ankleInversion、
// heelRaises、heelsDownSquat、singleLegBalance、ankleAlphabet
// 一天计入的时长最多 600 秒。checkin 只记项目，不额外加时长。

export const AWARD_CHANNEL = 'rehab-awards'

function dayNumber(key) {
  const [year, month, day] = key.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

export function maxStreak(dates) {
  const sorted = [...new Set(dates)].sort()
  if (sorted.length === 0) return 0
  let max = 1
  let run = 1
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = dayNumber(sorted[index]) - dayNumber(sorted[index - 1])
    if (gap === 1) {
      run += 1
      max = Math.max(max, run)
    } else if (gap > 1) {
      run = 1
    }
  }
  return max
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function snapshotStats(state, now) {
  const today = todayKey(new Date(now))
  const active = state.active?.date === today ? state.active : null
  const sessions = state.sessions
  const byTraining = Object.fromEntries(trainings.map((item) => [item.id, 0]))
  let sessionCount = 0
  let kcal = 0
  sessions.forEach((session) => {
    const done = mergeTrainings(session.trainings)
    done.forEach((id) => {
      byTraining[id] += 1
      kcal += trainingById(id).kcal
    })
    sessionCount += done.length > 0 ? done.length : session.durationSec >= HOLD_SECONDS ? 1 : 0
  })
  return {
    days: sessions.length,
    streak: maxStreak(sessions.map((item) => item.date)),
    sessions: sessionCount,
    kcal,
    durationSec: liveDuration(sessions, active, now),
    byTraining,
  }
}

function unlockIds(state, now) {
  const stats = snapshotStats(state, now)
  const tier = evaluateAwards(stats).filter((item) => item.unlocked).map((item) => item.id)
  const scene = milestones.filter((item) => stats.days >= item.threshold).map((item) => item.id)
  const time = timeMilestones.filter((item) => stats.durationSec >= item.threshold).map((item) => item.id)
  return [...scene, ...time, ...tier]
}

export function buildSnapshot(state, now) {
  const today = todayKey(new Date(now))
  const stats = snapshotStats(state, now)
  const active = state.active?.date === today ? state.active : null
  return {
    today,
    selectedTrainingId: state.selectedTrainingId,
    active: active
      ? { date: active.date, trainingId: active.trainingId ?? state.selectedTrainingId, startedAt: active.startedAt }
      : null,
    sessions: state.sessions.map((item) => ({
      date: item.date,
      durationSec: item.durationSec,
      trainings: mergeTrainings(item.trainings),
    })),
    trainings: trainings.map(({ id, name, emoji, kcal }) => ({ id, name, emoji, kcal })),
    stats,
    awards: evaluateAwards(stats).map((item) => ({
      id: item.id,
      group: item.group,
      level: item.level,
      trainingId: item.trainingId,
      title: item.title,
      threshold: item.threshold,
      unit: item.unit,
      current: item.current,
      unlocked: item.unlocked,
    })),
  }
}

function upsertSession(state, session) {
  return {
    ...state,
    sessions: [...state.sessions.filter((item) => item.date !== session.date), session].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  }
}

function selectTraining(state, trainingId, now) {
  if (!trainingById(trainingId)) return { ok: false, error: 'unknown-training', state }
  let next = { ...state, selectedTrainingId: trainingId }
  if (next.active) next = { ...next, active: { ...next.active, trainingId } }
  const today = todayKey(new Date(now))
  next = next.active?.date === today ? withSyncedToday(next, now) : next
  const existing = next.sessions.find((item) => item.date === today)
  if (!existing || existing.durationSec < HOLD_SECONDS) return { ok: true, state: next }
  const done = mergeTrainings(existing.trainings, trainingId)
  if (done.length === mergeTrainings(existing.trainings).length) return { ok: true, state: next }
  return {
    ok: true,
    state: upsertSession(next, { ...existing, trainings: done }),
  }
}

function startTraining(state, trainingId, now) {
  const today = todayKey(new Date(now))
  if (state.active?.date === today) return { ok: false, error: 'already-running', state }
  const chosen = trainingId || state.selectedTrainingId
  if (!trainingById(chosen)) return { ok: false, error: 'unknown-training', state }
  const next = { ...state, selectedTrainingId: chosen }
  const existing = next.sessions.find((item) => item.date === today)
  if ((existing?.durationSec ?? 0) >= DAILY_CAP_SECONDS) return { ok: false, error: 'daily-cap', state: next }
  return {
    ok: true,
    state: {
      ...next,
      active: {
        date: today,
        trainingId: chosen,
        startedAt: now - (existing?.durationSec ?? 0) * 1000,
      },
    },
  }
}

function checkIn(state, trainingId, date, now) {
  if (!trainingById(trainingId)) return { ok: false, error: 'unknown-training', state }
  const today = todayKey(new Date(now))
  const day = date || today
  if (!isDateKey(day)) return { ok: false, error: 'invalid-date', state }
  let next = day === today ? withSyncedToday(state, now) : state
  const existing = next.sessions.find((item) => item.date === day)
  const session = {
    date: day,
    durationSec: existing?.durationSec ?? 0,
    confirmedAt: existing?.confirmedAt || now,
    trainings: mergeTrainings(existing?.trainings, trainingId),
  }
  return { ok: true, state: upsertSession(next, session) }
}

function addTime(state, seconds, trainingId, date, now) {
  const amount = Math.floor(Number(seconds))
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'invalid-seconds', state }
  if (trainingId && !trainingById(trainingId)) return { ok: false, error: 'unknown-training', state }
  const today = todayKey(new Date(now))
  const day = date || today
  if (!isDateKey(day)) return { ok: false, error: 'invalid-date', state }
  let next = day === today ? withSyncedToday(state, now) : state
  let pending = 0
  if (next.active?.date === day) {
    pending = Math.min(DAILY_CAP_SECONDS, Math.floor(runningElapsed(next.active, now)))
    next = { ...next, active: null }
  }
  const existing = next.sessions.find((item) => item.date === day)
  const current = Math.max(existing?.durationSec ?? 0, pending)
  const added = Math.min(DAILY_CAP_SECONDS - current, amount)
  if (added <= 0) return { ok: false, error: 'daily-cap', state: next, added: 0 }
  const durationSec = current + added
  return {
    ok: true,
    added,
    capped: durationSec >= DAILY_CAP_SECONDS,
    state: upsertSession(next, {
      date: day,
      durationSec,
      confirmedAt: existing?.confirmedAt || now,
      trainings: mergeTrainings(existing?.trainings, durationSec >= HOLD_SECONDS ? trainingId : null),
    }),
  }
}

export function reduceAwardCommand(state, command, now) {
  if (!command || typeof command.type !== 'string') return { ok: false, error: 'invalid-command', state }
  if (command.type === 'getState') return { ok: true, state }
  if (command.type === 'reset') return { ok: true, state: emptyState() }
  if (command.type === 'selectTraining') return selectTraining(state, command.trainingId, now)
  if (command.type === 'start') return startTraining(state, command.trainingId, now)
  if (command.type === 'stop') return { ok: true, state: { ...withSyncedToday(state, now), active: null } }
  if (command.type === 'checkin') return checkIn(state, command.trainingId, command.date, now)
  if (command.type === 'addTime') return addTime(state, command.seconds, command.trainingId, command.date, now)
  return { ok: false, error: 'unknown-command', state }
}

export function runAwardCommand(state, command, now) {
  const before = unlockIds(state, now)
  const result = reduceAwardCommand(state, command, now)
  const next = result.state ?? state
  const after = unlockIds(next, now)
  return {
    ...result,
    unlocked: after.filter((id) => !before.includes(id)),
    snapshot: buildSnapshot(next, now),
  }
}

let handler = null
let installed = false

export function bindAwardHandler(next) {
  handler = next
  return () => {
    if (handler === next) handler = null
  }
}

export function dispatchAwardCommand(command) {
  if (!handler) return { ok: false, error: 'not-ready' }
  return handler(command)
}

export function installAwardBridge() {
  if (installed || typeof window === 'undefined') return () => {}
  installed = true
  const onMessage = (event) => {
    const data = event.data
    if (!data || data.channel !== AWARD_CHANNEL || !data.command) return
    const result = dispatchAwardCommand(data.command)
    event.source?.postMessage({ channel: AWARD_CHANNEL, event: 'result', id: data.id ?? null, result }, '*')
  }
  window.addEventListener('message', onMessage)
  window.RehabAwards = {
    channel: AWARD_CHANNEL,
    dispatch: dispatchAwardCommand,
  }
  return () => {
    window.removeEventListener('message', onMessage)
    installed = false
    if (window.RehabAwards?.dispatch === dispatchAwardCommand) delete window.RehabAwards
  }
}

installAwardBridge()
