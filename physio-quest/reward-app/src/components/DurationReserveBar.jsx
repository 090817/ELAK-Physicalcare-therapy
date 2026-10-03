import { segmentPercent } from '../data/milestones'
import { getNextTimeMilestone, timeMilestones } from '../data/timeMilestones'
import { formatTimer } from '../lib/records'
import { LockIcon, MilestoneIcon } from './icons'
import SceneText from './SceneText'

function nodeLeft(index) {
  return ((index + 1) / timeMilestones.length) * 100
}

export default function DurationReserveBar({ seconds, freshIds, onSelect }) {
  const next = getNextTimeMilestone(seconds)
  const percent = segmentPercent(seconds, timeMilestones.map((item) => item.threshold))
  const remain = next ? Math.max(0, next.threshold - seconds) : 0

  return (
    <section aria-label="Time reserve">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-mist">Total time</p>
          <p className="font-round mt-1 flex items-baseline gap-1 text-ink">
            <span className="text-[2.15rem] leading-none font-extrabold tracking-tight tabular-nums sm:text-4xl">
              {formatTimer(seconds)}
            </span>
            <span className="text-lg font-bold text-mist tabular-nums">{next ? `/ ${formatTimer(next.threshold)}` : ''}</span>
          </p>
        </div>
        <p className="max-w-[8.5rem] shrink-0 text-right text-sm leading-6 text-mist">
          {next ? (
            <>
              Next time badge
              <span className="mt-0.5 block font-semibold text-peach">{next.title}</span>
            </>
          ) : (
            <>
              Time badges are all lit
              <span className="mt-0.5 block">Time still grows</span>
            </>
          )}
        </p>
      </div>

      <SceneText
        text={next ? next.teaser : 'These minutes have become part of daily life.'}
        className="mt-4 text-[15px] leading-7 text-[#5e6d66]"
      />

      <div className="mt-7 px-4">
        <div className="relative h-[18px]">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuenow={Math.floor(seconds)}
            aria-valuemax={next ? next.threshold : timeMilestones.at(-1).threshold}
            aria-label={next ? `Total time ${formatTimer(seconds)} / ${formatTimer(next.threshold)}` : `Saved ${formatTimer(seconds)}`}
            className="absolute inset-0 rounded-full bg-[#f3eee6] shadow-[inset_0_2px_4px_rgba(120,90,50,0.06)]"
          />
          <div
            className="reserve-fill absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#f6d7a8_0%,#e7b56a_48%,#fff1d4_100%)] shadow-[0_0_18px_rgba(231,181,106,0.35)]"
            style={{ width: `${percent}%` }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div className="absolute inset-x-0 top-0 h-1/2 bg-white/30" />
              {percent > 0 ? (
                <div className="animate-sheen absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
              ) : null}
            </div>
            <span className="animate-orb absolute top-1/2 right-0 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-white" />
          </div>

          {timeMilestones.map((milestone, index) => {
            const unlocked = seconds >= milestone.threshold
            const fresh = freshIds.includes(milestone.id)
            return (
              <button
                key={milestone.id}
                type="button"
                onClick={() => onSelect(milestone)}
                style={{ left: `${nodeLeft(index)}%` }}
                aria-label={`${milestone.title}, ${milestone.mark}, ${unlocked ? 'lit' : 'not lit'}`}
                className="absolute top-1/2 z-10 h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
              >
                <span
                  className={`relative grid h-11 w-11 place-items-center rounded-full ${fresh ? 'animate-node-pop' : ''} ${
                    unlocked
                      ? 'border border-[#efc98a] bg-[linear-gradient(180deg,#fffdf8,#fff1df)] text-peach shadow-[0_8px_16px_rgba(231,181,106,0.28)]'
                      : 'border border-dashed border-[#e4d8c8] bg-[#fbf7f1] text-[#c3b6a6]'
                  }`}
                >
                  {fresh ? (
                    <span className="animate-pulse-ring pointer-events-none absolute inset-[-5px] rounded-full border-2 border-[#efc98a]/80" />
                  ) : null}
                  <MilestoneIcon name={milestone.icon} className="h-[22px] w-[22px]" />
                  {unlocked ? null : (
                    <span className="absolute -right-0.5 -bottom-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#f8f3ec] text-[#b7aa9c] ring-2 ring-white">
                      <LockIcon />
                    </span>
                  )}
                </span>
                <span className="absolute top-14 left-1/2 block w-max -translate-x-1/2 text-center whitespace-nowrap">
                  <span className={`block text-[11px] leading-tight font-semibold min-[360px]:text-[12px] ${unlocked ? 'text-peach' : 'text-mist'}`}>
                    {milestone.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-mist tabular-nums">{milestone.mark}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="h-20" aria-hidden="true" />
      </div>

      <p className="text-sm leading-6 text-mist">
        {next ? (
          <>
            Save <span className="font-semibold text-peach tabular-nums">{formatTimer(remain)}</span> more to reach {next.title}
          </>
        ) : (
          'Time still adds up. Each day saves up to 10 minutes.'
        )}
      </p>
    </section>
  )
}
