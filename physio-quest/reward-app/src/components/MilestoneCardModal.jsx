import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDuration, formatTimer } from '../lib/records'
import { CloseIcon, MilestoneIcon } from './icons'
import SceneText from './SceneText'

const CONFETTI_COLORS = ['#8ed4ae', '#b7e7c9', '#f3c48a', '#ffe1bf', '#fff6ea', '#9ed0c2', '#f7d38a']

function createConfettiPieces() {
  return Array.from({ length: 34 }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    delay: Math.random() * 0.35,
    duration: 1.7 + Math.random() * 1.35,
    drift: -70 + Math.random() * 140,
    spin: 120 + Math.random() * 260,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    width: 6 + (index % 4) * 2,
    height: 7 + (index % 3) * 3,
    round: index % 3 === 0,
  }))
}

function Confetti() {
  const [pieces] = useState(createConfettiPieces)

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            width: piece.width,
            height: piece.height,
            background: piece.color,
            borderRadius: piece.round ? '999px' : '2px',
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            '--drift': `${piece.drift}px`,
            '--spin': `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}

export default function MilestoneCardModal({ milestone, mode, progress, onClose }) {
  const titleId = useId()
  const actionRef = useRef(null)
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    if (!milestone) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    actionRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [milestone, onClose])

  if (!milestone || typeof document === 'undefined') return null

  const unlocked = mode !== 'locked'
  const isTime = milestone.kind === 'time'
  const unit = milestone.unit || 'days'
  const remain = Math.max(milestone.threshold - progress, 0)
  const remainText = isTime
    ? `Save ${formatDuration(remain)} more and this ease will show up in daily life.`
    : unit === 'kcal'
      ? `Save ${remain} kcal more and this ease will show up in daily life.`
      : `Finish ${remain} more ${unit} and this ease will show up in daily life.`
  const footnote = unlocked
    ? mode === 'celebrate'
      ? milestone.blessing
      : isTime
        ? 'These minutes stay. Tomorrow you can add another ten minutes.'
        : 'This change stays, even if a few days are missed.'
    : remainText

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close reward card"
        className="animate-backdrop-in absolute inset-0 cursor-pointer bg-[#2c3a34]/35 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div className="relative z-10 grid h-full place-items-center p-4 sm:p-6">
        <article
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="animate-modal-in relative z-10 grid w-full max-w-3xl grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)] overflow-hidden rounded-[28px] bg-[#fffdf9] shadow-[0_30px_80px_rgba(60,80,60,0.18)]"
        >
          <div className={`relative flex min-h-[16rem] flex-col items-center justify-center bg-gradient-to-br px-5 py-8 ${unlocked ? milestone.wash : 'from-[#f1eee8] to-[#f7f4ee]'}`}>
            {mode === 'celebrate' && !reduceMotion ? (
              <span className="award-rays animate-ray-spin pointer-events-none absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full" />
            ) : null}
            <div
              className={`relative grid h-24 w-24 place-items-center rounded-full ring-4 ring-white/80 ${mode === 'celebrate' ? 'animate-award-pop' : ''} ${
                unlocked
                  ? 'bg-[linear-gradient(180deg,#ffffff,#e7f7ee)] text-leaf shadow-[0_10px_24px_rgba(94,191,138,0.28)]'
                  : 'border border-dashed border-[#d5dbd6] bg-[#f7f5f1] text-[#b7beb8]'
              }`}
            >
              {mode === 'celebrate' ? (
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                  <span className="animate-sheen absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                </span>
              ) : null}
              {milestone.emoji ? (
                <span className="relative text-5xl leading-none" aria-hidden="true">
                  {milestone.emoji}
                </span>
              ) : (
                <MilestoneIcon name={milestone.icon} className="relative h-12 w-12" />
              )}
            </div>
            <p
              className={`mt-4 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                unlocked ? 'border-[#7dcea0]/80 text-leaf' : 'border-[#ddd6cb] text-[#b0a89c]'
              }`}
            >
              {unlocked ? 'Lit' : 'Not yet'}
            </p>
          </div>

          <div className="relative flex max-h-[min(88vh,22rem)] flex-col justify-center px-6 py-6 sm:px-8">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[#f3efe7] text-[#5c6b64]"
            >
              <CloseIcon />
            </button>
            {mode === 'celebrate' ? <p className="text-sm font-medium text-leaf">A new feeling is lit</p> : null}
            {mode === 'locked' ? <p className="text-sm font-medium text-peach">Still getting closer</p> : null}
            <p className={`inline-flex w-fit rounded-full bg-[#eef6f0] px-3 py-1 text-xs font-medium text-leaf ${mode === 'detail' ? '' : 'mt-2'}`}>
              {milestone.stage}
            </p>
            <h2 id={titleId} className="mt-2 pr-10 text-[1.55rem] leading-tight font-semibold tracking-tight text-ink">
              {milestone.title}
            </h2>
            <SceneText
              text={milestone.description}
              className={`mt-3 text-[15px] leading-7 ${unlocked ? 'text-[#3e5148]' : 'text-mist'}`}
            />
            <SceneText text={footnote} className="mt-3 text-[14px] leading-6 text-ink" />
            {unlocked ? (
              <p className="mt-3 text-xs tracking-wide text-mist">
                {isTime
                  ? `${formatTimer(milestone.threshold)} saved · stays lit`
                  : milestone.kind === 'award'
                    ? `${milestone.threshold} ${unit} · stays lit`
                    : `Day ${milestone.threshold} · stays lit`}
              </p>
            ) : null}
            <button
              ref={actionRef}
              type="button"
              onClick={onClose}
              className={`mt-5 h-11 max-w-xs cursor-pointer rounded-full px-6 text-[15px] font-semibold ${
                unlocked
                  ? 'bg-[#1c7a4d] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_10px_20px_rgba(28,122,77,0.28)]'
                  : 'bg-[#f3efe7] text-[#6d6256]'
              }`}
            >
              {mode === 'celebrate' ? 'Keep this reward' : 'Got it'}
            </button>
          </div>
        </article>
      </div>
      {mode === 'celebrate' && !reduceMotion ? <Confetti /> : null}
    </div>,
    document.body,
  )
}
