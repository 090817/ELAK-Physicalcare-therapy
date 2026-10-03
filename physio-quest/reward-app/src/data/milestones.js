export const milestones = [
  {
    id: 'turn',
    threshold: 3,
    stage: 'Getting started',
    title: 'Easy turn',
    description: 'Neck stiffness eases. Looking over your shoulder feels less tight.',
    teaser: 'Looking over your shoulder gets a little easier.',
    blessing: 'The space behind you is coming back into view.',
    icon: 'turn',
    wash: 'from-[#d9f3e4] via-[#eef8ea] to-[#fff1e0]',
  },
  {
    id: 'bend',
    threshold: 7,
    stage: 'Habit forming',
    title: 'Easy bend',
    description: 'Your body starts to feel more flexible. Tying a shoe is less tight.',
    teaser: 'Bending to tie a shoe will feel less tight in the back.',
    blessing: 'Flexibility comes back a little at a time.',
    icon: 'bend',
    wash: 'from-[#d7f0ea] via-[#f3faf4] to-[#ffe8d4]',
  },
  {
    id: 'swing',
    threshold: 15,
    stage: 'Stronger motion',
    title: 'Easy swing',
    description: 'Joints move more freely. Sport and daily movement feel more in your control.',
    teaser: 'Raising an arm and swinging through will feel freer.',
    blessing: 'When the arm lifts, the rest of the day opens with it.',
    icon: 'swing',
    wash: 'from-[#ffe4c8] via-[#fff6ea] to-[#e5f6ec]',
  },
  {
    id: 'roam',
    threshold: 30,
    stage: 'Steady ease',
    title: 'Easy walk',
    description: 'Longer walks and stairs feel lighter and less heavy.',
    teaser: 'Walks and stairs will feel a little lighter.',
    blessing: 'You are walking lighter. That ease was built day by day.',
    icon: 'roam',
    wash: 'from-[#dceee4] via-[#f7fbf4] to-[#ffe7c8]',
  },
]

export function getNextMilestone(count) {
  return milestones.find((item) => count < item.threshold) ?? null
}

export function segmentPercent(value, thresholds) {
  const points = [0, ...thresholds]
  const last = points[points.length - 1]
  if (value >= last) return 100

  const segments = points.length - 1
  for (let index = 0; index < segments; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    if (value <= end) {
      const ratio = (value - start) / (end - start)
      return ((index + ratio) / segments) * 100
    }
  }

  return 100
}

export function getReservePercent(count) {
  return segmentPercent(count, milestones.map((item) => item.threshold))
}

export function getNodeLeft(index) {
  return ((index + 1) / milestones.length) * 100
}

export function getUnlockedMilestones(previousCount, nextCount) {
  return milestones.filter(
    (item) => previousCount < item.threshold && nextCount >= item.threshold,
  )
}
