import { useState } from 'react'
import { awardTabs } from '../data/awards'
import { milestones } from '../data/milestones'
import { timeMilestones } from '../data/timeMilestones'
import { trainingById } from '../data/trainings'
import { formatDuration, formatTimer } from '../lib/records'
import MedalBadge from './MedalBadge'
import TrainingPicker from './TrainingPicker'

const DAY_TONE = { turn: 'mint', bend: 'sage', swing: 'peach', roam: 'leaf' }
const TIME_TONE = { rest: 'peach', breath: 'sage', hour: 'amber', afternoon: 'leaf' }

function BadgeButton({ milestone, unlocked, detail, onSelect }) {
  const tone = milestone.tone || (milestone.kind === 'time' ? TIME_TONE[milestone.id] : DAY_TONE[milestone.id]) || 'mint'
  return (
    <button
      type="button"
      onClick={() => onSelect(milestone)}
      className="cursor-pointer rounded-[24px] border border-white/80 bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(90,110,90,0.06)]"
    >
      <MedalBadge name={milestone.icon} emoji={milestone.emoji} tone={tone} locked={!unlocked} className="mx-auto h-28 w-24" />
      <p className="mt-2 text-xs text-mist">{milestone.stage}</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">{milestone.title}</h2>
      <p className={`mt-1 text-sm ${unlocked ? 'text-leaf' : 'text-mist'}`}>{detail}</p>
    </button>
  )
}

function unitLabel(unit, n) {
  if (unit === 'days') return n === 1 ? 'day' : 'days'
  if (unit === 'sessions') return n === 1 ? 'session' : 'sessions'
  return unit
}

function awardDetail(award) {
  const unit = unitLabel(award.unit, award.threshold)
  if (award.unlocked) return `${award.threshold} ${unit} · lit`
  const remain = Math.max(award.threshold - award.current, 0)
  return `${award.threshold} ${unit} · ${remain} ${unitLabel(award.unit, remain)} to go`
}

export default function AchievementPage({ count, durationSec, awards, selectedTrainingId, onSelectTraining, onSelect }) {
  const [tab, setTab] = useState('training')
  const training = trainingById(selectedTrainingId)
  const trainingAwards = awards.filter((item) => item.group === 'training' && item.trainingId === selectedTrainingId)
  const visible =
    tab === 'scene'
      ? milestones
      : tab === 'time'
        ? timeMilestones
        : tab === 'training'
          ? trainingAwards
          : awards.filter((item) => item.group === tab)

  return (
    <section>
      <h1 className="text-[1.7rem] font-semibold text-ink">Rewards</h1>
      <p className="mt-2 text-[15px] leading-7 text-[#5e6d66]">Switch the tabs to see badges. Lit badges stay, even if a few days are missed.</p>

      <div className="sticky top-0 z-20 -mx-4 mt-4 bg-[#f6f3ec]/95 px-4 py-3 backdrop-blur-md" role="tablist" aria-label="Badge groups">
        <div className="flex gap-2 overflow-x-auto">
          {awardTabs.map((item) => {
            const selected = item.id === tab
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={`shrink-0 cursor-pointer rounded-full px-3 py-2 text-sm font-semibold ${
                  selected ? 'bg-[#24352d] text-white' : 'bg-white/80 text-mist'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'training' ? (
        <div className="mt-2">
          <TrainingPicker selectedId={selectedTrainingId} onSelect={onSelectTraining} label="Exercise badges" />
          <p className="mt-3 text-sm leading-6 text-mist">
            {training ? `${training.name} · about ${training.kcal} kcal each time` : 'Choose an exercise'}
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {visible.map((milestone) => {
          if (milestone.kind === 'award') {
            return (
              <BadgeButton
                key={milestone.id}
                milestone={milestone}
                unlocked={milestone.unlocked}
                onSelect={onSelect}
                detail={awardDetail(milestone)}
              />
            )
          }
          if (milestone.kind === 'time') {
            const unlocked = durationSec >= milestone.threshold
            const remain = Math.max(milestone.threshold - durationSec, 0)
            return (
              <BadgeButton
                key={milestone.id}
                milestone={milestone}
                unlocked={unlocked}
                onSelect={onSelect}
                detail={unlocked ? `${formatTimer(milestone.threshold)} · lit` : `${milestone.mark} · ${formatDuration(remain)} to go`}
              />
            )
          }
          const unlocked = count >= milestone.threshold
          const remain = Math.max(milestone.threshold - count, 0)
          return (
            <BadgeButton
              key={milestone.id}
              milestone={milestone}
              unlocked={unlocked}
              onSelect={onSelect}
              detail={unlocked ? `${milestone.threshold} ${milestone.threshold === 1 ? 'day' : 'days'} · lit` : `${milestone.threshold} days · ${remain} ${remain === 1 ? 'day' : 'days'} to go`}
            />
          )
        })}
      </div>
    </section>
  )
}
