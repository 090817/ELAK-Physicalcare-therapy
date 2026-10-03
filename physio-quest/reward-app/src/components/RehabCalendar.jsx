import { useMemo, useState } from 'react'
import { trainingById } from '../data/trainings'
import { formatDuration, todayKey } from '../lib/records'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function formatDayLabel(key) {
  const [year, month, day] = key.split('-')
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`
}

function monthCells(year, month) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: firstWeekday }, () => null)
  for (let day = 1; day <= days; day += 1) cells.push(new Date(year, month, day))
  return cells
}

export default function RehabCalendar({ sessions, today }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selected, setSelected] = useState(today)
  const byDate = useMemo(() => new Map(sessions.map((item) => [item.date, item])), [sessions])
  const cells = monthCells(cursor.year, cursor.month)
  const selectedSession = byDate.get(selected)
  const markedCount = sessions.filter((item) => item.date.startsWith(`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`)).length

  const shift = (amount) => {
    const next = new Date(cursor.year, cursor.month + amount, 1)
    setCursor({ year: next.getFullYear(), month: next.getMonth() })
  }

  return (
    <section>
      <h1 className="text-[1.7rem] font-semibold text-ink">Practice calendar</h1>
      <p className="mt-2 text-[15px] leading-7 text-[#5e6d66]">
        <span className="block">Days you practiced keep a light green mark.</span>
        <span className="block">Empty days just have not started yet.</span>
      </p>

      <div className="mt-6 rounded-[28px] border border-white/80 bg-white/75 p-4 shadow-[0_20px_50px_rgba(90,110,90,0.08)] sm:p-6">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => shift(-1)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-lg text-leaf" aria-label="Previous month">
            ‹
          </button>
          <div className="text-center">
            <p className="font-semibold text-ink">
              {MONTHS[cursor.month]} {cursor.year}
            </p>
            <p className="text-xs text-mist">{markedCount} {markedCount === 1 ? 'day' : 'days'} this month</p>
          </div>
          <button type="button" onClick={() => shift(1)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-lg text-leaf" aria-label="Next month">
            ›
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-xs text-mist">
          {WEEKDAYS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-2">
          {cells.map((date, index) => {
            if (!date) return <span key={`empty-${index}`} />
            const key = todayKey(date)
            const marked = byDate.has(key)
            const isToday = key === today
            const isSelected = key === selected
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-label={`${MONTHS[date.getMonth()]} ${date.getDate()}${marked ? ', practiced' : ''}`}
                className={`mx-auto grid h-10 w-10 cursor-pointer place-items-center rounded-full text-sm ${
                  marked
                    ? 'bg-[#1c7a4d] font-semibold text-white'
                    : isToday
                      ? 'text-leaf ring-2 ring-[#8ed4ae]'
                      : 'text-ink'
                } ${isSelected && !marked ? 'bg-[#e7f7ee]' : ''}`}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>

        <p className="mt-5 text-center text-sm leading-6 text-[#5e6d66]">
          {selectedSession
            ? `${formatDayLabel(selected)} · ${
                selectedSession.durationSec > 0 ? `stretch ${formatDuration(selectedSession.durationSec)}` : 'checked in'
              }${
                selectedSession.trainings?.length
                  ? ` · ${selectedSession.trainings.map((id) => trainingById(id)?.name).filter(Boolean).join(', ')}`
                  : ''
              }`
            : `${formatDayLabel(selected)} · no record yet`}
        </p>
      </div>
    </section>
  )
}
