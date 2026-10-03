function IconFrame({ className, children }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function MilestoneIcon({ name, className = 'h-6 w-6' }) {
  if (name === 'turn') {
    return (
      <IconFrame className={className}>
        <circle cx="21" cy="16" r="5.2" />
        <path d="M13.5 35.5c1.5-7 4.4-10.2 8.2-10.2 3.7 0 6.4 3.1 7.6 9.6" />
        <path d="M30 12.5c4.8 1.2 8 5 7.2 9.6" />
        <path d="M35.2 10.2 38.4 13l-3.2.6" />
      </IconFrame>
    )
  }

  if (name === 'bend') {
    return (
      <IconFrame className={className}>
        <circle cx="18" cy="13" r="4.3" />
        <path d="M18.2 17.6c.4 5.2-.6 9.2-4.4 14.2" />
        <path d="M16.8 24.2c6.2 1.2 11.2 5 13.6 9.4" />
        <path d="M28.2 33.6h9.2c1.5.1 2.2 1.8.8 2.8H28c-2.2.2-2.8-2.4.2-2.8Z" />
      </IconFrame>
    )
  }

  if (name === 'rest') {
    return (
      <IconFrame className={className}>
        <circle cx="24" cy="14" r="4.2" />
        <path d="M10 30c3.2-7 7.2-10 14-10s10.8 3 14 10" />
        <path d="M16 30c1.2 6 4 9 8 9s6.8-3 8-9" />
      </IconFrame>
    )
  }

  if (name === 'breath') {
    return (
      <IconFrame className={className}>
        <path d="M24 36c-9 0-13-7-13-14 7 2 9 7 9 12" />
        <path d="M24 36c9 0 13-7 13-14-7 2-9 7-9 12" />
        <path d="M24 22v8" />
      </IconFrame>
    )
  }

  if (name === 'clock') {
    return (
      <IconFrame className={className}>
        <circle cx="24" cy="24" r="12" />
        <path d="M24 16.5V24l6 3" />
      </IconFrame>
    )
  }

  if (name === 'sun') {
    return (
      <IconFrame className={className}>
        <circle cx="24" cy="24" r="6" />
        <path d="M24 10v4M24 34v4M10 24h4M34 24h4M14 14l2.8 2.8M31.2 31.2 34 34M34 14l-2.8 2.8M16.8 31.2 14 34" />
      </IconFrame>
    )
  }

  if (name === 'swing') {
    return (
      <IconFrame className={className}>
        <circle cx="17" cy="18" r="4.2" />
        <path d="M17.2 22.4c.8 5.4 0 9.4-2.6 13.2" />
        <path d="M16.4 25.2c5.2-1.6 10.6-6.4 14.8-12.2" />
        <ellipse cx="34.6" cy="11.2" rx="5.2" ry="3.3" transform="rotate(-28 34.6 11.2)" />
        <path d="M30.8 14.2 28 18" />
      </IconFrame>
    )
  }

  return (
    <IconFrame className={className}>
      <circle cx="22" cy="12.5" r="4" />
      <path d="M22 16.8c1.4 4.6 1.2 8 .2 11.6" />
      <path d="M21.6 23.4 28.4 27" />
      <path d="M22.2 28.2 16.2 35.2" />
      <path d="M22.2 28.2 28.6 35.6" />
      <path d="M10 39.2c7-2.8 14.2-3.2 28-.4" />
    </IconFrame>
  )
}

export function SproutIcon({ className = 'h-7 w-7' }) {
  return (
    <IconFrame className={className}>
      <path d="M24 40V22" />
      <path d="M24 29c-7-.6-11-6.2-9.4-12.2 7 .2 10.6 5.4 9.4 12.2Z" />
      <path d="M24 26.5c6.4-1.6 11-6 9.6-12-7 .6-10.8 6-9.6 12Z" />
    </IconFrame>
  )
}

export function LockIcon({ className = 'h-2.5 w-2.5' }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="3.2" y="7" width="9.6" height="6.2" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.2 7V5.3a2.8 2.8 0 0 1 5.6 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function CloseIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M4 4l8 8M12 4 4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function SparkIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 2.2c.4 3.2 1.6 4.6 4.8 5.2-3.2.5-4.4 1.9-4.8 5.1-.4-3.2-1.6-4.6-4.8-5.1 3.2-.6 4.4-2 4.8-5.2Z"
        fill="currentColor"
      />
      <path d="M15.2 12.2c.2 1.3.7 1.9 2 2.1-1.3.2-1.8.8-2 2.1-.2-1.3-.7-1.9-2-2.1 1.3-.2 1.8-.8 2-2.1Z" fill="currentColor" />
    </svg>
  )
}
