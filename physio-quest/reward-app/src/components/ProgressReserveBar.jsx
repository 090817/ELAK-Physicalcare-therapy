import { milestones, getNextMilestone, getNodeLeft, getReservePercent } from '../data/milestones'
import { LockIcon, MilestoneIcon } from './icons'
import SceneText from './SceneText'

export default function ProgressReserveBar({ count, justAdded, freshIds, rippleKey, onSelect, tipRef }) {
  const next = getNextMilestone(count)
  const percent = getReservePercent(count)

  return (
    <section aria-label="Progress reserve">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-mist">Reserve progress</p>
          <p className="relative mt-1 flex items-baseline gap-1">
            <span
              key={count}
              className={`font-round inline-block text-[2.65rem] leading-none font-extrabold tracking-tight text-ink sm:text-5xl ${justAdded ? 'animate-count-pop' : ''}`}
            >
              {count}
            </span>
            <span className="font-round relative text-xl font-bold text-mist">
              {next ? `/ ${next.threshold}` : ''} days
              {justAdded ? (
                <span
                  key={`plus-${count}`}
                  className="font-round animate-float-up pointer-events-none absolute -top-4 left-full ml-1 text-sm font-extrabold text-leaf"
                >
                  +1
                </span>
              ) : null}
            </span>
          </p>
        </div>
        <p className="max-w-[8.5rem] shrink-0 text-right text-sm leading-6 text-mist">
          {next ? (
            <>
              Next stop
              <span className="mt-0.5 block font-semibold text-leaf">{next.title}</span>
            </>
          ) : (
            <>
              Milestones are all lit
              <span className="mt-0.5 block">Progress still grows</span>
            </>
          )}
        </p>
      </div>

      <SceneText
        text={next ? next.teaser : 'These everyday movements already feel easier.'}
        className="mt-4 text-[15px] leading-7 text-[#5e6d66]"
      />

      <div className="mt-7 px-4">
        <div className="relative h-[18px]">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuenow={count}
            aria-valuemax={next ? next.threshold : Math.max(count, milestones.at(-1).threshold)}
            aria-label={next ? `Reserve progress ${count} / ${next.threshold} days` : `Saved ${count} days`}
            className="absolute inset-0 rounded-full bg-[#e6efe8] shadow-[inset_0_2px_4px_rgba(70,100,80,0.07)]"
          />
          <div
            className="reserve-fill absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#b7e4c8_0%,#5ec48c_46%,#d4f5c6_100%)] shadow-[0_0_18px_rgba(94,191,138,0.42)]"
            style={{ width: `${percent}%` }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div className="absolute inset-x-0 top-0 h-1/2 bg-white/25" />
              {percent > 0 ? (
                <div className="animate-sheen absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/75 to-transparent" />
              ) : null}
            </div>
            <span
              ref={tipRef}
              className="animate-orb absolute top-1/2 right-0 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-white"
            />
            {rippleKey > 0 ? <span key={rippleKey} className="tip-ripple" /> : null}
          </div>

          {milestones.map((milestone, index) => {
            const unlocked = count >= milestone.threshold
            const fresh = freshIds.includes(milestone.id)
            return (
              <button
                key={milestone.id}
                type="button"
                onClick={() => onSelect(milestone)}
                style={{ left: `${getNodeLeft(index)}%` }}
                aria-label={`${milestone.title}, ${milestone.threshold} days, ${unlocked ? 'lit' : 'not lit'}`}
                className="absolute top-1/2 z-10 h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
              >
                <span
                  className={`relative grid h-11 w-11 place-items-center rounded-full transition-transform duration-200 hover:scale-105 ${fresh ? 'animate-node-pop' : ''} ${
                    unlocked
                      ? 'border border-[#8ed4ae] bg-[linear-gradient(180deg,#ffffff,#e7f7ee)] text-leaf shadow-[0_8px_16px_rgba(94,191,138,0.28)]'
                      : 'border border-dashed border-[#cfd6d1] bg-[#f6f4ef] text-[#b7beb8]'
                  }`}
                >
                  {fresh ? (
                    <span className="animate-pulse-ring pointer-events-none absolute inset-[-5px] rounded-full border-2 border-[#7dcea0]/70" />
                  ) : null}
                  <MilestoneIcon name={milestone.icon} className="h-[22px] w-[22px]" />
                  {unlocked ? null : (
                    <span className="absolute -right-0.5 -bottom-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#f4f1ea] text-[#a8b0ab] ring-2 ring-white">
                      <LockIcon />
                    </span>
                  )}
                </span>
                <span className="absolute top-14 left-1/2 block w-max -translate-x-1/2 text-center whitespace-nowrap">
                  <span className={`block text-[11px] leading-tight font-semibold min-[360px]:text-[12px] ${unlocked ? 'text-leaf' : 'text-mist'}`}>
                    {milestone.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-mist">{milestone.threshold} days</span>
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
            Finish <span className="font-semibold text-leaf">{next.threshold - count}</span> more days to reach {next.title}
          </>
        ) : (
          'Days still add up. This page will not clear.'
        )}
      </p>
    </section>
  )
}
