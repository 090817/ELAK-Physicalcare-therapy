export const EPISODE_SLOTS = 7

export const episodes = [
  {
    id: 1,
    title: 'Episode 1',
    src: './episodes/episode-01.mp4',
  },
]

export function storyUnlockedFromQuery() {
  try {
    const n = Number(new URLSearchParams(window.location.search).get('story') || '0')
    return Number.isFinite(n) ? Math.max(0, Math.min(31, Math.floor(n))) : 0
  } catch {
    return 0
  }
}

export function startRewardTab() {
  try {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'avatar') return 'avatar'
    if (tab === 'episodes' || new URLSearchParams(window.location.search).get('watch') === '1') return 'episodes'
  } catch {
    /* stay on badges */
  }
  return 'training'
}

export function shouldAutoplayEpisode() {
  try {
    return new URLSearchParams(window.location.search).get('watch') === '1'
  } catch {
    return false
  }
}

export function episodeSlots() {
  return Array.from({ length: EPISODE_SLOTS }, (_, index) => {
    const id = index + 1
    return episodes.find((item) => item.id === id) || { id, title: `Episode ${id}`, src: '' }
  })
}
