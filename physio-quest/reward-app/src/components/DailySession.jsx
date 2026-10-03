import { DAILY_CAP_SECONDS, HOLD_SECONDS, formatTimer } from '../lib/records'

export default function DailySession({ active, todaySeconds, capped, onStart, onStop }) {
  const progress = Math.min(todaySeconds / DAILY_CAP_SECONDS, 1)
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dayLit = todaySeconds >= HOLD_SECONDS

  return (
    <section className="rounded-[28px] border border-white/80 bg-white/75 p-5 text-center shadow-[0_20px_50px_rgba(90,110,90,0.08)]">
      <p className="text-sm text-mist">{capped ? 'Today’s 10 minutes are full' : active ? 'Time today' : 'Today has not started'}</p>
      <div className="relative mx-auto mt-4 grid h-36 w-36 place-items-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#f3eee6" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={capped ? '#e7b56a' : '#5ec48c'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
        <div>
          <p className="font-round text-4xl font-extrabold text-ink tabular-nums">{formatTimer(todaySeconds)}</p>
          <p className="text-xs text-mist tabular-nums">/ {formatTimer(DAILY_CAP_SECONDS)}</p>
        </div>
      </div>
      <p className="mt-4 text-[15px] leading-7 text-[#5e6d66]">
        {capped
          ? (
            <>
              That is enough for today. After midnight you can add another <span className="whitespace-nowrap">10 minutes</span>.
            </>
          )
          : active
            ? dayLit
              ? 'Today is already lit. Time stops on its own at 10:00.'
              : 'After 30 seconds, today lights on its own.'
            : dayLit
              ? 'You can keep going. Today saves up to 10 minutes.'
              : 'Time starts when you press start. Stop before 30 seconds and today stays unlit.'}
      </p>
      {active && !capped ? (
        <button
          type="button"
          onClick={onStop}
          className="mt-5 inline-flex h-14 cursor-pointer items-center rounded-full bg-[#f3efe7] px-8 text-[16px] font-semibold text-[#6d6256]"
        >
          Pause
        </button>
      ) : capped ? null : (
        <button
          type="button"
          onClick={onStart}
          className="mt-5 inline-flex h-14 cursor-pointer items-center rounded-full bg-[#1c7a4d] px-8 text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_12px_26px_rgba(28,122,77,0.28)]"
        >
          {dayLit ? 'Keep adding' : 'Start adding'}
        </button>
      )}
    </section>
  )
}
