import { useEffect, useMemo, useRef, useState } from 'react'
import { evaluateAwards } from '../data/awards'
import { bindAwardHandler, runAwardCommand, snapshotStats } from './awardCommands'
import {
  DAILY_CAP_SECONDS,
  liveDuration,
  readState,
  runningElapsed,
  todayKey,
  withSyncedToday,
  writeState,
} from './records'

export function useRecords() {
  const [state, setState] = useState(readState)
  const [now, setNow] = useState(() => Date.now())
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
    writeState(state)
  }, [state])

  useEffect(() => {
    return bindAwardHandler((command) => {
      const nowMs = Date.now()
      const result = runAwardCommand(stateRef.current, command, nowMs)
      if (result.ok && result.state && result.state !== stateRef.current) setState(result.state)
      return {
        ok: result.ok,
        error: result.error,
        added: result.added,
        capped: result.capped,
        unlocked: result.unlocked,
        snapshot: result.snapshot,
      }
    })
  }, [])

  useEffect(() => {
    const tick = () => {
      const nextNow = Date.now()
      setNow(nextNow)
      setState((prev) => withSyncedToday(prev, nextNow))
    }
    const timer = window.setInterval(tick, 200)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  const today = todayKey(new Date(now))
  const sessions = state.sessions
  const active = state.active?.date === today ? state.active : null
  const elapsedSec = Math.min(DAILY_CAP_SECONDS, runningElapsed(active, now))
  const todaySession = sessions.find((item) => item.date === today) ?? null
  const todaySeconds = active ? elapsedSec : (todaySession?.durationSec ?? 0)
  const doneToday = Boolean(todaySession)
  const capped = todaySeconds >= DAILY_CAP_SECONDS

  const apply = (command) => {
    setState((prev) => {
      const result = runAwardCommand(prev, command, Date.now())
      return result.ok && result.state ? result.state : prev
    })
  }

  const start = () => apply({ type: 'start', trainingId: state.selectedTrainingId })
  const stop = () => apply({ type: 'stop' })
  const reset = () => apply({ type: 'reset' })
  const selectTraining = (trainingId) => apply({ type: 'selectTraining', trainingId })

  const stats = useMemo(() => snapshotStats(state, now), [state, now])
  const awards = useMemo(() => evaluateAwards(stats), [stats])

  return {
    sessions,
    today,
    doneToday,
    active,
    elapsedSec,
    todaySeconds,
    capped,
    count: sessions.length,
    durationSec: liveDuration(sessions, active, now),
    todaySession,
    selectedTrainingId: state.selectedTrainingId,
    stats,
    awards,
    start,
    stop,
    reset,
    selectTraining,
  }
}
