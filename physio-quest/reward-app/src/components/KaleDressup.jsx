export default function KaleDressup({ src, alt, outfit, compact = false, className = '' }) {
  return (
    <div className={`relative mx-auto ${compact ? 'w-24' : 'w-full max-w-[18rem]'} ${className}`}>
      <img src={src} alt={alt} className="block h-auto w-full" />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <Clothes kind={outfit.clothes} />
        <Glasses kind={outfit.glasses} />
        <Hat kind={outfit.hat} />
      </svg>
    </div>
  )
}

function Hat({ kind }) {
  if (kind === 'beanie') {
    return (
      <g>
        <path d="M36.8 14.2c1-8.4 25.4-8.4 26.4 0v2.2H36.8z" fill="#d96a56" />
        <ellipse cx="50" cy="15" rx="14" ry="2.3" fill="#c45c4a" />
        <circle cx="50" cy="6.4" r="2" fill="#f6f1e8" />
      </g>
    )
  }
  if (kind === 'cap') {
    return (
      <g>
        <path d="M37.6 14.2c1.6-6.8 22.8-6.8 24.4 0v1.8H37.6z" fill="#2f5d44" />
        <path d="M50 15.8c8 .2 16 1.1 18 2.1-7 1.3-15.4 1.5-21.2.2z" fill="#244a36" />
      </g>
    )
  }
  if (kind === 'sun') {
    return (
      <g>
        <ellipse cx="50" cy="15.6" rx="20.4" ry="2.8" fill="#e4c37a" />
        <path d="M40.4 14.8c1.2-6 18-6 19.2 0v1.4H40.4z" fill="#f0d38a" />
      </g>
    )
  }
  if (kind === 'bow') {
    return (
      <g>
        <ellipse cx="44.8" cy="9.6" rx="5" ry="3.1" fill="#c45c8a" />
        <ellipse cx="55.2" cy="9.6" rx="5" ry="3.1" fill="#c45c8a" />
        <circle cx="50" cy="9.6" r="1.7" fill="#a24672" />
      </g>
    )
  }
  if (kind === 'flower') {
    return (
      <g>
        <circle cx="47.2" cy="8.4" r="2.2" fill="#e7a0b8" />
        <circle cx="52.8" cy="8.4" r="2.2" fill="#e7a0b8" />
        <circle cx="47.2" cy="13" r="2.2" fill="#e7a0b8" />
        <circle cx="52.8" cy="13" r="2.2" fill="#e7a0b8" />
        <circle cx="50" cy="10.7" r="1.8" fill="#f3d36a" />
      </g>
    )
  }
  if (kind === 'beret') {
    return (
      <g>
        <ellipse cx="48.4" cy="12.8" rx="13" ry="4.2" fill="#7a2f3a" transform="rotate(-12 48.4 12.8)" />
        <ellipse cx="48.4" cy="14.4" rx="8.2" ry="1.4" fill="#5e2430" transform="rotate(-12 48.4 14.4)" />
        <circle cx="37.6" cy="10.6" r="1.2" fill="#7a2f3a" />
      </g>
    )
  }
  if (kind === 'crown') {
    return (
      <g>
        <path d="M37.6 14.6l3.2-5.8 4.2 3.8 5-6.8 5 6.8 4.2-3.8 3.2 5.8z" fill="#e4c056" />
        <path d="M38 14.6h24v1.6H38z" fill="#d4ad3f" />
        <circle cx="40.8" cy="9.4" r="0.9" fill="#f6f1e8" />
        <circle cx="50" cy="6.6" r="1" fill="#f6f1e8" />
        <circle cx="59.2" cy="9.4" r="0.9" fill="#f6f1e8" />
      </g>
    )
  }
  return null
}

