import { MilestoneIcon } from './icons'

const TONES = {
  mint: { disc: '#e7f7ee', ring: '#8ed4ae', ribbon: '#7dcea0', ink: '#1f6b45' },
  sage: { disc: '#e5f4ef', ring: '#8dcec0', ribbon: '#7ec3b2', ink: '#1f6b56' },
  peach: { disc: '#fff1e4', ring: '#f0c49a', ribbon: '#f0b56a', ink: '#9a6230' },
  amber: { disc: '#fff6e4', ring: '#efc98a', ribbon: '#e3b15f', ink: '#8a5a28' },
  leaf: { disc: '#e8f6ea', ring: '#9ed4ae', ribbon: '#5ec48c', ink: '#1f6b45' },
  bronze: { disc: '#f8e6d2', ring: '#e0a15a', ribbon: '#cd8a45', ink: '#7a4210' },
  silver: { disc: '#f3f3f6', ring: '#c5c6cc', ribbon: '#b0b2ba', ink: '#55555a' },
  gold: { disc: '#fff3c4', ring: '#e3c15a', ribbon: '#d4af37', ink: '#8a6d10' },
}

const LOCKED = { disc: '#f4f1ea', ring: '#ddd6cb', ribbon: '#e4ddd2', ink: '#a8b0ab' }

export default function MedalBadge({ name, emoji, tone = 'mint', locked = false, className = 'h-28 w-24' }) {
  const palette = locked ? LOCKED : TONES[tone] ?? TONES.mint

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 80 104" className="h-full w-full" aria-hidden="true">
        <path d="M26 54 18 98l22-12 22 12-8-44" fill={palette.ribbon} />
        <circle cx="40" cy="40" r="30" fill={palette.disc} />
        <circle cx="40" cy="40" r="24" fill="none" stroke={palette.ring} strokeWidth="2.4" />
        <circle cx="40" cy="40" r="28" fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="1.2" />
      </svg>
      <span
        className="absolute flex items-center justify-center text-[1.65rem] leading-none"
        style={{
          left: '12.5%',
          top: '9.615%',
          width: '75%',
          height: '57.692%',
          color: palette.ink,
        }}
      >
        {emoji ? <span className="flex h-8 w-8 items-center justify-center leading-none" aria-hidden="true">{emoji}</span> : <MilestoneIcon name={name} className="h-8 w-8" />}
      </span>
    </div>
  )
}
