import { useCallback, useEffect, useRef, useState } from 'react'
import { getUnlockedMilestones } from '../data/milestones'
import { getUnlockedTimeMilestones } from '../data/timeMilestones'
import { trainingById } from '../data/trainings'
import { formatTimer } from '../lib/records'
import { useRecords } from '../lib/useRecords'
import AchievementPage from './AchievementPage'
import BottomNav from './BottomNav'
import DailySession from './DailySession'
import DurationReserveBar from './DurationReserveBar'
import MilestoneCardModal from './MilestoneCardModal'
import ProgressReserveBar from './ProgressReserveBar'
import RehabCalendar from './RehabCalendar'
import TrainingPicker from './TrainingPicker'
import { SproutIcon } from './icons'

function embedMode() {
  try {
    return new URLSearchParams(window.location.search).get('embed') === '1'
  } catch {
    return false
  }
}

export default function InteractiveDemo() {
  const records = useRecords()
  const embedded = embedMode()
  const [page, setPage] = useState(embedded ? 'achievements' : 'today')
  const [justAdded, setJustAdded] = useState(false)
  const [freshIds, setFreshIds] = useState([])
  const [rippleKey, setRippleKey] = useState(0)
  const [modal, setModal] = useState(null)
  const [live, setLive] = useState('')

  const timers = useRef([])
  const tipRef = useRef(null)
  const seenCount = useRef(records.count)
  const seenDuration = useRef(Math.floor(records.durationSec))
  const seenAwards = useRef(null)
  const wholeDuration = Math.floor(records.durationSec)
  const awardKey = records.awards
    .filter((item) => item.unlocked)
    .map((item) => item.id)
    .join('|')
  const training = trainingById(records.selectedTrainingId)

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  const schedule = useCallback((fn, delay) => {
    const id = window.setTimeout(fn, delay)
    timers.current.push(id)
  }, [])

  useEffect(() => {
    const previous = seenCount.current
    seenCount.current = records.count
    if (records.count <= previous) return
    const unlocked = getUnlockedMilestones(previous, records.count)
    setJustAdded(true)
    setRippleKey((value) => value + 1)
    schedule(() => setJustAdded(false), 950)
    setLive(`Today is lit. ${records.count} days saved.`)
    if (unlocked.length === 0) return
    const milestone = unlocked[unlocked.length - 1]
    setFreshIds(unlocked.map((item) => item.id))
    setLive(`Today is lit. You reached ${milestone.title}.`)
    schedule(() => setFreshIds([]), 1700)
    schedule(() => setModal({ milestone, mode: 'celebrate' }), 460)
  }, [records.count, schedule])

  useEffect(() => {
    const previous = seenDuration.current
    seenDuration.current = wholeDuration
    if (wholeDuration <= previous) return
    const unlocked = getUnlockedTimeMilestones(previous, wholeDuration)
    if (unlocked.length === 0) return
    const milestone = unlocked[unlocked.length - 1]
    setFreshIds(unlocked.map((item) => item.id))
    setLive(`Time reached ${formatTimer(wholeDuration)}. You found ${milestone.title}.`)
    schedule(() => setFreshIds([]), 1700)
    schedule(() => setModal({ milestone, mode: 'celebrate' }), 460)
  }, [wholeDuration, schedule])

  useEffect(() => {
    const ids = awardKey ? awardKey.split('|') : []
    if (seenAwards.current === null) {
      seenAwards.current = new Set(ids)
      return
    }
    const fresh = ids.filter((id) => !seenAwards.current.has(id))
    seenAwards.current = new Set(ids)
    if (fresh.length === 0) return
    const milestone = records.awards.find((item) => item.id === fresh[0])
    if (!milestone) return
    setLive(`Lit ${milestone.title}`)
    schedule(() => setModal({ milestone, mode: 'celebrate' }), 460)
  }, [awardKey, records.awards, schedule])

  const onSelect = (milestone) => {
    const award = milestone.kind === 'award' ? records.awards.find((item) => item.id === milestone.id) : null
    const progress = milestone.kind === 'time' ? records.durationSec : award ? award.current : records.count
    setModal({
      milestone: award || milestone,
      mode: progress >= milestone.threshold ? 'detail' : 'locked',
    })
  }

  const onClose = useCallback(() => setModal(null), [])

  const reset = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    seenCount.current = 0
    seenDuration.current = 0
    seenAwards.current = new Set()
    setJustAdded(false)
    setFreshIds([])
    setModal(null)
    records.reset()
    setLive('Records cleared')
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute -top-28 -left-24 h-72 w-72 rounded-full bg-[#d7efdf] blur-3xl" />
      <div className="pointer-events-none absolute top-16 -right-24 h-72 w-72 rounded-full bg-[#ffe3c4]/80 blur-3xl" />

      <main className="relative mx-auto w-full max-w-xl px-4 pt-8 pb-36 sm:px-5">
        {page === 'today' ? (
          <>
            <header className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-white/85 text-leaf shadow-[0_10px_24px_rgba(90,110,90,0.08)]">
                <SproutIcon />
              </div>
              <div>
                <p className="text-sm tracking-wide text-mist">{embedded ? 'ELAK practice reward' : 'Home stretch'}</p>
                <h1 className="mt-1 text-[1.7rem] leading-tight font-semibold text-ink">{embedded ? 'Practice done, reward saved' : 'Start the timer'}</h1>
                <p className="mt-2 text-[15px] leading-7 text-[#5e6d66]">
                  {embedded ? (
                    <>
                      <span className="block">The ankle practice you just finished is on this page.</span>
                      <span className="block">Badges, calendar days, and the reserve stay with this account.</span>
                    </>
                  ) : (
                    <>
                      <span className="block">Time starts when you press start.</span>
                      <span className="block">30 seconds lights today. The daily cap is 10 minutes.</span>
                    </>
                  )}
                </p>
              </div>
            </header>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[22px] bg-white/75 px-4 py-3 shadow-[0_10px_24px_rgba(90,110,90,0.05)]">
                <p className="text-xs text-mist">Sessions</p>
                <p className="font-round mt-1 text-2xl font-extrabold text-ink">{records.count}</p>
              </div>
              <div className="rounded-[22px] bg-white/75 px-4 py-3 shadow-[0_10px_24px_rgba(90,110,90,0.05)]">
                <p className="text-xs text-mist">Total time</p>
                <p className="font-round mt-1 text-2xl font-extrabold text-ink tabular-nums">{formatTimer(records.durationSec)}</p>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm text-mist">Today: {training ? training.name : 'one exercise'} · about {training?.kcal ?? 0} kcal</p>
              <TrainingPicker selectedId={records.selectedTrainingId} onSelect={records.selectTraining} />
            </div>

            <div className="mt-4">
              <DailySession
                active={records.active}
                todaySeconds={records.todaySeconds}
                capped={records.capped}
                onStart={records.start}
                onStop={records.stop}
              />
            </div>

            <div className="mt-4 rounded-[28px] border border-white/80 bg-white/75 p-4 shadow-[0_20px_50px_rgba(90,110,90,0.08)] sm:p-7">
              <ProgressReserveBar
                count={records.count}
                justAdded={justAdded}
                freshIds={freshIds}
                rippleKey={rippleKey}
                onSelect={onSelect}
                tipRef={tipRef}
              />
              <div className="mt-2 border-t border-[#efe8dc] pt-6">
                <DurationReserveBar seconds={records.durationSec} freshIds={freshIds} onSelect={onSelect} />
              </div>
            </div>

            {records.count > 0 && !embedded ? (
              <button type="button" onClick={reset} className="mt-5 block w-full cursor-pointer text-center text-sm text-mist">
                Clear records on this device
              </button>
            ) : null}
          </>
        ) : null}

        {page === 'calendar' ? <RehabCalendar sessions={records.sessions} today={records.today} /> : null}
        {page === 'achievements' ? (
          <AchievementPage
            count={records.count}
            durationSec={records.durationSec}
            awards={records.awards}
            selectedTrainingId={records.selectedTrainingId}
            onSelectTraining={records.selectTraining}
            onSelect={onSelect}
          />
        ) : null}

        <p className="sr-only" aria-live="polite">
          {live}
        </p>
      </main>

      <BottomNav page={page} onChange={setPage} active={Boolean(records.active)} />
      <MilestoneCardModal
        milestone={modal?.milestone ?? null}
        mode={modal?.mode ?? 'detail'}
        progress={
          modal?.milestone?.kind === 'time'
            ? records.durationSec
            : modal?.milestone?.kind === 'award'
              ? (records.awards.find((item) => item.id === modal.milestone.id)?.current ?? 0)
              : records.count
        }
        onClose={onClose}
      />
    </div>
  )
}