function Glasses({ kind }) {
  if (kind === 'round') {
    return (
      <g fill="rgba(40,40,40,0.16)" stroke="#2a2a2a" strokeWidth="0.9">
        <circle cx="61.8" cy="32.6" r="3.1" />
        <circle cx="69.2" cy="32.6" r="3.1" />
        <path d="M64.9 32.6h1.1" fill="none" />
        <path d="M58.7 32.4h-2" fill="none" />
        <path d="M72.3 32.4h1.9" fill="none" />
      </g>
    )
  }
  if (kind === 'square') {
    return (
      <g fill="rgba(20,20,20,0.2)" stroke="#1f1f1f" strokeWidth="0.95">
        <rect x="58.6" y="30.6" width="5.8" height="4.2" rx="0.9" />
        <rect x="66.2" y="30.6" width="5.8" height="4.2" rx="0.9" />
        <path d="M64.4 32.6h1.8" fill="none" />
        <path d="M58.6 32.4h-2.1" fill="none" />
        <path d="M72 32.4h2" fill="none" />
      </g>
    )
  }
  if (kind === 'visor') {
    return (
      <g>
        <path d="M57.6 31.4h16.6c1 0 1.6 1.2 1 2.1l-2.1 2.9H60.2l-2.8-2.9c-.7-.9.2-2.1 1.2-2.1z" fill="#1c1c1c" opacity="0.82" />
      </g>
    )
  }
  if (kind === 'heart') {
    return (
      <g fill="#d45a78" stroke="#b34460" strokeWidth="0.5">
        <path d="M61.8 34.2c-2.1-1.9-2.9-3.1-1.5-4.3.8-.8 1.9 0 2.1.8.2-.8 1.3-1.5 2.1-.7 1.3 1.1.2 2.5-2.7 4.2z" />
        <path d="M69.2 34.2c-2.1-1.9-2.9-3.1-1.5-4.3.8-.8 1.9 0 2.1.8.2-.8 1.3-1.5 2.1-.7 1.3 1.1.2 2.5-2.7 4.2z" />
        <path d="M64.4 32.4h2" fill="none" stroke="#b34460" />
      </g>
    )
  }
  if (kind === 'star') {
    return (
      <g fill="#f0d36a" stroke="#c9a63a" strokeWidth="0.45">
        <path d="M61.8 28.8l1 2.2 2.4.2-1.9 1.5.7 2.2-2.2-1.2-2.2 1.2.7-2.2-1.9-1.5 2.4-.2z" />
        <path d="M69.2 28.8l1 2.2 2.4.2-1.9 1.5.7 2.2-2.2-1.2-2.2 1.2.7-2.2-1.9-1.5 2.4-.2z" />
      </g>
    )
  }
  if (kind === 'cateye') {
    return (
      <g fill="rgba(20,20,20,0.22)" stroke="#1a1a1a" strokeWidth="0.9">
        <path d="M58.4 33.4c0-1.9 1.7-3.4 3.8-2.9 1.4.3 2.2 1.4 2.2 2.7 0 1.2-1.5 1.9-3.3 1.9s-2.7-.7-2.7-1.7z" />
        <path d="M65.8 33.4c0-1.9 1.7-3.4 3.8-2.9 1.4.3 3.1 1 3.6 2-1.2 1.4-2.9 2.2-4.8 2.2s-2.6-.5-2.6-1.3z" />
        <path d="M64.4 32.8h1.4" fill="none" />
      </g>
    )
  }
  return null
}

