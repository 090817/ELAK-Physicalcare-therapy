export const AVATAR_STAGES = [
  { id: 'child', label: 'Child', src: './avatars/kale-child.png', need: 0 },
  { id: 'youth', label: 'Youth', src: './avatars/kale-youth.png', need: 5 },
  { id: 'adult', label: 'Adult', src: './avatars/kale-adult.png', need: 12 },
]

export function avatarGrowthFromQuery() {
  try {
    const n = Number(new URLSearchParams(window.location.search).get('growth') || '0')
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

export function avatarStageOf(points) {
  const n = Math.max(0, Number(points) || 0)
  if (n >= 12) return AVATAR_STAGES[2]
  if (n >= 5) return AVATAR_STAGES[1]
  return AVATAR_STAGES[0]
}

export function avatarNextOf(points) {
  const n = Math.max(0, Number(points) || 0)
  if (n < 5) return { stage: AVATAR_STAGES[1], remain: 5 - n, limit: 5 }
  if (n < 12) return { stage: AVATAR_STAGES[2], remain: 12 - n, limit: 12 }
  return { stage: null, remain: 0, limit: 12 }
}

export function avatarProgress(points) {
  const n = Math.max(0, Number(points) || 0)
  if (n < 5) return n / 5
  if (n < 12) return (n - 5) / 7
  return 1
}