function Clothes({ kind }) {
  if (kind === 'tee') {
    return (
      <g>
        <path d="M34.2 47.2c8.2 4.6 23.4 4.6 31.6 0l2.2 10.4c-7.6 3.8-21.8 3.8-30 0z" fill="#f3efe4" />
        <path d="M32 46.8c-4 2.2-7.2 5.4-8.2 7.6 3.2 1.1 6.2.3 8-1.3z" fill="#e7e0d2" />
        <path d="M68 46.8c4 2.2 7.2 5.4 8.2 7.6-3.2 1.1-6.2.3-8-1.3z" fill="#e7e0d2" />
        <path d="M47.8 52.2h4.4v3.4h-4.4z" fill="#d7cfc0" />
      </g>
    )
  }
  if (kind === 'hoodie') {
    return (
      <g>
        <path d="M33.6 46.6c8.4 5.2 24.4 5.2 32.8 0l2.6 12c-8.4 4.6-24 4.6-32.2 0z" fill="#3f6d4c" />
        <path d="M31.2 46.2c-4.6 2.6-8 6-9 8.6 3.6 1.4 7 .4 9.2-1.5z" fill="#355c40" />
        <path d="M68.8 46.2c4.6 2.6 8 6 9 8.6-3.6 1.4-7 .4-9.2-1.5z" fill="#355c40" />
        <path d="M43.8 54.2h12.4l-1.8 4.2H45.6z" fill="#2f5440" />
        <path d="M43.6 48c4 2.4 8.4 2.4 12.4 0" fill="none" stroke="#2d513c" strokeWidth="0.9" />
      </g>
    )
  }
  if (kind === 'jacket') {
    return (
      <g>
        <path d="M32.8 46.4c4.6 3.2 9.8 4.8 14.8 5.2l-1.8 11.6c-6.6-.8-12.4-4.2-16-8.4z" fill="#c9b089" />
        <path d="M67.2 46.4c-4.6 3.2-9.8 4.8-14.8 5.2l1.8 11.6c6.6-.8 12.4-4.2 16-8.4z" fill="#c9b089" />
        <path d="M30 46.2c-4.4 2.4-7.6 5.8-8.6 8.2 3.4 1.3 6.6.3 8.6-1.4z" fill="#b89d76" />
        <path d="M70 46.2c4.4 2.4 7.6 5.8 8.6 8.2-3.4 1.3-6.6.3-8.6-1.4z" fill="#b89d76" />
      </g>
    )
  }
  if (kind === 'scarf') {
    return (
      <g>
        <path d="M36.2 50.4c8.4 3.8 19.2 3.8 27.6 0 .8 1.6.6 3-.2 4.2-8.6 3.2-19.6 3.2-27.4 0-.8-1.2-.6-2.6.0-4.2z" fill="#d85b4a" />
        <path d="M61.4 52.8l3.8 11.4 3.4-1-2.6-10.8z" fill="#c44d3e" />
        <path d="M63 57.2h5" stroke="#f0c3b8" strokeWidth="0.55" />
        <path d="M63.6 59.4h4.4" stroke="#f0c3b8" strokeWidth="0.55" />
      </g>
    )
  }
  if (kind === 'sweater') {
    return (
      <g>
        <path d="M33.8 46.8c8.2 4.8 24 4.8 32.2 0l2.6 11.4c-8 4.2-23.6 4.2-31.8 0z" fill="#8b4b3a" />
        <path d="M31.4 46.4c-4.4 2.4-7.6 5.6-8.6 8 3.4 1.2 6.6.3 8.6-1.3z" fill="#7a4032" />
        <path d="M68.6 46.4c4.4 2.4 7.6 5.6 8.6 8-3.4 1.2-6.6.3-8.6-1.3z" fill="#7a4032" />
        <path d="M37 50.4h26" stroke="#a45d4a" strokeWidth="0.9" />
        <path d="M37.4 53h25.2" stroke="#a45d4a" strokeWidth="0.9" />
      </g>
    )
  }
  if (kind === 'vest') {
    return (
      <g>
        <path d="M35 46.8c4.8 3.6 9.4 4.8 13.2 5.2l-1.2 11c-6-.6-11-3.6-14.4-7.4z" fill="#3d4a38" />
        <path d="M65 46.8c-4.8 3.6-9.4 4.8-13.2 5.2l1.2 11c6-.6 11-3.6 14.4-7.4z" fill="#3d4a38" />
        <path d="M48.2 52.2h3.6" stroke="#c9b089" strokeWidth="0.7" />
      </g>
    )
  }
  if (kind === 'overalls') {
    return (
      <g>
        <path d="M37 46.2h5.6v6.8h14.8v-6.8H63l1.8 13.6c-6.8 3.4-17.6 3.4-24.4 0z" fill="#4b6d8a" />
        <path d="M42.6 53h14.8v2.6H42.6z" fill="#3d5b74" />
        <circle cx="45.2" cy="54.3" r="0.7" fill="#d7cfc0" />
        <circle cx="54.8" cy="54.3" r="0.7" fill="#d7cfc0" />
      </g>
    )
  }
  if (kind === 'raincoat') {
    return (
      <g>
        <path d="M33 46.4c8.4 5.4 25.6 5.4 34 0l2.8 12.4c-8.8 4.8-25.6 4.8-34 0z" fill="#e4c056" />
        <path d="M30.4 46c-4.6 2.6-8 6.2-9 8.8 3.8 1.4 7.2.4 9.2-1.5z" fill="#d4ad3f" />
        <path d="M69.6 46c4.6 2.6 8 6.2 9 8.8-3.8 1.4-7.2.4-9.2-1.5z" fill="#d4ad3f" />
        <path d="M49.4 48.6v10.2" stroke="#c9a63a" strokeWidth="0.9" />
      </g>
    )
  }
  if (kind === 'cape') {
    return (
      <g>
        <path d="M31.2 46.2c8 3.6 29.6 3.6 37.6 0 2.4 7 3.8 14.6 1 18-9.6 3.8-27 3.8-37.6 0-3-3.4-2.2-11.2-1-18z" fill="#6a3d7a" />
        <path d="M36.8 48.6c7.8 2.8 18.6 2.8 26.4 0" fill="none" stroke="#845094" strokeWidth="0.8" />
      </g>
    )
  }
  return null
}
